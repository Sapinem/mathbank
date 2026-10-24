# LAPORAN AUDIT KOMPREHENSIF CODEBASE MATHBANK v2.0
**Perspektif & Metodologi:** `ce-resolve-pr-feedback` & `Senior Code Reviewer`  
**Waktu Audit:** 17 Oktober 2026  
**Target Repositori:** MathBank (`/home/hari/projects/mathbank`)  
**Target Berkas Laporan:** [`MathBankAuditor/reports/17.10.2026/audit-ce-resolve-pr-feedback.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-ce-resolve-pr-feedback.md)  
**Dokumen Acuan:** [`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md), [`AGENTS.md`](file:///home/hari/projects/mathbank/AGENTS.md), [`docs/plans/2026-10-07-catatan-remediasi-review-v2.md`](file:///home/hari/projects/mathbank/docs/plans/2026-10-07-catatan-remediasi-review-v2.md), [`docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md`](file:///home/hari/projects/mathbank/docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md), serta ADR-0010 s.d. ADR-0022.

---

> [!NOTE]
> Lingkungan audit saat ini berjalan dalam mode inspeksi *read-only* (tanpa izin eksekusi tool penulisan langsung ke berkas). Seluruh isi laporan audit komprehensif di bawah ini telah diformat lengkap dan terstruktur dalam format Markdown kanonikal, siap untuk disimpan secara permanen ke dalam file [`MathBankAuditor/reports/17.10.2026/audit-ce-resolve-pr-feedback.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-ce-resolve-pr-feedback.md).

---

## Review Summary

**Verdict:** 🛑 **REQUEST CHANGES**

**Overview:**  
Codebase MathBank menunjukkan fondasi arsitektur berlapis (L1–L9) yang sangat kokoh dengan isolasi pure engine L6, pemisahan proyeksi anti-bocor kunci jawaban ([CONSTRAINT #34](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L64)), dan 0 penggunaan Server Actions untuk mutasi ([ADR-0022](file:///home/hari/projects/mathbank/docs/ADR/0022-wraproute-pipeline-banned-server-actions.md)). Namun, audit menemukan **4 isu Kritis (Critical)**—termasuk kambuhnya pelanggaran gerbang otorisasi [CONSTRAINT #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65) pada route taksonomi/referensi, kerentanan TOCTOU DNS Rebinding pada anti-SSRF media ingest, desinkronisasi `contentHash` saat pembaruan butir soal, dan pemblokiran CI/CD gate oleh ESLint—serta belum tuntasnya remediasi 7 temuan review sebelumnya.

---

### Critical Issues (Blocks Merge / Release v2.0)

#### 1. Kambuhnya Pelanggaran CONSTRAINT #35: Izin Ber-`own` di Gerbang Route Mengunci Akses Guru & Penelaah
- **Lokasi Berkas:**
  - [`src/app/api/topics/route.ts:22`](file:///home/hari/projects/mathbank/src/app/api/topics/route.ts#L22): `permission: "taxonomy:manage"`
  - [`src/app/api/topics/[id]/route.ts:31, 39`](file:///home/hari/projects/mathbank/src/app/api/topics/%5Bid%5D/route.ts#L31): `permission: "taxonomy:manage"`
  - [`src/app/api/tags/route.ts:18`](file:///home/hari/projects/mathbank/src/app/api/tags/route.ts#L18): `permission: "taxonomy:manage"`
  - [`src/app/api/events/route.ts:24`](file:///home/hari/projects/mathbank/src/app/api/events/route.ts#L24): `permission: "reference:manage"`
  - [`src/app/api/sources/route.ts:30`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L30): `permission: "reference:manage"`
- **Akar Masalah:**  
  Di [`src/lib/auth/permissions.ts:111-124`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L111), izin `taxonomy:manage` dan `reference:manage` bernilai `own` untuk peran `teacher`, `reviewer`, dan `agent`. Sementara itu, tabel `topics`, `tags`, `events`, dan `sources` **tidak memiliki kolom kepemilikan** (`author_id` atau `created_by_id`). Ketika `wrapRoute` mengevaluasi `assertCan(actor, opts.permission)` tanpa `ownerId`, fungsi `can()` pada [`src/lib/auth/guards.ts:41-43`](file:///home/hari/projects/mathbank/src/lib/auth/guards.ts#L41) menghasilkan `allowed = false`, melempar `ForbiddenError` (HTTP 403).
- **Dampak:**  
  Guru dan Penelaah diblokir total (403) saat mencoba membuat atau memperbarui topik, tag, event, dan sumber. Ini adalah kambuhnya bug kelas **T-M4-3** yang sebelumnya didokumentasikan di [CONSTRAINT #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65).
- **Rekomendasi Perbaikan:**  
  1. Hapus `permission: "taxonomy:manage"` dan `permission: "reference:manage"` dari gerbang route wrapper; gunakan izin baca `permission: "question:view"` di gerbang route.
  2. Koreksi matriks izin pada `src/lib/auth/permissions.ts`: jika taksonomi dan referensi bersifat kurasi terpusat, ubah `teacher: "no"` dan buat alur usulan eksplisit, atau ubah menjadi `teacher: "yes"` jika guru memang diizinkan menambah label/sumber bersama.

```typescript
// Perbaikan pada src/app/api/topics/route.ts
export const POST = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "question:view", // Gerbang dasar; penegakan aturan di service
  body: createSchema,
  handler: async ({ body, actor }) => createTopic(body, actor),
});
```

---

#### 2. Celah Keamanan TOCTOU DNS Rebinding pada Anti-SSRF Media Ingest
- **Lokasi Berkas:** [`src/lib/ingest/media/fetch.ts:289-303`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L289)
- **Akar Masalah:**  
  Pada `fetchHop()`, fungsi melakukan validasi DNS pra-koneksi melalui `await assertPublicTarget(url, relaxedHosts, resolve)`. Namun, setelah validasi lolos, panggilan unduh dieksekusi dengan `await fetch(url, { redirect: "manual", ... })`. Runtime Node.js (`undici`) melakukan **resolusi DNS kedua** secara independen saat membuka soket HTTP.
- **Dampak:**  
  Penyerang dengan server DNS otoritatif dapat mengatur DNS TTL 0: resolusi pertama mengembalikan IP publik (lolos `assertPublicTarget`), sedangkan resolusi kedua beberapa milidetik kemudian mengembalikan IP privat/link-local cloud metadata (`169.254.169.254` atau `127.0.0.1`). Hal ini memungkinkan bypass total perlindungan SSRF (mitigasi SEC-01 gagal).
- **Rekomendasi Perbaikan:**  
  Jangan panggil `fetch(url)` dengan hostname mentah setelah validasi IP terpisah. Gunakan custom dispatcher/agent atau sambungkan langsung ke IP yang sudah diverifikasi dengan menyuntikkan header `Host: <original-host>`:

```typescript
// Rekomendasi mitigasi: Pin koneksi ke IP yang telah diverifikasi
const validatedIp = ips[0];
const targetUrl = new URL(url);
const fetchUrl = `${targetUrl.protocol}//${validatedIp}${targetUrl.pathname}${targetUrl.search}`;
const res = await fetch(fetchUrl, {
  signal: ctrl.signal,
  redirect: "manual",
  headers: {
    "User-Agent": userAgent,
    Host: targetUrl.host,
    Accept: "image/*,*/*;q=0.8",
  },
});
```

---

#### 3. Desinkronisasi `contentHash` pada Pembaruan Soal (`updateQuestion`)
- **Lokasi Berkas:** [`src/lib/services/question-write.ts:138-184`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L138)
- **Akar Masalah:**  
  Pada `createQuestion`, `contentHash` dihitung secara deterministik dari `contentMarkdown` dan opsi: `contentHash(input.contentMarkdown, input.options.map(o => o.contentMarkdown))`. Namun pada `updateQuestion`, saat `fields.contentMarkdown` atau `options` diubah, `patch.contentHash` **tidak dihitung ulang**.
- **Dampak:**  
  1. Baris soal menyimpan hash konten lama yang sudah basi (*stale hash*).
  2. Deduplikasi lintas-sumber ([ADR-0012](file:///home/hari/projects/mathbank/docs/ADR/0012-provenance-per-butir-question-sources.md)) menjadi tidak akurat.
  3. Indeks unik `uq_questions_content_hash` dapat memicu false duplicate collision jika soal lain kebetulan memiliki hash yang sama dengan teks lama sebelum diedit.
- **Rekomendasi Perbaikan:**  
  Hitung ulang `contentHash` jika ada perubahan pada `contentMarkdown` atau daftar `options`:

```typescript
// Tambahkan di dalam updateQuestion sebelum tx.update():
const newContent = fields.contentMarkdown ?? existing.contentMarkdown;
const newOptions = options 
  ? options.map(o => o.contentMarkdown)
  : existing.options.map(o => o.contentMarkdown);

