# CATATAN REMEDIASI REVIEW KODE MENUJU MATHBANK v2.0
### *Actionable Remediation Backlog & Quality Gate Hardening*

> **Status:** ⏳ Direncanakan untuk Eksekusi Tim Pengembang (MathBank v2.0)  
> **Tanggal:** 7 Oktober 2026  
> **Otoritas:** Principal Software Architect & QA Code Reviewer  
> **Target Repositori:** MathBank (`/home/hari/projects/mathbank`)  
> **Dokumen Terkait:** `docs/RENCANA-MATHBANK-V2.md`, `CONSTRAINTS.md`, `docs/ADR/README.md`, `docs/PETA-DOKUMEN.md`

---

## 1. Konteks & Latar Belakang

Pada 7 Oktober 2026, dilakukan penelaahan kode komprehensif (*AI-Powered Multi-Axis Code Review*) pada branch aktif `paperclip/dev` menjelang stabilisasi MathBank v2.0. Penelaahan ini mengombinasikan *static analysis*, verifikasi mekanis 46 batasan mutu ([`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md)), pengujian integrasi database riil, dan pemodelan ancaman (*STRIDE Threat Modeling*).

Secara arsitektural umum, MathBank berada dalam kondisi prima:
- **Zero Type Errors:** `tsc --noEmit` bersih 0 galat.
- **Integritas Database:** PostgreSQL 18 zero drift (`pnpm db:verify`), 248 tes DB integration lulus (`pnpm test:db`).
- **Unit & Kontrak:** 837 pengujian Vitest lulus 100% (`pnpm test`).
- **Keamanan:** Pipa otorisasi terlindungi `wrapRoute()`, 0 penggunaan Server Actions (`"use server"`), dan guard anti-bocor kunci jawaban (`questionColumns()`).
- **A11y:** Kontras tema 34/34 WCAG 2.2 AA (`pnpm theme:check`), dan nama file 100% patuh bahasa Inggris (`pnpm lint:names`).

Namun, audit menemukan **7 cacat riil** yang wajib diremediasi sebelum rilis resmi v2.0.

---

## 2. Inventarisasi 7 Temuan Review Kode & Rekomendasi Solusi

### 🔴 [CRIT-01] Kegagalan ESLint 10 Mematahkan Exit Gate `pnpm check` (CONSTRAINT #2)
- **Tingkat Keparahan:** CRITICAL (Memblokir CI/CD Pipeline)
- **Lokasi Berkas:**
  - [`scripts/dev/audit-event-source.ts:45`](file:///home/hari/projects/mathbank/scripts/dev/audit-event-source.ts#L45): variabel `yearMismatch` dideklarasikan tapi tidak dipakai/diubah.
  - [`scripts/dev/sync-done-list.ts:7, 18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L18): menggunakan `require("node:fs")` (dilarang ESLint) dan import `existsSync` tak terpakai.
  - [`scripts/dev/verify-saved.ts:22`](file:///home/hari/projects/mathbank/scripts/dev/verify-saved.ts#L22): menggunakan `require("node:fs")`.
  - Peringatan unused variables di `dry-run-batch.ts`, `dry-run-tf.ts`, `eval-stimulus.ts`, `ingest-batch.ts`, `ingest-tf-batch.ts`.
- **Dampak:** Perintah exit gate mutlak `pnpm check` gagal (exit code 1).
- **Rekomendasi Remediasi:**
  1. Bersihkan kode di `scripts/dev/`: gunakan ESM `import { readdirSync } from "node:fs"`, buang variabel mati.
  2. Tambahkan `"scripts/dev/**"` ke `globalIgnores` pada [`eslint.config.mjs`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77) untuk melindungi alur CI dari scratch script sementara.

---

### 🟠 [HIGH-01] Pelanggaran Batasan Domain Event: `PAS-SAS` & `Try Out` Masuk Tabel `events`
- **Tingkat Keparahan:** HIGH (Inkonsistensi Arsitektur Domain)
- **Lokasi Berkas:** [`scripts/seed-events.ts:65-88`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L65) dan [`src/lib/db/schema/event.ts:14-16`](file:///home/hari/projects/mathbank/src/lib/db/schema/event.ts#L14)
- **Dampak:** 
  - Melanggar aturan domain yang diratifikasi pada [`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md) dan [`ADR-0020`](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md).
  - Skema menyatakan: *"UTS/PAS BUKAN event → itu Bundle"*.
  - Event harus steril khusus untuk ujian resmi makro/nasional (UTBK-SNBT, SIMAK UI, UM UGM, OSN Matematika). Memasukkan penilaian sekolah lokal mencemari taksonomi ujian makro.
- **Rekomendasi Remediasi:**
  - Hapus entri `"PAS-SAS"` dan `"Try Out"` dari `scripts/seed-events.ts`.
  - Naskah PAS/SAS/Try Out cukup didaftarkan sebagai `bundles` dengan `origin: 'ingest' | 'manual'` dan `bundle_type: 'exam'`.

---

### 🟠 [HIGH-02] Cacat Regex `stripTags` Menggagalkan Isolasi Rumus Matematika Berkurung `\(f(x)\)`
- **Tingkat Keparahan:** HIGH (Potensi Kerusakan Data Matematis Saat Ingest)
- **Lokasi Berkas:** [`src/lib/ingest/parsers/clean.ts:333`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L333)
- **Dampak:**
  - Pola regex: `s = s.replace(/\$[^$\n]+?\$|\\\([^)]+?\\\)/g, hide);`
  - Karakter kelas `[^)]+?` memutus pencocokan pada tanda kurung tutup pertama `)`.
  - Jika naskah masukan memuat rumus inline `\(` dengan tanda kurung (misalnya `\(f(x) < 3\)`, `\(\sin(2x)\)`, `\(\binom{n}{k}\)`), rumus **gagal diisolasi** ke dalam store.
  - Akibatnya, simbol `<` di dalam rumus diperlakukan sebagai tag pembuka HTML oleh `s.replace(/<[^>]+>/g, " ")` dan **terhapus secara keliru**.
- **Rekomendasi Remediasi:**
  - Perbaiki regex menjadi lazy match yang menoleransi kurung di dalam rumus dan hanya berhenti pada delimiter penutup `\\\)`.
  - Formula perbaikan:
    ```typescript
    s = s.replace(/\$[^$\n]+?\$|\\\((?:(?!\\\))[\s\S])+?\\\)/g, hide);
    ```

---

### 🟡 [MED-01] `noScroll` pada `MatrixGridView` Memotong Rumus Matematika Lebar (CONSTRAINT #12)
- **Tingkat Keparahan:** MEDIUM (Aksesibilitas & Ergonomi Mobile)
- **Lokasi Berkas:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)
- **Dampak:**
  - Baris pernyataan benar-salah dirender dengan `<MathContent content={r.text} noScroll />`.
  - `noScroll` menonaktifkan scrolling dan menerapkan `overflow-hidden`. Pada halaman detail soal, rumus matematika lebar (persamaan aljabar panjang, matriks) akan terpotong dan tidak dapat dibaca oleh pengguna ponsel.
  - Melanggar [CONSTRAINT #12](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29): *"MathContent wajib punya overflow-x-auto — rumus lebar jangan memecah layout"*.
- **Rekomendasi Remediasi:**
  - Hapus properti `noScroll` pada `MatrixGridView`: ganti menjadi `<MathContent content={r.text} />`.

---

### 🟡 [MED-02] Desinkronisasi Gutter Nomor Soal antara `print.css` (17px) dan `bundle-print-view.tsx` (24px)
- **Tingkat Keparahan:** MEDIUM (Tata Letak Cetak A4)
- **Lokasi Berkas:** [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) vs [`src/components/bundles/bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256)
- **Dampak:**
  - Standar cetak A4 v2.0 ([`ADR-0021`](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md)) mewajibkan *gutter 24px* agar nomor soal 2-digit (`10.` s.d. `99.`) tidak menabrak teks soal.
  - Di JSX `bundle-print-view.tsx` sudah menggunakan lebar `w-6` (24px), tetapi di `print.css` selector `.item` masih menggunakan `padding-left: 17px;`.
  - Terdapat duplikasi penamaan kelas antara selektor Tailwind JSX dan selektor CSS murni prototype lama (`.worksheet`, `.item`, `.num`).
