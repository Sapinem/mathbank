# Laporan Audit Komprehensif: API & Interface Design (MathBank v2.0)

**Target Berkas:** [`MathBankAuditor/reports/17.10.2026/audit-api-and-interface-design.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-api-and-interface-design.md)  
**Tanggal:** 17 Oktober 2026  
**Auditor:** Senior Staff Software Engineer / Code Reviewer  
**Lensa Audit:** `api-and-interface-design` (REST Idioms, Contract-First, Boundary Validation, Error Semantics, Idempotency, RBAC Guard Layering, Observability)  
**Target Repositori:** MathBank (`/home/hari/projects/mathbank`)

---

## Review Summary

**Verdict:** **REQUEST CHANGES**

**Overview:**  
Audit komprehensif terhadap antarmuka publik dan internal MathBank v2 (`paperclip/dev`) menemukan bahwa arsitektur API telah memiliki fondasi middleware yang kuat melalui pembungkus seragam [`wrapRoute`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts), proyeksi keamanan anti-bocor kunci jawaban ([`questionColumns()`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L16)), dan atomisitas FSM CAS guard. Namun, ditemukan **4 Cacat Kritis (Critical)**—termasuk kambuhnya pelanggaran aturan otorisasi [CONSTRAINT #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65) pada rute taksonomi dan referensi, terblokirnya alur telaah AI untuk peran penelaah/agen, kegagalan guru menandai soalnya sendiri, serta celah DoS tanpa batas laju (*un-rate-limited*) pada endpoint ekspor Moodle—bersama **5 Perubahan Wajib (Required)** terkait integritas idempotensi, kebocoran isolasi lapisan L4–L7, amplop paginasi ganda, dan inkonsistensi skema.

---

### Critical Issues

- **[`src/app/api/topics/route.ts:22`](file:///home/hari/projects/mathbank/src/app/api/topics/route.ts#L22), [`src/app/api/topics/[id]/route.ts:31, 39`](file:///home/hari/projects/mathbank/src/app/api/topics/%5Bid%5D/route.ts#L31), [`src/app/api/tags/route.ts:18`](file:///home/hari/projects/mathbank/src/app/api/tags/route.ts#L18), [`src/app/api/tags/[id]/route.ts:10, 18`](file:///home/hari/projects/mathbank/src/app/api/tags/%5Bid%5D/route.ts#L10), [`src/app/api/sources/route.ts:30`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L30), [`src/app/api/sources/[id]/route.ts:20, 28`](file:///home/hari/projects/mathbank/src/app/api/sources/%5Bid%5D/route.ts#L20), [`src/app/api/events/route.ts:24`](file:///home/hari/projects/mathbank/src/app/api/events/route.ts#L24), [`src/app/api/events/[id]/route.ts:16, 24`](file:///home/hari/projects/mathbank/src/app/api/events/%5Bid%5D/route.ts#L16)**  
  **Deskripsi:** Kambuhnya bug [CONSTRAINT #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65) (*own permission in route gate without ownerId*).  
  Pada [`src/lib/auth/permissions.ts:111-125`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L111-L125), izin `"taxonomy:manage"` dan `"reference:manage"` menetapkan akses `"own"` untuk peran `teacher`, `reviewer`, dan `agent`. Middleware [`wrapRoute`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L310) mengevaluasi `assertCan(actor, opts.permission)` tanpa parameter `ownerId`. Pada fungsi [`can()`](file:///home/hari/projects/mathbank/src/lib/auth/guards.ts#L41-L43), izin berstatus `"own"` tanpa `ownerId` **selalu menghasilkan `false`**. Akibatnya, seluruh guru, penelaah, dan agen **selalu ditolak (HTTP 403 Forbidden)** ketika membuat/menyunting topik, label, sumber, maupun event. Lebih jauh lagi, tabel `topics`, `tags`, `sources`, dan `events` pada skema basis data **sama sekali tidak memiliki kolom kepemilikan (`author_id`/`owner_id`)**, sehingga konsep `"own"` secara konseptual adalah cacat logika domain.  
  **Rekomendasi Perbaikan:**  
  1. Klarifikasi model izin pada [`src/lib/auth/permissions.ts`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts): Jika taksonomi/referensi adalah entitas global kurasi admin, ubah `teacher`, `reviewer`, dan `agent` menjadi `"no"` (atau jika guru diizinkan menambah label/topik global, ubah menjadi `"yes"`).  
  2. Hapus gerbang izin ber-`own` dari opsi `wrapRoute` pada seluruh rute tersebut, dan serahkan validasi kontekstual ke lapisan service L5.

- **[`src/lib/services/enrichment/enrich.ts:68`](file:///home/hari/projects/mathbank/src/lib/services/enrichment/enrich.ts#L68) & [`src/app/api/ai/enrich/route.ts:18`](file:///home/hari/projects/mathbank/src/app/api/ai/enrich/route.ts#L18)**  
  **Deskripsi:** Alur telaah AI mati total untuk penelaah (*reviewer*) dan agen MCP (*agent*) akibat salah pasang izin di service.  
  Di dalam [`enrichQuestion()`](file:///home/hari/projects/mathbank/src/lib/services/enrichment/enrich.ts#L68), dipasang pemeriksaan `assertCan(actor, "question:edit", { ownerId: q.authorId })`. Pada matriks izin [`src/lib/auth/permissions.ts:72-73`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L72), izin `"question:edit"` untuk `reviewer` dan `agent` bernilai `"own"`. Saat penelaah menelaah soal milik guru lain lalu memicu fitur *"Enrich dengan AI"* ([`enrich-button.tsx`](file:///home/hari/projects/mathbank/src/components/questions/enrich-button.tsx)), atau saat agen AI memanggil tool MCP `enrich_question` ([`tools.ts:194`](file:///home/hari/projects/mathbank/src/lib/mcp/tools.ts#L194)), pemeriksaan ini melempar `ForbiddenError` (403) karena penelaah/agen bukan pemilik soal (`q.authorId`). Hal ini bertentangan mutlak dengan keputusan arsitektur di [`DESAIN-PER-LAPISAN-MATHBANK.md:67-68`](file:///home/hari/projects/mathbank/docs/DESAIN-PER-LAPISAN-MATHBANK.md#L67) dan matriks izin `"enrichment:run"` yang seharusnya bernilai `"yes"` untuk semua peran aktif.  
  **Rekomendasi Perbaikan:**  
  Ganti pemeriksaan izin di [`src/lib/services/enrichment/enrich.ts:68`](file:///home/hari/projects/mathbank/src/lib/services/enrichment/enrich.ts#L68) menjadi:
  ```typescript
  assertCan(actor, "enrichment:run");
  ```
  Dan pada [`src/app/api/ai/enrich/route.ts:18`](file:///home/hari/projects/mathbank/src/app/api/ai/enrich/route.ts#L18), ganti `permission: "question:view"` menjadi `permission: "enrichment:run"`.

- **[`src/lib/services/question-write.ts:236`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L236)**  
  **Deskripsi:** Guru tidak dapat menandai (*flag*) atau melepas tanda pada soal buatannya sendiri.  
  Fungsi `setQuestionFlag` mengeksekusi `assertCan(actor, "question:flag");` tanpa menyertakan argumen `{ ownerId: existing.authorId }`. Pada [`src/lib/auth/permissions.ts:106`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L106), hak akses guru untuk `"question:flag"` adalah `"own"`. Tanpa `ownerId`, fungsi otorisasi menganggap akses tidak sah dan melempar `ForbiddenError` (403).  
  **Rekomendasi Perbaikan:**  
  Sertakan `ownerId` pada pemanggilan guard:
  ```typescript
  assertCan(actor, "question:flag", { ownerId: existing.authorId });
  ```

- **[`src/app/api/bundles/[id]/export/moodle/route.ts:28-97`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/export/moodle/route.ts#L28-L97)**  
  **Deskripsi:** Celah keamanan DoS / Disk Flooding akibat rute mutasi berat tidak dibungkus `wrapRoute` dan tanpa Rate Limiting.  
  Endpoint `POST /api/bundles/[id]/export/moodle` menjalankan operasi disk intensif dan eksekusi sub-proses Git (`git init`, `git add`, `git commit`) via [`exportBundleToGitsync`](file:///home/hari/projects/mathbank/src/lib/services/moodle-export-service.ts). Berkas ini ditulis dengan boilerplate manual tanpa middleware [`wrapRoute`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts) dan **sama sekali tidak memiliki pembatas laju (*rate limiting*)**, melanggar [CONSTRAINT #33](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L63). Klien yang memanggil berulang kali secara paralel dapat menghabiskan I/O disk dan thread server. Selain itu, respons tidak menyertakan header pelacak `X-Request-ID` dan tidak tercatat pada metrik telemetri L4.  
  **Rekomendasi Perbaikan:**  
  Refaktor rute menggunakan `wrapRoute`:
  ```typescript
  export const POST = wrapRoute({
    permission: "bundle:manage",
    rateLimit: { capacity: 5, refillPerSec: 0.1 }, // Batasi ketat operasi ekspor disk
    handler: async ({ params, actor }) => {
      // Panggil exportBundleToGitsync dan catat audit
    },
  });
  ```

---

### Required Changes

- **[`src/lib/api/idempotency.ts:101-137`](file:///home/hari/projects/mathbank/src/lib/api/idempotency.ts#L101-L137) & [`src/lib/api/route-wrapper.ts:336-373`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L336-L373)**  
  **Deskripsi:** Pelanggaran prinsip *Honouring an Idempotency Key*: Tidak ada penjagaan payload hash (*Guard the payload*) dan interface tidak atomik.  
  1. *Payload Mismatch:* Implementasi saat ini hanya memeriksa string key (`${actor.id}:${idemKey}`). Jika klien mengirim key yang sama namun dengan payload body yang berbeda, server akan memutar ulang (*replay*) respons payload pertama atau menimpa data, bukannya melempar galat penolakan. Prinsip interface: *"Same key with a different body is a client bug, and must fail loudly (422) rather than serving the first response to a second request"*.  
  2. *Race Condition:* `checkIdempotency` memisahkan `store.get()` dan `store.markInFlight()`. Pada lingkungan multi-instance/Redis, pemisahan cek dan klaim ini menciptakan celah TOCTOU (*Time-of-Check to Time-of-Use*).  
  3. *Memory Leak:* `MemoryStore` tidak menjalankan pembersihan periodik (`prune`), sehingga memori map akan terus membengkak seiring waktu.  
  **Rekomendasi Perbaikan:**  
  - Tambahkan SHA-256 `requestHash` (metode + URL + hash body) pada `Entry` dan bandingkan saat replay. Jika hash berbeda, lempar galat HTTP 422 `IDEMPOTENCY_PAYLOAD_MISMATCH`.  
  - Satukan kontrak interface menjadi operasi atomik tunggal: `claim(key: string, requestHash: string, ttlMs: number): Promise<IdempotencyCheckResult>`.  
  - Tambahkan interval pembersihan kadaluwarsa otomatis atau batasan kapasitas LRU pada `MemoryStore`.

- **[`src/app/api/v1/ingest/commit/route.ts:60-66`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L60-L66)**  
  **Deskripsi:** Pelanggaran batas lapisan arsitektural L4 ➔ L7/L8 (kebocoran objek DB langsung ke route handler).  
  Route handler mengimpor instance basis data secara dinamis `const db = (await import("@/lib/db")).db` lalu mengoper instance `db` tersebut ke fungsi ingest `resolveEventsForBundles(db, bundleIds)`. Peraturan arsitektur L1–L9 ([`docs/ARCHITECTURE.md:23-45`](file:///home/hari/projects/mathbank/docs/ARCHITECTURE.md#L23)) melarang keras lapisan L4 (Route Handlers) memegang atau mengalirkan koneksi DB mentah. Seluruh interaksi basis data wajib diisolasi di L5 (Domain Services).  
  **Rekomendasi Perbaikan:**  
  Pindahkan logika penyelesaian event ke dalam fungsi domain service L5 di `src/lib/ingest/service.ts`, sehingga route handler hanya menerima dan mengembalikan DTO murni tanpa menyentuh objek `db`.

- **[`src/lib/services/media/gallery.ts:40`](file:///home/hari/projects/mathbank/src/lib/services/media/gallery.ts#L40) vs [`src/app/api/media/route.ts:13-20`](file:///home/hari/projects/mathbank/src/app/api/media/route.ts#L13-L20)**  
  **Deskripsi:** Inkonsistensi amplop respons dan fenomena *double nesting* `{ data: { data: [...] } }`.  
  Service `listMedia` mengembalikan objek berstruktur `{ data: rows, total }`. Ketika dibungkus oleh `wrapRoute` yang secara otomatis membungkus return value ke dalam properti `{ data }`, respons JSON yang diterima klien menjadi `{ data: { data: [...], total: N } }`. Ini merusak konsistensi dengan endpoint lain seperti `/api/questions` yang menggunakan properti `{ items, total }`.  
  **Rekomendasi Perbaikan:**  
  Ganti properti keluaran `listMedia` menjadi `{ items: rows, total, limit, offset }`.

- **[`src/app/api/topics/route.ts:13-17`](file:///home/hari/projects/mathbank/src/app/api/topics/route.ts#L13), [`src/app/api/sources/route.ts:21-25`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L21), [`src/app/api/events/route.ts:14-19`](file:///home/hari/projects/mathbank/src/app/api/events/route.ts#L14), [`src/app/api/tags/route.ts:8-13`](file:///home/hari/projects/mathbank/src/app/api/tags/route.ts#L8), [`src/app/api/v1/ingest/queue/route.ts:9-20`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/queue/route.ts#L9)**  
  **Deskripsi:** Ketiadaan paginasi (*Unbounded List Queries*) pada endpoint koleksi referensi dan antrean ingest.  
  - Sesuai prinsip *REST API Patterns - Pagination*: Endpoint daftar wajib dipaginasi sejak awal. Rute `/api/topics`, `/api/sources`, `/api/events`, dan `/api/tags` mengembalikan seluruh baris tanpa parameter `limit`/`offset`. Khusus `/api/sources`, kueri menjalankan subquery berkorelasi untuk menghitung jumlah butir soal per sumber secara penuh pada setiap request.  
  - Rute `/api/v1/ingest/queue` memiliki `limit: 50` pada skemanya namun tidak menyediakan parameter `offset`, sehingga klien tidak dapat menavigasi ke halaman antrean berikutnya.  
  **Rekomendasi Perbaikan:**  
  Terapkan skema query paginasi standar (`limit` maks 100, `offset` default 0) pada semua endpoint koleksi dan kembalikan kontrak metadata seragam: `{ items: T[], total: number, limit: number, offset: number }`.

- **[`src/app/api/bundles/route.ts:5-26`](file:///home/hari/projects/mathbank/src/app/api/bundles/route.ts#L5-L26) & [`src/app/api/bundles/[id]/route.ts:11-22`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/route.ts#L11-L22)**  
  **Deskripsi:** Duplikasi deklarasi skema Zod (*Broken Single Source of Truth*).  
  Pada berkas [`src/lib/contracts/bundle.ts`](file:///home/hari/projects/mathbank/src/lib/contracts/bundle.ts), kontrak kanonikal `createBundleSchema`, `updateBundleSchema`, dan `listBundlesQuerySchema` sudah diratifikasi. Namun, rute `bundles/route.ts` dan `bundles/[id]/route.ts` justru mendefinisikan ulang skema Zod secara lokal (`createSchema`, `listQuerySchema`, `patchSchema`). Hal ini memicu risiko *schema drift* saat salah satu berkas diubah tanpa sinkronisasi.  
  **Rekomendasi Perbaikan:**  
  Hapus definisi skema lokal di kedua route handler dan gunakan langsung impor dari `@/lib/contracts/bundle`.

---

### Optional

- **[`src/app/api/media/upload/route.ts`](file:///home/hari/projects/mathbank/src/app/api/media/upload/route.ts) & [`src/app/api/ai/enrich/route.ts`](file:///home/hari/projects/mathbank/src/app/api/ai/enrich/route.ts)**  
  **Deskripsi:** Penggunaan kata kerja (*verbs*) pada URL REST dan inkonsistensi prefiks versi API.  
  - URL `/api/media/upload` menggunakan kata kerja `upload`, padahal standar REST adalah `POST /api/media` dengan header multipart.  
  - Endpoint ingest menggunakan prefiks `/api/v1/ingest/*`, sementara seluruh endpoint inti sistem lainnya tidak menggunakan versi (`/api/*`).  
  - Endpoint `POST /api/ai/enrich` mengembalikan dua bentuk (*polymorphic payload*) yang berbeda secara drastis (`{ mode: "single", result }` vs `{ mode: "batch", ok, failed, results }`), menyulitkan inferensi tipe klien TypeScript. Disarankan memisahkan menjadi sub-resource yang jelas, misalnya `POST /api/questions/[id]/enrichment` dan `POST /api/questions/enrichment-batches`.

- **[`src/app/api/sources/[id]/route.ts`](file:///home/hari/projects/mathbank/src/app/api/sources/%5Bid%5D/route.ts), [`src/app/api/events/[id]/route.ts`](file:///home/hari/projects/mathbank/src/app/api/events/%5Bid%5D/route.ts), [`src/app/api/tags/[id]/route.ts`](file:///home/hari/projects/mathbank/src/app/api/tags/%5Bid%5D/route.ts)**  
  **Deskripsi:** Ketiadaan endpoint baca detail tunggal (`GET /api/*/[id]`).  
  Rute-rute di atas mendukung operasi `PATCH` dan `DELETE`, namun tidak menyediakan metode `GET` untuk mengambil entitas tunggal. Akibatnya, UI klien terpaksa mengambil seluruh daftar koleksi lalu memfilternya di browser.

- **[`src/lib/services/question-write.ts:297-328`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L297-L328)**  
  **Deskripsi:** Logika tanpa konsumen rute (*Dead Service Logic*) untuk `hardDeleteQuestion`.  
  Fungsi `hardDeleteQuestion` memiliki matriks izin formal (`question:hardDelete`), audit log teruji, dan unit test, namun tidak memiliki pintu eksposur pada `src/app/api/questions/[id]/route.ts` (yang hanya memanggil soft-delete). Disarankan mendukung query parameter `DELETE /api/questions/[id]?permanent=true`.

---

### Nits

- **[`src/app/api/events/[id]/route.ts:18, 26`](file:///home/hari/projects/mathbank/src/app/api/events/%5Bid%5D/route.ts#L18), [`src/app/api/sources/[id]/route.ts:22, 30`](file:///home/hari/projects/mathbank/src/app/api/sources/%5Bid%5D/route.ts#L22), [`src/app/api/tags/[id]/route.ts:12, 20`](file:///home/hari/projects/mathbank/src/app/api/tags/%5Bid%5D/route.ts#L12)**  
  Penggunaan redundan `(await params).id`. Objek `params` pada `RouteContext` sudah diselesaikan secara asynchronous oleh middleware `wrapRoute`, sehingga dapat langsung diakses via `params.id` seperti pada `questions/[id]/route.ts`.

- **[`src/lib/api/route-wrapper.ts:263`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L263)**  
  Pemetaan `ZodError` mengembalikan status HTTP 400 (`Bad Request`), sedangkan standar REST semantik merekomendasikan HTTP 422 (`Unprocessable Content`) untuk payload yang strukturnya valid namun gagal memenuhi batas validasi semantik skema.

- **[`src/app/img/[shortId]/route.ts:53`](file:///home/hari/projects/mathbank/src/app/img/%5BshortId%5D/route.ts#L53)**  
  Ketika rate limit tercapai pada penyaji gambar, respons HTTP 429 tidak menyertakan header standar `Retry-After`, berbeda dengan implementasi pada `wrapRoute` dan endpoint MCP.

---

### What's Done Well

- **Integritas Proyeksi Kolom & Anti-Bocor Kunci Jawaban:** MathBank mematuhi [CONSTRAINT #34](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L64) dengan sangat disiplin. Pemanggilan basis data menggunakan proyeksi eksplisit [`questionColumns()`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L16) dan [`optionColumns()`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L36). Kunci jawaban (`answerKey`), vektor embedding, dan flag AI internal dibersihkan secara mutlak dari respons publik dan hanya dapat diakses oleh peran berwenang (`canSeeAnswerKey`).
- **Pencegahan Race Condition pada Transisi Status (FSM):** Fungsi [`changeQuestionStatus()`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L52-L65) menerapkan pola optimistik CAS (*Compare-And-Swap*) `UPDATE ... WHERE id = :id AND status = :from` dengan verifikasi `.returning()`. Dua request paralel yang mencoba mengubah status dari titik asal yang sama dijamin gagal dengan HTTP 409 `ConflictError`.
- **Integritas Penataan Ulang Paket Soal:** Fungsi [`reorderItems()`](file:///home/hari/projects/mathbank/src/lib/services/bundle-items.ts#L101-L147) menolak subset parsial dan ID duplikat, serta mengeksekusi penulisan ulang urutan secara atomik dalam transaksi tunggal menggunakan konstruksi batch SQL `CASE ... END` berkinerja tinggi ([CONSTRAINT #45](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L75)).
- **Penyajian Media Aman & Tri-Facet Fallback:** Route `/img/[shortId]` ([`src/app/img/[shortId]/route.ts`](file:///home/hari/projects/mathbank/src/app/img/%5BshortId%5D/route.ts)) mengisolasi pembacaan file dari bahaya *Path Traversal* (`abs.startsWith(root + sep)`), menerapkan CSP ketat untuk format SVG, dan menolak `shortId` yang tidak valid sebelum menyentuh koneksi basis data.
- **Isolasi Zero Server Actions:** Seluruh mutasi data dijalankan 100% melalui Route Handler HTTP dengan validasi Zod dan penegakan token bucket rate limiter, meniadakan celah eksekusi liar dari Server Actions Next.js.

---

### Verification Story

- **Tests reviewed:** Ya. Menguji jalur pengujian otorisasi [`src/lib/api/question-authz.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/api/question-authz.db.test.ts), pengujian guard [`src/lib/auth/guards.test.ts`](file:///home/hari/projects/mathbank/src/lib/auth/guards.test.ts), unit test FSM [`src/lib/fsm/question-fsm.test.ts`](file:///home/hari/projects/mathbank/src/lib/fsm/question-fsm.test.ts), dan pengujian kontrak. Ditemukan bahwa pengujian otorisasi sebelumnya hanya mencakup rute `questions/[id]`, sehingga regresi [CONSTRAINT #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65) pada taksonomi (`topics`, `tags`, `sources`, `events`) lolos dari deteksi tes otomatis.
- **Build verified:** Arsitektur Next.js 16 App Router dan Drizzle ORM PostgreSQL 18 zero-drift diverifikasi melalui inspeksi struktur kode dan berkas invarian.
- **Security checked:** Ya. Ditemukan ketiadaan rate limit pada endpoint ekspor GitSync Moodle, potensi race condition/payload mismatch pada proteksi idempotensi, dan celah otorisasi 403 palsu pada penelaahan AI dan penandaan soal oleh guru.

---

### Matriks Checklist Kepatuhan `api-and-interface-design`

| No | Prinsip Mutu API | Status | Catatan Temuan & Rekomendasi |
|:--:|---|:---:|---|
| 1 | **Contract First** | ⚠️ Sebagian | `contracts/bundle.ts` sudah ada tetapi diduplikasi secara lokal di rute `bundles/route.ts`. |
| 2 | **Consistent Error Format** | ⚠️ Sebagian | Format dasar `{ error: { code, message } }` konsisten, tetapi rute ekspor Moodle menulis JSON error manual. |
| 3 | **Validate at Boundaries** | ✅ Lulus | Seluruh rute masuk divalidasi skema Zod di gerbang HTTP L4 sebelum menyentuh domain service L5. |
| 4 | **No Verbs in URLs** | ⚠️ Perlu Perbaikan | Terdapat kata kerja pada `/api/media/upload`, `/api/ai/enrich`, dan `/api/v1/ingest/commit`. |
| 5 | **Pagination on List Endpoints** | 🔴 Gagal | `/api/topics`, `/api/sources`, `/api/events`, `/api/tags` tidak dipaginasi; `/api/media` mengalami double-nesting `data.data`. |
| 6 | **Honouring Idempotency Key** | 🔴 Cacat Desain | Tidak ada validasi `requestHash` (payload mismatch diabaikan) dan operasi cek-klaim tidak atomik. |
| 7 | **Proper HTTP Status Codes** | ⚠️ Sebagian | Validasi Zod menghasilkan 400 alih-alih 422; transisi FSM benar menghasilkan 409. |
| 8 | **Rate Limiting Guard** | ⚠️ Sebagian | Seluruh rute `wrapRoute` terlindungi token bucket, tetapi `export/moodle` lolos tanpa rate limit sama sekali. |
| 9 | **Authorization Layering** | 🔴 Cacat Logika | Izin ber-`own` dipasang di gate route tanpa `ownerId` pada taksonomi/referensi; review AI terblokir 403. |
| 10 | **Layer Independence (L4 ➔ L5)** | ⚠️ Bocor | `api/v1/ingest/commit` mengimpor instance DB `(await import("@/lib/db")).db` langsung di controller rute. |

---

> [!IMPORTANT]
> **Catatan Operasional Penyimpanan Laporan:**  
> Laporan audit terperinci di atas telah diformat secara kanonikal ke standar laporan MathBankAuditor. Berkas target [`MathBankAuditor/reports/17.10.2026/audit-api-and-interface-design.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-api-and-interface-design.md) merefleksikan seluruh temuan di atas untuk segera dijadikan rujukan rencana tindakan (*Actionable Remediation*) pada sprint persiapan rilis MathBank v2.0.
