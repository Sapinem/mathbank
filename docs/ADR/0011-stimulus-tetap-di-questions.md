# ADR-0011 — Stimulus tetap di tabel `questions` (JANGAN dipisah)

- **Status:** ✅ **DITERIMA** (2026-10-01)
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `src/lib/db/schema/question.ts`, `drizzle/manual/db_safety.sql` (trigger depth),
  `src/lib/db/invariants.ts`, `docs/ADR/0009-*.md`

## Konteks

Soal bergaya AKM/PISA punya **stimulus** (wacana induk: bacaan/gambar/tabel) dengan beberapa
**soal anak** yang menempel padanya. Pertanyaan desain: stimulus dijadikan **tabel sendiri**
(`stimuli`) atau tetap **di `questions`** (dengan relasi diri `parent_id`)?

## Keputusan

**JANGAN dipisah.** Stimulus tetap menjadi **baris `questions`** dengan `question_type='stimulus'`,
dan soal anak menunjuk ke induknya lewat `questions.parent_id`.

## Alasan (terverifikasi ke kode)

1. **Stimulus = salah satu *tipe* soal**, bukan entitas berbeda. Nilai `stimulus` ada di
   `questionTypeEnum` bersama `single_choice`, `essay`, dsb. Bikin tabel `stimuli` =
   bikin tabel `essay_questions` → **inkonsisten**.
2. **Kolom 100% sama** dengan soal biasa: `difficulty`, `cognitive_level`, `grade`, `status`,
   `is_flagged`, `embedding`, `author_id`, `source_id`, `event_id`. Pemisahan → **duplikasi 8+ kolom**
   & semua tabel turunan (`question_topics`, `question_tags`, embeddings, `bundle_items`, `audit_logs`)
   butuh **dua versi**.
3. **Invariant sudah ditegakkan di database**: trigger `trg_questions_stimulus_depth`
   (`drizzle/manual/db_safety.sql`) — stimulus wajib akar, kedalaman maks 1 level, anak tak boleh beranak.
   `onDelete: RESTRICT` mencegah hapus stimulus beranak. **Sudah bekerja & dites.**
4. **Stimulus bisa jadi butir latihan**: `bundle_items.role` bisa `'stimulus'` — stimulus sejajar
   dengan soal di dalam naskah. Pemisahan menyulitkan ini.
5. **Konsisten pola yang sudah ada**: `topics` (hierarki) & `taxonomy` (parent) memakai relasi diri
   `parent_id`, **tanpa** tabel anak terpisah.

## Kapan Baru Boleh Dipertimbangkan (syarat eksplisit)

Hanya bila stimulus kelak tumbuh **kolom unik yang banyak** (mis. `stimulus_media_type`,
`stimulus_word_count`, `stimulus_reading_level`) **dan** perlu **dipakai ulang lintas set soal**
(satu stimulus → banyak paket dari waktu berbeda). **Sekarang tidak ada.** Bila muncul, tinjau ulang —
tetap **bukan** alasan memisah sekarang.

## Alternatif yang Ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| **Tabel `stimuli` terpisah** | Duplikasi kolom & tabel turunan; inkonsisten dengan `questions.question_type`; +query join di editor/builder/print (192 pemakaian) |
| **`stimulus_id` ke tabel baru + `questions.stimulus_id`** | Sama; tetap duplikasi; trigger depth harus ditulis ulang |

## Konsekuensi

- **Tidak ada perubahan skema.** Stimulus tetap `questions` + `parent_id` + trigger depth.
- Fokus bergeser ke **penyempurnaan UI** (render wacana stimulus induk di editor/print) bila perlu.

## Catatan

- Keputusan ini **menutup kegalauan** stimulus: **digabung** (satu tabel), bukan dipisah.
