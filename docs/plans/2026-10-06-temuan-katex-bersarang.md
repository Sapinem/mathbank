# Temuan: KaTeX bersarang (`$…\(…\)…$`) — 0,09% sisa

Tanggal: 2026-10-06 · Status: **sebagian diperbaiki, sisa dibiarkan (presisi)**

## Yang dilaporkan pemilik
> "Ini kok lolos katex eror? https://b. iyo.my.id/questions/01a11484-5493…"

Benar — soal itu punya KaTeX error nyata di UI, dan detektor gerbang saya
**tidak menangkapnya.** Terima kasih atas laporannya.

## Diagnosis
Pola rusaknya: **delimiter bersarang** `\(…\)` **di dalam** `$…$`:
```
$T=\begin{pmatrix} a \\ -b \end{pmatrix}\(sehingga setelah pergesaran diperoleh\)x'=x+a$
```
KaTeX menolak `\(` di dalam math-mode → **error render**.

Detektor lama hanya mencari `$…\[` / `\]…$` (delimiter campur) dan `$` ganjil,
sehingga pola ini **lolos**.

## Akar masalah (2 lapis)

### 1. Inline regex melarang newline → "meminjam" `$` jauh  ← **DIPERBAIKI**
Sumber asli **BENAR**:
```html
sejauh $T=\begin{pmatrix}<br />a \\ -b<br />\end{pmatrix}$ sehingga … $x'=x+a$
```
Tapi `normalizeMath` memakai `[^$\n]` (tanpa newline), sedangkan rumus
`\begin{pmatrix}` **multi-baris**. Akibatnya penutup dekat **tak terlihat**,
regex meminjam `$` jauh → menelan teks antar-rumus.

**Perbaikan:** `[^$]{1,400}?` (boleh `\n`, tetap tak menyeberangi `$`),
plus penjaga: body yang sudah memuat `\(`/`\)` **tidak dibungkus lagi**.

**Efek:** kasus pemilik **BERES** (`\(…\) sehingga … \(…\)`).

### 2. Kata menempel pada `$` (`dan$[ABCD]$`)  ← **DIBATALKAN (presisi)**
Sumber kadang menulis `dan$[ABCD]$` tanpa spasi. Pembuka `$` didahului huruf
→ pola `(?<![\w$\\])` gagal → `$` menganggur → meminjam `$` jauh.

**Dicoba:** izinkan pembuka didahului huruf (`[A-Za-z]{2,}\$…\$`).
**Hasil: GAGAL — memicu 484 kasus baru** (`Limas $T.ABCD$ \(…\) ABCD$` ikut
tertangkap). Presisi < 100% → **sesuai prinsip proyek, TIDAK dipakai.**

## Skala sebenarnya (via PARSER, bukan normalizeMath atas HTML)

| Ukuran | Nilai |
|---|---|
| Item diperiksa | **9.548** (semua artikel) |
| — artikel IPS (ditolak gerbang mapel) | 9 item |
| **Artikel matematika (masuk DB)** | **5 item / 5.862 = 0,09%** |

⚠️ **Penting:** audit awal saya memakai `normalizeMath(html)` **langsung atas
HTML mentah** → **28 "temuan" palsu**. Yang benar: jalankan **adapter** dulu
(lihat `scripts/dev/audit-nested-real.ts`).

## Keputusan
- Perbaikan #1 **dipakai** (kasus pemilik beres, 43/43 tes lulus).
- Perbaikan #2 **dibatalkan** (presisi < 100%).
- Sisa **5 item (0,09%)** dibiarkan + **dilaporkan**, bukan ditebak.
- Gerbang batch memakai `katexRusak` dengan pola **delimiter campur** — bukan
  `$` ganjil (agar 119 `$` menganggur dari `$$` bertumpuk tidak menahan batch).

## Berkas terkait
- `src/lib/ingest/parsers/clean.ts` — perbaikan #1 + catatan #2.
- `scripts/dev/audit-nested-real.ts` — deteksi **via parser** (yang benar).
- `scripts/dev/uji-pembuka.ts` — ukur dampak perubahan pembuka.
- `docs/plans/2026-10-06-temuan-dolar-bertumpuk.md` — pola `$$` terkait.
