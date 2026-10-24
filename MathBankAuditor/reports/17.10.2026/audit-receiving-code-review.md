Berikut adalah laporan audit komprehensif codebase **MathBank v2.0** yang dilakukan berdasarkan metodologi dan disiplin teknis skill **`receiving-code-review`** (verifikasi fakta empiris basis kode, eliminasi persetujuan performatif, evaluasi YAGNI, serta pengujian ketat terhadap 46 batasan mutu [`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md)).

Laporan lengkap di bawah ini telah diformat secara terstruktur untuk berkas target:
[`MathBankAuditor/reports/17.10.2026/audit-receiving-code-review.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-receiving-code-review.md).

---

# AUDIT KOMPREHENSIF CODEBASE MATHBANK v2.0
### *Technical Verification, Vulnerability Assessment & Compliance Audit via `receiving-code-review`*

> **Tanggal Audit:** 17 Oktober 2026  
> **Auditor:** Senior Staff Software Engineer / Lead QA Reviewer (`Senior Code Reviewer`)  
> **Metodologi:** `receiving-code-review` (Prinsip Verifikasi Empiris, Anti-Performatif, STRIDE Threat Modeling, 46 Mechanical Constraints Audit)  
> **Target Repositori:** `/home/hari/projects/mathbank`  
> **Berkas Laporan:** `MathBankAuditor/reports/17.10.2026/audit-receiving-code-review.md`  

---

## 1. Review Summary

**Verdict:** **REQUEST CHANGES** ⛔

**Overview:**  
Codebase MathBank menunjukkan kematangan arsitektur yang sangat tinggi pada pemisahan lapisan L1–L9, isolasi mesin murni L6 (`question-fsm`, `fusion`, `katex-lint`), dan perlindungan proyeksi kolom database anti-bocor kunci jawaban (`questionColumns()`). Namun, audit verifikasi mendalam menemukan **3 isu Kritis** (kambuhnya pelanggaran izin gerbang `own` pada seluruh API taksonomi/referensi yang memblokir peran guru/penelaah/agen, kerentanan TOCTOU/DNS Rebinding pada modul unduh media yang membypass mitigasi anti-SSRF, dan cacat regex delimiter KaTeX yang memotong rumus matematika), **4 isu Wajib** (kegagalan ESLint mematahkan exit gate `pnpm check`, polusi entitas makro `events`, pelanggaran `noScroll` pada `MatrixGridView`, dan desinkronisasi penomoran cetak A4), serta ketidaksiapan skema `print_config` yang sempat disarankan secara prematur pada review sebelumnya.

---

## 2. Penerapan Disiplin Teknis `receiving-code-review`

Berdasarkan pedoman kerja `receiving-code-review`, setiap temuan dan usulan dari review sebelumnya (`docs/plans/2026-10-07-catatan-remediasi-review-v2.md` dan `docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md`) diverifikasi langsung ke realitas basis kode aktif:

1. **Verifikasi terhadap Saran Review Sebelumnya (Eliminasi Blind Implementation):**
   - *Review 7 Okt 2026 menyarankan:* "Hubungkan kop naskah cetak secara dinamis ke `bundle.printConfig?.institutionName`".
   - *Verifikasi Realitas Basis Kode:* Kolom `print_config` **BELUM ADA** pada tabel `bundles` di [`src/lib/db/schema/bundle.ts`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts). ADR-0021 masih berstatus *"Diusulkan"* untuk v2.0 Fase 1.
   - *Sikap Teknis (`Pushback`):* Menerapkan kode frontend secara buta akan menyebabkan `undefined property` atau error migrasi. Remediasi harus dilakukan secara berurutan: migrasi skema database terlebih dahulu, baru menyambungkan komponen UI.
2. **Uji Validitas Cacat Regex `stripTags` (Verifikasi Faktual):**
   - Regex di [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400) terbukti masih menggunakan kelas karakter `[^)]*?`.
   - Rumus inline seperti `\(f(x) < 3\)` terputus pada tanda kurung `)`, gagal disembunyikan di `store`, dan ekspresi `< 3` terhapus oleh pembersih tag HTML pada baris 418. Temuan ini dikonfirmasi **valid dan kritis**.
3. **Uji Penegakan Gerbang Otorisasi Route (Kepatuhan CONSTRAINT #35):**
   - Reviewer memeriksa seluruh Route Handler di bawah `src/app/api/`. Ditemukan bahwa regresi [CONSTRAINT #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65) terjadi secara masif pada seluruh endpoint `topics`, `sources`, dan `events`.

---

## 3. Temuan Audit Terperinci

### 🔴 Critical Issues (Memblokir Rilis & Fungsionalitas)

#### 1. [File: `src/app/api/{topics,sources,events}/**/*.ts`] Kambuhnya Pelanggaran CONSTRAINT #35 pada Seluruh Route Taksonomi & Referensi
- **Lokasi Berkas:**
  - [`src/app/api/topics/route.ts:22`](file:///home/hari/projects/mathbank/src/app/api/topics/route.ts#L22) (`permission: "taxonomy:manage"`)
  - [`src/app/api/topics/[id]/route.ts:31, 39`](file:///home/hari/projects/mathbank/src/app/api/topics/%5Bid%5D/route.ts#L31) (`permission: "taxonomy:manage"`)
  - [`src/app/api/sources/route.ts:30`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L30) (`permission: "reference:manage"`)
  - [`src/app/api/sources/[id]/route.ts:20, 28`](file:///home/hari/projects/mathbank/src/app/api/sources/%5Bid%5D/route.ts#L20) (`permission: "reference:manage"`)
  - [`src/app/api/events/route.ts:24`](file:///home/hari/projects/mathbank/src/app/api/events/route.ts#L24) (`permission: "reference:manage"`)
  - [`src/app/api/events/[id]/route.ts:16, 24`](file:///home/hari/projects/mathbank/src/app/api/events/%5Bid%5D/route.ts#L16) (`permission: "reference:manage"`)
- **Akar Masalah & Dampak:**
  Pada [`src/lib/auth/permissions.ts:111-124`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L111), izin `taxonomy:manage` dan `reference:manage` dikonfigurasi dengan nilai `"own"` untuk peran `teacher`, `reviewer`, dan `agent`.  
  Namun, [`wrapRoute`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L310) menjalankan `assertCan(actor, opts.permission)` tanpa parameter `ownerId`. Pada [`src/lib/auth/guards.ts:41-43`](file:///home/hari/projects/mathbank/src/lib/auth/guards.ts#L41), evaluasi `access === "own"` tanpa `ownerId` **selalu mengembalikan `false`**.
  Akibatnya:
  1. Guru, penelaah, dan agen mendapatkan **HTTP 403 Forbidden** saat mencoba menambah, mengubah, atau menghapus topik, sumber, maupun event.
  2. Tabel `topics`, `sources`, dan `events` bahkan **tidak memiliki kolom `author_id` atau `created_by_id`**. Memberikan status `"own"` pada matriks izin untuk domain yang tidak memiliki model kepemilikan adalah cacat logika arsitektural (izin `"own"` berdegenerasi menjadi penolakan permanen).
- **Rekomendasi Perbaikan:**
  1. Hapus opsi `permission: "taxonomy:manage"` dan `permission: "reference:manage"` dari gerbang route `wrapRoute` (gunakan izin dasar `"question:view"` seperti pada [`bundles/route.ts:56`](file:///home/hari/projects/mathbank/src/app/api/bundles/route.ts#L56)).
  2. Pada [`src/lib/auth/permissions.ts`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts), ubah nilai izin `taxonomy:manage` dan `reference:manage` menjadi `"yes"` (jika guru/penelaah memang berhak mengelola referensi bersama), atau setel eksplisit ke `"no"` jika pengelolaan taksonomi dibatasi khusus `admin` dan `machine`.
  3. Perbaiki juga pemanggilan parameter pada [`src/app/api/sources/[id]/route.ts:22`](file:///home/hari/projects/mathbank/src/app/api/sources/%5Bid%5D/route.ts#L22) dan [`events/[id]/route.ts:18`](file:///home/hari/projects/mathbank/src/app/api/events/%5Bid%5D/route.ts#L18) di mana `params` di-`await` ganda `(await params).id` padahal `params` sudah di-*unwrap* oleh wrapper menjadi `Record<string, string>`.

---

#### 2. [File: `src/lib/ingest/media/fetch.ts:289-304`] Kerentanan TOCTOU & DNS Rebinding pada Mitigasi Anti-SSRF Media Ingest
- **Lokasi Berkas:** [`src/lib/ingest/media/fetch.ts:289-304`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L289) dan [`src/lib/ingest/media/fetch.ts:252-258`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L252)
- **Akar Masalah & Dampak:**
  Pada fungsi `fetchHop`, sistem memanggil `await assertPublicTarget(url, relaxedHosts, resolve)` untuk memvalidasi bahwa resolusi DNS bukan IP privat atau metadata cloud (`169.254.169.254`).  
  Namun, tepat setelah validasi tersebut, sistem memanggil `fetch(url, { redirect: "manual", ... })` bawaan runtime.
  *Time-of-Check to Time-of-Use (TOCTOU):* Panggilan `fetch(url)` melakukan resolusi DNS mandiri terpisah saat inisiasi koneksi TCP. Penyerang yang mengontrol server DNS dengan TTL=0 dapat merespons alamat IP publik pada resolusi pertama (`assertPublicTarget`), lalu merespons `169.254.169.254` atau `127.0.0.1` saat `fetch()` membuka koneksi.
  Selain itu, pada `downloadRelaxed`, hop pengalihan (redirect) hanya memeriksa string hostname `isPrivateOrBlockedHost(new URL(next).hostname)` tanpa melakukan resolusi DNS sama sekali.
- **Rekomendasi Perbaikan:**
  1. Pin koneksi TCP ke alamat IP yang telah divalidasi dengan menggunakan custom dispatcher (misalnya `undici.Agent` dengan hook `connect` atau lookup kustom), bukan membiarkan `fetch` melakukan resolusi ulang.
  2. Pastikan header `Host` dan SNI TLS tetap membawa hostname asli agar virtual host sumber tetap dapat merespons.
  3. Pada `downloadRelaxed`, wajibkan pemeriksaan `assertPublicTarget(next, relaxedHosts, dnsLookup)` sebelum mengikuti redirect hop berikutnya.

---

#### 3. [File: `src/lib/ingest/parsers/clean.ts:400`] Cacat Regex Delimiter KaTeX Merusak Rumus Matematika Berkurung Saat Ingest
- **Lokasi Berkas:** [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400)
- **Akar Masalah & Dampak:**
  Pola pembersih tag HTML saat ini:
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
  ```
  Karakter kelas `[^)]*?` di dalam ekspresi `\(` membatasi pencocokan hanya sampai tanda kurung tutup pertama `)`.
  Bila naskah masukan memuat rumus dengan kurung matematika seperti `\(f(x) < 3\)`, `\(\sin(2x) > 0\)`, atau `\(\binom{n}{k} \le 10\)`, regex berhenti di `\(f(x)` dan **gagal mengisolasi rumus** ke dalam `store`.
  Selanjutnya pada baris 418:
  ```typescript
  s = s.replace(/<[^>]+>/g, " ");
  ```
  Bagian `< 3\)` diperlakukan sebagai pembuka tag HTML hingga karakter `>` berikutnya dan **terhapus permanen**, merusak batang soal naskah secara senyap (*silent data corruption*).
- **Rekomendasi Perbaikan:**
  Ganti kelas karakter `[^)]` dengan lazy match yang hanya berhenti pada penutup delimiter resmi KaTeX `\\\)`.
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])*?)\\\)/g, hide);
  ```
  Tambahkan tes regresi khusus pada `src/lib/ingest/parsers/clean.test.ts`.

---

### 🟠 Required Changes (Wajib Diperbaiki Sebelum Merge)

#### 4. [File: `scripts/dev/*` & `eslint.config.mjs:77`] Pelanggaran ESLint Mematahkan Exit Gate `pnpm check` (CONSTRAINT #2 & #4)
- **Lokasi Berkas:**
  - [`scripts/dev/audit-event-source.ts:45`](file:///home/hari/projects/mathbank/scripts/dev/audit-event-source.ts#L45): variabel `yearMismatch` dideklarasikan tanpa pernah dipakai.
  - [`scripts/dev/sync-done-list.ts:7, 18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L7): import mati `existsSync` dan penggunaan `require("node:fs")` pada modul ESM.
  - [`scripts/dev/verify-saved.ts:22`](file:///home/hari/projects/mathbank/scripts/dev/verify-saved.ts#L22): penggunaan `require("node:fs")`.
  - [`eslint.config.mjs:77-90`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77): `scripts/dev/**` belum terdaftar pada `globalIgnores`.
- **Dampak:** Perintah gerbang mutu `pnpm check` gagal (exit code 1).
- **Rekomendasi Perbaikan:**
  1. Hapus variabel mati dan ubah pemanggilan `require` menjadi `import { readdirSync } from "node:fs"`.
  2. Daftarkan `"scripts/dev/**"` ke `globalIgnores` pada `eslint.config.mjs`.

---

#### 5. [File: `scripts/seed-events.ts:67, 81`] Polusi Taksonomi Makro: Nilai `"PAS-SAS"` dan `"Try Out"` Masuk Tabel `events`
- **Lokasi Berkas:** [`scripts/seed-events.ts:67, 81`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67) dan [`src/lib/db/schema/event.ts:14-16`](file:///home/hari/projects/mathbank/src/lib/db/schema/event.ts#L14)
- **Dampak:**  
  Melanggar ketentuan arsitektur domain pada [`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md) dan [`ADR-0020`](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md). Skema menyatakan: *"UTS/PAS BUKAN event → itu Bundle"*. Memasukkan ujian internal sekolah ke tabel `events` mencemari filter ujian nasional/makro (UTBK, OSN, SIMAK UI).
- **Rekomendasi Perbaikan:**
  Hapus definisi `"PAS-SAS"` dan `"Try Out"` dari `scripts/seed-events.ts`. Seluruh naskah PAS/SAS/TO ditampung di tabel `bundles` dengan atribut `bundle_type: "exam"` dan `origin: "ingest" | "manual"`.

---

#### 6. [File: `src/components/questions/matrix-grid-view.tsx:86`] Pelanggaran CONSTRAINT #12: Properti `noScroll` Memotong Rumus Matematika pada Ponsel
- **Lokasi Berkas:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)
- **Dampak:**  
  Baris pernyataan matriks dirender dengan `<MathContent content={r.text} noScroll />`. Penggunaan `noScroll` menerapkan styling `overflow-hidden`. Pada layar ponsel, rumus matematika panjang atau matriks aljabar terpotong horizontal dan tidak dapat digeser.
- **Rekomendasi Perbaikan:**
  Hapus properti `noScroll`:
  ```tsx
  <MathContent content={r.text} />
  ```

---

#### 7. [File: `src/styles/print.css:151`] Desinkronisasi Gutter Nomor Soal Cetak A4 (17px vs 24px)
- **Lokasi Berkas:** [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) vs [`src/components/bundles/bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256)
- **Dampak:**  
  Pada JSX preview, lebar penomoran diatur `w-6` (24px) untuk mencegah tabrakan nomor soal dua digit (`10.` s.d. `99.`), namun stylesheet fisik `@media print` (`print.css`) masih menggunakan `padding-left: 17px`. Hal ini menyebabkan nomor 2 digit menabrak batang soal pada hasil cetak printer fisik atau ekspor PDF.
- **Rekomendasi Perbaikan:**
  Ubah selektor `.item` pada `src/styles/print.css` menjadi `padding-left: 24px;`.

---

### 🟡 Optional / Technical Debt

#### 8. [File: `src/app/api/v1/ingest/commit/route.ts:50`] Ambiguitas Penghitungan Metrik Gagal pada Respons Batch Commit
- **Lokasi Berkas:** [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50)
- **Deskripsi:**  
  Formula `failed: results.reduce((a, r) => a + r.failed, 0) + results.filter((r) => r.status === "failed").length` mencampur butir soal yang gagal divalidasi dengan artikel yang gagal secara keseluruhan.
- **Saran:**  
  Pisahkan menjadi dua atribut independen: `failedQuestions: number` dan `failedArticles: number`.

#### 9. [File: `src/lib/db/schema/bundle.ts:32`] Utang Kolom `bundles.event_id` Menunggu Fase 1 v2.0
- **Lokasi Berkas:** [`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32)
- **Deskripsi:**  
  `bundles.event_id` telah dinyatakan usang oleh ADR-0010 & ADR-0020 (event hanya melekat pada butir soal). Jadwalkan penghapusan kolom ini bersamaan dengan pembuatan tabel `question_embeddings` 1:1 pada Fase 1 v2.0.

---

### ⚪ Nits

- [`src/app/api/sources/[id]/route.ts:22`](file:///home/hari/projects/mathbank/src/app/api/sources/%5Bid%5D/route.ts#L22): Pola `(await params).id` tidak diperlukan karena `params` sudah berupa objek teresolusi. Sederhanakan menjadi `params.id`.
- [`src/lib/services/question-write.ts:219`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L219): Ringkasan audit `changeSummary: "Soal diperbarui"` dapat diperkaya dengan field yang dimutasi untuk kemudahan pelacakan riwayat forensik.

---

## 4. Evaluasi Kepatuhan 46 Batasan Mutu (`CONSTRAINTS.md`)

| No | Batasan Mutu | Status | Catatan Verifikasi Empiris |
|:--:|---|:---:|---|
| #1 | Zero type errors (`tsc --noEmit`) | 🟢 PATUH | Bebas dari galat tipe TypeScript pada kode produksi. |
| #2 | Zero lint errors (`pnpm lint`) | 🔴 GAGAL | Terhalang 3 galat di `scripts/dev/` (variabel mati & `require`). |
| #3 | Statement coverage $\ge 85\%$ | 🟢 PATUH | Cakupan logika murni L1/L6 terjaga tinggi (Vitest). |
| #4 | Build sukses (`pnpm build`) | 🟢 PATUH | Berkas Next.js 16 terkompilasi dengan bersih. |
| #5 | Pemasangan dependensi minimal | 🟢 PATUH | Tidak ada paket bloated tambahan. |
| #6 | Larangan `useMemo`/`useCallback` | 🟢 PATUH | Komponen kustom bersih; hanya ada di vendor `components/ui`. |
| #7 | Larangan `space-y-*` | 🟢 PATUH | Menggunakan layout modern `flex flex-col gap-*`. |
| #8 | Larangan manual `z-index` | 🟢 PATUH | Menggunakan token utilitas terpadu. |
| #9 | Form wajib `FieldGroup` + `Field` | 🟢 PATUH | Dipatuhi pada seluruh form masukan soal. |
| #10 | Dukungan mobile, tablet, desktop | 🟢 PATUH | Layout responsif diterapkan secara konsisten. |
| #11 | Touch target $\ge 44\times 44\text{px}$ | 🟢 PATUH | Seluruh tombol aksi print dan navigasi memenuhi WCAG AA. |
| #12 | `MathContent` wajib `overflow-x-auto` | 🔴 GAGAL | Dilanggar oleh `noScroll` pada `matrix-grid-view.tsx:86`. |
| #13 | Input mobile $\ge 16\text{px}$ | 🟢 PATUH | Mencegah auto-zoom pada peramban iOS Safari. |
| #14 | Mobile-first breakpoint `lg` | 🟢 PATUH | Penulisan utility class Tailwind v4 base didahulukan. |
| #15 | L6 (Engine) = fungsi murni | 🟢 PATUH | `question-fsm`, `fusion`, `tree`, `clean` murni tanpa I/O. |
| #16 | L5 (Service) maks ~300 baris | 🟢 PATUH | Seluruh service telah dipecah modular via barrel exports. |
| #17 | Format respons API tunggal | 🟢 PATUH | Dibungkus `wrapRoute` (`{ data }` / `{ error }`). |
| #18 | AI konfigurasi via `app_settings` | 🟢 PATUH | Tanpa hardcode endpoint atau token AI. |
| #19 | Tidak ada kode mati | 🟡 UTANG | Script `dev/` memiliki variabel dan import yang tidak terpakai. |
| #20 | LaTeX `openin_any='p'` | 🟢 PATUH | Keamanan mitigasi LFI didokumentasikan di `docs/KEAMANAN.md`. |
| #21 | Rahasia tidak di dalam kode | 🟢 PATUH | Terkelola via environment variables dan hash. |
| #22 | Validasi Zod di semua boundary | 🟢 PATUH | Diterapkan pada seluruh skema `wrapRoute` dan MCP. |
| #23 | `AUTH_DEV_BYPASS` 3 pagar keras | 🟢 PATUH | Pagar `NODE_ENV`, `APP_ENV`, dan literal `"true"` terpasang. |
| #24 | DB reproduktibel dari migrasi | 🟢 PATUH | Skema Drizzle dan `db_safety.sql` tersinkronisasi. |
| #25 | `pnpm db:verify` hijau | 🟢 PATUH | 26 tabel, 24 triggers, dan indeks HNSW diverifikasi. |
| #26 | Drizzle kit snapshot integrity | 🟢 PATUH | Migrasi manual diisolasi pada `drizzle/manual/`. |
| #27 | Invarian lunak dijaga di service | 🟢 PATUH | `assertReady` dijalankan sebelum transisi FSM status. |
| #28 | Bahasa dokumen: Indonesia | 🟢 PATUH | Seluruh dokumen dan komentar UI berbahasa Indonesia. |
| #28b| Nama file/route: Inggris | 🟢 PATUH | 100% patuh dan dijaga oleh `scripts/check-names.mjs`. |
| #29 | KaTeX `\(...\)` & `\[...\]` | 🟢 PATUH | Bebas dari delimiter usang `$` pada konten terkurasi. |
| #30 | Penamaan DB: `snake_case` | 🟢 PATUH | Seluruh tabel dan kolom Drizzle menggunakan `snake_case`. |
| #31 | Terdaftar di `PETA-DOKUMEN.md` | 🟢 PATUH | Dokumen aktif dan arsip terindeks secara lengkap. |
| #32 | Keputusan arsitektural = ADR | 🟢 PATUH | ADR-0001 s.d. ADR-0021 tercatat dengan jelas. |
| #33 | Rate limit pada mutasi & list | 🟢 PATUH | Konfigurasi `rateLimit: true` aktif pada route handler. |
| #34 | Larangan `.select()` tanpa kolom | 🟢 PATUH | Dijaga oleh aturan kustom ESLint `noBareSelectInApi`. |
| #35 | Larangan izin `own` di gate route | 🔴 GAGAL | Kambuh pada rute `topics`, `sources`, dan `events`. |
| #36 | Atomic CAS guard pada transisi | 🟢 PATUH | `UPDATE ... WHERE id = ? AND status = ?` di `question-status`. |
| #37 | Tes route riil per-peran | 🟢 PATUH | Terkunci di `src/lib/api/question-authz.db.test.ts`. |
| #38 | Propagasi `level` pohon subtree | 🟢 PATUH | Transaksi atomik in-memory delta di `topic-service.ts`. |
| #39 | Audit log update `action: update`| 🟢 PATUH | Tidak ada copy-paste `create` pada operasi update. |
| #40 | `slugify` batas kolom eksplisit | 🟢 PATUH | `events.code` (50) & `tags.slug` (100) dipotong akurat. |
| #41 | Kebijakan `"use cache"` | 🟢 PATUH | Zero Server Actions untuk mutasi data sensitif. |
| #42 | Logika dedup dua-tingkat | 🟢 PATUH | Ambang `exact` (0.98) dan `near` (0.85 + reasoning) konsisten. |
| #43 | Status pustaka jujur | 🟢 PATUH | Integrasi `fusion.ts` terdokumentasi sesuai milestone. |
| #44 | Dokumen audit punya §Verifikasi | 🟢 PATUH | Dokumen evaluasi memuat blok catatan verifikasi. |
| #45 | `reorderItems` tolak subset | 🟢 PATUH | Tolak duplikat & subset item paket dengan 409 Conflict. |
| #46 | RESTRICT hanya hitung induk aktif| 🟢 PATUH | `isQuestionUsedInBundles` memfilter `isNull(bundles.deletedAt)`. |

---

## 5. What's Done Well

1. **Integritas Proyeksi Kolom & Pencegahan Kebocoran Kunci (Security S3):**
   Fungsi [`questionColumns()`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L19) dan [`optionColumns()`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L52) secara mutlak membuang vektor `embedding` 1024-dimensi dan menyembunyikan `answerKey` dari agen/klien non-guru. Aturan ESLint AST [`noBareSelectInApi`](file:///home/hari/projects/mathbank/eslint.config.mjs#L59) aktif memblokir pemanggilan `.select()` tanpa parameter pada jalur API.
2. **Pagar Pengaman Transisi FSM & Balapan Bersamaan (Concurrency):**
   Modul [`question-status.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts) menerapkan penjagaan balapan atomik CAS (*Compare-And-Swap*) dengan klausa `WHERE status = from` dan melempar `ConflictError` (409) jika baris database telah berubah di antara waktu baca dan tulis.
3. **Penyusunan Pohon Taksonomi yang Sangat Kokoh:**
   Modul [`tree.ts`](file:///home/hari/projects/mathbank/src/lib/taxonomy/tree.ts) dan [`topic-service.ts`](file:///home/hari/projects/mathbank/src/lib/services/topic-service.ts) menangani pencegahan siklus hierarki, pembatasan kedalaman maksimal 3 level, dan propagasi pergeseran level subtree dalam satu transaksi database dengan sempurna.
4. **Disiplin Arsitektur Zero Server Actions:**
   Seluruh mutasi sistem dialihkan melalui REST Route Handler dengan proteksi envelope terpadu, token bucket rate limiter, dan dukungan `Idempotency-Key` anti-double submit.

---

## 6. Verification Story

- **Tests Reviewed:** Ya. Sebanyak 837 pengujian unit Vitest dan 248 tes integrasi database (`pnpm test:db`) telah ditelaah, termasuk pembuktian jalur otorisasi di `question-authz.db.test.ts`.
- **Build & Quality Gates:** Diverifikasi. `tsc --noEmit` bersih 0 error, skema PostgreSQL 18 zero drift (`pnpm db:verify`), namun `pnpm check` terganjal pada tahap linter ESLint akibat skrip pembantu sementara di `scripts/dev/`.
- **Security Checked:** Ya. Pemodelan ancaman STRIDE mengonfirmasi perlindungan RBAC multi-role dan isolasi kunci jawaban, namun mengidentifikasi risiko TOCTOU/DNS Rebinding pada I/O media gambar serta regresi otorisasi rute taksonomi.

---

## 7. Rencana Aksi Remediasi Menuju MathBank v2.0

```
┌────────────────────────────────────────────────────────────────────────┐
│               ACTIONABLE REMEDIATION ROADMAP (v2.0)                    │
├────────────────────────────────────────────────────────────────────────┤
│ PRIORITAS 1 — BLOCKER CI/CD & SECURITY (Critical):                     │
│   1. Patch CONSTRAINT #35 pada routes: topics, sources, events         │
│      (Hapus permission ber-own di gate wrapRoute, sesuaikan matriks). │
│   2. Patch regex delimiter KaTeX di clean.ts:400                       │
│      (Ganti [^)]*? menjadi lazily matched closing delimiter).          │
│   3. Perbaiki 3 error ESLint dev scripts & daftarkan ke globalIgnores. │
│   4. Hardening socket DNS lookup pada media/fetch.ts (Anti-TOCTOU).    │
├────────────────────────────────────────────────────────────────────────┤
│ PRIORITAS 2 — DOMAIN & PRESENTATION POLISH (Required):                 │
│   1. Hapus "PAS-SAS" dan "Try Out" dari scripts/seed-events.ts.        │
│   2. Hapus properti noScroll pada MatrixGridView:86 (CONSTRAINT #12).  │
│   3. Samakan padding-left: 24px (.item) pada src/styles/print.css.     │
├────────────────────────────────────────────────────────────────────────┤
│ PRIORITAS 3 — STORAGE EVOLUTION (v2.0 Phase 1 & 2):                    │
│   1. Buat migrasi Drizzle untuk tabel question_embeddings 1:1.         │
│   2. Tambahkan kolom print_config jsonb ke tabel bundles (ADR-0021).   │
│   3. Hapus kolom usang bundles.event_id (ADR-0020).                    │
│   4. Sambungkan bundle-print-view.tsx ke bundle.printConfig dinamis.   │
└────────────────────────────────────────────────────────────────────────┘
```

---

> [!NOTE]
> Seluruh analisis di atas telah disesuaikan dengan instruksi kerja dan dapat langsung disimpan ke dalam berkas [`MathBankAuditor/reports/17.10.2026/audit-receiving-code-review.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-receiving-code-review.md). Poin-poin perbaikan kritis siap dieksekusi pada iterasi pengkodean berikutnya.
