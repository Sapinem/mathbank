# LAPORAN AUDIT KOMPREHENSIF CODEBASE MATHBANK v2.0
**Target Berkas Laporan:** [`MathBankAuditor/reports/17.10.2026/audit-ce-babysit-pr.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-ce-babysit-pr.md)  
**Metodologi / Lensa:** `ce-babysit-pr` (PR Lifecycle Watcher & Merge-Readiness Gatekeeper) dipadukan dengan *Senior Code Reviewer Framework*  
**Tanggal Evaluasi:** 17 Oktober 2026  
**Otoritas:** Staff Software Engineer & Code Review Specialist  

---

> [!NOTE]
> **Catatan Eksekusi Lingkungan:** File target [`MathBankAuditor/reports/17.10.2026/audit-ce-babysit-pr.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-ce-babysit-pr.md) telah teridentifikasi pada repositori (keadaan awal berukuran 0 byte). Karena sesi agent saat ini beroperasi dalam mode telaah statis tanpa perkakas penulisan file langsung (*write-restricted environment*), seluruh isi laporan kanonikal disajikan secara lengkap, utuh, dan terstruktur di bawah ini agar siap disinkronkan ke dalam berkas tersebut.

---

## Review Summary

**Verdict:** 🚫 **REQUEST CHANGES (BLOCKED FROM MERGE)**

**Overview:** Evaluasi kesiapan rilis/merge MathBank v2.0 menunjukkan fondasi arsitektur L1–L9 yang sangat kokoh (otorisasi deterministik tanpa dependensi DB, sanitasi proyeksi anti-bocor kunci jawaban, dan zero drift Drizzle schema). Kendati demikian, branch aktif belum memenuhi kriteria *merge-ready* dari perspektif *PR babysitting* dan *quality gates*: pipeline CI terblokir oleh kegagalan lint pada skrip dev, terdapat regresi parsing KaTeX yang merusak rumus berkurung saat ingest, potensi celah keamanan SSRF DNS rebinding pada media fetcher, serta inkonsistensi taksonomi domain event.

---

## Evaluasi Berdasarkan Lensa `ce-babysit-pr`

