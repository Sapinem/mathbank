# Rancangan Arsitektur Data QBank v2 — FINAL

> **Status:** FINAL — hasil interview arsitektur dengan pemilik produk (2026-09-29, 12 putaran).
> **Metode:** Desain dari nol; data lama dianggap tidak ada (kosong = migrasi belum kelar).
> **Catatan interview:** `docs/CATATAN-INTERVIEW-ARSITEKTUR.md` (jejak keputusan lengkap).

---

## 0. Ringkasan Keputusan

### 0.1 Fondasi & Asal-usul
| # | Keputusan | Catatan |
|---|-----------|---------|
| K1 | **Asal soal = 2 kolom terpisah**: `source_id` (wadah) + `event_id` (even asli) | Soal buku bisa memuat UTBK |
| K2 | **Sumber = Pola B**: induk `sources` + anak `books` & `institutions` | Web cukup kolom `url` |
| K3 | **Sekolah & buku sama-sama tabel anak** (bukan JSON) | Konsisten |
| K4 | **Event** = hanya berskala (UTBK/OSN/SBMPTN), **tanpa tahun** (tahun di soal) | UTS/PAS bukan event |
| K5 | **UTS/PAS = Bundle** (type='exam') | Naskah, bukan even asal |
| K6 | **`question_sources` dihapus** → diganti `source_id`+`event_id` | Inti pembersihan |
| K7 | **Hanya Matematika** — tak perlu `subjects` | Hanya ada satu mapel |
| K8 | **Kurikulum (Merdeka/K13)** tak perlu | Fase A–F cukup |

### 0.2 Katalog & Materi
| # | Keputusan | Catatan |
|---|-----------|---------|
| K9 | **Materi = `topics` 3-level** via `parent_id` | M:N, 1 utama; user boleh menambah |
| K10 | **Taksonomi (grade/Bloom/kesulitan) → DB** | Seed dari `curriculum.yaml`; **ada UI admin** |
| K11 | **Tag dipertahankan** sebagai label sekunder | Tak wajib |

### 0.3 Soal & Bacaan
| # | Keputusan | Catatan |
|---|-----------|---------|
| K12 | **Bacaan = stimulus** (`questions.parent_id`) — **bukan** tabel `passages` | **Hanya 1 level** (tak bersarang) |
| K13 | **Embedding 1 tempat** (inline `questions.embedding`), index **HNSW** | Hilangkan `question_embeddings` |
| K14 | **Re-embed pakai timestamp** (`embedded_at` + konten berubah) | Bukan `embedding_hash` per soal (overkill) |
| K15 | **`is_flagged` + `flag_notes` dipertahankan** | Fitur kurasi; dipakai luas |
| K16 | **Cegah siklus** `topics.parent_id` & `questions.parent_id` | Integritas |
| K17 | **Judul soal = cuplikan konten** | Tak perlu kolom `title` |
| K18 | **`payload_version`** untuk jsonb (opsional) | Versi skema payload/answer_key |

### 0.4 Naskah & Relasi
| # | Keputusan | Catatan |
|---|-----------|---------|
| K19 | **Soal ↔ Naskah = M:N** (`bundle_items` + `role`) | Pola WordPress |
| K20 | **Edit soal = live** + **peringatan** bila naskah sudah dicetak | Bukan snapshot |
| K21 | **Bundle**: `source_id` + **`origin`** (ingest/manual) | `event_id` milik soal |
| K22 | **Ingest → bundle berisi soal → langsung masuk bank soal** | Tanpa promote |
| K23 | **Fork naskah** = PENDING | Konsep belum jelas |

### 0.5 Status, Dedup, Keamanan
| # | Keputusan | Catatan |
|---|-----------|---------|
| K24 | **Status**: ingest→`draft`; **AI Enrichment** selesai→`review`; **flagged tak boleh `ready`** | — |
| K25 | **Kepemilikan: `owner_id`** saja | Tanpa multi-tenant penuh |
| K26 | **Dedup 3 tingkat** (hash dokumen → embedding → varian) + **idempotensi ingest** | Hash untuk dokumen saja |
| K27 | **Hard-delete hanya admin**; soft-delete dengan retensi | — |
| K28 | **`ready` boleh tanpa `answer_key`** (tidak diblokir) | — |
| K29 | **Search**: trigram + vector + hybrid (RRF) | **Sudah ada — pertahankan** |

