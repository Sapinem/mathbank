import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

type QuestionOption = { id: string; contentMarkdown?: string };
async function main() {
  // Find questions with good explanations that already contain answer analysis
  const goodCandidates = await sql`
    SELECT q.id, q.content_markdown,
           q.answer_key->>'explanation' as explanation,
           q.answer_key->>'correct' as correct,
           q.answer_key->>'correctOptionIds' as correct_ids,
           q.data_payload->'options' as options,
           q.cognitive_level, q.grade, q.difficulty
    FROM questions q
    WHERE q.question_type = 'single_choice'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
    AND q.answer_key->>'explanation' IS NOT NULL
    AND length(q.answer_key->>'explanation') > 100
    AND jsonb_array_length(COALESCE(q.data_payload->'options','[]'::jsonb)) >= 4
    AND q.deleted_at IS NULL
    ORDER BY q.updated_at DESC
    LIMIT 8
  `;
  console.log(`Found ${goodCandidates.length} candidates\n`);
  goodCandidates.forEach((r, i) => {
    const exp = (r.explanation || '').substring(0, 300);
    const opts = (r.options as QuestionOption[] || []).map(o => `${o.id}:${(o.contentMarkdown||'').substring(0,40)}`);
    console.log(`\n[${i+1}] id: ${r.id}`);
    console.log(`    correct: ${r.correct} | correctIds: ${JSON.stringify(r.correct_ids)}`);
    console.log(`    grade:${r.grade} cog:${r.cognitive_level} diff:${r.difficulty}`);
    console.log(`    content: ${(r.content_markdown||'').substring(0,100)}`);
    console.log(`    options: ${opts.join(' | ')}`);
    console.log(`    explanation: ${exp}`);
  });
  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
