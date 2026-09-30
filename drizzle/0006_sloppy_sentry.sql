ALTER TYPE "public"."ingest_status" ADD VALUE 'skipped';--> statement-breakpoint
ALTER TABLE "ingest_queue" ADD COLUMN "imported_questions_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_queue" ADD COLUMN "ai_notes" text;