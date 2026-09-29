# L7 — Tinjauan Kritis Skema Data v2 (Kanvas Bersih)

> **Tujuan:** Meninjau ulang `ARSITEKTUR-DATA-FINAL.md` (v2) dengan kacamata **kanvas bersih** —
> temukan ketidakkonsistenan & rapikan, tanpa terikat warisan QBank.
> **Status:** USULAN untuk ratifikasi.
> **Tanggal:** 2026-09-29.

---

## 0. Ringkasan

Skema v2 dirancang **saat masih berasumsi melanjutkan QBank**. Sekarang kanvas bersih,
sejumlah hal bisa lebih rapi. Dokumen ini: **temuan + rekomendasi + skema final**.

**Yang tetap benar (tak diubah):** pemisahan `source_id`/`event_id`, Pola B sumber,
`topics` 3-level, stimulus 1 level, M:N pola WordPress, taksonomi → DB.

**Yang diperbaiki:** 17 poin di bawah.

---

## 1. Temuan & Rekomendasi

### T1 — `role` tak konsisten (enum vs varchar) ⚠️
- `bundle_items.role` = **enum**
- `question_media.role` = **varchar(50)**

**Rekomendasi:** seragamkan. `question_media.role` → **enum** `media_role`
(`illustration` | `hint` | `context`). Semua `role` = enum.

### T2 — `tags` tak punya `updated_at`
Tabel lain punya `created_at` + `updated_at`; `tags` hanya `created_at`.

**Rekomendasi:** tambah `updated_at` (seragam).

### T3 — Tabel taksonomi tanpa timestamp
`grades`, `difficulty_levels`, `cognitive_levels` tak punya `created_at`/`updated_at`.

**Rekomendasi:** tambah (seragam) — berguna untuk audit perubahan taksonomi.

### T4 — `author_type` enum tak sinkron dengan peran (L1)
`author_type` = `teacher|ai_agent|system` — tapi peran L1 = `agent`, `machine`.

**Rekomendasi:** selaraskan nilai: `teacher | agent | machine | system`
(`ai_agent` → `agent`; tambah `machine` untuk ingest). Konsisten dengan L1.

### T5 — `answer_key` belum punya skema per-tipe 🔴
11 tipe soal → bentuk jawaban beda-beda. Tanpa skema → kolom jsonb bebas (masalah lama).

**Rekomendasi:** definisikan skema per-tipe (lihat §2). Validasi pakai Zod.

### T6 — `data_payload` belum punya skema per-tipe 🔴
Sama seperti T5 — matriks/grid/matching butuh struktur.

**Rekomendasi:** definisikan per-tipe (lihat §3).

### T7 — Aturan stimulus kurang tegas
Soal `stimulus` (bacaan) vs soal anak (`parent_id`).

**Rekomendasi — invarian eksplisit:**
- `question_type='stimulus'` → **`parent_id` WAJIB NULL** (bacan tak jadi anak)
- Soal dengan `parent_id` → **`question_type != 'stimulus'`** (anak bukan bacaan)
- Kedalaman **maksimal 1** (anak tak boleh punya anak)
- CHECK constraint untuk menegakkan (sejauh mungkin)

### T8 — `bundles.slug` UNIQUE + soft-delete → bentrok
Bundle soft-deleted tetap memakai slug → tak bisa bikin bundle baru berjudul sama.

**Rekomendasi:** unique **partial** — `UNIQUE (slug) WHERE deleted_at IS NULL`.

### T9 — Header naskah kurang lengkap
Naskah resmi butuh: tahun ajaran, mata pelajaran, penyusun, jumlah soal.

**Rekomendasi:** tambah kolom di `bundles`:
`academic_year` (mis. '2025/2026'), `subject` (default 'Matematika'), `compiled_by` (penyusun).

### T10 — `media_assets` tanpa tipe
Ada `source_origin` (dari mana), tapi tak ada **jenis** (diagram/foto/rumus).

**Rekomendasi:** tambah `asset_type` enum (`diagram | photo | formula | illustration | other`).

### T11 — Konsistensi panjang `varchar`
Campur 255/100/50.

**Rekomendasi:** panduan tetap:
- Nama/judul: `varchar(255)`
- Kode/slug: `varchar(100)`
- Label pendek/enum-teks: `varchar(50)`
- Deskripsi/teks: `text`

