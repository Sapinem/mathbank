CREATE TYPE "public"."bundle_origin" AS ENUM('ingest', 'manual');--> statement-breakpoint
ALTER TABLE "collection_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "collection_items" CASCADE;--> statement-breakpoint
DROP TABLE "collections" CASCADE;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "entity_type" SET DATA TYPE text;--> statement-breakpoint
DO $$
DECLARE
  has_trg boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_audit_logs_immutable'
      AND tgrelid = to_regclass('public.audit_logs')
      AND tgenabled != 'D'
  ) INTO has_trg;

  IF has_trg THEN
    ALTER TABLE "audit_logs" DISABLE TRIGGER trg_audit_logs_immutable;
  END IF;

  UPDATE "audit_logs" SET "entity_type" = 'bundle' WHERE "entity_type" = 'collection';

  IF has_trg THEN
    ALTER TABLE "audit_logs" ENABLE TRIGGER trg_audit_logs_immutable;
  END IF;
END $$;--> statement-breakpoint
DROP TYPE "public"."audit_entity";--> statement-breakpoint
CREATE TYPE "public"."audit_entity" AS ENUM('question', 'bundle', 'topic', 'source', 'event', 'user', 'setting', 'media', 'tag');--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "entity_type" SET DATA TYPE "public"."audit_entity" USING "entity_type"::"public"."audit_entity";--> statement-breakpoint
ALTER TABLE "bundles" ADD COLUMN "origin" "bundle_origin" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_bundles_origin" ON "bundles" USING btree ("origin");