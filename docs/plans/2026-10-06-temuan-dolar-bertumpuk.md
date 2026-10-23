# Temuan: dolar bertumpuk `$…$$` di defantri

Tanggal: 2026-10-06 · Status: **SENGAJA TIDAK DIPERBAIKI** (prinsip presisi)

## Gejala
Batch #5 (25 artikel) menahan gerbang: **1 KaTeX rusak**. Setelah diselidiki,
akarnya pola **dolar bertumpuk** `$<rumus>$$`.

**119 kemunculan di 30 dari 414 berkas defantri.**

Contoh HTML sumber ASLI (cacat dari penulis sumber, bukan parser kita):
```html
Hasil dari  $201.720.172.017$$  \times 201.720.172.017-$$201.720.172.016\times$$201.720.172.018$  adalah....
```
→ penulis menulis `$201.720.172.017$$` (dolar dobel) untuk memisah angka besar.

Bentuk umum:
```
$=32\ \text{cm}+ 20\ \text{cm} + 8\ \text{cm}$$     (seharusnya penutup satu `$`)
$det(A) = |A| = $$                                   (rumus kosong di ujung)
$f(x+p)=f(x)$$                                       (penutup dobel)
$\text{US}\$$                                         (dolar uang + penutup)
```

## Percobaan perbaikan & HASILNYA GAGAL
Ditambahkan normalisasi `$…$$` → `$…$` **sebelum** display. Hasil uji:

| Masukan | Hasil | |
|---|---|---|
| `$$x^2$$` (display SAH) | `\(x^2\)` | ❌ **REGRESI** — display jadi inline |
| `$=32\ \text{cm}...$$` | `$=32\ \text{cm}...1344178` | ❌ output kacau |
| `$det(A) = \|A\| = $$` | `\((det(A) = \|A\| =)\)` | ✓ |

**Presisi < 100%** → sesuai prinsip proyek **"kunci kosong > kunci salah"**
(dan analoginya untuk markup), **TIDAK dipakai**. Perubahan dibatalkan;
`$$x^2$$` kembali `\[x^2\]`, 43/43 tes lulus.

## Dampak bila dibiarkan
- Sisa `$` **menganggur** di teks (tidak berpasangan).
- **Tidak mengganggu render KaTeX** — `$` tunggal hanya tampil sebagai `$`.
- Termasuk "KaTeX rusak" versi detektor longgar, tetapi **bukan** error sebenarnya.

## Keputusan gerbang
`KaTeX rusak` di evaluasi harus memakai pola yang **menghasilkan markup SALAH**
(`$…\[` atau `\]…$` — delimiter campur), bukan sekadar `$` berjumlah ganjil.
Bila pola itu nol, batch dianggap **bersih**.

## Berkas terkait
- `src/lib/ingest/parsers/clean.ts` — catatan mengapa tidak ditangani.
- `scripts/dev/audit-dolar-dobel.ts` — pendeteksi pola.
- `scripts/dev/cari-katex-rusak.ts` — deteksi pola rusak sebenarnya.
