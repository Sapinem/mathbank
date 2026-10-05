# AUDIT — Base UI Compliance, space-y-* Elimination, WCAG 44px Touch Targets (MAT-32)

**Tanggal:** 5 Oktober 2026
**Cabang:** `paperclip/dev`
**Commit:** `39eebf1`

---

## 1. Eliminasi `space-y-*` — ✅ LULUS

Hasil pemindaian `src/components/`, `src/app/`, dan `src/styles/`:

| Layer | Jumlah `space-y-*` di kode | Status |
|---|---|---|
| `src/components/` | 0 (hanya 1 referensi di komentar `topic-picker.tsx`) | ✅ Bersih |
| `src/app/` | 0 | ✅ Bersih |
| `src/styles/` | 0 | ✅ Bersih |

Standar `flex/grid + gap-*` sudah diterapkan secara konsisten di seluruh basis kode.

---

## 2. Kepatuhan Base UI (`@base-ui/react`) — ✅ LULUS

- **Paket:** `@base-ui/react` ^1.8.0 (scoped package resmi)
- **Impor Radix UI (`@radix-ui/*`):** 0 — tidak ada komponen usang
- **18 impor `@base-ui`** terdaftar di `src/`:

| Primitif | Berkas Konsumen |
|---|---|
| `Dialog` | `ui/dialog.tsx`, `ui/sheet.tsx` |
| `Select` | `ui/select.tsx` |
| `Input` | `ui/input.tsx` |
| `Separator` | `ui/separator.tsx` |
| `Tabs` | `ui/tabs.tsx` |
| `ScrollArea` | `ui/scroll-area.tsx` |
| `Button` | `ui/button.tsx` |
| `Tooltip` | `ui/tooltip.tsx` |
| `Collapsible` | `ui/collapsible.tsx` |
| `Avatar` | `ui/avatar.tsx` |
| `Menu` | `ui/dropdown-menu.tsx` |
| `merge-props` / `useRender` | `ui/badge.tsx`, `ui/breadcrumb.tsx`, `ui/sidebar.tsx` |

Semua komponen interaktif (Dialog, Popover/Menu, Tooltip, Select) memakai primitif Base UI yang benar.

---

## 3. Standardisasi WCAG 44px Touch Targets — ✅ DIPERBAIKI

### Temuan & Perbaikan

