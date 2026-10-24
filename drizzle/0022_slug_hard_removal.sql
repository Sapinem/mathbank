-- MAT-131B / MAT-134 — Tahap B: HARD REMOVAL kolom `slug`
-- Menghapus seluruh kolom slug dan unique index terkait dari 5 tabel.

DROP INDEX IF EXISTS "uq_topics_slug";--> statement-breakpoint
DROP INDEX IF EXISTS "uq_tags_slug";--> statement-breakpoint
DROP INDEX IF EXISTS "uq_bundles_slug_active";--> statement-breakpoint
DROP INDEX IF EXISTS "uq_sources_slug";--> statement-breakpoint

ALTER TABLE "topics" DROP COLUMN IF EXISTS "slug";--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN IF EXISTS "slug";--> statement-breakpoint
ALTER TABLE "bundles" DROP COLUMN IF EXISTS "slug";--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN IF EXISTS "slug";--> statement-breakpoint
ALTER TABLE "ingest_queue" DROP COLUMN IF EXISTS "slug";--> statement-breakpoint
ALTER TABLE "bundles" ALTER COLUMN "print_config" SET DEFAULT '{"institutionName":"Math My ID","twoColumnLayout":true,"includeAnswerKey":false,"showQuestionNumber":true,"pageSize":"A4","explanationPlacement":"none","answerSpaceCm":4}'::jsonb;--> statement-breakpoint
UPDATE "bundles"
   SET "print_config" = "print_config" || '{"explanationPlacement":"none","answerSpaceCm":4}'::jsonb
 WHERE NOT ("print_config" ? 'explanationPlacement');
