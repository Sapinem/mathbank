-- MB_MEDIA_SHORT_ID: kolom `short_id` untuk `media_assets` (G4 Stadium Media)
--
-- ⚠️ FILE INI BUKAN MIGRASI drizzle-kit. Diletakkan di `drizzle/manual/` agar
--    `drizzle-kit migrate` tidak menyentuhnya (butuh snapshot per migrasi).
--    Diterapkan oleh `scripts/db-apply-safety.ts` via `pnpm db:safety`
--    (di-chain otomatis dari `pnpm db:migrate`).
--
-- MENGAPA manual (constraint #26):
--   Kolom `short_id` wajib NOT NULL + UNIQUE, tetapi harus di-BACKFILL dulu
--   untuk baris yang sudah ada. drizzle-kit tidak bisa mengekspresikan
--   backfill-nilai-acak-per-baris, jadi migrasi ini ditulis tangan.
--
-- Bentuk: 8 karakter base62 (0-9A-Za-z) = 218.340.105.584.896 kemungkinan.
-- Keunikan ditegakkan `uq_media_short_id`; generator aplikasi
-- (`src/lib/media/short-id.ts`) menyediakan kandidat.
--
-- IDEMPOTENT: aman dijalankan berulang.

-- ============================================================================
-- 1. Kolom short_id (nullable dulu — backfill butuh itu)
-- ============================================================================
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS short_id varchar(8);

-- ============================================================================
-- 2. Backfill baris lama, PER BARIS (hindari nilai sama untuk semua baris)
-- ============================================================================
-- Catatan: subquery `random()` di satu UPDATE akan dievaluasi SEKALI oleh
-- PostgreSQL → semua baris dapat nilai identik. Karena itu dipakai loop.
DO $$
DECLARE
  r RECORD;
  candidate text;
  attempt int;
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
BEGIN
  FOR r IN SELECT id FROM media_assets WHERE short_id IS NULL ORDER BY created_at LOOP
    attempt := 0;
    LOOP
      attempt := attempt + 1;
      candidate := '';
      FOR i IN 1..8 LOOP
        candidate := candidate || substr(alphabet, (random() * 61)::int + 1, 1);
      END LOOP;

      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM media_assets WHERE short_id = candidate AND id <> r.id
      );

      IF attempt > 50 THEN
        RAISE EXCEPTION 'Gagal membuat short_id unik setelah 50 percobaan untuk %', r.id;
      END IF;
    END LOOP;

    UPDATE media_assets SET short_id = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- ============================================================================
-- 3. NOT NULL + UNIQUE + CHECK bentuk
-- ============================================================================
ALTER TABLE media_assets ALTER COLUMN short_id SET NOT NULL;

-- UNIQUE: idempotent (drop bila ada, lalu buat)
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS uq_media_short_id;
ALTER TABLE media_assets
  ADD CONSTRAINT uq_media_short_id UNIQUE (short_id);

-- CHECK bentuk: cerminan isValidShortId() di aplikasi
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS chk_media_assets_short_id;
ALTER TABLE media_assets
  ADD CONSTRAINT chk_media_assets_short_id CHECK (short_id ~ '^[0-9A-Za-z]{8}$');
