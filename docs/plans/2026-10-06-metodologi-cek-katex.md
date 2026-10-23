# Metodologi cek KaTeX — YANG SALAH vs YANG BENAR

Tanggal: 2026-10-06 · Status: **temuan kritis, perbaikan menyusul**

## Pertanyaan pemilik
> "Metodemu ngecek katex aman gimana?"

Pertanyaan ini **membongkar kelemahan besar** metodologi saya.

## ❌ Metode yang saya pakai (SALAH / LEMAH)
1. **Regex pola tebakan**: cari `$…\[`, `\]…$`, `\(…\(`, `$` ganjil.
2. Hitung di DB dengan pola yang sama.

**Kelemahan fatal:** hanya menangkap **bentuk yang saya tebak**. Bentuk rusak lain
→ **LOLOS**. Terbukti: soal `01a1149d` (Limit Fungsi Aljabar) rusak karena
`\end{align}\(\). \therefore$` — **tak cocok** pola mana pun → gerbang bilang "0 rusak".

## ✅ Metode yang BENAR (sudah ada di proyek)
`src/lib/math/katex-lint.ts` → **`lintKatex(markdown)`**:
- Mengekstrak tiap potongan rumus (`tokenizeMath`).
- **Merender ke KaTeX sungguhan** dengan `throwOnError: true`.
- Mengembalikan **daftar galat sintaks**.

Ini menangkap **SEMUA** jenis galat — bukan tebakan.

## 💥 Hasil perbandingan (DB batch terakhir)

| | Regex (salah) | **KaTeX lint (benar)** |
|---|---:|---:|
| Soal | 1.032 | 1.032 |
| Stem error | 0 | **12** |
| **Solusi error** | 0 | **818** |
| Opsi error | 0 | **80** |

## 🔍 Penyebab terbanyak

| Jumlah | Pesan KaTeX | Arti |
|---:|---|---|
| **1.098** | `{align} can be used only in display mode` | `\begin{align}` diubah jadi **inline** `\(...\)`; harus display `\[...\]` |
| 47 | `\mskip with no arguments as superscript` | rumus rusak |
| 12 | `Expected & or \\ or \cr or \end` | `\begin{pmatrix}` rusak |
| 7 | `Can't use function '\]' in math mode` | delimiter campur |

**Akar utama:** parser mengubah `$…\begin{align}…\end{align}…$` menjadi
**inline** `\(…\)`, padahal `align`/`split` **wajib display mode**.

## Rencana perbaikan
1. **Gerbang WAJIB pakai `lintKatex()`**, bukan regex. Regex boleh tetap sebagai
   deteksi cepat, tetapi keputusan lolos/tidak berdasarkan KaTeX sungguhan.
2. **Perbaiki parser**: `$…\begin{align|align*|split…}…$` → `\[…\]` (display),
   bukan `\(…\)`.
3. Ukur ulang sampai **error = 0**, baru lanjut batch.

## Pelajaran
- **Jangan verdict "aman" dari pola yang ditebak.** Pakai validator sebenarnya.
- Proyek ini sudah punya `katex-lint` — seharusnya dipakai sejak awal; saya
  melewatkannya dan itu menyebabkan beberapa batch lolos dengan data rusak.
