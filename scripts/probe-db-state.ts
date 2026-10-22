import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const r1 = await sql`SELECT COUNT(*) as cnt FROM questions WHERE question_type IN ('multiple_choice','complex_multiple_choice') AND deleted_at IS NULL`;
  console.log('MCQ count:', r1[0].cnt);

  // MAT-146: tabel opsi relasional sudah di-drop; opsi hidup di
  // data_payload.options (JSONB) — lihat pemeriksaan cakupan di bawah.

  const r3 = await sql`
    SELECT COUNT(*) as cnt FROM questions 
    WHERE question_type IN ('multiple_choice','complex_multiple_choice') 
    AND deleted_at IS NULL
    AND data_payload->'options' IS NOT NULL
  `;
  console.log('MCQ with data_payload.options:', r3[0].cnt);

  const r4 = await sql`
    SELECT id, data_payload->'options' as opts, answer_key
    FROM questions 
    WHERE question_type IN ('multiple_choice','complex_multiple_choice')
    AND deleted_at IS NULL
    AND data_payload ? 'options'
    LIMIT 1
  `;
  if (r4.length) {
    const q = r4[0] as Record<string, unknown>;
    console.log('Sample opts:', JSON.stringify(q.opts)?.substring(0, 400));
    console.log('Answer key keys:', Object.keys(q.answer_key as Record<string, unknown>));
  }

  // Check essay questions  
  const r5 = await sql`SELECT COUNT(*) as cnt FROM questions WHERE question_type = 'essay' AND deleted_at IS NULL`;
  console.log('Essay count:', r5[0].cnt);

  const r6 = await sql`
    SELECT COUNT(*) as cnt FROM questions 
    WHERE question_type = 'essay' AND deleted_at IS NULL
    AND answer_key->>'scoringRubric' IS NOT NULL
  `;
  console.log('Essay with scoringRubric:', r6[0].cnt);
  
  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
