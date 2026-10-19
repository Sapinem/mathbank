# Audit Performa & Optimasi — MathBank v2

> **Skill yang dipakai:** `performance-optimization` (metric-honesty → network waterfall →
> render/bundle → database → cache → memori proses → verifikasi)
> **Tanggal audit:** 17 Oktober 2026
> **Basis kode:** `HEAD 7c4df34` + 20 berkas termodifikasi & 16 berkas baru yang
> **belum di-commit** (lihat §1.2)
> **Metode:** pembacaan kode pada jalur nyata (route → service → query), kompilasi SQL
> Drizzle ke dialect PostgreSQL untuk memverifikasi bentuk kueri, penelusuran
> konfigurasi build (`next.config.ts`, `layout.tsx`, output `.next/static`),
> serta menjalankan gerbang mutu statis.
> **Sifat:** *read-only audit* — **tidak ada kode aplikasi yang diubah**. Laporan ini
> satu-satunya berkas baru.
> **Status dokumen:** ⚠️ — 5 klaim audit performa sebelumnya dikoreksi (lihat Lampiran 8).

---

## 1. Ringkasan Eksekutif

MathBank v2 sudah menerapkan sejumlah optimasi yang **jauh di atas rata-rata** untuk
proyek seukurannya: LRU cache KaTeX, proyeksi kolom selektif, batch anti-N+1
(`attachOptions`, `attachCounts`), semi-join `EXISTS`, penjagaan `placeholderData`
React Query, `React.memo` selektif, dan paginasi server-side di API.

Namun audit menemukan **13 temuan**, dan yang paling serius bukan "belum dioptimalkan"
— melainkan **optimasi yang sudah dibangun lalu dilewati oleh pemanggilnya**:

1. **PERF-01 (CRITICAL)** — `BundleListView` memakai `useAllBundles` yang menelusuri
   **semua halaman** `GET /api/bundles` (hingga 50 roundtrip berurutan × 2 kueri DB),
   padahal API `PERF-05` & hook `useBundlesPage` paginasi server-side sudah siap.
   UI hanya merender 20 baris per halaman.
2. **PERF-02 (CRITICAL)** — `bulkQuestionAction` memproses hingga 200 soal secara
   **sekuensial**, tiap soal ±9 query DB **dan** membangun respons detail lengkap
   hanya untuk dibuang. Satu klik "Setujui" = ±1.800 query berurutan.
3. **PERF-04 (HIGH)** — `/img/[shortId]` menyajikan tiap gambar dengan
   `readFile()` penuh ke memori Node lalu `new Uint8Array(bytes)` menyalin **ulang**
   seluruh byte; berjalan di samping jalur pembaca berkas Next.js (double path).
4. **PERF-05 (HIGH)** — `/img/[shortId]` tidak punya **ETag/304** padahal
   `content_hash` tersedia di `media_assets`; cache browser 24 jam tidak menolong
   saat revalidasi.
5. **PERF-06 (HIGH)** — `MediaImage` tanpa `width`/`height`/`aspect-ratio` →
   **CLS** pada setiap soal bergambar (geometri, grafik, tabel gambar).

**Yang terverifikasi TIDAK menjadi masalah (penting agar jujur):**

- Klaim audit sebelumnya bahwa filter topik memicu *"snapshot penuh tabel topik pada
  **setiap** pergantian halaman paginasi"* **tidak terbukti** — paginasi soal
  dilakukan di klien atas data yang sudah dimuat (`useQuestions` + `placeholderData`),
  jadi `buildQuestionFilter` **tidak** dipanggil ulang saat pindah halaman. Snapshot
  hanya terjadi saat filter berubah. Lihat **§8.2**.
- Ekspresi `EXISTS` di `filters-builder.ts` yang ditulis sebagai *satu string `sql`
  dengan interpolasi kolom/tabel Drizzle* **dikompilasi dengan benar** (`FROM
  "question_topics"`, bukan parameter bound). Sudah diuji lewat `PgDialect`
  (lampiran §7.1, E-1) — bukan bug.

---

## 2. Papan Skor Performa Web

> **Metric-Honesty Rule:** tidak ada Lighthouse, RUM, atau laporan HTTP Archive di
> repo ini (lihat `docs/PERFORMA.md` §6 — *"pengukuran Lighthouse terekam"* masih
> `[ ]`). Semua angka CWV di bawah adalah **`not measured`**. Dampak yang dilaporkan
> adalah **potential impact** berbasis analisis statis, bukan hasil pengukuran.

| Metrik Core Web Vitals | Nilai | Sumber | Target (`docs/PERFORMA.md` §2) | Status |
|---|:---:|---|:---:|:---:|
| **LCP** | `not measured` | — | ≤ 2,5 s | — |
| **INP** | `not measured` | — | ≤ 200 ms | — |
| **CLS** | `not measured` | — | ≤ 0,1 | — |
| **TTFB** | `not measured` | — | ≤ 500 ms | — |
| **JS bundle/halaman** | `not measured` | — | ≤ 200 kB gzip | — |
| API p95 | `not measured` | — | ≤ 300 ms | — |
| Lighthouse Performance | `not measured` | — | ≥ 90 | — |

**Indikator statis yang TERUKUR (bisa diverifikasi ulang oleh siapa pun):**

