# STATUS UI — TUNTAS ✅

> **DIPERBARUI:** UI yang dulu menggantung kini **TUNTAS** — lihat `RENCANA-UI.md`.
> Semua keputusan (sidebar, referensi, flagged, ingest, dasbor) sudah diputuskan.
> Sisa pengerjaan = **Fase C & D** (M3 & M4–M8).

---

## Ringkas: Semua Keputusan Sudah Tuntas

| # | Isu | Keputusan |
|---|-----|-----------|
| 1 | Sidebar | Kiri, tetap, collapsible |
| 2 | Referensi | Link terpisah (bukan accordion) |
| 3 | URL | `/referensi/topik` dst |
| 4 | "Telaah" | Nama menu (bukan "Antrean Review") |
| 5 | Dasbor | Informatif ("ramai") |
| 6 | Flagged | Tab di "Telaah" |
| 7 | Arti flagged | Manual (reviewer) + otomatis (dedup) |
| 8 | Ingest | Disembunyikan sampai M9 |
| 9 | Menu per-peran | Sama untuk semua |

➡️ **Detail lengkap: `RENCANA-UI.md`**

---

## Sisa Pengerjaan (bukan lagi "keputusan")

| Fase | Isi | Milestone |
|------|-----|-----------|
| A | Mesin tema | M3 |
| B | Komponen dasar | M3 |
| C | Shell (sidebar, header, ⌘K) | M3 |
| D | Halaman (dasbor, bank soal, telaah, paket, editor) | M4–M8 |

---

## Catatan Teknis (dari QBank, untuk dibawa)

- **Token tema:** `--mb-<peran>` (OKLCH) — ganti 3 warna → `pnpm theme:build`.
- **Default mode ikut OS** (skrip tanpa flash di `layout.tsx`).
- **Warna status UNIVERSAL** (tak ikut brand). "Siap" = biru brand.
- **WCAG** terverifikasi (border/teks kontras).
- **Pelanggaran React Compiler** QBank (`useMemo`/`useCallback`) — MathBank **tidak boleh**.

---

## Referensi Lama (arsip sejarah)

Konteks berikut menjelaskan **kenapa** UI dulu dijeda — disimpan sebagai sejarah:

### Kenapa Dijeda (2026-09-29)
Saat mengerjakan UI, ditemukan bahwa **`exam_events` sudah ada API & tab di `/sources`** tapi tak ada di menu → memicu pertanyaan "apakah data pendukung sebaiknya digabung?" → merembet ke review arsitektur menyeluruh → berujung keputusan bikin MathBank baru.

**Pelajaran:** jangan putuskan struktur menu sebelum arsitektur mantap.

### Keputusan Carry-over (dari QBank)
- "Eksplorer Soal" → **"Bank Soal"** ✓
- Tombol "Buat Soal" header → **dihapus** ✓
- Quick-action → **Cari (⌘K)** ✓

### Fase yang Sudah Selesai di QBank (untuk dibawa/dibangun ulang di M3)
- **Fase A** (tema): mesin 3 warna → OKLCH + WCAG
- **Fase B** (komponen): Button/Badge/Modal/ConfirmModal/State
