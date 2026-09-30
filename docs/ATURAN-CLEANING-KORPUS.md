# ATURAN CLEANING KORPUS — M9 (Aturan General)

> **Status:** 📋 usulan aturan (menunggu persetujuan) · **Milestone:** M9 · **Tanggal:** 2026-09-30
> **Sifat:** fondasi **aturan general** — dipakai **semua** sumber (mathcyber/m4thlab/defantri/pusmendik)
> sebelum adapter per-sumber. Berbasis **pemeriksaan 390 file nyata** (bukan dugaan).

---

## 1. Prinsip

> **Bersihkan & normalkan DULU (aturan general) → baru segmen & bedah (adapter).**

Urutan ini penting: cleaning yang salah urutan bisa **merusak LaTeX** (lihat §4, jebakan #1).
Aturan general **tak tahu** soal/sumber — ia hanya mengubah **kotoran struktur** menjadi
teks yang bersih & konsisten.

---

## 2. Bukti Lapangan (390 file diperiksa)

| Kotoran | Muncul di | Frekuensi |
|---|---|---|
| `<script>` | semua | 266/390 |
| atribut `style=` (warna/font acak) | semua | hampir semua |
| entitas HTML (`&#8217;`, `&nbsp;`, `&amp;`) | semua | 200/390 (`&#nnn;`), 190/390 (named) |
| tag kosong `<p></p>`, `<span></span>` | semua | 201/390 |
| `<br>` | semua | 290/390 |
| iklan Google (AdSense) + `<div class="<hash>">` | mathcyber | 136/390 |
| `[collapse]` shortcode (penanda pembahasan) | mathcyber | 135/390 |
| `<table>` (dialog/tabel) | m4thlab, mathcyber | 163/390 |
| `<input>` radio (kuis) | defantri | 130/390 |
| `<script>` **di dalam badan artikel** | defantri | ada |
| `<footer>`/`<blockquote>` | defantri | ada |
| `\begin{}/\end{}` LaTeX | mathcyber, m4thlab | 249/390 |
| `$$…$$` vs `$…$` | semua | 227/390 (`$$`), 315/390 (`$`) |

---

## 3. Aturan Cleaning — Urutan Wajib (FINAL, hasil evaluasi 1-1)

```
(0) Keamanan    : buang <script> · <style> · <noscript> · <!-- --> · <iframe> · <form>
                  · <button> · <ins> · <nav> · <aside> · <footer> · <header>
(1) Iklan       : buang <ins> · div class hash + adsbygoogle · googlesyndication
(2) SVG         : buang SVG IKON (width/height≤32 / viewBox 24×24); PERTAHANKAN
                  SVG DIAGRAM (viewBox besar / banyak <line>/<polygon>)  ← temuan
(3) Media       : <img src> → ![alt](src) · <figcaption> → *caption*   ← temuan
(4) Struktur    : <br>→\n (KECUALI di dalam <table>: tetap <br/>)  ← temuan
                  <ol>/<ul>/<li> → daftar markdown + INDENTASI SARANG  ← temuan
                  <pre>/<code>/<hr> → DIBUANG (kode/sampah, bukan soal) ← temuan
                  <blockquote> → LEPAS TAG, ISI TETAP (9.740 = SOAL!)     ← temuan
                  <table> → DIPERTAHANKAN HTML
(5) Sisa tag    : buang tag, TAPI LINDUNGI MATH dulu (mis. $x<3$)      ← perbaikan bug
(6) Entitas     : &#nnn; · &#xhh; · &named; (termasuk &ensp; &ang; &sup2; &sup3;
                  &fnof; &ordm; &pi;) → karakter       ← SEBELUM math
(7) Spasi       : \u00a0 → spasi · spasi ganda → 1 · baris kosong > 2 → 1 · trim
(8) Shortcode   : DAFTAR-HITAM: [collapse] · [spoiler] saja
(9) Math        : $$…$$ → \[…] · $…$ → \(…) · \cancelto→\overset{\cancel} · deteksi $ yatim
```

### 3.1 Keputusan Final (evaluasi satu-per-satu, 2026-09-30)

| # | Aturan | Keputusan | Bukti |
|---|---|---|---|
| A1 | blok boilerplate | buang semua | 78% punya `<script>` |
| A1 | **SVG** | **ikon buang, diagram simpan** | 3 SVG grafik fungsi (m4thlab) |
| A2 | iklan AdSense | buang (apa adanya) | 0 sisa dari 419 file |
| A3a | **`<figcaption>`** | **→ caption markdown** | 113 caption nyata |
| A3b | **src relatif** | **adapter yang absolutkan** | 3.200 relatif (mathcyber/pusmendik) |
| C | `<br>`, nested list | `\n` + **indentasi sarang** | 348 nested |
| C | **`<br>` dalam `<table>`** | **tetap `<br/>`** | 713 |
| C | **`<pre>/<code>/<hr>`** | **DIBUANG** | 42/61/0 blok |
| C | **`<blockquote>`** | **JANGAN buang — 9.740 SOAL** | 9.728 mengandung math |
| D1 | **stripTags** | **lindungi math (Opsi C)** | 65 file `$x>5$` |
| D2 | **entitas** | **lengkapi 7 entitas** | `&ensp;` 2.136× |
| E | shortcode | daftar-hitam | tepat, 0 salah-hapus |
| F | math | apa adanya | `\cancelto` diuji gagal di KaTeX |

> **⚠️ Shortcode = daftar-hitam, BUKAN buang-semua.** `[n]`,`[m]`,`[type]`,`[abcd]` dll.
> adalah **LaTeX / nama titik**, bukan shortcode. Hanya `[collapse]` (7.591×) +
> `[spoiler]` (1×) shortcode asli.

> **⚠️ `<blockquote>` JANGAN dibuang** — di korpus ia pembungkus **SOAL** (9.740 soal,
> termasuk pilihan A–E via radio). Dibuang = kehilangan soal.

> **⚠️ `stripTags` WAJIB melindungi math** — pola naif `/<[^>]+>/` merusak `$x < 3$ dan $y > 2$`.

## 4. Tiga Jebakan Nyata (WAJIB ditangani)

### Jebakan #1 — `&amp;` di dalam LaTeX (KRITIS)

Di korpus nyata: `$$\begin{aligned} \overline{5abcde} &amp; = 26 \times …`

Artinya: entitas HTML `&amp;` **muncul di dalam blok matematika** sebagai `&` (perataan `&=`).
**Bila decoding entitas dilakukan SETELAH normalisasi math, hasilnya benar.**
Tapi bila **tag dibuang tanpa decoding entitas**, `&amp;` tetap jadi teks nyata → KaTeX gagal.

> **Aturan:** decoding entitas (langkah 5) dilakukan **setelah** tag dibuang (langkah 4),
> dan **sebelum** normalisasi math (langkah 8). Hasil: `align` dapat `&` yang benar.

### Jebakan #2 — `$…$` vs `$$…$$` bersarang/salah pasang

`$1$, $2$, $3$` = tiga rumus terpisah (benar). Tapi `$$…$` (satu dolar ganjil) = rusak.
**Aturan:** deteksi ganjil → tandai `isFlagged` ("delimiter rumus tak seimbang"), **jangan** tebak.

### Jebakan #3 — `<script>` di dalam badan artikel (defantri)

`<script>let lbl=[];lbl.push('Matematika Kreatif',…)</script>` muncul **di tengah artikel**.
**Aturan:** buang **semua** `<script>` (dengan isinya) di langkah 0, di mana pun posisinya —
bukan hanya di `<head>`.

---

## 5. Yang TIDAK dilakukan cleaning general

Cleaning **tidak** memutuskan soal/opsi/kunci — itu tugas **adapter** per-sumber (lihat
`STRATEGI-INGEST.md` §3.1). Cleaning hanya menyiapkan **teks bersih**.

| Tugas | Lapisan |
|---|---|
| Buang kotoran struktur, entitas, spasi, normalisasi math | **cleaning (general)** |
| Deteksi nomor soal, opsi A–E, kunci, pembahasan | **adapter (per-sumber)** |

---

## 6. Bentuk Keluaran (kontrak)

```ts
// INGEST — L6 (fungsi murni, tanpa DB)
cleanHtml(rawHtml: string): {
  text: string;              // teks bersih + math ternormalisasi
  media: string[];           // URL gambar yang ditemukan
  warnings: string[];        // mis. "delimiter rumus tak seimbang", "0 penanda soal"
}

normalizeMath(text: string): { text: string; imbalanced: boolean }  // + deteksi $ yatim
decodeEntities(text: string): string  // &#nnn; / &named; → karakter
stripTags(html: string): string       // semua tag → spasi
```

Semua **fungsi murni** → diuji dengan fixture; **tak ada DB/network** (L6).

---

## 7. Rencana Uji (fixture nyata)

Ambil **potongan kecil** dari korpus nyata sebagai fixture:
- mathcyber: 1 artikel MC + 1 essay (uji `sp-wrap`, `[collapse]`, iklan, `&amp;` di LaTeX)
- m4thlab: 1 artikel terstruktur (`contoh-soal`, `cs-opt`)
- defantri: 1 artikel blog (uji `<script>` dalam badan, `<footer>`)
- **kasus batas**: HTML kosong, tanpa penanda, delimiter `$` ganjil, entitas ganda

---

## 8. Status

✅ **Semua aturan sudah dievaluasi satu-per-satu & diputuskan** (2026-09-30).
✅ **Sudah diimplementasi** di `src/lib/ingest/parsers/clean.ts` + 31 tes unit.
✅ Divalidasi ke **seluruh korpus (1.074 file)** — 0 sisa entitas, math aman.

Belum ditangani (tugas lapisan berikutnya):
- **Absolutkan `src` gambar relatif** → tugas **ADAPTER** per-sumber (keputusan A3b).

---

*Lihat juga:

---

## Catatan Verifikasi

- 2026-09-30 — semua aturan dievaluasi satu-per-satu bersama pemilik; keputusan terkunci.
- Implementasi `clean.ts` diverifikasi: tsc 0, lint 0, 313 unit tes, coverage 94.4% stmts/81.3% branch.
- Validasi korpus nyata: 1.074 file, 0 sisa entitas bernama, math `$x<3$` aman.
- Evaluasi komprehensif 1.081 file: lihat `EVALUASI-KORPUS-KOMPREHENSIF.md`.

### Pembaruan 2026-09-30 (M9-2b) — `bestImageSrc`

`extractImages` kini memilih URL gambar **terbaik**: `srcset` (kandidat terbesar)
> `data-src`/`data-lazy-src` > `src`. Alasan: `src` mathcyber = path crawler lama
(**404**), URL asli hidup ada di `srcset` (87% dari 2.763 gambar). Teruji di
`clean.test.ts`. Detail: `docs/RENCANA-MEDIA.md`.