| Indikator statis | Nilai | Cara verifikasi |
|---|:---:|---|
| Query DB estimasi per klik "Setujui" (200 soal) | **± 1.800** berurutan (§4.1) | hitung dari `question-bulk.ts` + `question-status.ts` + `question-read.ts` |
| Roundtrip HTTP saat buka `/bundles` (N paket) | **⌈N/100⌉** berurutan (§3.1) | `useAllBundles` loop, `PAGE = 100` |
| Entri cache metrik per pathname dinamis | **1 per id** (tak terbatas) (§5.2) | `route-wrapper.ts:290` → `metrics.ts:57` |
| `prune()` dijadwalkan | **0 kali** (§5.3) | `grep -rn "\.prune(" src` → hanya deklarasi |
| Ukuran maksimum `useAllBundles` | 50 × 100 = **5.000 baris** di memori klien | `for (let i = 0; i < 50; i++)` |

---

## 3. Temuan — Network & Loading

### 🔴 PERF-01 — [CRITICAL] Waterfall HTTP berantai di `BundleListView`

- **Lokasi:** `src/lib/hooks/use-bundles.ts:133-160`, `src/components/bundles/bundle-list-view.tsx:127-212`
- **Deskripsi:** `BundleListView` memanggil `useAllBundles(...)` yang menelusuri
  seluruh halaman `GET /api/bundles` (page size 100, maksimum 50 iterasi) secara
  **berurutan** (`await` di dalam `for`). Setiap halaman memicu 2 kueri DB di
  `listBundles` (`bundle-query.ts:94-108`: `COUNT(*)` + halaman) plus 1 kueri
  `attachCounts` — lalu hasilnya dipotong klien hanya untuk 20 baris:
  ```ts
  // bundle-list-view.tsx:209-212
  const paged = filtered.slice(
    safePage * BUNDLES_PAGE_SIZE, safePage * BUNDLES_PAGE_SIZE + BUNDLES_PAGE_SIZE);
  ```
  `statusFilter` dan `search` bahkan **hanya** filter klien, sehingga untuk
  mendukungnya seluruh korpus paket harus ada di memori klien.
- **Dampak (potensial):** pada 1.000 paket = 10 roundtrip berurutan × (COUNT + page +
  counts) ≈ 30 query DB dan 10 request HTTP sebelum halaman berguna; pada batas
  desain (5.000 paket) = 50 roundtrip. Memperburuk TTFB, memblokir main thread saat
  deserialisasi JSON, dan memboroskan payload (kolom `instructions`, `description`,
  dll. ikut terkirim untuk baris yang tak pernah dirender).
- **Bukti:** API & hook paginasi **sudah ada dan sudah benar** —
  `src/app/api/bundles/route.ts:31` (PERF-05 `limit`/`offset`), `listBundles`
  (`bundle-query.ts:78-111`) mengembalikan amplop `{ items, total, limit, offset }`,
  dan `useBundlesPage` (`use-bundles.ts:105-123`). Jadi ini **regresi integrasi**,
  bukan fitur yang belum dibangun.
