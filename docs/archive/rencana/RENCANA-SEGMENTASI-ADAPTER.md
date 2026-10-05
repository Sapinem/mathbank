# RENCANA SEGMENTASI & ADAPTER — M9-2

> **Status:** ✅ **TERIMPLEMENTASI** (3 adapter HTML; pusmendik menyusul M9-2b) · **Milestone:** M9 · **Tanggal:** 2026-09-30
> **Lapisan:** SETELAH cleaning (`clean.ts`). Lapisan ini **tahu soal & sumber**.
> Berbasis pemeriksaan langsung struktur HTML korpus (bukan dugaan).

---

## 1. Prinsip (pembagian tugas)

| Lapisan | Tanggung jawab | Tahu soal? | Tahu sumber? |
|---|---|---|---|
| **cleaning** (`clean.ts`) ✅ | buang kotoran, entitas, spasi, math | ❌ | ❌ |
| **segmentasi** (`segment.ts`) | pisah teks bersih → blok-blok per-soal | 🟡 sebagian | ❌ |
| **adapter** (`adapters/*.ts`) | bedah 1 blok → stem/opsi/kunci/pembahasan | ✅ | ✅ |

Urutan: `rawHtml` → **clean** → **segment** (per adapter) → **parse items** → soal draft.

---

## 2. Penanda Soal per-Sumber (temuan langsung)

### 2.1 mathcyber (406 file)
```html
<h2><span>Soal Nomor 1</span></h2>          ← awal soal (atau "Problem Number 1", Inggris)
<p>...teks soal...<img></p>
<ol style="list-style-type: upper-alpha">
  <li>opsi A</li><li>opsi B</li>...          ← opsi (A–E)
</ol>
<div class="sp-wrap sp-wrap-brown">          ← pembahasan
  <div class="sp-head">Pembahasan</div>
  <div class="sp-body folded">...isi...</div>
</div>
```
- **Penanda**: `Soal Nomor N` / `Problem Number N` (dua bahasa!)
- **Opsi**: `<ol>` dengan `list-style-type: upper-alpha`
- **Pembahasan**: `div.sp-wrap` (bisa juga `[collapse]`)
- **Bagian**: kadang ada `Bagian Uraian` (soal essay)

### 2.2 m4thlab (249 file) — **paling terstruktur**
```html
<div class="contoh-soal">
  <div class="cs-header">Contoh Soal 1</div>
  <div class="cs-body">
    <div class="cs-teks">...teks soal...</div>          ← STEM
    <div class="cs-toggle-pem">Lihat Pembahasan ▼</div>  ← abaikan
    <div class="cs-pembahasan cs-pem-uraian">
      <div class="cs-pem-label">💡 Pembahasan</div>
      <div class="cs-pem-body">...pembahasan...</div>    ← PEMBAHASAN
    </div>
  </div>
</div>
<!-- varian dengan opsi: -->
<div class="cs-opsi">
  <div class="cs-opt" onclick="pilihJawaban(this, true)">   ← TRUE = kunci!
    <span class="cs-marker">A</span>
    <span class="cs-opt-text">opsi A</span>
  </div>
  <div class="cs-opt" onclick="pilihJawaban(this, false)">...  ← false = bukan kunci
</div>
```
- **Penanda**: `div.contoh-soal` (pembungkus 1 soal)
- **Stem**: `div.cs-teks`
- **Opsi**: `div.cs-opt` + `span.cs-marker` (A/B/C...) + `span.cs-opt-text`
- **KUNCI**: `pilihJawaban(this, true)` → **kunci langsung terbaca** ✅
- **Pembahasan**: `div.cs-pem-body`

### 2.3 defantri (414 file)
```html
<h4>3. Soal OSN-K IPS SMP 2013</h4>       ← judul/nomor soal
<blockquote>
  ...teks soal...<br>
  <ol><li>pernyataan 1</li><li>pernyataan 2</li></ol>   ← bisa soal "pernyataan"
  <div class="question">
    <label><div class="box white"><input type="radio" name="q40" value="correct">$(A)$ opsi A</div></label>
    <label><div class="box white"><input type="radio" name="q40" value="corect">$(B)$ opsi B</div></label>  ← TYPO di sumber!
  </div>
</blockquote>
```
- **Penanda**: `<blockquote>` (pembungkus soal) — **9.740 soal** ✅ (temuan penting!)
- **Stem**: isi blockquote sebelum `<div class="question">`
- **Opsi**: `input[type=radio]` dengan `name="qN"` + label `$(A)$ ...`
- **KUNCI**: `value="correct"` — **tapi ada typo `corect`** di sumber ⚠️
- **Pembahasan**: sering TIDAK ada (defantri banyak soal tanpa pembahasan)

