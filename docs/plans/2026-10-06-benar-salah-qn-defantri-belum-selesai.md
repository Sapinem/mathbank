# Temuan: Soal Benar–Salah `qN` defantri (Prioritas 1) — BELUM SELESAI

**Tanggal**: 2026-10-06
**Status**: ❌ **DIBATALKAN** (regresi korpus) — perubahan adapter dikembalikan ke HEAD.

> **UPDATE (sesi lanjutan, fokus PG)**: percobaan benar-salah dibatalkan, tetapi
> investigasinya **mengungkap 2 bug PG yang nyata** — sudah **DIPERBAIKI** dan
> terverifikasi. Lihat `docs/plans/2026-10-06-perbaikan-jalur-pg-defantri.md`.
> Korpus kini **10.592** soal (naik dari 10.365).

**Pemicu**: Permintaan user mengerjakan prioritas 1 (70 artikel benar-salah `qN` → `matrix_grid`).

---

## TL;DR

Percobaan implementasi benar-salah `qN` **menyebabkan regresi korpus**:
`10.365 → 9.191` soal (−1.174). Sesuai **gerbang korpus** (`audit-defantri-corpus.ts`),
perubahan **dibatalkan** dan `defantri.ts` dikembalikan ke HEAD (stabil).

Korpus kembali: **10.365 soal / 13 ber-opsi>6 / 227 skip** ✓

---

## Apa yang ditemukan

### 1. Klasifikasi per-grup (terukur atas 274 artikel beradio)

| Kelompok konten | Jumlah | Keterangan |
|---|---:|---|
| pilihan-ganda saja | **210** | jalur `qN` A–E — sudah benar |
| **benar-salah + pilihan-ganda** | **56** | ⚠️ butuh penanganan |
| generik + pilihan-ganda | 5 | `name="radio"` per `<blockquote>` |
| benar-salah + generik + pilihan-ganda | 2 | gabungan |
| benar-salah + pilihan-ganda + `qX` | 1 | gabungan |

**Hanya 64 artikel "kotor"** dari 274. Artikel bisa **campuran**, jadi klasifikasi
harus **per-grup radio**, bukan per-artikel.

### 2. Bentuk benar-salah yang benar-benar ada

```
<h4>1. …</h4>
<blockquote>
  Berdasarkan infografis, tentukan apakah setiap pernyataan berikut Benar atau Salah.
  <ul>
    <li>Negara terdingin adalah Norwegia.
      <div class="question">
        <input type="radio" name="q101" value="corect"> Benar
        <input type="radio" name="q101" value="corect"> Salah
      </div></li>
    …                          ← satu <li> = satu pernyataan
  </ul>
</blockquote>
```

- Satu soal benar-salah = **satu `<ul>`** berisi beberapa `<li>`.
- Tiap pernyataan = **satu grup `qN`** ber-2 opsi (Benar/Salah, kadang True/False).
- Kunci = `value="correct"` (ingat: `corect` = pengecoh).
- Artikel **TKA/OSNP** memakai `True`/`False` (bahasa Inggris) — 82 grup, dll.

### 3. **Kenapa gagal (regresi)**

Percobaan menggabungkan grup benar-salah jadi `matrix_grid` menabrak **2 masalah**:

1. **Stem di luar `<blockquote>`** (mis. OSNP IPA SD). Grup q1 ternyata:
   ```
   <blockquote> <div class="question">
     <input name="q1" value="corect">$(A)$ $2$…
   ```
   → stem kosong → 72 grup ter-skip. **HEAD pun begitu** (bukan regresi, tapi cacat lama).
2. **`<ul>` antar-soal bercampur** (mis. TKA Bahasa Inggris). Grouping per-`<ul>`
   salah → **64 pernyataan** dari soal berbeda menempel jadi **1 `matrix_grid`**
   dengan stem salah ("Which option best summarizes the story?…").

Hasil: 82 soal → 19; 95 → 44; dst. **Total −1.174.**

---

## Keputusan

- ❌ **Batalkan** perbaikan benar-salah. Kembalikan `defantri.ts` + `adapters.test.ts` **ke HEAD**.
- ✅ Korpus kembali baseline **10.365** (terverifikasi).
- Gate akhir: `pnpm typecheck` bersih, `pnpm test` **793/793** ✓.

**Pelajaran**: benar-salah `qN` **bukan** kasus tambalan kecil. Sumbernya tidak
seragam (stem di luar blok, `<ul>` bercampur, True/False). Perlu:
1. Ekstraksi stem yang **tahan** blok terpisah (stem bisa di `<h4>`, sebelum
   `<blockquote>`, atau di dalamnya).
2. Penentuan batas soal benar-salah yang **andal** (bukan `ulIndex` mentah) —
   mungkin lewat pasangan `<h4>`/`<blockquote>` pembuka.
3. Uji **per-kelompok artikel** (4 kelompok di atas), bukan 1–5 artikel.

---

## Utang teknis (untuk dikerjakan bertahap)

- [ ] Tulis helper **stem resolver** yang menangani stem di luar `<blockquote>`
      (dampak: artikel OSNP — 3 dari 75 soal sekarang).
- [ ] Rombak penentuan batas soal benar-salah; tambah uji korpus per-kelompok.
- [ ] Setelah itu, baru aktifkan `matrix_grid` untuk benar-salah.

**Jangan kerjakan tanpa gerbang korpus + uji per-kelompok.**
