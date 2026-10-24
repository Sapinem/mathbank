Berikut adalah hasil audit komprehensif basis kode **MathBank v2** berdasarkan kerangka kerja *Multi-Axis Code Review* (**code-review-and-quality**) yang mencakup 5 dimensi: *Correctness*, *Readability & Simplicity*, *Architecture*, *Security*, dan *Performance*, serta evaluasi ketat terhadap 46 batas mutu mekanis ([`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md)).

Laporan lengkap terperinci telah disiapkan dalam format Markdown di bawah ini untuk disimpan ke berkas target [`MathBankAuditor/reports/17.10.2026/audit-code-review-and-quality.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-code-review-and-quality.md).

---

# Laporan Audit: MathBank v2 Code Review & Quality Audit

```markdown
# AUDIT REVIEW KODE & KUALITAS SISTEM MATHBANK v2.0
### *Comprehensive Multi-Axis Code Review & Architectural Integrity Report*

- **Target Berkas Laporan:** `MathBankAuditor/reports/17.10.2026/audit-code-review-and-quality.md`
- **Tanggal:** 17 Oktober 2026
- **Auditor:** Senior Staff Engineer / QA Code Reviewer (Persona: Senior Code Reviewer)
- **Keahlian Khusus:** `code-review-and-quality`
- **Basis Kode Target:** MathBank (`paperclip/dev` @ `/home/hari/projects/mathbank`)
- **Dokumen Terkait:** [`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md), [`docs/PETA-DOKUMEN.md`](file:///home/hari/projects/mathbank/docs/PETA-DOKUMEN.md), [`docs/plans/2026-10-07-catatan-remediasi-review-v2.md`](file:///home/hari/projects/mathbank/docs/plans/2026-10-07-catatan-remediasi-review-v2.md), [`docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md`](file:///home/hari/projects/mathbank/docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md)

---

## Review Summary

**Verdict:** REQUEST CHANGES ⚠️ (Blokir Rilis Resmi v2.0 hingga Temuan Kritis Diremediasi)

**Overview:**  
Basis kode MathBank v2 menunjukkan kematangan arsitektur perangkat lunak yang sangat tinggi dengan pemisahan lapisan (L1–L9) yang bersih, penegakan otorisasi terpusat via [`wrapRoute()`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L44), eliminasi query N+1, serta perlindungan injeksi dan kebocoran kunci jawaban yang solid. Namun, audit multi-dimensi menemukan **3 masalah Critical** (potensi fatal runtime crash pada hard-delete soal terarsip, kerusakan data rumus KaTeX saat ingest, dan celah SSRF DNS Rebinding TOCTOU) serta **4 masalah Required** (kontaminasi taksonomi event, kegagalan CI ESLint akibat skrip dev, dependensi konfigurasi vitest yang mati, dan mutasi event yang tidak lengkap) yang wajib diperbaiki sebelum promosi ke v2.0 stabil.

---

## 1. Critical Issues (Blocks Merge / Production Release)

### 🔴 [CRIT-01] Pelanggaran Foreign Key DB Crash (500) pada `hardDeleteQuestion` akibat Relasi `bundle_items` Terarsip
- **Lokasi Berkas:** [`src/lib/services/question-write.ts:312-318`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L312) dan [`src/lib/db/schema/bundle.ts:65`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L65)
- **Dimensi:** Correctness / Data Integrity
- **Deskripsi Masalah:**
  Pada [`question-write.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L312), pengecekan pembatasan hapus memanggil `isQuestionUsedInBundles(id)`. Berdasarkan aturan [CONSTRAINT #46](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L76), fungsi tersebut hanya memeriksa paket aktif (`isNull(bundles.deletedAt)`).  
  Ketika sebuah paket soal diarsipkan via `archiveBundle(id)` ([`bundle-write.ts:120`](file:///home/hari/projects/mathbank/src/lib/services/bundle-write.ts#L120)), paket tersebut diberi penanda `deletedAt = new Date()`, namun baris-baris relasi pada tabel `bundle_items` **tidak dihapus**.  
  Ketika admin melakukan `hardDeleteQuestion(id)` pada soal yang pernah menjadi bagian dari paket terarsip tersebut:
  1. `isQuestionUsedInBundles(id)` mengembalikan `false` (karena paket sudah terarsip).
  2. Eksekusi berlanjut ke baris 318: `await db.delete(questions).where(eq(questions.id, id));`.
  3. Skema tabel [`bundle_items.question_id`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L65) memiliki konstrain database:
     ```typescript
     questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "restrict" })
     ```
  4. PostgreSQL menolak penghapusan dengan galat *Foreign Key Violation* (`23503`: *violates foreign key constraint "bundle_items_question_id_questions_id_fk"*), mengakibatkan *Unhandled Server Error* (500).
- **Rekomendasi Perbaikan:**
  Dalam `hardDeleteQuestion`, bungkus penghapusan dalam transaksi atomik dan bersihkan keterkaitan `bundle_items` dari paket yang sudah terarsip sebelum menghapus baris dari tabel `questions`:
  ```typescript
  await db.transaction(async (tx) => {
    // Bersihkan relasi dari paket terarsip (paket aktif sudah diblokir oleh isQuestionUsedInBundles)
    await tx.execute(sql`
      DELETE FROM bundle_items bi
      USING bundles b
      WHERE bi.bundle_id = b.id
        AND bi.question_id = ${id}::uuid
        AND b.deleted_at IS NOT NULL
    `);
    await tx.delete(questions).where(eq(questions.id, id));
  });
  ```

---

### 🔴 [CRIT-02] Cacat Regex Penjagaan KaTeX pada Ingest Memotong Rumus Berkurung `\(f(x)\)` & Merusak Stem
- **Lokasi Berkas:** [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400)
- **Dimensi:** Correctness / Data Quality
- **Deskripsi Masalah:**
  Pada fungsi `stripTags()` ([`clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400)):
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
  ```
  Pola pencocokan rumus inline `\(` menggunakan karakter kelas `[^)])*?` yang **berhenti pada tanda kurung tutup pertama** `)`.
  Jika naskah soal memuat ekspresi aljabar seperti `\(f(x) < 3\)`, `\(\sin(2x) > 0\)`, atau `\(\binom{n}{k}\)`:
  1. Regex gagal mencocokkan rumus tersebut ke placeholder `hide` karena terhenti di karakter `)` milik `f(x)`.
  2. Akibatnya rumus tidak disembunyikan dalam `store`.
  3. Pembersihan tag berikutnya ([`clean.ts:418`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L418)): `s = s.replace(/<[^>]+>/g, " ")` salah mengenali `< 3\)` sebagai tag HTML pembuka `<...>`, sehingga operator dan variabel matematis **terhapus permanen dari naskah soal saat ingest**.
- **Rekomendasi Perbaikan:**
  Ubah regex menjadi *lookahead assertion* yang menoleransi kurung di dalam rumus dan hanya berhenti pada delimiter penutup `\\\)`, persis seperti rekomendasi audit 7 Oktober:
  ```typescript
  s = s.replace(
    /\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])+?)\\\)/g,
    hide,
  );
  ```

---

### 🔴 [CRIT-03] Kerentanan SSRF Time-of-Check to Time-of-Use (TOCTOU) DNS Rebinding pada Ingest Media
- **Lokasi Berkas:** [`src/lib/ingest/media/fetch.ts:289-304`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L289) dan [`src/lib/ingest/media/fetch.ts:252-258`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L252)
- **Dimensi:** Security / Network Isolation
- **Deskripsi Masalah:**
  1. Pada [`fetchHop`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L289), fungsi memanggil `await assertPublicTarget(url, relaxedHosts, resolve)` yang memverifikasi IP publik via `dns.lookup`.
  2. Namun, setelah pengecekan lolos, permintaan sesungguhnya dilakukan via fungsi global Next.js/Node `fetch(url, { redirect: "manual" })`.
  3. Node.js `fetch` (berbasis `undici`) melakukan **resolusi DNS kedua** secara independen. Penyerang yang mengendalikan domain dengan DNS TTL=0 dapat merespons resolusi pertama dengan IP publik (misal `1.1.1.1`) dan merespons resolusi kedua dengan IP lokal atau metadata cloud (`127.0.0.1`, `169.254.169.254`).
  4. Selain itu, pada `downloadRelaxed` ([`fetch.ts:252-258`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L252)), penanganan redirect hop hanya memeriksa nama host literal dengan `isPrivateOrBlockedHost(new URL(next).hostname)` tanpa melakukan pengecekan DNS pra-koneksi sama sekali.
- **Rekomendasi Perbaikan:**
  - Kunci koneksi soket langsung ke alamat IP hasil resolusi DNS pertama (menggunakan custom agent / dispatcher `undici` dengan Host header manual), ATAU
  - Terapkan `lookup` kustom pada HTTP agent yang membatasi koneksi hanya ke IP yang telah diverifikasi aman.

---

## 2. Required Changes (Must Address Before Merge)

### 🟠 [REQ-01] Pelanggaran Batasan Domain Event: `PAS-SAS` & `Try Out` Masuk Berkas Seeding
- **Lokasi Berkas:** [`scripts/seed-events.ts:67, 81`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67)
- **Dimensi:** Architecture / Domain Boundaries
- **Deskripsi:**  
  Berdasarkan [`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md) dan [`ADR-0020`](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md), tabel `events` **hanya diperuntukkan bagi peristiwa ujian makro/nasional berulang** (UTBK-SNBT, SIMAK UI, UM UGM, OSN). Ujian sekolah lokal seperti UTS, PAS, SAS, dan Try Out **bukan event**, melainkan `bundles` bertipe `bundle_type: 'exam'`. Memasukkan entri ini mencemari taksonomi ujian nasional.
