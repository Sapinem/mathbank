-- DBSAFETY: functions, triggers & vector index (M1 — ditulis tangan)
--
-- ⚠️ FILE INI BUKAN MIGRASI drizzle-kit. Sengaja diletakkan di `drizzle/manual/`
--    supaya `drizzle-kit migrate` TIDAK menyentuhnya (drizzle-kit mensyaratkan
--    satu `meta/<tag>_snapshot.json` per migrasi; file ini tak punya snapshot).
--    Diterapkan oleh `scripts/db-apply-safety.ts` via `pnpm db:safety`
--    (di-chain otomatis dari `pnpm db:migrate`).
--
-- Latar: audit 2026-09-29 menemukan (a) 0 CHECK constraint & 0 index HNSW di DB,
-- (b) 21 trigger `updated_at` ada di DB tetapi TIDAK ada di file migrasi mana pun,
-- sehingga `pnpm db:migrate` di DB bersih tak menghasilkan invarian.
-- Migrasi ini menutup celah itu secara IDEMPOTENT (aman dijalankan berulang).
--
-- Rujukan: SKEMA-DB-DETAIL.md §Invarian + L7-TINJAUAN-KRITIS-DATA.md §6.
-- Catatan: CHECK `chk_questions_difficulty` & `chk_topics_level` didefinisikan di
-- schema Drizzle dan di-emit migrasi drizzle-kit (`0002_naive_nightshade.sql`).

-- ============================================================================
-- 1. Fungsi trigger updated_at (dipakai 21 tabel)
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Pasang trigger updated_at ke tabel ber-updated_at (idempotent: drop dulu bila ada).
-- ADR-0015: `books` & `institutions` DIHAPUS (kolomnya digabung ke `sources`).
-- MAT-39: `collections` & `collection_items` DIHAPUS (wadah digabung ke `bundles`).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'account', 'apikey', 'app_settings', 'bundles',
    'cognitive_levels', 'difficulty_levels', 'events', 'grades',
    'ingest_queue', 'media_assets', 'question_options',
    'questions', 'session', 'solutions', 'sources', 'tags',
    'topics', 'user', 'verification'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I',
      'trg_' || t || '_updated_at', t
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      'trg_' || t || '_updated_at', t
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 2. Invarian #1 — stimulus maks 1 level (anak stimulus tak boleh punya anak)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_stimulus_depth()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_parent uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Anak stimulus (question_type='stimulus') dilarang — stimulus wajib akar.
  IF NEW.question_type = 'stimulus' THEN
    RAISE EXCEPTION 'stimulus tidak boleh memiliki parent_id (harus akar)';
  END IF;

  -- Orang tua tak boleh punya parent sendiri (maks depth 1).
  SELECT parent_id INTO parent_parent FROM questions WHERE id = NEW.parent_id;
  IF parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'kedalaman stimulus maksimal 1 level (parent sudah punya parent)';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_questions_stimulus_depth ON questions;
CREATE TRIGGER trg_questions_stimulus_depth
  BEFORE INSERT OR UPDATE OF parent_id, question_type ON questions
  FOR EACH ROW EXECUTE FUNCTION check_stimulus_depth();

-- ============================================================================
-- 3. Invarian #6 — topik tak boleh siklus (parent_id tidak menunjuk ke leluhur)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_topic_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cur uuid;
  steps int := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'topik tidak boleh menjadi induk dirinya sendiri';
  END IF;

  cur := NEW.parent_id;
  WHILE cur IS NOT NULL LOOP
    steps := steps + 1;
    IF steps > 10 THEN
      RAISE EXCEPTION 'siklus taksonomi terdeteksi (kedalaman > 10)';
    END IF;
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'siklus taksonomi: parent_id menunjuk ke leluhur sendiri';
    END IF;
    SELECT parent_id INTO cur FROM topics WHERE id = cur;
  END LOOP;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_topics_cycle ON topics;
CREATE TRIGGER trg_topics_cycle
  BEFORE INSERT OR UPDATE OF parent_id ON topics
  FOR EACH ROW EXECUTE FUNCTION check_topic_cycle();

-- ============================================================================
-- 4. Invarian #8 — usage_count akurat untuk topics & tags
-- ============================================================================
CREATE OR REPLACE FUNCTION recount_topic_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  tid uuid;
BEGIN
  tid := COALESCE(NEW.topic_id, OLD.topic_id);
  UPDATE topics
     SET usage_count = (
       SELECT count(*) FROM question_topics WHERE topic_id = tid
     )
   WHERE id = tid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_question_topics_usage ON question_topics;
CREATE TRIGGER trg_question_topics_usage
  AFTER INSERT OR DELETE ON question_topics
  FOR EACH ROW EXECUTE FUNCTION recount_topic_usage();

CREATE OR REPLACE FUNCTION recount_tag_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  xid uuid;
BEGIN
  xid := COALESCE(NEW.tag_id, OLD.tag_id);
  UPDATE tags
     SET usage_count = (
       SELECT count(*) FROM question_tags WHERE tag_id = xid
     )
   WHERE id = xid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_question_tags_usage ON question_tags;
CREATE TRIGGER trg_question_tags_usage
  AFTER INSERT OR DELETE ON question_tags
  FOR EACH ROW EXECUTE FUNCTION recount_tag_usage();

-- ============================================================================
-- 5. Index HNSW untuk pencarian vektor (embedding vector(1024), cosine)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_questions_embedding_hnsw
  ON questions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index tambahan: cari cepat soal yang sudah punya embedding.
CREATE INDEX IF NOT EXISTS idx_questions_has_embedding
  ON questions (id)
  WHERE embedding IS NOT NULL;


-- ============================================================================
-- 6. Immutability audit_logs (P3 — Enterprise Auditability, Area 3)
-- ============================================================================
-- audit_logs = append-only. Tolak UPDATE/DELETE di level DB agar jejak audit
-- tak bisa dimanipulasi — termasuk lewat DBeaver/pgAdmin, bukan hanya lewat app.
CREATE OR REPLACE FUNCTION reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs bersifat append-only: % ditolak', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
