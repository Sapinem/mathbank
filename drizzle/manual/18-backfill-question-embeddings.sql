-- ADR-0019 Pilar 1 v2.0: Backfill vektor dari `questions` ke `question_embeddings`.
-- CATATAN: Migrasi 0020 sudah mengeksekusi backfill otomatis secara failsafe di dalam migrasi DDL.
-- Berkas manual ini dipertahankan sebagai artefak idempoten jika ingin dijalankan sebelum migrasi 0020.
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
