# RENCANA-PAKET.md — M7 Paket Soal

> **Status:** dikerjakan (M7). **Dependensi:** M6 (bank soal + pencarian).
> **Tujuan:** menyusun naskah/bundles dari bank soal, dengan penyusun
> drag-and-drop (desktop) dan tampilan baca yang enak di HP.

## 1. Model Data (sudah ada sejak M1)

`bundles` — metadata paket: `title`, `slug`, `bundle_type`
(`source`|`exam`|`exercise`), `source_id`, `event_id`, `year`, `grade`,
`duration_minutes`, `instructions`, `status` (draft|review|ready|archived),
`created_by_id`, `deleted_at` (soft-delete).

`bundle_items` — isi paket: `bundle_id`, `question_id`, `role`
(`question`|`stimulus`), `order_index`, `section_name`, `item_number`, `notes`.

**Invarian (dijaga DB + service):**
- `question_id` → **RESTRICT**: soal yang dipakai paket **tak bisa dihapus**.
- `bundle_id` → **CASCADE**: hapus paket → item ikut terhapus.
- `UNIQUE(bundle_id, question_id)`: satu soal sekali per paket.
- `slug` unik **antar paket aktif** (boleh dipakai ulang setelah soft-delete).

## 2. Aturan Bisnis

| Aturan | Perilaku |
|--------|----------|
| **Stimulus 1×** | Baris `role='stimulus'` disimpan **sekali**; soal anak merujuknya lewat `parent_id`. Penyusun menampilkan stimulus sekali, anak di bawahnya. |
| **Soal terpakai → RESTRICT** | `deleteQuestion` menolak bila ada di `bundle_items` (ConflictError 409). |
| **Tanpa kunci → boleh, ditandai** | `validateBundle` melaporkan soal tanpa `answer_key` sebagai **peringatan**, bukan error. |
| **Duplikasi** | Salin metadata + seluruh item (urutan & section) dengan slug baru. |
| **Arsip** | Soft-delete (`deleted_at`); tak muncul di daftar; dapat dipulihkan. |
| **Peran** | `bundle:view` (semua), `bundle:manage` (admin/teacher). Agent/machine: view saja. |

## 3. Lapisan

- **L5 Service** `src/lib/services/bundle-service.ts` — list/get/create/update/
  delete(soft)/duplicate + `addItem`/`removeItem`/`reorderItems`/`validateBundle`.
- **L4 API** `/api/bundles`, `/api/bundles/[id]`, `/api/bundles/[id]/items`,
  `/api/bundles/[id]/items/[itemId]`, `/api/bundles/[id]/validate`,
  `/api/bundles/[id]/duplicate`.
- **L3 Hooks** `src/lib/hooks/use-bundles.ts`.
- **L2 Komponen** `bundle-list-view`, `bundle-detail-view`, `bundle-builder`
  (drag-and-drop, `DesktopOnly`), `bundle-picker` (pilih soal dari bank).
- **Rute** `/bundles` (daftar), `/bundles/new` (penyusun), `/bundles/[id]` (detail).

## 4. UI

- **Daftar paket**: tabel — judul, tipe, tahun, jumlah soal, durasi, status.
- **Penyusun** (`/bundles/new`, `/bundles/[id]/edit`): dua kolom — kiri bank soal
  (cari/filter dari M6), kanan isi paket. **Drag** untuk urut; tombol naik/turun
  sebagai alternatif aksesibel. `DesktopOnly` membungkus penyusun; di HP tampil
  pesan "kelola paket di desktop".
- **Detail**: pratinjau naskah (stimulus 1×, soal bernomor, KaTeX), tombol
  Ekspor (→ M8) & Duplikat.

## 5. Tes

- **Alur API** (`src/lib/api/flow.db.test.ts` atau `bundle-api.db.test.ts`):
  buat paket → tambah soal → urut → stimulus 1× → validasi (tanpa kunci =
  peringatan) → duplikat → arsip → RESTRICT hapus soal.
- **Integrasi** `bundle-service.db.test.ts`: urutan item, RESTRICT, duplikasi,
  soft-delete, perhitungan jumlah soal.

## 6. Definition of Done

- [ ] Susun paket dari bank soal (tambah/hapus/urut/section).
- [ ] Stimulus tampil **1×** (diuji).
- [ ] Soal terpakai → RESTRICT (diuji 409).
- [ ] Duplikasi + arsip (soft-delete) bekerja.
- [ ] Tes alur API + integrasi hijau; `pnpm check` hijau.
- [ ] RENCANA-PAKET.md (dokumen ini) diperbarui.
