import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });
async function main() {
  // Essays with answer_key.explanation but no scoringRubric
  const candidates = await sql`
    SELECT q.id, q.content_markdown,
           q.answer_key->>'explanation' as explanation,
           q.answer_key->>'text' as text_key,
           q.grade, q.difficulty
    FROM questions q
    WHERE q.question_type = 'essay'
    AND (
      q.answer_key->>'scoringRubric' IS NULL
      OR length(q.answer_key->>'scoringRubric') = 0
    )
    AND q.answer_key->>'explanation' IS NOT NULL
    AND length(q.answer_key->>'explanation') > 100
    AND q.deleted_at IS NULL
    ORDER BY q.difficulty DESC, q.updated_at DESC
    LIMIT 6
  `;
  console.log(`Found ${candidates.length} essay candidates`);
  candidates.forEach((r, i) => {
    const exp = (r.explanation || '').substring(0, 400);
    console.log(`\n[${i+1}] id: ${r.id}`);
    console.log(`    grade:${r.grade} diff:${r.difficulty}`);
    console.log(`    content: ${(r.content_markdown||'').substring(0,120)}`);
    console.log(`    exp: ${exp}`);
  });
  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
