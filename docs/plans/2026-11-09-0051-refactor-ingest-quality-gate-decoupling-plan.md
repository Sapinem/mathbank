---
title: Pemisahan Adapter Sumber dan Ingest Quality Gate - Plan
type: refactor
date: '2026-11-09'
topic: ingest-quality-gate-decoupling
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

## Goal Capsule

- **Objective:** Memastikan core API MathBank hanya beroperasi sebagai gerbang penjamin mutu (quality gate), deduplikasi, dan persistensi soal berformat kanonik, membebaskan core engine aplikasi dari beban pemeliharaan parser HTML spesifik sumber pihak ketiga.
- **Means:** Membangun endpoint gateway berbasis skema kanonik di core API serta memindahkan parser dan adapter per-sumber ke skrip CLI mandiri di `scripts/ingest/sources/*` (KTD1, KTD2, KTD4).
- **Product Authority:** Mengatur batas arsitektural dan alur ingest soal MathBank; tidak mengubah skema tabel soal utama (`questions`) atau alur telaah kurasi.
- **Open Blockers:** Tidak ada.

---

## Product Contract

### Summary

Proposal pemisahan tanggung jawab arsitektural pada sistem ingest MathBank: Core API bertransformasi menjadi Quality Gate murni yang hanya menerima payload JSON berformat kanonik MathBank, sedangkan parsing HTML mentah, penanganan layout blog, dan adapter spesifik sumber dipindahkan ke skrip CLI mandiri.

### Problem Frame

Saat ini, `src/lib/ingest/parsers/adapters/*` menyatukan parser HTML untuk MathCyber1997, Defantri, M4thlab, dan Pusmendik ke dalam runtime core aplikasi web. Ketika struktur HTML sumber eksternal berubah atau anomali baru ditemukan, seluruh core codebase harus diperbarui, diuji, dan di-deploy ulang. Selain itu, antrean database (`ingest_queue`) menampung konten HTML mentah berukuran besar yang membebani storage dan backup, padahal mandat utama MathBank adalah menyediakan bank soal berkualitas tinggi dengan invarian ketat.

### Key Decisions

- **Pemisahan Gateway Kanonik vs Adapter Sumber:** Core API hanya melayani penerimaan payload berformat kanonik MathBank. Seluruh logika ekstraksi dokumen mentah (HTML/DOM traversal) dipindahkan ke skrip di luar core runtime (`scripts/ingest/sources/*`). (session-settled: user-directed — chosen over Migrasi Bertahap & Isolasi Total di Luar App: menjaga core runtime bebas dari anomali parsing pihak ketiga). Governs R1, R5.
- **Penolakan Langsung Butir Cacat pada Gateway:** Soal yang tidak memenuhi standar mutu (KaTeX invalid, opsi < 2, dsb.) ditolak langsung dari database core tanpa disimpan di tabel penampung sampah internal; gateway mengembalikan laporan penolakan terstruktur per-butir (pada HTTP 200 summary untuk batch campuran, atau HTTP 422 jika request body malformed) sehingga skrip pengirim dapat memilah dan mengelola file dead-letter log lokal secara mandiri. (session-settled: user-directed — chosen over Simpan ke Dead-Letter Table: mencegah pencemaran database core dengan data sampah). Governs R2, R3, R7.
- **Depresiasi Bertahap Endpoint Raw Ingest:** Endpoint lama (`/api/ingest/upload` dan `/api/ingest/commit` berbasis rawHtml) didepresiasi setelah endpoint kanonik beroperasi stabil. Governs R8.

### Requirements

#### Gateway Kontrak Kanonik

- R1. Core API menyediakan endpoint batch ingest kanonik (`POST /api/ingest/questions`) yang menerima array soal dalam format JSON standar MathBank.
- R2. Setiap butir soal divalidasi secara ketat terhadap invarian mutu: schema Zod (`questionDataPayloadSchema`), kelengkapan kunci jawaban (`answerKeySchema`), dan keabsahan sintaks KaTeX (`validateKatexContract`).
- R3. Gateway mengembalikan laporan hasil ingest yang memisahkan jumlah butir tersimpan (`created`, `linked`) dan daftar butir ditolak (`rejected`) beserta indeks, preview stem, dan pesan kegagalan spesifik.
- R4. Gateway mempertahankan mekanisme deduplikasi konten berbasis hash (`sha256(contentHash)`) dan pencatatan provenance sumber (`question_sources`).

