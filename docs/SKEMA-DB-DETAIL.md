# SKEMA DB — DETAIL (MathBank)

> **Dokumen ini menjawab:** *Bentuk final setiap tabel MathBank — kolom, tipe, relasi, enum, invarian.*
> **Jembatan** dari desain (L7) ke kode Drizzle.
> **Status:** 📝 Draft v1 — menunggu ratifikasi.
> **Basis:** `ARSITEKTUR-DATA-FINAL.md` (v2) + `L7-TINJAUAN-KRITIS-DATA.md` (17 temuan) + skema QBank nyata.

---

## Konvensi Global

| Aspek | Aturan |
|-------|--------|
| **PK** | `id uuid PRIMARY KEY DEFAULT uuidv7()` (PG 18) |
| **Nama** | `snake_case` (Drizzle `casing: 'snake_case'`) |
| **Waktu** | `created_at`, `updated_at` (timestamptz) — **semua** tabel |
| **Soft-delete** | `deleted_at timestamptz NULL` (yang perlu) |
| **FK hapus** | `RESTRICT` (data terpakai) · `SET NULL` (opsional) · `CASCADE` (**hindari** kecuali anak murni) |
| **Enum** | `pgEnum` untuk semua nilai tertutup (bukan varchar panjang) |
| **Uang/token** | tak ada di domain ini |

> ⚠️ **Perubahan dari QBank:** QBank pakai `defaultRandom()` (UUIDv4). MathBank pakai **`uuidv7()`** (berurutan waktu → index B-tree lebih rapi).

---

## Daftar Tabel (18)

### A. Soal & Asal
1. `questions` — soal (termasuk stimulus via `parent_id`)
2. `question_options` — opsi jawaban
3. `solutions` — pembahasan
4. `sources` — induk sumber (buku/web/sekolah)
5. `books` — atribut buku (anak `sources`)
6. `institutions` — atribut sekolah (anak `sources`)
7. `events` — peristiwa ujian (UTBK/OSN/SBMPTN)

### B. Taksonomi & Relasi
8. `topics` — topik 3-level (dulu `categories`)
9. `grades` — jenjang/kelas
10. `difficulty_levels` — tingkat kesulitan
11. `cognitive_levels` — taksonomi Bloom
12. `tags` — label sekunder
13. `question_topics` — M:N soal↔topik (1 primary)
14. `question_tags` — M:N soal↔tag

### C. Paket, Media, Sistem, Audit
15. `bundles` — paket/naskah soal
16. `bundle_items` — isi paket
17. `media_assets` + `question_media` — aset & jembatan
18. `app_settings` · `audit_logs`
+ `users` + `user_roles` (auth) · `ingest_queue` (fase M9)

---

## ENUM (semua nilai tertutup)

```ts
question_type:  'stimulus' | 'single_choice' | 'assertion_reason' | 'combination_1234'
              | 'quantitative_pq' | 'data_sufficiency' | 'multiple_choice_checkbox'
              | 'matrix_grid' | 'matching' | 'short_answer' | 'essay'

question_status: 'draft' | 'review' | 'ready' | 'archived'

cognitive_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'

solution_type:   'conceptual' | 'quick_tip' | 'video' | 'alternative'

role:            'admin' | 'teacher' | 'reviewer' | 'agent' | 'machine'   // ← L1 (5 peran)

author_type:     'teacher' | 'agent' | 'machine' | 'system'               // ← sinkron L1

source_kind:     'book' | 'website' | 'school' | 'competition'            // ← sumber ()
bundle_type:     'source' | 'exam' | 'exercise'                            // paket
bundle_item_role:'question' | 'stimulus'                                   // ← konsisten enum (T3)
media_role:      'content' | 'option' | 'solution' | 'thumbnail'           // ← konsisten enum (T3)
media_origin:    'manual_upload' | 'pdf_crop' | 'ai_generated_tikz'
               | 'ai_generated_svg' | 'web_scrape' | 'web_ingest' | 'tex_import'
audit_action:    'create' | 'update' | 'delete' | 'status_change' | 'restore'
audit_entity:    'question' | 'bundle' | 'topic' | 'source' | 'event' | 'user'
               | 'setting' | 'media' | 'tag'
ingest_status:   'pending' | 'processing' | 'completed' | 'failed'
```

---

## A. SOAL & ASAL

### 1. `questions`

Inti sistem. Stimulus = soal biasa dengan `parent_id` NULL; anak menunjuk ke stimulus.

