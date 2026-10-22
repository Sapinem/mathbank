/**
 * R5-JSONB: Tulis rubrik penilaian esai ke answer_key.scoringRubric (JSONB)
 * MAT-35 — Pedagogy enrichment aligned ke MAT-144 architecture
 *
 * Arsitektur: Single Table + Hybrid JSONB (MAT-144)
 * Target field: questions.answer_key.scoringRubric (field JSONB existing)
 *
 * DAPAT DIJALANKAN SEKARANG — answer_key sudah JSONB di DB live.
 * Tidak bergantung pada migrasi data_payload dari MAT-144.
 *
 * Format rubrik (per SKILL_PEDAGOGY.md + Zod answerKeySchema):
 *   "Langkah N — Nama Langkah (X poin): kriteria penilaian"
 *   Total: N poin
 *
 * Jalankan (dry):  DRY_RUN=1 pnpm exec tsx scripts/r5-essay-rubric-jsonb.ts
 * Jalankan (live): DRY_RUN=0 pnpm exec tsx scripts/r5-essay-rubric-jsonb.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";
const sql = postgres(DB_URL, { max: 1, connect_timeout: 30, idle_timeout: 30 });

/**
 * Rubrik untuk batch ini — esai pilihan berdasarkan ketersediaan answer_key.explanation
 * yang cukup informatif untuk menyusun rubrik poin-per-langkah.
 *
 * Format rubrik mengikuti Zod answerKeySchema.scoringRubric:
 * "Langkah 1 — Nama (X poin): kriteria\nLangkah 2 — Nama (Y poin): kriteria\nTotal: Z poin"
 */
const essayRubrics: Array<{ id: string; scoringRubric: string; explanationMarkdown?: string }> = [
  // ── Bundle: Distribusi Peluang (R3/R5 target) ─────────────────────────────
  {
    id: "01a1163a-df91-7964-a76f-dc97a57eff6b",
    // sin ∠PBO pada persegi ABCD (sudah diisi di batch sebelumnya, skip jika exists)
    scoringRubric:
      "Langkah 1 — Panjang diagonal (2 poin): Menghitung AC = BD = 6a√2 dengan Teorema Pythagoras.\n" +
      "Langkah 2 — Panjang OC dan OP (3 poin): Menentukan OC = 3a√2 dan OP = a√2 dari rasio OP:PC = 1:2.\n" +
      "Langkah 3 — Panjang BP (3 poin): Menghitung BP = √((3a√2)² + (a√2)²) = 2a√5.\n" +
      "Langkah 4 — Nilai sinus & kesimpulan (2 poin): sin ∠PBO = OP/BP = a√2/(2a√5) = √10/10.\n" +
      "Total: 10 poin",
  },
  // ── Bundle: Barisan & Deret Geometri (R5 lanjutan) ───────────────────────
  {
    id: "01a1155f-9e34-7b3c-ae12-3a6c5d8e1f20", // placeholder — akan diisi dari DB query
    scoringRubric: "", // akan diisi programatik per soal
  },
];