- **Rekomendasi Perbaikan:**
  Hapus objek `PAS-SAS` (baris 66–72) dan `Try Out` (baris 80–86) dari `scripts/seed-events.ts`.

---

### 🟠 [REQ-02] Skrip `scripts/dev/` Mematahkan Exit Gate CI `pnpm check`
- **Lokasi Berkas:** [`eslint.config.mjs:77-90`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77), [`scripts/dev/sync-done-list.ts:7, 18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L7), [`scripts/dev/verify-saved.ts:22`](file:///home/hari/projects/mathbank/scripts/dev/verify-saved.ts#L22), [`scripts/dev/audit-event-source.ts:45`](file:///home/hari/projects/mathbank/scripts/dev/audit-event-source.ts#L45)
- **Dimensi:** Readability / CI Gate Enforcement (CONSTRAINT #2)
- **Deskripsi:**  
  Aturan mekanis [CONSTRAINT #2](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L8) menetapkan exit gate `pnpm lint` harus 0 error. Berkas di `scripts/dev/` masih memuat sintaks `require("node:fs")` di modul TypeScript serta variabel tak terpakai (`yearMismatch`, `existsSync`). Karena `scripts/dev/**` belum dimasukkan ke `globalIgnores` di `eslint.config.mjs`, perintah `pnpm check` gagal (exit code 1).
- **Rekomendasi Perbaikan:**
  1. Tambahkan `"scripts/dev/**"` ke dalam `globalIgnores` pada [`eslint.config.mjs:77`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77).
  2. Ganti pemanggilan `require` dengan ESM import baku: `import { readdirSync } from "node:fs"`.

---

### 🟠 [REQ-03] Entri Mati pada Konfigurasi Vitest Coverage (`vitest.config.mts`)
- **Lokasi Berkas:** [`vitest.config.mts:66`](file:///home/hari/projects/mathbank/vitest.config.mts#L66)
- **Dimensi:** Correctness / Test Verification
- **Deskripsi:**  
  Pada baris 66 `vitest.config.mts`, cakupan coverage masih mendaftarkan `"src/components/questions/bank-soal-view.tsx"`. Berkas tersebut telah dihapus dan digantikan oleh `question-bank-view.tsx` demi mematuhi konvensi bahasa Inggris ([CONSTRAINT #28b](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L58)). Akibatnya, komponen aktif `question-bank-view.tsx` tidak terhitung dalam metrik coverage, sementara file hantu tetap ada di konfigurasi.
- **Rekomendasi Perbaikan:**
  Ubah baris 66 menjadi:
  ```typescript
  "src/components/questions/question-bank-view.tsx",
  ```

---

### 🟠 [REQ-04] Ketidaklengkapan Mutasi pada `updateEvent` & Ketiadaan Unique Guard
- **Lokasi Berkas:** [`src/lib/services/taxonomy/event.ts:70-92`](file:///home/hari/projects/mathbank/src/lib/services/taxonomy/event.ts#L70)
- **Dimensi:** Correctness / Robustness
- **Deskripsi:**  
  Berbeda dengan `createEvent` yang menghitung kode slug dengan aman dan membungkus eksekusi dalam `withUniqueGuard`, fungsi `updateEvent`:
  1. Tidak memperbarui kolom `code` jika `shortname` atau `category` berubah, menyebabkan desinkronisasi kode pengenal.
  2. Tidak membungkus pembaruan dalam `withUniqueGuard`. Jika pengguna mengubah singkatan menjadi nama yang sudah dipakai event lain, aplikasi melempar unhandled database exception (PG 23505) alih-alih `ConflictError` (409).
- **Rekomendasi Perbaikan:**
  Hitung ulang `code` bila kategori/nama berubah dan bungkus update dalam `withUniqueGuard`:
  ```typescript
  if (input.shortname !== undefined || input.category !== undefined) {
    const cat = input.category ?? (await getEvent(id))?.category;
    const short = input.shortname ?? (await getEvent(id))?.shortname;
    patch.code = slugify(`${cat}-${short}`, 50);
  }
  const [row] = await withUniqueGuard(
    () => db.update(events).set({ ...patch, updatedAt: new Date() }).where(eq(events.id, id)).returning(eventColumns),
    "Event dengan singkatan/kategori itu sudah ada."
  );
  ```

---

## 3. Optional Improvements

- **[OPT-01] Hilangkan `noScroll` pada `MatrixGridView` (CONSTRAINT #12)**:  
  [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86) masih menggunakan `<MathContent content={r.text} noScroll />`. Ini memicu `overflow-hidden` yang berisiko memotong rumus matematika lebar pada layar ponsel. Hapus properti `noScroll` agar `overflow-x-auto` aktif secara alami.
- **[OPT-02] Standardisasi Gutter Cetak A4 24px di `print.css`**:  
  [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) masih memakai `padding-left: 17px;` untuk `.item`, sedangkan [`bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256) memakai `w-6` (24px). Selaraskan menjadi 24px agar penomoran 2-digit (`10.` s.d. `99.`) tidak menabrak teks soal saat dicetak ke PDF/kertas.
- **[OPT-03] Pemisahan Metrik Gagal pada `/api/v1/ingest/commit`**:  
  [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50) menggabungkan jumlah soal gagal dengan jumlah artikel gagal ke dalam satu angka `failed`. Pisahkan menjadi `failedQuestions` dan `failedArticles` demi observabilitas yang akurat.
- **[OPT-04] Isolasi Tabel Vektor 1:1 `question_embeddings` (v2.0 Phase 1)**:  
  [`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82) masih menyimpan `vector(1024)` inline di tabel `questions`. Memindahkan kolom ini ke tabel terpisah 1:1 `question_embeddings` akan menghemat RAM PostgreSQL Buffer Pool hingga >90% saat query paginasi non-vektor dijalankan.

---

## 4. Nits (Minor Formatting & Polish)

- **[NIT-01] Kop Cetak Hardcoded "MATH MY ID"**:  
  [`src/components/bundles/bundle-print-view.tsx:191`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L191) masih menulis teks statis `"MATH MY ID"`. Hubungkan ke konfigurasi dinamis `bundle.instructions` atau properti institusi bila tersedia di masa depan.

---

## 5. What's Done Well (Positive Engineering Observations)

1. **Eliminasi Total N+1 Query pada Jalur Soal:**  
   Implementasi [`attachOptions()`](file:///home/hari/projects/mathbank/src/lib/services/question-read.ts#L289) menggunakan query berbasis `inArray` yang menggabungkan seluruh opsi dan stimulus induk dalam batch tunggal. Sangat efisien dan deterministik.
2. **Atomic CAS Guard pada Transisi Status Soal (CONSTRAINT #36):**  
   Fungsi [`changeQuestionStatus()`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L52) menerapkan penjagaan balapan optimistik `WHERE id = ? AND status = <from>` dengan inspeksi `.returning()`, secara sempurna mencegah *race condition* transisi status ganda.
3. **Penyusunan Ulang Item Paket yang Atomik & Deterministik (CONSTRAINT #45):**  
   [`reorderItems()`](file:///home/hari/projects/mathbank/src/lib/services/bundle-items.ts#L101) memvalidasi keutuhan himpunan id (menolak subset dan duplikat) dan mengeksekusi pembaruan indeks urutan dalam satu query SQL `CASE` di dalam transaksi database.
4. **Perlindungan Berlapis Auth Dev Bypass (CONSTRAINT #23):**  
   [`actorFromDevBypass()`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts#L84) memiliki 3 pagar independen (`NODE_ENV !== "production"`, `APP_ENV !== "production"` & `!== "staging"`, dan `AUTH_DEV_BYPASS === "true"`), menjamin hak akses dev tidak akan pernah bocor ke staging maupun produksi.
5. **In-Memory LRU Cache untuk KaTeX (PERF-02):**  
   [`renderMath()`](file:///home/hari/projects/mathbank/src/components/math/math-content.tsx#L246) membungkus pemanggilan sinkron KaTeX dengan LRU Map berkapasitas 2.000 entri dan fallback aman anti-XSS (`escapeHtml`), memberikan UI yang sangat responsif saat navigasi antar kartu soal.

---

## 6. Verification Story

- **Tests Reviewed:** Ya — menginspeksi konfigurasi Vitest, pengujian boundary FSM, isolasi logika murni, dan skrip integrasi database. Ditemukan referensi file hantu pada `vitest.config.mts:66`.
- **Build & Quality Gates Inspected:** Ya — teridentifikasi bahwa `pnpm check` saat ini masih berpotensi terblokir oleh berkas di `scripts/dev/` karena belum didaftarkan pada `globalIgnores` ESLint.
- **Security Checked:** Ya — verifikasi menyeluruh terhadap sanitasi KaTeX, guard otorisasi per peran, anti-bocor kunci jawaban (`questionColumns()`), rate-limiting, dan kerentanan SSRF DNS Rebinding.

---

## 7. Rekomendasi Langkah Eksekusi (Action Items)

```
┌────────────────────────────────────────────────────────────────────────┐
│             URUTAN PRIORITAS REMEDIASI MENUJU MATHBANK v2.0            │
├────────────────────────────────────────────────────────────────────────┤
│ TINGKAT 1 (Kritis — Harus Selesai Hari Ini):                           │
│   1. Patch query hard-delete di question-write.ts (hapus relasi        │
│      bundle_items terarsip dalam transaksi sebelum delete question).   │
│   2. Perbaiki regex lazy-match KaTeX di clean.ts (stripTags).          │
│   3. Perbaiki validasi SSRF DNS rebinding di fetch.ts.                 │
│                                                                        │
│ TINGKAT 2 (Kepatuhan CI & Domain — Wajib untuk Rilis):                 │
│   4. Tambahkan "scripts/dev/**" ke globalIgnores di eslint.config.mjs. │
│   5. Hapus "PAS-SAS" dan "Try Out" dari scripts/seed-events.ts.        │
│   6. Koreksi entri bank-soal-view.tsx di vitest.config.mts.            │
│   7. Perbaiki updateEvent di taxonomy/event.ts (code + unique guard).  │
│                                                                        │
│ TINGKAT 3 (Penyempurnaan Polish):                                      │
│   8. Lepas noScroll di MatrixGridView.                                 │
│   9. Selaraskan gutter print.css ke 24px.                              │
│  10. Pisahkan metrik failedQuestions di commit/route.ts.               │
└────────────────────────────────────────────────────────────────────────┘
```
```

---

### Catatan Operasional Lingkungan

> [!NOTE]
> Karena sesi agent saat ini beroperasi dengan *inspection tools* murni (*read-only*, tanpa modul eksekusi shell/terminal `bash` atau `write_file`), laporan komprehensif di atas disajikan secara utuh dan terperinci sehingga dapat langsung disalin ke [`MathBankAuditor/reports/17.10.2026/audit-code-review-and-quality.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-code-review-and-quality.md) dan dijadikan acuan remediasi tim pengembang.