| Kolom | Tipe | Null | Catatan |
|-------|------|------|---------|
| `id` | uuid | PK | `uuidv7()` |
| `parent_id` | uuid | ✅ | → `questions.id` **RESTRICT**; **stimulus depth max 1** (T3/invarian) |
| `child_order` | smallint | ✗ | default 0; urutan dalam stimulus |
| `question_type` | enum | ✗ | lihat ENUM |
| `difficulty` | smallint | ✗ | 1–5 (validasi vs `difficulty_levels`) |
| `cognitive_level` | enum | ✗ | Bloom |
| `grade` | varchar(20) | ✗ | validasi vs `grades` |
| `content_markdown` | text | ✗ | isi soal (KaTeX `\(...\)`) |
| `data_payload` | jsonb | ✗ | default `{}` — **skema per-tipe** (§Data Payload) |
| `answer_key` | jsonb | ✗ | default `{}` — **skema per-tipe** (§Answer Key) |
| `status` | enum | ✗ | default `'draft'` |
| `is_flagged` | boolean | ✗ | default false |
| `flag_notes` | text | ✅ | catatan flag |
| **Asal (provenance)** | | | |
| `source_id` | uuid | ✅ | → `sources.id` SET NULL — **wadah fisik** |
| `event_id` | uuid | ✅ | → `events.id` SET NULL — **peristiwa nyata** |
| `event_year` | smallint | ✅ | mis. 2025 |
| `event_subtest` | varchar(100) | ✅ | mis. "Penalaran Matematika" |
| `event_item_number` | varchar(50) | ✅ | nomor di event asli |
| `event_notes` | text | ✅ | |
| **AI / embedding** | | | |
| `embedding` | vector(1024) | ✅ | **inline** (buang tabel terpisah) |
| `embedding_content_hash` | varchar(64) | ✅ | hash dokumen sumber |
| `embedding_model_name` | varchar(100) | ✅ | mis. 'bge-m3' |
| `ai_tagged` | boolean | ✗ | default false |
| `ai_tagged_at` | timestamptz | ✅ | |
| **Kurasi & audit** | | | |
| `author_id` | text | ✅ | → `user.id` SET NULL |
| `last_reviewed_at` | timestamptz | ✅ | nice-to-have (re-audit) |
| `deleted_at` | timestamptz | ✅ | soft-delete |
| `created_at` / `updated_at` | timestamptz | ✗ | |

**Index:** PK; `parent_id`; `status`; `grade`; `difficulty`; `source_id`; `event_id`; `author_id`; `deleted_at`; composite `(grade,difficulty,status)`; GIN trigram `content_markdown`; HNSW `embedding`.

**Invarian (CHECK):**
- **Stimulus:** soal `question_type='stimulus'` **wajib** `parent_id IS NULL`. Soal anak **wajib** `question_type != 'stimulus'`.
- **Depth ≤1:** stimulus tak boleh menunjuk stimulus (dijaga trigger).
- **`ready` wajib `answer_key`** non-kosong (kecuali tipe yang memang tanpa kunci).
- `event_year` diisi bila `event_id` diisi.

> ⚠️ **T1 (perbaikan):** QBank pakai `parent_id ON DELETE CASCADE` → hapus stimulus **menghapus anak!** MathBank: **RESTRICT** (cegah, bukan cascade).

### 2. `question_options`

| Kolom | Tipe | Null | Catatan |
|-------|------|------|---------|
| `id` | uuid | PK | |
| `question_id` | uuid | ✗ | → `questions.id` **CASCADE** (anak murni) |
| `label` | varchar(10) | ✗ | 'A'–'E' |
| `content_markdown` | text | ✗ | isi opsi |
| `is_correct` | boolean | ✗ | default false |
| `distractor_rationale` | text | ✅ | **wajib untuk PG** (standar pedagogis) |
| `order_index` | smallint | ✗ | default 0 |
| `created_at`/`updated_at` | timestamptz | ✗ | |

### 3. `solutions` (dulu `question_solutions`)

| Kolom | Tipe | Null | Catatan |
|-------|------|------|---------|
| `id` | uuid | PK | |
| `question_id` | uuid | ✗ | → `questions.id` CASCADE |
| `solution_type` | enum | ✗ | default 'conceptual' |
| `title` | varchar(150) | ✗ | default 'Pembahasan Utuh' |
| `content_markdown` | text | ✗ | |
| `author_type` | enum | ✗ | **sinkron L1** (`teacher`/`agent`/`machine`/`system`) |
| `author_id` | text | ✅ | → user SET NULL |
| `ai_model_name` | varchar(100) | ✅ | |
| `verified_by_id` | text | ✅ | → user SET NULL |
| `is_primary` | boolean | ✗ | default false |
| `created_at`/`updated_at` | timestamptz | ✗ | |