- **Rekomendasi:**
  1. Pindahkan `status` & `q` ke kontrak query `GET /api/bundles` (Zod), lalu pakai
     `useBundlesPage` dengan `limit=20&offset=page*20`.
  2. Statistik kartu (total/exam/source/total items) dari endpoint ringkas agregat
     (`GET /api/bundles/stats`) atau dari array `status`/`bundleType` di klien — bukan
     dari seluruh baris.
  3. Hapus `useAllBundles` setelah migrasi (CONSTRAINTS #19: tak ada kode mati).

### 🟠 PERF-07 — [MEDIUM] `useBundlesPage` tanpa `placeholderData` (flicker antarhalaman)

- **Lokasi:** `src/lib/hooks/use-bundles.ts:105-123`
- **Deskripsi:** `useQuestions` sudah memakai `placeholderData: (prev) => prev`
  (`use-questions.ts:60`) tetapi hook paginasi paket baru **tidak**. Saat berganti
  `offset`, tabel kembali ke state pending → `LoadingState` penuh, bukan
  mempertahankan halaman lama selagi memuat.
- **Dampak (potensial):** persepsi lambat, kerangka halaman berkedip (bukan CLS
  metrik selama kontainer berukuran tetap, tapi *perceived jank*).
- **Rekomendasi:** tambahkan `placeholderData: (prev) => prev` dan `isFetching`
  indikator halus. Ikut beres saat PERF-01 diperbaiki.

---

## 4. Temuan — Database & Backend Latency

### 🔴 PERF-02 — [CRITICAL] N×9 query berurutan per aksi massal

- **Lokasi:** `src/lib/services/question-bulk.ts:49-77`, `src/lib/services/question-status.ts:18-80`
- **Deskripsi:** `bulkQuestionAction` mengulang `await changeQuestionStatus(...)` untuk
  tiap id (maks `BULK_MAX_IDS = 200`). Per soal:

  | Langkah | Query |
  |---|---|
  | `getQuestionInternal` | 2 (`questions SELECT *` + `questionOptions`) |
  | `UPDATE … WHERE id AND status` | 1 |
  | `recordAudit` | 1 |
  | `getQuestion(id, { viewer })` | 1 + 1 opsi + 1 origin bundles + 1 parent + 1 topics + 1 solutions = **6** |

  = **10 query/soal** (bukan 9 — `getQuestion` juga menarik `questionTopics` dan
  solusi). Hasil `getQuestion` **dibuang** oleh pemanggil (`question-bulk.ts:59`).
- **Dampak (potensial):** ± 2.000 query berurutan dalam **satu** request dengan pool
  `max: 10` (`src/lib/db/index.ts:14`). Pada latensi 2 ms/query → ≥ 4 detik CPU-bound
  I/O serial; pada VPS bersama mudah menembus SLO p95 300 ms (`docs/SLA-SLO.md` §3)
  dan timeout proxy.
- **Rekomendasi (berlapis):**
  1. **Murah & langsung:** tambahkan opsi `{ returnUpdated?: false }` pada
     `changeQuestionStatus` & `setQuestionFlag` — lewati `getQuestion()`. Menghemat
     6/10 query.
  2. **Batch CAS** yang tetap menjaga CONSTRAINT #36 secara per-item:
     ```sql
     UPDATE questions SET status = $to, last_reviewed_at = CASE WHEN $to='ready' THEN now() ELSE last_reviewed_at END
     WHERE id = ANY($ids) AND status = $from
     RETURNING id;
     ```
     Lalu diff `RETURNING` vs `ids` → item yang tidak berubah = konflik → `failed[]`.
     Audit ditulis dengan satu `INSERT … SELECT unnest($ids)`.
  3. Izin `setReady/archive/edit` tetap dievaluasi di service atas baris yang dibaca
     sekali secara batch (`WHERE id = ANY(...)`) — jangan pindah ke route (CONSTRAINT #35).
  4. Tambahkan tes DB yang menghitung query (pg_stat_statements atau spy driver) agar
     N+1 tak kembali.

### 🟠 PERF-03 — [HIGH] Batch enrichment & embedding berjalan sekuensial

- **Lokasi:** `src/lib/services/enrichment/enrich.ts:196-212` (`enrichQuestions`),
  `src/lib/services/enrichment/embed.ts:47-100` (`embedQuestions`)
- **Deskripsi:**
  - `enrichQuestions` memanggil `enrichQuestion` (1 panggilan LLM + ±5 query) satu per
    satu untuk maksimum **200** soal (`contracts/ai.ts:53`).
  - `embedQuestions` memanggil `embedText` per soal (maks **100**, `contracts/ai.ts:68`),
    padahal pustaka sudah menyediakan `embedTexts(texts[])` yang mengirim array ke
    Ollama (`bge-m3.ts:49`). Dokumentasi proyek mencatat ±296 ms/teks (CPU).
- **Dampak (potensial):** 100 soal embedding ≈ 30 detik serial; 200 soal enrich ≈
  bermenit-menit menahan satu koneksi pool & satu HTTP request. Rate-limit
  `capacity 20, refill 0.2` memberi kesan "murah", padahal kerjanya linear & panjang.
- **Rekomendasi:**
  1. Embedding: kumpulkan teks (yang lolos izin & hash berubah) → `embedTexts(batch)`
     dengan batch 16–32.
  2. Enrichment: worker pool konkurensi terbatas (mis. 3–5) — **juga** membantu Ollama
     yang antre internalnya, tanpa membanjiri model.
  3. `listTopicNames()`/`listTagNames()` dipanggil **per soal** (`enrich.ts:86`) → pindahkan
     keluar loop (lihat PERF-08).
  4. `findNearDuplicates` per soal juga memakai query HNSW per baris — batasi ke soal
     yang baru di-embed (sudah begitu) dan jangan menandai ulang soal yang tak berubah.

### 🟠 PERF-08 — [MEDIUM] Referensi taksonomi dibaca ulang per soal enrichment

- **Lokasi:** `src/lib/services/enrichment/enrich.ts:32-41, 86`
- **Deskripsi:** `listTopicNames()` memindai **semua topik aktif** dan `listTagNames()`
  memindai **500 tag** pada setiap panggilan `enrichQuestion`. Untuk batch 200 soal =
  400 query pengulangan + payload prompt yang identik disusun 200 kali.
- **Dampak (potensial):** query redundan & prompt token berulang (biaya LLM ikut
  naik karena konteks topik/tag disertakan tiap panggilan).
- **Rekomendasi:** ambil sekali di `enrichQuestions`, teruskan sebagai parameter;
  cache di memori proses dengan TTL 15 menit + invalidasi saat topik/tag dimutasi.

### 🟡 PERF-09 — [MEDIUM] Snapshot seluruh tabel `topics` per resolusi filter

- **Lokasi:** `src/lib/question/filters.ts:83-95`, `:29-36`
- **Deskripsi:** setiap request `GET /api/questions?topicId=…` menarik **seluruh**
  `topics(id, parent_id)` ke Node lalu BFS di memori. (Dikoreksi: **tidak** terjadi
  per halaman — lihat §8.2.) Jumlah baris masih kecil (referensi ±174 topik) sehingga
  dampak saat ini kecil, tetapi pola ini **linear terhadap korpus taksonomi** dan
  diduplikasi di dua fungsi (`collectTopicDescendants` & `buildQuestionFilter`).
- **Dampak (potensial):** request bertambah saat guru memfilter berulang di tab
  berbeda; tiap request memuat tabel penuh.
- **Rekomendasi (bertahap):**
  1. **Sekarang:** `WITH RECURSIVE` di PostgreSQL (satu kueri, tanpa tarik tabel):
     ```sql
     WITH RECURSIVE sub AS (
       SELECT id FROM topics WHERE id = ANY($roots)
       UNION ALL
       SELECT t.id FROM topics t JOIN sub s ON t.parent_id = s.id)
     SELECT id FROM sub;
     ```
     Hasilnya tetap `string[]` → builder `EXISTS` tak berubah.
  2. **Menengah:** kolom `topics.path` (materialized path) sesuai `docs/RENCANA-MATHBANK-V2.md`
     §2.C → `WHERE path LIKE $1 || '.%'` dengan indeks `text_pattern_ops`.

### 🟡 PERF-10 — [LOW] `getQuestionInternal` = `SELECT *` (tarik kolom `embedding` 16 KB/baris)

- **Lokasi:** `src/lib/services/question-read.ts:208-229`
- **Deskripsi:** `getQuestionInternal` memakai `.select()` tanpa kolom — menarik
  `embedding vector(1024)` (± 4 KB biner + overhead detoast teks) padahal pemakai
  (`changeQuestionStatus`, `updateQuestion`, `setQuestionFlag`, hapus) tak pernah
  membacanya. Ini **bukan** pelanggaran CONSTRAINT #34 (bukan jalur baca API), tetapi
  tetap biaya I/O.
- **Rekomendasi:** proyeksi eksplisit (semua kolom **kecuali** `embedding`,
  `embeddingContentHash`, `embeddingModelName`). Bukti terukur: bandingkan ukuran baris
  `pg_column_size(questions.*)` sebelum/sesudah.

> **Catatan penting (koreksi audit sebelumnya).** Usulan "pisahkan `embedding` ke tabel
> 1:1 + partial HNSW". Dua koreksi teknis:
> a) PostgreSQL **tidak mendukung predikat kompleks** (`status='ready'`, `deleted_at IS NULL`)
>    pada partial index berbasis **indeks lain**; `WHERE question_id IN (SELECT …)`
>    atas tabel lain **ditolak** ("functions in index predicate must be marked IMMUTABLE").
>    Yang *mungkin* hanyalah `WHERE embedding IS NOT NULL` pada tabel embedding.
> b) HNSW PostgreSQL **tidak** menghormati filter sebagai pre-filter (filter diterapkan
>    pasca-traversal, `hnsw.iterative_scan` PG 18 membantu recall, bukan kecepatan).
>    Pastikan tujuan pemisahan (RAM heap) eksplisit dan ukur sebelum memindahkan.
> Rekomendasi ini tetap valid sebagai **optimasi penyimpanan**, bukan "perbaikan bug".

