import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

type QuestionOption = { id: string; distractorRationale?: string };
async function main() {
  // Sample questions WITH rationale
  const withDR = await sql`
    SELECT q.id, q.parent_id,
           jsonb_agg(opt ORDER BY opt->>'id') as options_sample
    FROM questions q, jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
    WHERE q.question_type = 'single_choice'
    AND opt->>'distractorRationale' IS NOT NULL
    AND length(opt->>'distractorRationale') > 10
    GROUP BY q.id
    LIMIT 3
  `;
  console.log("Sample questions WITH rationale:");
  withDR.forEach(r => {
    console.log("\n id:", r.id, "parent:", r.parent_id);
    const opts = r.options_sample as QuestionOption[];
    opts.forEach(o => {
      console.log(`  option ${o.id}: DR="${(o.distractorRationale||'').substring(0,80)}"`);
    });
  });

  // Sample questions WITHOUT rationale
  const withoutDR = await sql`
    SELECT q.id, q.parent_id,
           jsonb_array_length(COALESCE(q.data_payload->'options','[]'::jsonb)) as opt_cnt,
           q.answer_key->>'explanation' as explanation
    FROM questions q
    WHERE q.question_type = 'single_choice'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
    AND q.answer_key->>'explanation' IS NOT NULL
    LIMIT 5
  `;
  console.log("\nSample questions WITHOUT rationale (but have explanation):");
  withoutDR.forEach(r => {
    console.log(`  id:${r.id} opts:${r.opt_cnt} explanation="${(r.explanation||'').substring(0,100)}"`);
  });

  // How many without rationale have explanation?
  const cnt = await sql`
    SELECT COUNT(*) as cnt FROM questions q
    WHERE q.question_type = 'single_choice'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
    AND q.answer_key->>'explanation' IS NOT NULL
    AND length(q.answer_key->>'explanation') > 20
  `;
  console.log("\nsc_without_rationale_but_have_explanation:", cnt[0].cnt);

  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