> **T4:** QBank `author_type` = `teacher|ai_agent|system` → MathBank sinkron L1: **`agent`** (bukan `ai_agent`), + `machine`.

### 4. `sources` (induk — Pola B)

| Kolom | Tipe | Null | Catatan |
|-------|------|------|---------|
| `id` | uuid | PK | |
| `kind` | enum | ✗ | `source_kind` |
| `label` | varchar(255) | ✗ | nama tampil |
| `slug` | varchar(255) | ✗ | unique |
| `url` | text | ✅ | khusus web |
| `is_active` | boolean | ✗ | default true |
| `created_at`/`updated_at` | timestamptz | ✗ | |

> **T?:** QBank `sources` punya `school_id`/`event_id` sparse — **dibuang**; sekolah via anak `institutions`, event **terpisah** dari sumber.

### 5. `books` (anak `sources`, kind=book)

`id` · `source_id` (→sources CASCADE) · `isbn` · `publisher` · `author` · `year` · `created_at/updated_at`

### 6. `institutions` (anak `sources`, kind=school) — dulu `schools`

`id` · `source_id` · `npsn` · `level` · `city` · `province` · `address` · `aliases jsonb` · `created_at/updated_at`

> **T2 (perbaikan):** QBank `schools` = entitas terpisah + `sources.school_id`. MathBank: `institutions` = **anak `sources`** (satu arah jelas).

### 7. `events` (dulu `exam_events`)

| Kolom | Tipe | Null | Catatan |
|-------|------|------|---------|
| `id` | uuid | PK | |
| `name` | varchar(150) | ✗ | mis. "UTBK" |
| `shortname` | varchar(50) | ✗ | "UTBK" |
| `fullname` | varchar(255) | ✗ | |
| `code` | varchar(50) | ✗ | unique |
| `category` | varchar(50) | ✗ | 'utbk'/'osn'/'sbmptn' |
| `subtests` | jsonb | ✗ | default `[]` (dulu `default_subtests`) |
| `aliases` | jsonb | ✗ | default `[]` |
| `color_token` | varchar(50) | ✗ | |
| `description` | text | ✅ | |
| `is_active` | boolean | ✗ | default true |
| `created_at`/`updated_at` | timestamptz | ✗ | |

> Hanya UTBK/OSN/SBMPTN. **UTS/PAS = Bundle**, bukan event.

---

## B. TAKSONOMI & RELASI

### 8. `topics` (dulu `categories`) — 3-level

| Kolom | Tipe | Null | Catatan |
|-------|------|------|---------|
| `id` | uuid | PK | |
| `name` | varchar(255) | ✗ | |
| `slug` | varchar(255) | ✗ | unique |
| `parent_id` | uuid | ✅ | → `topics.id` **RESTRICT** (cegah hapus kalau ada anak) |
| `level` | smallint | ✗ | 1=Kategori, 2=Topik, 3=SubTopik |
| `description` | text | ✅ | |
| `sort_order` | integer | ✗ | default 0 |
| `usage_count` | integer | ✗ | default 0 (cache; trigger) |
| `is_active` | boolean | ✗ | default true |
| `created_at`/`updated_at` | timestamptz | ✗ | |

> **T?:** `parent_id` QBank CASCADE → MathBank **RESTRICT** + cegah siklus (trigger). Pindah induk **dicatat** (audit).

### 9. `grades`

`id varchar(20)` PK · `label` · `level_group` · `order_index` · `is_active` · `created_at/updated_at`
*(dari `curriculum.yaml` — seeder)*

### 10. `difficulty_levels`

`value smallint` PK · `label` · `color_token` · `time_guideline` · `target_success_rate` · `description` · `order_index` · `is_active`

### 11. `cognitive_levels`

`id varchar(20)` PK · `code` (C1–C6) · `label` · `short_label` · `bloom_equivalent` · `color_token` · `order_index`

> Taksonomi **di DB** (dulu yml) — dikelola user; yml jadi sumber seed.

### 12. `tags`

| Kolom | Tipe | Null | Catatan |
|-------|------|------|---------|
| `id` | uuid | PK | |
| `name` | varchar(100) | ✗ | unique |
| `slug` | varchar(100) | ✗ | unique |
| `description` | text | ✅ | |
| `usage_count` | integer | ✗ | default 0 (trigger) |
| `created_at`/`updated_at` | timestamptz | ✗ | |

