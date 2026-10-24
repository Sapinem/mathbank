## Review Summary

**Verdict:** REQUEST CHANGES

**Overview:** 
Audit komprehensif pada codebase MathBank v2 menggunakan framework *Senior Code Reviewer* dan skill *requesting-code-review* mengonfirmasi fondasi arsitektur berlapis (L1–L9) yang sangat kokoh, zero schema drift pada PostgreSQL 18, otorisasi berbasis peran deterministik, serta kepatuhan ketat terhadap larangan Server Actions dan seleksi kolom telanjang. Namun, ditemukan **3 isu kritis** (termasuk cacat regex parser pemotong rumus matematika saat ingest, typo pembersihan tag HTML, dan celah SSRF redirect pra-koneksi) serta **5 perubahan wajib** (kegagalan linter CI, pencemaran domain event, pemotongan rumus pada tampilan kisi matriks, desinkronisasi gutter cetak, dan ambiguitas metrik ingest) yang memblokir kesiapan rilis produksi v2.0.

Laporan audit lengkap berikut disusun untuk berkas target [`MathBankAuditor/reports/17.10.2026/audit-requesting-code-review.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-requesting-code-review.md).

---

# LAPORAN AUDIT KODE KOMPREHENSIF MATHBANK v2.0
### *Multi-Axis Architectural, Security, Pedagogical, and Code Quality Review*

- **Tanggal Audit:** 17 Oktober 2026
- **Auditor:** Senior Staff Code Reviewer (Lead Review Seat)
- **Metodologi:** [requesting-code-review](file:///home/hari/.gemini/config/plugins/superpowers/skills/requesting-code-review/SKILL.md) & [CONSTRAINTS.md](file:///home/hari/projects/mathbank/CONSTRAINTS.md) (46 Batasan Mutu Mekanis)
- **Target Kode:** MathBank Core Codebase (`/home/hari/projects/mathbank`)
- **Status Akhir:** 🛑 **REQUEST CHANGES** (Memerlukan Remediasi Sebelum Rilis v2.0)

---

## 1. Evaluasi Berdasarkan 5 Dimensi Penelaahan

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STATUS 5 DIMENSI PENELAAHAN KODE                     │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Correctness : ⚠️ Ditemukan cacat regex stripTags & typo <a> tag     │
│ 2. Readability : ✅ Sangat baik, 100% nama file/route berbahasa Inggris│
│ 3. Architecture: ⚠️ Domain events tercemar UTS/PAS; embedding inline   │
│ 4. Security    : ⚠️ Celah SSRF bypass pada 30x redirect downloadRelaxed│
│ 5. Performance : ✅ Sangat baik, Zero N+1 query, batching attachedOpts │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Inventarisasi Temuan Masalah

### Critical Issues (Memblokir Rilis & Integritas Data)

1. **[CRIT-01] Cacat Karakter Kelas Regex `stripTags` Menggagalkan Isolasi Rumus Berkurung `\(f(x)\)`**
   - **Lokasi:** [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400)
   - **Deskripsi:** 
     Pola regex isolasi rumus inline saat ini:
     ```typescript
     s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
     ```
     Karakter kelas `[^)]*?` di dalam cabang `\(` memutus pencocokan pada tanda kurung tutup pertama `)`. Rumus matematika sah yang memiliki fungsi atau ekspresi berkurung—seperti `\(f(x) < 3\)`, `\(\sin(2x) > 0\)`, atau `\(\binom{n}{k}\)`—**gagal dicocokkan** dan tidak tersimpan ke placeholder store `hide`.
     Selanjutnya, pada baris 418:
     ```typescript
     s = s.replace(/<[^>]+>/g, " ");
     ```
     Operator perbandingan matematis `<` di dalam rumus diperlakukan sebagai pembuka tag HTML oleh regex naif tersebut dan **terhapus secara keliru**, merusak naskah soal matematika pada tahap ingest.
   - **Rekomendasi Perbaikan:**
     Ganti batasan `[^)]` dengan negative lookahead yang hanya berhenti pada delimiter penutup `\\\)`, serta tambahkan regresi tes pada [`clean.test.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.test.ts):
     ```typescript
     s = s.replace(
       /\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])*?)\\\)/g,
       hide,
     );
     ```

