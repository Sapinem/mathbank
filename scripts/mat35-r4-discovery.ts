import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });
async function main() {
  // Find parent questions with children that have no rationale
  // Single choice questions (no parent_id = standalone, parent_id = child of stimulus)
  const bundleSummary = await sql`
    WITH sc_status AS (
      SELECT q.id, q.parent_id,
        CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
          WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
        ) THEN 'has_dr' ELSE 'no_dr' END as dr_status,
        q.answer_key->>'explanation' as explanation,
        q.content_markdown
      FROM questions q WHERE q.question_type = 'single_choice'
    )
    SELECT 
      dr_status,
      COUNT(*) as cnt,
      COUNT(CASE WHEN explanation IS NOT NULL AND length(explanation) > 20 THEN 1 END) as has_explanation
    FROM sc_status
    GROUP BY dr_status
  `;
  console.log("DR status summary:", JSON.stringify(bundleSummary));

  // Fetch sample questions without DR that DO have good explanations (for R2 pattern)
  const candidates = await sql`
    SELECT q.id, q.content_markdown, q.answer_key,
           q.data_payload->'options' as options
    FROM questions q
    WHERE q.question_type = 'single_choice'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
    AND q.answer_key->>'explanation' IS NOT NULL
    AND (
      lower(q.answer_key->>'explanation') LIKE '%cek opsi%'
      OR lower(q.answer_key->>'explanation') LIKE '%option%'
      OR lower(q.answer_key->>'explanation') LIKE '%pilihan%'
    )
    LIMIT 5
  `;
  console.log("\nCandidates with Cek opsi pattern:", candidates.length);
  candidates.forEach(r => {
    const exp = ((r.answer_key as { explanation?: string } | null)?.explanation || '').substring(0, 200);
    console.log(`  id:${r.id}\n  exp: ${exp}\n`);
  });

  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