> **T5:** QBank `tags` tak punya `updated_at` → MathBank **seragamkan** (semua tabel ber-`updated_at`).

### 13. `question_topics` (M:N)

`question_id` (CASCADE) · `topic_id` (RESTRICT) · `is_primary` boolean (default false) · `created_at`
**PK** `(question_id, topic_id)`.

> **T6:** tak ada di QBank (hanya `category_id` tunggal). MathBank: M:N dengan **1 primary** (pola WordPress).

### 14. `question_tags` (M:N)

`question_id` (CASCADE) · `tag_id` (RESTRICT) · `created_at`
**PK** `(question_id, tag_id)`.

---

## C. PAKET, MEDIA, SISTEM, AUDIT

### 15. `bundles` (dulu `question_bundles`)

| Kolom | Tipe | Null | Catatan |
|-------|------|------|---------|
| `id` | uuid | PK | |
| `title` | varchar(255) | ✗ | |
| `slug` | varchar(255) | ✗ | unique **partial** (bila `deleted_at IS NULL` — T9) |
| `bundle_type` | enum | ✗ | `source`/`exam`/`exercise` |
| `source_id` | uuid | ✅ | → `sources.id` SET NULL (milik **bundles**) |
| `event_id` | uuid | ✅ | → `events.id` SET NULL |
| `year` | smallint | ✅ | |
| `grade` | varchar(20) | ✅ | |
| `duration_minutes` | integer | ✅ | default 90 |
| `instructions` | text | ✅ | |
| `status` | enum | ✗ | default 'draft' |
| `created_by_id` | text | ✅ | → user SET NULL |
| `deleted_at` | timestamptz | ✅ | soft-delete |
| `created_at`/`updated_at` | timestamptz | ✗ | |

> **T9:** QBank `slug` UNIQUE global → bentrok saat soft-delete. MathBank: **unique partial** (`WHERE deleted_at IS NULL`).
> **T?:** QBank `school_id` di bundles → dibuang (sekolah = sumber, bukan penyelenggara).
> **UTS/PAS:** `bundle_type='exam'` tanpa `event_id`.

### 16. `bundle_items`

| Kolom | Tipe | Null | Catatan |
|-------|------|------|---------|
| `id` | uuid | PK | |
| `bundle_id` | uuid | ✗ | → `bundles.id` CASCADE |
| `question_id` | uuid | ✗ | → `questions.id` **RESTRICT** (jangan hapus kalau dipakai) |
| `role` | enum | ✗ | `bundle_item_role` (`question`/`stimulus`) — **T3: enum, bukan varchar** |
| `order_index` | integer | ✗ | default 1 |
| `section_name` | varchar(100) | ✅ | |
| `item_number` | varchar(50) | ✅ | **nullable** |
| `notes` | text | ✅ | |
| `created_at` | timestamptz | ✗ | |

**Unique** `(bundle_id, question_id)`.

### 17. `media_assets` + `question_media`

**`media_assets`:** `id` · `title` · `alt_text` · `caption` · `description` · `tags jsonb` · `original_image_path` · `svg_path` · `tikz_code` · `thumbnail_path` · `mime_type` · `file_size` · `width` · `height` · `content_hash` (unique) · `parent_asset_id` (SET NULL) · `source_origin` enum · `uploaded_by_id` (SET NULL) · `created_at/updated_at`

**`question_media`:** `id` · `question_id` (CASCADE) · `media_id` (**RESTRICT**) · `role` enum (`media_role`) · `order_index` · unique `(question_id, media_id, role, order_index)`

> **T7:** `media_id` RESTRICT — aset tak terhapus kalau masih dipakai.

### 18. `app_settings` · `audit_logs`

**`app_settings`:** `id` · `key` varchar(255) unique · `value jsonb` · `description` · `is_secret boolean` (untuk `ai.api_key`) · `updated_at`

**`audit_logs`** (SATU generik — T8, ganti `question_audit_logs` + `config_audit_logs`):

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | uuid PK | |
| `entity_type` | enum `audit_entity` | |
| `entity_id` | uuid/text | |
| `action` | enum `audit_action` | |
| `actor_type` | enum `author_type` | |
| `actor_id` | varchar(100) | |
| `change_summary` | text | |
| `diff_payload` | jsonb | |
| `created_at` | timestamptz | |

### Auth & Queue