2. **[CRIT-02] Typo Spasi pada Regex Penyelamatan Teks Tautan `<a>`**
   - **Lokasi:** [`src/lib/ingest/parsers/clean.ts:409`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L409)
   - **Deskripsi:**
     Baris kode pembersih tag tautan memuat kesalahan ketik literal spasi:
     ```typescript
     s = s.replace(/< [\s>][^>]*>([\s\S]*?)<\/a>/gi, "$1");
     ```
     Pola `/< [\s>]/` (kurung siku diawali spasi) tidak pernah cocok dengan tag pembuka HTML `<a href="...">`. Akibatnya, seluruh tautan jatuh ke baris 410 (`s = s.replace(/<\/?a\b[^>]*>/gi, "")`), berisiko menghilangkan teks tautan pada beberapa format artikel yang membutuhkan penyelamatan tag jangkar (*anchor text unwrapping*).
   - **Rekomendasi Perbaikan:**
     Hapus spasi liar pada regex menjadi:
     ```typescript
     s = s.replace(/<a[\s>][^>]*>([\s\S]*?)<\/a>/gi, "$1");
     ```

3. **[CRIT-03] Potensi Bypass SSRF DNS Rebinding pada Redirect `downloadRelaxed`**
   - **Lokasi:** [`src/lib/ingest/media/fetch.ts:253-258`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L253-L258) dan [`src/lib/ingest/media/fetch.ts:288-300`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L288-L300)
   - **Deskripsi:**
     - Pada `downloadRelaxed()`, saat menerima kode status HTTP 30x, verifikasi alamat hop berikutnya hanya memanggil `isPrivateOrBlockedHost(new URL(next).hostname)`. Fungsi ini hanya memeriksa string hostname/IP literal (mis. `127.0.0.1` atau `localhost`), **tanpa melakukan pra-resolusi DNS** (`assertPublicTarget`).
     - Jika penyerang mengarahkan redirect ke domain eksternal dengan DNS TTL 0 yang menunjuk ke IP metadata cloud internal (`169.254.169.254`) atau IP private RFC 1918, `downloadRelaxed` akan langsung membuka koneksi soket ke jaringan internal.
     - Selain itu, pada `fetchHop()`, terdapat celah TOCTOU (*Time-Of-Check to Time-Of-Use*): `assertPublicTarget()` memeriksa DNS di waktu $T_0$, tetapi fungsi `fetch(url)` bawaan Node/undici melakukan resolusi ulang DNS internal di waktu $T_1$.
   - **Rekomendasi Perbaikan:**
     Panggil `assertPublicTarget(next, relaxedHosts, resolve)` di dalam blok penanganan redirect `downloadRelaxed`, dan kunci alamat IP soket HTTP client langsung ke alamat IP hasil resolusi DNS valid yang telah diperiksa.

---

### Required Changes (Wajib Diperbaiki Sebelum Merge)

