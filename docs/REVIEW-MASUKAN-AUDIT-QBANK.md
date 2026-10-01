# REVIEW MASUKAN AUDIT QBank — Verifikasi & Rencana Eksekusi

- **Tanggal:** 2026-10-01
- **Sumber masukan:** `~/projects/MathBankAuditor/reports/AUDIT-KOMPARASI-FITUR-DAN-UIUX-MATHBANK-VS-QBANK.md` (602 baris)
- **Metode:** tiap klaim **diverifikasi ke kode nyata** (pelajaran M13: klaim audit lama sering PALSU/usang).
- **Aturan kerja (arahan pemilik):** review **satu per satu**; masukan yang **berdekatan boleh dikerjakan bersamaan** (gabung milestone) **tanpa menghilangkan detail** info; tiap butir punya status + bukti.

> **Legenda status:** ✅ sudah beres · 🟡 sebagian · ⬜ belum · ⛔ ditolak/tak perlu · 🔁 sudah usang (klaim audit keliru)

---

## A. Verifikasi 5 "perbaikan cacat" (§5.3–5.5)

| # | Klaim audit | Verifikasi nyata | Status |
|---|---|---|---|
| A1 | §5.3 PATCH `questions/[id]` masih 403 (`permission` tanpa `ownerId`) | Komentar kode eksplisit "SENGAJA tanpa `permission` (#35)"; `PATCH` **tanpa** gate permission | 🔁 **usang** — sudah diperbaiki (`ad2f6de`) |
| A2 | §5.4 KaTeX error fallback belum di-escape (XSS) | `math/math-content.tsx:48,74` — `escapeHtml()` diterapkan | 🔁 **usang** — sudah diperbaiki (`35c7716`) |
| A3 | §5.5 sisa `space-y-*` di `moodle-export-button.tsx` | Ternyata **3 tempat** (bukan 1): 2× `moodle-export-button.tsx` + 1× `question-editor.tsx` | ✅ **selesai** — jadi `flex flex-col gap-*` |
| A4 | §3.7 `cognitiveLevel` hilang dari kartu soal | `question-card.tsx` tak menampilkan level kognitif | ⬜ **belum** |
| A5 | `FieldGroup` ghost (laporan lain) | Tak ada `FieldGroup` di seluruh `src/` | 🔁 **tak relevan** |

## B. Verifikasi 24 rekomendasi roadmap (§5)

### B1 — UI Bank Soal (klaster tampilan)

| # | Masukan | Verifikasi | Status |
|---|---|---|---|
| 1 | 3 mode view (List padat / Grid bento / Masonry) benar-benar berbeda | `ViewModeToggle` ada, **1 kartu sama** untuk 3 mode (`bank-soal-view.tsx`) | ⬜ belum |
| 2 | Bulk Action Bar (checkbox + modal batch) | `BulkActionBar`/UI **tiada**; backend `batchUpdateQuestions` siap | ⬜ belum |
| 6 | Panel filter: multi-select + searchable combobox topik, **tanpa pill** | `aside w-64` = 5 `<Select>` tunggal | ⬜ belum |
| 23 | Grafik sebaran tipe soal di dasbor | `page.tsx` dasbor hanya angka global | ⬜ belum |

### B2 — Editor Soal

| # | Masukan | Verifikasi | Status |
|---|---|---|---|
| 15 | Form dinamis per tipe (assertion_reason, combination_1234, matrix_grid, matching) | `question-editor.tsx` generik (1 textarea) | ⬜ belum (schema 11 tipe ada) |
| 16 | Autosave draft `localStorage` (debounce 5s) | tak ada | ⬜ belum |
| 20 | KaTeX linter pre-save | tak ada (cek hanya di render klien) | ⬜ belum |
| 21 | Pemilih wacana stimulus induk di editor | `parentId` statis, tanpa UI pemilih | ⬜ belum |

### B3 — Pedagogis (klaster rubrik)

| # | Masukan | Verifikasi | Status |
|---|---|---|---|
| 8 | Badge mikro C1–C6 + popover rubrik + helper di editor | tak ada di kartu/editor | ⬜ belum |
| 24 | Fase Kurikulum Merdeka (A–F) + KKO Bloom | `grades` masih array string statis | ⬜ belum |

### B4 — Review

| # | Masukan | Verifikasi | Status |
|---|---|---|---|
| 11 | Mode Rapid Review (flashcard, panah ←/→) | `telaah-view.tsx` = kartu tumpuk vertikal | ⬜ belum |

### B5 — Konten & Presentasi

