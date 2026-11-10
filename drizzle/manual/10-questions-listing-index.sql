-- ============================================================================
-- ACT-06 (MAT-123) — Rasionalisasi indeks status `questions`
-- ============================================================================
-- LATAR: filter status adalah filter UTAMA daftar soal (UI), tetapi bentuk
-- indeks lama tidak melayani bentuk query-nya:
--
--   WHERE deleted_at IS NULL AND status = $1
--   ORDER BY created_at DESC
--   LIMIT 20 OFFSET $2
--
--   * `idx_questions_status`      → btree (status) saja: PostgreSQL masih harus
--                                   SORT seluruh partisi status sebelum LIMIT.
--   * `idx_questions_grade_diff_status` → btree (grade, difficulty, status):
--                                   tak terpakai untuk filter status saja
--                                   (status bukan kolom depan); 11 scan seumur
--                                   hidup statistik di DB dev.
--
-- Terukur di `mathbank_test` (100.000 baris, 5 putaran × 200 soal):
--   halaman daftar status `ready`  : 512,996 ms → 0,219 ms  (Sort → Index Scan)
--   halaman daftar status `draft`  :  37,498 ms → 0,096 ms
--   aksi massal 200 soal (p50)     : 229 ms     → 93 ms
--
-- Indeks pengganti adalah **covering prefix** untuk bentuk query di atas:
-- (status, created_at DESC) dengan predikat parsial deleted_at IS NULL.
-- Predikat parsial membuat indeks hanya memuat baris hidup — lebih kecil dan
-- tak perlu memeriksa ulang `deleted_at` saat scan.
--
-- ⚠️ TRADE-OFF YANG DITERIMA SECARA SADAR: `status` tetap ada di sebuah indeks,
-- sehingga UPDATE `questions.status` TIDAK bisa HOT (Heap-Only Tuple). Varian
-- "HOT" (status dilepas dari SEMUA indeks) terukur menaikkan HOT 0% → 55,9%
-- dan mempercepat pernyataan UPDATE 52 ms → 14 ms, TETAPI membuat halaman
-- daftar jatuh ke Seq Scan: 30–142 ms (vs 0,05–0,55 ms). Daftar soal adalah
-- jalur baca setiap pengguna; aksi massal adalah operasi admin yang jarang.
-- Karena itu jalur baca yang dimenangkan. Rincian angka: docs/sprint0/
-- SALMAN-PROGRESS.md § ACT-06.
--
-- ⚠️ `fillfactor` SENGAJA TIDAK DIUBAH. Diuji 85 vs 100: fillfactor 85
-- menaikkan HOT untuk kolom tak-terindeks (0% → 64,5%) tetapi total aksi
-- massal justru lebih lambat (p50 61 ms vs 71 ms pada 20k; 93 ms vs 71 ms
-- sebanding) karena baris tersebar ke 15% halaman lebih banyak. Ditolak
-- berdasarkan data, bukan preferensi.
--
-- Idempotent: aman dijalankan berulang (DROP IF EXISTS / CREATE IF NOT EXISTS).
-- Dijalankan otomatis oleh `pnpm db:safety` (setelah drizzle-kit migrate).
-- ============================================================================

DROP INDEX IF EXISTS idx_questions_status;
DROP INDEX IF EXISTS idx_questions_grade_diff_status;

CREATE INDEX IF NOT EXISTS idx_questions_listing
  ON questions (status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ADR-0025: Default view daftar soal menyaring status <> 'archived'
CREATE INDEX IF NOT EXISTS idx_questions_active_listing
  ON questions (created_at DESC)
  WHERE deleted_at IS NULL AND status <> 'archived';

-- Statistik baru agar planner langsung memakai indeks di atas.
ANALYZE questions;

-- ============================================================================
-- RENCANA ROLLBACK (jalankan manual bila perlu kembali ke bentuk lama)
-- ============================================================================
--   BEGIN;
--     DROP INDEX IF EXISTS idx_questions_listing;
--     CREATE INDEX idx_questions_status ON questions (status);
--     CREATE INDEX idx_questions_grade_diff_status
--       ON questions (grade, difficulty, status);
--     ANALYZE questions;
--   COMMIT;
--
-- Rollback TIDAK menghilangkan data: ketiga perintah hanya menyentuh indeks.
-- Perkiraan biaya: pembangunan ulang dua btree pada 12 ribu baris < 1 detik;
-- pada 1 juta baris perkirakan 10–60 detik (pakai CREATE INDEX CONCURRENTLY
-- bila tabel harus tetap melayani tulis selama rollback).
-- ============================================================================
