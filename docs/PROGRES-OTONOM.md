# PROGRES OTONOM — Review & Pembangunan Milestone

> **Konteks:** pemilik produk minta agent melanjutkan review M1→M12 + membangun
> milestone yang belum selesai ("kalau green lanjutin aja sampai milestone terakhir").
> Aturan: verifikasi terhadap kenyataan (kode/DB/tes/e2e), catat temuan, perbaiki
> bila jelas, gate hijau (theme:check · tsc · lint · unit · db · e2e) sebelum commit.
> **JANGAN** ubah schema/arsitektur tanpa persetujuan (AGENTS.md §2).

## Ringkasan status

| Milestone | Status | Catatan |
|-----------|:------:|---------|
| M1 Skema DB | ✅ LULUS | 🔴 migrasi dari nol diperbaiki & terverifikasi |
| M2 Auth & Peran | ✅ LULUS | 🟠 matriks diselaraskan; 🟡 login/forbidden → utang M15 |
| M3 Tema & Shell | ✅ LULUS | 🔴 klaim WCAG palsu → **diimplementasikan** (16/16); audit shadcn |
| M4 Bank Soal | ✅ SELESAI | M4a/b LULUS; M4c (editor+detail) & M4d (telaah+pengaturan) dibangun |
| M5 Taksonomi | 🟡 sebagian | **Topik ✅** (pohon, anti-siklus, RESTRICT); Sumber/Event/Label menyusul |
| M6–M12 | ⏳ belum | |

## Commit (dari yang terbaru)

| Commit | Isi |
|--------|-----|
| `4578a85` | M5 Topik: service+API+UI, anti-siklus, RESTRICT; fix cacat bundel klien |
| `73e2516` | M4d: Telaah + Pengaturan (M4 penuh) |
| `2aa6dd5` | M4c: editor soal & detail (11 tipe) |
| `3d25c0d` | Review M4 (M4a/b LULUS) |
| `24c0072` | M3: verifikasi WCAG nyata + LULUS |
| `b05780c` | Optimasi shadcn |
| `3164e6b` | M2: enrichment teacher/reviewer (keputusan pemilik) |
| `fe6ded6` | Review M2 |
| `0fcc2d1` | Review M1 LULUS |
| `cbc7160` | Fix migrasi dari nol (M1) |

## Laporan lengkap

- `docs/REVIEW-PER-MILESTONE.md` — temuan & perbaikan tiap milestone (M1–M4).
- `docs/RENCANA-SOAL.md` — 11 tipe soal (M4c).

## Utang / pekerjaan berikutnya

1. **M5 lanjutan** — Sumber, Event, Label (pola CRUD mirip Topik) + `RENCANA-TAKSONOMI.md`.
2. **M4c lanjutan** — UI interaktif `matrix_grid`/`matching`, tambah/hapus opsi dinamis.
3. **M15** — halaman login & forbidden (utang M2).
4. **Produksi** — role DB non-superuser (S10).

## Pengingat arsitektur (pelajaran)

- **Komponen klien JANGAN impor `@/lib/services/*`** (menarik `@/lib/db`→`fs`→
  bundel browser pecah). Logika murni → file terpisah tanpa DB (mis.
  `src/lib/taxonomy/tree.ts`). Ditemukan & diperbaiki di M5.

## Riwayat M3 (temuan asli — sudah diselesaikan)

- 🔴 klaim "Verifikasi WCAG otomatis" palsu → dibangun `theme:check` (16/16) ✅
- 🟡 `--font-geist-mono` → `--font-roboto-mono` ✅
- ✅ Radix → Base UI bersih total (0 sisa); responsif satu-kode