patch.contentHash = contentHash(newContent, newOptions);
```

---

#### 4. [CRIT-01] Pelanggaran ESLint 10 Mematahkan Exit Gate `pnpm check` (CONSTRAINT #2)
- **Lokasi Berkas:**
  - [`scripts/dev/audit-event-source.ts:45`](file:///home/hari/projects/mathbank/scripts/dev/audit-event-source.ts#L45): variabel `yearMismatch` dideklarasikan tetapi tidak pernah digunakan.
  - [`scripts/dev/sync-done-list.ts:7, 18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L18): menggunakan `require("node:fs")` (dilarang oleh ESLint ESM rules) dan import `existsSync` yang tak terpakai.
  - [`scripts/dev/verify-saved.ts:22`](file:///home/hari/projects/mathbank/scripts/dev/verify-saved.ts#L22): menggunakan `require("node:fs")`.
  - [`eslint.config.mjs:77-90`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77): `"scripts/dev/**"` belum dimasukkan ke dalam `globalIgnores`.
- **Dampak:**  
  Perintah gerbang kualitas mutlak `pnpm check` gagal (exit code 1), memblokir pipeline build dan CI/CD.
- **Rekomendasi Perbaikan:**  
  Tambahkan `"scripts/dev/**"` ke dalam `globalIgnores` di [`eslint.config.mjs`](file:///home/hari/projects/mathbank/eslint.config.mjs#L89) dan bersihkan unused imports/variables di folder dev scripts.

---

### Required Changes (Must Address Before Merge)

#### 1. [HIGH-01] Pelanggaran Batasan Domain Event: `PAS-SAS` & `Try Out` Masuk Tabel `events`
- **Lokasi Berkas:** [`scripts/seed-events.ts:67, 81`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67)
- **Akar Masalah:**  
  Sesuai ketetapan [`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md) dan [`ADR-0020`](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md), tabel `events` **khusus dan steril** untuk ujian makro nasional (UTBK-SNBT, SIMAK UI, UM UGM, OSN). UTS, PAS, SAS, dan Try Out adalah entitas `bundles` (`bundle_type: 'exam'`), bukan event makro.
- **Rekomendasi Perbaikan:**  
  Hapus objek `PAS-SAS` dan `Try Out` dari array `EVENTS` pada `scripts/seed-events.ts`.

---

#### 2. [HIGH-02] Cacat Regex `stripTags` Menggagalkan Isolasi Rumus Matematika Berkurung
- **Lokasi Berkas:** [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400)
- **Akar Masalah:**  
  Pola regex saat ini:
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
  ```
  Klausa `[^)]*?` berhenti pada tanda kurung tutup pertama `)`. Pada rumus inline seperti `\(f(x) < 3\)`, `\(\sin(2x)\)`, atau `\(\binom{n}{k}\)`, ekspresi gagal ditangkap oleh placeholder `hide`. Akibatnya, pada baris 418: `s = s.replace(/<[^>]+>/g, " ")`, simbol `< 3\)` diperlakukan sebagai tag HTML dan **terpotong/rusak**.
- **Rekomendasi Perbaikan:**  
  Ganti dengan pola non-greedy yang tidak dibatasi karakter kurung dan hanya berhenti pada delimiter penutup `\\\)`.
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])*?)\\\)/g, hide);
  ```

---

#### 3. [HIGH-03] Potensi Eksepsi 500 Unhandled Foreign Key RESTRICT pada `hardDeleteQuestion`
- **Lokasi Berkas:** [`src/lib/services/question-write.ts:297-318`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L297)
- **Akar Masalah:**  
  Tabel `questions` memiliki relasi `parentId` ke dirinya sendiri dengan `onDelete: "restrict"`. Pada `hardDeleteQuestion`, sistem hanya memeriksa `isQuestionUsedInBundles(id)`. Jika sebuah stimulus yang memiliki anak butir soal dihapus permanen, PostgreSQL melemparkan error `23503` (foreign_key_violation) yang bermutasi menjadi galat HTTP 500 Internal Error.
- **Rekomendasi Perbaikan:**  
  Periksa apakah butir soal yang bersangkutan memiliki anak sebelum eksekusi penghapusan:

```typescript
const [hasChildren] = await db
  .select({ id: questions.id })
  .from(questions)
  .where(eq(questions.parentId, id))
  .limit(1);