---

## 1. Peta Tabel Akhir

```
┌─ KATALOG (soal itu APA) ────────────────────────────────┐
│  topics          (Kategori › Topik › SubTopik, hierarkis)│
│  tags            (label sekunder bebas)                  │
│  grades          (dari curriculum.yaml → DB)             │
│  difficulty_levels (1–5, dari yaml)                      │
│  cognitive_levels  (Bloom C1–C6, dari yaml)              │
└──────────────────────────────────────────────────────────┘

┌─ ASAL-USUL (soal dari MANA) ────────────────────────────┐
│  sources         (induk: kind = book|website|school)     │
│   ├── books         (isbn, penerbit, penulis)            │
│   └── institutions  (npsn, kota, provinsi)               │
│  events          (even berskala: UTBK, OSN, SBMPTN)      │
└──────────────────────────────────────────────────────────┘

┌─ SOAL ──────────────────────────────────────────────────┐
│  questions       (inti; bacaan via parent_id, 1 level)   │
│   ├── question_topics  (M:N soal ↔ topik, 1 utama)      │
│   └── question_tags    (M:N soal ↔ tag)                  │
│  solutions       (pembahasan)                            │
└──────────────────────────────────────────────────────────┘

┌─ NASKAH & ASET ─────────────────────────────────────────┐
│  bundles         (naskah: source|exam + origin)          │
│  bundle_items    (M:N bundle ↔ soal + role + urutan)    │
│  media_assets    (gambar/SVG/TikZ)                       │
│  question_media  (M:N soal ↔ aset)                       │
└──────────────────────────────────────────────────────────┘

┌─ PENDUKUNG ─────────────────────────────────────────────┐
│  user · session · account · verification · apikey (auth) │
│  app_settings · config_audit_logs                        │
│  question_audit_logs · ingest_queue                      │
└──────────────────────────────────────────────────────────┘
```

**Tabel inti: 18** (3 taksonomi baru). Empat relasi M:N (pola WordPress):

```
questions ──┬──< question_topics >── topics        (1 utama)
            ├──< question_tags   >── tags          (bebas)
            ├──< question_media  >── media_assets  (M:N)
            └──< bundle_items    >── bundles       (M:N + role + order)
```

---

## 2. DDL Lengkap

### 2.1 Enum

```sql
CREATE TYPE question_type AS ENUM (
  'stimulus','single_choice','assertion_reason','combination_1234',
  'quantitative_pq','data_sufficiency','multiple_choice_checkbox',
  'matrix_grid','matching','short_answer','essay'
);
CREATE TYPE question_status AS ENUM ('draft','review','ready','archived');
CREATE TYPE source_kind AS ENUM ('book','website','school');
CREATE TYPE bundle_type AS ENUM ('source','exam');
CREATE TYPE bundle_origin AS ENUM ('ingest','manual');
CREATE TYPE bundle_item_role AS ENUM ('member','origin','forked');
CREATE TYPE solution_type AS ENUM ('conceptual','quick_tip','video','alternative');
CREATE TYPE author_type AS ENUM ('teacher','ai_agent','system');
CREATE TYPE actor_type_audit AS ENUM ('user','ai_agent','api_sync');
CREATE TYPE ingest_status AS ENUM ('pending','processing','completed','failed');

-- Aktifkan ekstensi (pg_trgm, vector/ekstensi embedding)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS vector;  -- sesuai sistem embedding yang dipakai
```

> **Catatan K10:** `grade` (16 nilai), `difficulty` (1–5), `cognitive_level` (C1–C6)
> dipindah dari `curriculum.yaml` ke **tabel referensi** (bukan enum), karena
> dikelola lewat **UI admin**. Lihat §2.2.

### 2.2 Katalog & Taksonomi