---

## 5. Temuan — Memori Proses & Stabilitas

### 🟠 PERF-06 (memori) — [HIGH] Metrik per-pathname dinamis tanpa batas

- **Lokasi:** `src/lib/api/route-wrapper.ts:290,297`, `src/lib/telemetry/metrics.ts:44-73`
- **Deskripsi:** `routePath = new URL(req.url).pathname` dipakai langsung sebagai label
  metrik. Rute dinamis (`/api/questions/<uuid>`, `/api/bundles/<uuid>`,
  `/api/media/<shortId>`, `/api/topics/<uuid>`, …) menghasilkan **satu entri per id**,
  masing-masing `Float64Array(512)` (≈ 4.3 KB) + objek. Tidak ada batas atas &
  tidak ada eviction.
- **Bukti:** `grep` menunjukkan `recordRequest(method, routePath, …)` tanpa normalisasi;
  `metrics.ts` tidak memiliki `MAX_ROUTES`.
- **Dampak (potensial):** +4,3 KB RAM jalan terus per UUID/shortId yang pernah diakses;
  100 ribu subjek → **> 400 MB** heap dan `snapshot()` (dipanggil `/api/metrics`)
  makin lambat karena mengalokasikan array per entri.
- **Rekomendasi:** normalisasi segmen dinamis ke placeholder (UUID, shortId 8 char)
  sebelum `recordRequest`, plus batas `MAX_ROUTES = 200` dengan eviction LRU.
  ```ts
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  function normalizeRoute(path: string) {
    return path.replace(UUID, ":id").replace(/(\/[a-z-]+)\/[0-9A-Za-z]{8}$/, "$1/:shortId");
  }
  ```

### 🟠 PERF-11 — [MEDIUM] `prune()` dead code di rate-limit & idempotency

- **Lokasi:** `src/lib/api/rate-limit.ts:83-88`, `src/lib/api/idempotency.ts:73-77`
- **Deskripsi:** kedua `MemoryStore` punya `prune(now)` yang **tidak pernah dipanggil**
  (tidak ada `setInterval`, tidak ada pemanggilan di `take()`/`get()`).
  `IdempotencyStore.get()` menghapus entri **hanya bila key yang sama** diakses
  kembali — key yang tak pernah diulang menetap selamanya.
- **Dampak (potensial):** peta tumbuh monoton; setiap UUID unik dari `Idempotency-Key`
  klien (UUID baru per retry *yang gagal sebelum sampai*) menambah entri permanen.
- **Rekomendasi:** panggil `prune(Date.now())` secara oportunistik tiap N panggilan
  (mis. `if (++calls % 1000 === 0)`) — deterministik, mudah diuji — atau jadwalkan
  timer unref. Kejujuran: saat ini **bukan** kebocoran eksploitatif, karena
  `rate-limitKey` hanya menghasilkan kunci per aktor/IP + scope.

### 🟡 PERF-12 — [LOW] `/img/[shortId]` memuat berkas penuh ke heap & menyalin dua kali

- **Lokasi:** `src/app/img/[shortId]/route.ts:89-103`
- **Deskripsi:**
  ```ts
  const bytes = await readFile(abs);                        // Buffer UTF-8 di heap
  return new NextResponse(new Uint8Array(bytes), { headers }); // salinan ulang penuh
  ```
  `readFile` mengalokasikan seluruh berkas; `new Uint8Array(buffer)` menyalin byte
  lagi untuk memenuhi `BodyInit`. Untuk gambar 5 MB × 30 gambar paralel (burst
  `IMAGE_POLICY` = 300) → tekanan GC mendadak.
