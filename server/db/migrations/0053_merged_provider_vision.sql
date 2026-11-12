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
