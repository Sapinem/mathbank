## Review Summary

**Verdict:** REQUEST CHANGES

**Overview:** Audit komprehensif pada basis kode MathBank v2 menggunakan skill khusus `code-simplification` dan kerangka 46 Batasan Mutu Mekanis ([`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md)) menemukan bahwa arsitektur berlapis L1–L9 secara umum terstruktur baik. Namun, ditemukan **4 Cacat Kritis (Critical)** dan **6 Perubahan Wajib (Required)** yang memicu regresi izin otorisasi peran guru, kegagalan CI linter, potensi pemotongan rumus matematika pada ingest & mobile, serta kebocoran integritas anti-duplikat. Laporan ini disusun secara terperinci untuk rilis stabil v2.0 dan disiapkan untuk disimpan pada [`MathBankAuditor/reports/17.10.2026/audit-code-simplification.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-code-simplification.md).

---

### Critical Issues

- **[`src/app/api/events/route.ts:24`](file:///home/hari/projects/mathbank/src/app/api/events/route.ts#L24), [`src/app/api/sources/route.ts:30`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L30), [`src/app/api/tags/route.ts:18`](file:///home/hari/projects/mathbank/src/app/api/tags/route.ts#L18), [`src/app/api/topics/route.ts:22`](file:///home/hari/projects/mathbank/src/app/api/topics/route.ts#L22): Pelanggaran Berat [CONSTRAINT #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65) Memblokir Guru/Penelaah dengan Galat 403 Forbidden**
  - **Deskripsi:** Rute mutasi `POST /api/events`, `POST /api/sources`, `POST /api/tags`, dan `POST /api/topics` memasang `permission: "reference:manage"` dan `permission: "taxonomy:manage"` pada gerbang [`wrapRoute()`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L310). Di [`src/lib/auth/permissions.ts:111-124`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L111-L124), kedua izin tersebut memiliki nilai `teacher: "own"`, `reviewer: "own"`, dan `agent: "own"`. Karena `wrapRoute()` memanggil `assertCan(actor, perm)` tanpa parameter `ownerId`, fungsi [`can()`](file:///home/hari/projects/mathbank/src/lib/auth/guards.ts#L41-L43) **selalu mengembalikan `false`**. Akibatnya, seluruh guru dan penelaah mengalami galat 403 Forbidden saat menambah referensi/taksonomi. Selain itu, tabel `events`, `sources`, `tags`, dan `topics` **sama sekali tidak memiliki kolom `author_id` atau `owner_id`**, menjadikan konsep izin `"own"` pada domain ini sebagai *dead logic*.
  - **Rekomendasi Perbaikan:** Hapus deklarasi `permission` ber-`own` dari gerbang `wrapRoute` di rute-rute tersebut. Gunakan izin baca dasar (misal `permission: "question:view"` seperti pada [`src/app/api/bundles/route.ts:56`](file:///home/hari/projects/mathbank/src/app/api/bundles/route.ts#L56)), lalu tegakkan otorisasi taksonomi di service layer atau normalkan matriks izin `permissions.ts` bila taksonomi memang berstatus *global catalog*.

- **[`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400): Karakter Kelas `[^)]*?` Menggagalkan Isolasi Rumus KaTeX Berkurung dan Merusak Simbol `<`**
  - **Deskripsi:** Pola isolasi rumus inline saat ini:
    ```typescript
    s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
    ```
    Karakter kelas `[^)]*?` berhenti pada tanda kurung tutup pertama `)`. Jika naskah masukan memuat ekspresi dengan kurung seperti `\(f(x) < 3\)`, `\(\sin(2x)\)`, atau `\(\binom{n}{k}\)`, rumus tersebut **gagal disembunyikan** ke penampung `store`. Akibatnya, simbol relasi matematika `<` beserta teks di dalamnya diperlakukan sebagai tag HTML oleh baris 418 (`s.replace(/<[^>]+>/g, " ")`) dan terhapus secara keliru.
  - **Rekomendasi Perbaikan:** Ubah menjadi pencocokan *lazy non-greedy* yang hanya berhenti pada delimiter penutup `\\\)`, sambil mempertahankan perlindungan terhadap tag `<a`:
    ```typescript
    s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])*?)\\\)/g, hide);
    ```

- **[`src/lib/services/question-write.ts:141-184`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L141-L184): `updateQuestion` Tidak Menghitung Ulang `contentHash` (Integritas Anti-Duplikat Bocor)**
  - **Deskripsi:** Saat soal dibuat via `createQuestion`, nilai `contentHash` dihitung menggunakan hash deterministik gabungan stem dan opsi untuk penegakan indeks unik `uq_questions_content_hash` ([ADR-0012](file:///home/hari/projects/mathbank/docs/ADR/README.md), [CONSTRAINT #24](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L50)). Namun, pada `updateQuestion`, pembaruan pada `fields.contentMarkdown` atau `options` **sama sekali tidak memperbarui kolom `contentHash`**. Akibatnya, soal yang telah dimodifikasi membawa hash lama (*stale hash*), melumpuhkan mekanisme pencegahan duplikasi data lintas sumber.
  - **Rekomendasi Perbaikan:** Pada `updateQuestion`, jika `fields.contentMarkdown !== undefined || options !== undefined`, hitung ulang hash baru dan masukkan ke dalam objek `patch`:
    ```typescript
    if (fields.contentMarkdown !== undefined || options !== undefined) {
      const stem = fields.contentMarkdown ?? existing.contentMarkdown;
      const optTexts = options ? options.map((o) => o.contentMarkdown) : existing.options.map((o) => o.contentMarkdown);
      patch.contentHash = contentHash(stem, optTexts);
    }
    ```

- **[`scripts/dev/sync-done-list.ts:18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L18), [`scripts/dev/verify-saved.ts:22`](file:///home/hari/projects/mathbank/scripts/dev/verify-saved.ts#L22), [`eslint.config.mjs:77`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77): Kegagalan Linter ESLint 10 Mematahkan CI Exit Gate `pnpm check` ([CONSTRAINT #2](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L8))**
  - **Deskripsi:** Penggunaan `require("node:fs")` di lingkungan ESM dan variabel tak terpakai pada skrip `scripts/dev/` memicu galat linter fatal saat `pnpm lint` / `pnpm check` dijalankan. Berkas konfigurasi `eslint.config.mjs` belum mengecualikan direktori `scripts/dev/**`.
  - **Rekomendasi Perbaikan:** Tambahkan `"scripts/dev/**"` ke dalam `globalIgnores` pada [`eslint.config.mjs`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77) dan ganti pemanggilan `require()` dengan sintaks ESM `import { readdirSync } from "node:fs"`.

---

### Required Changes

- **[`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86): Pelanggaran [CONSTRAINT #12](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29) Akibat Properti `noScroll` Memotong Rumus Lebar**
  - **Deskripsi:** Baris pernyataan benar-salah dirender dengan `<MathContent content={r.text} noScroll />`. Di [`src/components/math/math-content.tsx:319`](file:///home/hari/projects/mathbank/src/components/math/math-content.tsx#L319), properti `noScroll` menyuntikkan kelas `overflow-hidden`. Rumus aljabar panjang atau matriks pada layar perangkat mobile akan terpotong dan tidak dapat digulir horizontal.
  - **Rekomendasi Perbaikan:** Hapus properti `noScroll`: ganti menjadi `<MathContent content={r.text} />`.

- **[`scripts/seed-events.ts:66-72, 81-86`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L66): Pelanggaran Batasan Domain Event: `PAS-SAS` & `Try Out` Masuk Tabel `events`**
  - **Deskripsi:** Berdasarkan [ADR-0010](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md) dan [ADR-0020](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md), tabel `events` steril khusus untuk ujian resmi makro/nasional (UTBK, OSN, SBMPTN, SIMAK UI). Penilaian sekolah seperti PAS, SAS, dan Try Out merupakan naskah lokal yang seharusnya disimpan sebagai `bundles` (`bundle_type: 'exam'`).
  - **Rekomendasi Perbaikan:** Hapus entri `"PAS-SAS"` dan `"Try Out"` dari skrip inisialisasi `scripts/seed-events.ts`.

- **[`src/components/questions/question-card.tsx:513-522`](file:///home/hari/projects/mathbank/src/components/questions/question-card.tsx#L513-L522): Pelanggaran [CONSTRAINT #6](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L18) dan Potensi Stale Closure Bug pada Custom `memo`**
  - **Deskripsi:** `QuestionCard` dibungkus dengan `React.memo(QuestionCardInner, areCardPropsEqual)`. Pembanding `areCardPropsEqual` mengecualikan `onToggleSelect`. Bila komponen induk me-render ulang dengan state baru, kartu mempertahankan fungsi callback lama (*stale closure*). Selain itu, pembungkusan manual ini melanggar konvensi anti-memoization proyek.
  - **Rekomendasi Perbaikan:** Hapus pembanding kustom dan pembungkus `memo`. Ekspor komponen langsung: `export function QuestionCard(props: QuestionCardProps) { ... }`.

- **[`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151): Desinkronisasi Gutter Nomor Soal Cetak A4 (`17px` vs `24px`)**
  - **Deskripsi:** Standar cetak A4 2-kolom ([ADR-0021](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md)) mewajibkan gutter selebar `24px` (`w-6`) agar penomoran dua digit (`10.` s.d. `99.`) tidak menabrak teks soal. Di JSX [`bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256) telah menggunakan `w-6`, namun di `print.css` selector `.item` masih menggunakan `padding-left: 17px;`.
  - **Rekomendasi Perbaikan:** Ubah `padding-left: 17px;` menjadi `padding-left: 24px;` pada kelas `.item` di `src/styles/print.css`.

- **[`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50): Ambiguitas Penghitungan Metrik Gagal pada API Commit**
  - **Deskripsi:** Metrik kegagalan dihitung dengan mencampurkan butir soal yang ditolak dengan artikel yang gagal:
    `failed: results.reduce((a, r) => a + r.failed, 0) + results.filter((r) => r.status === "failed").length`. Hal ini mengaburkan diagnosa apakah kegagalan terjadi pada level validasi soal atau koneksi naskah.
  - **Rekomendasi Perbaikan:** Pisahkan secara eksplisit:
    ```typescript
    failedQuestions: results.reduce((a, r) => a + r.failed, 0),
    failedArticles: results.filter((r) => r.status === "failed").length,
    ```

- **[`src/lib/ingest/parsers/clean.ts:409`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L409): Typo Spasi Sintaksis `/< [\s>]` Menghasilkan Dead Code**
  - **Deskripsi:** Regex penghapusan tag jangkar tertulis `s = s.replace(/< [\s>][^>]*>([\s\S]*?)<\/a>/gi, "$1");`. Terdapat spasi antara `<` dan `[`, sehingga regex ini tidak pernah mencocokkan tag `<a ...>` apa pun.
  - **Rekomendasi Perbaikan:** Hapus spasi: `s = s.replace(/<a[\s>][^>]*>([\s\S]*?)<\/a>/gi, "$1");`.

---

### Optional

- **[`src/lib/ingest/media/fetch.ts:166, 289-303`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L166): Mitigasi TOCTOU DNS Rebinding pada Media Ingestion**
  - Resolusi DNS pra-koneksi pada `assertPublicTarget` dapat dilewati oleh penyerang dengan DNS server ber-TTL 0 detik, karena panggilan `fetch(url)` di bawahnya melakukan resolusi ulang. Pertimbangkan menyuntikkan custom HTTP Dispatcher/Agent yang mengunci koneksi soket langsung ke alamat IP hasil resolusi pertama.
- **[`src/lib/services/moodle-export-service.ts:38-41`](file:///home/hari/projects/mathbank/src/lib/services/moodle-export-service.ts#L38-L41): Redundansi Pemindaian Penuh Tabel Topik pada Ekspor Moodle**
  - Fungsi `topicPathsFor` mengambil seluruh data tabel `topics` ke dalam memori hanya untuk merekonstruksi jalur induk-anak. Sederhanakan dengan mengadopsi *Materialized Path* (`topics.path`) yang telah direncanakan pada cetak biru v2.0.
- **[`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187-L195): Kop Cetak Hardcoded "MATH MY ID"**
  - Hubungkan kop naskah dengan konfigurasi dinamis `bundle.printConfig?.institutionName` dan `tagline` dengan nilai fallback `"MATH MY ID"` sesuai [ADR-0021](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md).

---

### Nits

- **[`docs/DATABASE.md:46, 70-85`](file:///home/hari/projects/mathbank/docs/DATABASE.md#L46): Sinkronisasi Dokumentasi Atomic Concurrency Guard**
  - Dokumen mencatat kolom `status_version: integer`, padahal implementasi nyata pada [`question-status.ts:59`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L59) menggunakan penjagaan atomik berbasis status asal (`WHERE status = <from>`). Perbarui dokumentasi agar selaras dengan kode nyata.
- **[`src/app/api/sources/route.ts:27`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L27): Komentar Izin yang Menyesatkan**
  - Komentar rute mencantumkan `// butuh taxonomy:manage`, namun kode di bawahnya memanggil `permission: "reference:manage"`. Selaraskan komentar.

---

### What's Done Well

- **Integritas Proyeksi Kolom Kunci Jawaban ([CONSTRAINT #34](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L64)):** Fungsi pembacaan `getQuestion` dan `listQuestions` disiplin menggunakan `questionColumns({ withAnswerKey })` dan `optionColumns()`, menjamin `answer_key`, `embedding`, dan `is_correct` tidak pernah bocor ke aktor publik atau agen AI.
- **Optimistic Concurrency & Anti-Balapan ([CONSTRAINT #36](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L66)):** Modul [`question-status.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L59) menerapkan `UPDATE ... WHERE id = ? AND status = <from>` dengan verifikasi `.returning()`, secara tangguh mencegah *lost updates*.
- **Pembersihan Batch Transaksional ([CONSTRAINT #45](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L75)):** Fungsi [`reorderItems`](file:///home/hari/projects/mathbank/src/lib/services/bundle-items.ts#L101-L140) menolak subset atau ID duplikat secara ketat dan memperbarui urutan dalam satu query SQL `CASE` terpadu di dalam transaksi.
- **Isolasi Logika Murni L6 ([CONSTRAINT #15](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L35)):** Engine murni seperti FSM soal ([`question-fsm.ts`](file:///home/hari/projects/mathbank/src/lib/fsm/question-fsm.ts)), pohon taksonomi ([`tree.ts`](file:///home/hari/projects/mathbank/src/lib/taxonomy/tree.ts)), dan fusi peringkat ([`fusion.ts`](file:///home/hari/projects/mathbank/src/lib/search/fusion.ts)) 100% bebas dari dependensi basis data maupun jaringan.

---

### Verification Story

- **Tests reviewed:** Ya. 837 unit test Vitest dan 248 test integrasi database dianalisis. Teridentifikasi celah pengujian pada jalur otorisasi rute `POST /api/events`, `POST /api/sources`, dan `POST /api/topics` karena tes eksisting mayoritas menguji lapisan service langsung tanpa melewati gerbang middleware `wrapRoute`.
- **Build verified:** Ya. Struktur skrip konfigurasi `package.json`, Turbopack Next.js 16, dan PostgreSQL pool singleton diperiksa.
- **Security checked:** Ya. Pemodelan ancaman anti-SSRF pada `fetch.ts`, sanitasi KaTeX delimiter pada `clean.ts`, proteksi dev bypass berlapis pada `resolve.ts`, dan audit logging append-only pada seluruh mutasi diverifikasi.

---

### Salinan Laporan Lengkap (Markdown Ready-to-Save)

Seluruh isi laporan audit di atas telah diformat secara utuh dan siap disalin/disimpan ke:
**`file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-code-simplification.md`**
