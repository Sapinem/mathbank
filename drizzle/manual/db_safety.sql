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
    'ingest_queue', 'media_assets',
    -- MAT-146: `question_options` DIHAPUS (opsi kini JSONB di questions.data_payload).
    -- ADR-0019: `question_embeddings` ditambahkan (Pilar 1 v2.0).
    'question_embeddings', 'questions', 'session', 'solutions', 'sources', 'tags',
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
-- ADR-0019: vektor pindah ke tabel `question_embeddings` (Pilar 1 v2.0).
-- HNSW index sudah dibuat di migrasi Drizzle 0018 pada tabel baru.
-- Index lama di `questions` di-drop karena kolom sudah tidak ada.
DROP INDEX IF EXISTS idx_questions_embedding_hnsw;
DROP INDEX IF EXISTS idx_questions_has_embedding;


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

-- ============================================================================
-- 7. Invarian #9 — Denormalisasi grades soal dari bundles
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_question_grades()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_qid uuid;
  target_bid uuid;
BEGIN
  IF (TG_TABLE_NAME = 'bundle_items') THEN
    target_qid := COALESCE(NEW.question_id, OLD.question_id);
    UPDATE questions
       SET grades = COALESCE((
         SELECT ARRAY_AGG(DISTINCT b.grade ORDER BY b.grade)
         FROM bundle_items bi
         JOIN bundles b ON bi.bundle_id = b.id
         WHERE bi.question_id = target_qid
           AND b.deleted_at IS NULL
           AND b.grade IS NOT NULL
           AND b.grade <> ''
           AND b.grade <> 'umum'
       ), ARRAY[]::varchar[]),
       grade = (
         SELECT b.grade
         FROM bundle_items bi
         JOIN bundles b ON bi.bundle_id = b.id
         WHERE bi.question_id = target_qid
           AND b.deleted_at IS NULL
           AND b.grade IS NOT NULL
           AND b.grade <> ''
           AND b.grade <> 'umum'
         ORDER BY b.grade ASC
         LIMIT 1
       )
     WHERE id = target_qid;
  ELSIF (TG_TABLE_NAME = 'bundles') THEN
    target_bid := COALESCE(NEW.id, OLD.id);
    UPDATE questions q
       SET grades = COALESCE((
         SELECT ARRAY_AGG(DISTINCT b2.grade ORDER BY b2.grade)
         FROM bundle_items bi2
         JOIN bundles b2 ON bi2.bundle_id = b2.id
         WHERE bi2.question_id = q.id
           AND b2.deleted_at IS NULL
           AND b2.grade IS NOT NULL
           AND b2.grade <> ''
           AND b2.grade <> 'umum'
       ), ARRAY[]::varchar[]),
       grade = (
         SELECT b2.grade
         FROM bundle_items bi2
         JOIN bundles b2 ON bi2.bundle_id = b2.id
         WHERE bi2.question_id = q.id
           AND b2.deleted_at IS NULL
           AND b2.grade IS NOT NULL
           AND b2.grade <> ''
           AND b2.grade <> 'umum'
         ORDER BY b2.grade ASC
         LIMIT 1
       )
     WHERE q.id IN (
       SELECT question_id FROM bundle_items WHERE bundle_id = target_bid
     );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bundle_items_sync_grades ON bundle_items;
CREATE TRIGGER trg_bundle_items_sync_grades
  AFTER INSERT OR DELETE OR UPDATE OF bundle_id, question_id ON bundle_items
  FOR EACH ROW EXECUTE FUNCTION sync_question_grades();

DROP TRIGGER IF EXISTS trg_bundles_sync_grades ON bundles;
CREATE TRIGGER trg_bundles_sync_grades
  AFTER UPDATE OF grade, deleted_at ON bundles
  FOR EACH ROW EXECUTE FUNCTION sync_question_grades();

