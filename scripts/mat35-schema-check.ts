import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });
async function main() {
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='questions' ORDER BY ordinal_position`;
  console.log("questions columns:", cols.map(r => r.column_name).join(', '));
  // sample question to understand payload structure
  const sample = await sql`SELECT id, question_type, data_payload, answer_key FROM questions WHERE question_type='single_choice' LIMIT 1`;
  if (sample.length) {
    console.log("\nsample id:", sample[0].id);
    console.log("data_payload keys:", Object.keys(sample[0].data_payload || {}));
    console.log("answer_key keys:", Object.keys(sample[0].answer_key || {}));
    console.log("options[0] keys:", Object.keys(((sample[0].data_payload as { options?: Record<string, unknown>[] } | null)?.options?.[0]) || {}));
  }
  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