**`user`** (Better Auth): `id text PK` · `name` · `email` unique · `email_verified` · `image` · `must_change_password` · `created_at/updated_at`
**`user_roles`**: `user_id` (CASCADE) · `role` enum `role` · PK `(user_id, role)` — **multi-role (L1)**
**`session`/`account`/`verification`/`apikey`** — sesuai Better Auth (QBank).
**`ingest_queue`** (fase M9): `id` · `title` · `slug` · `source_origin` · `source_url` · `raw_content` · `raw_format` · `media_manifest jsonb` · `target_type` (**baru**) · `target_grade` · `target_topic_id` · `status` enum · `error_message` · `processed_at` · `created_at/updated_at`

> **T10:** `audit_logs` **satu** generik (T8).
> **T11:** `institutions`/`books` anak `sources` (T2).
> **T12:** `usage_count` trigger (topics/tags).

---

## Answer Key — Skema per Tipe (T13)

```ts
// single_choice / assertion_reason / quantitative_pq / data_sufficiency
{ correct: "A" }

// multiple_choice_checkbox / combination_1234
{ correct: ["A", "C"] }

// matrix_grid
{ rows: [{ label: "1", correct: ["B"] }, ...] }

// matching
{ pairs: [{ left: "A", right: "2" }, ...] }

// short_answer
{ accepted: ["3x", "3*x", "3 x"], caseSensitive: false }

// essay
{ rubric: [{ step: "...", score: 2 }, ...] }

// stimulus — tak punya kunci
{}
```

## Data Payload — Skema per Tipe

```ts
// combination_1234: statements diekstrak dari content_markdown
{ statements: ["Pernyataan 1", "Pernyataan 2", "Pernyataan 3", "Pernyataan 4"] }

// matrix_grid
{ rows: [...], columns: ["B", "S"] }

// matching
{ left: [...], right: [...] }

// quantitative_pq
{ p: "Pernyataan P", q: "Pernyataan Q" }

// tipe lain: {}
```

---

## Invarian & Constraint (ringkas)

| # | Invarian | Cara |
|---|----------|------|
| 1 | Stimulus depth ≤ 1 | CHECK + trigger |
| 2 | Soal `ready` wajib `answer_key` | CHECK |
| 3 | `bundle_items` tak boleh duplikat soal | UNIQUE `(bundle_id, question_id)` |
| 4 | Hapus stimulus dgn anak → **ditolak** | FK RESTRICT |
| 5 | Hapus soal terpakai paket → **ditolak** | FK RESTRICT |
| 6 | Topik tak boleh siklus | trigger |
| 7 | Slug bundle unik antar yang aktif | unique partial |
| 8 | `usage_count` akurat | trigger |
| 9 | Aset terpakai tak terhapus | FK RESTRICT |

---

## Perubahan dari QBank (ringkas — 17 temuan L7)

| # | QBank | MathBank |
|---|-------|----------|
| T1 | stimulus CASCADE | **RESTRICT** |
| T2 | `schools` entitas + `sources.school_id` | `institutions` **anak sources** |
| T3 | `role` campur varchar/enum | **semua enum** |
| T4 | `author_type='ai_agent'` | **'agent'** (sinkron L1) |
| T5 | `tags` tanpa `updated_at` | **seragam** |
| T6 | `category_id` tunggal | `question_topics` **M:N** |
| T7 | media RESTRICT | dipertahankan |
| T8 | 2 tabel audit | **1 `audit_logs`** |
| T9 | `bundles.slug` unique global | **partial** (soft-delete) |
| T10 | `question_embeddings` tabel | **inline** |
| T11 | — | pembagian A/B/C |
| T12 | `usage_count` manual | **trigger** |
| T13 | `answer_key` bebas | **skema per-tipe** |
| T14 | `data_payload` bebas | **skema per-tipe** |
| T15 | `question_items` | **`questions`** |
| T16 | `question_sources` (16.913) | **dibuang** |
| T17 | UUIDv4 | **uuidv7()** |

---

## Urutan Pembuatan (M1a → M1c)

1. **M1a** — enum + `questions` + `question_options` + `solutions` + `sources`/`books`/`institutions` + `events`
2. **M1b** — `topics` + `grades`/`difficulty_levels`/`cognitive_levels` + `tags` + `question_topics`/`question_tags`
3. **M1c** — `bundles`/`bundle_items` + `media_assets`/`question_media` + `app_settings`/`audit_logs` + auth + `ingest_queue`
4. Lintas — trigger, ekstensi, index, seeder, skrip verifikasi
5. Migrasi `db:generate`

---

*Dokumen ini jembatan desain → kode. Bila kode menuntut perbedaan, koreksi di sini dulu.*