#### Ekstraksi & Adapter Sumber Mandiri

- R5. Logika adapter per-sumber dipindahkan dari `src/lib/ingest/parsers/adapters/` ke modul skrip CLI terpisah di `scripts/ingest/sources/`.
- R6. Skrip sumber bertugas membaca korpus mentah, membedah soal menjadi format kanonik, menangani unduhan/pemetaan aset media, dan mengirimkannya ke endpoint kanonik API.
- R7. Skrip sumber mengelola penyimpanan berkas log lokal untuk butir yang ditolak gateway (local dead-letter log) guna mempermudah iterasi parser tanpa membebani database.

#### Depresiasi & Transisi

- R8. Endpoint ingest berbasis raw HTML lama (`/api/ingest/upload` dan `/api/ingest/commit`) diberi status deprecated dengan masa transisi yang jelas sebelum antrean `ingest_queue` dipensiunkan.

### Key Flows

- F1. Alur Ingest Korpus Melalui Skrip Mandiri
  - **Trigger:** Operator menjalankan skrip ingest per-sumber melalui CLI (misal: `pnpm tsx scripts/ingest/sources/mathcyber.ts`).
  - **Actors:** Operator / Runner Skrip, Gateway API MathBank.
  - **Steps:**
    1. Skrip membaca data mentah dari direktori korpus.
    2. Adapter spesifik sumber membedah HTML menjadi array butir soal berformat kanonik.
    3. Skrip memanggil `POST /api/ingest/questions` mengirimkan batch soal kanonik.
    4. Gateway memvalidasi setiap butir: butir valid disimpan dengan status `draft` (atau dihubungkan ke sumber jika duplikat); butir cacat dimasukkan ke daftar `rejected`.
    5. Skrip menerima laporan respons, mencetak ringkasan ke terminal, dan menyimpan butir `rejected` ke file log lokal.
  - **Covered by:** R1, R2, R3, R4, R6, R7.

### Acceptance Examples

- AE1. Penolakan Butir Cacat KaTeX pada Gateway
  - **Covers R2, R3.**
  - **Given:** Skrip mengirim batch 10 butir soal kanonik, di mana 1 butir memiliki rumus KaTeX tidak lengkap (misal `\frac{1}{` tanpa penutup).
  - **When:** Skrip memanggil `POST /api/ingest/questions`.
  - **Then:** Respons API mengembalikan 9 butir tersimpan (`created`/`linked`) dan 1 butir di array `rejected` dengan alasan galat KaTeX, tanpa ada baris parsial yang masuk ke database.
- AE2. Deduplikasi Lintas-Sumber
  - **Covers R4.**
  - **Given:** Soal dengan teks dan pilihan jawaban identik telah tersimpan di MathBank dari sumber A.
  - **When:** Skrip sumber B mengirimkan soal yang sama persis.
  - **Then:** Gateway tidak membuat baris baru di tabel `questions`, melainkan mencatat relasi sumber baru pada tabel `question_sources` dan melaporkannya sebagai `linked`.

### Scope Boundaries

#### Deferred for later

- Pembangunan webhook atau background worker asinkron untuk ingest batch berskala raksasa (>100.000 butir sekaligus).
- Dashboard analitik web untuk memantau status skrip CLI eksternal.

#### Outside this product's identity

- Menyimpan dokumen atau string raw HTML pihak ketiga di dalam tabel database core MathBank.
- Fitur auto-guess atau menebak kunci jawaban yang hilang pada saat validasi gateway (soal tanpa kunci wajib tetap eksplisit atau diflag).

#### Deferred to Follow-Up Work

- Migrasi atau penghapusan permanen tabel `ingest_queue` dari skema Drizzle setelah masa transisi deprecation 90 hari berakhir.

### Sources / Research

