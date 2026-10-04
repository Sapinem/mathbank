/**
 * audit-pedagogy.ts — Inspeksi read-only cakupan distractor rationale & rubrik.
 * Domain boundaries MAT-33: read-only, tidak memodifikasi DB/skema.
 * Output: JSON agregat ke stdout (dipakai oleh docs/pedagogy/AUDIT-DISTRACTOR-RATIONALE.md).
 */
import { config } from "dotenv";
config({ path: ".env" });

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL tidak diset");
  process.exit(1);
}

const sql = postgres(url, { max: 2 });

type Row = Record<string, unknown>;

async function q(label: string, query: string): Promise<Row[]> {
  const rows = (await sql.unsafe(query)) as Row[];
  return rows;
}

async function main() {
  const out: Record<string, unknown> = {};

  out.totals = await q(
    "totals",
    `SELECT
       (SELECT count(*)::int FROM questions WHERE deleted_at IS NULL) AS questions_alive,
       (SELECT count(*)::int FROM questions) AS questions_all,
       (SELECT count(*)::int FROM question_options) AS options_all`,
  );

  // Hanya soal PG (pilihan ganda) — soal dengan >=2 opsi dan punya kunci.
  out.mc_questions = await q(
    "mc",
    `SELECT count(*)::int AS mc_questions
       FROM questions q
      WHERE q.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM question_options o WHERE o.question_id = q.id)`,
  );

  // Cakupan rationale per soal PG: berapa opsi punya rationale.
  out.rationale_by_question = await q(
    "rat",
    `WITH mc AS (
        SELECT q.id
          FROM questions q
         WHERE q.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM question_options o WHERE o.question_id = q.id)
      ),
      agg AS (
        SELECT m.id,
               count(o.id)::int AS n_opts,
               count(o.distractor_rationale)::int AS n_rat,
               count(o.id) FILTER (WHERE o.distractor_rationale IS NOT NULL
                                     AND btrim(o.distractor_rationale) <> '')::int AS n_rat_nonempty
          FROM mc m
          JOIN question_options o ON o.question_id = m.id
         GROUP BY m.id
      )
      SELECT
        count(*)::int AS mc_total,
        count(*) FILTER (WHERE n_rat_nonempty = 0)::int AS zero_rationale,
        count(*) FILTER (WHERE n_rat_nonempty > 0 AND n_rat_nonempty < n_opts)::int AS partial_rationale,
        count(*) FILTER (WHERE n_rat_nonempty = n_opts)::int AS full_rationale,
        round(100.0 * count(*) FILTER (WHERE n_rat_nonempty = n_opts) / NULLIF(count(*),0), 2) AS pct_full,
        round(100.0 * count(*) FILTER (WHERE n_rat_nonempty > 0) / NULLIF(count(*),0), 2) AS pct_any
        FROM agg`,
  );

  // Kualitas: rationale hanya untuk opsi salah, atau juga opsi benar?
  out.rationale_correct_option = await q(
    "correct",
    `SELECT
        count(*) FILTER (WHERE o.is_correct AND o.distractor_rationale IS NOT NULL AND btrim(o.distractor_rationale)<>'')::int AS correct_with_rationale,
        count(*) FILTER (WHERE o.is_correct)::int AS correct_total,
        count(*) FILTER (WHERE NOT o.is_correct AND (o.distractor_rationale IS NULL OR btrim(o.distractor_rationale)=''))::int AS distractor_missing,
        count(*) FILTER (WHERE NOT o.is_correct)::int AS distractor_total
       FROM question_options o JOIN questions q ON q.id=o.question_id WHERE q.deleted_at IS NULL`,
  );

  // Panjang rationale — deteksi placeholder generik (pendek).
  out.rationale_length = await q(
    "len",
    `SELECT
        count(*) FILTER (WHERE distractor_rationale IS NOT NULL AND btrim(distractor_rationale)<>'' AND length(btrim(distractor_rationale)) < 40)::int AS too_short_lt40,
        count(*) FILTER (WHERE distractor_rationale IS NOT NULL AND btrim(distractor_rationale)<>'' AND length(btrim(distractor_rationale)) BETWEEN 40 AND 119)::int AS medium_40_119,
        count(*) FILTER (WHERE distractor_rationale IS NOT NULL AND length(btrim(distractor_rationale)) >= 120)::int AS long_ge120,
        round(avg(length(btrim(distractor_rationale))) FILTER (WHERE distractor_rationale IS NOT NULL AND btrim(distractor_rationale)<>''),1) AS avg_len
       FROM question_options`,
  );

  // Placeholder generik — deteksi frasa umum.
  out.placeholders = await q(
    "ph",
    `SELECT count(*)::int AS n
       FROM question_options
      WHERE distractor_rationale IS NOT NULL
        AND ( lower(distractor_rationale) LIKE '%salah karena%'
           OR lower(distractor_rationale) LIKE '%jawaban salah%'
           OR lower(distractor_rationale) LIKE '%tidak tepat%'
           OR lower(distractor_rationale) ~ '^(salah|keliru|opsi salah|distractor)$'
           OR lower(distractor_rationale) LIKE '%kesalahan perhitungan%' )`,
  );

  // Distribusi kunci jawaban (Haladyna: seimbang A-E).
  out.answer_key_dist = await q(
    "key",
    `SELECT o.label, count(*)::int AS n
       FROM question_options o JOIN questions q ON q.id=o.question_id
      WHERE q.deleted_at IS NULL AND o.is_correct
      GROUP BY o.label ORDER BY o.label`,
  );

  // Jumlah opsi per soal (homogenitas struktur A-E).
  out.options_per_question = await q(
    "optn",
    `WITH mc AS (
        SELECT q.id FROM questions q
         WHERE q.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM question_options o WHERE o.question_id=q.id))
      SELECT n_opts, count(*)::int AS n_questions FROM (
        SELECT m.id, count(o.id)::int AS n_opts FROM mc m
          JOIN question_options o ON o.question_id=m.id GROUP BY m.id) t
      GROUP BY n_opts ORDER BY n_opts`,
  );

  // Kunci ganda / tak ada kunci (invarian).
  out.key_invariants = await q(
    "inv",
    `WITH mc AS (
        SELECT q.id FROM questions q
         WHERE q.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM question_options o WHERE o.question_id=q.id))
      SELECT
        count(*) FILTER (WHERE n_correct = 0)::int AS no_key,
        count(*) FILTER (WHERE n_correct > 1)::int AS multi_key,
        count(*) FILTER (WHERE n_correct = 1)::int AS exactly_one_key
      FROM (SELECT m.id, count(*) FILTER (WHERE o.is_correct)::int AS n_correct
              FROM mc m JOIN question_options o ON o.question_id=m.id GROUP BY m.id) t`,
  );

  // Per grade.
  out.by_grade = await q(
    "grade",
    `WITH mc AS (
        SELECT q.id, q.grade FROM questions q
         WHERE q.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM question_options o WHERE o.question_id=q.id))
      SELECT coalesce(m.grade,'(null)') AS grade,
             count(*)::int AS mc_total,
             count(*) FILTER (WHERE agg.n_rat_nonempty = agg.n_opts)::int AS full_rationale,
             round(100.0 * count(*) FILTER (WHERE agg.n_rat_nonempty = agg.n_opts) / NULLIF(count(*),0),2) AS pct_full
        FROM mc m JOIN (
          SELECT o.question_id, count(o.id)::int AS n_opts,
                 count(*) FILTER (WHERE o.distractor_rationale IS NOT NULL AND btrim(o.distractor_rationale)<>'')::int AS n_rat_nonempty
            FROM question_options o GROUP BY o.question_id) agg ON agg.question_id=m.id
       GROUP BY m.grade ORDER BY mc_total DESC`,
  );

  // Pemetaan topik (junction) — laporan per-topik hanya mungkin bila terisi.
  out.topic_mapping = await q(
    "tm",
    `SELECT
        (SELECT count(*)::int FROM topics) AS topics_total,
        (SELECT count(*)::int FROM question_topics) AS question_topics_rows`,
  );

  // Per bundle (pengganti dimensi topik bila junction kosong).
  out.by_bundle = await q(
    "bb",
    `WITH mc AS (
        SELECT q.id, bi.bundle_id
          FROM questions q
          JOIN bundle_items bi ON bi.question_id = q.id
         WHERE q.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM question_options o WHERE o.question_id = q.id))
      SELECT b.title AS bundle, count(DISTINCT mc.id)::int AS mc_total
        FROM mc JOIN bundles b ON b.id = mc.bundle_id
       GROUP BY b.title ORDER BY mc_total DESC`,
  );

  // Penjelasan kunci (answer_key.explanation) — solusi, bukan rationale pengecoh.
  out.explanation_coverage = await q(
    "expl",
    `SELECT
        count(*)::int AS total_alive,
        count(*) FILTER (WHERE answer_key->>'explanation' IS NOT NULL
                           AND btrim(answer_key->>'explanation') <> '')::int AS with_explanation,
        round(100.0 * count(*) FILTER (WHERE answer_key->>'explanation' IS NOT NULL
                           AND btrim(answer_key->>'explanation') <> '') / NULLIF(count(*),0),2) AS pct
       FROM questions WHERE deleted_at IS NULL`,
  );

  // Rubrik penilaian eksplisit (kata kunci) — esai & uraian.
  out.rubric_keyword = await q(
    "rub",
    `SELECT count(*)::int AS n_mentioning_rubric
       FROM questions
      WHERE deleted_at IS NULL
        AND (content_markdown ILIKE '%rubrik%' OR answer_key::text ILIKE '%rubrik%'
             OR answer_key::text ILIKE '%skor%' OR answer_key::text ILIKE '%poin%')`,
  );

  // Metadata taksonomi — cek variasi (placeholder = satu nilai).
  out.taxonomy_metadata = await q(
    "tax",
    `SELECT
        count(DISTINCT cognitive_level)::int AS distinct_cognitive,
        count(DISTINCT difficulty)::int AS distinct_difficulty,
        count(DISTINCT grade)::int AS distinct_grade,
        count(DISTINCT question_type)::int AS distinct_qtype,
        count(DISTINCT status)::int AS distinct_status
       FROM questions WHERE deleted_at IS NULL`,
  );

  // Haladyna: opsi terlarang ("semua benar"/"tidak ada jawaban benar").
  out.banned_options = await q(
    "ban",
    `SELECT count(*)::int AS n_banned
       FROM question_options
      WHERE lower(content_markdown) ~ 'semua (jawaban )?benar|tidak ada (jawaban )?yang benar|semua salah|none of the above'`,
  );

  // Haladyna: frasa negatif pada stem.
  out.negative_stem = await q(
    "neg",
    `SELECT count(*)::int AS n_negative
       FROM questions
      WHERE deleted_at IS NULL
        AND (content_markdown ILIKE '%BUKAN%' OR content_markdown ILIKE '%kecuali%')`,
  );

  // Haladyna: homogenitas panjang opsi (proxy — rasio stdev/mean).
  out.option_homogeneity = await q(
    "hom",
    `WITH t AS (
        SELECT question_id, stddev(length(content_markdown)) sd,
               avg(length(content_markdown)) av
          FROM question_options GROUP BY question_id)
      SELECT count(*) FILTER (WHERE av > 0 AND sd/av > 0.6)::int AS high_variance,
             count(*)::int AS total
        FROM t`,
  );

  // Esai: apakah rambu penilaian (answer_key.text) terisi?
  out.essay_key = await q(
    "essay",
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE answer_key->>'text' IS NOT NULL
                               AND btrim(answer_key->>'text') <> '')::int AS has_text
       FROM questions WHERE question_type = 'essay' AND deleted_at IS NULL`,
  );

  // Explanation yang sudah memuat analisis per-opsi ("Cek opsi A...").
  out.explanation_per_option = await q(
    "epo",
    `SELECT
        count(*) FILTER (WHERE answer_key->>'explanation' ILIKE '%cek opsi%')::int AS cek_opsi,
        count(*) FILTER (WHERE answer_key->>'explanation' ILIKE '%cek opsi a%'
                           AND answer_key->>'explanation' ILIKE '%cek opsi b%')::int AS multi_cek
       FROM questions WHERE deleted_at IS NULL AND question_type = 'single_choice'`,
  );

  console.log(JSON.stringify(out, null, 2));
  await sql.end();
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await sql.end().catch(() => {});
  process.exit(1);
});
