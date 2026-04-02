import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { agentMemoryService } from "../services/agent-memory.js";
import { agentService } from "../services/agents.js";

const createMemorySchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  issueId: z.string().uuid().optional().nullable(),
  scope: z.enum(["agent", "project"]).optional().default("agent"),
  kind: z
    .enum([
      "learned_preference",
      "operational_note",
      "decision",
      "pattern",
      "fact",
      "correction",
    ])
    .optional()
    .default("operational_note"),
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(50000),
  relevanceScore: z.number().min(0).max(10).optional(),
  sourceRunId: z.string().uuid().optional().nullable(),
  sourceCommentId: z.string().uuid().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

const updateMemorySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(50000).optional(),
  kind: z
    .enum([
      "learned_preference",
      "operational_note",
      "decision",
      "pattern",
      "fact",
      "correction",
    ])
    .optional(),
  relevanceScore: z.number().min(0).max(10).optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  archivedAt: z.coerce.date().optional().nullable(),
});

export function agentMemoryRoutes(db: Db) {
  const router = Router();
  const memorySvc = agentMemoryService(db);
  const agents = agentService(db);

  /**
   * Resolve agent from param (UUID or urlKey) and assert company access.
   */
  async function resolveAgent(req: import("express").Request) {
    const agentParam = req.params.agentId as string;
    const agent = await agents.getById(agentParam);
    if (!agent) throw notFound("Agent not found");
    assertCompanyAccess(req, agent.companyId);

    // Agents can only manage their own memories (unless board)
    if (req.actor.type === "agent" && req.actor.agentId !== agent.id) {
      throw forbidden("Agents can only manage their own memories");
    }

    return agent;
  }

  // ── List memories ──────────────────────────────────────────────
  router.get("/agents/:agentId/memories", async (req, res) => {
    const agent = await resolveAgent(req);

    const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const includeArchived = req.query.includeArchived === "true";
    const limit = Math.min(
      Number(req.query.limit) || 50,
      200,
    );
    const offset = Number(req.query.offset) || 0;

    const rows = await memorySvc.list(
      agent.companyId,
      agent.id,
      { scope, kind, projectId, includeArchived },
      limit,
      offset,
    );

    res.json(rows);
  });

  // ── Recall memories for heartbeat (used by heartbeat assembly) ─
  // Must be defined before /:memoryId to avoid route conflict
  router.get(
    "/agents/:agentId/memories/recall",
    async (req, res) => {
      const agent = await resolveAgent(req);

      const projectId =
        typeof req.query.projectId === "string" ? req.query.projectId : null;
      const budgetTokens =
        typeof req.query.budgetTokens === "string"
          ? Number(req.query.budgetTokens)
          : undefined;

      const result = await memorySvc.recallForHeartbeat(
        agent.companyId,
        agent.id,
        projectId,
        budgetTokens,
      );

      res.json(result);
    },
  );

  // ── Get single memory ──────────────────────────────────────────
  router.get("/agents/:agentId/memories/:memoryId", async (req, res) => {
    const agent = await resolveAgent(req);
    const memory = await memorySvc.getById(req.params.memoryId as string);

    if (!memory || memory.agentId !== agent.id) {
      throw notFound("Memory artifact not found");
    }

    res.json(memory);
  });

  // ── Create memory ──────────────────────────────────────────────
  router.post(
    "/agents/:agentId/memories",
    validate(createMemorySchema),
    async (req, res) => {
      const agent = await resolveAgent(req);
      const actor = getActorInfo(req);

      const memory = await memorySvc.create({
        companyId: agent.companyId,
        agentId: agent.id,
        projectId: req.body.projectId,
        issueId: req.body.issueId,
        scope: req.body.scope,
        kind: req.body.kind,
        title: req.body.title,
        content: req.body.content,
        relevanceScore: req.body.relevanceScore,
        sourceRunId: req.body.sourceRunId ?? actor.runId,
        sourceCommentId: req.body.sourceCommentId,
        expiresAt: req.body.expiresAt,
      });

      res.status(201).json(memory);
    },
  );

  // ── Update memory ──────────────────────────────────────────────
  router.patch(
    "/agents/:agentId/memories/:memoryId",
    validate(updateMemorySchema),
    async (req, res) => {
      const agent = await resolveAgent(req);

      const existing = await memorySvc.getById(req.params.memoryId as string);
      if (!existing || existing.agentId !== agent.id) {
        throw notFound("Memory artifact not found");
      }

      const updated = await memorySvc.update(
        req.params.memoryId as string,
        req.body,
      );

      res.json(updated);
    },
  );

  // ── Archive memory (soft delete) ──────────────────────────────
  router.post(
    "/agents/:agentId/memories/:memoryId/archive",
    async (req, res) => {
      const agent = await resolveAgent(req);

      const existing = await memorySvc.getById(req.params.memoryId as string);
      if (!existing || existing.agentId !== agent.id) {
        throw notFound("Memory artifact not found");
      }

      const archived = await memorySvc.archive(req.params.memoryId as string);
      res.json(archived);
    },
  );

  // ── Delete memory (hard delete) ───────────────────────────────
  router.delete(
    "/agents/:agentId/memories/:memoryId",
    async (req, res) => {
      const agent = await resolveAgent(req);

      const existing = await memorySvc.getById(req.params.memoryId as string);
      if (!existing || existing.agentId !== agent.id) {
        throw notFound("Memory artifact not found");
      }

      await memorySvc.delete(req.params.memoryId as string);
      res.json({ deleted: true });
    },
  );

  return router;
}
