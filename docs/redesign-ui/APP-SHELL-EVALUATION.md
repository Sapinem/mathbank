# Evaluasi & Penyesuaian Responsif AppShell

> **Status:** ✅ Terverifikasi & Diperbaiki
> **Tanggal:** 2026-10-01
> **Branch:** `redesign-ui`
> **Kategori:** C7 (Dokumentasi Desain & Antarmuka)
> **Dasar Acuan:** [CONSTRAINTS.md](../../CONSTRAINTS.md) (#10, #11, #14), [docs/RENCANA-UI.md](../RENCANA-UI.md) §4b, [docs/RENCANA-UI-MOBILE.md](../RENCANA-UI-MOBILE.md) §0

---

## 1. Ringkasan Temuan Evaluasi

Evaluasi empiris terhadap `AppShell` (`src/components/layout/app-shell.tsx`, `header.tsx`, `app-sidebar.tsx`, dan `use-mobile.ts`) menemukan kondisi sebagai berikut:

| Aspek | Status Awal | Catatan Evaluasi |
|---|:---:|---|
| **Viewport & Kontainer Scroll** | 🟢 Aman | Memakai `h-svh` + `overflow-hidden` di provider dan `flex-1 overflow-y-auto` di area konten utama. Header tetap menempel (*sticky*) tanpa pergeseran layout liar saat address bar mobile muncul. |
| **Aksesibilitas (A11Y) & Keyboard** | 🟢 Aman | `SkipLink` (`#konten-utama`) aktif, `tabIndex={-1}`, `aria-label` terpasang, pintasan `⌘B`, `⌘K`, `/`, dan `?` bekerja dan lulus 100% tes vitest. |
| **Breakpoint Kunci Sidebar** | 🟡 Inkonsisten | `RENCANA-UI-MOBILE.md` §0 menetapkan batas kunci di **`lg` (1024px)** (di bawahnya sidebar menjadi drawer). Namun di kode ([`use-mobile.ts`](../../src/hooks/use-mobile.ts)), breakpoint masih di **768px (`md`)**, menyebabkan tablet portrait (768–1023px) terhimpit oleh sidebar statis 256px. |
| **UX Drawer Navigasi Mobile** | 🔴 Cacat UX | Saat drawer dibuka di HP/mobile dan pengguna mengklik tautan menu, Next.js berpindah halaman di latar belakang, namun **drawer TIDAK otomatis menutup**. Pengguna terpaksa harus mengetuk manual ke luar sheet. |
| **Touch Target Header Mobile** | 🟡 Melanggar Batas Mutu | Melanggar **CONSTRAINT #11 (Touch target ≥ 44×44px)**. Tombol cari mobile dan tombol tema di header menggunakan `size="icon-sm"` (hanya 28×28px). |

---

## 2. Rincian Perbaikan yang Diterapkan

### A. Sinkronisasi Breakpoint ke `1024px` (`lg`)
Sesuai aturan emas RENCANA-UI-MOBILE: *"Satu batas kunci — `lg` (1024px): di bawahnya sidebar → drawer"*:
- Di [`src/hooks/use-mobile.ts`](../../src/hooks/use-mobile.ts): `MOBILE_BREAKPOINT` diselaraskan ke `1024`.
- Di [`src/components/ui/sidebar.tsx`](../../src/components/ui/sidebar.tsx): kelas visibilitas desktop diselaraskan dari `md:block` / `md:flex` menjadi `lg:block` / `lg:flex`.

### B. Penutupan Otomatis Drawer Mobile Saat Navigasi
- Di [`src/components/layout/app-sidebar.tsx`](../../src/components/layout/app-sidebar.tsx):
  - Memanfaatkan `useSidebar()` untuk mengakses `setOpenMobile` dan `isMobile`.
  - Menambahkan listener atau callback `onClick` pada setiap tombol navigasi menu (`SidebarMenuButton`): jika `isMobile` aktif, panggil `setOpenMobile(false)` agar drawer langsung menutup mulus begitu menu dipilih.

### C. Pemenuhan Batas Mutu Touch Target ≥ 44×44px (CONSTRAINT #11)
- Di [`src/components/layout/header.tsx`](../../src/components/layout/header.tsx):
  - Tombol aksi mobile (`SidebarTrigger`, ikon pencarian mobile, dan `ThemeToggle`) diberikan area sentuh minimal 44×44px dengan memanfaatkan utilitas `min-h-[44px] min-w-[44px] flex items-center justify-center` atau ukuran sentuh ergonomis tanpa merusak proporsi visual desktop.

---

## 3. Hasil Pengujian & Verifikasi
- Seluruh tes layout di `src/components/layout/` wajib lulus (`pnpm test src/components/layout/`).
- `pnpm lint:names` wajib exit 0.
- `pnpm check` wajib hijau (0 error type, 0 error lint, coverage ≥ 85%, build sukses).