```sql
-- topics: satu tabel untuk 3 level (Kategori › Topik › SubTopik)
CREATE TABLE topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(255) NOT NULL,
  slug        varchar(255) NOT NULL UNIQUE,
  parent_id   uuid REFERENCES topics(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_topics_parent ON topics(parent_id);
-- ⚠️ Cegah siklus parent_id: trigger/app-level (tak boleh A→B→A)

CREATE TABLE tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(100) NOT NULL UNIQUE,
  slug        varchar(100) NOT NULL UNIQUE,
  usage_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- grades: dari curriculum.yaml (K10). Dikelola UI admin.
CREATE TABLE grades (
  id                varchar(20) PRIMARY KEY,   -- '10','11w','utbk'
  label             varchar(100) NOT NULL,      -- 'Kelas 10 SMA'
  level_group       varchar(20)  NOT NULL,      -- 'sd'|'smp'|'sma'|'seleksi'|'lainnya'
  curriculum_phase  varchar(20),                -- 'Fase E' (nullable)
  order_index       integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true
);

-- difficulty_levels: dari curriculum.yaml
CREATE TABLE difficulty_levels (
  value               smallint PRIMARY KEY,     -- 1..5
  label               varchar(50) NOT NULL,      -- 'Sangat Mudah'
  color_token         varchar(20) NOT NULL,      -- 'diff-1'
  time_guideline      varchar(50),
  target_success_rate varchar(50),
  order_index         integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  description         text
);

-- cognitive_levels: Bloom C1–C6, dari curriculum.yaml
CREATE TABLE cognitive_levels (
  id                varchar(20) PRIMARY KEY,    -- 'remember'
  code              varchar(5)  NOT NULL,        -- 'C1'
  label             varchar(100) NOT NULL,
  short_label       varchar(20),
  bloom_equivalent  varchar(5),
  color_token       varchar(20),
  order_index       integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  description       text,
  operational_verbs jsonb NOT NULL DEFAULT '[]'
);

-- Distribusi target (dari yaml: difficulty_distribution, cognitive_distribution)
-- → simpan di app_settings, bukan tabel.
```

### 2.3 Asal-usul

