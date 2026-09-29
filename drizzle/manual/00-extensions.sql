-- 00-extensions.sql — ekstensi PostgreSQL yang WAJIB ada SEBELUM migrasi.
--
-- ⚠️ DIJALANKAN SEBAGAI SUPERUSER (postgres) — SEKALI per database.
--    `CREATE EXTENSION vector` (pgvector) menuntut hak superuser; role aplikasi
--    (`mathbank`) tidak bisa membuatnya.
--
-- KENAPA file ini ada (temuan review M1, 2026-09-30):
--   Migrasi `drizzle/0000_*.sql` memakai tipe `vector(1024)` & `gin_trgm_ops`,
--   tetapi tidak memuat ekstensinya. Di DB bersih → `CREATE TABLE questions`
--   gagal (`type "vector" does not exist`) → skema tak terbangun.
--
-- Pakai:
--   sudo -u postgres psql -p 5433 -d mathbank -f drizzle/manual/00-extensions.sql
--   # atau: psql -p 5433 -U postgres -d <db> -f drizzle/manual/00-extensions.sql
--
-- Idempotent — aman dijalankan berulang.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- pencarian trigram (GIN)
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector (embedding + HNSW)

-- Verifikasi:
--   SELECT extname, extversion FROM pg_extension ORDER BY extname;
