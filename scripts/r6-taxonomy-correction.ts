/**
 * R6: Koreksi Metadata Taksonomi Placeholder
 * MAT-35 — Pedagogy enrichment R6
 *
 * Masalah: 11,867 soal dengan grade='umum' dan cognitive_level='understand' (placeholder)
 *
 * Strategi:
 * 1. Grade inference: dari bundle title (SMP/MTs → kelas 7-9, SMA/UTBK → kelas 10-12)
 *    - SMP keywords: smp, mts, sd, dasar → grade = '9' (SMP akhir) atau '7','8','9'
 *    - SMA keywords: sma, ma, utbk, snbt, saintek, soshum → grade = '12' atau '10','11','12'
 *    - umum → tetap 'umum'
 * 2. Cognitive level inference dari difficulty + question type:
 *    - difficulty 1-2 + single_choice → 'remember'
 *    - difficulty 3 + single_choice → 'understand' (tetap — sudah default tapi valid)
 *    - difficulty 4-5 + single_choice/essay → 'apply' atau 'analyze'
 *    - essay selalu minimal 'apply'
 *    - multiple_choice_checkbox → 'analyze'
 *
 * Run (dry):  DRY_RUN=1 pnpm exec tsx scripts/r6-taxonomy-correction.ts
 * Run (live): DRY_RUN=0 pnpm exec tsx scripts/r6-taxonomy-correction.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";
const BATCH_SIZE = 500;

const sql = postgres(DB_URL, { max: 2, connect_timeout: 30, idle_timeout: 30 });

type CognitiveLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

function inferGrade(bundleTitle: string, bundleGrade: string): string {
  const title = bundleTitle.toLowerCase();
  const grade = bundleGrade?.toLowerCase() ?? "umum";

  // Already has meaningful grade from bundle
  if (grade && grade !== "umum") return grade;

  // Infer from title keywords
  if (
    title.includes(" sma ") ||
    title.includes(" ma ") ||
    title.includes("utbk") ||
    title.includes("snbt") ||
    title.includes("saintek") ||
    title.includes("soshum") ||
    title.includes("matematika dasar") ||
    title.includes("mat dasar") ||
    title.includes("ipa terpadu")
  ) {
    return "12"; // SMA / UTBK → kelas 12 (terminal SMA)
  }

  if (
    title.includes(" smp ") ||
    title.includes(" mts ") ||
    title.includes("matematika smp") ||
    title.includes("matematika mts") ||
    title.endsWith("smp") ||
    title.endsWith("mts")
  ) {
    return "9"; // SMP → kelas 9 (terminal SMP)
  }

  if (title.includes(" sd ") || title.includes("matematika sd") || title.endsWith(" sd")) {
    return "6";
  }

  return "umum"; // Cannot infer — keep placeholder
}

function inferCognitiveLevel(
  difficulty: number,
  questionType: string
): CognitiveLevel {
  // Essay selalu minimal apply (harus uraikan proses)
  if (questionType === "essay") {
    if (difficulty >= 4) return "analyze";
    return "apply";
  }

  // Multiple choice checkbox (pilih semua yang benar) = analisis
  if (questionType === "multiple_choice_checkbox") return "analyze";

  // Matrix grid = analisis (banyak hubungan)
  if (questionType === "matrix_grid") return "analyze";

  // Single choice / multiple_choice berdasarkan difficulty
  if (difficulty <= 1) return "remember";
  if (difficulty === 2) return "remember";
  if (difficulty === 3) return "understand";
  if (difficulty === 4) return "apply";
  if (difficulty >= 5) return "analyze";

  return "understand";
}

interface QuestionRow {
  id: string;
  grade: string;
  cognitive_level: CognitiveLevel;
  difficulty: number;
  question_type: string;
  content_markdown: string;
  bundle_title: string | null;
  bundle_grade: string | null;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE UPDATE"}`);
  console.log("Target: questions.grade, questions.cognitive_level");
  console.log(
    "Strategy: grade from bundle title, cognitive from difficulty+type\n"
  );

  // Fetch all questions with placeholder values + their primary bundle info
  const questions = await sql`
    SELECT
      q.id,
      q.grade,
      q.cognitive_level,
      q.difficulty,
      q.question_type,
      LEFT(q.content_markdown, 80) as content_markdown,
      b.title as bundle_title,
      b.grade as bundle_grade
    FROM questions q
    LEFT JOIN bundle_items bi ON bi.question_id = q.id
    LEFT JOIN bundles b ON b.id = bi.bundle_id AND b.deleted_at IS NULL
    WHERE q.deleted_at IS NULL
      AND (q.grade = 'umum' OR q.cognitive_level = 'understand')
    ORDER BY q.id, b.created_at
  ` as QuestionRow[];

  console.log(`Total placeholder questions: ${questions.length}`);

  // Dedupe by question id — pick first bundle (primary bundle) per question
  const seen = new Set<string>();
  const deduped: QuestionRow[] = [];
  for (const row of questions) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      deduped.push(row);
    }
  }
  console.log(`Unique questions to process: ${deduped.length}`);

  // Compute updates
  type Update = { id: string; newGrade: string; newCognitive: CognitiveLevel };
  const updates: Update[] = [];

  const gradeChanges: Record<string, number> = {};
  const cogChanges: Record<string, number> = {};

  for (const q of deduped) {
    const newGrade = inferGrade(q.bundle_title ?? "", q.bundle_grade ?? "umum");
    const newCognitive = inferCognitiveLevel(q.difficulty, q.question_type);

    const gradeChanged = newGrade !== q.grade;
    const cogChanged = newCognitive !== (q.cognitive_level as CognitiveLevel);

    if (gradeChanged || cogChanged) {
      updates.push({ id: q.id, newGrade, newCognitive });
      if (gradeChanged) {
        const key = `${q.grade} → ${newGrade}`;
        gradeChanges[key] = (gradeChanges[key] ?? 0) + 1;
      }
      if (cogChanged) {
        const key = `${q.cognitive_level} → ${newCognitive}`;
        cogChanges[key] = (cogChanges[key] ?? 0) + 1;
      }
    }
  }

  console.log(`\nQuestions to update: ${updates.length}`);
  console.log("\nGrade changes:");
  for (const [k, v] of Object.entries(gradeChanges).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("\nCognitive level changes:");
  for (const [k, v] of Object.entries(cogChanges).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  if (DRY_RUN) {
    console.log("\n=== DRY RUN — no DB writes ===");
    await sql.end();
    return;
  }

  // Bulk update using SQL VALUES(...) approach — one query per batch
  let updatedCount = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    // Build a VALUES list for bulk update
    const values = batch
      .map((u) => `('${u.id}'::uuid, '${u.newGrade}', '${u.newCognitive}'::cognitive_level)`)
      .join(",\n      ");
    await sql.unsafe(`
      UPDATE questions q
      SET grade = v.new_grade,
          cognitive_level = v.new_cognitive,
          updated_at = now()
      FROM (VALUES
        ${values}
      ) AS v(id, new_grade, new_cognitive)
      WHERE q.id = v.id
    `);
    updatedCount += batch.length;
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${updatedCount}/${updates.length} updated`);
  }

  // Verify
  const after = await sql`
    SELECT grade, cognitive_level, COUNT(*) as cnt
    FROM questions
    WHERE deleted_at IS NULL
    GROUP BY grade, cognitive_level
    ORDER BY cnt DESC
    LIMIT 15
  ` as Array<Record<string, unknown>>;

  console.log("\n=== Post-update distribution ===");
  for (const row of after) {
    console.log(`  grade=${row.grade} cognitive=${row.cognitive_level}: ${row.cnt}`);
  }

  console.log(`\nR6 complete: ${updatedCount} questions updated.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
