# Temuan: Soal Tanpa Pembahasan + Bug Pembahasan Benar-Salah

Tanggal: 2026-10-06 · Status: **selesai**

## 1. Bug NYATA — pembahasan soal benar-salah tidak terambil

### Gejala
Soal benar-salah (`matrix_grid`) di artikel TKA **tidak punya pembahasan**,
padahal sumbernya jelas punya (`<details class='sp'><summary>Alternatif
Pembahasan:</summary>…`).

### Akar masalah
`extractQuestionGroup()` (di `defantri.ts`) menentukan akhir blok soal dari
**radio berikutnya**. Untuk benar-salah, beberapa grup radio (`q201`, `q202`, …)
berada dalam **satu `<ul>`**, dan `<details>` pembahasan ada **SETELAH `</ul>`**.
Akibatnya blok soal berakhir di `q202` → `<details>` tidak ikut terbaca.

```
<ul>                                  ← satu soal (benar-salah)
  <li>pernyataan 1 … radio q201</li>
  <li>pernyataan 2 … radio q202</li>
</ul>
<details class='sp'>Alternatif Pembahasan: …</details>   ← DI LUAR potongan blok
```

### Perbaikan
- `defantri-tf.ts`: `explanationAfterBlock()` — ambil `<details>` pertama setelah
  blok soal, **berhenti di blok soal berikutnya** (tidak menyerobot milik soal lain).
  Field `explanation` ditambahkan pada `TrueFalseQuestion` dan diteruskan ke
  `buildTrueFalseItem()`.
- `defantri.ts`: `explanationBlockFor()` sebagai fallback umum (blok diperluas),
  agar jalur PG/BS sama-sama aman.

### Hasil
| Metrik | Sebelum | Sesudah |
|---|---:|---:|
| `matrix_grid` berpembahasan | **0** | **95** |
| Soal berpembahasan (total) | 2.442 | **2.539** |
| Soal tanpa pembahasan | 760 (23,7%) | **663 (20,7%)** |

Diverifikasi: **96** `matrix_grid` berpembahasan di korpus (agregat), 95 di DB
(satu soal ter-dedup lintas-paket). 21 artikel di-re-ingest.

### Yang TIDAK diambil (sengaja)
`<details>` berisi **kisi-kisi materi** ("Bilangan Rasional — Memahami,
mengaplikasikan, dan bernalar…") — **bukan** pembahasan. Contoh: TKA SD 2026
(4 `<details>` semuanya kisi-kisi) → benar tidak diambil.

## 2. Soal tanpa pembahasan — audit menyeluruh

`scripts/dev/audit-tanpa-pembahasan.ts`:
- **663 soal (20,7%)** tanpa pembahasan dari 3.202.
- Per tipe: `single_choice` 494 · `matrix_grid` 167 · essay 1 ·
  stimulus 1 (stimulus induk memang tak butuh).
- **21 artikel SEMUA soalnya tanpa pembahasan**, 23 artikel sebagian.

Penyebab terbanyak: **sumber defantri memang tidak menyediakan pembahasan**
(9 dari 11 artikel PAS/SAS tidak punya `<details>` pembahasan sama sekali —
halaman berakhir langsung setelah soal terakhir).

## 3. PELAJARAN OPERASIONAL — kapan `pnpm build` perlu

| Perubahan | Build + restart? |
|---|---|
| **Kode** (`src/lib/ingest/**`, komponen UI, dll) | ✅ **WAJIB** |
| **Ingest data** saja (kirim artikel ke API) | ❌ tidak perlu |

Server menjalankan hasil `pnpm build`; kalau kode diubah tanpa build+restart,
ingest akan memakai **kode lama**. (Pernah tertipu: hasil `created=46` padahal
harusnya 47 — ternyata service belum restart.)

Jadi: rebuild **bukan** konsekuensi ingest, melainkan konsekuensi **mengubah
kode**. Mengirim artikel ke API cukup — tak perlu build.

## Berkas
- `src/lib/ingest/parsers/adapters/defantri-tf.ts` — `explanationAfterBlock`
- `src/lib/ingest/parsers/adapters/defantri.ts` — `explanationBlockFor`
- `scripts/dev/audit-tanpa-pembahasan.ts` — audit
- `scripts/dev/reingest.ts` — diperbaiki: hapus paket menghormati FK
  (`bundle_items` RESTRICT) & dedup lintas-paket
