CREATE TYPE "public"."bundle_origin" AS ENUM('ingest', 'manual');--> statement-breakpoint
ALTER TABLE "collection_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "collection_items" CASCADE;--> statement-breakpoint
DROP TABLE "collections" CASCADE;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "entity_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."audit_entity";--> statement-breakpoint
CREATE TYPE "public"."audit_entity" AS ENUM('question', 'bundle', 'topic', 'source', 'event', 'user', 'setting', 'media', 'tag');--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "entity_type" SET DATA TYPE "public"."audit_entity" USING "entity_type"::"public"."audit_entity";--> statement-breakpoint
ALTER TABLE "bundles" ADD COLUMN "origin" "bundle_origin" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_bundles_origin" ON "bundles" USING btree ("origin");