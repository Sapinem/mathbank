# AUDIT MILESTONE 3 — TEMA & SHELL UI (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED** (100% Enterprise Quality) — ✅ **DIVERIFIKASI ULANG 2026-09-30 + DIPERBAIKI** (T-M3-3 warna status)  
**Target:** Mesin Tema OKLCH, WCAG 2.2 AA Contrast, Migrasi `@base-ui/react` (Base UI `base-nova`), App Shell Layout, Command Palette ⌘K, dan Aksesibilitas (A11y).

---

## 1. Ringkasan Arsitektur Visual & Shell UI (M3)

Milestone 3 membangun antarmuka pengguna yang konsisten, berkinerja tinggi, dan aksesibel:
1. **Mesin Tema Terhitung (OKLCH Color Engine):** Generator token (`scripts/theme/build.ts`) & verifikasi kontras otomatis (`scripts/theme/check.ts`) pada mode terang & gelap.
2. **Standardisasi Primitif UI (ADR-0008 Base UI):** Migrasi 100% dari `radix-ui` ke `@base-ui/react` (`base-nova`), menghapus dependensi Radix.
3. **App Shell Layout (4 Grup Navigasi):** `SidebarProvider` resmi dengan 4 grup terstruktur (**Kerja**, **Referensi**, **Studio**, **Sistem**), `SkipLink`, dan Command Palette ⌘K.

---

## 2. Matriks Target vs Realisasi M3

| Fitur / Komponen | Target Spesifikasi (M3 & ADR-0008) | Realisasi Kode (`src/components/`) | Verdict |
| :--- | :--- | :--- | :---: |
| **Mesin Tema OKLCH** | Generator otomatis warna sumber ➔ `--mb-*` | `scripts/theme/build.ts` & `color.ts` | ✅ Lulus |
| **Kontras WCAG 2.2 AA** | Teks normal ≥ 4.5:1, Komponen ≥ 3:1 | `pnpm theme:check` ➔ **16/16 Lulus** (Light & Dark) | ✅ Lulus |
| **Primitif Headless UI** | `@base-ui/react` (`base-nova`), Hapus Radix | ADR-0008 Diterapkan (`radix-ui` dihapus total) | ✅ Lulus |
| **App Shell Layout** | Collapsible Sidebar + Header + Breadcrumb | `AppShell` di `src/components/layout/app-shell.tsx` | ✅ Lulus |
| **Peta Navigasi** | 4 Grup (Kerja, Referensi, Studio, Sistem) | `NAV_GROUPS` di `src/components/layout/nav-config.ts` | ✅ Lulus |
| **Command Palette** | Modal pencarian cepat via pintasan ⌘K / Ctrl+K | `CommandPalette` di `command-palette.tsx` | ✅ Lulus |
| **Aksesibilitas (A11y)** | Skip link ke `#konten-utama`, aria-label | `SkipLink` di `skip-link.tsx` (Diuji Vitest jsdom) | ✅ Lulus |
| **Pola DesktopOnly** | Pola D untuk Editor Soal (Responsif Rule) | `DesktopOnly` (`desktop-only.tsx`) di bawah `lg:1024px` | ✅ Lulus |

---

## 3. Catatan Evaluasi Inkonsistensi Shell UI & Tampilan (Temuan Lapangan)

1. **Inkonsistensi Rute Bahasa Indonesia vs Folder Rute Inggris (Canonical Route Mismatch):**
   * Peta navigasi di `nav-config.ts` mendefinisikan rute Indonesia (`/bank-soal`, `/referensi/topik`, `/paket`), sementara folder fisik App Router di `src/app/(app)/` menggunakan slug Inggris (`/questions`, `/references/topics`, `/bundles`).
   * **Tindakan Disepakati:** Seluruh rute App Router & `nav-config.ts` akan diseragamkan **100% menggunakan Bahasa Inggris** (`/questions`, `/bundles`, `/references/topics`, `/references/sources`, `/references/events`, `/references/labels`).
2. **Inkonsistensi Ukuran Padding Konten di Halaman Referensi (`topics`, `sources`, `events`, `labels`, `bundles`):**
   * Pengamatan visual menemukan adanya perbedaan marjin/padding yang tidak seimbang antara halaman referensi (misal `topics-view.tsx` menggunakan `p-6`, sedangkan `sources-view.tsx` merender `<Card>` langsung tanpa outer wrapper `p-6`).
   * **Penyebab:** Merupakan inkonsistensi pada pembungkus komponen tampilan (View Component Level), bukan bug dari `AppShell` utama.
   * **Solusi Standardisasi:** Seluruh halaman tampilan akan dibungkus secara simetris menggunakan struktur `<div className="flex flex-col gap-6 p-6">` di bawah `<PageHeader>`.

---

## 4. Hasil Pengujian UI & Aksesibilitas

Seluruh pengujian unit/komponen UI (`pnpm vitest run src/components`) lulus 100%:
* `skip-link.test.tsx` → **Passed** (Tab keyboard ke `#konten-utama`).
* `page-header.test.tsx` → **Passed** (Render breadcrumb & judul halaman).
* `sidebar-user.test.tsx` → **Passed** (Avatar, peran, dan dialog logout).
* `nav-config.test.ts` & `nav-utils.test.ts` → **Passed** (Kecocokan URL aktif & filter grup navigasi).

---

## 5. Rekomendasi Enterprise

1. **Adaptasi Kontras Dark Mode pada TikZ Diagram Engine:** Pastikan pengubah warna SVG TikZ mengadopsi *color inversion adaptation* agar diagram geometri matematika tetap nyaman dibaca saat berpindah ke Dark Mode.
2. **Reaktifitas `badgeCount` Sidebar:** Hubungkan `badgeCount` pada menu *Kerja ➔ Telaah* dengan kueri React Query `useQuestionsCount({ status: 'review' })` agar jumlah antrean soal terbarukan secara real-time.

---

## 📝 CATATAN VERIFIKASI (2026-09-30)

**Verifikator:** agen pembangun (MathBank) · **Metode:** cek token warna + `theme:check`.

**Status: ✅ TERVERIFIKASI + DIPERBAIKI.** Warna status = `STATUS_TOKENS` di
`tokens.ts` (sumber kebenaran tunggal); `theme:check` **34/34** lulus; kontras terang
& gelap memenuhi ambang. Temuan **T-M3-3** (warna status) diperbaiki. Detail:
`docs/VERIFIKASI-AUDIT-M3.md`.

