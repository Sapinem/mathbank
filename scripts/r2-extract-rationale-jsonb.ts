/**
 * R2 (JSONB-aligned): Ekstraksi rationale dari explanation bergaya "Cek opsi X: ..."
 * MAT-35 — distractor_rationale enrichment, target JSONB data_payload.options
 *
 * Arsitektur: Single Table + Hybrid JSONB (MAT-144)
 * Target field: questions.data_payload -> options[] -> distractorRationale
 *
 * DEPENDENCY: Requires MAT-144 migration that populates data_payload.options[]
 * from question_options. Run AFTER questions.data_payload.options is populated.
 *
 * Jalankan (dry):  DRY_RUN=1 pnpm exec tsx scripts/r2-extract-rationale-jsonb.ts
 * Jalankan (live): DRY_RUN=0 pnpm exec tsx scripts/r2-extract-rationale-jsonb.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";
const sql = postgres(DB_URL, { max: 1, connect_timeout: 30, idle_timeout: 30 });

/** Parse "Cek opsi X:" blocks from explanation text */
function extractRationalePerOption(explanation: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /Cek\s+[Oo]psi\s+([A-Ea-e])\s*[:：]/gi;
  const parts: Array<{ label: string; start: number }> = [];

  let match;
  const regex = new RegExp(pattern.source, pattern.flags);
  while ((match = regex.exec(explanation)) !== null) {
    parts.push({ label: match[1].toUpperCase(), start: match.index });
  }

  for (let i = 0; i < parts.length; i++) {
    const { label, start } = parts[i];
    const end = i + 1 < parts.length ? parts[i + 1].start : explanation.length;
    let block = explanation.slice(start, end);
    block = block.replace(/^Cek\s+[Oo]psi\s+[A-Ea-e]\s*[:：]\s*/i, "").trim();
    if (block.length > 10) {
      result.set(label, block);
    }
  }

  return result;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE UPDATE"}`);
  console.log("Target: questions.data_payload.options[].distractorRationale (JSONB, MAT-144)");

  // Check if data_payload.options is populated (migration must have run)
  const migCheck = await sql`
    SELECT COUNT(*) as cnt
    FROM questions
    WHERE deleted_at IS NULL
      AND data_payload -> 'options' IS NOT NULL
      AND jsonb_array_length(data_payload -> 'options') > 0
  `;
  const migratedCount = Number((migCheck[0] as Record<string, unknown>).cnt);
  console.log(`\nMigration check: ${migratedCount} questions with data_payload.options populated`);

  if (migratedCount === 0) {
    console.error(
      "\nBLOCKER: data_payload.options is empty for all questions." +
      "\nMAT-144 migration (question_options -> data_payload JSONB) must complete first." +
      "\nFalling back to read-only analysis of question_options for planning purposes...\n"
    );

    // Report what will be available post-migration
    const candidates = await sql`
      SELECT q.id, q.content_markdown as stem,
        q.answer_key->>'explanation' as explanation,
        q.answer_key->>'correct' as correct,
        json_agg(json_build_object(
          'label', o.label,
          'is_correct', o.is_correct,
          'current_rationale', o.distractor_rationale
        ) ORDER BY o.label) as options
      FROM questions q
      JOIN question_options o ON o.question_id = q.id
      WHERE q.deleted_at IS NULL
        AND q.answer_key->>'explanation' ILIKE '%cek opsi%'
      GROUP BY q.id, q.content_markdown, q.answer_key
      ORDER BY q.created_at
    ` as Array<Record<string, unknown>>;

    console.log(`Found ${candidates.length} questions with "Cek opsi" explanations (post-migration targets)`);
    let totalPotential = 0;
    for (const q of candidates) {
      const explanation = q.explanation as string;
      const rationales = extractRationalePerOption(explanation);
      totalPotential += rationales.size;
      if (rationales.size > 0) {
        console.log(
          `  Q ${(q.id as string).substring(0, 8)}...: ${rationales.size} rationale blocks` +
          ` [labels: ${[...rationales.keys()].join(",")}]` +
          ` "${(q.stem as string).substring(0, 60)}..."`
        );
      }
    }
    console.log(`\nPotential: ${totalPotential} distractorRationale entries ready to write post-migration`);
    await sql.end();
    return;
  }

  // Post-migration: update data_payload.options[].distractorRationale
  const questions = await sql`
    SELECT q.id,
      q.answer_key->>'explanation' as explanation,
      q.answer_key->>'correct' as correct,
      q.data_payload->'options' as options_jsonb
    FROM questions q
    WHERE q.deleted_at IS NULL
      AND q.answer_key->>'explanation' ILIKE '%cek opsi%'
      AND q.data_payload->'options' IS NOT NULL
    ORDER BY q.created_at
  ` as Array<Record<string, unknown>>;

  console.log(`\nFound ${questions.length} migrated questions with "Cek opsi" explanations`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const q of questions) {
    const explanation = q.explanation as string;
    const optionsJsonb = q.options_jsonb as Array<{
      id: string;
      contentMarkdown: string;
      distractorRationale?: string | null;
    }>;
    const rationales = extractRationalePerOption(explanation);

    // Determine correct option ID from answer_key.correctOptionIds
    const correctRaw = q.correct as string | string[] | null;
    const correctIds = Array.isArray(correctRaw)
      ? correctRaw
      : correctRaw
        ? [correctRaw]
        : [];

    let updatedOptions = [...optionsJsonb];
    let changed = false;

    for (let i = 0; i < updatedOptions.length; i++) {
      const opt = updatedOptions[i];
      const isCorrect = correctIds.includes(opt.id);
      if (isCorrect) continue; // Skip correct option

      const rationale = rationales.get(opt.id.toUpperCase());
      if (!rationale) {
        console.log(`  [SKIP] Option ${opt.id}: no rationale block found`);
        totalSkipped++;
        continue;
      }

      if (opt.distractorRationale && opt.distractorRationale.trim().length > 0) {
        console.log(`  [SKIP] Option ${opt.id}: already has distractorRationale`);
        totalSkipped++;
        continue;
      }

      console.log(`  [UPDATE] Q ${(q.id as string).substring(0, 8)} opt ${opt.id}: "${rationale.substring(0, 80)}..."`);
      updatedOptions[i] = { ...opt, distractorRationale: rationale };
      changed = true;
      totalUpdated++;
    }

    if (changed && !DRY_RUN) {
      await sql`
        UPDATE questions
        SET data_payload = jsonb_set(data_payload, '{options}', ${JSON.stringify(updatedOptions)}::jsonb)
        WHERE id = ${q.id as string}::uuid
      `;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Questions processed: ${questions.length}`);
  console.log(`Distractor rationale entries updated: ${totalUpdated}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN - no DB changes" : "LIVE - data_payload JSONB updated"}`);

  await sql.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
