-- ============================================================================
-- PROVISIONING PRODUKSI — MathBank (jalankan sebagai ADMIN DB, sekali)
-- ============================================================================
-- Tujuan: menerapkan Least Privilege (Area 1). Role APLIKASI produksi TIDAK
-- boleh superuser. Ekstensi dibuat admin sekali; app role hanya CRUD data.
--
-- CARA PAKAI (produksi):
--   psql "$ADMIN_DATABASE_URL" -v app_role=mathbank_app -v app_db=mathbank \
--        -f drizzle/manual/provision-prod.sql
--
-- GANTI PASSWORD app role lewat variabel/secret manager, JANGAN di file ini.
-- ============================================================================

\set ON_ERROR_STOP on

-- 1. Ekstensi privilese tinggi — HANYA admin yang boleh (butuh superuser).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Buat role aplikasi (LOGIN, BUKAN superuser, BUKAN createdb/createrole).
--    Password: set manual setelah ini, mis:
--      ALTER ROLE :app_role WITH PASSWORD '<dari-secret-manager>';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_setting('mathbank.app_role', true)) THEN
    RAISE NOTICE 'Role aplikasi belum ada — buat manual dengan password dari secret manager.';
  END IF;
END $$;

-- 3. Pencabutan: pastikan role aplikasi BUKAN superuser.
ALTER ROLE :"app_role" NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;

-- 4. Cabut akses default yang terlalu luas.
REVOKE ALL ON SCHEMA public FROM :"app_role";
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"app_role";

-- 5. Beri hak minimum: pakai schema + CRUD tabel + USAGE sequence.
GRANT USAGE ON SCHEMA public TO :"app_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_role";

-- 6. Audit log = APPEND-ONLY: cabut UPDATE/DELETE (sejalan trigger immutability P3).
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM :"app_role";
GRANT INSERT, SELECT ON audit_logs TO :"app_role";

-- 7. Default privilege untuk tabel/sequence MASA DEPAN (migrasi berikutnya).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";

-- 8. Tabel rate_limit (Better Auth) — app perlu CRUD penuh (counter naik/turun).
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit TO :"app_role";

-- Selesai. Verifikasi:
--   SELECT rolname, rolsuper FROM pg_roles WHERE rolname = :'app_role';  -- harus f
