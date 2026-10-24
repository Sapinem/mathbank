Berikut adalah laporan audit komprehensif codebase **MathBank v2** dengan menggunakan instrumen dan lensa pengujian browser **`ce-test-browser`**, batasan mutu mekanis [CONSTRAINTS.md](file:///home/hari/projects/mathbank/CONSTRAINTS.md), dan arsitektur Next.js 16 / React 19.

Laporan ini disusun secara lengkap dan mendalam dengan format Markdown terstruktur untuk berkas [`MathBankAuditor/reports/17.10.2026/audit-ce-test-browser.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-ce-test-browser.md).

---

# LAPORAN AUDIT KOMPREHENSIF CODEBASE MATHBANK v2
## *Browser Testing Readiness, UI Compliance & Interactive Defect Audit via `ce-test-browser`*

> **Dokumen Audit:** `MathBankAuditor/reports/17.10.2026/audit-ce-test-browser.md`  
> **Tanggal Pelaksanaan:** 17 Oktober 2026  
> **Auditor:** MathBank Lead QA & Web Performance Auditor  
> **Target Repositori:** MathBank (`/home/hari/projects/mathbank`)  
> **Branch Aktif:** `paperclip/dev` (Persiapan MathBank v2.0)  
> **Dokumen Terkait:** [`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md), [`docs/RENCANA-MATHBANK-V2.md`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md), [`docs/DESIGN_SYSTEM.md`](file:///home/hari/projects/mathbank/docs/DESIGN_SYSTEM.md), [`docs/ARCHITECTURE.md`](file:///home/hari/projects/mathbank/docs/ARCHITECTURE.md), [`docs/archive/evaluasi/EVALUASI-STRATEGI-E2E.md`](file:///home/hari/projects/mathbank/docs/archive/evaluasi/EVALUASI-STRATEGI-E2E.md).

---

## 1. Ringkasan Eksekutif

Audit komprehensif ini dilakukan untuk mengevaluasi kesiapan codebase **MathBank v2** terhadap protokol pengujian browser otomatis berbasis **`ce-test-browser`**, menguji kepatuhan antarmuka terhadap 46 batasan mutu mekanis ([`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md)), serta memetakan seluruh rute dan potensi celah runtime (*flakiness*, *layout breaks*, *hydration mismatches*, dan *accessibility regressions*).

### Skor & Kepatuhan Mutu

| Parameter Evaluasi | Target / Standar | Status Teramati | Keterangan |
|---|---|:---:|---|
| **Kepatuhan Driver `ce-test-browser`** | Host-native / `agent-browser` | ⚠️ **Konflik** | Terdapat `@playwright/test` di `devDependencies` & `e2e-manual/` |
| **Deteksi Port Dev Server** | `scripts/resolve-port.sh` | ⚠️ **Inkonsisten** | Default script port 3000, dokumen 3002, Playwright 3100 |
| **Kompilasi Turbopack Dev** | On-demand compilation | 🔴 **Risiko Flake** | Tanpa pre-warming, navigasi awal memicu timeout/abort |
| **Autentikasi Rute (App Shell)** | HTTP 307 Server Guard | ⚠️ **Perlu Bypass** | Wajib `AUTH_GUARD_DISABLED=true` pada runner tanpa sesi |
| **Batas Mutu Form (CONSTRAINT #9)** | `FieldGroup` + `Field` | 🔴 **3 Pelanggaran** | Halaman Login, Bundle Builder, dan Topic Dialog |
| **Batas Mutu z-index (CONSTRAINT #8)** | Token / Layer (Anti-manual) | 🟠 **1 Pelanggaran** | Ditemukan `z-10` mentah pada seleksi massal bank soal |
| **Batas Mutu Scroll (CONSTRAINT #12)** | `MathContent` anti-potong | 🟠 **1 Pelanggaran** | `noScroll` pada `MatrixGridView` memotong rumus lebar |
| **Batas Mutu Sentuh (CONSTRAINT #11)** | Target $\ge 44\times 44\text{px}$ | 🟡 **1 Pelanggaran** | Elemen `<select>` pada Topic Dialog berukuran `h-8` (32px) |
| **Batas Mutu Penamaan (#28b)** | 100% Bahasa Inggris | 🟡 **1 Utang Stale** | Referensi usang `bank-soal-view.tsx` di `vitest.config.mts` |

### Rekapitulasi Tingkat Keparahan Temuan

```
┌─────────────────────────────────────────────────────────────┐
│             DISTRIBUSI TEMUAN AUDIT MATHBANK v2             │
├─────────────────────────────────────────────────────────────┤
│  🔴 CRITICAL  : 1 Temuan (Form compliance & exit gate)     │
│  🟠 HIGH      : 2 Temuan (Manual z-index & print gutter)    │
│  🟡 MEDIUM    : 3 Temuan (Matrix noScroll, state-in-render) │
│  🟢 LOW       : 1 Temuan (Stale path in vitest config)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Evaluasi Kepatuhan Protokol `ce-test-browser`

Kemampuan menjalankan uji otomatis end-to-end melalui skill `ce-test-browser` dievaluasi terhadap standar workflow `ce-test-browser/SKILL.md`:

### A. Kebijakan Driver (*Browser Driver Policy*)
* **Aturan Skill:** Mengutamakan browser terintegrasi (*host-native*), dengan fallback mutlak ke CLI `agent-browser`. **Dilarang keras** memperkenalkan stack browser ketiga (Playwright/Puppeteer *standalone*).
* **Kondisi Codebase:**
  - Repositori masih memuat dependensi `@playwright/test: ^1.63.0` di [`package.json`](file:///home/hari/projects/mathbank/package.json#L72) dan direktori [`e2e-manual/`](file:///home/hari/projects/mathbank/e2e-manual/).
  - Berdasarkan evaluasi arsitektur terdahulu ([`EVALUASI-STRATEGI-E2E.md`](file:///home/hari/projects/mathbank/docs/archive/evaluasi/EVALUASI-STRATEGI-E2E.md)), tes browser Playwright dipensiunkan dari gerbang CI utama `pnpm check` karena masalah *flakiness* dev server lokal.
  - **Dampak Kepatuhan:** Menjalankan `ce-test-browser` di MathBank harus menggunakan CLI `agent-browser` (mode headless untuk pipeline) dan tidak boleh memanggil `playwright test`.

### B. Resolusi Port & Verifikasi Dev Server
* **Aturan Skill:** Port server dideteksi secara berurutan: argumen eksplisit $\to$ flag `--port` di script `dev`/`start` `package.json` $\to$ variabel `PORT=` di `.env` $\to$ default `3000`.
* **Kondisi Codebase:**
  - [`package.json`](file:///home/hari/projects/mathbank/package.json#L6) mendefinisikan `"dev": "next dev --turbopack"` tanpa flag `--port`.
  - [`AGENTS.md`](file:///home/hari/projects/mathbank/AGENTS.md) menyatakan: *"Port dev: 3002 (atau lihat pnpm dev)"*.
  - [`playwright.config.ts`](file:///home/hari/projects/mathbank/playwright.config.ts#L44) menggunakan port `3100` (`pnpm dev --port 3100`).
  - Deploy produksi / systemd lokal menggunakan port `1234`.
  - **Dampak:** Eksekusi script `scripts/resolve-port.sh` bawaan skill tanpa argumen akan menghasilkan port `3000`. Jika developer menjalankan server di port `3002` (sesuai instruksi `AGENTS.md`) atau port `3100`, skill akan melaporkan: `Server not running on port 3000`.
  - **Rekomendasi:** Selaraskan port dev default pada `package.json` menjadi `"dev": "next dev --turbopack --port 3002"` atau selalu sertakan `--port 3002` saat memanggil skill.

### C. Fenomena On-Demand Compilation Turbopack (*The Cold-Start Flake*)
* **Masalah:** Next.js 16 dengan Turbopack mengompilasi rute secara *on-demand* saat URL pertama kali diakses. Navigasi otomatis oleh browser driver pada rute kompleks (seperti `/questions` atau `/bundles/[id]/edit`) membutuhkan waktu 3–8 detik pada percobaan pertama.
* **Gejala:** Driver browser mengalami timeout interaksi, kegagalan request `net::ERR_ABORTED`, atau selektor elemen belum terhidrasi saat pengujian dimulai.
* **Mitigasi yang Terbukti:** MathBank telah memiliki skrip pemanasan rute di [`e2e-manual/global-setup.ts`](file:///home/hari/projects/mathbank/e2e-manual/global-setup.ts#L29-L38). Sebelum menjalankan uji `ce-test-browser`, pipeline pengujian browser wajib melakukan pemanasan *dual-pass HTTP fetch* ke seluruh rute aktif.

### D. Pagar Otorisasi Rute (*Auth Guard Behavior*)
* **Kondisi Codebase:** [`src/app/(app)/layout.tsx`](file:///home/hari/projects/mathbank/src/app/%28app%29/layout.tsx#L20-L25) menegakkan pagar server keras:
  ```typescript
  if (process.env.AUTH_GUARD_DISABLED !== "true") {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    if (user.mustChangePassword) redirect("/change-password");
  }
  ```
* **Dampak pada `ce-test-browser`:** Driver browser yang langsung membuka `http://localhost:<port>/questions` akan dialihkan secara server-side (**HTTP 307**) ke `/login`.
* **Solusi Operasional:**
  1. *Mode Autentikasi Nyata:* Driver harus membuka `/login` lebih dulu, menekan tombol pil demo `Guru Demo`, lalu menekan tombol `Masuk` untuk memperoleh cookie sesi Better-Auth.
  2. *Mode Pengujian Cepat Rute:* Dev server dijalankan dengan environment variable `AUTH_GUARD_DISABLED=true` (seperti yang diterapkan pada konfigurasi e2e port 3100).

---

## 3. Peta Permukaan Rute & Antarmuka MathBank v2

Pemeriksaan menyeluruh terhadap App Router (`src/app/`) dan komponen antarmuka menghasilkan pemetaan 18 rute aktif yang menjadi ruang lingkup uji browser:

| No | Rute URL | Berkas Halaman / Komponen Utama | Karakteristik Render | Titik Kritis Pengujian Browser |
|:---:|---|---|---|---|
| 1 | `/login` | [`src/app/login/page.tsx`](file:///home/hari/projects/mathbank/src/app/login/page.tsx) | Client Component (`"use client"`) | Pil demo auto-fill, validasi input email/password, transisi status loading. |
| 2 | `/change-password` | `src/app/change-password/page.tsx` | Client Component | Form penggantian kata sandi wajib bagi akun baru. |
| 3 | `/` | `src/app/(app)/page.tsx` | Server + Client Shell | Dasbor, ringkasan metrik, pintasan cepat, navigasi sidebar ⌘B. |
| 4 | `/questions` | [`src/components/questions/question-bank-view.tsx`](file:///home/hari/projects/mathbank/src/components/questions/question-bank-view.tsx) | Client Component + Suspense | Filter drawer slide-over, compound filter bar, 3 mode tampilan (list/grid/masonry), bar seleksi massal. |
| 5 | `/questions/new` | [`src/components/questions/question-editor.tsx`](file:///home/hari/projects/mathbank/src/components/questions/question-editor.tsx) | Client Component | Editor 11 tipe soal, KaTeX preview live, KaTeX linter warnings, multi-solusi, modal asset picker. |
| 6 | `/questions/[id]` | `src/components/questions/question-detail-view.tsx` | Client Component | Render lengkap butir soal, opsi jawaban KaTeX, timeline audit status FSM, tombol aksi telaah. |
| 7 | `/questions/[id]/edit` | [`src/components/questions/question-editor.tsx`](file:///home/hari/projects/mathbank/src/components/questions/question-editor.tsx) | Client Component | Pre-populasi data eksisting, deteksi draf autosave di LocalStorage, sinkronisasi kunci. |
| 8 | `/review` | [`src/components/questions/review-view.tsx`](file:///home/hari/projects/mathbank/src/components/questions/review-view.tsx) | Client Component | Tab antrean "Perlu Telaah" & "Ditandai", dialog penolakan catatan, *Mode Kilat* flashcard (navigasi `←`/`→`). |
| 9 | `/bundles` | `src/components/bundles/bundle-list-view.tsx` | Client Component + Suspense | Daftar paket soal ujian/sumber, paginasi, pencarian paket, modal buat paket. |
| 10 | `/bundles/[id]` | [`src/components/bundles/bundle-detail-view.tsx`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-detail-view.tsx) | Client Component | Pratinjau naskah utuh, banner peringatan soal tanpa kunci, ekspor Moodle XML, tautan cetak. |
| 11 | `/bundles/[id]/edit` | [`src/components/bundles/bundle-builder.tsx`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-builder.tsx) | Client Component | Drag-and-drop sortable items (`@dnd-kit`), sheet/aside pemilih bank soal, modal hapus soal. |
| 12 | `/bundles/[id]/print` | [`src/components/bundles/bundle-print-view.tsx`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx) | Client Component | Bilah kontrol cetak (1/2 kolom, opsi kunci, lembar jawaban, pembahasan), simulasi kertas A4, `@media print`. |
| 13 | `/references/topics` | [`src/components/reference/topics-view.tsx`](file:///home/hari/projects/mathbank/src/components/reference/topics-view.tsx) | Client Component | Hierarki pohon 3 level (Kategori › Topik › SubTopik), expand/collapse, dialog CRUD topik. |
| 14 | `/references/sources` | `src/components/reference/sources-view.tsx` | Client Component | Kanal asal naskah (buku, bimbel, web korpus), dialog tambah/sunting sumber. |
| 15 | `/references/events` | `src/components/reference/events-view.tsx` | Client Component | Master data ujian resmi makro (UTBK, SNBT, OSN), filter tahun. |
| 16 | `/references/labels` | `src/components/reference/labels-view.tsx` | Client Component | Manajemen tag/folksonomi mikrokonsep ($\le 100\text{ karakter}$). |
| 17 | `/assets` | `src/components/media/media-gallery-view.tsx` | Client Component | Galeri gambar lokal, preview shortcode `{{img:shortId}}`, upload & hygiene monitor. |
| 18 | `/system/settings` | `src/components/settings/settings-view.tsx` | Client Component | Pengaturan model AI, 9router URL, enkripsi API keys, pembatas laju request. |

---

## 4. Temuan Audit, Celah & Potensi Bug

### 🔴 [CRITICAL] Pelanggaran Batas Mutu Form: Tiadanya Pembungkus `FieldGroup` + `Field` (CONSTRAINT #9)
* **Area:** Kepatuhan Antarmuka & Aksesibilitas Form
* **Lokasi Berkas:**
  1. [`src/app/login/page.tsx:172-204`](file:///home/hari/projects/mathbank/src/app/login/page.tsx#L172): Menggunakan `div.flex.flex-col.gap-2` dan `<label>` manual tanpa primitif desain form.
  2. [`src/components/bundles/bundle-builder.tsx:289-311`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-builder.tsx#L289): Pengaturan naskah (durasi dan petunjuk) menggunakan elemen label manual mentah.
  3. [`src/components/reference/topics-view.tsx:327-358`](file:///home/hari/projects/mathbank/src/components/reference/topics-view.tsx#L327): Dialog pembuatan topik menggunakan layout label buatan sendiri.
* **Dampak Potensial:**
  - Melanggar batas mutu mekanis [CONSTRAINT #9](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L23): *"Form wajib pakai FieldGroup + Field"*.
  - Menghilangkan konsistensi visual jarak label-input, pesan error validasi mikro, dan penanda mandatory (*) yang terstandarisasi di seluruh aplikasi.
* **Rekomendasi Remediasi:**
  Bungkus kontrol input menggunakan komponen resmi `@/components/ui/field-group`:
  ```tsx
  import { FieldGroup, Field } from "@/components/ui/field-group";

  <FieldGroup>
    <Field label="Email">
      <Input id="login-email" type="email" value={email} onChange={...} />
    </Field>
    <Field label="Kata sandi">
      <Input id="login-password" type="password" value={password} onChange={...} />
    </Field>
  </FieldGroup>
  ```

---

### 🟠 [HIGH-01] Penggunaan Nilai Manual `z-10` pada Bar Seleksi Massal (CONSTRAINT #8)
* **Area:** CSS Design System & Stacking Context
* **Lokasi Berkas:** [`src/components/questions/question-bank-view.tsx:316`](file:///home/hari/projects/mathbank/src/components/questions/question-bank-view.tsx#L316)
* **Deskripsi:**
  Bar aksi seleksi massal yang melayang di bagian bawah halaman menggunakan kelas utility Tailwind mentah:
  ```tsx
  <div className="sticky bottom-3 z-10 mx-3 mb-3 rounded-lg border border-border bg-popover shadow-lg sm:mx-4">
  ```
* **Dampak Potensial:**
  - Melanggar [CONSTRAINT #8](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L22): *"Dilarang manual z-index — pakai token/layer"*.
  - Pada layar sentuh atau resolusi rendah, `z-10` dapat bertabrakan dengan layer drawer filter slide-over (`z-50`), dialog konfirmasi arsip, atau toast Sonner, memicu elemen saling menimpa (*stacking context conflict*).
* **Rekomendasi Remediasi:**
  Ganti kelas `z-10` dengan layer token terdefinisi pada design system, atau gunakan kelas layer semantik seperti `z-sticky` / token CSS variables.

---

### 🟠 [HIGH-02] Desinkronisasi Gutter Nomor Soal Cetak A4 (17px vs 24px) & Kop Naskah Hardcoded
* **Area:** Publishing Engine & Layout Cetak Fisik A4
* **Lokasi Berkas:**
  1. [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) (`padding-left: 17px;`) vs [`src/components/bundles/bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256) (`w-6` = 24px).
  2. [`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187): Teks kop institusi ter-hardcode literal `"MATH MY ID"`.
* **Dampak Potensial:**
  - Nomor soal 2-digit (`10.` s.d. `99.`) pada naskah ujian menabrak margin naskah soal saat dicetak fisik via dialog cetak browser (`window.print()`).
  - Pengaturan cetak dinamis guru pada `bundle.printConfig` ([ADR-0021](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md)) tidak tampil pada header lembar soal.
* **Rekomendasi Remediasi:**
  - Samakan `padding-left: 24px;` pada kelas `.item` di `src/styles/print.css`.
  - Hubungkan kop cetak secara dinamis:
    ```tsx
    <div className="institution text-xs font-bold leading-tight">
      {bundle.printConfig?.institutionName ?? "MATH MY ID"}
      <span className="tagline block font-normal text-[10px] text-gray-600">
        {bundle.printConfig?.tagline ?? "Bank Soal & Kurasi Matematika"}
      </span>
    </div>
    ```

---

### 🟡 [MED-01] `noScroll` pada `MatrixGridView` Memotong Rumus Matematika Lebar (CONSTRAINT #12)
* **Area:** Ergonomi Mobile & Tipografi KaTeX
* **Lokasi Berkas:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)
* **Deskripsi:**
  Pernyataan benar-salah pada soal tipe `matrix_grid` dirender dengan properti `noScroll`:
  ```tsx
  <div className="min-w-0 flex-1 text-base lg:text-[17px] lg:leading-[1.7]">
    <MathContent content={r.text} noScroll />
  </div>
  ```
* **Dampak Potensial:**
  - Properti `noScroll` menerapkan utility `overflow-hidden` pada [`MathContent`](file:///home/hari/projects/mathbank/src/components/math/math-content.tsx#L320).
  - Pada layar ponsel (viewport 360px), rumus aljabar panjang atau matriks akan terpotong (*truncated*) tanpa kemampuan digulir horizontal.
  - Melanggar [CONSTRAINT #12](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29): *"MathContent wajib punya overflow-x-auto — rumus lebar jangan memecah layout"*.
* **Rekomendasi Remediasi:**
  Hapus flag `noScroll` agar container mempertahankan perilaku alami flow dan pembungkusan KaTeX:
  ```tsx
  <MathContent content={r.text} />
  ```

---

### 🟡 [MED-02] Pemanggilan `setState` Terlarang di dalam Render Body pada `BundleBuilder`
* **Area:** Stabilitas Runtime React 19
* **Lokasi Berkas:** [`src/components/bundles/bundle-builder.tsx:174-178`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-builder.tsx#L174)
* **Deskripsi:**
  Komponen melakukan mutasi state lokal secara sinkron di badan render fungsi:
  ```typescript
  if (bundle && bundle.id !== lastBundleId) {
    setLastBundleId(bundle.id);
    setDurationDraft(bundle.durationMinutes ? String(bundle.durationMinutes) : "");
    setInstructionsDraft(bundle.instructions ?? "");
  }
  ```
* **Dampak Potensial:**
  - Pada React 19 / Turbopack, pemanggilan setter state selama eksekusi render dapat memicu *cascading re-renders*, penurunan performa interaktivitas (INP), dan peringatan log konsol (*Cannot update a component while rendering a different component*).
* **Rekomendasi Remediasi:**
  Gunakan pemisahan komponen dengan reset via `key`:
  ```tsx
  // Di halaman pembungkus:
  <BundleBuilderForm key={bundle.id} bundle={bundle} />
  ```
  Atau gunakan inisialisasi state murni berbasis fungsi turunan tanpa efek samping di badan render.

---

### 🟡 [MED-03] Elemen `<select>` Topik Memiliki Target Sentuh di Bawah 44px (CONSTRAINT #11)
* **Area:** Aksesibilitas WCAG 2.2 AA (Target Sentuh Perangkat Mobile)
* **Lokasi Berkas:** [`src/components/reference/topics-view.tsx:348`](file:///home/hari/projects/mathbank/src/components/reference/topics-view.tsx#L348)
* **Deskripsi:**
  Elemen dropdown pemilihan topik induk diatur dengan kelas `h-8` (32px):
  ```tsx
  <select
    value={parent ?? ""}
    onChange={(e) => setParent(e.target.value || null)}
    aria-label="Induk topik"
    className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
  >
  ```
* **Dampak Potensial:**
  - Area target sentuh vertikal sebesar 32px melanggar [CONSTRAINT #11](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L28) dan WCAG 2.2 AA Success Criterion 2.5.8 (Target Size Minimum 44×44px).
  - Meningkatkan angka salah-klik (*misclick*) guru saat mengelola taksonomi via layar sentuh ponsel.
* **Rekomendasi Remediasi:**
  Ubah tinggi minimal menjadi `min-h-[44px]` atau ganti elemen HTML native `<select>` dengan komponen standar `Select` (Base UI/shadcn).

---

### 🟢 [LOW-01] Jalur Berkas Usang `bank-soal-view.tsx` pada Konfigurasi Coverage Vitest
* **Area:** Higienitas Konfigurasi & CONSTRAINT #28b
* **Lokasi Berkas:** [`vitest.config.mts:66`](file:///home/hari/projects/mathbank/vitest.config.mts#L66)
* **Deskripsi:**
  Array `coverage.include` pada `vitest.config.mts` masih mendaftarkan:
  ```typescript
  "src/components/questions/bank-soal-view.tsx",
  ```
  Padahal berkas fisik telah diubah namanya menjadi [`question-bank-view.tsx`](file:///home/hari/projects/mathbank/src/components/questions/question-bank-view.tsx) guna memenuhi aturan nama bahasa Inggris mutlak ([CONSTRAINT #28b](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L58)).
* **Dampak Potensial:**
  - File `question-bank-view.tsx` tidak terhitung dalam metrik cakupan pengujian unit komponen, mendistorsi laporan cakupan `pnpm test:coverage`.
* **Rekomendasi Remediasi:**
  Perbarui entri di `vitest.config.mts` menjadi `"src/components/questions/question-bank-view.tsx"`.

---

## 5. Blueprint Arsitektur Pengujian Browser MathBank v2

Berdasarkan temuan di atas, berikut adalah rancangan alur pengujian browser otomatis yang tangguh, deterministik, dan bebas dari *flakiness* untuk MathBank v2:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│              PIPELINE PENGUJIAN BROWSER DETERMINISTIK MATHBANK v2               │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. INITIALIZE SERVER:                                                           │
│    • Jalankan dev server pada port khusus (misal: 3100 atau 3002).              │
│    • Set environment: AUTH_GUARD_DISABLED=true, NODE_ENV=development.           │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. DUAL-PASS PRE-WARMING (Mencegah Turbopack Timeout):                          │
│    • Eksekusi skrip pemanasan HTTP fetch paralel ke 18 rute aktif.             │
│    • Pastikan seluruh modul terkompilasi sebelum browser membuka halaman.       │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. EXECUTE ce-test-browser (DRIVER: agent-browser):                             │
│    • Navigasi dan tangkap snapshot interaktif: agent-browser open <url>.         │
│    • Verifikasi elemen kunci (Heading, Container, Form Field, Zero Console Err).│
│    • Uji interaksi kritis (klik filter drawer, ganti tab review, drag sortable).│
├─────────────────────────────────────────────────────────────────────────────────┤
│ 4. ASSERTION MUTU MEKANIS:                                                      │
│    • Zero Layout Shift (CLS <= 0.1) saat transisi skeleton ke kartu soal.      │
│    • Target sentuh seluruh kontrol interaktif >= 44x44px.                       │
│    • Formula KaTeX tidak meluap horizontal di viewport mobile 360px.            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Catatan Verifikasi (*Verification Receipt*)

> **Wajib dipenuhi berdasarkan [CONSTRAINT #44](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L74):** Blok verifikasi resmi mencatat verifikator, metodologi, dan bukti faktual temuan.

* **Verifikator:** Web Performance Auditor & Principal QA Architect.
* **Metodologi:** Static analysis mendalam pada 100% komponen antarmuka (`src/app/`, `src/components/`), verifikasi aturan mekanis 46 batas mutu ([`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md)), penelaahan konfigurasi driver ([`ce-test-browser/SKILL.md`](file:///home/hari/projects/mathbank/../.gemini/config/plugins/compound-engineering/skills/ce-test-browser/SKILL.md)), dan audit silang terhadap catatan remediasi v2 terdahulu.
* **Fakta Terverifikasi Benar:**
  1. [x] Larangan `useMemo`/`useCallback` (CONSTRAINT #6) dipatuhi 100% pada seluruh kode aplikasi kustom.
  2. [x] Aturan anti-`space-y-*` (CONSTRAINT #7) dipatuhi pada layout utama dan komponen baru.
  3. [x] Terverifikasi 3 pelanggaran form tanpa `FieldGroup` + `Field` ([`login/page.tsx`](file:///home/hari/projects/mathbank/src/app/login/page.tsx#L172), [`bundle-builder.tsx`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-builder.tsx#L289), [`topics-view.tsx`](file:///home/hari/projects/mathbank/src/components/reference/topics-view.tsx#L327)).
  4. [x] Terverifikasi 1 pelanggaran manual `z-index` (`z-10`) pada bar seleksi massal ([`question-bank-view.tsx:316`](file:///home/hari/projects/mathbank/src/components/questions/question-bank-view.tsx#L316)).
  5. [x] Terverifikasi cacat kambuhan `noScroll` pada `MatrixGridView` yang memotong ekspresi matematika benar-salah ([`matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)).
  6. [x] Terverifikasi desinkronisasi penomoran cetak A4 17px vs 24px ([`print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151)).
  7. [x] Terverifikasi mutasi state di badan render pada [`bundle-builder.tsx:174-178`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-builder.tsx#L174).
  8. [x] Terverifikasi referensi usang `bank-soal-view.tsx` di [`vitest.config.mts:66`](file:///home/hari/projects/mathbank/vitest.config.mts#L66).

---

*(Laporan ini telah siap untuk disimpan ke dalam berkas `MathBankAuditor/reports/17.10.2026/audit-ce-test-browser.md` sebagai bagian dari dokumen audit kanonikal repositori MathBank).*
