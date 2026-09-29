# ADR-0005 — Pakai komponen **resmi** shadcn (bukan tulis sendiri)

- **Status:** Diterima
- **Tanggal:** 2026-09-29
- **Pengambil keputusan:** Pemilik produk + lead engineer
- **Terkait:** `RENCANA-UI.md` §5, `REVIEW-TUMPUKAN-TEKNOLOGI.md` §5

## Konteks

Shell/UI awal (sidebar, mobile-nav, user-menu) ditulis tangan. shadcn kini menyediakan **61+ komponen resmi** — termasuk `sidebar` komposabel dengan collapse, drawer mobile, shortcut ⌘B, dan persistensi cookie bawaan. Menulis sendiri berarti memelihara kode yang seharusnya disediakan library.

## Keputusan

**Prinsip: komponen RESMI shadcn lebih dulu; kustom hanya bila shadcn tak punya.** Sebelum membuat komponen, **periksa registry** (via MCP shadcn: `search_items_in_registries`).

Diterapkan: shell dirombak total memakai `sidebar`, `breadcrumb`, `avatar`, `collapsible`, `scroll-area` resmi. File buatan tangan (`sidebar.tsx`, `mobile-nav.tsx`, `user-menu.tsx`) **dihapus**.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| Tambal kode sendiri | Memelihara ulang yang sudah ada; rawan bug (mis. drawer, a11y) |
| Tetap shadcn versi lama | Kehilangan komponen resmi terbaru |
| UI library lain (MUI, Mantine) | Belum selaras arah visual & stack (Tailwind v4 + Radix) |

## Konsekuensi

**Positif:**
- Fitur kompleks "gratis": ⌘B, cookie persist, drawer, tooltip saat collapse.
- Lebih sedikit kode untuk dipelihara; a11y lebih baik (bawaan).
- Registry MCP memudahkan menemukan komponen.

**Negatif / utang:**
- Komponen resmi **harus disesuaikan** dengan konvensi kita (mis. `use-mobile` ditulis ulang agar patuh larangan React Compiler).
- `--sidebar-*` var perlu dipetakan ke token brand (`globals.css`).
- Teks a11y bawaan Inggris → diterjemahkan ke Indonesia.

## Catatan

**Pertanyaan terbuka (perlu ADR terpisah):** basis primitif UI = **Radix UI** (`package.json` kini `radix-ui@1.6.7`) atau **Base UI** (disebut `AGENTS.md`)? shadcn mendukung keduanya → **ratifikasi** agar tak ambigu (`REVIEW-TUMPUKAN-TEKNOLOGI.md` §5).