// Rubrik generatif per tipe soal esai (untuk soal yang belum punya rubrik)
// Format: fungsi yang menerima explanation dan menghasilkan rubrik
function generateRubricFromExplanation(
  explanation: string,
  stemHint: string
): string | null {
  // Heuristic: topik-topik dengan pola khas
  const lower = explanation.toLowerCase();
  const stem = stemHint.toLowerCase();

  // Peluang / probabilitas
  if (lower.includes("peluang") || lower.includes("probabilitas") || stem.includes("peluang")) {
    return (
      "Langkah 1 — Ruang sampel (2 poin): Menentukan n(S) dengan benar (daftar atau rumus perkalian).\n" +
      "Langkah 2 — Kejadian E (3 poin): Mengidentifikasi semua elemen kejadian E yang diminta.\n" +
      "Langkah 3 — Peluang (3 poin): Menghitung P(E) = n(E)/n(S) dengan benar.\n" +
      "Langkah 4 — Kesimpulan (2 poin): Menyimpulkan nilai peluang dalam bentuk pecahan paling sederhana.\n" +
      "Total: 10 poin"
    );
  }

  // Barisan aritmetika
  if (
    (lower.includes("barisan") || lower.includes("deret")) &&
    (lower.includes("aritmetika") || lower.includes("aritmatika"))
  ) {
    return (
      "Langkah 1 — Identifikasi beda (2 poin): Menentukan beda (b) barisan aritmetika dengan benar.\n" +
      "Langkah 2 — Rumus suku ke-n (3 poin): Menerapkan U_n = a + (n-1)b atau rumus turunannya.\n" +
      "Langkah 3 — Perhitungan (3 poin): Mensubstitusi nilai dan menghitung dengan benar.\n" +
      "Langkah 4 — Kesimpulan (2 poin): Menyimpulkan jawaban dengan satuan/konteks yang tepat.\n" +
      "Total: 10 poin"
    );
  }

  // Barisan/deret geometri
  if (
    (lower.includes("barisan") || lower.includes("deret")) &&
    (lower.includes("geometri") || lower.includes("rasio"))
  ) {
    return (
      "Langkah 1 — Identifikasi rasio (2 poin): Menentukan rasio (r) barisan geometri.\n" +
      "Langkah 2 — Rumus yang tepat (3 poin): Memilih dan menuliskan rumus U_n atau S_n dengan benar.\n" +
      "Langkah 3 — Substitusi & hitung (3 poin): Mensubstitusi nilai a, r, n dan menghitung.\n" +
      "Langkah 4 — Kesimpulan (2 poin): Menyimpulkan jawaban akhir dengan benar.\n" +
      "Total: 10 poin"
    );
  }

  // Persamaan/pertidaksamaan linear
  if (
    lower.includes("persamaan") ||
    lower.includes("pertidaksamaan") ||
    lower.includes("spldv") ||
    lower.includes("eliminasi") ||
    lower.includes("substitusi")
  ) {
    return (
      "Langkah 1 — Pemisalan variabel (1 poin): Mendefinisikan variabel dengan jelas.\n" +
      "Langkah 2 — Penyusunan persamaan (3 poin): Menuliskan model matematika yang benar.\n" +
      "Langkah 3 — Penyelesaian (4 poin): Menyelesaikan sistem persamaan dengan metode yang benar.\n" +
      "Langkah 4 — Verifikasi & kesimpulan (2 poin): Memeriksa solusi dan menyimpulkan jawaban.\n" +
      "Total: 10 poin"
    );
  }

  // Statistika
  if (
    lower.includes("mean") ||
    lower.includes("median") ||
    lower.includes("modus") ||
    lower.includes("rata-rata") ||
    lower.includes("statistika") ||
    lower.includes("data")
  ) {
    return (
      "Langkah 1 — Pengorganisasian data (2 poin): Mengurutkan/mengelompokkan data dengan benar.\n" +
      "Langkah 2 — Penentuan ukuran statistik (4 poin): Menerapkan rumus yang sesuai (mean/median/modus).\n" +
      "Langkah 3 — Perhitungan (3 poin): Menghitung dengan benar tanpa kesalahan aritmetika.\n" +
      "Langkah 4 — Kesimpulan (1 poin): Menyimpulkan nilai statistik yang diminta.\n" +
      "Total: 10 poin"
    );
  }

  // Geometri/trigonometri
  if (
    lower.includes("segitiga") ||
    lower.includes("sudut") ||
    lower.includes("sin") ||
    lower.includes("cos") ||
    lower.includes("tan") ||
    lower.includes("pythagoras") ||
    stem.includes("geometri")
  ) {
    return (
      "Langkah 1 — Sketsa/diagram (1 poin): Menggambar/memvisualkan bangun atau situasi geometri.\n" +
      "Langkah 2 — Identifikasi relasi (3 poin): Mengidentifikasi rumus atau teorema yang tepat.\n" +
      "Langkah 3 — Penerapan rumus (4 poin): Mensubstitusi nilai dan menghitung dengan benar.\n" +
      "Langkah 4 — Kesimpulan (2 poin): Menyimpulkan jawaban dengan satuan dan konteks yang tepat.\n" +
      "Total: 10 poin"
    );
  }

  return null; // Tidak bisa digenerate otomatis
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE UPDATE"}`);
  console.log("Target: questions.answer_key.scoringRubric (JSONB — tersedia sekarang)");

  // Ambil semua soal esai yang belum punya scoringRubric
  const essays = await sql`
    SELECT id, content_markdown as stem, answer_key
    FROM questions
    WHERE question_type = 'essay'
      AND deleted_at IS NULL
      AND (answer_key->>'scoringRubric' IS NULL OR trim(answer_key->>'scoringRubric') = '')
    ORDER BY created_at
    LIMIT 50
  ` as Array<Record<string, unknown>>;

  console.log(`\nEsai tanpa scoringRubric: ${essays.length}`);

  let updated = 0;
  let skipped = 0;
  let failedGeneration = 0;

  for (const essay of essays) {
    const id = essay.id as string;
    const stem = essay.stem as string;
    const ak = essay.answer_key as Record<string, unknown>;
    const explanation = (ak.explanation as string) || "";

    // Try to generate rubric from explanation + stem hints
    const rubric = generateRubricFromExplanation(explanation, stem);

    if (!rubric) {
      console.log(`  [SKIP] ${id.substring(0, 8)}...: rubrik tidak dapat di-generate otomatis — "${stem.substring(0, 60)}..."`);
      failedGeneration++;
      continue;
    }

    console.log(`  [UPDATE] ${id.substring(0, 8)}...: "${stem.substring(0, 60)}..."`);
    console.log(`    Rubrik preview: "${rubric.substring(0, 100)}..."`);

    if (!DRY_RUN) {
      await sql`
        UPDATE questions
        SET answer_key = jsonb_set(
          answer_key,
          '{scoringRubric}',
          ${JSON.stringify(rubric)}::jsonb
        )
        WHERE id = ${id}::uuid
          AND (answer_key->>'scoringRubric' IS NULL OR trim(answer_key->>'scoringRubric') = '')
      `;
    }
    updated++;
  }

  // Also write rubrics from the static list (specific IDs with hand-crafted rubrics)
  console.log(`\nProcessing ${essayRubrics.filter(r => r.scoringRubric).length} hand-crafted rubrics...`);
  for (const { id, scoringRubric } of essayRubrics) {
    if (!scoringRubric) continue;

    const rows = await sql`
      SELECT id, answer_key FROM questions
      WHERE id = ${id}::uuid
        AND question_type = 'essay'
        AND deleted_at IS NULL
    ` as Array<Record<string, unknown>>;

    if (!rows.length) {
      console.log(`  [SKIP] ${id}: not found or not essay`);
      skipped++;
      continue;
    }

    const existing = (rows[0] as Record<string, unknown>).answer_key as Record<string, unknown>;
    if (existing?.scoringRubric && String(existing.scoringRubric).trim().length > 20) {
      console.log(`  [SKIP] ${id.substring(0, 8)}...: already has scoringRubric`);
      skipped++;
      continue;
    }

    console.log(`  [UPDATE] ${id.substring(0, 8)}...: hand-crafted rubrik (${scoringRubric.length} chars)`);
    if (!DRY_RUN) {
      await sql`
        UPDATE questions
        SET answer_key = jsonb_set(
          answer_key,
          '{scoringRubric}',
          ${JSON.stringify(scoringRubric)}::jsonb
        )
        WHERE id = ${id}::uuid
      `;
    }
    updated++;
  }

  // Final count
  const finalCount = await sql`
    SELECT COUNT(*) as cnt FROM questions
    WHERE question_type = 'essay' AND deleted_at IS NULL
    AND answer_key->>'scoringRubric' IS NOT NULL
    AND trim(answer_key->>'scoringRubric') != ''
  `;
  const finalWithRubric = Number((finalCount[0] as Record<string, unknown>).cnt);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Essays processed: ${essays.length + essayRubrics.filter(r => r.scoringRubric).length}`);
  console.log(`scoringRubric updated: ${updated}`);
  console.log(`Skipped (exists/not-found): ${skipped}`);
  console.log(`Could not auto-generate: ${failedGeneration}`);
  console.log(`DB total essays with scoringRubric now: ${DRY_RUN ? "(dry run)" : finalWithRubric}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN - no DB changes" : "LIVE - answer_key JSONB updated"}`);

  await sql.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
