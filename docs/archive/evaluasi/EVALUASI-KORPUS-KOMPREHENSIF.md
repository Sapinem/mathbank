# EVALUASI KORPUS KOMPREHENSIF — Dasar Aturan Cleaning (M9)

> **Status:** ✅ evaluasi selesai · **Milestone:** M9 · **Tanggal:** 2026-09-30
> **Metode:** memindai **SELURUH 1.081 file** korpus `~/projects/qbank/data/corpora/`
> (0 gagal baca). Bukan sampel — inventaris lengkap.

---

## 1. Profil Korpus

| Sumber | File | Peran |
|---|---:|---|
| **mathcyber** | 406 | Soal + pembahasan (ID & EN) |
| **m4thlab** | 249 | Materi/soal terstruktur (`.contoh-soal`, `.cs-*`) |
| **defantri** | 414 | Blog (banyak artikel, sedikit soal) |
| **pusmendik_tka** | 8 | JSON terstruktur |
| **pusmendik_dayaserap** | 4 | JSON terstruktur |
| **TOTAL** | **1.081** | |

Ukuran `rawHtml`: median **39 KB**, maks **269 KB**.

---

## 2. Inventaris Kotoran (SELURUH file, frekuensi nyata)

### 2.1 Harus dibuang — keamanan
| Kotoran | Frekuensi |
|---|---:|
| `<script>` | **840/1081 (78%)** |
| `<noscript>` | 412 (38%) |
| `<!-- komentar -->` | 722 (67%) |
| `<iframe>` | 31 (3%) |
| `<style>` | 26 (2%) |

### 2.2 Harus dibuang — iklan
| Kotoran | Frekuensi |
|---|---:|
| AdSense (`adsbygoogle`, `data-ad-*`) | **419 (39%)** |
| `<div class="<hash 32 hex>">` (pembungkus iklan) | 404 (37%) |
| `<ins>` | 419 (39%) |

> Kelas iklan terbanyak: `.fd26c469e8373073dba45b1b47e66778` (1307×) — **hash**, tak bisa
> diandalkan nama tetap → aturan: buang `<div class="[0-9a-f]{16,}">` yang mengandung iklan.

### 2.3 Harus dibuang — boilerplate
| Kotoran | Frekuensi | Catatan |
|---|---:|---|
| `<footer>` | 426 (39%) | nyata |
| `sidebar`/`widget` | 16 (1%) | nyata |
| `breadcrumb`/`yoast`/`rank-math` | 15 (1%) | nyata |
| share/social | 15 (1%) | nyata |
| `<nav>`/`<aside>`/`<header>` | **0** | **tak ada** → tak perlu aturan khusus |

### 2.4 Shortcode — **HATI-HATI** (temuan kritis)
| Pola | Frekuensi | Sifat |
|---|---:|---|
| `[collapse]` | **7688×** | ✅ shortcode asli (penanda pembahasan) |
| `[spoiler]` | 1× | ✅ shortcode asli |
| `[type] [value] [n] [i] [a] [b] [m] [x] …` | ratusan | ❌ **BUKAN shortcode — ini LaTeX!** |

**Bukti (diperiksa langsung):**
```
$[n] = \{1, 2, \cdots, n\}$                     ← [n] = notasi himpunan
$\sqrt[n]{a}$  ·  $\sqrt[m]{\sqrt[n]{a}}$       ← [n],[m] = indeks akar
$I = \{[n]~|~n~\text{genap}\}$                  ← [n] = kelas residu
```

> **⚠️ KESIMPULAN PENTING:** aturan "buang semua `[a-z_…]`" **MERUSAK matematika**.
> Harus **daftar-hitam terbatas**: hanya `[collapse]`, `[/collapse]`, `[spoiler]`, `[/spoiler]`.

### 2.5 Media
| Kotoran | Frekuensi |
|---|---:|
| `<img>` | **752 (70%)** |
| `<figure>`/`figcaption` | 65 (6%) |
| `<svg>` | 29 (3%) |

→ `<img src>` diubah ke `![Gambar](src)` + dikumpulkan ke `mediaManifest`.

### 2.6 Struktur (dipertahankan/dinormalkan, bukan dibuang)
| Kotoran | Frekuensi | Perlakuan |
|---|---:|---|
| `<br>` | **882 (82%)** | → newline (`\n`) |
| `<ul>/<ol>/<li>` | 644 (60%) | → daftar (`-` / `1.`) |
| `<table>` | 528 (49%) | **dipertahankan HTML** (keputusan user) |
| `<hr>` | 466 (43%) | → `---` |
| `<blockquote>` | 444 (41%) | → `>` |
| `<code>/<pre>` | 57 (5%) | → backtick |