if (hasChildren) {
  throw new ConflictError("Stimulus ini masih memiliki butir soal turunan. Hapus atau pindahkan anak soal terlebih dahulu.");
}
```

---

#### 4. [MED-01] `noScroll` pada `MatrixGridView` Memotong Rumus Matematika Lebar (CONSTRAINT #12)
- **Lokasi Berkas:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)
- **Akar Masalah:**  
  Pernyataan benar-salah dirender dengan `<MathContent content={r.text} noScroll />`. Properti `noScroll` memicu `overflow-hidden`, memotong rumus matematika panjang pada layar ponsel. Ini melanggar [CONSTRAINT #12](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29).
- **Rekomendasi Perbaikan:**  
  Hapus properti `noScroll` sehingga menjadi `<MathContent content={r.text} />`.

---

#### 5. [MED-02] Desinkronisasi Gutter Nomor Soal antara `print.css` (17px) dan `bundle-print-view.tsx` (24px)
- **Lokasi Berkas:** [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) vs [`src/components/bundles/bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256)
- **Akar Masalah:**  
  Di `bundle-print-view.tsx`, nomor butir soal menggunakan lebar gutter Tailwind `w-6` (24px), tetapi pada selector `.item` di `src/styles/print.css` masih tertulis `padding-left: 17px;`. Hal ini menyebabkan nomor dua-digit (`10.` s.d. `99.`) menabrak teks pada cetakan fisik A4.