- `CONSTRAINTS.md`: Batas mutu mekanis, pengamanan role mesin `question:create` dan integritas transaksi atomic (#29, #35, #36).
- `docs/STRATEGI-INGEST.md`: Kontrak mutu M9 (seluruh soal berstatus `draft`, larangan menebak kunci, deduplikasi `contentHash`).
- `src/lib/ingest/commit.ts`: Implementasi validasi mutu eksisting (`questionDataPayloadSchema`, `validateKatexContract`, pemisahan `rejected` vs `failed`).
- `src/lib/ingest/parsers/adapters/`: Lokasi eksisting adapter yang akan dipindahkan ke skrip mandiri.

---

## Planning Contract

### Key Technical Decisions

- KTD1. Kontrak Schema Zod Kanonik Batch (`canonicalIngestBatchSchema`)
  - **Keputusan:** Menetapkan format JSON kanonik ketat berisi objek `source` (`name`, `url`), `bundle` (`title`, `url`, `grade`), dan array `items` (maksimal 50 butir per batch). Setiap butir mewajibkan `stem`, `type`, `dataPayload`, `answerKey`, dan opsional `explanation`, `warnings`. (session-settled: user-directed — chosen over format HTML mentah: memisahkan parsing teks dari core API). Governs R1, R2.
- KTD2. Quality Gate Service & Atomic Persistence (`ingestCanonicalBatch`)
  - **Keputusan:** Mengevaluasi validitas Zod dan KaTeX per-butir secara in-memory sebelum transaksi DB. Butir cacat dicatat ke array `rejected` (indeks, stemPreview, pesan kesalahan). Butir valid disimpan secara atomik dalam `db.transaction` (membuat atau menautkan bundle, mendeduplikasi via `contentHash`, menyimpan soal `draft`, dan mencatat provenance `question_sources`). (session-settled: user-directed — chosen over dead-letter table di database: menjaga core DB bebas dari residu parsing yang rusak). Governs R2, R3, R4.
- KTD3. Route Kanonik `POST /api/ingest/questions` & Otorisasi
  - **Keputusan:** Menggunakan `wrapRoute` dengan otorisasi `authz: { kind: "route", permission: "question:create" }` (peran `machine` & `admin`), rate limit token-bucket (capacity 30, refill 1/s), dan penanganan `Idempotency-Key` bawaan MathBank. Governs R1.
- KTD4. CLI Scripts Toolkit & Client Ingest di `scripts/ingest/`
  - **Keputusan:** Menyediakan `scripts/ingest/client.ts` sebagai helper pemanggil API MathBank dengan autentikasi API key mesin dan chunking 50 butir, serta memindahkan adapter blog ke `scripts/ingest/sources/{mathcyber,defantri,m4thlab,pusmendik}.ts`. Log penolakan ditulis lokal ke `logs/ingest/<sumber>-rejected-<timestamp>.json`. Governs R5, R6, R7.
- KTD5. Deprecation Header pada Endpoint Raw HTML Eksisting
  - **Keputusan:** Menambahkan header HTTP `Deprecation: true`, `Sunset: Mon, 08 Feb 2027 00:00:00 GMT` (90 hari), dan link successor `</api/ingest/questions>` pada `/api/ingest/upload` dan `/api/ingest/commit` sesuai ADR-0028. Governs R8.

### High-Level Technical Design

```mermaid
flowchart TD
  subgraph CLI["CLI / Scripts Eksternal (scripts/ingest/sources/*)"]
    A[Korpus Mentah: HTML / JSON] --> B[Parser & Adapter Sumber]
    B --> C[Media Ingest: Download & Hash Gambar]
    C --> D[Transformasi ke Payload Kanonik JSON]
    D --> E[Batch Chunker: max 50 items]
    E --> F[HTTP POST /api/ingest/questions]
    K[Simpan Log Lokal: logs/ingest/*.json] <-- Respons Rejected -- F
  end

  subgraph CoreAPI["MathBank Core Engine (API Gateway)"]
    F --> G[wrapRoute: Authz 'machine' + Rate Limit]
    G --> H[Zod Validation: canonicalIngestBatchSchema]
    H --> I[Quality Gate Evaluator]
    I -->|Cacat: KaTeX error / opsi < 2| J[Kumpulkan ke array 'rejected']
    I -->|Lolos Standar Mutu| L[Dedup Checker: sha256 contentHash]
    L -->|Sudah Ada| M[Link Provenance: question_sources]
    L -->|Soal Baru| N[Insert questions status 'draft']
    M --> O[Atomic DB Transaction Commit]
    N --> O
    O --> P[Return HTTP 200/207: Summary Report]
    J --> P
  end
```

### System-Wide Impact

- **Otorisasi & Keamanan:** Route baru memanfaatkan izin `question:create` yang dimiliki peran `machine` dan `admin`. Tidak ada perubahan pada matriks otorisasi pengguna web.
- **Database & Penyimpanan:** Mengurangi beban pertumbuhan tabel `ingest_queue` karena raw HTML raksasa tidak lagi disimpan di database Postgres.
- **Kerapian Core Codebase:** Memutus ketergantungan core runtime Next.js terhadap DOM parsing/regex anomali HTML blog luar.

### Risks & Dependencies

- **Latensi Batch Besar:** Payload 50 butir dengan banyak rumus KaTeX membutuhkan CPU untuk validasi. Mitigasi: chunking dibatasi 50 butir dan timeout disesuaikan.
- **Ketergantungan Aset Media:** Gambar yang belum diunduh lokal akan gagal ditampilkan di MathBank. Mitigasi: skrip CLI wajib mengunggah gambar ke endpoint media MathBank (`/api/media`) atau menempatkannya di volume media bersama sebelum mengirim payload kanonik.

---

## Implementation Units

### U1. Kontrak Zod Kanonik Batch Ingest

- **Goal:** Mendefinisikan schema Zod dan tipe TypeScript untuk payload batch ingest kanonik dan laporan hasil validasi.
- **Requirements:** R1, R2, R3 (KTD1).
- **Dependencies:** Tidak ada.
- **Files:**
  - `src/lib/contracts/ingest-canonical.ts`
  - `src/lib/contracts/ingest-canonical.test.ts`
- **Approach:**
  1. Buat `canonicalQuestionItemSchema` yang memvalidasi setiap butir soal: `type`, `stem`, `dataPayload` (divalidasi dengan `questionDataPayloadSchema`), `answerKey` (divalidasi dengan `answerKeySchema`), `explanation`, `warnings`, `difficulty`, dan metadata stimulus/parent opsional.
  2. Buat `canonicalIngestBatchSchema` berisi objek `source` (`name`, `url`), `bundle` (`title`, `url`, `grade`, `subject`), dan `items` (array butir, min 1, max 50).
  3. Buat `canonicalIngestReportSchema` untuk format balasan: `bundleId`, `totalReceived`, `created`, `linked`, `rejectedCount`, `failures: Array<{ index, stemPreview, reason }>`.
- **Patterns to follow:** `src/lib/contracts/ingest.ts`, `src/lib/validations/question-payload.ts`.
- **Test scenarios:**
  - Happy path: validasi payload lengkap (single choice 5 opsi dengan kunci valid) lolos tanpa error.
  - Edge cases: validasi menolak jika `items` kosong atau melebihi 50 butir.
  - Error paths: validasi menolak item jika opsi mengandung frasa terlarang Haladyna Rule 5 ("semua jawaban benar").
- **Verification:** Unit test Vitest pada `src/lib/contracts/ingest-canonical.test.ts` lulus 100%.

### U2. Quality Gate Evaluator & Service Persistensi Kanonik

- **Goal:** Membangun service layer murni dan database yang memvalidasi invarian mutu (KaTeX, Zod) dan menyimpan soal valid ke database secara atomik.
- **Requirements:** R2, R3, R4 (KTD2).
- **Dependencies:** U1.
- **Files:**
  - `src/lib/services/ingest-gateway-service.ts`
  - `src/lib/services/ingest-gateway-service.test.ts`
  - `src/lib/services/ingest-gateway-service.db.test.ts`
- **Approach:**
  1. Implementasikan fungsi murni `evaluateCanonicalItemQuality(item, index)` yang memeriksa keabsahan sintaks KaTeX (`validateKatexContract`) pada stem, opsi, dan pembahasan, serta memastikan tidak ada pelanggaran invarian CONSTRAINTS #29.
  2. Implementasikan fungsi service `ingestCanonicalBatch(payload, actor)`:
     - Iterasi seluruh butir; pisahkan butir cacat ke dalam daftar `failures`.
     - Untuk butir yang lolos, buka `db.transaction`:
       - Resolve `sourceId` dan buat/resolve `bundleId`.
       - Untuk tiap butir, hitung `contentHash(stem, options)`.
       - Jika match duplikat di DB: tambahkan relasi ke `question_sources` dan `bundle_items`, increment counter `linked`.
       - Jika butir baru: buat soal dengan status `draft` via `createQuestion`, tambahkan relasi ke bundle dan provenance, increment counter `created`.
     - Kembalikan `CanonicalIngestReport`.
- **Execution note:** Tulis unit test untuk validator KaTeX in-memory terlebih dahulu, lalu integrasikan ke database test.
- **Patterns to follow:** `src/lib/ingest/commit.ts`, `src/lib/services/question-service.ts`.
- **Test scenarios:**
  - Covers AE1. Penolakan Butir KaTeX Rusak: Batch 5 butir dengan 1 rumus `\frac{1}{` tanpa kurung tutup menghasilkan `rejectedCount: 1`, `created: 4`, dan kegagalan memuat pesan error spesifik.
  - Covers AE2. Deduplikasi Lintas-Sumber: Butir dengan konten identik dengan soal yang sudah ada dilaporkan sebagai `linked` dan hanya mencatat entri baru di `question_sources`.
  - Error paths: Jika koneksi DB putus di tengah transaksi, seluruh batch yang belum ter-commit di-rollback tanpa partial write.
- **Verification:** Database test `pnpm test:db` pada `src/lib/services/ingest-gateway-service.db.test.ts` lulus.

### U3. Route API Kanonik `POST /api/ingest/questions`

- **Goal:** Mengekspos endpoint HTTP kanonik untuk pemanggilan batch ingest dengan otorisasi, rate limit, dan OpenAPI spec.
- **Requirements:** R1, R3 (KTD3).
- **Dependencies:** U1, U2.
- **Files:**
  - `src/app/api/ingest/questions/route.ts`
  - `src/app/api/ingest/questions/route.test.ts`
- **Approach:**
  1. Buat route handler menggunakan `wrapRoute`:
     - `authz: { kind: "route", permission: "question:create" }`
     - `rateLimit: { capacity: 30, refillPerSec: 1 }`
     - `body: canonicalIngestBatchSchema`
     - `idempotent: true`
     - `status: 200`
  2. Panggil `ingestCanonicalBatch` dan kembalikan laporan hasil.
  3. Daftarkan rute pada konfigurasi lint otorisasi (`pnpm lint:authz`) dan perbarui kontrak OpenAPI (`pnpm openapi:generate`).
- **Patterns to follow:** `src/app/api/ingest/upload/route.ts`, ADR-0022 (`wrapRoute`), ADR-0026 (`authz`).
- **Test scenarios:**
  - Happy path: Request HTTP POST dengan API key machine yang valid mengembalikan 200 OK beserta envelope `{ data: { created: N, ... } }`.
  - Error paths: Request tanpa token/API key mengembalikan 401 Unauthorized; request dengan body JSON invalid mengembalikan 422 Unprocessable Entity.
- **Verification:** Integrasi route test lulus dan `pnpm lint:authz` bersih.

### U4. Pemindahan Adapter Sumber ke Skrip CLI Mandiri

- **Goal:** Memindahkan parser spesifik blog (Defantri, MathCyber, M4thlab, Pusmendik) dari core engine ke skrip CLI mandiri di `scripts/ingest/`.
- **Requirements:** R5, R6, R7 (KTD4).
- **Dependencies:** U3.
- **Files:**
  - `scripts/ingest/client.ts`
  - `scripts/ingest/sources/mathcyber.ts`
  - `scripts/ingest/sources/defantri.ts`
  - `scripts/ingest/sources/m4thlab.ts`
  - `scripts/ingest/sources/pusmendik.ts`
  - Hapus: `src/lib/ingest/parsers/adapters/*` (setelah logika adapter disalin dan disesuaikan di skrip).
- **Approach:**
  1. Bangun `scripts/ingest/client.ts` yang memuat fungsi `sendCanonicalBatch(apiUrl, apiKey, batch)` dengan mekanisme retry dan logging.
  2. Pindahkan logika pembedah HTML spesifik per-sumber ke `scripts/ingest/sources/<source>.ts`. Skrip memetakan hasil parse ke `CanonicalIngestItem` kanonik.
  3. Tambahkan penanganan log penolakan di skrip: respons `rejected` disimpan ke `logs/ingest/<sumber>-rejected-<timestamp>.json` agar operator dapat memperbaiki regex parser tanpa menyentuh core DB.
  4. Bersihkan modul adapter lama dari `src/lib/ingest/parsers/adapters/`.
- **Patterns to follow:** `scripts/ingest-corpus.ts`, `src/lib/ingest/parsers/adapters/index.ts`.
- **Test scenarios:**
  - Happy path: Menjalankan `pnpm tsx scripts/ingest/sources/mathcyber.ts --limit 3` berhasil membaca korpus lokal, membedah 3 artikel, dan mengirimkan payload kanonik ke API lokal.
  - Error paths: Butir yang ditolak gateway otomatis ditulis ke berkas log di direktori `logs/ingest/`.
- **Verification:** Eksekusi skrip uji pada sampel data korpus menghasilkan output JSON terstruktur dan laporan terminal yang jelas.

### U5. Depresiasi Endpoint Raw Ingest & Dokumentasi Transisi

- **Goal:** Menandai endpoint raw ingest lama sebagai deprecated dan mendokumentasikan keputusan arsitektur (ADR).
- **Requirements:** R8 (KTD5).
- **Dependencies:** U3, U4.
- **Files:**
  - `src/app/api/ingest/upload/route.ts`
  - `src/app/api/ingest/commit/route.ts`
  - `docs/ADR/0031-kanonisasi-ingest-dan-depresiasi-queue-mentah.md`
  - `docs/STRATEGI-INGEST.md`
- **Approach:**
  1. Tambahkan header deprecation pada respons `/api/ingest/upload` dan `/api/ingest/commit`: `Deprecation: true`, `Sunset: Mon, 08 Feb 2027 00:00:00 GMT` (90 hari masa transisi), dan link successor ke `</api/ingest/questions>`.
  2. Tulis `docs/ADR/0031-kanonisasi-ingest-dan-depresiasi-queue-mentah.md` yang merangkum alasan pemisahan adapter sumber dan pemusatan quality gate di core.
  3. Perbarui `docs/STRATEGI-INGEST.md` dan `docs/PETA-DOKUMEN.md` untuk mencatat alur ingest kanonik baru.
- **Patterns to follow:** `docs/ADR/0028-cabut-prefix-v1-ingest.md`, `src/lib/api/deprecation.ts`.
- **Test scenarios:**
  - Request ke `POST /api/ingest/upload` mengembalikan header `deprecation: true` dan `sunset`.
- **Verification:** `pnpm lint:authz`, `pnpm openapi:generate`, dan verifikasi header respons via test.

---

## Verification Contract

Pemeriksaan gerbang mutu wajib dijalankan dan diverifikasi hijau:

```bash
pnpm typecheck
pnpm lint
pnpm lint:names
pnpm lint:authz
pnpm openapi:generate
pnpm test
pnpm test:db
pnpm db:verify
pnpm build
```

Ambang mutu khusus:
- Tidak ada regresi pada 1.350+ unit/integration tests eksisting.
- Endpoint baru terdaftar di OpenAPI dan melewati validasi `lint:authz`.
- Coverage tes pada `src/lib/services/ingest-gateway-service.ts` dan `src/app/api/ingest/questions/route.ts` minimal 90%.

---

## Definition of Done

- [ ] Seluruh unit implementasi (U1 hingga U5) selesai dikerjakan dan teruji.
- [ ] Endpoint `POST /api/ingest/questions` beroperasi sesuai schema Zod kanonik dengan validasi KaTeX ketat.
- [ ] Soal cacat ditolak dari database dan dilaporkan dalam array `failures` tanpa mencemari database core.
- [ ] Seluruh adapter sumber lama dipindahkan ke `scripts/ingest/sources/` dan core runtime bersih dari scraping HTML spesifik blog.
- [ ] Header deprecation aktif pada endpoint upload/commit lama.
- [ ] ADR-0031 ditulis dan tercatat di `docs/PETA-DOKUMEN.md`.
- [ ] Seluruh kode eksperimental atau duplikasi telah dibersihkan dari working tree.
- [ ] Seluruh perintah pada Verification Contract dijalankan dan lulus 100%.
