import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

async function main() {
  // Current metrics
  const metrics = await sql`
    SELECT
      (SELECT COUNT(DISTINCT q.id) FROM questions q
       WHERE q.question_type = 'single_choice'
       AND jsonb_typeof(q.data_payload->'options') = 'array'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(q.data_payload->'options') opt
                   WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10)
      ) AS sc_with_dr,
      (SELECT COUNT(*) FROM questions WHERE question_type='single_choice') AS total_sc,
      (SELECT COUNT(*) FROM questions WHERE question_type='essay'
       AND answer_key ? 'scoringRubric' AND length(answer_key->>'scoringRubric') > 10) AS essays_with_rubric,
      (SELECT COUNT(*) FROM questions WHERE question_type='essay') AS total_essay
  `;
  console.log("=== Current Metrics ===");
  console.log(JSON.stringify(metrics[0], null, 2));

  // Find next batch: SC without DR, with good explanation, safe type check
  const candidates = await sql`
    SELECT q.id, q.content_markdown,
           q.answer_key->>'explanation' AS explanation,
           q.answer_key->>'correct' AS correct,
           q.answer_key->>'correctOptionIds' AS correct_ids,
           q.data_payload->'options' AS options,
           q.cognitive_level, q.grade, q.difficulty,
           b.title AS bundle_title
    FROM questions q
    LEFT JOIN bundle_items bi ON bi.question_id = q.id
    LEFT JOIN bundles b ON b.id = bi.bundle_id
    WHERE q.question_type = 'single_choice'
    AND q.deleted_at IS NULL
    AND jsonb_typeof(q.data_payload->'options') = 'array'
    AND jsonb_array_length(q.data_payload->'options') >= 4
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(q.data_payload->'options') opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
    AND q.answer_key->>'explanation' IS NOT NULL
    AND length(q.answer_key->>'explanation') > 80
    ORDER BY length(q.answer_key->>'explanation') DESC
    LIMIT 10
  `;
  console.log(`\n=== ${candidates.length} Candidates for Batch 11 ===`);
  candidates.forEach((r, i) => {
    const exp = (r.explanation || "").substring(0, 400);
    const opts = (r.options as any[]) || [];
    console.log(`\n--- ${i + 1}. ID: ${r.id} ---`);
    console.log(`Bundle: ${r.bundle_title || "N/A"}`);
    console.log(`Grade: ${r.grade} | Cognitive: ${r.cognitive_level} | Difficulty: ${r.difficulty}`);
    console.log(`Content (100): ${(r.content_markdown || "").substring(0, 100)}`);
    console.log(`Correct: ${r.correct || r.correct_ids}`);
    console.log(`Options count: ${opts.length}`);
    opts.forEach((o: any) => {
      console.log(`  [${o.label || o.id}] ${(o.text || o.content || "").substring(0, 60)}`);
    });
    console.log(`Explanation (400): ${exp}`);
  });

  // Also find essay without rubric
  const essays = await sql`
    SELECT q.id, q.content_markdown,
           q.answer_key->>'text' AS ak_text,
           q.answer_key->>'explanationMarkdown' AS explanation,
           b.title AS bundle_title
    FROM questions q
    LEFT JOIN bundle_items bi2 ON bi2.question_id = q.id
    LEFT JOIN bundles b ON b.id = bi2.bundle_id
    WHERE q.question_type = 'essay'
    AND q.deleted_at IS NULL
    AND (
      q.answer_key->>'scoringRubric' IS NULL
      OR length(q.answer_key->>'scoringRubric') <= 10
    )
    AND (q.answer_key->>'text' IS NOT NULL OR q.answer_key->>'explanationMarkdown' IS NOT NULL)
    ORDER BY length(COALESCE(q.answer_key->>'text', q.answer_key->>'explanationMarkdown', '')) DESC
    LIMIT 8
  `;
  console.log(`\n=== ${essays.length} Essay Candidates for Batch 11 ===`);
  essays.forEach((r, i) => {
    const txt = (r.ak_text || r.explanation || "").substring(0, 300);
    console.log(`\n--- Essay ${i + 1}. ID: ${r.id} ---`);
    console.log(`Bundle: ${r.bundle_title || "N/A"}`);
    console.log(`Content: ${(r.content_markdown || "").substring(0, 100)}`);
    console.log(`Answer text (300): ${txt}`);
  });

  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
