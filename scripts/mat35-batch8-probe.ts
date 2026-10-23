import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

type QuestionOption = { id: string; contentMarkdown?: string; content?: string };

async function main() {
  // SC questions without rationale that have explanation text (for R4 next batch)
  const scNeedingRationale = await sql`
    SELECT q.id, q.bundle_id, q.sort_order,
      b.title as bundle_title,
      q.content_markdown as stem,
      q.answer_key->>'explanationMarkdown' as explanation_md,
      q.answer_key->>'explanation' as explanation,
      q.data_payload->'options' as options,
      q.answer_key->>'correctOptionIds' as correct_ids
    FROM questions q
    LEFT JOIN bundles b ON b.id = q.bundle_id
    WHERE q.question_type = 'single_choice'
    AND q.data_payload ? 'options'
    AND q.data_payload->'options' != 'null'::jsonb
    AND q.data_payload->'options' != '[]'::jsonb
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(q.data_payload->'options') opt
      WHERE opt->>'distractorRationale' IS NOT NULL
      AND length(opt->>'distractorRationale') > 10
    )
    AND deleted_at IS NULL
    AND (
      (q.answer_key->>'explanationMarkdown' IS NOT NULL AND length(q.answer_key->>'explanationMarkdown') > 50)
      OR (q.answer_key->>'explanation' IS NOT NULL AND length(q.answer_key->>'explanation') > 50)
    )
    ORDER BY b.title, q.sort_order
    LIMIT 8
  `;
  console.log("SC needing rationale (with explanation):", scNeedingRationale.length);
  for (const q of scNeedingRationale) {
    console.log("---");
    console.log("id:", q.id, "| bundle:", q.bundle_title, "| order:", q.sort_order);
    console.log("correct_ids:", q.correct_ids);
    console.log("stem:", q.stem?.substring(0, 200));
    const exp = q.explanation_md || q.explanation || "";
    console.log("explanation:", exp.substring(0, 300));
    const opts = (q.options as QuestionOption[]);
    opts?.forEach((o) => {
      console.log(`  opt ${o.id}: ${(o.contentMarkdown || o.content || "").substring(0, 60)}`);
    });
  }

  // Count totals
  const totalNeedingRationale = await sql`
    SELECT COUNT(*) as cnt
    FROM questions q
    WHERE q.question_type = 'single_choice'
    AND q.data_payload ? 'options'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
    AND deleted_at IS NULL
  `;
  console.log("\nTotal SC needing rationale:", totalNeedingRationale[0].cnt);

  // Bundle breakdown
  const bundleBreakdown = await sql`
    SELECT b.title, COUNT(*) as cnt
    FROM questions q
    LEFT JOIN bundles b ON b.id = q.bundle_id
    WHERE q.question_type = 'single_choice'
    AND q.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
    AND (
      (q.answer_key->>'explanationMarkdown' IS NOT NULL AND length(q.answer_key->>'explanationMarkdown') > 50)
      OR (q.answer_key->>'explanation' IS NOT NULL AND length(q.answer_key->>'explanation') > 50)
    )
    GROUP BY b.title ORDER BY cnt DESC LIMIT 20
  `;
  console.log("\nBundle breakdown (SC needing rationale + has explanation):");
  for (const r of bundleBreakdown) {
    console.log(` ${String(r.cnt).padStart(4)} | ${r.title}`);
  }

  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
