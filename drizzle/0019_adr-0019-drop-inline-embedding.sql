-- ADR-0019 Pilar 1 v2.0: FASE B — Drop kolom vektor inline setelah backfill.
-- Prasyarat: migrasi 0018 + backfill 18-backfill-question-embeddings.sql sudah jalan.

ALTER TABLE "questions" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "embedding_content_hash";--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "embedding_model_name";
