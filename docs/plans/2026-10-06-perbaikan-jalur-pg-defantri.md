# Perbaikan Jalur Pilihan Ganda (PG) defantri

**Tanggal**: 2026-10-06
**Status**: ✅ **SELESAI** — 2 bug PG diperbaiki; korpus naik **10.365 → 10.592** (+227).
**Konteks**: Sesi lanjutan setelah percobaan benar-salah dibatalkan. Fokus: **hanya jalur PG `qN`**.

---

## TL;DR

| Metrik | Sebelum | Sesudah |
|---|---:|---:|
| Artikel murni PG cocok | 205 / 214 | **214 / 214** ✅ |
| Grup PG vs item adapter | 7.267 / 7.493 (−226) | **7.493 / 7.493 (0)** ✅ |
| Total soal korpus | 10.365 | **10.592** (+227) |
| Artikel tanpa soal | 4 | **0** ✅ |

---

## Baseline PG (terukur, 274 artikel beradio)

| Kategori grup | Jumlah |
|---|---:|
| **PG `qN`** (fokus) | **7.493** |
| Benar-salah (`qN` 2-opsi Benar/Salah) | 1.890 |
| Radio generik (`name="radio"`) | 6 |
| **TOTAL** | ~10.592 |

Artikel: **120 murni PG**, 154 campuran.

> Catatan alat ukur: "harapan" = **jumlah NAMA GRUP unik `qN`**, bukan nomor
> urut — sumber kadang menomori ganda/lompat (mis. `q41, q42, q21, q44…`).
> Deteksi benar-salah harus dari **teks opsi itu sendiri** (tepat Benar/Salah),
> bukan kata kunci di 200 char setelah radio — kalimat soal "…pernyataan yang
> salah…" mudah jadi false positive.

---

## Bug #1 — `<!--more-->` mengalahkan pembuka soal

**Gejala**: 5 artikel kehilangan soal (UTBK −4, OSK −3, dst.).

**Akar masalah**: `extractQuestionGroup` memilih pembuka soal dengan
`Math.max(...starts)`. Blogger menyisipkan `<!--more-->` **di antara stem dan**
`<div class="question">`, sehingga penanda itu "menang" atas `<h4>`/`<blockquote>`
→ `start` jatuh setelah stem → **stem kosong → soal dibuang**.

```
<h4>1. Soal</h4><blockquote>Berapa $1+1$?
  <!--more-->              ← menang via Math.max → stem terpotong
  <div class="question">…radio…</div></blockquote>
```

**Perbaikan**: `<!--more-->` **dikeluarkan** dari kandidat pembuka.

**Tes**: `REGRESI: '<!--more-->' TIDAK boleh mengalahkan pembuka soal`
**Dampak**: 9 → 4 artikel bermasalah; +10 soal.

---

## Bug #2 — Stem "pembuka bersama" di luar blok radio

**Gejala**: **4 artikel OSNP** hampir seluruhnya hilang — 75→3, 60→0, 50→0, 34→0.

**Akar masalah**: deskripsi soal ada di `<p>` **SEBELUM `<h4>`**, sedangkan radio
di dalam `<blockquote>` terpisah:

```
<p>Berdasarkan jaring-jaring makanan tersebut, terdapat $(1)$ rantai makanan…</p>
</div><br>
<h4>1. Soal OSN-P IPA SD/MI 2025</h4>
<blockquote><div class="question">…radio q1…</div></blockquote>
```

Membaca blok radio saja → stem kosong → soal dibuang.

**Perbaikan**: `sharedStemBefore()` — bila stem blok kosong, ambil teks paragraf
terdekat sebelum `<h4>` (dibatasi `<blockquote>` terakhir, minimal 15 char).

**Tes**: `REGRESI: stem 'pembuka bersama' SEBELUM <h4> tetap terambil`
**Dampak**: 4 → 0 artikel bermasalah; +217 soal.

---

## Verifikasi (gerbang)

| Gate | Hasil |
|---|---|
| `audit-defantri-pg-verify.ts` | **214/214 cocok, selisih 0** ✅ |
| `audit-defantri-corpus.ts` | 10.592 soal (naik, bukan turun) ✅ |
| Artikel tanpa soal | 0 ✅ |
| `pnpm test` (unit) | ✅ |
| `pnpm typecheck` | ✅ |

---

## Alat ukur baru (dev)

- `scripts/dev/audit-defantri-pg-baseline.ts` — baseline per-kelompok artikel.
- `scripts/dev/audit-defantri-pg-verify.ts` — **gerbang PG**: harapan vs item adapter.
- `scripts/dev/debug-pg-anomaly.ts` — item PG tanpa kunci/opsi.
- `scripts/dev/debug-missing-groups.ts` — grup yang hilang (stem kosong).
- `scripts/dev/db-clear-ingest.ts` — bersihkan data ingest (dry-run default).
- `scripts/dev/db-inventory.ts`, `db-fk.ts` — inventaris & FK.

## Aturan untuk perubahan berikutnya

1. **Gerbang wajib**: `audit-defantri-pg-verify.ts` harus tetap **214/214**.
2. `audit-defantri-corpus.ts`: total **tidak boleh turun**, `Tak ada soal` = 0.
3. Jalur PG **jangan** menyentuh grup benar-salah/generik (belum didukung).
4. Sumber menomori ganda — selalu ukur lewat **nama grup**, bukan nomor urut.
