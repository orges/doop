-- The deployed branch already applied a custom migration after upstream 0048.
-- Its timestamp causes Drizzle to skip upstream 0049 on that database. Apply
-- the missing schema and one-time backfill only where that migration was skipped.
DO $$
BEGIN
  IF to_regclass('public.image_description_prefs') IS NULL THEN
    CREATE TABLE "image_description_prefs" (
      "user_id" text PRIMARY KEY NOT NULL,
      "mode" text DEFAULT 'account' NOT NULL,
      "updated_at" bigint NOT NULL
    );
    ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "description" text;
    ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "described_at" bigint;
    ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "described_by" text;
    ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "describe_attempts" integer DEFAULT 0 NOT NULL;
    ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "describe_payer_id" text;
    ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "describe_provider" text;
    UPDATE "assets" SET "describe_attempts" = 3;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "model_accounts" ADD COLUMN IF NOT EXISTS "supports_vision" boolean DEFAULT false NOT NULL;

--> statement-breakpoint
-- Repair skipped upstream 0053_library_components.sql on installations upgraded from our previous branch.
CREATE TABLE IF NOT EXISTS "library_components" (
	"canvas_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"template" text NOT NULL,
	"css" text NOT NULL,
	"raw_css" text NOT NULL,
	"head" jsonb NOT NULL,
	"props" jsonb NOT NULL,
	"slots" jsonb NOT NULL,
	"code" jsonb,
	"rev" integer NOT NULL,
	"published_at" bigint NOT NULL,
	"published_by" text NOT NULL,
	CONSTRAINT "library_components_canvas_id_id_pk" PRIMARY KEY("canvas_id","id")
);

--> statement-breakpoint
-- Repair skipped upstream 0054_library_publish_policy.sql on installations upgraded from our previous branch.
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "library_publish" text;

--> statement-breakpoint
-- Repair skipped upstream 0055_library_nested_sources.sql on installations upgraded from our previous branch.
ALTER TABLE "library_components" ADD COLUMN IF NOT EXISTS "nested" jsonb;

--> statement-breakpoint
-- Repair skipped upstream 0056_work_replies.sql on installations upgraded from our previous branch.
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "reply" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "reply" text;

--> statement-breakpoint
-- Repair skipped upstream 0057_custom_agents.sql on installations upgraded from our previous branch.
CREATE TABLE IF NOT EXISTS "agent_overrides" (
	"scope" text NOT NULL,
	"role_id" text NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"color" text,
	"blurb" text,
	"brief" text,
	"reviewer" boolean,
	"updated_by" text NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "agent_overrides_scope_role_id_pk" PRIMARY KEY("scope","role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"blurb" text NOT NULL,
	"brief" text NOT NULL,
	"reviewer" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "claimed_by_resident" boolean;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "custom_agents_scope_handle_idx" ON "custom_agents" USING btree ("scope","handle");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "custom_agents_scope_name_idx" ON "custom_agents" USING btree ("scope","name");

--> statement-breakpoint
-- Repair skipped upstream 0058_component_soft_delete.sql on installations upgraded from our previous branch.
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "deleted_at" bigint;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "deleted_by" text;
