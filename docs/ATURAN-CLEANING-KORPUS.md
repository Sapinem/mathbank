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

## 3. Aturan Cleaning — Urutan Wajib

Urutan **tidak boleh** ditukar (alasan di §4).

```
(0) Keamanan        : buang <script> · <style> · <noscript> · <!-- komentar --> · <iframe>
(1) Buang blok iklan: div AdSense (class hash acak) + <ins class="adsbygoogle"> + [collapse]? (belum)
(2) Buang boilerplate: <nav> · <footer> · <aside> · sidebar · related-posts · share · breadcrumb
(3) Simpan media    : <img src> → ![Gambar](src)  (kumpulkan daftar URL untuk mediaManifest)
(4) Buang sisa tag  : semua <tag …> → " "  (span/div/p/h/li/strong/em/a/table/tr/td…)
(5) Entitas HTML    : &#nnn; · &#xhh; · &named;  → karakter sebenarnya
(6) Rapikan spasi   : \u00a0 → spasi · spasi ganda → 1 · trim
(7) Shortcode       : [collapse] dan sejenis → buang
(8) Normalisasi math: $$…$$ → \[…\] · $…$ → \(…\) · perbaiki LaTeX rusak
```

### 3.1 Detail tiap aturan

| # | Aturan | Contoh sebelum → sesudah |
|---|---|---|
| 0 | Buang script/style/noscript/komentar/iframe | `<script>let lbl=[]…</script>` → *(hilang)* |
| 1 | Buang iklan | `<div class="fd26c469…"><script…adsbygoogle…>` → *(hilang)* |
| 3 | Gambar → markdown | `<img src="x.png">` → `![Gambar](x.png)` |
| 4 | Sisa tag → spasi | `<span style="color:#000">Halo</span>` → `Halo` |
| 5 | Entitas | `you&#8217;re` → `you’re` · `&nbsp;` → ` ` · `&amp;` → `&` |
| 6 | Spasi | `A&nbsp;&nbsp;B` → `A B` · baris kosong > 2 → 1 |
| 7 | Shortcode | `[collapse]` · `[/collapse]` · `[su_…]` → *(hilang)* |
| 8 | Math | `$$x$$` → `\[x\]` · `$x$` → `\(x\)` |

---

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

normalizeMath(text: string): string   // $$…$$ → \[…\], $…$ → \(…\)
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

## 8. Pertanyaan Terbuka

1. **Setujui urutan cleaning di §3** sebagai aturan general?
2. **Shortcode WordPress lain** (`[su_…]`, `[caption]`, `[gallery]`) — buang semua pola `[...]`
   pendek, atau daftar putih? (usul: buang pola `[a-z_]+` pendek, sisakan `[...]` yang jelas LaTeX/markdown)
3. **Tabel** (`<table>` dialog/tabel) — jadikan markdown/HTML apa adanya, atau ratakan jadi teks?
   (usul: **pertahankan sebagai HTML** agar struktur dialog terjaga)

---

*Lihat juga: `docs/STRATEGI-INGEST.md` (alur & adapter), `~/projects/qbank/src/lib/ingest/corpus-parser.ts`
(rujukan logika lama), `docs/DESAIN-PER-LAPISAN-MATHBANK.md` (L6).*
