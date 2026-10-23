import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

type QuestionOption = { id: string; contentMarkdown?: string };
async function main() {
  const candidates = await sql`
    SELECT q.id, q.content_markdown,
           q.answer_key->>'explanation' as explanation,
           q.answer_key->>'correct' as correct,
           q.data_payload->'options' as options
    FROM questions q
    WHERE q.id IN (
      '01a11644-d9b1-7923-b183-b2349643ea07',
      '01a11645-47e7-739d-8357-1e183f99007f',
      '01a11644-d9d0-7fcc-b4ea-ded335dd4325',
      '01a11644-d631-7e74-8b15-13434a82fb35',
      '01a11645-31bc-79ba-b693-f90dc19221a7',
      '01a11645-617e-7b9b-af6b-3314aa50505d',
      '01a11644-d6d7-7da2-98f1-a8479a505b8f',
      '01a11644-d887-7946-8dd6-03cb48ec726f'
    )
    ORDER BY q.id
  `;
  candidates.forEach(r => {
    const opts = (r.options as QuestionOption[]) || [];
    console.log(`\n=== ${r.id} ===`);
    console.log(`CONTENT: ${(r.content_markdown||'').substring(0,250)}`);
    console.log(`CORRECT: ${r.correct}`);
    opts.forEach(o => {
      console.log(`  OPT ${o.id}: ${(o.contentMarkdown||'').substring(0,100)}`);
    });
    console.log(`EXP: ${(r.explanation||'').substring(0,600)}`);
  });
  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