---

## 3. Aturan Mutu (WAJIB — dari pengalaman QBank)

| Aturan | Alasan |
|---|---|
| **Jangan menebak kunci** | bila `value="correct"` tak ada → kunci kosong (flag), bukan tebak |
| **Opsi < 2 → essay**, bukan error | soal uraian itu sah |
| **Opsi 2–4 → flag** ("opsi tak lengkap") | mungkin parsing kurang |
| **0 penanda soal → skip** (artikel murni) | bukan error |
| **Idempoten** (hash konten) | impor ulang memperbarui, bukan menggandakan |
| **Semua hasil = status `draft`** | wajib telaah manusia (kecuali kunci jelas?) |
| **Simpan `sourceUrl` + `sourceId`** | jejak asal untuk verifikasi |

### 3.1 Aturan kunci jawaban — KONSERVATIF
```
- m4thlab: pilihJawaban(this,true) → kunci PASTI (sumber eksplisit)
- defantri: value="correct" → kunci PASTI; value="corect" (typo) → anggap correct (toleransi ejaan)
- mathcyber: TIDAK ada penanda kunci di HTML (kunci di narasi pembahasan) → KOSONG + flag
```
> **Prinsip:** lebih baik kunci kosong (ditelaah manusia) daripada kunci salah.

---

## 4. Bentuk Keluaran (kontrak)

```ts
// Satu soal hasil ekstraksi (sebelum disimpan ke DB)
interface ParsedItem {
  kind: "single_choice" | "essay";
  stem: string;                         // teks soal (math sudah \(...\))
  options: { label: string; text: string; isCorrect: boolean }[];  // [] bila essay
  answerKey?: { correct?: string; text?: string };  // hanya bila pasti
  explanation?: string;                 // pembahasan (bila ada)
  warnings: string[];                   // "kunci tak ditemukan", "opsi hanya 3", dll.
  sourceRef: { index: number; heading?: string };
}

interface SegmentResult {
  items: ParsedItem[];
  skipped: number;                      // blok yang bukan soal
  warnings: string[];
}

// Tiap adapter mengekspor ini:
parseArticle(cleanText: string, rawHtml: string, meta: {source, url, title}): SegmentResult
```

---

## 5. Struktur Berkas

```
src/lib/ingest/
  parsers/
    clean.ts            ✅ (general — selesai)
    clean.test.ts       ✅
    segment.ts          🆕 pembagi blok generik (berbasis penanda)
    segment.test.ts     🆕
    adapters/
      mathcyber.ts      🆕  Soal Nomor / Problem Number
      m4thlab.ts        🆕  contoh-soal / cs-*
      defantri.ts       🆕  blockquote / radio
      index.ts          🆕  pilih adapter (otomatis dari url/penanda + bisa dipaksa)
```

**Desain:** tiap adapter = **fungsi murni kecil** (bukan monolit 641 baris seperti QBank lama).

---

## 6. Deteksi Sumber (adapter)

```
pilihAdapter(meta) →
  1. bila meta.source eksplisit → pakai itu
  2. else deteksi dari rawHtml: contoh-soal? → m4thlab
                                 Soal Nomor/Problem Number? → mathcyber
                                 input[type=radio] + <blockquote>? → defantri
  3. else → null (skip; lapor "sumber tak dikenal")
```

---

## 7. Rencana Uji (fixture nyata)

| Uji | Isi |
|---|---|
| mathcyber | 1 artikel soal-pilihan + 1 essay; uji penanda ID & EN |
| m4thlab | 1 dengan `cs-opt` (kunci `true`) + 1 tanpa opsi (uraian) |
| defantri | 1 dengan radio (uji toleransi `corect`) + 1 tanpa pembahasan |
| kasus batas | 0 penanda (artikel), opsi 1, kunci tak ada, HTML cacat |
| **validasi korpus** | jalankan ke SEMUA file tiap sumber → hitung items/skip/warning |

---

## 8. Pertanyaan Terbuka (butuh keputusan)

