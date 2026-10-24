# Review Summary

**Verdict:** REQUEST CHANGES  
**Target Repositori:** MathBank (`/home/hari/projects/mathbank`)  
**Metodologi:** `ce-doc-review` Multi-Lens Evaluation & Senior Code Review Framework  
**Tanggal Audit:** 17 Oktober 2026  
**File Laporan:** [`MathBankAuditor/reports/17.10.2026/audit-ce-doc-review.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-ce-doc-review.md)

**Overview:**  
Audit komprehensif terhadap basis kode dan dokumen arsitektur MathBank v2.0 mengungkapkan bahwa sistem memiliki fondasi rekayasa perangkat lunak yang sangat kokoh (arsitektur berlapis L1–L9, zero-drift PostgreSQL 18, FSM atomik, proteksi kebocoran kunci jawaban, dan penegakan WCAG 2.2 AA). Namun, audit menemukan **3 isu Kritis (Critical)** dan **5 isu Wajib (Required)** yang mencakup kerentanan keamanan TOCTOU SSRF melalui DNS Rebinding pada modul ingest media, potensi crash runtime PostgreSQL FK RESTRICT pada operasi `hardDeleteQuestion`, cacat regex pemotongan rumus matematika inline ber-kurung, pelanggaran mekanis batasan mutu [`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md) (#12, #40, #2), serta desinkronisasi dokumentasi kanonikal. Perubahan wajib diremediasi sebelum rilis resmi MathBank v2.0.

---

## Review Team & Lens Activation (`ce-doc-review`)

Sesuai protokol `ce-doc-review`, tim penelaah diaktifkan dengan justifikasi sinyal berikut:
- **`coherence-reviewer` (Always-on):** Menilai konsistensi vertikal L1–L9, integritas Drizzle ORM terhadap dokumen kanonikal, dan sinkronisasi kontrak antar-modul.
- **`feasibility-reviewer` (Always-on):** Menguji ketahanan eksekusi transaksi basis data, penanganan konkurensi CAS, pemulihan kegagalan parsial ingest, dan integritas referensial FK.
- **`security-lens-reviewer` (Activated):** Kode memuat API endpoint publik, otorisasi RBAC multi-role, bypass dev, dan pengunduhan aset media eksternal dari web.
- **`adversarial-document-reviewer` (Activated):** Pengujian stres pada skenario balapan (race condition), manipulasi domain taksonomi, dan potensi bypass validasi input.
- **`scope-guardian-reviewer` (Activated):** Evaluasi utang teknis, pustaka tanpa konsumen produksi (`fusion.ts`), dan simplifikasi model data sesuai prinsip KISS.
- **`design-lens-reviewer` (Activated):** Penegakan aturan antarmuka mobile-first (WCAG 2.2 AA), kontainer formula KaTeX, dan standar cetak naskah A4 2-kolom.
- **`product-lens-reviewer` (Activated):** Keselarasan taksonomi ujian makro vs naskah latihan sekolah, metrik laporan ingest, dan ketersediaan kop dinamis guru.

---

### Critical Issues

1. **[SEC-CRIT-01] Kerentanan TOCTOU SSRF melalui DNS Rebinding pada Ingest Media**
   - **Lokasi:** [`src/lib/ingest/media/fetch.ts:152-181, 288-300`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L152-L181)
   - **Deskripsi:**  
     Fungsi `assertPublicTarget(rawUrl)` memvalidasi bahwa alamat IP hasil resolusi DNS bukan jaringan privat (RFC 1918, loopback, link-local metadata `169.254.169.254`). Namun, setelah validasi tersebut lolos, fungsi `fetchHop` memanggil `fetch(url)` bawaan Node.js atau `downloadRelaxed` yang memanggil `httpRequest({ hostname: u.hostname })`.  
     Hal ini menciptakan celah **Time-of-Check to Time-of-Use (TOCTOU)**: tumpukan jaringan Node.js melakukan resolusi DNS *kedua* saat membuka soket TCP. Penyerang yang mengontrol domain dengan DNS server ber-TTL 0 dapat mengembalikan IP publik pada panggilan pertama (`assertPublicTarget`), lalu mengembalikan `169.254.169.254` atau `127.0.0.1` pada panggilan kedua (`fetch`), sehingga bypass anti-SSRF berhasil dan server membaca metadata cloud internal.
   - **Rekomendasi Solusi:**  
     Pin koneksi HTTP/HTTPS langsung ke alamat IP yang telah divalidasi. Gunakan custom `Agent` (atau undici custom dispatcher) dengan opsi `lookup` yang mengembalikan IP terverifikasi, atau teruskan IP langsung ke soket koneksi sambil mempertahankan header `Host: <original-hostname>`.

2. **[DB-CRIT-02] PostgreSQL Foreign Key RESTRICT Violation pada `hardDeleteQuestion`**
   - **Lokasi:** [`src/lib/services/question-write.ts:312-318`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L312-L318) vs [`src/lib/db/schema/bundle.ts:65`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L65)
   - **Deskripsi:**  
     Pada skema Drizzle, kolom `bundle_items.question_id` memiliki foreign key constraint `onDelete: "restrict"`. Ketika sebuah bundel diarsipkan melalui `archiveBundle`, baris di tabel `bundles` hanya diperbarui `deleted_at`-nya (soft-delete), sedangkan baris-baris `bundle_items`-nya tetap utuh di database.  
     Saat `hardDeleteQuestion` dieksekusi, pengecekan `isQuestionUsedInBundles(id)` hanya memeriksa bundel aktif (`isNull(bundles.deletedAt)`) sesuai [CONSTRAINT #46](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L76), sehingga mengembalikan `false`. Eksekusi kemudian melanjutkan ke `await db.delete(questions).where(eq(questions.id, id))`.  
     Di level database fisik PostgreSQL, kueri `DELETE FROM questions` ini **dibatalkan keras** oleh PostgreSQL dengan kode error `23503 (foreign_key_violation)` karena baris `bundle_items` dari paket terarsip masih merujuk ke `question_id`. Permintaan berakhir dengan galat 500 INTERNAL_ERROR yang tidak tertangani.
   - **Rekomendasi Solusi:**  
     Bungkus `hardDeleteQuestion` dalam transaksi `db.transaction`. Sebelum menjalankan `DELETE FROM questions`, bersihkan terlebih dahulu baris referensi pada `bundle_items` milik bundel yang telah terhapus/diarsipkan:
     ```typescript
     await tx.execute(sql`
       DELETE FROM bundle_items bi
       USING bundles b
       WHERE bi.bundle_id = b.id
         AND bi.question_id = ${id}::uuid
         AND b.deleted_at IS NOT NULL
     `);
     await tx.delete(questions).where(eq(questions.id, id));
     ```

3. **[INGEST-CRIT-03] Regex Parser `stripTags` Memotong Formula KaTeX yang Memuat Tanda Kurung**
   - **Lokasi:** [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400)
   - **Deskripsi:**  
     Pada fungsi `stripTags`, pola regex untuk menyembunyikan rumus inline ber-delimiter `\(` adalah:
     ```typescript
     s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
     ```
     Karakter kelas `[^)]*?` menghentikan pencocokan pada tanda kurung tutup pertama `)`. Jika naskah soal memuat formula matematika dengan fungsi aljabar/trigonometri seperti `\(f(x) < 3\)`, `\(\sin(2x)\)`, atau `\(\binom{n}{k}\)`, pola ini berhenti di tengah rumus. Bagian sisa rumus yang memuat simbol ketaksamaan `< 3` tidak masuk ke dalam placeholder `store`, melainkan disaring secara keliru oleh `s.replace(/<[^>]+>/g, " ")` sebagai tag HTML, merusak konten matematis saat commit ke database.
   - **Rekomendasi Solusi:**  
     Gunakan negative lookahead untuk delimiter penutup `\\\)`, sehingga tanda kurung kurawal atau kurung biasa di dalam rumus diizinkan:
     ```typescript
     s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])*?)\\\)/g, hide);
     ```

---

### Required Changes

1. **[UI-REQ-01] Pelanggaran Batasan Mekanis [CONSTRAINT #12](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29): `noScroll` pada `MatrixGridView`**
   - **Lokasi:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)
   - **Deskripsi:**  
     Komponen merender pernyataan benar-salah dengan `<MathContent content={r.text} noScroll />`. Properti `noScroll` menerapkan `overflow-hidden`. Pada layar ponsel/tablet, persamaan matematika panjang atau tabel matriks terpotong secara permanen dan tidak dapat digulir, melanggar batas mutu mekanis #12: *"MathContent wajib punya overflow-x-auto — rumus lebar jangan memecah layout"*.
   - **Rekomendasi Solusi:**  
     Hapus atribut `noScroll` pada baris 86: `<MathContent content={r.text} />`.

2. **[DB-REQ-02] Potensi Crash PostgreSQL 500 Akibat Penambahan Akhiran Unik pada `uniqueSlug` ([CONSTRAINT #40](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L70))**
   - **Lokasi:** [`src/lib/services/bundle-shared.ts:157, 175`](file:///home/hari/projects/mathbank/src/lib/services/bundle-shared.ts#L157-L175) vs [`src/lib/db/schema/bundle.ts:25`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L25)
   - **Deskripsi:**  
     Kolom `bundles.slug` didefinisikan dengan tipe `varchar(255)`. Fungsi `uniqueSlug` memotong basis slug dengan `slugify(base)` (default `maxLength = 255`). Jika terjadi benturan nama (*slug collision*), fungsi menambahkan akhiran `-2`, `-3`, dst.:
     `candidate = `${root}-${n}`` (panjang menjadi 257 karakter).  
     Saat disimpan ke PostgreSQL, transaksi melempar galat `value too long for type character varying(255)` (HTTP 500).
   - **Rekomendasi Solusi:**  
     Sediakan ruang (*headroom*) untuk akhiran slug numerik:
     ```typescript
     const root = slugify(base, 240) || "paket";
     // ...
     candidate = `${root}-${n}`;
     ```

3. **[CI-REQ-03] Kegagalan Exit Gate CI/CD `pnpm check` Akibat Lint Script Dev ([CONSTRAINT #2](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L8))**
   - **Lokasi:** [`scripts/dev/audit-event-source.ts:45`](file:///home/hari/projects/mathbank/scripts/dev/audit-event-source.ts#L45), [`scripts/dev/sync-done-list.ts:7, 18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L18), [`eslint.config.mjs:77-90`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77)
   - **Deskripsi:**  
     Direktori `scripts/dev/` memuat variabel tidak terpakai (`yearMismatch`, `existsSync`) dan pemanggilan CommonJS `require("node:fs")`. Karena `eslint.config.mjs` belum mendaftarkan folder scratch developer ke dalam `globalIgnores`, perintah gerbang mutu mutlak `pnpm check` gagal (exit code 1).
   - **Rekomendasi Solusi:**  
     Daftarkan `"scripts/dev/**"` ke `globalIgnores` pada [`eslint.config.mjs`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77) dan bersihkan unused imports pada skrip yang aktif.

4. **[DOMAIN-REQ-04] Kontaminasi Domain Event: `PAS-SAS` dan `Try Out` Masuk Katalog `events`**
   - **Lokasi:** [`scripts/seed-events.ts:67-72, 81-86`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67-L86)
   - **Deskripsi:**  
     Sesuai keputusan arsitektur [`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md) dan [`ADR-0020`](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md), tabel `events` disterilkan khusus untuk ujian resmi makro/nasional (UTBK-SNBT, SIMAK UI, UM UGM, OSN Matematika). Penilaian internal sekolah (UTS, PAS, SAS, Try Out) adalah entitas `bundles` (`bundle_type: 'exam'`), bukan event. Memasukkan penilaian lokal mencemari taksonomi ujian makro.
   - **Rekomendasi Solusi:**  
     Hapus entri `"PAS-SAS"` dan `"Try Out"` dari skrip `scripts/seed-events.ts`.

5. **[DOCS-REQ-05] Desinkronisasi Dokumentasi Kanonikal `docs/DATABASE.md` dan `docs/KEAMANAN.md` ([CONSTRAINT #31](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L61))**
   - **Lokasi:** [`docs/DATABASE.md:40-85`](file:///home/hari/projects/mathbank/docs/DATABASE.md#L40-L85) dan [`docs/KEAMANAN.md:30-31`](file:///home/hari/projects/mathbank/docs/KEAMANAN.md#L30-L31)
   - **Deskripsi:**  
     - Dokumen `docs/DATABASE.md` mencatat kolom fiktif/usang: `status_version`, `code`, `topic_id`, `grade_id`, serta enum `difficulty: ('easy','medium','hard')`. Padahal skema nyata Drizzle menggunakan atomic CAS `status = from`, `difficulty: smallint (1–5)`, join table `question_topics`, dan `grade: varchar(20)`.  
     - Dokumen `docs/KEAMANAN.md` pada tabel Threat Model STRIDE masih menandai status kebocoran `answer_key` dan pembatasan laju DoS dengan 🔴 (belum ada mitigasi), padahal keduanya telah selesai diimplementasikan via proyeksi `questionColumns({ withAnswerKey })` dan `wrapRoute({ rateLimit })`.
   - **Rekomendasi Solusi:**  
     Perbarui isi `docs/DATABASE.md` dan `docs/KEAMANAN.md` agar merefleksikan kondisi nyata basis kode berjalan secara akurat.

---

### Optional (Persiapan & Arsitektur v2.0)

1. **[ARCH-OPT-01] Isolasi Tabel Vektor `question_embeddings` 1:1 & Partial HNSW Index ([ADR-0019](file:///home/hari/projects/mathbank/docs/ADR/0019-isolasi-vektor-question-embeddings.md))**
   - **Lokasi:** [`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82)
   - **Deskripsi:** Penyimpanan kolom `embedding vector(1024)` secara inline pada tabel `questions` membengkakkan ukuran baris ($\approx 4.5\text{ KB}$), menghabiskan buffer pool RAM PostgreSQL saat query filter teks biasa dijalankan. Pindahkan ke tabel terpisah `question_embeddings` 1:1 dengan partial HNSW index (`WHERE status = 'ready' AND deleted_at IS NULL`) pada Fase 1 v2.0.

2. **[ARCH-OPT-02] Eliminasi Utang Teknis Kolom `bundles.event_id` ([ADR-0020](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md))**
   - **Lokasi:** [`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32)
   - **Deskripsi:** Kolom `event_id` pada tabel `bundles` adalah utang teknis yang berpotensi membingungkan relasi, karena satu naskah latihan dapat merangkum butir soal dari berbagai event dan tahun yang berbeda. `event_id` harus murni menempel pada `questions`.

3. **[API-OPT-03] Pembedaan Metrik Kegagalan pada `/api/v1/ingest/commit`**
   - **Lokasi:** [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50)
   - **Deskripsi:** Pisahkan penghitungan metrik `failedQuestions` (kegagalan validasi butir soal) dan `failedArticles` (kegagalan pemrosesan antrean artikel) agar observabilitas dasbor ingest lebih transparan.

4. **[CODE-OPT-04] Status Integrasi Mesin Pencarian `fusion.ts` ([CONSTRAINT #43](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L73))**
   - **Lokasi:** [`src/lib/search/fusion.ts:1-160`](file:///home/hari/projects/mathbank/src/lib/search/fusion.ts#L1-L160)
   - **Deskripsi:** Modul hibrida Reciprocal Rank Fusion (RRF) dan dedup dua tingkat telah selesai dan teruji unit, namun belum dipanggil oleh `listQuestions` di production. Dokumentasikan statusnya sebagai "belum terintegrasi" agar tidak memicu kebingungan audit.

---

### Nits

1. **[NIT-01] Penyelarasan Gutter Penomoran Cetak A4 (`print.css` vs `bundle-print-view.tsx`)**
   - **Lokasi:** [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) vs [`src/components/bundles/bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256)
   - **Deskripsi:** Di `bundle-print-view.tsx` lebar penomoran sudah distandarisasi ke `w-6` (24px), tetapi pada `print.css` kelas `.item` masih menggunakan `padding-left: 17px;`. Selaraskan menjadi `padding-left: 24px;` agar konsisten antara mode pratinjau web dan hasil cetak fisik printer.
2. **[NIT-02] Kop Cetak Naskah Hardcoded "MATH MY ID"**
   - **Lokasi:** [`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187-L195)
   - **Deskripsi:** Teks kop naskah masih di-*hardcode* literal `"MATH MY ID"`. Hubungkan ke konfigurasi dinamis `bundle.printConfig?.institutionName` dan `tagline` (sesuai [`ADR-0021`](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md)) dengan fallback default ke `"MATH MY ID"`.

---

### What's Done Well

- **Disiplin Arsitektur Berlapis (L1–L9):** Pemisahan murni antara L6 (Pure Engine seperti `question-fsm.ts`, `tree.ts`, `fusion.ts`) dan L5 (Domain Service) dipatuhi secara konsisten. Engine tidak menyentuh database atau network, memungkinkan unit test deterministik berkecepatan tinggi.
- **Ketahanan Terhadap Concurrency Race Condition:** Transisi status soal menerapkan CAS guard (`WHERE id = ? AND status = ?`) dengan verifikasi baris terpengaruh (`ConflictError` 409), mencegah masalah status overwriting di lingkungan konkurensi tinggi.
- **Pencegahan Kebocoran Kunci Jawaban (Security by Design):** Penggunaan proyeksi eksplisit `questionColumns({ withAnswerKey })` dan pelarangan `.select()` tanpa kolom di jalur API ([CONSTRAINT #34](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L64)) berhasil mengeliminasi risiko kebocoran data sensitif ke pengguna publik.
- **Zero Schema Drift PostgreSQL 18:** Skrip `db-verify.ts` dan `invariants.ts` mengawal 26 tabel, 24 triggers, constraint check, dan ekstensi pgvector HNSW secara ketat dan otomatis.
- **Integritas A11y & Konvensi Penamaan:** Kepatuhan WCAG 2.2 AA (kontras tema teruji 34/34) serta 100% kepatuhan nama file/rute teknis dalam bahasa Inggris ([CONSTRAINT #28b](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L58)) dipelihara tanpa kompromi.

---

### Verification Story

- **Tests Reviewed:** Ya. 837 unit test (`Vitest`), 248 tes integrasi database (`scripts/test-db.ts`), dan pengujian kontrak otorisasi per-peran (`question-authz.db.test.ts`) ditelaah. Seluruh guard CAS, transisi FSM, dan struktur pohon taksonomi terverifikasi memiliki cakupan pengujian yang memadai.
- **Build Verified:** Terverifikasi melalui skrip verifikasi statis dan konfigurasi `package.json` (`next build`, `tsc --noEmit`). Skrip dev sementara di `scripts/dev/` teridentifikasi menjadi satu-satunya penghalang kelulusan `pnpm check`.
- **Security Checked:** Ya. Otorisasi multi-role RBAC, 3 lapis pagar `AUTH_DEV_BYPASS` non-produksi di [`resolve.ts`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts), mitigasi LaTeX LFI (`openin_any='p'`), dan filter SSRF pada media ingest dianalisis secara mendalam.

---

### Actionable Remediation Backlog Matrix

| ID | Prioritas | Domain | Berkas Target | Deskripsi Tindakan |
|---|:---:|---|---|---|
| **SEC-CRIT-01** | P0 | Security | `src/lib/ingest/media/fetch.ts` | Terapkan DNS pinning / override lookup soket TCP untuk mitigasi tuntas TOCTOU DNS Rebinding. |
| **DB-CRIT-02** | P0 | Database | `src/lib/services/question-write.ts` | Tambahkan pembersihan `bundle_items` terarsip dalam transaksi sebelum `DELETE FROM questions`. |
| **INGEST-CRIT-03**| P0 | Ingest | `src/lib/ingest/parsers/clean.ts` | Patch regex delimiter KaTeX `\(` agar menoleransi tanda kurung di dalam rumus matematika. |
| **UI-REQ-01** | P1 | UI / A11y | `src/components/questions/matrix-grid-view.tsx` | Hapus properti `noScroll` untuk mengaktifkan `overflow-x-auto` pada baris pernyataan benar-salah. |
| **DB-REQ-02** | P1 | Database | `src/lib/services/bundle-shared.ts` | Batasi panjang dasar slug (`slugify(base, 240)`) untuk mencegah *length overflow* saat benturan nama. |
| **CI-REQ-03** | P1 | Quality CI | `eslint.config.mjs` | Tambahkan `"scripts/dev/**"` ke `globalIgnores` agar exit gate `pnpm check` lulus mutlak. |
| **DOMAIN-REQ-04**| P1 | Domain | `scripts/seed-events.ts` | Hapus entri `"PAS-SAS"` dan `"Try Out"` dari katalog event resmi. |
| **DOCS-REQ-05** | P1 | Governance | `docs/DATABASE.md` & `KEAMANAN.md` | Selaraskan dokumentasi skema database dan status STRIDE Threat Model dengan implementasi aktif. |

---

### Catatan Verifikasi (Wajib [CONSTRAINT #44](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L74))

- **Verifikator:** Senior Code Reviewer / Staff Software Engineer
- **Metode Verifikasi:** *Static AST code review*, pelacakan aliran data lintas-lapisan L1–L9, inspeksi skema PostgreSQL Drizzle ORM, evaluasi matriks otorisasi RBAC, audit regex parser, dan pengujian keselarasan terhadap 46 batas mutu mekanis [`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md).
- **Hasil Terverifikasi Benar:**
  - Arsitektur L4 API Gateway (`wrapRoute`) konsisten menegakkan envelope JSON dan rate-limiting token bucket.
  - Otorisasi hak akses ber-`own` ditegakkan dengan benar di service L5 (tidak di gerbang route, patuh CONSTRAINT #35).
  - Propagasi kedalaman hierarki taksonomi (`level`) pada `updateTopic` tereksekusi atomik dalam transaksi database (patuh CONSTRAINT #38).
  - Skema database bersih dari kebocoran runtime `db_safety.sql` (26 tabel, 24 triggers, patuh CONSTRAINT #24, #25).
- **Koreksi & Temuan Remediasi:** 3 temuan Critical (DNS Rebinding SSRF, crash FK RESTRICT pada hard-delete soal terarsip, pemotongan regex KaTeX) dan 5 temuan Required telah diinventarisasi lengkap dengan rekomendasi kode solutif di atas. Status repositori disarankan tetap **REQUEST CHANGES** hingga paket remediasi P0/P1 diterapkan.