### T12 — `topics.usage_count` mekanisme belum jelas
**Rekomendasi:** hitung via **trigger** pada `question_topics` (insert/delete) — atau
service. Pilih **trigger** (andal, tak bisa lupa).

### T13 — `solutions` M:N? (konfirmasi)
**Rekomendasi:** tetap **1 soal → banyak pembahasan** (tak M:N). Cukup.

### T14 — `events.subtests` & `aliases` jsonb?
**Rekomendasi:** tetap **jsonb** (tabel terpisah = overkill untuk daftar kecil).

### T15 — `audit_logs` — satu generik ✅ (keputusan)
Dua tabel audit (`question_audit_logs`, `config_audit_logs`) → **satu** `audit_logs`
dengan `entity_type`.

**Rekomendasi:** satu tabel:
```sql
audit_logs (
  id, entity_type,   -- 'question'|'bundle'|'source'|'setting'|'user'|...
  entity_id, action, -- 'create'|'update'|'delete'|'status_change'|...
  actor_id, actor_type, changes jsonb, created_at
)
```

### T16 — `ingest_queue` peran perlu didefinisikan ulang
Ingest selalu hasilkan **bundle** (keputusan). Jadi queue = **antrean pemrosesan file**.

**Rekomendasi:** `ingest_queue` = antrean **file/pekerjaan** (bukan hasil), dengan
`file_hash` (idempotensi), `status`, `error`, `target_bundle_id` (hasil).

### T17 — Embedding: `dimension` dinamis?
v2 hard-code `vector(1024)`.

**Rekomendasi:** tetap **1024** (BGE-M3, keputusan L9). Tapi simpan `embedding_model`
(ada) agar jelas model mana.

---

## 2. Skema `answer_key` per-tipe (T5)

```ts
type AnswerKey =
  | { correct: 'A'|'B'|'C'|'D'|'E' }                          // single_choice
  | { correct: string[] }                                      // multiple_choice_checkbox
  | { assertion: boolean; reason: boolean }                    // assertion_reason
  | { combinations: string[] }                                 // combination_1234
  | { p: string; q: string }                                   // quantitative_pq
  | { sufficient: 'A'|'B'|'C'|'D'|'E' }                        // data_sufficiency
  | { grid: Record<string, Record<string, string>> }           // matrix_grid
  | { pairs: { left: string; right: string }[] }               // matching
  | { accepted: string[]; caseSensitive?: boolean }            // short_answer
  | { rubric: string; keywords?: string[] }                    // essay
  | null;                                                      // stimulus (tak ada jawaban)
```

**Validasi:** Zod discriminated union pada `question_type`.

## 3. Skema `data_payload` per-tipe (T6)

```ts
type DataPayload =
  | { options: { key: string; content: string }[] }            // pilihan ganda (A-E)
  | { statements: { text: string; correct: boolean }[] }       // checkbox/benar-salah
  | { rows: string[]; cols: string[]; cells?: ... }            // matrix_grid
  | { left: string[]; right: string[] }                        // matching
  | {}                                                         // tipe tanpa payload
```

---

## 4. Skema Final (ringkas — perubahan dari v2)

### Tabel & perubahan
| Tabel | Perubahan |
|-------|-----------|
| `tags` | + `updated_at` |
| `grades`/`difficulty_levels`/`cognitive_levels` | + `created_at`/`updated_at` |
| `questions` | + invarian stimulus (T7); `author_type` sinkron (T4) |
| `bundles` | + `academic_year`, `subject`, `compiled_by` (T9); slug partial-unique (T8) |
| `media_assets` | + `asset_type` (T10) |
| `question_media` | `role` → enum (T1) |
| audit | `question_audit_logs` + `config_audit_logs` → **`audit_logs`** generik (T15) |
| `ingest_queue` | peran = antrean file (T16) |

