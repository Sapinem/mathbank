# ADR-0020 — Pemisahan Mutlak Event Ujian Makro dan Saluran Provenance Naskah

- **Status:** Diusulkan (Direncanakan untuk MathBank v2.0 Fase 1)
- **Tanggal:** 2026-10-07
- **Pengambil keputusan:** Pemilik produk & Principal Software Architect
- **Terkait:** `docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md` (**dipertegas & disempurnakan**),
  `docs/ADR/0014-sumber-menempel-pada-bundle.md` (provenance naskah pada `bundles`),
  `docs/plans/2026-10-06-utang-teknis-bundles-event-id.md` (resolusi utang teknis),
  `docs/RENCANA-MATHBANK-V2.md` (§2.B)

## Konteks

Dalam perancangan sistem bank soal matematika berskala besar, sering terjadi kerancuan antara dua konsep asal-usul yang memiliki hakikat sangat berbeda:
1. **Event Ujian Resmi Makro (*Macro Standardized Exam*):** Ujian terstandarisasi berskala nasional/resmi seperti UTBK-SNBT, SIMAK UI, UM UGM, dan OSN Matematika. Event ini adalah predikat pedagogis intrinsik dari butir soal tersebut (contoh: *"Soal ini aslinya adalah Soal UTBK SNBT 2024 Nomor 12"*).
2. **Provenance Saluran Perolehan (*Acquisition Provenance*):** Kanal digital atau fisik tempat berkas naskah diperoleh atau dihimpun oleh guru/pengembang (contoh: *"Diunduh dari artikel Blog Defantri"*, *"Disalin dari Modul Bimbel Nurul Fikri"*, atau *"Buku Bank Soal Erlangga"*).

### Masalah Terjadinya Utang Teknis di v1.0
Pada implementasi v1.0, kolom `event_id` sempat secara keliru ditambahkan ke tabel `bundles` selain berada di tabel `questions`. Skrip migrasi/backfill terdahulu (`scripts/dev/backfill-event.ts`) terlanjur mengisi `bundles.event_id` pada 49 baris paket.

Hal ini menimbulkan cacat relasional:
- **Satu Soal Digunakan di Banyak Naskah:** Bukti data riil (2026-10-06) mencatat **112 butir soal** dipakai di lebih dari satu bundle, dan **91 butir soal** memiliki `event_id` yang berbeda dari paket tempat ia dirakit (misalnya sebuah soal UTBK 2019 SAINTEK dirakit guru ke dalam bundel naskah latihan non-event *"Latihan Soal Integral Tentu"*).
- Menempelkan `event_id` pada bundel menimbulkan ambiguitas semantik: apakah paket itu sendiri yang merupakan event, atau soal di dalamnya?

## Keputusan

1. **`events` Melekat Eksklusif pada Butir Soal (`questions`):**
   - Kolom `event_id`, `event_year`, `event_subtest`, `event_item_number`, dan `event_notes` adalah milik tunggal tabel `questions`.
   - Sebuah soal hanya boleh memiliki maksimal satu event resmi asal (opsional / *nullable* jika bukan soal ujian resmi).
2. **`sources` Melekat pada Naskah Bundel (`bundles`):**
   - Kanal provenance diwakili oleh relasi `bundles.source_id REFERENCES sources(id)` ditambah `bundles.url` (tautan artikel/dokumen sumber).
   - Relasi soal dengan naskah perolehan bersifat M:N melalui tabel penghubung `bundle_items`. Satu butir soal dapat terlacak hadir di naskah Defantri dan modul bimbel tanpa menduplikasi identitas butir soal.
3. **Resolusi Utang Teknis: Hapus `bundles.event_id`:**
   - Kolom `bundles.event_id`, foreign key ke `events(id)`, dan index `idx_bundles_event_id` **dihapus secara permanen** dari skema Drizzle dan database PostgreSQL (`ALTER TABLE bundles DROP COLUMN event_id`).
   - Hentikan seluruh penulisan `event_id` ke `bundles` pada skrip ingest, backfill, form input bundle, dan Zod schemas.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| **Pertahankan `event_id` di Bundles dan Soal Sekaligus (Status Quo)** | Menimbulkan ambiguitas sumber kebenaran (*dual source of truth*). Menyulitkan kurasi ketika sebuah bundel latihan memuat kumpulan soal dari beragam event (misal paket campuran UTBK dan SIMAK UI). |
| **Pindahkan Seluruh Event ke Bundles (Soal Tanpa Event)** | Merusak kemampuan deduplikasi soal. Saat guru menduplikasi atau memilih butir soal untuk lembar ujian baru, identitas historis ujian makro butir soal tersebut akan hilang jika hanya tersimpan di bundel sumber awal. |
| **Buat Tabel Relasi M:N Khusus `question_events`** | Terlalu rumit (*over-engineering*). Berdasarkan hakikat historis, sebuah butir soal matematika lahir dari satu momen ujian makro tertentu (atau dibuat orisinal tanpa event). Menyimpan kolom skalar `event_id` langsung di tabel `questions` sudah optimal dan efisien. |

## Konsekuensi

**Positif:**
- **Pembersihan Semantik 100%:** Batasan tanggung jawab menjadi sangat jernih: `events` untuk klasifikasi ujian makro butir soal, `sources` + `bundles` untuk kanal provenance naskah dan perakitan dokumen.
- **Dukungan Penuh Soal Lintas-Paket:** Guru bebas merakit butir soal ujian nasional ke dalam berbagai paket latihan harian tanpa menimbulkan kontradiksi metadata event pada bundel.
- **Penyederhanaan Skema & UI:** Form pembuatan/pengeditan bundel tidak lagi terbebani oleh pemilihan event ujian makro; bundel hanya berurusan dengan judul, metadata naskah sumber (`source_id`), dan konfigurasi cetak.

**Negatif / utang:**
- Perlu eksekusi migrasi Drizzle untuk men-*drop* kolom `event_id` pada tabel `bundles`.
- Pembersihan referensi `bundles.eventId` pada komponen UI detail bundel dan file skrip backfill.

## Catatan

- Menuntaskan dokumen utang teknis `docs/plans/2026-10-06-utang-teknis-bundles-event-id.md`.
- Sesuai dengan konfirmasi pemilik produk: *"Event id hanya milik soal, bundle gak punya event_id."*
