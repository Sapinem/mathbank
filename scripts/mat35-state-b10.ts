import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

async function main() {
  // Current coverage
  const scCov = await sql`
    SELECT COUNT(DISTINCT q.id) as cnt
    FROM questions q
    WHERE q.question_type = 'single_choice'
    AND q.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
  `;
  const totalSC = await sql`SELECT COUNT(*) as cnt FROM questions WHERE question_type='single_choice' AND deleted_at IS NULL`;
  const essWithRubric = await sql`
    SELECT COUNT(*) as cnt FROM questions
    WHERE question_type = 'essay' AND deleted_at IS NULL
    AND answer_key ? 'scoringRubric'
    AND answer_key->>'scoringRubric' IS NOT NULL
    AND length(answer_key->>'scoringRubric') > 0
  `;
  const totalEssay = await sql`SELECT COUNT(*) as cnt FROM questions WHERE question_type='essay' AND deleted_at IS NULL`;

  console.log(`\n=== COVERAGE STATUS ===`);
  console.log(`SC with DR: ${scCov[0].cnt} / ${totalSC[0].cnt}`);
  console.log(`Essays with Rubric: ${essWithRubric[0].cnt} / ${totalEssay[0].cnt}`);
  
  // Top bundles with most SC without DR — using bundle_items join
  const bundlesWithout = await sql`
    SELECT 
      b.title as bundle_name,
      COUNT(DISTINCT q.id) as total_sc,
      COUNT(DISTINCT q.id) FILTER (WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
        WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
      )) as sc_with_dr,
      COUNT(DISTINCT q.id) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
        WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
      )) as sc_without_dr
    FROM bundles b
    JOIN bundle_items bi ON bi.bundle_id = b.id
    JOIN questions q ON q.id = bi.question_id
    WHERE q.question_type = 'single_choice' AND q.deleted_at IS NULL
    GROUP BY b.id, b.title
    HAVING COUNT(DISTINCT q.id) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )) > 0
    ORDER BY sc_without_dr DESC
    LIMIT 12
  `;

  console.log(`\n=== TOP BUNDLES WITHOUT DR ===`);
  bundlesWithout.forEach((r: any) => {
    console.log(`  [${r.sc_without_dr}/${r.total_sc} missing] ${r.bundle_name}`);
  });

  // Essays without rubric — sample with bundle info
  const essNeed = await sql`
    SELECT q.id, q.content_markdown, 
           q.answer_key->>'explanation' as exp_text,
           COALESCE(b.title, 'no-bundle') as bundle
    FROM questions q
    LEFT JOIN bundle_items bi ON bi.question_id = q.id
    LEFT JOIN bundles b ON b.id = bi.bundle_id
    WHERE q.question_type = 'essay' AND q.deleted_at IS NULL
    AND NOT (q.answer_key ? 'scoringRubric' AND q.answer_key->>'scoringRubric' IS NOT NULL AND length(q.answer_key->>'scoringRubric') > 0)
    ORDER BY q.updated_at DESC
    LIMIT 8
  `;
  console.log(`\n=== ESSAYS WITHOUT RUBRIC (sample 8) ===`);
  const seen = new Set<string>();
  essNeed.forEach((r: any) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    console.log(`  [${r.bundle}] ${r.id}`);
    console.log(`    content: ${(r.content_markdown||'').substring(0,120)}`);
    console.log(`    exp: ${(r.exp_text||'(none)').substring(0,120)}`);
  });

  // Also check event-tagged breakdown
  const byEvent = await sql`
    SELECT q.event_subtest, COUNT(*) as cnt
    FROM questions q
    WHERE q.question_type = 'single_choice' AND q.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
    GROUP BY q.event_subtest
    ORDER BY cnt DESC
    LIMIT 10
  `;
  console.log(`\n=== SC WITHOUT DR by event_subtest ===`);
  byEvent.forEach((r: any) => console.log(`  ${r.event_subtest||'(null)'}: ${r.cnt}`));

  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