```sql
CREATE TABLE sources (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       source_kind NOT NULL,
  label      varchar(255) NOT NULL,     -- 'Top Sukses UTBK 2025'
  url        text,                      -- khusus kind='website'
  notes      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sources_kind  ON sources(kind);
CREATE INDEX idx_sources_label_trgm ON sources USING gin (label gin_trgm_ops);

CREATE TABLE books (
  source_id  uuid PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  isbn       varchar(20),
  publisher  varchar(255),
  author     varchar(255),
  year       smallint,
  edition    varchar(50)
);

CREATE TABLE institutions (
  source_id uuid PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  npsn      varchar(20),
  level     varchar(20),     -- 'SD'|'SMP'|'SMA'
  city      varchar(100),
  province  varchar(100),
  address   text
);

-- events: even berskala (UTBK/OSN/SBMPTN) — TANPA tahun (tahun di soal)
CREATE TABLE events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             varchar(150) NOT NULL,
  shortname        varchar(50)  NOT NULL,        -- 'UTBK' (badge)
  code             varchar(50)  NOT NULL UNIQUE, -- 'utbk'
  category         varchar(50)  NOT NULL,        -- 'nasional'|'olimpiade'|'internasional'
  default_subtests jsonb NOT NULL DEFAULT '[]',
  aliases          jsonb NOT NULL DEFAULT '[]',
  description      text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

### 2.4 Soal (inti) — termasuk stimulus/bacaan

```sql
CREATE TABLE questions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ▸ STIMULUS (bacaan induk) — HANYA 1 LEVEL (anak tak boleh jadi induk)
  parent_id        uuid REFERENCES questions(id) ON DELETE RESTRICT,
  child_order      smallint NOT NULL DEFAULT 0,

  question_type    question_type NOT NULL,
  difficulty       smallint NOT NULL,     -- FK → difficulty_levels.value
  cognitive_level  varchar(20) NOT NULL,  -- FK → cognitive_levels.id
  grade            varchar(20) NOT NULL,  -- FK → grades.id
  content_markdown text NOT NULL,
  data_payload     jsonb NOT NULL DEFAULT '{}',
  payload_version  smallint NOT NULL DEFAULT 1,
  answer_key       jsonb NOT NULL DEFAULT '{}',
  status           question_status NOT NULL DEFAULT 'draft',

  -- ▸ KURASI KUALITAS (fitur "Perlu Revisi"; diset otomatis sistem)
  is_flagged       boolean NOT NULL DEFAULT false,
  flag_notes       text,
  -- flag_reason   flag_reason_enum  -- OPSIONAL nanti

  -- ▸ ASAL-USUL (2 kolom TERPISAH)
  source_id        uuid REFERENCES sources(id) ON DELETE SET NULL,
  event_id         uuid REFERENCES events(id)  ON DELETE SET NULL,
  event_year       smallint,
  event_subtest    varchar(100),
  item_number      varchar(50),

  -- ▸ STATISTIK PEMAKAIAN (cache dari bundle_items)
  usage_count      integer NOT NULL DEFAULT 0,
  last_used_at     timestamptz,

  -- ▸ PEMELIHARAAN
  last_reviewed_at timestamptz,   -- re-audit berkala (nice-to-have)

  -- ▸ EMBEDDING (satu tempat; re-embed via timestamp, BUKAN hash)
  embedding            vector(1024),
  embedded_at          timestamptz,     -- kapan embedding terakhir dibuat
  embedding_model      varchar(100),

  -- ▸ KEPEMILIKAN & AUDIT
  owner_id         text REFERENCES "user"(id) ON DELETE SET NULL,
  author_id        text REFERENCES "user"(id) ON DELETE SET NULL,
  modified_by_id   text REFERENCES "user"(id) ON DELETE SET NULL,
  ai_tagged        boolean NOT NULL DEFAULT false,
  ai_tagged_at     timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- ▸ INVARIAN
  CONSTRAINT chk_difficulty CHECK (difficulty BETWEEN 1 AND 5),
  CONSTRAINT chk_stimulus_not_flagged_ready
    CHECK (NOT (question_type = 'stimulus' AND status = 'ready'))
);
CREATE INDEX idx_questions_status   ON questions(status);
CREATE INDEX idx_questions_grade    ON questions(grade);
CREATE INDEX idx_questions_diff     ON questions(difficulty);
CREATE INDEX idx_questions_cog      ON questions(cognitive_level);
CREATE INDEX idx_questions_owner    ON questions(owner_id);
CREATE INDEX idx_questions_source   ON questions(source_id);
CREATE INDEX idx_questions_event    ON questions(event_id, event_year);
CREATE INDEX idx_questions_parent   ON questions(parent_id);
CREATE INDEX idx_questions_flagged  ON questions(is_flagged) WHERE is_flagged;
CREATE INDEX idx_questions_content_trgm
  ON questions USING gin (content_markdown gin_trgm_ops);
-- Index vektor HNSW (pindah dari question_embeddings)
CREATE INDEX idx_questions_embedding_hnsw
  ON questions USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- soal ↔ topik (M:N, 1 utama)
CREATE TABLE question_topics (
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  topic_id    uuid NOT NULL REFERENCES topics(id)    ON DELETE CASCADE,
  is_primary  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (question_id, topic_id)
);
CREATE UNIQUE INDEX idx_one_primary_topic
  ON question_topics(question_id) WHERE is_primary;

-- soal ↔ tag (M:N)
CREATE TABLE question_tags (
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);
```

> **Aturan stimulus (`parent_id`) — HANYA 1 LEVEL:**
> - Soal induk = `question_type='stimulus'` (bacaan/wacana).
> - Anak (`parent_id` terisi) **TIDAK BOLEH** jadi induk lagi → **cegah kedalaman/cycle** (trigger/app).
> - **Stimulus TIDAK masuk `bundle_items`** — hanya anak-anaknya (bacaan ikut otomatis saat ekspor).
> - Ekspor **paket soal**: bacaan cukup **1×**; ekspor **Moodle**: tiap item membawa bacaannya sendiri.
> - Hapus stimulus → **RESTRICT** selama masih ada anak.

> **Aturan flag × status (K24):** `is_flagged=true` **tidak boleh** berstatus `ready`
> (wajib `review` dulu). `ready` **boleh** tanpa `answer_key` (K28, tidak diblokir).

> **Aturan re-embed (K14):** `embedded_at` < `updated_at` → embedding **kedaluwarsa**,
> perlu dihitung ulang. Tak pakai `embedding_hash` per soal.

### 2.5 Pembahasan

```sql
CREATE TABLE solutions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  solution_type    solution_type NOT NULL DEFAULT 'conceptual',
  title            varchar(150) NOT NULL DEFAULT 'Pembahasan Utuh',
  content_markdown text NOT NULL,
  author_type      author_type NOT NULL DEFAULT 'teacher',
  author_id        text REFERENCES "user"(id) ON DELETE SET NULL,
  ai_model_name    varchar(100),
  verified_by_id   text REFERENCES "user"(id) ON DELETE SET NULL,
  is_primary       boolean NOT NULL DEFAULT false,
  upvotes          integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_solutions_question ON solutions(question_id);