1. **Kunci mathcyber** — kosongkan + flag (konservatif), atau coba tebak dari pembahasan?
2. **Semua draft?** — semua hasil masuk status `draft`, atau yang kuncinya pasti boleh `review`?
3. **Cakupan M9-2** — 3 sumber (mathcyber/m4thlab/defantri) dulu, atau +pusmendik (JSON)?

---

*Lihat juga: `docs/STRATEGI-INGEST.md`, `docs/ATURAN-CLEANING-KORPUS.md`,
`~/projects/qbank/src/lib/ingest/corpus-parser.ts` (rujukan lama — monolit, kita pecah).*

---

## 9. Hasil Implementasi & Validasi (2026-09-30)

### Adapter yang dibangun
- `segment.ts` — titik masuk + pemilih adapter
- `adapters/{m4thlab,mathcyber,defantri}.ts` + `adapters/index.ts`
- `items.ts` — aturan mutu bersama; `types.ts` — kontrak

### Validasi SELURUH korpus (1.069 file)

| Sumber | File | Kosong | Soal | PG | Essay | Ada Kunci | Tanpa Kunci |
|---|---:|---:|---:|---:|---:|---:|---:|
| mathcyber | 406 | 64 | 7.643 | 4.595 | 3.048 | 3.778 | 817 |
| m4thlab | 249 | 28 | 2.938 | 2.219 | 719 | **2.219** | 0 |
| defantri | 414 | 144 | 10.284 | 10.254 | 30 | 8.609 | 1.645 |
| **TOTAL** | 1.069 | 236 | **20.865** | 17.068 | 3.797 | **14.606** (70%) | 2.462 |

### Aturan kunci (final, terbukti data)
- **m4thlab**: `pilihJawaban(this, true)` → kunci pasti (2.219/2.219).
- **defantri**: `value="correct"` = KUNCI; **`value="corect"` = PENGECOH** (bukan typo!).
  Hanya varian `correct` yang tidak sengaja salah ketik (`crorect`,`corrrect`,`crrect`) ditoleransi.
- **mathcyber**: `(Jawaban X)` → kunci; tanpa itu → kosong + catatan (817 PG).

### Temuan penting
1. **`corect` ≠ typo** — itu pengecoh sengaja (32.752×). Memasukkannya sebagai "kunci"
   akan menandai SEMUA opsi benar (bug yang sempat terjadi & diperbaiki).
2. **mathcyber punya opsi INLINE** (bukan `<ol>`): `A. … D. … B. … E. …` (2-kolom) —
   +1.796 soal PG yang tadinya dianggap essay.
3. **defantri**: pemisah andal = `name="qN"` (bukan `<blockquote>`, yang menggabungkan soal).

### Belum (M9-2b)
- **pusmendik**: `pusmendik_dayaserap` = **JSON terstruktur** (`questions[].question_data`
  dengan `pertanyaan/pilihan/kunci_jawaban`) — butuh masukan non-HTML; `pusmendik_tka` = HTML.

---

## 10. pusmendik — DUA bentuk sumber (M9-2c, 2026-09-30)

| Sumber | Bentuk | Soal | Tipe |
|---|---|---:|---|
| `pusmendik_dayaserap` | **JSON terstruktur** | 110 | PG 66 · MCMA 22 · Kategori 22 |
| `pusmendik_tka` | **HTML halaman ujian** | 189 | PG (semua) |

### Pemetaan tipe (TANPA tipe baru — enum MathBank sudah lengkap)
- PG → `single_choice`
- PG Kompleks **MCMA** → `multiple_choice_checkbox`
- PG Kompleks **Kategori** → `matrix_grid` (`dataPayload = {labels, rows}`)

### Temuan kunci
1. **KUNCI pusmendik: 0/299.** `kunci_jawaban` = `[]`/`null`; `pernyataan[].jawaban` = "".
   → kosong + flag (jangan menebak).  [Backlog: minta kunci ke sumber]
2. **TKA**: soal = `<img>` di `div.isi-soal` **sebelum** `<!-- PG -->`; opsi = `<img>` di
   `<td>` setelah radio (huruf dari `pil="a"`). Kunci **tidak ada di HTML** (di server).
3. **SSL pusmendik rusak** (`CERTIFICATE_VERIFY_FAILED`) — gambar sebenarnya hidup.
   → TLS dilonggarkan **hanya** untuk domain ter-pin (`TLS_RELAXED_HOSTS`).

### Kontrak baru
- `JsonAdapter` (sumber non-HTML) + `segmentJson(data, meta)`.
- `finalizeItem(..., { type?, dataPayload? })`.
