# Gerbang Mapel Matematika + Perbaikan Opsi (defantri)

**Tanggal**: 2026-10-06
**Status**: ✅ **SELESAI** — gerbang skip mapel + 1 bug opsi diperbaiki; korpus tetap **10.592**.

---

## TL;DR

| Hal | Hasil |
|---|---|
| Gerbang mapel (hanya matematika, dari judul+URL) | 200 masuk / 74 skip |
| Matematika yang salah ter-skip | **0** (diperiksa manual 78 → 74 judul) |
| Bug opsi `\)` nyasar / LaTeX tak seimbang | **diperbaiki** |
| `pnpm test` | **806/806** ✓ |
| `pnpm test:db` | **248/248** ✓ |
| Gerbang PG | **214/214 cocok, selisih 0** ✓ |
| Korpus | 10.592 (tidak turun) ✓ |

---

## 1. Gerbang mapel: hanya matematika yang diproses

**Kebijakan produk**: artikel defantri yang judul/slug-nya **bukan matematika**
→ **DITANDAI SKIP** (status antrean `skipped` + alasan), **bukan dibuang senyap**.

**Lokasi**: `src/lib/ingest/parsers/math-subject.ts` (`isMathArticle`),
dipakai di `segment.ts` → `segmentArticle` (hanya untuk `source === "defantri"`).
Alasan skip tercatat lewat `markDone("skipped", …)` di `service.ts`.

**Dua lapis penanda** (whitelist):
1. Nama mapel: `matematika`, `mtk`, `math`, `kalkulus`, `aljabar`, …
2. Topik matematika: `integral`, `limit`, `matriks`, `turunan`, `statistika`,
   `peluang`, `kuantitatif`, `faktorial`, … — karena banyak artikel berjudul
   topik saja ("Turunan Fungsi Trigonometri …") tanpa kata "matematika".

**Diperiksa dari JUDUL + URL (slug)**, bukan judul saja — temuan nyata:
3 artikel berjudul "Olimpiade **MIPA**" ternyata **matematika**, terlihat dari
slug: `.../pembahasan-science-expo-**matematika**-sma-unggul-del-2018.html` dan
`.../soal-hots-**matematika**-smp.html`. Judul saja akan salah men-skip.

**Hasil**: 200 masuk / 74 skip. 74 judul skip diperiksa manual — **semuanya benar
non-matematika** (OSN IPS/IPA, Kebumian, Astronomi, TKA Pancasila/Sosiologi/
B.Indo/B.Inggris/Fisika/PKK, TPS PBM/PPU/PU, LBI).

**Keputusan produk**: `Pengetahuan Kuantitatif (PK)` **MASUK** (8 artikel) —
soalnya hitungan.

---

## 2. Bug opsi: `\)` nyasar → LaTeX tak seimbang

**Gejala**: opsi jadi `)\) Epidermis atas` (OSNP) dan `\(P \gt Q` tanpa penutup
(UTBK kelas kuantitatif) → **KaTeX rusak**.

**Akar masalah**: pembersihan label opsi di `defantri.ts` membuang `\)` **di
akhir teks** secara membabi-buta (`text.replace(/\s*\\?\)\s*$/, "")`). Padahal
`\)` di akhir itu bisa jadi **penutup math opsi**, bukan sisa label.

Bentuk nyata label setelah `cleanHtml`: `\` `(` `(` `A` `)` `\` `)` — **tujuh
karakter**, dengan `)` dan `\)` **terpisah** (bukan `\)` dobel). Pola lama salah.

**Perbaikan**: buang label secara **presisi**:
`/^\s*\\\(\s*\(?\s*([A-H])\s*\)?\s*\\\)/i` — dan `\)` di akhir hanya dibuang
pada cabang varian label yang benar-benar tanpa penutup.

**Tes**: `REGRESI: opsi '$(A)$ $P \gt Q$' → LaTeX tetap SEIMBANG`

**Hasil**: `latex-rusak` pada 5 artikel uji = **0**.

---

## Verifikasi (5 artikel matematika, 262 soal)

| Artikel | Grup | Soal | latex | kunci |
|---|---:|---:|---|---|
| UTBK Matematika | 59 | 59 | 0 ✓ | 59/59 ✓ |
| Limit Trigonometri | 58 | 58 | 0 ✓ | 57/57 ✓ |
| Statistika Kelompok | 52 | 52 | 0 ✓ | 52/52 ✓ |
| Integral Tentu | 47 | 47 | 0 ✓ | 47/47 ✓ |
| Persamaan Garis | 46 | 46 | 0 ✓ | 46/46 ✓ |
| **TOTAL** | **262** | **262** | **0** ✓ | **261/261** ✓ |

Semua tanpa-stem = 0, tanpa-opsi = 0, opsi-luar-rentang = 0.

---

## Alat ukur & skrip (dev)

- `scripts/dev/check-math-filter.ts` — klasifikasi korpus masuk/skip (tinjau manual).
- `scripts/dev/dry-run-5-articles.ts` — dry-run 5 artikel tanpa DB.
- `src/lib/ingest/parsers/math-subject.test.ts` — 7 tes gerbang mapel.
- `src/lib/ingest/parsers/segment.test.ts` — +4 tes gerbang skip (defantri vs sumber lain).

## Aturan untuk perubahan berikutnya

1. Gerbang mapel **hanya** untuk `source === "defantri"`; sumber lain jangan diganggu.
2. Penilaian mapel pakai **judul + URL** (slug menang saat judul ambigu).
3. Jangan buang `\)` akhir tanpa memastikan itu sisa label.
4. `pnpm test` (806) + `audit-defantri-pg-verify.ts` (214/214) wajib hijau.
