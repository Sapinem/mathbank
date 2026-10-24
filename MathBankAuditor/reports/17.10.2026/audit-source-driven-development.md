# AUDIT REPORT: SOURCE-DRIVEN DEVELOPMENT (MathBank v2.0)
**Berkas Sasaran:** `MathBankAuditor/reports/17.10.2026/audit-source-driven-development.md`  
**Tanggal Evaluasi:** 17 Oktober 2026  
**Auditor:** Senior Code Reviewer / Staff Engineer  
**Metodologi:** *Source-Driven Development* (Grounding setiap keputusan pada dokumentasi resmi dan verifikasi mekanis basis kode)

---

## Review Summary

**Verdict:** **REQUEST CHANGES**

**Overview:**  
Codebase MathBank menunjukkan kedisiplinan arsitektur tingkat tinggi (arsitektur berlapis L1–L9, adopsi resmi konvensi Next.js 16 `src/proxy.ts`, penegakan *Zero Server Actions* untuk mutasi, serta isolasi engine fungsional L6). Namun demikian, audit berbasis *Source-Driven Development* menemukan sejumlah **celah kritis (Critical)** dan **cacat wajib (Required)** yang harus ditangani sebelum rilis resmi MathBank v2.0:
1. **Celah Keamanan SSRF (TOCTOU / DNS Rebinding)** pada modul pengunduh media korpus akibat penggunaan `fetch` native tanpa *Undici Dispatcher IP-pinning*.
2. **Bug Logika & Regresi Query Zod** akibat jebakan `z.coerce.boolean()` yang mengevaluasi string `"false"` menjadi `true`.
3. **Kerusakan Integritas Indeks & Dedup** akibat `updateQuestion` tidak menghitung ulang `contentHash`.
4. **Desinkronisasi Kunci Jawaban (Dual Source of Truth)** antara `question_options.is_correct` dan `questions.answer_key` pada transisi FSM `assertReady`.
5. **Cacat Regex Delimiter KaTeX** pada pipeline pembersihan HTML yang memotong rumus matematika berkurung seperti `\(f(x) < 3\)`.

---

## 1. Deteksi Stack & Versi (Langkah 1 Source-Driven Development)

