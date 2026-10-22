-- MAT-146: hapus tabel anak `question_options`.
--
-- Opsi jawaban kini disimpan di `questions.data_payload.options` (JSONB) dan
-- kuncinya di `questions.answer_key.correctOptionIds` — lihat
-- `src/lib/validations/question-payload.ts` (kontrak MAT-145) dan
-- `enforceQuestionWriteGate` (gerbang tulis MAT-146).
--
-- ⚠️ URUTAN WAJIB: jalankan backfill data lebih dulu, baru migrasi ini.
--   pnpm tsx scripts/migrate-options-to-jsonb.ts          # backfill + verifikasi
--   pnpm tsx scripts/migrate-options-to-jsonb.ts --drop   # backfill + verifikasi + DROP
-- Skrip tersebut menolak men-drop tabel bila verifikasi zero-data-loss gagal.
--
-- Idempotent: `IF EXISTS` supaya aman dijalankan ulang pada DB yang sudah bersih.
--
-- Catatan: drift indeks `idx_questions_status` / `idx_questions_grade_diff_status`
-- → `idx_questions_listing` TIDAK disertakan di sini. Perubahan itu sudah
-- diterapkan manual lebih dulu (drizzle/manual/10-questions-listing-index.sql)
-- dan bukan bagian dari MAT-146.
ALTER TABLE "question_options" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "question_options" CASCADE;