```

### 2.6 Naskah — termasuk relasi M:N ke soal

```sql
CREATE TABLE bundles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              varchar(255) NOT NULL,
  slug               varchar(255) NOT NULL UNIQUE,
  bundle_type        bundle_type NOT NULL,     -- 'source' | 'exam' (UTS/PAS = exam)
  origin             bundle_origin NOT NULL DEFAULT 'manual', -- 'ingest'|'manual' (K21)
  description        text,
  grade              varchar(20),
  source_id          uuid REFERENCES sources(id) ON DELETE SET NULL,
  -- TIDAK ada event_id (K21) · forked_from_bundle_id → PENDING (K23)
  duration_minutes   integer,
  instructions       text,
  status             varchar(20) NOT NULL DEFAULT 'draft',
  printed_at         timestamptz,   -- kapan dicetak/diekspor PDF (K20: peringatan)
  owner_id           text REFERENCES "user"(id) ON DELETE SET NULL,
  created_by_id      text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- PIVOT soal ↔ naskah (M:N) — pola WordPress
CREATE TABLE bundle_items (
  bundle_id    uuid NOT NULL REFERENCES bundles(id)   ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  role         bundle_item_role NOT NULL DEFAULT 'member',
  order_index  integer NOT NULL DEFAULT 0,
  section_name varchar(100),
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bundle_id, question_id)
);
CREATE INDEX idx_bundle_items_q ON bundle_items(question_id);
```

> **`role`**: `member` (ditambahkan) · `origin` (soal asal naskah) · `forked` (hasil fork).
> **PK composite** = satu soal satu baris per bundle.
>
> **`ON DELETE RESTRICT` pada `question_id`** — soal yang dipakai naskah tak boleh terhapus.
>
> **`usage_count`/`last_used_at`** di `questions` = cache dari tabel ini (trigger/service).
>
> **`printed_at`** (K20): bila soal di dalam bundle berubah **setelah** `printed_at`,
> UI menampilkan **peringatan** (naskah bukan snapshot).

### 2.7 Aset

```sql
CREATE TYPE source_origin AS ENUM
  ('manual_upload','pdf_crop','ai_generated_tikz','ai_generated_svg',
   'web_scrape','web_ingest','tex_import');