### 2.7 Entitas HTML
| Kotoran | Frekuensi |
|---|---:|
| `&#nnn;` (desimal) | **711 (66%)** |
| `&named;` | 732 (68%) |
| `&nbsp;`/`\u00a0` | 399 (37%) |
| `&#xhh;` (hex) | 328 (30%) |

### 2.8 Matematika
| Pola | Frekuensi |
|---|---:|
| `$…$` (inline) | **949 (88%)** |
| `\begin{}` | 765 (71%) |
| `$$…$$` (display) | 620 (57%) |
| `\;`, | 108 (10%) |
| `\(…\)` / `\[…\]` | 30 (3%) |

> **Jebakan `&amp;` dalam LaTeX** (terbukti): `\overline{5abcde} &amp; = 26` — artinya `&=` (align).
> Urutan **decode entitas SEBELUM normalisasi math** wajib.

### 2.9 Plugin eksternal-link (dekorasi)
`.wpel-icon`, `.wpel-image`, `.wpel-icon-right` (1285×) — **ikon plugin "WP External Links"**.
→ buang tag pembungkusnya (langkah strip tag menanganinya).

### 2.10 `<input>` / kuis (defantri)
`<input>` 421 (39%) · `<button>` 293 (27%) · `style="display:none"` 290 (27%).
→ defantri punya kuis radio (dipakai **adapter defantri**, bukan dibuang di cleaning).

---

## 3. Aturan Cleaning Final (hasil evaluasi)

```
(0) Keamanan    : buang <script> · <style> · <noscript> · <!-- --> · <iframe>   [wajib, semua posisi]
(1) Iklan       : buang <ins> · blok <div class="[0-9a-f]{16,}"> berisi iklan
(2) Boilerplate : buang <footer> · sidebar · widget · breadcrumb · share/social
(3) Media       : <img src> → ![Gambar](src)  + kumpulkan mediaManifest
(4) Struktur    : <br>→\n · <ol>/<ul>/<li>→daftar · <hr>→--- · <blockquote>→> · <code>→backtick
                  <table> → DIPERTAHANKAN (HTML)
(5) Sisa tag    : semua <tag …> → " "
(6) Entitas     : &#nnn; / &#xhh; / &named; / &nbsp; → karakter sebenarnya   ← SEBELUM math!
(7) Spasi       : \u00a0 → spasi · spasi ganda → 1 · baris kosong > 2 → 1 · trim
(8) Shortcode   : buang HANYA [collapse] · [/collapse] · [spoiler] · [/spoiler]   ← DAFTAR-HITAM
(9) Math        : $$…$$ → \[…\] · $…$ → \(…\)  (deteksi $ ganjil → warning)
```

**Urutan (6)-(9) KRITIS:** decode entitas **sebelum** normalisasi math, agar `&amp;`
di dalam `align` menjadi `&` yang benar.

---

## 4. Ringkasan Keputusan yang Divalidasi Data

| Pertanyaan | Jawaban berbasis data |
|---|---|
| Buang semua shortcode `[a-z]`? | ❌ **TIDAK** — merusak LaTeX (`[n]`, `[m]`). Daftar-hitam: `[collapse]`, `[spoiler]` |
| `<table>` dipertahankan? | ✅ Ya (keputusan user; 49% file punya tabel) |
| `<nav>`/`<aside>` perlu aturan? | ❌ Tak ada di korpus (0 file) — tetap aman dibuang bila muncul |
| Urutan entitas vs math | **Entitas dulu**, lalu math (jebakan `&amp;` di align) |

---

## 5. Pertanyaan Terbuka

1. **Setujui daftar-hitam shortcode** (`[collapse]`, `[spoiler]`) — bukan buang-semua?
2. **`<ul>/<ol>`** → daftar markdown (`-`/`1.`) atau HTML apa adanya?
3. **`<blockquote>`/`<hr>`** → `>`/`---` markdown, atau HTML apa adanya?

---

*Lihat juga: `docs/ATURAN-CLEANING-KORPUS.md` (aturan ringkas), `docs/STRATEGI-INGEST.md`,
`~/projects/qbank/src/lib/ingest/corpus-parser.ts`.*