- **Rekomendasi:** streaming berkas alih-alih buffer —
  `new NextResponse(await fs.open(abs).then(f => f.readableWebStream()), { headers })`
  atau pakai `createReadStream` via adapter; `Content-Length` tetap diisi dari `stat`.
  Golongan ini juga menyelaraskan dengan permintaan `next/image` (lihat PERF-13).

---

## 6. Temuan — Caching & Core Web Vitals

### 🟠 PERF-04 — [HIGH] Tidak ada ETag / `304 Not Modified` pada media

- **Lokasi:** `src/app/img/[shortId]/route.ts:89-103`
- **Deskripsi:** `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
  sudah ada (baik), tetapi setelah 24 jam browser **mengunduh ulang** seluruh byte tanpa
  bisa bertanya "berubah?" — padahal `media_assets.content_hash` tersedia.
  Selain itu **setiap** request (termasuk dari cache yang basi) tetap melakukan
  `findAssetByShortId` + `stat` + `readFile`.
- **Dampak (potensial):** bandwidth & latensi berulang pada sesi panjang/print berulang;
  TTFB gambar bergantung pada roundtrip DB.
- **Rekomendasi:**
  ```ts
  const etag = `"${asset.contentHash ?? shortId}"`;
  if (req.headers.get("if-none-match") === etag)
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE_CONTROL } });
  ```
  Plus `Last-Modified` dari `stat.mtime` sebagai fallback.

### 🟠 PERF-05 — [HIGH] `MediaImage` tanpa dimensi → CLS pada soal bergambar

- **Lokasi:** `src/components/math/math-content.tsx:424-445`
- **Deskripsi:** `<img src={`/img/${shortId}`} loading="lazy" class="…max-h-96 max-w-full…"/>`
  tanpa `width`/`height`, tanpa `decoding="async"`, tanpa `aspect-ratio`. `media_assets`
  menyimpan `width`/`height` (lihat galeri PERF-08 `media.ts`) tetapi tidak diteruskan ke
  renderer markdown. Bila gambar adalah elemen LCP di atas lipatan, `loading="lazy"`
  justru **menunda** LCP.
- **Dampak (potensial):** CLS > 0.1 pada soal geometri/grafik yang setiap butirnya
  memuat gambar; LCP lebih lambat untuk soal yang gambarnya hero.
- **Rekomendasi:**
  1. Perluas shortcode/token dengan dimensi (atau endpoint `HEAD` → `width/height`
     dititipkan di proyeksi media saat tokenisasi server-side).
  2. Render dalam `<span style={{ aspectRatio }}>` + `width/height` + `decoding="async"`.
  3. `loading` adaptif: `eager` + `fetchPriority="high"` untuk gambar pertama pada kartu
     teratas; `lazy` sisanya.

### 🟡 PERF-13 — [MEDIUM] Font KaTeX tanpa preload

- **Lokasi:** `src/app/globals.css:4` (`@import "katex/dist/katex.min.css"`), `src/app/layout.tsx`
- **Deskripsi:** CSS KaTeX memuat 20+ berkas font dengan `font-display: block`
  (terverifikasi di `node_modules/katex/dist/katex.min.css` baris 1) → teks rumus
  **tidak terlihat** sampai font tiba (FOIT). `next/font` (Roboto Flex/Mono) sudah
  preload; KaTeX tidak. Font ter-hash di `.next/static/media/KaTeX_*.woff2`
  (terverifikasi) sehingga path preload perlu diturunkan dari manifest.
- **Dampak (potensial):** halaman yang LCP-nya berupa rumus (bank soal, detail) tertahan
  hingga font utama tiba; micro-layout-shift saat glif menggantikan placeholder.
- **Rekomendasi:** `<link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous">`
  untuk `KaTeX_Main-Regular` & `KaTeX_Math-Italic`; atau ganti `font-display` menjadi
  `swap` lewat salinan CSS KaTeX lokal (hati-hati: `swap` memicu reflow rumus).

> **Koreksi audit sebelumnya.** Rekomendasi *"pakai `next/image`"* (disebut di
> `docs/PERFORMA.md` §3.6) **tidak** langsung berlaku untuk `{{img:shortId}}`: shortcode
> sengaja tidak menyimpan path, dan loader `/img` tidak menerima `w`/`q`.
> Memaksakan `next/image` butuh loader kustom + implementasi resize. Untuk saat ini,
> atribut dimensi + ETag + streaming (PERF-04/05/12) memberi manfaat paling besar
> dengan risiko paling kecil.

### 🟡 PERF-14 — [LOW] `X-DNS-Prefetch-Control: off`

- **Lokasi:** `next.config.ts:81`
- **Deskripsi:** MathBank berjalan full same-origin (`connect-src 'self'`,
  `font-src 'self'`) → DNS prefetch tidak memberi manfaat nyata. **Namun** klaim bahwa
  header ini "mematikan prerender/prefetch Next.js" **tidak benar**; `dnsprefetch`
  hanya mengatur spekulasi DNS peramban. Direkomendasikan **mempertahankan `off`**
  (sikap privasi) hingga ada sub-domain/CDN eksternal — bukan "bug performa".

---

## 7. Temuan — Rendering & Bundle

