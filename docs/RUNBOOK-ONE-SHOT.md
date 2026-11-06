# Runbook — Skrip Data Satu-Kali (One-Shot)

> Dokumen ini menjawab satu pertanyaan: **"skrip mana yang harus dijalankan manual,
> dalam urutan apa, dan bagaimana tahu sudah berhasil?"**
>
> Dokumen terkait: `docs/MIGRASI-ZERO-DOWNTIME.md` (migrasi rutin),
> `docs/BACKUP-RECOVERY.md` (backup & retensi), `docs/RESTORE-RUNBOOK.md` (insiden).

## 1. Kenapa ada dua direktori SQL

| Direktori | Dijalankan oleh | Isi |
|---|---|---|
| `drizzle/*.sql` | `pnpm db:migrate` (urut nomor, tercatat di `__drizzle_migrations`) | perubahan skema |
| `drizzle/manual/db_safety.sql` | `pnpm db:migrate` (idempoten, selalu) | trigger, CHECK, index yang tak bisa diekspresikan Drizzle |
| `drizzle/one-shot/` | **MANUAL, oleh manusia** | perbaikan data destruktif / massal |

Berkas di `drizzle/one-shot/` **tidak** dijalankan oleh proses apa pun. Itu
disengaja: satu `DELETE` atau `UPDATE` massal yang ikut setiap migrasi rutin akan
terulang di setiap lingkungan tanpa ditinjau.

## 2. Daftar & urutan

Jalankan **berurutan**. Nomor berkas adalah urutan, bukan nama bebas.

| # | Berkas | Yang diubah | Aman diulang? |
|---|---|---|---|
| 20 | `20-denormalize-grades.sql` | hapus grade non-kelas dari `grades`; turunkan `questions.grades`/`grade` dari keanggotaan bundle | ya (idempoten) |
| 21 | `21-normalize-answer-space.sql` | `bundles.print_config.answerSpaceCm` 4 → 3 | ya (idempoten) |

Runner-nya sudah menyediakan dry-run dan penghitung sebelum/sesudah:

```bash
pnpm db:backfill:grades       # 20 — dry-run bawaan
pnpm db:backfill:answer-space # 21 — dry-run bawaan
```

## 3. Prosedur per lingkungan

Wajib untuk **setiap** lingkungan (dev, uji, staging, produksi) yang datanya
dipertahankan. DB yang dibangun ulang dari nol tidak butuh langkah ini — datanya
belum ada.

```bash
# 0. Pastikan menyasar DB yang benar. Skrip membaca DATABASE_URL dari .env.
psql "$DATABASE_URL" -At -c "select current_database(), inet_server_port();"

# 1. Backup. Jangan lewati langkah ini.
pnpm backup:db

# 2. Dry-run: hanya membaca, mencetak hitungan sebelum.
pnpm db:backfill:grades
pnpm db:backfill:answer-space

# 3. Terapkan, satu per satu, dan baca delta yang dicetak.
pnpm db:backfill:grades --apply
pnpm db:backfill:answer-space --apply

# 4. Verifikasi independen (jangan percaya hanya pada skripnya sendiri).
pnpm db:verify
```

### Verifikasi yang diharapkan

```sql
-- 20: hanya 12 kelas yang tersisa, tak ada 'umum'
SELECT count(*) FROM grades;                                  -- 12
SELECT count(*) FROM questions WHERE grade = 'umum';          -- 0

-- 21: seluruh paket memakai 3 cm
SELECT print_config->>'answerSpaceCm' AS cm, count(*)
FROM bundles GROUP BY 1;                                      -- 3 | <semua>
```

## 4. Tanda sudah dijalankan

Catat di tabel ini setelah `--apply` berhasil. Tanpa catatan, satu-satunya cara
tahu adalah menjalankan ulang dry-run dan menebak dari angkanya.

| Lingkungan | 20 | 21 | Tanggal | Catatan |
|---|---|---|---|---|
| dev (`DATABASE_URL`) | ✅ | ✅ | 2026-11-06 | 581 paket, semuanya 3 cm |
| uji (`TEST_DATABASE_URL`) | ✅ | ✅ | 2026-11-06 | 3 paket (data uji); sudah 3 cm karena dibuat dengan default baru |
| staging | — | — | — | belum ada lingkungan terpisah |
| produksi | — | — | — | **wajib dijalankan sebelum rilis berikutnya** |

## 5. Kalau hasilnya tidak sesuai

- **Delta nol padahal seharusnya berubah** — cek `current_database()` di langkah 0;
  biasanya `DATABASE_URL` menunjuk DB lain.
- **Skrip berhenti di tengah** — keduanya berjalan dalam satu transaksi
  (`sql.begin`), jadi tidak ada keadaan separuh jadi. Perbaiki penyebabnya, ulangi.
- **Angka verifikasi berbeda dari harapan** — jangan jalankan ulang `--apply`;
  periksa dulu apakah ada proses lain yang menulis ke tabel yang sama.

## 6. Menambah skrip baru

1. Beri nomor lanjut di `drizzle/one-shot/` dan tulis SQL-nya **idempoten**
   (pakai predikat `WHERE` yang menyaring baris yang sudah benar).
2. Tambahkan runner di `scripts/` dengan pola yang sama: `--apply` opsional,
   cetak hitungan sebelum/sesudah, bungkus dalam transaksi.
3. Daftarkan di tabel §2 dan §4 dokumen ini.
4. Jangan menaruhnya di `drizzle/manual/`.
