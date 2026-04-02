CREATE TABLE IF NOT EXISTS "agent_memory_artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "project_id" uuid,
  "issue_id" uuid,
  "scope" text DEFAULT 'agent' NOT NULL,
  "kind" text DEFAULT 'operational_note' NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "token_estimate" integer DEFAULT 0 NOT NULL,
  "relevance_score" real DEFAULT 1.0 NOT NULL,
  "source_run_id" uuid,
  "source_comment_id" uuid,
  "expires_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_memory_artifacts" ADD CONSTRAINT "agent_memory_artifacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_memory_artifacts" ADD CONSTRAINT "agent_memory_artifacts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_memory_artifacts" ADD CONSTRAINT "agent_memory_artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_memory_artifacts" ADD CONSTRAINT "agent_memory_artifacts_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_memory_artifacts" ADD CONSTRAINT "agent_memory_artifacts_source_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_memory_artifacts" ADD CONSTRAINT "agent_memory_artifacts_source_comment_id_issue_comments_id_fk" FOREIGN KEY ("source_comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_memory_artifacts_company_agent_scope_idx" ON "agent_memory_artifacts" USING btree ("company_id","agent_id","scope");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_memory_artifacts_company_agent_project_idx" ON "agent_memory_artifacts" USING btree ("company_id","agent_id","project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_memory_artifacts_company_agent_created_idx" ON "agent_memory_artifacts" USING btree ("company_id","agent_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_memory_artifacts_source_run_idx" ON "agent_memory_artifacts" USING btree ("source_run_id");