### 🟡 PERF-15 — [MEDIUM] `MathContent` menokenisasi ulang + `katex.renderToString` per render

- **Lokasi:** `src/components/math/math-content.tsx:168-182, 303-320, 407`
- **Deskripsi:** `tokenizeMath(content)` berjalan **setiap render** tanpa cache (hanya
  hasil `renderToString` yang di-cache LRU). `content` bisa panjang (stimulus +
  pembahasan). Karena `useMemo` dilarang (CONSTRAINTS #6) dan **React Compiler belum
  aktif** (dikonfirmasi: tidak ada `reactCompiler` di `next.config.ts` /
  `babel-plugin-react-compiler` di `package.json`), setiap render ulang induk
  (mis. checkbox pada kartu lain, toast, perubahan state dialog) mengulang parsing.
- **Dampak (potensial):** INP memburuk pada daftar soal 20 kartu × konten panjang
  ketika guru mencentang banyak kartu di `QuestionBankView`. `PERF-02` `React.memo`
  di `question-card.tsx` **sudah membantu** (kartu lain tak render ulang), tetapi
  perenderan di dalam kartu tetap terjadi saat state kartu itu berubah.
- **Rekomendasi:** cache token `Map<string, Token[]>` berkapasitas sama seperti
  `mathHtmlCache` (modul-level, deterministik karena `content` murni). Tidak melanggar
  larangan `useMemo`. Alternatif jangka panjang: aktifsikan React Compiler setelah
  ada pengukuran (sesuai alasan jujur di CONSTRAINTS #6).

### 🟡 PERF-16 — [MEDIUM] Fetcher API terduplikasi 7× (drift perilaku & bundle)

- **Lokasi:** `src/lib/hooks/use-questions.ts:18-29`, `use-settings.ts`, `use-taxonomy.ts`,
  `use-ai.ts`, `use-media.ts`, `use-reference.ts`, `use-agent-keys.ts`, plus
  `src/lib/api/fetcher.ts` (dipakai `use-bundles.ts` & `use-taxonomy-refs.ts`).
- **Deskripsi:** komentar `fetcher.ts` mengklaim *"**C3:** sebelumnya disalin-tempel …
  Disatukan"* — tetapi versi di 7 hook masih lokal, dan perbedaannya **bukan kosmetik**:
  `use-questions.ts` mengatur `error: "HTTP ${status}"` saat JSON tanpa `error.message`,
  sementara `fetcher.ts` mengembalikan `"Terjadi kesalahan."`. Jadi pesan galat berbeda
  tergantung hook — bukan hanya duplikasi kode.
- **Dampak (potensial):** bundle klien memuat kode ganda; perbaikan (mis. `AbortSignal`,
  `credentials`, `dispose` JSON) harus dilakukan 8 tempat; pesan UX tak konsisten.
- **Rekomendasi:** ganti semua pemanggilan ke `api()` dari `src/lib/api/fetcher.ts`;
  pertahankan fallback `HTTP ${status}`.

### 🟡 PERF-17 — [LOW] `BundleDetailView` memicu dua request berurutan untuk rute yang sama

- **Lokasi:** `src/components/bundles/bundle-detail-view.tsx:32-33`, `src/app/api/bundles/[id]/route.ts:26-34`
- **Deskripsi:** `useBundle` (`GET /api/bundles/:id` memuat **semua item + opsi**) dan
  `useBundleValidation` (`GET /api/bundles/:id/validate` memindai `bundle_items`) berjalan
  paralel, tetapi tidak bisa dipakai bersama cache. Halaman cetak (`BundlePrintView`)
  memuat item lengkap meski hanya butuh subset.
- **Dampak (potensial):** ±3 kueri DB + 2 payload JSON besar untuk halaman detail; di
  ponsel, bundle 50 soal ≈ opsi + markdown penuh di satu respons.
- **Rekomendasi:** sertakan `validation` sebagai bagian ringkas dari `GET /api/bundles/:id`
  (satu query `EXISTS` per item), atau endpoint `?include=validation`; pertimbangkan
  `fields` proyeksi untuk tampilan cetak (tanpa `solutions`).

---

## 8. Kepatuhan CONSTRAINTS & Dokumen

### 8.1 Status gerbang mutu (dijalankan saat audit)

| Perintah | Hasil | Catatan |
|---|:---:|---|
| `pnpm typecheck` | **EXIT 0** | terverifikasi 2026-10-17 |
| `pnpm test` | **1 gagal / 966 lulus (90 file)** | lihat di bawah |
| `pnpm lint:names` | **EXIT 1** | lihat di bawah |
| `pnpm build` | *tidak dijalankan dalam audit ini* | **belum diverifikasi** |
| `pnpm test:db`, `pnpm db:verify` | *tidak dijalankan* | butuh PostgreSQL; **belum diverifikasi** |

**`pnpm test` gagal pada `src/lib/telemetry/check-names.test.ts`** karena
`scripts/dev/*.ts` memakai nama berkas berbahasa Indonesia (`cari-*.ts`,
`lihat-soal.ts`, `hapus-*.ts`, `daftar-paket.ts`, … ±50 file). Ini pelanggaran
**CONSTRAINTS #28b** yang **belum dibereskan** dan membuat gerbang `pnpm check` merah —
bukan masalah performa, tetapi menghalangi verifikasi "hijau" apa pun.

### 8.2 Koreksi klaim audit sebelumnya (kejujuran §7 AGENTS.md)

| Klaim audit sebelumnya | Status setelah verifikasi | Bukti |
|---|:---:|---|
| "Snapshot tabel topik pada **setiap** halaman paginasi soal" | ❌ **Berlebihan** | Paginasi soal di klien; `useQuestions` memakai `placeholderData`; `buildQuestionFilter` hanya saat filter berubah (`question-bank-view` → `useQuestions(filter)`). Biaya tetap ada saat filter berubah → PERF-09. |
| "`EXISTS` ditulis sebagai string SQL → parameter bound salah" | ✅ **Bukan bug** | `PgDialect.sqlToQuery` → `FROM "question_topics" … "questions"."id"` (§7.1 E-1). |
| "Prefetch Next.js dimatikan oleh `X-DNS-Prefetch-Control`" | ❌ **Salah konsep** | Header hanya mengatur DNS prefetch peramban; lihat PERF-14. |
| "Partial HNSW `WHERE question_id IN (SELECT…)`" | ❌ **Tidak valid di PostgreSQL** | Predikat index harus IMMUTABLE; lihat catatan PERF-10. |
| "`getQuestion` = 5 query" | ⚠️ **Kurang** | 6 query bila viewer berwenang & ada parent (opsi, bundles, topics, solutions, parent). Lihat PERF-02. |

### 8.3 Kepatuhan CONSTRAINTS yang tersentuh audit ini

| Butir | Status | Keterangan |
|---|:---:|---|
| #6 no `useMemo`/`useCallback` | ✅ | `grep` nol di kode kita. |
| #7 no `space-y-*` | ✅ | tak ditemukan. |
| #19 tak ada kode mati | ⚠️ | `useAllBundles`, `prune()` (§5), `collectTopicDescendants` (kompatibilitas tes), `aiEnrichBatchSchema` tak dipakai route. |
| #22 Zod di boundary | ✅ | semua route memakai skema; `/img` memvalidasi `isValidShortId` sebelum DB. |
| #33 rate limit mutasi/daftar | ✅ | diverifikasi per route; `/health`, `/ready`, `/metrics` sengaja tanpa wrapRoute (observabilitas) — `/api/metrics` dilindungi token + 404 di prod. |
| #34 proyeksi kolom jalur baca | ✅ | `questionColumns`/`optionColumns` dipakai; `getQuestionInternal` `SELECT *` adalah **jalur internal**, tidak dikirim ke klien — tetap disarankan diproyeksikan (PERF-10). |
| #36 CAS transisi status | ✅ | `WHERE id AND status = from` + `RETURNING` → 409. Dipertahankan dalam usulan batch PERF-02. |
| #41 `"use cache"` hanya data boleh basi | ✅ | tak ada pemakaian; ETag usulan (PERF-04) *revalidate*, bukan cache mutasi. |
| `docs/PERFORMA.md` §6 | ⚠️ | menyebut *"`next.config.ts` masih kosong"* — **sudah tidak benar** (147 baris, `headers()`, `distDir`, `allowedDevOrigins`). Dokumen perlu diperbarui. |
| `docs/PERFORMA.md` §3.3 | ⚠️ | menyebut "React Compiler menangani" memo — padahal compiler **belum aktif** (CONSTRAINTS #6 sudah mengoreksi ini; dokumen PERFORMA belum). |

### 8.4 Kesimpulan kepatuhan terhadap anggaran performa

Anggaran di `docs/PERFORMA.md` §2 **belum dapat dinilai** karena tidak ada pengukuran.
Yang bisa dikatakan: PERF-01 & PERF-02 **berpotensi** melanggar **TTFB ≤ 500 ms** dan
**API p95 ≤ 300 ms** pada korpus realistis (ratusan paket / batch kurasi), dan PERF-05
**berpotensi** melanggar **CLS ≤ 0,1**. Tidak ada angka yang diklaim terukur.

---

## 9. Rekomendasi Prioritas

| # | Prioritas | Temuan | Perkiraan upaya | Dampak |
|---|---|---|---|---|
| 1 | **P0** | PERF-01 paginasi server `/bundles` | 0,5–1 hari | roundtrip N→1, payload ↓ |
| 2 | **P0** | PERF-02 batch CAS + `returnUpdated:false` | 1–2 hari | ~2.000→~5 query; proteksi pool |
| 3 | **P1** | PERF-04 ETag/304 + PERF-12 stream media | 0,5 hari | bandwidth ↓, TTFB gambar stabil |
| 4 | **P1** | PERF-05 dimensi gambar | 1 hari | CLS ↓ (target ≤ 0,1) |
| 5 | **P1** | PERF-06 normalisasi label metrik | 0,5 hari | heap stabil |
| 6 | **P2** | PERF-03 + PERF-08 batch embedding/enrich | 1 hari | waktu batch ÷5–10 |
| 7 | **P2** | PERF-09 `WITH RECURSIVE` | 0,5 hari | query filter konstan |
| 8 | **P2** | PERF-15 cache token MathContent | 0,5 hari | INP daftar soal |
| 9 | **P3** | PERF-16 fetcher tunggal, PERF-17 gabung validasi, PERF-07 placeholderData, PERF-10 proyeksi, PERF-13 preload font, PERF-11 prune | 1–2 hari total | kebersihan & konsistensi |
| 10 | **Gerbang** | Perbaiki nama `scripts/dev/*` (#28b) + perbarui `docs/PERFORMA.md` | 0,5 hari | `pnpm check` bisa hijau |

**Langkah nol yang disarankan sebelum optimasi apa pun:** terekamnya **baseline
terukur** (Lighthouse di build produksi untuk 5 halaman terpenting + `EXPLAIN ANALYZE`
untuk `listBundles`, `listQuestions({q})`, `findNearDuplicates`, `bulkQuestionAction`).
Tanpa baseline, "perbaikan" tidak dapat dibuktikan.

---

## 10. Praktik Baik yang Ditemukan (pertahankan)

1. **`mathHtmlCache` LRU** (`math-content.tsx:39-65`) — 2.000 entri, O(1) amortized.
2. **`React.memo` selektif** `question-card.tsx:481-523`.
3. **Batch anti-N+1**: `attachOptions` (`question-read.ts:290-326`), `attachCounts`
   (`bundle-query.ts:43-60`), opsi item paket (`bundle-query.ts:155-177`).
4. **Semi-join `EXISTS`** untuk filter taksonomi/tag — SQL terverifikasi benar (§7.1).
5. **`useQuestions` `placeholderData` + `staleTime` berjenjang** (`use-questions.ts:59-60`).
6. **Indeks:** `idx_bundles_deleted_updated`, `idx_bundles_type/origin`,
   `idx_questions_grade_diff_status`, GIN trigram `content_markdown` & `topics.name`,
   HNSW embedding. Konsisten dengan pola filter.
7. **`Promise.all`** di `listBundles` (COUNT & page) dan `/api/stats` (10 agregat paralel).
8. **`wrapRoute`** sebagai satu titik telemetri + rate limit + idempotensi + format galat.
9. **`middleware`-like `proxy.ts`** membuang header CSP kiriman klien (tidak relevan performa,
   tetapi benar).
10. **`useSyncExternalStore`** di `use-mobile.ts` — tanpa layout thrash / setState di effect.

---

## Lampiran 7.1 — Bukti Teknis

### E-1 — Kompilasi SQL filter (`PgDialect`)

Skrip uji sementara (sudah dihapus) menghasilkan:

```
TOPIC+TAG: … and EXISTS ( SELECT 1 FROM "question_topics"
  WHERE "question_topics"."question_id" = "questions"."id"
    AND "question_topics"."topic_id" in ($1, $2) )
  and EXISTS ( SELECT 1 FROM "question_tags" … )
PARAMS=["…uuid1","…uuid2","b"]

SOURCE: … EXISTS ( SELECT 1 FROM bundle_items bi JOIN bundles b ON b.id = bi.bundle_id
  WHERE bi.question_id = "questions"."id" AND b.deleted_at IS NULL AND b.source_id = $1 )
```

→ Nama tabel/kolom **di-inline** oleh Drizzle; hanya nilai yang menjadi parameter.
Ekspresi aman.

### E-2 — Rantai query PERF-02

`question-bulk.ts:56` → `changeQuestionStatus` → `getQuestionInternal` (2) →
`UPDATE` (1) → `recordAudit` (1) → `getQuestion` (1+1+1+1+1[+1 parent]+1 solutions) = **10**.
`question-bulk.ts` membuang hasil (`await changeQuestionStatus(...)` tanpa assignment).

### E-3 — Penyimpanan gambar PERF-12

`readFile(abs)` → `Buffer` penuh; `new Uint8Array(bytes)` → salinan. Terdapat dua
alokasi ukuran berkas penuh per permintaan.

---

## Lampiran 8 — Catatan Verifikasi (CONSTRAINTS #44)

- **Verifikator:** auditor performa (statis), 2026-10-17.
- **Metode:** pembacaan kode jalur nyata; kompilasi `sql` Drizzle via `PgDialect`
  (E-1); `grep` terarah untuk dead code (`prune`, `useAllBundles`, fetcher duplikat);
  inspeksi `next.config.ts`, `layout.tsx`, CSS KaTeX, dan artefak `.next/static`;
  menjalankan `pnpm typecheck` (0) dan `pnpm test` (1 gagal: `check-names`).
- **Yang terverifikasi benar:**
  - ✅ Tidak ada `useMemo`/`useCallback` di kode proyek; tidak ada `space-y-*`.
  - ✅ Paginasi server-side paket & soal sudah tersedia dan benar.
  - ✅ `EXISTS` filter topik/tag/sumber valid di PostgreSQL.
  - ✅ Penjagaan CAS status (`#36`) & proyeksi kolom (`#34`).
  - ✅ Implementasi rate-limit store `prune()` **ada tetapi tidak dipanggil**.
  - ✅ Metrik route memakai pathname mentah (high cardinality).
- **Koreksi (lihat §8.2):** klaim "snapshot topik per halaman paginasi" berlebihan;
  klaim "EXISTS parameter bound salah" gugur; "prefetch Next.js dimatikan" salah
  konsep; "partial HNSW dengan subquery" tak valid di PostgreSQL; "9 query per soal"
  kurang (10).
- **Belum diverifikasi (jujur):** CWV/RUM (tak ada alat), `pnpm build`,
  `pnpm test:db`, `pnpm db:verify`, `EXPLAIN ANALYZE` nyata, ukuran bundle.
- **Kode aplikasi:** tidak diubah. Satu-satunya berkas baru = dokumen ini.
- **Registrasi dokumen:** wajib ditambahkan ke `docs/PETA-DOKUMEN.md` (#31) —
  **belum dilakukan** dalam audit ini.

---

*Laporan ini disusun agar setiap temuan dapat direproduksi ulang atau dibantah dengan
bukti; angka yang tidak diukur tidak diberi angka.*
