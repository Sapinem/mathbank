-- ADR-0019 Pilar 1 v2.0: Isolasi vektor ke `question_embeddings` (1:1).
--
-- FASE A — Buat tabel baru. Kolom lama BELUM di-drop agar backfill bisa jalan.
-- Setelah migrasi ini: jalankan backfill SQL, lalu terapkan 0020 untuk drop kolom.

CREATE TABLE IF NOT EXISTS "question_embeddings" (
	"question_id" uuid PRIMARY KEY NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"embedding_content_hash" varchar(64),
	"embedding_model_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'question_embeddings_question_id_questions_id_fk'
  ) THEN
    ALTER TABLE "question_embeddings" ADD CONSTRAINT "question_embeddings_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_question_embeddings_hnsw" ON "question_embeddings" USING hnsw ("embedding" vector_cosine_ops);

