/**
 * audit-pedagogy.ts — Inspeksi read-only cakupan distractor rationale & rubrik.
 * Domain boundaries MAT-33: read-only, tidak memodifikasi DB/skema.
 * Output: JSON agregat ke stdout (dipakai oleh docs/pedagogy/AUDIT-DISTRACTOR-RATIONALE.md).
 *
 * MAT-146 — tabel `question_options` sudah di-drop. Seluruh audit kini membaca
 * opsi dari `questions.data_payload.options` (JSONB) dan kunci benar dari
 * `questions.answer_key.correctOptionIds` (kontrak MAT-145). CTE `opt` di bawah
 * adalah satu-satunya tempat pemetaan itu didefinisikan, sehingga semua query
 * memakai bentuk kolom yang sama dengan tabel lama:
 *   question_id, grade, label, content_markdown, distractor_rationale, is_correct
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
  void label;
  const rows = (await sql.unsafe(query)) as Row[];
  return rows;
}

/**
 * CTE bersama: satu baris per opsi soal yang masih hidup.
 *
 * - `label` diambil dari `options[].id` (fallback `label`) — kontrak MAT-145.
 * - `distractor_rationale` dinormalkan: string kosong → NULL, agar hitungan
 *   "punya rationale" konsisten dengan audit sebelumnya.
 * - `is_correct` dihitung dari `answer_key.correctOptionIds` yang boleh berupa
 *   string tunggal (multiple_choice) atau array (complex_multiple_choice).
 */
const OPT_CTE = `WITH opt AS (
  SELECT
    q.id AS question_id,
    q.grade,
    COALESCE(o.value->>'id', o.value->>'label') AS label,
    o.value->>'contentMarkdown' AS content_markdown,
    NULLIF(btrim(COALESCE(o.value->>'distractorRationale', '')), '') AS distractor_rationale,
    EXISTS (
      SELECT 1
        FROM jsonb_array_elements_text(
               CASE jsonb_typeof(q.answer_key->'correctOptionIds')
                 WHEN 'array' THEN q.answer_key->'correctOptionIds'
                 ELSE jsonb_build_array(q.answer_key->'correctOptionIds')
               END
             ) AS k(label)
       WHERE upper(btrim(k.label)) = upper(btrim(COALESCE(o.value->>'id', o.value->>'label')))
    ) AS is_correct
  FROM questions q
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE jsonb_typeof(q.data_payload->'options')
      WHEN 'array' THEN q.data_payload->'options'
      ELSE '[]'::jsonb
    END
  ) AS o
  WHERE q.deleted_at IS NULL
)`;