| # | Masukan | Verifikasi | Status |
|---|---|---|---|
| 10 | Render wacana stimulus induk (AKM/PISA) | `parent_id` ada di DB, **tak di-render** di card/detail | ⬜ belum |
| 12 | Audit Timeline per butir di detail soal | `/system/audit` global ada; **tak ada per-butir**; tak ada `GET /api/audit-logs?entityId` | ⬜ belum |
| 13 | Multi-solusi (Formal vs Quick Tip) | `answerKey.explanation` tunggal | ⬜ belum |

### B6 — Studio & Media (klaster besar)

| # | Masukan | Verifikasi | Status |
|---|---|---|---|
| 9 | Porting TikZ Studio compiler (latex→dvisvgm) | `studio/tikz/page.tsx` = `ComingSoon`; **tak ada** compiler | ⬜ belum (label "M6" di halaman **keliru** — M6 = Pencarian) |
| 14 | AssetPickerModal + Comot&Modif + AI Generator | tak ada; `media_assets` schema ada tapi **API `/api/media` tak ada** | ⬜ belum |
| 5 | Media hygiene (orphan assets) | `ingest/media/` (M9) unduh korpus ✅; pembersih orphan ⬜ | 🟡 sebagian |

### B7 — Cetak

| # | Masukan | Verifikasi | Status |
|---|---|---|---|
| 18 | Kop institusi + logo + watermark + mode Guru/Siswa | `/bundles/[id]/print` ada (2 kolom), tanpa kop/watermark/mode | ⬜ belum |

### B8 — Backend & Data

| # | Masukan | Verifikasi | Status |
|---|---|---|---|
| 17 | Merge tag sinonim (atomik) | `tags-view.tsx` CRUD saja | ⬜ belum |
| 19 | (lihat B6 #5 media hygiene) | — | — |
| 22 | Modal bulk + BatchProgress runner | = B1 #2 (duplikat) | ⬜ belum |
| 7 | (lihat §C) Dekonstruksi bundle | ADR-0009 **ditolak** (satu tabel); UI "Koleksi vs Latihan" belum | 🟡 sebagian |
| 3, 4 | #35 & XSS | sudah beres | ✅ |

## C. §3.6 Dekonstruksi Bundle — sudah diputuskan

- ADR-0009 (**Ditolak**): tetap **1 tabel `bundles`** (cermin QBank master).
- **Sisa**: (a) kolom `points` di `bundle_items` — **ditunda** (YAGNI); (b) pemisahan **UI** "Koleksi" vs "Latihan" — ⬜ belum.

---

## D. Usulan Pengelompokan Eksekusi (gabung yang berdekatan)

> Prinsip: tiap gelombang = 1 tema koheren, **tidak mengurangi detail**; disetujui dulu sebelum eksekusi.

- **G1 — Presentasi Soal (pedagogis inti)** 🔥 prioritas
  10 (stimulus induk) + 8 (badge C1–C6 + popover) + 4 (level kognitif di kartu) + 6 (panel filter multi-select)
- **G2 — Editor Soal**
  15 (form per tipe) + 21 (pemilih stimulus) + 16 (autosave) + 20 (KaTeX linter) + 8-helper (rubrik di editor)
- **G3 — Kurasi Massal**
  2/22 (bulk action + batch progress) + 11 (rapid review) + 17 (merge tag)
- **G4 — Studio Media** (paling berat; butuh compiler TeX)
  9 (TikZ) + 14 (AssetPicker + fork + AI) + 5 (hygiene) — **butuh keputusan** apakah porting penuh
- **G5 — Cetak & Riwayat**
  18 (kop + watermark + mode) + 12 (audit timeline per butir)
- **G6 — Kurikulum & Analitik**
  24 (Fase Merdeka + KKO) + 23 (grafik sebaran tipe)
- **G7 — Bersih kecil** ✅ **selesai 2026-10-01**
  A3 (`space-y-*` → `flex flex-col gap-*`, 3 tempat) + label tombol (`Filter` → `Saring`, 2 tempat)

---

## § Catatan Verifikasi

- ✅ Semua klaim di atas **dicek ke kode** (`grep`/`sed`), bukan dari teks audit saja.
- 🔁 **3 klaim audit USANG**: A1 (#35), A2 (XSS), A5 (FieldGroup) — sudah beres di MathBank, audit merujuk snapshot lama.
- ⚠️ **Label `ComingSoon milestone="M6"` di halaman studio KELIRU** — M6 MathBank = Pencarian & Filter (selesai), bukan Studio. Perlu dikoreksi saat G4.
- ⚠️ **`media_assets` + `question_media`**: schema ADA, **NOL konsumen produksi** → persis pola **CONSTRAINTS #43** ("belum terintegrasi"), bukan "Lulus".
