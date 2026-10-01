ALTER TABLE "question_sources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "question_sources" CASCADE;--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_source_id_sources_id_fk";
--> statement-breakpoint
DROP INDEX "idx_questions_source_id";--> statement-breakpoint
ALTER TABLE "bundles" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "source_id";