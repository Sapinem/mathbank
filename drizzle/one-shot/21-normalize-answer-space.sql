-- 21-normalize-answer-space.sql
-- Idempotent: seragamkan ruang coretan naskah cetak ke 3 cm.
--
-- Konteks: default `answerSpaceCm` di kode dan default kolom DB sudah 3 cm,
-- tetapi 579 baris lama masih menyimpan 4 cm dari default sebelumnya.
-- Akibatnya paket lama dan baru mencetak tinggi ruang jawaban berbeda.
--
-- Predikat memakai perbandingan TEKS (`->> = '4'`) supaya tidak pernah
-- melempar galat cast bila ada baris dengan nilai non-numerik.

UPDATE bundles
SET print_config = jsonb_set(print_config, '{answerSpaceCm}', '3'::jsonb, true)
WHERE print_config->>'answerSpaceCm' = '4';
