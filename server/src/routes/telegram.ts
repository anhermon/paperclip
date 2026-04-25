/**
 * Telegram ingest route.
 *
 * Receives messages forwarded from the telegram-bot sidecar and creates
 * Paperclip issues or posts comments, depending on the message content.
 *
 * POST /api/telegram/ingest
 *   body: { chat_id, text, message_id?, username? }
 *
 * Message parsing rules:
 *   /routines               → list all routines (id, title, status)
 *   /run_routine <id>       → manually trigger a routine by id
 *   /issue <title>          → create issue (explicit)
 *   /comment <id> <text>    → post comment on issue by identifier (e.g. ANGA-42)
 *   any other text          → create issue with title = first line, rest = description
 *
 * Default project: TELEGRAM_DEFAULT_PROJECT_ID env var (optional).
 * Default company: TELEGRAM_DEFAULT_COMPANY_ID env var, falls back to first company.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { issueService, heartbeatService, routineService } from "../services/index.js";
import { queueIssueAssignmentWakeup } from "../services/issue-assignment-wakeup.js";
import { telegramNotify } from "../services/telegram-notify.js";
import { logger } from "../middleware/logger.js";

const DEFAULT_COMPANY_ID =
  process.env.TELEGRAM_DEFAULT_COMPANY_ID ?? "dbc742c7-9a38-4542-936b-523dfa3a7fd2";
const DEFAULT_PROJECT_ID = process.env.TELEGRAM_DEFAULT_PROJECT_ID ?? null;
// Issues created from Telegram are automatically assigned to the CTO for triage.
const TELEGRAM_ASSIGNEE_AGENT_ID =
  process.env.TELEGRAM_ASSIGNEE_AGENT_ID ?? "4e5cbf52-a530-439f-917c-a6cfee78d76d";

interface IngestBody {
  chat_id: number;
  text: string;
  message_id?: number;
  username?: string;
}

/** Escape HTML special characters to prevent injection in Telegram HTML messages */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function telegramRoutes(db: Db) {
  const router = Router();
  const svc = issueService(db);
  const heartbeat = heartbeatService(db);
  const routines = routineService(db);

  router.post("/telegram/ingest", async (req, res) => {
    const body = req.body as IngestBody;

    if (!body?.text || typeof body.text !== "string") {
      res.status(400).json({ error: "text is required" });
      return;
    }

    const text = body.text.trim();
    const from = body.username ? `@${body.username}` : `chat_id:${body.chat_id}`;

    try {
      // /routines → list all routines
      if (/^\/routines\s*$/i.test(text)) {
        const list = await routines.list(DEFAULT_COMPANY_ID);
        if (list.length === 0) {
          await telegramNotify.info("📋 No routines configured.");
          res.json({ ok: true, action: "routines", count: 0 });
          return;
        }
        const lines = list.map((r) => {
          const schedule = r.triggers.find((t) => t.kind === "schedule");
          const cronLabel = schedule?.label ?? schedule?.nextRunAt?.toISOString().slice(0, 16).replace("T", " ") ?? "—";
          // P1 fix: Display full UUID so users can copy/paste to /run_routine
          // P2 fix: Escape HTML in title and status to prevent injection
          return `• <code>${r.id}</code> <b>${escapeHtml(r.title)}</b> [${escapeHtml(r.status)}] ${cronLabel}`;
        });
        await telegramNotify.send({
          text: `📋 <b>Routines (${list.length})</b>\n\n${lines.join("\n")}`,
          parse_mode: "HTML",
        });
        res.json({ ok: true, action: "routines", count: list.length });
        return;
      }

      // /run_routine <routineId>
      const runRoutineMatch = text.match(/^\/run_routine\s+(\S+)\s*$/i);
      if (runRoutineMatch) {
        const routineId = runRoutineMatch[1].trim();
        try {
          // P0 security fix: Validate routine belongs to DEFAULT_COMPANY_ID before executing
          const routine = await routines.get(routineId);
          if (routine.companyId !== DEFAULT_COMPANY_ID) {
            await telegramNotify.error(`❌ Routine ${routineId} not found or access denied`);
            res.status(403).json({ error: "Routine not found or access denied" });
            return;
          }
          const run = await routines.runRoutine(routineId, { source: "manual" });
          await telegramNotify.info(
            `▶️ Routine triggered\nID: ${routineId}\nRun: ${run.id.slice(0, 8)} — status: ${run.status}`,
          );
          res.json({ ok: true, action: "run_routine", routineId, runId: run.id, status: run.status });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          await telegramNotify.info(`❌ Failed to run routine ${routineId}: ${msg}`);
          res.status(400).json({ error: msg });
        }
        return;
      }

      // /comment <ANGA-NNN> <message text>
      const commentMatch = text.match(/^\/comment\s+([A-Z]+-\d+)\s+([\s\S]+)$/i);
      if (commentMatch) {
        const identifier = commentMatch[1].toUpperCase();
        const commentBody = commentMatch[2].trim();

        const issue = await svc.getByIdentifier(identifier);
        if (!issue) {
          res.status(404).json({ error: `Issue ${identifier} not found` });
          return;
        }

        const comment = await svc.addComment(
          issue.id,
          `📱 ${from}: ${commentBody}`,
          { userId: "telegram" },
        );

        logger.info({ identifier, commentId: comment.id }, "telegram-ingest: comment posted");
        res.json({ ok: true, action: "comment", identifier, commentId: comment.id });
        return;
      }

      // /issue <title> or free text → create issue
      let title: string;
      let description: string | null = null;

      const issueMatch = text.match(/^\/issue\s+([\s\S]+)$/i);
      if (issueMatch) {
        const content = issueMatch[1].trim();
        const lines = content.split("\n");
        title = lines[0].trim();
        description = lines.length > 1 ? lines.slice(1).join("\n").trim() : null;
      } else {
        const lines = text.split("\n");
        title = lines[0].trim();
        description =
          lines.length > 1
            ? `_From Telegram (${from})_\n\n${lines.slice(1).join("\n").trim()}`
            : `_From Telegram (${from})_`;
      }

      const issue = await svc.create(DEFAULT_COMPANY_ID, {
        title,
        description,
        status: "todo",
        priority: "medium",
        projectId: DEFAULT_PROJECT_ID,
        createdByUserId: "telegram",
        createdByAgentId: null,
        assigneeAgentId: TELEGRAM_ASSIGNEE_AGENT_ID,
      });

      void queueIssueAssignmentWakeup({
        heartbeat,
        issue,
        reason: "issue_assigned",
        mutation: "create",
        contextSource: "telegram.ingest",
        requestedByActorType: "system",
        requestedByActorId: null,
      });

      logger.info(
        { identifier: issue.identifier, title, assigneeAgentId: TELEGRAM_ASSIGNEE_AGENT_ID },
        "telegram-ingest: issue created",
      );
      res.json({ ok: true, action: "issue", identifier: issue.identifier, issueId: issue.id });
    } catch (err) {
      logger.error({ err }, "telegram-ingest: error");
      res.status(500).json({ error: "Internal error" });
    }
  });

  return router;
}