- **Rekomendasi Remediasi:**
  - Selaraskan `padding-left: 24px;` pada kelas `.item` di `src/styles/print.css`.
  - Konsolidasikan selektor cetak agar konsisten antara tampilan layar preview dan `@media print`.

---

### 🟡 [MED-03] Ambiguitas Penghitungan Metrik Gagal pada `/api/v1/ingest/commit`
- **Tingkat Keparahan:** MEDIUM (Kontrak API & Observabilitas)
- **Lokasi Berkas:** [`src/app/api/v1/ingest/commit/route.ts:46-47`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L46)
- **Dampak:**
  - Kode saat ini:
    ```typescript
    failed: results.reduce((a, r) => a + r.failed, 0) + results.filter((r) => r.status === "failed").length
    ```
  - Menjumlahkan butir soal yang gagal divalidasi dengan antrean artikel yang gagal secara keseluruhan. Jika 1 artikel gagal total dan di artikel lain ada 2 soal gagal, metrik `failed` bernilai `3`, membingungkan pelapor/dasbor audit.
- **Rekomendasi Remediasi:**
  - Pisahkan menjadi dua metrik terpisah pada amplop respons:
    ```typescript
    failedQuestions: results.reduce((a, r) => a + r.failed, 0),
    failedArticles: results.filter((r) => r.status === "failed").length,
    ```

