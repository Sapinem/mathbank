import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });
async function main() {
  // Find that question with star-and-bars / combinatorics content
  const r = await sql`
    SELECT id, content_markdown, answer_key->>'explanation' as exp,
           answer_key->>'correct' as correct,
           data_payload->'options' as options
    FROM questions 
    WHERE content_markdown ILIKE '%tripel%' OR content_markdown ILIKE '%bintang%' OR content_markdown ILIKE '%stars%'
    LIMIT 3
  `;
  r.forEach(row => {
    const opts = (row.options as any[] || []);
    console.log("\n=== " + row.id + " ===");
    console.log("CONTENT:", (row.content_markdown||'').substring(0,300));
    console.log("CORRECT:", row.correct);
    opts.forEach(o => console.log(`  OPT ${o.id}: ${(o.contentMarkdown||'').substring(0,80)}`));
    console.log("EXP:", (row.exp||'').substring(0,400));
  });
  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