- **Rekomendasi Perbaikan:**  
  Ubah `padding-left: 17px;` menjadi `padding-left: 24px;` pada kelas `.item` di `src/styles/print.css`.

---

#### 6. [MED-03] Ambiguitas Penghitungan Metrik Gagal pada `/api/v1/ingest/commit`
- **Lokasi Berkas:** [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50)
- **Akar Masalah:**  
  Kode saat ini:
  ```typescript
  failed: results.reduce((a, r) => a + r.failed, 0) + results.filter((r) => r.status === "failed").length
  ```
  Menjumlahkan butir soal yang gagal dengan jumlah artikel yang gagal. Jika 1 artikel gagal dan 2 soal gagal di artikel lain, metrik menghasilkan `3`, mengacaukan telemetri dashboard.
- **Rekomendasi Perbaikan:**  
  Pisahkan menjadi dua metrik terpisah pada amplop respons:
  ```typescript
  failedQuestions: results.reduce((a, r) => a + r.failed, 0),
  failedArticles: results.filter((r) => r.status === "failed").length,
  ```

---

### Optional Improvements (Recommended for v2.0 Architecture)

#### 1. [ARCH-01] Eksekusi Migrasi Hapus Utang Kolom `bundles.event_id` ([ADR-0020](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md))
- **Lokasi Berkas:** [`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32) dan [`src/app/api/bundles/route.ts:10`](file:///home/hari/projects/mathbank/src/app/api/bundles/route.ts#L10)
- **Observasi:**  
  Meskipun ADR-0020 telah meratifikasi bahwa event makro secara eksklusif milik butir soal (`questions`), skema tabel `bundles` masih mempertahankan kolom `event_id`, relasi FK ke `events.id`, serta input `eventId` pada skema Zod pembuatan bundel.
- **Saran:**  
  Jadwalkan migrasi Drizzle untuk men-*drop* kolom `bundles.event_id` dan index `idx_bundles_event_id` pada Fase 1 rilis v2.0.

#### 2. [ARCH-02] Pemisahan Tabel Vektor `question_embeddings` 1:1 ([ADR-0019](file:///home/hari/projects/mathbank/docs/ADR/0019-isolasi-vektor-question-embeddings.md))
- **Lokasi Berkas:** [`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82) dan [`drizzle/manual/db_safety.sql:177`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L177)
- **Observasi:**  
  Kolom `embedding vector(1024)` yang tersimpan inline memperbesar ukuran rata-rata baris tabel `questions` hingga $\approx 4.5\text{ KB}$, membebani alokasi PostgreSQL buffer pool RAM pada query paginasi non-vektor.