---

### 🟢 [LOW-01] Kop Naskah Cetak Hardcoded "MATH MY ID" Mengabaikan Konfigurasi Dinamis `printConfig`
- **Tingkat Keparahan:** LOW (Kelengkapan Fitur & Personalisasi Guru)
- **Lokasi Berkas:** [`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187)
- **Dampak:**
  - Teks nama sekolah dan tagline naskah ujian masih di-*hardcode* literal `"MATH MY ID"`.
  - Konfigurasi cetak yang disimpan guru pada `bundle.printConfig` ([`ADR-0021`](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md)) belum otomatis muncul pada kop naskah.
- **Rekomendasi Remediasi:**
  - Hubungkan kop cetak dengan konfigurasi dinamis `bundle.printConfig?.institutionName` dan `tagline`, dengan fallback ke nilai default `"MATH MY ID"`.

---

## 3. Rencana Aksi Remediasi Berdasarkan Milestone v2.0

```
┌────────────────────────────────────────────────────────────────────────┐
│               MATRIKS PRIORITAS EKSEKUSI REMEDIASI v2.0                │
├────────────────────────────────────────────────────────────────────────┤
│ TAHAP 1 (Immediate / Blocking CI Gate):                                │
│   • Perbaiki 3 error ESLint di scripts/dev/                            │
│   • Perbarui globalIgnores di eslint.config.mjs                        │
│   • Verifikasi pnpm check exit 0 mutlak                                │
├────────────────────────────────────────────────────────────────────────┤
│ TAHAP 2 (Data & Domain Correction):                                    │
│   • Hapus "PAS-SAS" dan "Try Out" dari scripts/seed-events.ts          │
│   • Patch regex delimiter KaTeX di clean.ts (stripTags)                │
│   • Tulis unit test regresi di clean.test.ts                           │
├────────────────────────────────────────────────────────────────────────┤
│ TAHAP 3 (UI & Publishing Polish):                                      │
│   • Hapus noScroll pada MatrixGridView (overflow-x-auto aktif)         │
│   • Standardisasi gutter 24px di print.css                             │
│   • Hubungkan kop cetak dinamis dengan bundle.printConfig              │
│   • Pisahkan metrik failedQuestions vs failedArticles di API commit    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Daftar Periksa Verifikasi Kelulusan (Quality Exit Gate)

Sebelum dinyatakan selesai pada rilis v2.0, verifikasi mekanis berikut wajib dipenuhi:
- [ ] `pnpm typecheck` exit 0 (0 error).
- [ ] `pnpm lint` exit 0 (0 error, 0 warning).
- [ ] `pnpm theme:check` exit 0 (34/34 kontras WCAG 2.2 AA).
- [ ] `pnpm lint:names` exit 0 (100% nama file/route berbahasa Inggris).
- [ ] `pnpm test` exit 0 (seluruh unit test lolos, termasuk regresi `stripTags`).
- [ ] `pnpm test:db` exit 0 (248 integrasi database lolos).
- [ ] `pnpm db:verify` exit 0 (zero schema drift).
- [ ] `pnpm check` exit 0 mutlak.
