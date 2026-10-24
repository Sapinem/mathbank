-- ADR-0019 Pilar 1 v2.0: FASE B — Drop kolom vektor inline setelah backfill.
-- Prasyarat: migrasi 0018 + backfill question_embeddings sudah selesai.

-- 1. Failsafe Backfill: jika kolom embedding masih ada & belum terisi ke question_embeddings, isi dulu.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'embedding'
  ) THEN
    INSERT INTO question_embeddings (question_id, embedding, embedding_content_hash, embedding_model_name, created_at, updated_at)
    SELECT id, embedding, embedding_content_hash, embedding_model_name, NOW(), NOW()
      FROM questions
     WHERE embedding IS NOT NULL
    ON CONFLICT (question_id) DO NOTHING;
  END IF;
END $$;
--> statement-breakpoint

-- 2. Failsafe Assertion: verifikasi TIDAK ADA baris questions dengan embedding yang belum termigrasi.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'embedding'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM questions q
      LEFT JOIN question_embeddings qe ON qe.question_id = q.id
      WHERE q.embedding IS NOT NULL AND qe.question_id IS NULL
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'ABORT: Masih ada baris questions dengan embedding yang belum termigrasi ke question_embeddings!';
    END IF;
  END IF;
END $$;
--> statement-breakpoint

-- 3. Drop kolom inline
ALTER TABLE "questions" DROP COLUMN IF EXISTS "embedding";--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN IF EXISTS "embedding_content_hash";--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN IF EXISTS "embedding_model_name";