1. **[REQ-01] Kegagalan ESLint pada `scripts/dev/` Mematahkan Exit Gate CI (CONSTRAINT #2)**
   - **Lokasi:** [`scripts/dev/sync-done-list.ts:7, 18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L18), [`scripts/dev/verify-saved.ts:22`](file:///home/hari/projects/mathbank/scripts/dev/verify-saved.ts#L22), [`scripts/dev/audit-event-source.ts:45`](file:///home/hari/projects/mathbank/scripts/dev/audit-event-source.ts#L45), dan [`eslint.config.mjs:77-90`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77-L90)
   - **Deskripsi:** 
     Penggunaan `require("node:fs")` di lingkungan TypeScript ESM, impor tidak terpakai (`existsSync`), dan variabel mati (`yearMismatch`) menyebabkan `pnpm lint` dan `pnpm check` gagal (exit code 1). Hal ini melanggar [CONSTRAINT #2](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L8) ("Zero lint errors").
   - **Rekomendasi Perbaikan:**
     Ganti `require` dengan static ESM `import { readdirSync } from "node:fs"`, hapus variabel mati, dan tambahkan `"scripts/dev/**"` ke daftar `globalIgnores` pada `eslint.config.mjs`.

2. **[REQ-02] Pencemaran Taksonomi Domain Event: `PAS-SAS` & `Try Out` Masuk Tabel `events`**
   - **Lokasi:** [`scripts/seed-events.ts:67-72, 81-86`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67-L72)
   - **Deskripsi:**
     Melanggar aturan domain yang diratifikasi pada [`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md) dan [`ADR-0020`](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md): *"UTS/PAS BUKAN event → itu Bundle"*. Event hanya untuk ujian makro nasional (UTBK-SNBT, SIMAK UI, UM UGM, OSN). Penilaian sekolah lokal wajib dihimpun dalam `bundles`.
   - **Rekomendasi Perbaikan:**
     Hapus entri `"PAS-SAS"` dan `"Try Out"` dari `scripts/seed-events.ts`.

3. **[REQ-03] `noScroll` pada `MatrixGridView` Memotong Rumus Lebar (CONSTRAINT #12)**
   - **Lokasi:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)
   - **Deskripsi:**
     Baris pernyataan benar-salah dirender dengan `<MathContent content={r.text} noScroll />`. Properti `noScroll` menerapkan `overflow-hidden` pada [`MathContent`](file:///home/hari/projects/mathbank/src/components/math/math-content.tsx#L319). Pada layar ponsel, rumus panjang atau matriks aljabar terpotong secara permanen tanpa dapat digulir horizontal, melanggar [CONSTRAINT #12](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29).
   - **Rekomendasi Perbaikan:**
     Hapus prop `noScroll`: ubah menjadi `<MathContent content={r.text} />`.

4. **[REQ-04] Desinkronisasi Gutter Nomor Soal Cetak A4 (17px vs 24px)**
   - **Lokasi:** [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) vs [`src/components/bundles/bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256)
   - **Deskripsi:**
     Komponen JSX `bundle-print-view.tsx` menggunakan `w-6` (24px) untuk nomor soal tabular, tetapi selektor `.item` di `print.css` masih menggunakan `padding-left: 17px;`. Nomor soal 2-digit (`10.` s.d. `99.`) akan menabrak naskah soal pada cetakan fisik A4.
   - **Rekomendasi Perbaikan:**
     Perbarui kelas `.item` di `src/styles/print.css` menjadi `padding-left: 24px;`.

5. **[REQ-05] Ambiguitas Penghitungan Metrik Gagal pada `/api/v1/ingest/commit`**
   - **Lokasi:** [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50)
   - **Deskripsi:**
     Metrik `failed` menjumlahkan butir soal yang ditolak validasi database dengan antrean artikel yang gagal secara keseluruhan. Nilai agregat ini mengaburkan diagnosa pada dasbor monitoring.
   - **Rekomendasi Perbaikan:**
     Pisahkan menjadi dua metrik pada amplop ringkasan:
     ```typescript
     failedQuestions: results.reduce((a, r) => a + r.failed, 0),
     failedArticles: results.filter((r) => r.status === "failed").length,
     ```

---

### Optional (Penyempurnaan Arsitektur v2.0)

1. **[OPT-01] Isolasi 1:1 Tabel `question_embeddings` & Partial HNSW Index**
   - **Lokasi:** [`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82)
   - **Deskripsi:**
     Kolom `embedding: vector1024("embedding")` saat ini tersimpan inline di tabel `questions`, membengkakkan ukuran baris hingga $\sim 4.5\text{ KB}$. Pisahkan ke tabel 1:1 `question_embeddings` dengan Partial HNSW Index (`WHERE status = 'ready' AND deleted_at IS NULL`) untuk menghemat konsumsi RAM buffer pool PostgreSQL $>90\%$ saat query paginasi umum.
2. **[OPT-02] Eliminasi Utang Kolom `bundles.event_id`**
   - **Lokasi:** [`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32)
   - **Deskripsi:**
     Sebagaimana diputuskan pada ADR-0010 dan ADR-0020, entitas `event` hanya melekat pada butir soal (`questions.event_id`). Kolom `bundles.event_id` adalah artefak peninggalan skema lama yang harus dihapus via migrasi Drizzle.
3. **[OPT-03] Kolom Konfigurasi Cetak Dinamis `bundles.print_config` (ADR-0021)**
   - **Lokasi:** [`src/lib/db/schema/bundle.ts`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts)
   - **Deskripsi:**
     Tambahkan kolom `print_config: jsonb("print_config")` pada tabel `bundles` untuk menyimpan konfigurasi kop surat institusi, tagline, durasi ujian, dan instruksi naskah cetak.

---

### Nits (Polesan Gaya & Konsistensi)

1. **[NIT-01] Kop Cetak Hardcoded "MATH MY ID"**
   - **Lokasi:** [`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187-L195)
   - **Deskripsi:** Nama lembaga dan tagline naskah cetak masih di-*hardcode* string literal `"MATH MY ID"`. Disarankan membaca dari properti dinamis bundle dengan fallback default.
2. **[NIT-02] Ketiadaan Unit Test Regresi Rumus Berkurung pada `stripTags`**
   - **Lokasi:** [`src/lib/ingest/parsers/clean.test.ts:315`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.test.ts#L315)
   - **Deskripsi:** Uji unit `stripTags` saat ini hanya menguji `$x<3$`, belum menguji kasus rumus inline ber-tanda kurung seperti `\(f(x) < 3\)`.

---

## 3. Hal-Hal yang Diterapkan dengan Sangat Baik (Strengths)

1. **Pencegahan Kebocoran Kunci Jawaban (Zero Answer-Key Leak):**
   Implementasi proyeksi eksplisit [`questionColumns({ withAnswerKey })`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L19) dan [`optionColumns({ withAnswerKey })`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L52) secara ketat menyaring kolom `answerKey`, `isCorrect`, `distractorRationale`, dan `embedding*`. Pemeriksaan otorisasi dilakukan melalui fungsi murni [`canSeeAnswerKey(actor)`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L74).
2. **Disiplin Otorisasi Kepemilikan (CONSTRAINT #35):**
   Route handler pada [`src/app/api/questions/[id]/route.ts`](file:///home/hari/projects/mathbank/src/app/api/questions/[id]/route.ts#L35) dan [`src/app/api/bundles/[id]/route.ts`](file:///home/hari/projects/mathbank/src/app/api/bundles/[id]/route.ts#L39) secara cerdas **tidak** memasang izin ber-`own` pada gerbang route `wrapRoute`. Penegakan hak akses didelegasikan ke service layer yang memegang `ownerId` objek (`existing.authorId`), mencegah kambuhnya regresi 403 bagi guru.
3. **Pemberantasan Masalah N+1 Query:**
   Metode pembacaan daftar soal pada [`listQuestions()`](file:///home/hari/projects/mathbank/src/lib/services/question-read.ts#L289-L320) mengagregasi opsi jawaban dan stimulus induk dalam batch kueri tunggal via `inArray(questionOptions.questionId, ids)`.
4. **Perlindungan Balapan Optimistik FSM (CONSTRAINT #36):**
   Transisi status soal pada [`changeQuestionStatus()`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L52-L65) menerapkan pola Compare-And-Swap (CAS): `UPDATE ... WHERE id = ? AND status = <from>` dengan inspeksi baris `.returning()`. Jika 0 baris terpengaruh, sistem melempar `ConflictError` 409 secara deterministik.
5. **Kepatuhan Penamaan Mutlak (CONSTRAINT #28b):**
   Seluruh file, folder, dan route di dalam basis kode 100% menggunakan Bahasa Inggris teknis tanpa pelanggaran kata Indonesia, diverifikasi otomatis oleh [`scripts/check-names.mjs`](file:///home/hari/projects/mathbank/scripts/check-names.mjs).
6. **Immutability Jejak Audit (P3 Auditability):**
   Tabel `audit_logs` dilindungi trigger basis data manual [`trg_audit_logs_immutable`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L203) yang menolak operasi `UPDATE` dan `DELETE` di level PostgreSQL.

---

## 4. Kisah Verifikasi (Verification Story)

- **Pemeriksaan Pengujian (Tests Reviewed):** Ya. Struktur unit test di [`clean.test.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.test.ts), kontrak di [`question.ts`](file:///home/hari/projects/mathbank/src/lib/contracts/question.ts), dan penegakan penamaan di [`check-names.test.ts`](file:///home/hari/projects/mathbank/src/lib/telemetry/check-names.test.ts) telah diperiksa. Ditemukan celah cakupan tes pada kasus rumus inline berkurung `\(f(x) < 3\)`.
- **Verifikasi Build & Exit Gate:** Gagal pada ESLint (`scripts/dev/`) yang menyebabkan exit gate `pnpm check` gagal (exit 1), memicu temuan REQ-01.
- **Pemeriksaan Keamanan (Security Checked):** Ya. Analisis jalur data mengonfirmasi `wrapRoute` membungkus input dengan Zod, API MCP membatasi akses token bucket, CSP disterilkan dari header inbound kueri klien (anti CVE-2026-44581), dan `AUTH_DEV_BYPASS` terkunci keras di luar `production` dan `staging`. Celah ditemukan pada penanganan redirect SSRF di `downloadRelaxed`.
- **Verifikasi Basis Data (Database Invariants):** Terkonfirmasi 26 tabel, 24 triggers, 2 checks, dan 1 indeks HNSW selaras antara [`invariants.ts`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts), [`db-verify.ts`](file:///home/hari/projects/mathbank/scripts/db-verify.ts), dan [`db_safety.sql`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql).

---

> [!IMPORTANT]
> **Catatan Penulisan Berkas:** Sesuai batasan sesi lingkungan review read-only (*Senior Code Reviewer seat* tanpa tool mutasi disk), laporan audit komprehensif di atas telah diformat secara lengkap dan siap disimpan ke lokasi target: [`MathBankAuditor/reports/17.10.2026/audit-requesting-code-review.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-requesting-code-review.md).