### Enum final
```sql
question_type: stimulus, single_choice, assertion_reason, combination_1234,
  quantitative_pq, data_sufficiency, multiple_choice_checkbox,
  matrix_grid, matching, short_answer, essay
question_status: draft, review, ready, archived
source_kind: book, website, school
bundle_type: source, exam
bundle_origin: ingest, manual
bundle_item_role: member, origin, forked
media_role: illustration, hint, context
asset_type: diagram, photo, formula, illustration, other
solution_type: conceptual, quick_tip, video, alternative
author_type: teacher, agent, machine, system     -- sinkron L1
actor_type: user, agent, machine, api_sync
ingest_status: pending, processing, completed, failed
```

---

## 5. Invarian & Constraint (CHECK)

```sql
-- difficulty 1..5
CHECK (difficulty BETWEEN 1 AND 5)

-- stimulus: bacaan tak boleh jadi anak; anak bukan bacaan; 1 level
CHECK (NOT (question_type = 'stimulus' AND parent_id IS NOT NULL))
CHECK (NOT (question_type <> 'stimulus' AND parent_id IS NULL AND child_order > 0))

-- flagged tak boleh ready (keputusan K24)
CHECK (NOT (is_flagged = true AND status = 'ready'))

-- slug unik hanya untuk yang belum dihapus
CREATE UNIQUE INDEX idx_bundles_slug_active ON bundles(slug) WHERE deleted_at IS NULL
CREATE UNIQUE INDEX idx_topics_slug_active  ON topics(slug)  WHERE deleted_at IS NULL
```

---

## 6. Rekomendasi Teknis L7 (6 pertanyaan)

### 6.1 File schema — **1 file per-domain** ✅
```
src/lib/db/schema/
  index.ts         — re-export semua
  enums.ts         — semua enum
  question.ts      — questions, question_topics, question_tags, question_media
  solution.ts      — solutions
  source.ts        — sources, books, institutions
  event.ts         — events
  topic.ts         — topics, tags
  taxonomy.ts      — grades, difficulty_levels, cognitive_levels
  bundle.ts        — bundles, bundle_items
  media.ts         — media_assets
  audit.ts         — audit_logs
  ingest.ts        — ingest_queue
  auth.ts          — user, session, user_roles, apikey
  settings.ts      — app_settings
```
**~14 file** (dari 23 di QBank) — lebih rapi, per-domain.

### 6.2 Koneksi DB — **pola sama** ✅
`postgres.js` pool, seperti QBank. Sudah terbukti. Tambah `DB_MAX_CONNECTIONS`.

### 6.3 Migrasi — **campuran** ✅
- **Drizzle Kit generate** untuk tabel (DDL standar)
- **SQL tulisan tangan** untuk: trigger `updated_at`, trigger `usage_count`,
  cegah siklus, constraint khusus
- **Alasan:** yang rumit/krusial tak boleh diserahkan generator

### 6.4 Verifikasi skema — **ya, skrip cek** ✅
Skrip uji: "pastikan N tabel ada, relasi benar, constraint ada". Cegah **drift**
(masalah QBank). Masuk suite tes.

### 6.5 Seed — **migrasi terpisah** ✅
Seed taksonomi (dari `curriculum.yaml`) + event awal (UTBK/OSN/SBMPTN) +
admin bootstrap. Idempoten (`ON CONFLICT DO UPDATE`).

### 6.6 `owner_id` — **di soal & bundle** ✅
`questions.owner_id` + `bundles.owner_id` (kepemilikan). Audit via `audit_logs`.

---

## 7. Yang Perlu Ratifikasi

| # | Hal | Rekomendasi |
|---|-----|-------------|
| T1 | role → enum | ✅ |
| T2-T3 | timestamp seragam | ✅ |
| T4 | author_type sinkron L1 | ✅ |
| T5-T6 | skema answer_key/data_payload | ✅ (lihat §2/§3) |
| T7 | invarian stimulus | ✅ |
| T8 | slug partial-unique | ✅ |
| T9 | header naskah | ✅ |
| T10 | tipe aset | ✅ |
| T11 | panduan varchar | ✅ |
| T12 | usage_count via trigger | ✅ |
| T15 | audit_logs generik | ✅ (keputusan) |
| T16 | ingest_queue = antrean file | ✅ |
| 6.1-6.6 | rekomendasi teknis | ✅ |

---

*Dokumen ini menuntaskan tinjauan L7. Setelah diratifikasi, skema final menjadi
acuan pembuatan skema MathBank. Melengkapi `ARSITEKTUR-DATA-FINAL.md`.*
