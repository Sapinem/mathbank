# ADR-0010 — Model `event` = jenis berulang (tahun di soal), bukan instance per tahun

- **Status:** ✅ **DITERIMA** (2026-10-01)
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `docs/ADR/0009-*.md`, QBank `master:src/lib/db/schema/exam-events.ts`,
  QBank spec `docs/superpowers/specs/2026-09-27-exam-origin-events-design.md`,
  `src/lib/db/schema/{event.ts,question.ts}`

## Konteks

Soal perlu menyimpan **konteks ujian asli** (provenance): UTBK SNBT 2024, SIMAK UI 2022, OSN-K 2023.
Pertanyaan desain: **di mana tahun disimpan** — di `events` (master) atau di `questions` (butir)?

Dua model yang dipertimbangkan:

- **Model A** — `events` = **jenis ujian berulang** ("UTBK SNBT" = 1 baris, dipakai tiap tahun);
  tahun disimpan di **butir soal** (`questions.event_year`).
- **Model B** — `events` = **instance per tahun** ("UTBK SNBT 2024", "UTBK SNBT 2023" = baris terpisah);
  tahun disimpan di **`events.year`**.

## Keputusan

**Pilih Model A.** `events` menyimpan **jenis ujian** (stabil, dipakai ulang lintas tahun);
tahun, subtes, nomor butir, & catatan disimpan **di `questions`**.

**Nol perubahan skema** — kolom sudah lengkap:
- `events`: `name`, `shortname`, `fullname`, `code`, `category`, `subtests`, `aliases`, `color_token`
- `questions`: `event_id`, `event_year` (smallint), `event_subtest`, `event_item_number`, `event_notes`

## Alasan (dari contoh nyata)

Contoh: 6 soal UTBK (2023/2024/2025) + 1 soal SIMAK UI 2022.

| Aspek | Model A (dipilih) | Model B (ditolak) |
|---|---|---|
| Baris `events` untuk UTBK | **1** ("UTBK SNBT") | **3+**, tumbuh tiap tahun |
| Filter "UTBK 2024" | `event_id=E&year=2024` (1 langkah) | harus tahu id instance dulu |
| Filter "semua UTBK" | `event_id=E` | `event_id IN (…tahun…)` makin panjang |
| Ganti nama event | ubah **1 baris** | ubah semua baris tahun |
| Cermin QBank master | ✅ **identik** | ❌ beda |

**Prinsip:** tahun = *kapan butir ini dipakai*, milik **butir**; event = *identitas jenis ujian*,
milik **master**. UTBK **berulang tiap tahun**, bukan rentang (`start_year`/`end_year` **ditolak** —
tak bisa merepresentasikan tahun butir tunggal).

## Alternatif yang Ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| **Model B** (tahun di `events`) | Menyuplikasi event per tahun; filter 2 langkah; menyimpang dari QBank |
| **`events.start_year`/`end_year`** | UTBK bukan rentang; tak bisa mengisi tahun butir 2024 dengan benar |

## Konsekuensi

- **Tidak ada migrasi skema.** Cukup:
  1. **Backfill `events`** — isi master jenis ujian (UTBK SNBT, SIMAK UI, OSN-K, …).
  2. **Tautkan butir** — isi `questions.event_id` + `event_year` + `event_subtest` (saat ini 0 baris).
- **Perlu (opsional, kecil):** tambah index gabungan `(event_id, event_year)` untuk filter "UTBK 2024"
  yang cepat (sekarang hanya `idx_questions_event_id`). Dapat dilakukan via migrasi drizzle-kit kecil.
- Data lama (21.245 soal ingest M9) **tak ber-`event_id`** — backfill otomatis perlu skrip berbasis
  deteksi judul/kode (QBank punya preseden: `scripts/backfill-origin-events.ts`).

## Catatan

- **`sources.title` (judul artikel web) + waktu akses** — dibahas terpisah (belum diputuskan).
- **Stimulus** — keputusan terpisah: **jangan dipisah** (tetap `questions` + `parent_id`).