CREATE TABLE media_assets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               varchar(255) NOT NULL,
  alt_text            text,
  caption             text,
  original_image_path varchar(500),
  svg_path            varchar(500),
  tikz_source         text,
  source_origin       source_origin NOT NULL,
  content_hash        varchar(64),
  uploaded_by_id      text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE question_media (
  question_id uuid NOT NULL REFERENCES questions(id)    ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  role        varchar(50) NOT NULL DEFAULT 'illustration',
  PRIMARY KEY (question_id, asset_id)
);
```

---

## 3. Aturan Bisnis Penting

| Aturan | Penjelasan |
|--------|-----------|
| **Asal soal** | `source_id` & `event_id` **independen** — isi salah satu, keduanya, atau tak sama sekali |
| **Stimulus** | Bacaan = soal `question_type='stimulus'`; **hanya 1 level**; tak masuk bundle langsung |
| **Ekspor stimulus** | Paket soal: bacaan 1× · Moodle: tiap item bawa bacaan sendiri |
| **UTS/PAS** | = `bundles.bundle_type='exam'` — **bukan** event |
| **Event sekolah** | **Tidak ada** — sekolah hanya `sources` (kind='school') |
| **Edit soal** | **Live** + **peringatan** bila naskah sudah dicetak (`printed_at`) |
| **Multi-materi** | Boleh banyak `topics`; tepat **1** `is_primary` |
| **Ingest** | Hasil = 1 bundle (origin='ingest') berisi soal → **langsung masuk bank soal** |
| **Status** | ingest→`draft` · AI Enrichment selesai→`review` · **flagged ≠ `ready`** |
| **Dedup** | Hash **dokumen** (idempotensi) → embedding similarity (0.98/0.85) → varian (nanti) |
| **Re-embed** | `embedded_at` < `updated_at` → hitung ulang embedding |
| **Kurasi** | `is_flagged` diset otomatis (opsi kurang, kunci hilang, LaTeX rusak, near-dup, AI gagal) |
| **Hapus** | Hard-delete **hanya admin**; soft-delete (`deleted_at`) dengan retensi |
| **Search** | trigram + vector + hybrid RRF (semua sudah ada) |

---

## 4. Perbandingan Lama vs. Baru

| Aspek | Lama | Baru |
|-------|------|------|
| Asal soal | `question_sources` (16.913 teks bebas) | **`source_id` + `event_id`** |
| Sumber | `sources` (7) + `question_sources` | **`sources`** + `books`/`institutions` |
| Sekolah | `schools` (kosong) | **`institutions`** |
| Even | `exam_events` (kosong) + teks | **`events`** |
| UTS/PAS | bercampur teks | **Bundle** (type='exam') |
| Materi | `categories` + `category_id` | **`topics`** 3-level + M:N |
| Taksonomi | `curriculum.yaml` (statis) | **DB** (+ UI admin) |
| Artikel | tak ada | **stimulus** (`parent_id`, 1 level) |
| Soal↔Naskah | `bundle_items` sederhana | **M:N + `role` + statistik** |
| Embedding | 2 tempat (duplikat) | **1 tempat** + HNSW |
| Pencarian | trigram + vector + RRF | **tetap** (dipertahankan) |
| Tag | ada (kosong) | **tetap** |

---

## 5. Contoh Nyata

### Soal dari buku, memuat UTBK
```
questions:
  source_id → "Top Sukses UTBK 2025" (kind=book)
  event_id  → "UTBK", event_year=2025, event_subtest='Penalaran Umum'
```

### Bacaan + 5 soal (stimulus, 1 level)
```
questions[0]: question_type='stimulus', content='Bacaan: ...'
questions[1..5]: parent_id → questions[0], child_order 1..5
children TIDAK boleh punya anak lagi (hanya 1 level).
```

### Naskah UTS (M:N)
```
bundles: type='exam', origin='manual', title='UTS Matematika SMAN 8'
bundle_items: 20 soal
  ├ soal A: role='origin'   (asli naskah ini)
  ├ soal B: role='member'   (dari UTBK 2025)
  └ soal C: role='member'   (dari buku Erlangga)
```

### Hasil ingest
```
ingest → bundles: origin='ingest', type='source', title='Naskah dari file X'
       → bundle_items: N soal (langsung masuk bank soal)
```

### Edit setelah cetak (K20)
```
bundle.printed_at = 2026-09-01
questions[x].updated_at = 2026-09-15 (diedit)
→ UI: "⚠️ Naskah ini sudah dicetak; ada soal yang berubah sejak itu."
```

---

## 6. Yang TIDAK Dibahas / PENDING

| Hal | Alasan |
|-----|--------|
| **Migrasi 16.913 data → entitas** | Dokumen terpisah (strategi otomatis/manual belum diputuskan) |
| **Fork naskah** (`forked_from_bundle_id`) | Konsep belum jelas |
| **`flag_reason` enum** | Opsional, nanti |
| **Ingest retry/stuck & parsial** | Ditunggu lebih dulu |
| **Concurrency edit** (lost update) | Nice-to-have |
| **Klose/cloze & tipe khusus** | Nice-to-have |
| **Statistik jawaban siswa** | Belum perlu |
| **Integrasi API eksternal** | Belum perlu |
| **Notifikasi/kolaborasi** | Tidak perlu |

---

*Dokumen ini hasil final interview arsitektur (12 putaran). Keputusan individual
tercatat di `docs/CATATAN-INTERVIEW-ARSITEKTUR.md`. Siap untuk desain migrasi.*
