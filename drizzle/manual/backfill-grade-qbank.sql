-- Backfill grade: format lama ("SMA-10", "SMP-7", "SD-4") → id QBank ("10","7","4").
-- Konteks: tabel `grades` (master, seed curriculum.yaml QBank) memakai id "1".."12",
-- "11w","11l","12w","12l","utbk","mandiri","umum". Data soal lama tak cocok.
-- Idempotent: aman dijalankan berulang (hanya menyentuh pola lama).
-- Lihat: docs/RENCANA-GRADE-QBANK.md

UPDATE questions
SET grade = regexp_replace(grade, '^(SD|SMP|SMA)-', ''),
    updated_at = now()
WHERE grade ~ '^(SD|SMP|SMA)-[0-9]+$';