| Area | Berkas | Temuan | Perbaikan |
|---|---|---|---|
| Filter bar — tombol Filter | `question-filter-bar.tsx` | `min-h-[36px]` | → `min-h-[44px]` |
| Filter bar — tombol clear search | `question-filter-bar.tsx` | Tanpa min-dimensi | → `min-h-[44px] min-w-[44px]` |
| Filter bar — tombol remove chip (7×) | `question-filter-bar.tsx` | Tanpa min-dimensi | → `min-h-[44px] min-w-[44px]` |
| Filter bar — tombol Reset | `question-filter-bar.tsx` | Tanpa min-dimensi | → `min-h-[44px]` |
| Filter drawer — tombol topik | `question-filter-drawer.tsx` | `py-1.5` tanpa min-height | → `min-h-[44px]` |
| Filter drawer — tombol jenjang (3×) | `question-filter-drawer.tsx` | `min-h-[30px]` | → `min-h-[44px]` |
| Filter drawer — tombol tipe soal | `question-filter-drawer.tsx` | `min-h-[30px]` | → `min-h-[44px]` |
| Filter drawer — tombol kesulitan | `question-filter-drawer.tsx` | `min-h-[32px]` | → `min-h-[44px]` |
| Filter drawer — tombol Bloom | `question-filter-drawer.tsx` | `min-h-[30px]` | → `min-h-[44px]` |
| Filter drawer — tombol status (2×) | `question-filter-drawer.tsx` | `min-h-[30px]` | → `min-h-[44px]` |
| Filter drawer — tombol sumber (2×) | `question-filter-drawer.tsx` | `py-1` tanpa min-height | → `min-h-[44px]` |
| Filter drawer — clear search | `question-filter-drawer.tsx` | Tanpa min-dimensi | → `min-h-[44px] min-w-[44px]` |
| View mode toggle | `view-mode-toggle.tsx` | `size="icon-sm"` (28px) | → `size="icon"` + `min-h-[44px] min-w-[44px]` |
| Paginasi (Sebelumnya/Berikutnya) | `question-bank-view.tsx` | `size="sm"` (28px) | → `min-h-[44px]` |
| Aksi baris tabel bento (cetak/duplikat/arsip) | `bundle-list-view.tsx` | `size="icon-xs"` (24px) | → `size="icon-sm"` + `min-h-[44px] min-w-[44px]` |
| Aksi baris tabel list (cetak/duplikat/arsip) | `bundle-list-view.tsx` | `min-h-[36px]` | → `min-h-[44px] min-w-[44px]` |
| Tab filter jenis paket | `bundle-list-view.tsx` | Tanpa min-height | → `min-h-[44px]` |
| Toggle mode tampilan paket | `bundle-list-view.tsx` | `size="icon-sm"` (28px) | → `min-h-[44px] min-w-[44px]` |
| Clear search paket | `bundle-list-view.tsx` | Tanpa min-dimensi | → `min-h-[44px] min-w-[44px]` |
| Hapus soal (icon) | `question-detail-view.tsx` | `size="icon-sm"` (28px) | → `min-h-[44px] min-w-[44px]` |
| Nav naskah prev/next | `question-detail-view.tsx` | `size="icon-xs"` + `h-6 w-6` (24px) | → `size="icon-sm"` + `min-h-[44px] min-w-[44px]` |
| Aksi review (setujui/tolak/tandai) | `review-view.tsx` | `size="sm"` (28px) | → `min-h-[44px]` (6 tombol) |
| Nav review (prev/next) | `review-view.tsx` | `size="sm"` (28px) | → `min-h-[44px]` |
| Aksi tree topik (tambah/sunting/hapus) | `topics-view.tsx` | `size="icon-xs"` (24px) | → `size="icon-sm"` + `min-h-[44px] min-w-[44px]` |
| Navigasi sidebar mobile | `app-sidebar.tsx` | `SidebarMenuButton h-8` (32px) | → `className="min-h-[44px]"` |

### Catatan: `QuestionTypeIcon` (question-card.tsx)
Tetap `size-6` (24px) di mode list karena:
1. Merupakan pemicu tooltip (`cursor-help`), bukan aksi primer.
2. Berada di dalam baris `h-11` (44px) yang seluruhnya merupakan target sentuh (Link).
3. Membesarkannya ke 44px akan merusak tata letak baris padat.

---

## 4. Definition of Done — Hasil Verifikasi

| Kriteria | Hasil |
|---|---|
| `pnpm lint` — 0 warning, 0 error | ✅ Lulus |
| `pnpm typecheck` — 0 error | ✅ Lulus |
| `pnpm test` — 667+ unit test | ✅ 667/667 lulus |
| Inspeksi responsive (scrollWidth === clientWidth @360px) | ✅ Tidak ada perubahan layout yang menambah overflow; `overflow-x-auto` pada KaTeX tetap terisolasi |

---

## Berkas Terdampak (9 berkas)

1. `src/components/questions/question-filter-bar.tsx`
2. `src/components/questions/question-filter-drawer.tsx`
3. `src/components/questions/view-mode-toggle.tsx`
4. `src/components/questions/question-bank-view.tsx`
5. `src/components/questions/question-detail-view.tsx`
6. `src/components/questions/review-view.tsx`
7. `src/components/bundles/bundle-list-view.tsx`
8. `src/components/reference/topics-view.tsx`
9. `src/components/layout/app-sidebar.tsx`
