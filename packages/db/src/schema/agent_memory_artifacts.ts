import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { projects } from "./projects.js";
import { issues } from "./issues.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { issueComments } from "./issue_comments.js";

export const agentMemoryArtifacts = pgTable(
  "agent_memory_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    issueId: uuid("issue_id").references(() => issues.id, {
      onDelete: "set null",
    }),
    scope: text("scope").notNull().default("agent"),
    kind: text("kind").notNull().default("operational_note"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    relevanceScore: real("relevance_score").notNull().default(1.0),
    sourceRunId: uuid("source_run_id").references(() => heartbeatRuns.id, {
      onDelete: "set null",
    }),
    sourceCommentId: uuid("source_comment_id").references(
      () => issueComments.id,
      { onDelete: "set null" },
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyAgentScopeIdx: index(
      "agent_memory_artifacts_company_agent_scope_idx",
    ).on(table.companyId, table.agentId, table.scope),
    companyAgentProjectIdx: index(
      "agent_memory_artifacts_company_agent_project_idx",
    ).on(table.companyId, table.agentId, table.projectId),
    companyAgentCreatedIdx: index(
      "agent_memory_artifacts_company_agent_created_idx",
    ).on(table.companyId, table.agentId, table.createdAt),
    sourceRunIdx: index("agent_memory_artifacts_source_run_idx").on(
      table.sourceRunId,
    ),
  }),
);