async function main() {
  const out: Record<string, unknown> = {};

  out.totals = await q(
    "totals",
    `${OPT_CTE}
     SELECT
       (SELECT count(*)::int FROM questions WHERE deleted_at IS NULL) AS questions_alive,
       (SELECT count(*)::int FROM questions) AS questions_all,
       (SELECT count(*)::int FROM opt) AS options_all`,
  );

  // Hanya soal PG (pilihan ganda) — soal dengan >=1 opsi.
  out.mc_questions = await q(
    "mc",
    `${OPT_CTE}
     SELECT count(DISTINCT question_id)::int AS mc_questions FROM opt`,
  );

  // Cakupan rationale per soal PG: berapa opsi punya rationale.
  out.rationale_by_question = await q(
    "rat",
    `${OPT_CTE},
      agg AS (
        SELECT question_id,
               count(*)::int AS n_opts,
               count(*) FILTER (WHERE distractor_rationale IS NOT NULL)::int AS n_rat,
               count(*) FILTER (WHERE distractor_rationale IS NOT NULL)::int AS n_rat_nonempty
          FROM opt
         GROUP BY question_id
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
    `${OPT_CTE}
     SELECT
        count(*) FILTER (WHERE is_correct AND distractor_rationale IS NOT NULL)::int AS correct_with_rationale,
        count(*) FILTER (WHERE is_correct)::int AS correct_total,
        count(*) FILTER (WHERE NOT is_correct AND distractor_rationale IS NULL)::int AS distractor_missing,
        count(*) FILTER (WHERE NOT is_correct)::int AS distractor_total
       FROM opt`,
  );

  // Panjang rationale — deteksi placeholder generik (pendek).
  out.rationale_length = await q(
    "len",
    `${OPT_CTE}
     SELECT
        count(*) FILTER (WHERE distractor_rationale IS NOT NULL AND length(distractor_rationale) < 40)::int AS too_short_lt40,
        count(*) FILTER (WHERE distractor_rationale IS NOT NULL AND length(distractor_rationale) BETWEEN 40 AND 119)::int AS medium_40_119,
        count(*) FILTER (WHERE distractor_rationale IS NOT NULL AND length(distractor_rationale) >= 120)::int AS long_ge120,
        round(avg(length(distractor_rationale)) FILTER (WHERE distractor_rationale IS NOT NULL),1) AS avg_len
       FROM opt`,
  );

  // Placeholder generik — deteksi frasa umum.
  out.placeholders = await q(
    "ph",
    `${OPT_CTE}
     SELECT count(*)::int AS n
       FROM opt
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
    `${OPT_CTE}
     SELECT label, count(*)::int AS n
       FROM opt
      WHERE is_correct
      GROUP BY label ORDER BY label`,
  );

  // Jumlah opsi per soal (homogenitas struktur A-E).
  out.options_per_question = await q(
    "optn",
    `${OPT_CTE},
      t AS (SELECT question_id, count(*)::int AS n_opts FROM opt GROUP BY question_id)
     SELECT n_opts, count(*)::int AS n_questions
       FROM t GROUP BY n_opts ORDER BY n_opts`,
  );

  // Kunci ganda / tak ada kunci (invarian).
  out.key_invariants = await q(
    "inv",
    `${OPT_CTE},
      t AS (
        SELECT question_id, count(*) FILTER (WHERE is_correct)::int AS n_correct
          FROM opt GROUP BY question_id
      )
     SELECT
        count(*) FILTER (WHERE n_correct = 0)::int AS no_key,
        count(*) FILTER (WHERE n_correct > 1)::int AS multi_key,
        count(*) FILTER (WHERE n_correct = 1)::int AS exactly_one_key
       FROM t`,
  );

  // Per grade.
  out.by_grade = await q(
    "grade",
    `${OPT_CTE},
      agg AS (
        SELECT question_id,
               count(*)::int AS n_opts,
               count(*) FILTER (WHERE distractor_rationale IS NOT NULL)::int AS n_rat_nonempty
          FROM opt GROUP BY question_id
      ),
      meta AS (SELECT DISTINCT question_id, grade FROM opt)
     SELECT coalesce(m.grade,'(null)') AS grade,
            count(*)::int AS mc_total,
            count(*) FILTER (WHERE agg.n_rat_nonempty = agg.n_opts)::int AS full_rationale,
            round(100.0 * count(*) FILTER (WHERE agg.n_rat_nonempty = agg.n_opts) / NULLIF(count(*),0),2) AS pct_full
       FROM agg
       JOIN meta m ON m.question_id = agg.question_id
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
    `${OPT_CTE}
     SELECT b.title AS bundle, count(DISTINCT opt.question_id)::int AS mc_total
        FROM opt
        JOIN bundle_items bi ON bi.question_id = opt.question_id
        JOIN bundles b ON b.id = bi.bundle_id
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
    `${OPT_CTE}
     SELECT count(*)::int AS n_banned
       FROM opt
      WHERE lower(COALESCE(content_markdown,'')) ~ 'semua (jawaban )?benar|tidak ada (jawaban )?yang benar|semua salah|none of the above'`,
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
    `${OPT_CTE},
      t AS (
        SELECT question_id, stddev(length(content_markdown)) sd,
               avg(length(content_markdown)) av
          FROM opt GROUP BY question_id)
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
