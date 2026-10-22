# KAMUS-DATA.md — Glosarium Istilah Domain MathBank

> **Status:** ✅ berlaku (per 2026-09-29).
> **Tujuan:** satu definisi untuk tiap istilah domain — agar dokumen, UI, kode & percakapan memakai kata yang sama.
> **Sumber kebenaran:** `src/lib/db/schema/*`, `src/lib/display/labels.ts`, `RENCANA-UI.md`.

---

## 1. Entitas Inti

| Istilah | Tabel | Arti |
|---------|-------|------|
| **Soal** (question) | `questions` | Unit soal tunggal (atau stimulus induk). Punya tipe, kesulitan, topik, jawaban. |
| **Stimulus** | `questions` (`question_type=stimulus`) | Soal induk berisi bacaan/gambar bersama untuk anak-anak soal. Maks 1 level. |
| **Anak soal** | `questions.parent_id` | Soal yang bergantung pada stimulus induk. |
| **Opsi** (option) | `questions.data_payload.options[]` | Pilihan jawaban (A–E) untuk tipe pilihan ganda. Sejak MAT-146 berupa JSONB di dalam `questions` — tabel `question_options` sudah dihapus. |
| **Kunci jawaban** | `questions.answer_key` | Jawaban benar. **Opsional** saat bikin soal; wajib untuk `ready`. |
| **Pembahasan** (solution) | `solutions` | Penjelasan jawaban (langkah penyelesaian). |
| **Sumber** (source) | `sources` | Asal soal: buku, sekolah, platform, dsb. |
| **Provenance butir** | `question_sources` | Sumber-sumber sebuah butir (**many-to-many**): judul artikel, URL, waktu akses. Satu soal boleh >1 sumber. *(ADR-0012)* |
| **Hash konten** | `questions.content_hash` | Hash stem+opsi (tanpa sumber) — dasar **dedup exact** lintas-sumber. |
| **Institusi** | `institutions` | Anak dari `sources` (mis. nama sekolah). |
| **Buku** (book) | `books` | Referensi buku (bagian dari `sources`). |
| **Event** | `events` | Ujian nyata: UTBK / OSN / SBMPTN. *(dulu `exam_events`)* |
| **Paket / Bundle** | `bundles` + `bundle_items` | Kumpulan soal = naskah ujian. `bundle_items` = isi paket. |
| **Aset media** | `media_assets` | Gambar/media; relasi ke soal via `question_media`. |

---

## 2. Taksonomi

| Istilah | Tabel | Arti |
|---------|-------|------|
| **Topik** | `topics` | Kategori materi (bertingkat, maks 3 level). *(dulu `categories`)* |
| **Jenjang** (grade) | `grades` | Tingkat kelas/jenjang (mis. `g12`, SD/SMP/SMA). 19 baris ter-seed. |
| **Kesulitan** (difficulty) | `difficulty_levels` | 1–5 (CHECK DB). 5 baris ter-seed. |
| **Level kognitif** | `cognitive_levels` | Taksonomi Bloom: remember→create. 6 baris ter-seed. |
| **Label / Tag** | `tags` | Penanda bebas (lintas topik). |

**Relasi M:N:** `question_topics`, `question_tags` (pola WordPress — tabel pivot).

> **Catatan rename (QBank→MathBank):** `categories`→`topics`, `schools`→`institutions`, `exam_events`→`events`.

---

## 3. Istilah Proses & Status

| Istilah | Arti |
|---------|------|
| **Soal siap** ("Siap") | Soal berstatus `ready` — siap dipakai. Butuh `answer_key`. Warna UI = **biru brand**. |
| **Status soal** | `draft` → `review` → `ready` → `archived` (FSM). |
| **Telaah** (telaah) | Proses review soal (menu di UI). **Bukan** "Antrean Review". |
| **Perlu perhatian** (flagged) | Penanda soal bermasalah; tab di **Telaah**. Emas = perlu perhatian. |
| **Tipe soal** | 11 tipe: stimulus, single_choice, assertion_reason, combination_1234, quantitative_pq, data_sufficiency, multiple_choice_checkbox, matrix_grid, matching, short_answer, essay. |
| **Ingest** | Impor soal dari PDF/dokumen (M9). |
| **Enrichment** | Pengayaan AI: embedding, penandaan otomatis, dedup (M10). |
| **TikZ / LaTeX** | Bahasa gambar/rumus matematika. Konten baru pakai `\(...\)`. |
| **Ekspor Moodle** | Ekspor soal ke format Moodle (M12). Butuh jawaban. |

---

## 4. Peran (Roles)

| Peran | Arti |
|-------|------|
| **admin** | Akses penuh. |
| **teacher** (guru) | Buat/edit soal sendiri; tak bisa set `ready`. |
| **reviewer** | Bisa set `ready`, tandai kualitas. |
| **agent** (agen) | Buat soal/aset, cari, enrichment; **tak** bisa bundle/hapus/status. |
| **machine** (mesin) | Khusus ingest (endpoint khusus). |

> Multi-role: satu pengguna bisa punya beberapa peran (tabel `user_roles`). Izin = **union** (yang terkuat menang).

---

## 5. Lapisan & Tema (jargon internal)

| Istilah | Arti |
|---------|------|
| **L1–L9** | 9 lapisan arsitektur (`DESAIN-PER-LAPISAN-MATHBANK.md`). |
| **M0–M17** | Milestone pembangunan (`MILESTONE.md`). MVP = M1–M8; fase lanjut M9–M12; operasional/hardening M13–M17. |
| **FSM** | Finite State Machine — aturan transisi status soal. |
| **Guard** | Penjaga aturan (izin/kesiapan) di service/API. |
| **Token `--mb-*`** | Variabel warna tema (OKLCH) hasil mesin tema. |
| **`own`** | Tingkat izin: hanya untuk sumber daya milik sendiri. |
| **Zero Silent Assumptions** | Aturan: jangan ubah arsitektur tanpa persetujuan (`AGENTS.md §2`). |

---

## 6. Rujukan

- Skema lengkap: `SKEMA-DB-DETAIL.md`
- Arsitektur: `DESAIN-PER-LAPISAN-MATHBANK.md`
- Milestone: `MILESTONE.md`