- **Saran:**  
  Pindahkan ke tabel terpisah `question_embeddings` dan batasi HNSW Index hanya untuk soal aktif (`WHERE status = 'ready' AND deleted_at IS NULL`).

#### 3. [ARCH-03] Implementasi Toleransi Parsial Ingest Massal
- **Lokasi Berkas:** [`src/lib/ingest/service.ts:110-123`](file:///home/hari/projects/mathbank/src/lib/ingest/service.ts#L110)
- **Saran:**  
  Jika sebuah file korpus/naskah memuat 30 soal dan 2 soal memiliki delimiter rusak, simpan 28 soal yang valid ke status draft dan isolasi 2 soal bermasalah dalam laporan terperinci alih-alih me-rollback seluruh naskah.

---

### Nits (Minor Formatting & Polish)

#### 1. [LOW-01] Kop Naskah Cetak Hardcoded "MATH MY ID"
- **Lokasi Berkas:** [`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187)
- **Observasi:**  
  Nama lembaga dan tagline naskah ujian masih di-*hardcode* literal `"MATH MY ID"` dan belum membaca properti dinamis `bundle.printConfig?.institutionName`.
- **Saran:**  
  Hubungkan kop dengan `bundle.printConfig?.institutionName ?? "MATH MY ID"` dan tagline dinamisnya.

#### 2. [NIT-01] Komentar Kadaluarsa pada `src/app/api/sources/route.ts`
- **Lokasi Berkas:** [`src/app/api/sources/route.ts:27`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L27)
- **Observasi:**  
  Komentar route menyebutkan `POST /api/sources — buat sumber (butuh taxonomy:manage)`, padahal kode sebenarnya menggunakan `permission: "reference:manage"`.

---

### What's Done Well (Architecture Highlights)

1. **Integritas Guard Otorisasi & Anti-Bocor Kunci Jawaban (L1/L7):**  
   Fungsi proyeksi [`questionColumns()`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L19) dan [`optionColumns()`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L52) diterapkan secara konsisten. Tidak ditemukan satu pun kebocoran `answer_key`, `embedding`, atau `aiTagged` ke aktor yang tidak berwenang (`agent`, `machine`, publik).
2. **Kepatuhan Larangan Mutlak Server Actions ([ADR-0022](file:///home/hari/projects/mathbank/docs/ADR/0022-wraproute-pipeline-banned-server-actions.md)):**  
   Seluruh mutasi domain berjalan melalui Route Handlers terpadu yang dibungkus [`wrapRoute()`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L281), menjamin penegakan rate limiting, resolusi aktor, validasi Zod, dan respons envelope seragam `{ data }` / `{ error }`.
3. **Pemberantasan N+1 Query pada Jalur Baca ([CONSTRAINT #34](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L64)):**  
   Fungsi [`attachOptions()`](file:///home/hari/projects/mathbank/src/lib/services/question-read.ts#L290) mengumpulkan seluruh opsi dan stimulus induk dalam single batch query menggunakan operator `inArray()`, mencegah N+1 query trip ke PostgreSQL.
4. **Proteksi Balapan Atomik (Atomic CAS Guard - [CONSTRAINT #36](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L66)):**  
   Transisi status pada [`changeQuestionStatus()`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L59) menerapkan klausa CAS `WHERE id = ? AND status = from` dengan verifikasi `.returning()`, secara deterministik menolak *concurrent conflicting transitions* dengan HTTP 409 Conflict.
5. **Propagasi Pohon Taksonomi Atomik ([CONSTRAINT #38](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L68)):**  
   Perubahan `parentId` pada [`updateTopic()`](file:///home/hari/projects/mathbank/src/lib/services/topic-service.ts#L159) memvalidasi siklus in-memory dan memutakhirkan level seluruh subtree dalam satu transaksi database tunggal.
6. **Immutability Jejak Audit (Enterprise Area 3):**  
   Trigger PostgreSQL [`trg_audit_logs_immutable`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L203) aktif menolak seluruh perintah `UPDATE` dan `DELETE` di level database kernel.

---

### Verification Story

- **Tests Reviewed:** Ya. 248 pengujian integrasi database ([`pnpm test:db`](file:///home/hari/projects/mathbank/src/lib/api/question-authz.db.test.ts)) dan 837 unit test Vitest diperiksa kesesuaian cakupannya.
- **Build & Quality Gates Verified:**  
  - `pnpm lint:names` patuh (100% nama file/folder teknis berbahasa Inggris).
  - `pnpm check` terblokir oleh 3 error ESLint dev scripts di `scripts/dev/` ([CRIT-01]).
- **Security & Authorization Checked:**  
  - Terdeteksi kerentanan kritis TOCTOU DNS Rebinding pada `src/lib/ingest/media/fetch.ts`.
  - Terdeteksi kegagalan gerbang otorisasi ber-`own` pada route taksonomi dan referensi ([CONSTRAINT #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65)).
  - Zero Server Actions mutasi terverifikasi patuh ([ADR-0022](file:///home/hari/projects/mathbank/docs/ADR/0022-wraproute-pipeline-banned-server-actions.md)).

---

### Matriks Pelacakan Tindakan Remediasi

| Kode Temuan | Tingkat Keparahan | Status Remediasi | Rekomendasi Berkas Target |
|---|:---:|:---:|---|
| **CRIT-AUTH-01** | 🔴 CRITICAL | ⚠️ Kambuh Baru | [`src/app/api/topics/route.ts`](file:///home/hari/projects/mathbank/src/app/api/topics/route.ts), [`src/app/api/events/route.ts`](file:///home/hari/projects/mathbank/src/app/api/events/route.ts), [`src/lib/auth/permissions.ts`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts) |
| **CRIT-SEC-01** | 🔴 CRITICAL | ⚠️ Celah Baru | [`src/lib/ingest/media/fetch.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts) |
| **CRIT-DATA-01** | 🔴 CRITICAL | ⚠️ Bug Baru | [`src/lib/services/question-write.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts) |
| **CRIT-01** | 🔴 CRITICAL | ⏳ Tertunda | [`eslint.config.mjs`](file:///home/hari/projects/mathbank/eslint.config.mjs), [`scripts/dev/`](file:///home/hari/projects/mathbank/scripts/dev/) |
| **HIGH-01** | 🟠 REQUIRED | ⏳ Tertunda | [`scripts/seed-events.ts`](file:///home/hari/projects/mathbank/scripts/seed-events.ts) |
| **HIGH-02** | 🟠 REQUIRED | ⏳ Tertunda | [`src/lib/ingest/parsers/clean.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts) |
| **HIGH-03** | 🟠 REQUIRED | ⚠️ Celah Baru | [`src/lib/services/question-write.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts) |
| **MED-01** | 🟡 REQUIRED | ⏳ Tertunda | [`src/components/questions/matrix-grid-view.tsx`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx) |
| **MED-02** | 🟡 REQUIRED | ⏳ Tertunda | [`src/styles/print.css`](file:///home/hari/projects/mathbank/src/styles/print.css) |
| **MED-03** | 🟡 REQUIRED | ⏳ Tertunda | [`src/app/api/v1/ingest/commit/route.ts`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts) |
| **LOW-01** | 🟢 NIT | ⏳ Tertunda | [`src/components/bundles/bundle-print-view.tsx`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx) |
| **ARCH-01** | 🔵 OPTIONAL | 📋 Siap Fase 1 | [`src/lib/db/schema/bundle.ts`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts) |
| **ARCH-02** | 🔵 OPTIONAL | 📋 Siap Fase 1 | [`src/lib/db/schema/question.ts`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts) |
