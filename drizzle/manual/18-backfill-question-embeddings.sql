-- ADR-0019 Pilar 1 v2.0: Backfill vektor dari `questions` ke `question_embeddings`.
-- Jalankan SETELAH migrasi 0018 dan SEBELUM migrasi 0019.
--
-- Idempotent: lewati jika kolom embedding sudah di-drop dari questions.
-- Estimasi: ~11,867 baris × 4 KB vektor ≈ 47 MB — selesai < 30 detik.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'embedding'
  ) THEN
    EXECUTE '
      INSERT INTO question_embeddings (question_id, embedding, embedding_content_hash, embedding_model_name, created_at, updated_at)
      SELECT id, embedding, embedding_content_hash, embedding_model_name, NOW(), NOW()
        FROM questions
       WHERE embedding IS NOT NULL
      ON CONFLICT (question_id) DO NOTHING;
    ';
  END IF;
END $$;