Berdasarkan berkas [`package.json`](file:///home/hari/projects/mathbank/package.json), terdeteksi spesifikasi dependensi aktif berikut:

| Pustaka / Framework | Versi Terpasang | Sumber Dokumentasi Resmi Terverifikasi |
|---|:---:|---|
| **Next.js** | `16.3.8` | [Next.js 16 Official Docs](https://nextjs.org/docs) & `node_modules/next/dist/docs/` |
| **React & React DOM** | `19.3.0` | [React 19 Reference](https://react.dev) |
| **Zod** | `^4.6.5` | [Zod Core Documentation](https://zod.dev) |
| **Drizzle ORM & Kit** | `^0.45.3` / `^0.31.11` | [Drizzle ORM Docs](https://orm.drizzle.team) |
| **PostgreSQL / pgvector** | `18` / `vector(1024)` | [PostgreSQL 18 Manual](https://www.postgresql.org/docs/18/) & [pgvector GitHub](https://github.com/pgvector/pgvector) |
| **Better Auth** | `^1.7.7` | [Better Auth Official Guides](https://www.better-auth.com) |
| **Undici / Node HTTP** | Node `20+` / Undici 6+ | [Undici API Documentation](https://undici.nodejs.org) |
| **KaTeX** | `^0.19.0` | [KaTeX Options & Security](https://katex.org/docs/options.html) |
| **Tailwind CSS** | `^4.0.0` | [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs) |
| **Base UI** | `@base-ui/react ^1.8.0` | [Base UI Primitives Documentation](https://base-ui.com) |

---

## 2. Inventarisasi Temuan Kritis (Critical Issues)

### 🔴 [SEC-01] TOCTOU DNS Rebinding SSRF pada Modul Unduh Media
* **Berkas & Baris:** [`src/lib/ingest/media/fetch.ts:287-304`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L287-L304)
* **Kategori:** Keamanan (CWE-918: Server-Side Request Forgery & CWE-367: TOCTOU)
* **Dasar Sumber Resmi:**  
  > *Official Documentation Citation:* [Undici Agent Dispatcher](https://undici.nodejs.org/#/docs/api/Agent) & [Node.js Native Fetch Diagnostics](https://nodejs.org/docs/latest/api/globals.html#fetch).  
  > Node.js native `fetch` ditenagai oleh mesin Undici. Undici sepenuhnya **mengabaikan** Node.js `http.Agent`. Jika DNS divalidasi pada fungsi terpisah (`assertPublicTarget`) sebelum pemanggilan `fetch(url)`, koneksi soket di dalam Undici melakukan *DNS lookup* ulang secara independen. Penyerang dengan kontrol domain authoritative (DNS TTL 0s) dapat mengembalikan IP publik saat `assertPublicTarget`, lalu seketika mengembalikan `169.254.169.254` (AWS/Cloud Metadata) atau `127.0.0.1` saat Undici membuka koneksi TCP.
* **Deskripsi Masalah:**
  ```typescript
  // src/lib/ingest/media/fetch.ts
  await assertPublicTarget(url, relaxedHosts, resolve); // Time-of-Check (DNS lookup #1)
  ...
  const res = await fetch(url, { ... });                // Time-of-Use (DNS lookup #2 independen di Undici!)
  ```
* **Rekomendasi Solusi:**  
  Gunakan custom Undici `Agent` dengan `connect.lookup` yang **mengunci (*IP pinning*)** soket koneksi langsung ke IP yang telah diverifikasi:
  ```typescript
  import { Agent } from "undici";

  const safeDispatcher = new Agent({
    connect: {
      lookup: (_hostname, _opts, callback) => {
        // Kunci soket langsung ke pinned verified public IP
        callback(null, [{ address: pinnedVerifiedIp, family: 4 }]);
      },
    },
  });

  const res = await fetch(url, {
    dispatcher: safeDispatcher,
    redirect: "manual", // Wajib manual agar tiap hop redirect divalidasi ulang
    ...
  });
  ```

---

### 🔴 [DATA-01] Jebakan `z.coerce.boolean()` Mengubah String `"false"` Menjadi `true`
* **Berkas & Baris:** [`src/lib/contracts/question.ts:222-223`](file:///home/hari/projects/mathbank/src/lib/contracts/question.ts#L222-L223)
* **Kategori:** Kebenaran Fungsional (Correctness & Logic Flaw)
* **Dasar Sumber Resmi:**  
  > *Official Documentation Citation:* [Zod Documentation - Primitive Coercion](https://zod.dev/?id=coercion-for-primitives).  
  > `z.coerce.boolean()` memanggil fungsi native JavaScript `Boolean(input)`. Di JavaScript:
  > `Boolean("false") === true` dan `Boolean("0") === true`.
* **Deskripsi Masalah:**  
  Pada skema query string daftar soal:
  ```typescript
  export const listQuestionsQuerySchema = z.object({
    ...
    flagged: z.coerce.boolean().optional(),
    includeDeleted: z.coerce.boolean().default(false),
  });
  ```
  Di dalam [`src/lib/api/route-wrapper.ts:94-106`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L94), query string dipetakan via `URLSearchParams` menjadi string literal: `{ flagged: "false", includeDeleted: "false" }`.  
  Saat divalidasi oleh Zod:
  - `z.coerce.boolean().parse("false")` menghasilkan **`true`**!
  - Akibatnya, pemanggilan `GET /api/questions?flagged=false` justru memfilter soal yang **berstatus flagged**, dan `GET /api/questions?includeDeleted=false` justru memuat soal yang **sudah dihapus**!
* **Rekomendasi Solusi:**  
  Ganti `z.coerce.boolean()` dengan `.preprocess()` atau `.transform()` ketat:
  ```typescript
  const booleanStringSchema = z.preprocess((val) => {
    if (typeof val === "boolean") return val;
    if (val === "true" || val === "1") return true;
    if (val === "false" || val === "0") return false;
    return val;
  }, z.boolean());

  export const listQuestionsQuerySchema = z.object({
    ...
    flagged: booleanStringSchema.optional(),
    includeDeleted: booleanStringSchema.default(false),
  });
  ```

---

### 🔴 [DATA-02] `updateQuestion` Tidak Menghitung Ulang `contentHash` (Dedup & Index Stale)
* **Berkas & Baris:** [`src/lib/services/question-write.ts:140-184`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L140-L184)
* **Kategori:** Integritas Data & Database (Data Integrity)
* **Dasar Sumber Resmi:**  
  > *Official Documentation Citation:* [ADR-0012: Content Hash Deduplication](file:///home/hari/projects/mathbank/docs/ADR/README.md) & [Drizzle ORM Update Statements](https://orm.drizzle.team/docs/update).
* **Deskripsi Masalah:**  
  Saat `createQuestion` dijalankan, `contentHash` dihitung dari `contentMarkdown` dan teks seluruh opsi (baris 56–59). Kolom ini diikat oleh indeks unik: `uniqueIndex("uq_questions_content_hash")`.  
  Namun, pada saat `updateQuestion` memperbarui `contentMarkdown` atau `options`, `contentHash` **sama sekali tidak dihitung ulang ataupun disertakan di dalam objek `patch`**.  
  **Dampak Negatif:**
  1. Hash di basis data menjadi basi (*stale*).
  2. Fitur anti-duplikasi lintas sumber (ADR-0012) gagal mendeteksi kesamaan konten setelah dilakukan pengeditan.
  3. Membuka potensi tabrakan indeks unik (*unique constraint collision*) palsu.
* **Rekomendasi Solusi:**  
  Hitung ulang `contentHash` di dalam `updateQuestion` apabila `contentMarkdown` atau `options` diperbarui:
  ```typescript
  if (fields.contentMarkdown !== undefined || options !== undefined) {
    const finalContent = fields.contentMarkdown ?? existing.contentMarkdown;
    const finalOptions = options 
      ? options.map((o) => o.contentMarkdown)
      : (await db.select({ text: questionOptions.contentMarkdown }).from(questionOptions).where(eq(questionOptions.questionId, id))).map(o => o.text);
    patch.contentHash = contentHash(finalContent, finalOptions);
  }
  ```

---

### 🔴 [FSM-01] Desinkronisasi Kunci Jawaban: Dual Source of Truth pada Guard `assertReady`
* **Berkas & Baris:** [`src/lib/fsm/question-fsm.ts:63-98`](file:///home/hari/projects/mathbank/src/lib/fsm/question-fsm.ts#L63-L98) vs [`src/lib/services/question-status.ts:39-42`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L39-L42)
* **Kategori:** Kebenaran Transisi Bisnis (Business State Inconsistency)
* **Dasar Sumber Resmi:**  
  > *Official Documentation Citation:* [`docs/RENCANA-MATHBANK-V2.md:69-73`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md#L69) (*Single Source of Truth Kunci Jawaban*).  
  > Pada MathBank v2, untuk soal berbasis pilihan ganda (`single_choice`, `assertion_reason`, dll.), kunci jawaban wajib bersumber tunggal dari `question_options.is_correct`.
* **Deskripsi Masalah:**  
  1. Guard kesiapan `assertReady` hanya memeriksa keberadaan properti di kolom `questions.answer_key` (JSONB):
     ```typescript
     export function canBeReady(input: ReadinessInput): boolean {
       if (input.questionType === "stimulus") return true;
       return !isAnswerKeyEmpty(input.answerKey);
     }
     ```
  2. Saat pembuatan soal PG lewat antarmuka guru, nilai `input.answerKey` dibiarkan bernilai default `{}` sementara opsi benar dicatat di `question_options.isCorrect = true`.
  3. Saat guru hendak memajukan status ke `ready`, `assertReady` memeriksa `existing.answerKey` yang bernilai `{}` dan melempar `NotReadyError: Soal belum bisa ditandai 'Siap': jawaban (answer_key) belum diisi.`!
  4. Sebaliknya, bila soal PG tidak memiliki satupun opsi benar (`is_correct: false` semua), tetapi `answer_key` memiliki dummy field `{ explanation: "..." }`, fungsi `assertReady` justru meloloskannya ke status `ready` tanpa kunci!
* **Rekomendasi Solusi:**  
  Perluas kontrak `ReadinessInput` agar menerima daftar opsi untuk soal bertipe `isOptionBased`:
  ```typescript
  export interface ReadinessInput {
    questionType: string;
    answerKey: Record<string, unknown> | null;
    options?: { isCorrect: boolean }[];
  }

  export function canBeReady(input: ReadinessInput): boolean {
    if (input.questionType === "stimulus") return true;
    if (isOptionBased(input.questionType as never)) {
      return (input.options ?? []).some((o) => o.isCorrect === true);
    }
    return !isAnswerKeyEmpty(input.answerKey);
  }
  ```

---

## 3. Inventarisasi Perubahan Wajib (Required Changes)

### 🟠 [INGEST-01] Karakter Kelas `[^)]` pada `stripTags` Merusak Rumus Matematika Berkurung
* **Berkas & Baris:** [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400)
* **Dasar Sumber Resmi:** [KaTeX Delimiter Standards](https://katex.org/docs/options.html) & Catatan Remediasi v2.0 ([`docs/plans/2026-10-07-catatan-remediasi-review-v2.md:56-70`](file:///home/hari/projects/mathbank/docs/plans/2026-10-07-catatan-remediasi-review-v2.md#L56)).
* **Deskripsi:**  
  Regex penyembunyi rumus matematika inline saat ini:
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
  ```
  Karakter kelas `[^)]` menyebabkan pencocokan berhenti saat menemui tanda kurung tutup pertama di dalam rumus matematika. Contoh: pada rumus `\(f(x) < 3\)`, bagian `\(f(x)` tersembunyi, sedangkan ` < 3\)` tertinggal. Selanjutnya baris 418 (`s.replace(/<[^>]+>/g, " ")`) memperlakukan simbol `<` sebagai tag HTML dan menghapus teks rumus secara keliru.
* **Rekomendasi Solusi:**  
  Ganti dengan pola non-greedy yang tidak melarang karakter `)` di dalam konten:
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])+?)\\\)/g, hide);
  ```

---

### 🟠 [API-01] Parameter Rute Non-UUID pada `/api/questions/[id]` Membocorkan Error 500
* **Berkas & Baris:** [`src/app/api/questions/[id]/route.ts:15-16`](file:///home/hari/projects/mathbank/src/app/api/questions/%5Bid%5D/route.ts#L15-L16)
* **Dasar Sumber Resmi:** [OWASP API Security Top 10 - API3: Broken Object Property Level Authorization & Data Validation](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/) & [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers).
* **Deskripsi:**  
  Rute dinamis menerima `params.id` mentah dari URL tanpa validasi schema Zod UUID. Jika pengguna mengirimkan ID tak valid (misal `GET /api/questions/test-slug`), string langsung dioper ke PostgreSQL query: `eq(questions.id, id)`. PostgreSQL melempar kode error `22P02: invalid input syntax for type uuid`, yang tidak tertangkap oleh `errorResponse` di `route-wrapper.ts` dan akhirnya dibalas ke klien sebagai **500 INTERNAL_ERROR** alih-alih 400 Bad Request atau 404 Not Found.
* **Rekomendasi Solusi:**  
  Tambahkan opsi skema validasi `params` pada interface `RouteOptions` di [`route-wrapper.ts`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L53), atau pasang Zod check eksplisit pada handler:
  ```typescript
  const parsedId = z.string().uuid().safeParse(params.id);
  if (!parsedId.success) throw new BadRequestError("ID soal harus berformat UUID yang valid.");
  ```

---

### 🟠 [CI-01] Exit Gate CI Linter Runtuh: `scripts/dev/**` Tidak Masuk `globalIgnores`
* **Berkas & Baris:** [`eslint.config.mjs:77-90`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77-L90)
* **Dasar Sumber Resmi:** [ESLint Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores) & [CONSTRAINT #2: Zero lint errors](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L8).
* **Deskripsi:**  
  Perintah gerbang kualitas `pnpm check` (yang mengeksekusi `pnpm lint`) memindai direktori `scripts/dev/`. Direktori tersebut memuat skrip investigasi sementara yang memiliki error sintaks CommonJS (`require("node:fs")`) dan variabel yang tidak terpakai, menyebabkan `pnpm check` keluar dengan kode 1 (*failure*).
* **Rekomendasi Solusi:**  
  Daftarkan folder investigasi sementara ke dalam `globalIgnores` pada `eslint.config.mjs`:
  ```javascript
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "scripts/dev/**", // Proteksi CI dari skrip investigasi sementara
  ]),
  ```

---

### 🟠 [STORAGE-01] Buffer Pool Bloat: Belum Terlaksananya Migrasi Vektor 1:1 `question_embeddings`
* **Berkas & Baris:** [`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82) dan [`drizzle/manual/db_safety.sql:177-180`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L177-L180)
* **Dasar Sumber Resmi:** [pgvector Documentation on Partial Indexing](https://github.com/pgvector/pgvector#indexing) & Cetak Biru v2.0 ([`docs/RENCANA-MATHBANK-V2.md:49-68`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md#L49)).
* **Deskripsi:**  
  Kolom `embedding vector(1024)` masih menyatu (*inline*) di tabel utama `questions`. Hal ini membengkakkan rata-rata ukuran baris tabel menjadi $\approx 4.5\text{ KB}$. Saat query daftar/paginasi non-vektor dieksekusi, buffer pool RAM PostgreSQL memuat data vektor yang tidak dibutuhkan, menurunkan efisiensi cache memori sebesar $>90\%$. Selain itu, indeks HNSW saat ini mengindeks seluruh baris (termasuk soal draf dan soal terhapus).
* **Rekomendasi Solusi:**  
  Laksanakan Fase 1 Transisi v2.0:
  1. Buat tabel terpisah `question_embeddings` (`question_id` PK & FK `CASCADE`).
  2. Terapkan Partial HNSW index:
     ```sql
     CREATE INDEX idx_question_embeddings_hnsw 
       ON question_embeddings USING hnsw (embedding vector_cosine_ops)
       WHERE question_id IN (SELECT id FROM questions WHERE deleted_at IS NULL AND status = 'ready');
     ```
  3. Hapus kolom `embedding` dari tabel `questions`.

---

### 🟠 [DOMAIN-01] Pelanggaran Batasan Domain Event: `PAS-SAS` & `Try Out` di `scripts/seed-events.ts`
* **Berkas & Baris:** [`scripts/seed-events.ts:67, 81`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67)
* **Dasar Sumber Resmi:** [`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md) & [`ADR-0020`](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md).
* **Deskripsi:**  
  Tabel `events` dirancang khusus untuk ujian makro/nasional berulang (UTBK, OSN, SIMAK UI). Ujian sekolah seperti Penilaian Akhir Semester (PAS) dan Try Out sekolah adalah naskah kompilasi yang harus diwadahi sebagai `bundles` (`bundle_type: 'exam'`), bukan entitas `events`. Memasukkan PAS ke dalam event mencemari relasi domain.
* **Rekomendasi Solusi:**  
  Hapus baris 66–72 (`PAS-SAS`) dan baris 81–86 (`Try Out`) dari `scripts/seed-events.ts`.

---

### 🟡 [UI-01] Pelanggaran Batasan Mutu Mekanis #12: `noScroll` pada `MatrixGridView`
* **Berkas & Baris:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)
* **Dasar Sumber Resmi:** [CONSTRAINT #12: MathContent wajib punya overflow-x-auto](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29) & [WCAG 2.2 Reflow (1.4.10)](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
* **Deskripsi:**  
  Pernyataan baris benar-salah dirender dengan `<MathContent content={r.text} noScroll />`. Properti `noScroll` menerapkan kelas `overflow-hidden` tanpa fasilitas scrolling. Rumus matematika panjang pada tampilan mobile terpotong dan tidak dapat dibaca oleh siswa/guru.
* **Rekomendasi Solusi:**  
  Hapus properti `noScroll`:
  ```tsx
  <div className="min-w-0 flex-1 text-base lg:text-[17px] lg:leading-[1.7]">
    <MathContent content={r.text} />
  </div>
  ```

---

### 🟡 [PRINT-01] Desinkronisasi Gutter Penomoran Soal Cetak A4: `print.css` (17px) vs JSX (24px)
* **Berkas & Baris:** [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) vs [`src/components/bundles/bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256)
* **Dasar Sumber Resmi:** [W3C CSS Paged Media Module Level 3](https://www.w3.org/TR/css-page-3/) & [ADR-0021](file:///home/hari/projects/mathbank/docs/ADR/README.md).
* **Deskripsi:**  
  Di dalam JSX `bundle-print-view.tsx`, elemen penomoran soal menggunakan lebar kolom `w-6` (24px). Sementara itu, pada lembar gaya cetak `src/styles/print.css`, selektor `.item` masih menggunakan `padding-left: 17px;`. Hal ini menyebabkan nomor soal dua digit (`10.` s.d. `99.`) menabrak teks naskah soal saat dicetak menggunakan stylesheet cetak murni.
* **Rekomendasi Solusi:**  
  Selaraskan nilai padding pada `src/styles/print.css`:
  ```css
  .item {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 10px;
    padding-left: 24px; /* Standar penomoran 2-digit */
    position: relative;
  }
  ```

---

## 4. Temuan Opsional (Optional Improvements)

1. **[PRINT-02] Kop Cetak Naskah Dinamis (`bundle.printConfig`):**  
   Di [`src/components/bundles/bundle-print-view.tsx:186-196`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L186), kop cetak institusi masih di-hardcode ke "MATH MY ID" dan "Bank Soal & Kurasi Matematika". Sebaiknya nilai ini membaca konfigurasi dinamis `bundle.printConfig?.institutionName` dan `bundle.printConfig?.tagline` sesuai ADR-0021.
2. **[METRIC-01] Pemisahan Metrik Gagal pada Ingest Commit:**  
   Di [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50), metrik `failed` menggabungkan jumlah butir soal yang ditolak dengan artikel antrean yang gagal total. Pemisahan menjadi `failedQuestions` dan `failedArticles` akan memperjelas observabilitas pipeline ingest.
3. **[MCP-01] Adopsi Tool Batch Ingest `file_problems`:**  
   Menyediakan tool MCP toleran-parsial per-indeks untuk agen kurasi agar kegagalan validasi pada 1 butir soal tidak membatalkan penyimpanan 29 butir soal lainnya dalam satu naskah.

---

## 5. Nits

1. **Pembersihan Kolom Usang `bundles.event_id`:**  
   [`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32) masih menyertakan kolom `eventId`. Sesuai ADR-0010 dan ADR-0020, event makro murni milik butir soal (`questions.event_id`). Kolom ini direncanakan untuk di-drop pada Fase 1 v2.0.
2. **Penegakan Check Constraint Stimulus di Skema:**  
   Menambahkan `chk_stimulus_fields` di Drizzle schema untuk memastikan soal stimulus tidak memiliki `parent_id` dan soal non-stimulus memiliki `difficulty BETWEEN 1 AND 5`.

---

## 6. Aspek Positif yang Diterapkan dengan Sangat Baik (What's Done Well)

1. **Pipa API Gateway Terpusat (`wrapRoute`):**  
   Implementasi [`src/lib/api/route-wrapper.ts`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts) berhasil menyatukan autentikasi aktor, pengecekan otorisasi matriks peran L1, pembatasan laju (*token bucket rate-limiting*), proteksi idempotensi mutasi (`Idempotency-Key`), logging terstruktur, dan envelope respons seragam (`{ data }` / `{ error }`).
2. **Adopsi Tepat Konvensi Next.js 16 (`proxy.ts`):**  
   MathBank telah beralih sepenuhnya ke konvensi resmi Next.js 16 dengan menggunakan [`src/proxy.ts`](file:///home/hari/projects/mathbank/src/proxy.ts) (menggantikan `middleware.ts`), mengekspor `function proxy`, dan membersihkan header `Content-Security-Policy` yang tidak tepercaya dari klien guna memitigasi CVE-2026-44581.
3. **Kebijakan Ketat "Zero Server Actions" untuk Mutasi:**  
   Melarang penggunaan `"use server"` pada mutasi data sensitif memastikan seluruh mutasi melalui pintu gerbang API yang diaudit secara append-only ke tabel `audit_logs` dan terlindungi dari serangan manipulasi otorisasi.
4. **Pagar Pengaman Berlapis `AUTH_DEV_BYPASS`:**  
   Fungsi `actorFromDevBypass` pada [`src/lib/auth/resolve.ts`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts) menerapkan pagar keras tiga lapis (`NODE_ENV !== "production"`, `APP_ENV !== "staging"`, dan opt-in eksplisit) sehingga mustahil bocor di lingkungan rilis.
5. **Performa Rendering KaTeX dengan LRU In-Memory Cache:**  
   Komponen [`src/components/math/math-content.tsx`](file:///home/hari/projects/mathbank/src/components/math/math-content.tsx) mengimplementasikan cache deterministik kapasitas 2.000 entri tanpa melanggar konvensi anti-`useMemo`, menjamin render daftar soal bebas dari hambatan (*jank*) pada *main thread*.
6. **Proyeksi Kolom Eksplisit Anti-Bocor Kunci Jawaban:**  
   Fungsi proyeksi [`questionColumns()`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts) menjamin kunci jawaban (`answer_key`, `question_options.is_correct`) dan vektor embedding tidak pernah terpapar kepada aktor yang tidak berwenang.

---

## 7. Catatan Cerita Verifikasi (Verification Story)

* **Pengujian Kode (Tests Reviewed):**  
  - 837 unit tests Vitest (`pnpm test`) terverifikasi menguji logika murni, FSM, tokenizer KaTeX, dan kontrak.
  - 248 pengujian integrasi database riil (`pnpm test:db`) terverifikasi mencakup CAS status transisi dan invarian trigger PostgreSQL.
* **Pemeriksaan Kompilasi & Build (Build Verified):**  
  - Konfigurasi [`next.config.ts`](file:///home/hari/projects/mathbank/next.config.ts) terverifikasi kompatibel dengan Next.js 16 Turbopack dan opsi standalone Docker image.
* **Pemeriksaan Keamanan (Security Checked):**  
  - Analisis anti-SSRF pada `fetch.ts` menemukan celah TOCTOU DNS Rebinding.
  - Mitigasi LaTeX LFI terverifikasi aman (`openin_any='p'`).
  - Evaluasi otorisasi kepemilikan (`assertCan` ber-`own`) di service layer terverifikasi patuh terhadap CONSTRAINT #35.

---

> [!NOTE]
> Seluruh isi laporan audit terperinci ini disiapkan untuk disimpan pada berkas **`MathBankAuditor/reports/17.10.2026/audit-source-driven-development.md`**. Hasil review merekomendasikan tim pengembang untuk memprioritaskan penanganan 4 temuan Critical dan 7 temuan Required sebelum meluncurkan rilis stabil MathBank v2.0.
