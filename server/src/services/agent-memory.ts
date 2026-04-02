import { and, desc, eq, isNull, or, sql, lte } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentMemoryArtifacts } from "@paperclipai/db";
import { notFound } from "../errors.js";

const VALID_SCOPES = ["agent", "project"] as const;
const VALID_KINDS = [
  "learned_preference",
  "operational_note",
  "decision",
  "pattern",
  "fact",
  "correction",
] as const;

const DEFAULT_BUDGET_TOKENS = 2000;

/** Rough token estimate: ~4 chars per token for English text */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface CreateMemoryInput {
  companyId: string;
  agentId: string;
  projectId?: string | null;
  issueId?: string | null;
  scope?: string;
  kind?: string;
  title: string;
  content: string;
  tokenEstimate?: number;
  relevanceScore?: number;
  sourceRunId?: string | null;
  sourceCommentId?: string | null;
  expiresAt?: Date | null;
}

export interface UpdateMemoryInput {
  title?: string;
  content?: string;
  relevanceScore?: number;
  kind?: string;
  expiresAt?: Date | null;
  archivedAt?: Date | null;
}

export interface MemoryFilters {
  scope?: string;
  kind?: string;
  projectId?: string;
  includeArchived?: boolean;
}

export interface RecalledMemory {
  id: string;
  scope: string;
  kind: string;
  title: string;
  content: string;
  tokenEstimate: number;
  relevanceScore: number;
  createdAt: Date;
}

export interface RecallResult {
  memories: RecalledMemory[];
  totalTokens: number;
  budgetTokens: number;
  recalledIds: string[];
}

export function agentMemoryService(db: Db) {
  return {
    async create(input: CreateMemoryInput) {
      const scope = input.scope ?? "agent";
      const kind = input.kind ?? "operational_note";
      const tokenEst =
        input.tokenEstimate ?? estimateTokens(input.title + " " + input.content);

      const [row] = await db
        .insert(agentMemoryArtifacts)
        .values({
          companyId: input.companyId,
          agentId: input.agentId,
          projectId: input.projectId ?? null,
          issueId: input.issueId ?? null,
          scope,
          kind,
          title: input.title,
          content: input.content,
          tokenEstimate: tokenEst,
          relevanceScore: input.relevanceScore ?? 1.0,
          sourceRunId: input.sourceRunId ?? null,
          sourceCommentId: input.sourceCommentId ?? null,
          expiresAt: input.expiresAt ?? null,
        })
        .returning();

      return row!;
    },

    async getById(id: string) {
      const [row] = await db
        .select()
        .from(agentMemoryArtifacts)
        .where(eq(agentMemoryArtifacts.id, id))
        .limit(1);
      return row ?? null;
    },

    async list(
      companyId: string,
      agentId: string,
      filters: MemoryFilters = {},
      limit = 50,
      offset = 0,
    ) {
      const conditions = [
        eq(agentMemoryArtifacts.companyId, companyId),
        eq(agentMemoryArtifacts.agentId, agentId),
      ];

      if (filters.scope) {
        conditions.push(eq(agentMemoryArtifacts.scope, filters.scope));
      }
      if (filters.kind) {
        conditions.push(eq(agentMemoryArtifacts.kind, filters.kind));
      }
      if (filters.projectId) {
        conditions.push(eq(agentMemoryArtifacts.projectId, filters.projectId));
      }
      if (!filters.includeArchived) {
        conditions.push(isNull(agentMemoryArtifacts.archivedAt));
      }

      const rows = await db
        .select()
        .from(agentMemoryArtifacts)
        .where(and(...conditions))
        .orderBy(
          desc(agentMemoryArtifacts.relevanceScore),
          desc(agentMemoryArtifacts.createdAt),
        )
        .limit(limit)
        .offset(offset);

      return rows;
    },

    async update(id: string, input: UpdateMemoryInput) {
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) {
        updates.content = input.content;
        updates.tokenEstimate = estimateTokens(
          (input.title ?? "") + " " + input.content,
        );
      }
      if (input.relevanceScore !== undefined)
        updates.relevanceScore = input.relevanceScore;
      if (input.kind !== undefined) updates.kind = input.kind;
      if (input.expiresAt !== undefined) updates.expiresAt = input.expiresAt;
      if (input.archivedAt !== undefined) updates.archivedAt = input.archivedAt;

      const [row] = await db
        .update(agentMemoryArtifacts)
        .set(updates)
        .where(eq(agentMemoryArtifacts.id, id))
        .returning();

      if (!row) throw notFound("Memory artifact not found");
      return row;
    },

    async archive(id: string) {
      return this.update(id, { archivedAt: new Date() });
    },

    async delete(id: string) {
      const [row] = await db
        .delete(agentMemoryArtifacts)
        .where(eq(agentMemoryArtifacts.id, id))
        .returning();
      if (!row) throw notFound("Memory artifact not found");
      return row;
    },

    /**
     * Recall memories for a heartbeat, respecting a token budget.
     * Returns agent-scoped memories first, then project-scoped if projectId provided.
     * Excludes archived and expired memories.
     */
    async recallForHeartbeat(
      companyId: string,
      agentId: string,
      projectId: string | null,
      budgetTokens?: number,
    ): Promise<RecallResult> {
      const budget = budgetTokens ?? DEFAULT_BUDGET_TOKENS;
      const now = new Date();

      // Fetch candidate memories: non-archived, non-expired, matching agent
      const baseConditions = [
        eq(agentMemoryArtifacts.companyId, companyId),
        eq(agentMemoryArtifacts.agentId, agentId),
        isNull(agentMemoryArtifacts.archivedAt),
        or(
          isNull(agentMemoryArtifacts.expiresAt),
          sql`${agentMemoryArtifacts.expiresAt} > ${now}`,
        ),
      ];

      // Scope filter: agent-level always, plus project-level if projectId given
      const scopeCondition = projectId
        ? or(
            eq(agentMemoryArtifacts.scope, "agent"),
            and(
              eq(agentMemoryArtifacts.scope, "project"),
              eq(agentMemoryArtifacts.projectId, projectId),
            ),
          )
        : eq(agentMemoryArtifacts.scope, "agent");

      const candidates = await db
        .select({
          id: agentMemoryArtifacts.id,
          scope: agentMemoryArtifacts.scope,
          kind: agentMemoryArtifacts.kind,
          title: agentMemoryArtifacts.title,
          content: agentMemoryArtifacts.content,
          tokenEstimate: agentMemoryArtifacts.tokenEstimate,
          relevanceScore: agentMemoryArtifacts.relevanceScore,
          createdAt: agentMemoryArtifacts.createdAt,
        })
        .from(agentMemoryArtifacts)
        .where(and(...baseConditions, scopeCondition))
        .orderBy(
          desc(agentMemoryArtifacts.relevanceScore),
          desc(agentMemoryArtifacts.createdAt),
        )
        .limit(100); // cap candidates to avoid large scans

      // Greedily pack into budget
      const selected: RecalledMemory[] = [];
      let totalTokens = 0;

      for (const candidate of candidates) {
        const tokens = candidate.tokenEstimate || estimateTokens(candidate.title + " " + candidate.content);
        if (totalTokens + tokens > budget && selected.length > 0) {
          break; // budget exhausted
        }
        selected.push(candidate);
        totalTokens += tokens;
      }

      return {
        memories: selected,
        totalTokens,
        budgetTokens: budget,
        recalledIds: selected.map((m) => m.id),
      };
    },
  };
}
