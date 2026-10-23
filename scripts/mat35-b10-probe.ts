import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

type QuestionOption = { id: string; contentMarkdown?: string };

const B10_IDS = [
  '01a11644-d8bf-718c-b60d-159f0ca43f64', // bangun datar - garis sejajar segitiga
  '01a11644-da65-7558-b545-20be11f21cd7', // segitiga - garis bagi
  '01a11644-d818-7c28-afb7-1b2125ec8155', // persegi panjang + lingkaran kongruen
  '01a11644-d850-709e-9251-71f07bf63719', // segitiga ABC titik D+E
  '01a11644-d8f6-7d44-a8a8-218d87f6a8b2', // persegi panjang + lingkaran
  '01a11644-d9f6-737a-818a-26255d84f667', // sudut siku-siku + garis bagi
  '01a11644-d7e1-75af-9c2c-f9f58e2178fe', // diameter lingkaran kecil
  '01a11645-105e-7dab-a502-a6f7396879b0', // PD eksak / ODE
];

async function main() {
  const rows = await sql`
    SELECT id, content_markdown, data_payload->'options' as options,
           answer_key->>'correct' as correct,
           answer_key->>'correctOptionIds' as correct_ids,
           answer_key->>'explanation' as explanation,
           cognitive_level, grade, difficulty
    FROM questions
    WHERE id = ANY(${B10_IDS})
  `;
  rows.forEach(r => {
    const opts = (r.options as QuestionOption[]) || [];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ID: ${r.id}`);
    console.log(`CONTENT: ${r.content_markdown}`);
    console.log(`CORRECT: ${r.correct} | correctIds: ${r.correct_ids}`);
    console.log(`GRADE: ${r.grade} | COG: ${r.cognitive_level} | DIFF: ${r.difficulty}`);
    console.log(`OPTIONS:`);
    opts.forEach((o) => console.log(`  ${o.id}: ${o.contentMarkdown}`));
    console.log(`EXPLANATION:\n${r.explanation}`);
  });
  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
