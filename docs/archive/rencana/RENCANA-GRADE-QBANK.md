# RENCANA — Selaraskan Grade dengan QBank (id "1".."12", bukan "SMA-10")

- **Tanggal:** 2026-10-01
- **Pemicu (arahan pemilik):** "Untuk aturan grade kita samakan dengan di qbank ya, bukan SMA-10 gitu"

## Temuan (terverifikasi)

1. **QBank** (`config/curriculum.yaml`) → grade ber-`id` = nomor kelas `"1"`..`"12"`,
   `label` = "Kelas N SD/SMP/SMA", `level_group` = sd/smp/sma, `curriculum_phase` = Fase A–F.
2. **MathBank DB `grades`** — **SUDAH** sesuai QBank (`id` "1".."12", 19 baris termasuk
   varian 11w/11l/12w). `seed-taxonomy.ts` **membaca YAML QBank** langsung. ✅ master benar.
3. **Data `questions.grade` PROD** = **format lama** `"SMA-10"` (12), `"SMA-11"` (7), `"SMA-12"` (4).
   → **TIDAK cocok** dengan master `grades.id`. **Filter grade saat ini tak menemukan apa pun.**
4. `questions.grade` = `varchar(20)` **tanpa FK** ke `grades` (bebas string).
5. **Kode UI hardcode** format lama di 3 berkas:
   - `question-bank-view.tsx` (GRADES array)
   - `question-editor.tsx` (daftar grade + default "SMA-11")
   - `settings-view.tsx` (default_grade "SMA-11" + daftar)
6. **Tak ada** `/api/grades` maupun hook `useGrades`.

## Keputusan desain (usulan)
- **Sumber tunggal = tabel `grades`** (id QBank). UI menampilkan `label`, mengirim `id`.
- Tambah **`GET /api/grades`** + hook `useGrades()` (read-only; master data).
- **Backfill** `questions.grade`: `SMA-10`→`10`, `SMP-7`→`7`, dst (peta deterministik).
- **Tidak** menambah FK keras dulu (bisa jadi langkah #46-style di ADR terpisah — hindari tambal sulam).

## Langkah
1. `GET /api/grades` (rate-limit daftar, proyeksi kolom eksplisit #34) + `useGrades`.
2. UI: `question-editor` (dropdown dari `useGrades`), `question-bank-view` (grup checkbox per `level_group`),
   `settings-view` (default grade dari `useGrades`).
3. **Migrasi data** (SQL manual di `drizzle/manual/`, lewat `pnpm db:safety`?) — peta `SMA-N`→`N`, `SD-N`→`N`, `SMP-N`→`N`. Non-destruktif (UPDATE).
4. Update seed `scripts/seed-questions.ts` pakai id baru.
5. Tes + dokumen.

## Butuh persetujuan
- [x] **Backfill data prod** (23 baris: 12+7+4) — **SUDAH** (backup diverifikasi lebih dulu).
- [x] Tambah `GET /api/grades` (endpoint baru) — aditif.

## Status — ✅ SELESAI (2026-10-01)
1. ✅ `GET /api/grades` + `listGrades()` + hook `useGrades()`.
2. ✅ UI: `question-editor`, `question-bank-view` (checkbox per grade), `settings-view`
   → semua ambil dari tabel `grades` (label manusiawi, kirim `id`).
3. ✅ Backfill prod: `SMA-10`→`10`, `SMA-11`→`11`, `SMA-12`→`12` (23 baris);
   `app_settings.general.default_grade` `"SMA-11"`→`"11"`.
4. ✅ Seed `scripts/seed-questions.ts` pakai id QBank.
5. ✅ Tes: +2 db `listGrades`; seluruh suite hijau (550 unit, 165 db).
6. ✅ `pnpm check` EXIT 0; `db:verify` 29 tabel utuh.
