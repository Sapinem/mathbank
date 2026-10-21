-- MAT-131A / MAT-134 — Tahap A: SOFT DEPRECATION kolom `slug` (topics & tags)
--
-- Rasional (ADR-0019, docs/audit/ARAHAN-SLUG-REMOVAL-2TAHAP.md):
-- identitas kanonik seluruh entitas MathBank adalah UUIDv7 (`uuidPk()`);
-- routing & relasi 100% berbasis id. Kolom `slug` adalah artefak legacy.
--
-- Tahap A = hentikan KETERGANTUNGAN kode pada `slug` tanpa breaking change:
--   * kolom TETAP ADA dan data historis TETAP UTUH (nullable, bukan di-drop),
--   * unique index `uq_topics_slug` / `uq_tags_slug` TETAP ADA — pada PostgreSQL
--     unique index mengizinkan BANYAK NULL, sehingga baris baru tanpa slug aman
--     dan keunikan data legacy tetap terjaga.
--   * `DROP NOT NULL` bersifat idempoten: aman dijalankan ulang (tidak error
--     bila kolom sudah nullable), sesuai pola migrasi defensif Release It! §4.
--
-- Tahap B (nanti, setelah stabil): DROP INDEX + DROP COLUMN.

ALTER TABLE "topics" ALTER COLUMN "slug" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "slug" DROP NOT NULL;