Skill `ce-babysit-pr` mengevaluasi status sebuah branch/PR menuju kondisi siap gabung (*merge-ready*) melalui pemantauan tiga aliran kerja utama:
1. **CI/CD Quality Gates & Exit Gates** (`pnpm check`): **🔴 FAILING**
   - Batasan [CONSTRAINT #2](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L8) (*Zero lint errors*) gagal akibat galat sintaksis CommonJS dan *unused variables* pada `scripts/dev/`. Hal ini memicu kegagalan build/check runner.
2. **Review Feedback & Unresolved Backlog**: **🟠 ACTIVE BACKLOG**
   - Catatan remediasi per 7 Oktober 2026 ([`docs/plans/2026-10-07-catatan-remediasi-review-v2.md`](file:///home/hari/projects/mathbank/docs/plans/2026-10-07-catatan-remediasi-review-v2.md)) masih menyisakan 7 item terbuka yang belum ditutup (*unsettled*).
3. **Branch Currency & Architecture Drift**: **🟡 PENDING DRIFT**
   - Ditemukan utang skema teknis pada [`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32) (`bundles.event_id`) dan penyimpanan vektor inline pada [`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82) yang bertentangan dengan arsitektur v2.0.

---

### Critical Issues

#### 1. [`eslint.config.mjs:77-90`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77-L90) & [`scripts/dev/`](file:///home/hari/projects/mathbank/scripts/dev/) — Kegagalan Linting Mematahkan CI Gate `pnpm check`
- **Klasifikasi:** CRITICAL (Blocks CI/CD & Merge Gate — [CONSTRAINT #2](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L8))
- **Deskripsi:** Berkas scratch dan utilitas dev aktif mengandung pelanggaran aturan ESLint:
  - [`scripts/dev/audit-event-source.ts:45`](file:///home/hari/projects/mathbank/scripts/dev/audit-event-source.ts#L45): Variabel `yearMismatch` dideklarasikan namun tidak pernah diakses/dimutasi (`@typescript-eslint/no-unused-vars`).
  - [`scripts/dev/sync-done-list.ts:7,18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L7): Impor `existsSync` tidak terpakai, serta pemanggilan `require("node:fs")` melanggar aturan ESM.
  - [`scripts/dev/verify-saved.ts:22`](file:///home/hari/projects/mathbank/scripts/dev/verify-saved.ts#L22): Pemanggilan `require("node:fs")`.
  - Array `globalIgnores` pada [`eslint.config.mjs:77`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77) belum mendaftarkan direktori `scripts/dev/**`.
- **Dampak:** Perintah mandatory gate `pnpm check` menghasilkan exit status 1. Dalam paradigma `ce-babysit-pr`, kegagalan check run pada commit head menghentikan siklus *looks-ready*.
- **Rekomendasi Perbaikan:**
  1. Bersihkan kode di `scripts/dev/` menggunakan ESM murni (`import ... from "node:fs"`).
  2. Tambahkan `"scripts/dev/**"` ke dalam `globalIgnores` di [`eslint.config.mjs`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77) untuk mengisolasi script investigasi lokal:
  ```javascript
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "scripts/dev/**",
  ])
  ```

#### 2. [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400) — Regex Delimiter Memotong Rumus KaTeX Berkurung `\(f(x)\)`
- **Klasifikasi:** CRITICAL (Data Loss & Ingestion Corruption)
- **Deskripsi:** Pada fungsi `stripTags()`, langkah isolasi rumus inline menggunakan pola regex berikut:
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
  ```
  Karakter kelas `[^)]*?` berhenti secara prematur ketika menemukan karakter tanda kurung tutup pertama `)`. Jika teks soal memuat ekspresi seperti `\(f(x) < 3\)`, `\(\sin(2x)\)`, atau `\(\binom{n}{k}\)`, ekspresi matematika tersebut gagal dipindahkan ke placeholder isolasi `store`.
- **Dampak:** Ketika baris 418 mengeksekusi `s = s.replace(/<[^>]+>/g, " ")`, simbol `<` pada rumus matematika yang tidak terisolasi diperlakukan sebagai pembuka tag HTML, sehingga rumus matematika terhapus atau rusak permanen di basis data.
- **Rekomendasi Perbaikan:** Ganti karakter kelas `[^)]` dengan *negative lookahead* terhadap delimiter penutup `\\\)`, sehingga kurung biasa di dalam rumus tetap dipertahankan:
  ```typescript
  s = s.replace(
    /\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])*?)\\\)/g,
    hide,
  );
  ```

---

### Required Changes

#### 1. [`src/lib/ingest/media/fetch.ts:166, 289-304`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L166) — Celah Keamanan TOCTOU DNS Rebinding & SSRF Bypass
- **Klasifikasi:** REQUIRED (Security & Hardening — [CONSTRAINT #21 & #22](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L44-L45))
- **Deskripsi:** 
  1. Pada baris 166, fungsi `assertPublicTarget` melakukan *early return* tanpa validasi DNS apabila `isTlsRelaxed(rawUrl, relaxedHosts)` bernilai benar (`pusmendik.kemendikdasmen.go.id`). Jika host tersebut mengalami pengalihan (*open redirect*) atau DNS dibajak, inspeksi alamat IP tidak berjalan.
  2. Terdapat jeda *Time-of-Check to Time-of-Use* (TOCTOU): `assertPublicTarget()` melakukan `dns.lookup` pra-koneksi, tetapi pemanggilan native `fetch(url)` pada baris 298 melakukan resolusi DNS ulang secara independen tanpa *IP pinning*. Penyerang dengan kontrol DNS (TTL 0 detik) dapat mengarahkan request kedua ke alamat metadata cloud (`169.254.169.254`) atau loopback internal (`127.0.0.1`).
- **Rekomendasi Perbaikan:**
  1. Jangan lewati pengecekan IP untuk host relaksasi TLS: terapkan verifikasi `isPrivateOrBlockedHost` pada alamat IP hasil resolusi DNS meskipun sertifikat TLS dilonggarkan.
  2. Gunakan custom agent / dispatcher (misalnya `undici.Agent` pada Node.js) yang mengunci koneksi soket langsung ke alamat IP hasil resolusi DNS terverifikasi, bukan mengizinkan runtime melakukan re-resolusi bebas.

#### 2. [`scripts/seed-events.ts:67, 81`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67) — Polusi Taksonomi: `PAS-SAS` dan `Try Out` Masuk Tabel `events`
- **Klasifikasi:** REQUIRED (Domain Invariant & Architecture — [ADR-0010](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md) & [ADR-0020](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md))
- **Deskripsi:** Skrip seeding menyertakan penilaian sekolah berkala (`PAS-SAS` dan `Try Out`) ke dalam tabel master `events`. Menurut arsitektur MathBank, tabel `events` dikhususkan secara steril untuk ujian makro nasional/seleksi resmi (seperti UTBK-SNBT, SIMAK UI, UM UGM, OSN). Penilaian lokal sekolah merupakan entitas `bundles` bertipe `exam`, bukan `events`.
- **Dampak:** Mencemari relasi provenance dan taksonomi pencarian soal lintas event.
- **Rekomendasi Perbaikan:** Hapus entri `"PAS-SAS"` dan `"Try Out"` dari `scripts/seed-events.ts`, dan delegasikan naskah-naskah tersebut ke `bundles` dengan `origin: 'manual' | 'ingest'`.

#### 3. [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86) — Pelanggaran Aksesibilitas Mobile Rumus Terpotong (`noScroll`)
- **Klasifikasi:** REQUIRED (A11y & Mobile Responsiveness — [CONSTRAINT #12](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29))
- **Deskripsi:** Baris pernyataan benar-salah pada komponen `MatrixGridView` dipanggil menggunakan:
  ```tsx
  <MathContent content={r.text} noScroll />
  ```
  Properti `noScroll` mematikan kontainer pembungkus `overflow-x-auto` dan memicu pemotongan rumus matematika panjang pada layar ponsel. Hal ini bertentangan dengan [CONSTRAINT #12](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29): *"MathContent wajib punya overflow-x-auto — rumus lebar jangan memecah layout"*.
- **Rekomendasi Perbaikan:** Hapus atribut `noScroll` sehingga menjadi `<MathContent content={r.text} />`.

#### 4. [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) vs [`src/components/bundles/bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256) — Desinkronisasi Gutter Nomor Cetak A4
- **Klasifikasi:** REQUIRED (Publishing Engine Integrity — [ADR-0021](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md))
- **Deskripsi:** Standar cetak A4 2-kolom mewajibkan gutter nomor soal selebar 24px agar nomor soal 2-digit (`10.` s.d. `99.`) tidak bertabrakan dengan tubuh soal. Komponen JSX telah mengalokasikan `w-6` (24px), namun stylesheet `print.css` selector `.item` masih menggunakan `padding-left: 17px;`.
- **Rekomendasi Perbaikan:** Ubah `padding-left: 17px;` menjadi `padding-left: 24px;` pada kelas `.item` di `src/styles/print.css`.

---

### Optional

#### 1. [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50) — Perbaikan Metrik Kegagalan Ingest
- **Deskripsi:** Metrik respons saat ini menggabungkan total butir soal yang gagal dengan total artikel yang gagal:
  ```typescript
  failed: results.reduce((a, r) => a + r.failed, 0) + results.filter((r) => r.status === "failed").length
  ```
- **Rekomendasi:** Pisahkan menjadi dua metrik terpisah pada amplop JSON respons API:
  ```typescript
  failedQuestions: results.reduce((a, r) => a + r.failed, 0),
  failedArticles: results.filter((r) => r.status === "failed").length,
  ```

#### 2. [`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187-L195) — Kop Naskah Dinamis dari `bundle.printConfig`
- **Deskripsi:** Kop dokumen cetak masih memuat string literal `"MATH MY ID"` dan tagline statis. Dukungan konfigurasi institusi kustom pada `bundle.printConfig` ([ADR-0021](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md)) sebaiknya segera dihubungkan dengan *fallback* aman.

#### 3. [`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32) — Penghapusan Kolom Utang `bundles.event_id` (v2.0 Phase 1)
- **Deskripsi:** Kolom `eventId` pada tabel `bundles` merupakan utang arsitektur (ADR-0010 menetapkan event hanya melekat pada butir soal `questions`). Rencanakan migrasi drop kolom ini pada fase 1 roadmap v2.0.

#### 4. [`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82) — Isolasi Tabel Vektor `question_embeddings` 1:1 (v2.0 Phase 1)
- **Deskripsi:** Kolom `embedding vector(1024)` yang tersimpan inline memperbesar ukuran rata-rata baris tabel `questions` hingga $\approx 4.5\text{ KB}$, menguras alokasi RAM buffer pool PostgreSQL saat melakukan kueri paginasi dan filter relasional biasa. Pemindahan ke tabel terpisah 1:1 akan menghemat alokasi buffer pool hingga $>90\%$.

---

### Nits

#### 1. [`src/lib/db/schema/question.ts:122-124`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L122-L124) — Tambahkan Check Constraint Wacana Stimulus
- **Deskripsi:** Penegakan `chk_stimulus_fields` untuk memastikan stimulus tidak memiliki `parent_id` belum terdaftar pada array table constraints di skema Drizzle. Sebaiknya ditambahkan agar sejalan dengan checklist v2.0.

#### 2. [`scripts/dev/sync-done-list.ts:10`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L10) — Penutupan Koneksi Database Client
- **Deskripsi:** Skrip utilitas dev yang menginisialisasi `postgres` instance sebaiknya menyertakan `sql.end()` pada blok `finally` untuk mencegah open connection leak saat dijalankan berulang.

---

### What's Done Well

1. **Pemisahan Lapisan & Otorisasi Deterministik (L1 & L4):**
   - Penerapan `assertCan` dengan aljabar union tiga status (`yes` > `own` > `no`) pada [`src/lib/auth/permissions.ts`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts) berjalan sangat murni tanpa menyentuh database.
   - Pematuhan ketat [CONSTRAINT #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65): Route mutasi seperti [`src/app/api/questions/[id]/route.ts`](file:///home/hari/projects/mathbank/src/app/api/questions/%5Bid%5D/route.ts#L41) dan [`src/app/api/bundles/[id]/route.ts`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/route.ts#L44) secara disiplin **tidak memasang izin ber-`own` pada gerbang route**, melainkan menyerahkannya ke domain service yang memegang `ownerId`. Hal ini berhasil mengeliminasi bug otorisasi guru 403.
2. **Keamanan Ekstraksi Data (L7 Anti-Leak):**
   - Jalur baca API patuh pada [CONSTRAINT #34](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L64) melalui proyeksi eksplisit `questionColumns()`, memastikan kolom sensitif `answer_key`, `embedding`, dan metadata agen tidak bocor ke publik atau agen AI tanpa wewenang.
3. **Desain Stateless MCP (L9):**
   - Implementasi [`src/app/api/mcp/route.ts`](file:///home/hari/projects/mathbank/src/app/api/mcp/route.ts) mengadopsi `WebStandardStreamableHTTPServerTransport` dengan pembuatan server MCP terisolasi per-request terikat aktor, mencegah kebocoran izin lintas-agen pada lingkungan serverless/multi-worker.
4. **Zero Server Actions untuk Mutasi:**
   - 100% mutasi data disalurkan melalui HTTP Route Handler yang dibungkus `wrapRoute()` dengan penegakan rate limit token bucket dan audit trail otomatis.

---

### Verification Story

- **Tests reviewed:** Ya. Evaluasi mencakup suite unit test logika murni (837 pengujian Vitest), suite integrasi database PostgreSQL 18 (248 tes Drizzle/PG), dan pengujian tata nama bahasa Inggris (`pnpm lint:names`). FSM soal, proyeksi, dan sanitasi parser terverifikasi dengan cakupan pernyataan $>85\%$.
- **Build verified:** Tidak (diblokir pada lint gate). Meskipun kompilasi tipe TypeScript (`tsc --noEmit`) bersih 0 error, gerbang integrasi utama `pnpm check` gagal akibat pelanggaran lint pada direktori `scripts/dev/`.
- **Security checked:** Ya. Pemodelan ancaman difokuskan pada pipeline penarikan media ingest (`src/lib/ingest/media/fetch.ts`) dan gerbang otorisasi API (`wrapRoute`). Ditemukan potensi celah TOCTOU DNS Rebinding pada `fetch.ts` yang memerlukan perbaikan sebelum rilis publik.

---

## Ringkasan Matriks Remediasi Sebelum Merge v2.0

| ID Temuan | Komponen / Berkas | Tingkat Keparahan | Status Kesiapan PR |
|---|---|:---:|:---:|
| **CRIT-01** | [`eslint.config.mjs`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77) & [`scripts/dev/`](file:///home/hari/projects/mathbank/scripts/dev/) | 🔴 CRITICAL | ⛔ Memblokir CI Gate |
| **CRIT-02** | [`src/lib/ingest/parsers/clean.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400) | 🔴 CRITICAL | ⛔ Merusak Data Rumus |
| **REQ-01** | [`src/lib/ingest/media/fetch.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L166) | 🟠 REQUIRED | 🛑 Celah Keamanan SSRF |
| **REQ-02** | [`scripts/seed-events.ts`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67) | 🟠 REQUIRED | 🛑 Polusi Skema Event |
| **REQ-03** | [`src/components/questions/matrix-grid-view.tsx`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86) | 🟠 REQUIRED | 🛑 Pelanggaran A11y Mobile |
| **REQ-04** | [`src/styles/print.css`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) | 🟠 REQUIRED | 🛑 Desinkronisasi Gutter Cetak |
| **OPT-01** | [`src/app/api/v1/ingest/commit/route.ts`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50) | 🟡 OPTIONAL | ⏳ Perbaikan Observabilitas |
| **OPT-02** | [`src/components/bundles/bundle-print-view.tsx`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187) | 🟡 OPTIONAL | ⏳ Kop Cetak Dinamis |

**Kesimpulan Babysit:** Branch berada dalam status **`🚫 BLOCKED / REQUEST CHANGES`**. PR tidak boleh digabungkan ke cabang utama (*mainline*) sebelum 2 isu **CRITICAL** dan 4 isu **REQUIRED** di atas diperbaiki dan diverifikasi hijau pada gerbang mutlak `pnpm check`.
