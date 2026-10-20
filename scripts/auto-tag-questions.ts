/**
 * ACT-10: Auto Tagging Otomatis — tag tipe soal, kompetensi Bloom, dan difficulty hint.
 *
 * Tag yang dibuat:
 *  1) TIPE SOAL   : pilihan_ganda | essay | benar_salah | matrix_grid | lainnya
 *  2) KOMPETENSI  : kognitif_C1_ingatan | kognitif_C2_pemahaman | kognitif_C3_aplikasi |
 *                   kognitif_C4_analisis | kognitif_C5_evaluasi | kognitif_C6_kreasi
 *  3) DIFFICULTY HINT: difficulty_hint_1 … difficulty_hint_5 (tidak overwrite difficulty kolom)
 *
 * DoD: Semua soal punya minimal 1 tag (tipe soal); kompetensi tag >80% coverage.
 *
 * Jalankan: pnpm tsx scripts/auto-tag-questions.ts
 *           pnpm tsx scripts/auto-tag-questions.ts --dry-run
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

// ────────────────────────────────────────────────────────────────────────────
// Tag definitions
// ────────────────────────────────────────────────────────────────────────────

interface TagDef {
  name: string;
  slug: string;
  description: string;
  tagType: "tipe_soal" | "kompetensi" | "difficulty_hint";
}

const TAG_DEFS: TagDef[] = [
  // Tipe soal
  { name: "Pilihan Ganda", slug: "pilihan_ganda", description: "Soal bertipe pilihan ganda (single choice)", tagType: "tipe_soal" },
  { name: "Pilihan Ganda Kompleks", slug: "pilihan_ganda_kompleks", description: "Soal bertipe pilihan ganda kompleks (multiple choice checkbox)", tagType: "tipe_soal" },
  { name: "Essay / Uraian", slug: "essay", description: "Soal bertipe uraian / essay", tagType: "tipe_soal" },
  { name: "Benar Salah", slug: "benar_salah", description: "Soal bertipe benar/salah (true/false)", tagType: "tipe_soal" },
  { name: "Matrix Grid", slug: "matrix_grid", description: "Soal bertipe matrix grid (pernyataan ↔ label)", tagType: "tipe_soal" },
  { name: "Lainnya", slug: "lainnya", description: "Tipe soal tidak terklasifikasi", tagType: "tipe_soal" },

  // Kompetensi Bloom
  { name: "Kognitif C1 – Ingatan", slug: "kognitif_C1_ingatan", description: "Bloom C1: Mengingat, mengenal, memanggil kembali fakta", tagType: "kompetensi" },
  { name: "Kognitif C2 – Pemahaman", slug: "kognitif_C2_pemahaman", description: "Bloom C2: Menjelaskan, menginterpretasi, merangkum", tagType: "kompetensi" },
  { name: "Kognitif C3 – Aplikasi", slug: "kognitif_C3_aplikasi", description: "Bloom C3: Menerapkan prosedur dalam situasi baru", tagType: "kompetensi" },
  { name: "Kognitif C4 – Analisis", slug: "kognitif_C4_analisis", description: "Bloom C4: Memecah konsep, membandingkan, mengorganisasi", tagType: "kompetensi" },
  { name: "Kognitif C5 – Evaluasi", slug: "kognitif_C5_evaluasi", description: "Bloom C5: Menilai, mengkritik, mempertahankan pendapat", tagType: "kompetensi" },
  { name: "Kognitif C6 – Kreasi", slug: "kognitif_C6_kreasi", description: "Bloom C6: Merancang, mengkonstruksi, memproduksi hal baru", tagType: "kompetensi" },

  // Difficulty hints (tidak overwrite kolom difficulty)
  { name: "Difficulty Hint 1 – Sangat Mudah", slug: "difficulty_hint_1", description: "Estimasi AI: soal sangat mudah (SD/Fase A-C)", tagType: "difficulty_hint" },
  { name: "Difficulty Hint 2 – Mudah", slug: "difficulty_hint_2", description: "Estimasi AI: soal mudah (SMP Kelas 7-8/Fase D awal)", tagType: "difficulty_hint" },
  { name: "Difficulty Hint 3 – Sedang", slug: "difficulty_hint_3", description: "Estimasi AI: soal sedang (SMP-SMA/Fase D-E)", tagType: "difficulty_hint" },
  { name: "Difficulty Hint 4 – Sulit", slug: "difficulty_hint_4", description: "Estimasi AI: soal sulit (SMA/UTBK/Fase F)", tagType: "difficulty_hint" },
  { name: "Difficulty Hint 5 – Sangat Sulit", slug: "difficulty_hint_5", description: "Estimasi AI: soal sangat sulit (Olimpiade/Universitas)", tagType: "difficulty_hint" },
];

// ────────────────────────────────────────────────────────────────────────────
// Keyword rules untuk kompetensi Bloom
// ────────────────────────────────────────────────────────────────────────────

interface BloomRule {
  level: "C1" | "C2" | "C3" | "C4" | "C5" | "C6";
  weight: number;
  keywords: string[];
  latexPatterns?: string[];
}

const BLOOM_RULES: BloomRule[] = [
  {
    level: "C6",
    weight: 10,
    keywords: [
      "buatlah", "rancang", "rancanglah", "buat model", "konstruksi",
      "ciptakan", "kembangkan", "susunlah", "formulasikan", "desain",
      "buat program", "turunkan rumus", "buktikan dan kembangkan",
      "buat sebuah", "susun program",
    ],
  },
  {
    level: "C5",
    weight: 10,
    keywords: [
      "evaluasi", "nilai", "nilailah", "kritik", "bandingkan dan evaluasi",
      "simpulkan mana yang lebih", "pilih metode terbaik", "metode mana yang lebih efisien",
      "putuskan", "pertahankan", "tolak atau terima", "validasi",
      "justifikasi", "rekomendasikan",
    ],
  },
  {
    level: "C4",
    weight: 9,
    keywords: [
      "analisis", "analisislah", "analisa", "bandingkan", "bedakan",
      "klasifikasikan", "uraikan", "jelaskan mengapa", "jelaskan hubungan",
      "jelaskan perbedaan", "temukan pola", "identifikasi", "telaah",
      "mengapa hal ini terjadi", "bagaimana hubungan",
    ],
  },
  {
    level: "C3",
    weight: 8,
    keywords: [
      "hitunglah", "tentukan", "tentukan nilai", "selesaikan", "gunakan",
      "hitung", "carilah", "cari nilai", "tentukan persamaan",
      "tentukan koordinat", "cari persamaan", "hitung luas", "hitung volume",
      "tentukan luas", "tentukan jarak", "tentukan sudut", "tentukan panjang",
      "buktikan", "buktikan bahwa", "tunjukkan", "tunjukkan bahwa",
      "verifikasi", "tentukan akar", "cari akar",
    ],
    latexPatterns: ["\\\\int_", "\\\\int\\b", "\\\\lim\\b", "\\\\sum\\b", "\\\\frac\\{d\\}"],
  },
  {
    level: "C2",
    weight: 7,
    keywords: [
      "jelaskan", "uraikan apa yang dimaksud", "apa yang dimaksud",
      "deskripsikan", "gambarkan", "interpretasikan", "rangkum",
      "tuliskan definisi", "apa pengertian", "apa arti",
      "sederhanakan", "ubah ke bentuk", "nyatakan dalam bentuk",
    ],
  },
  {
    level: "C1",
    weight: 6,
    keywords: [
      "sebutkan", "tuliskan", "apakah", "berapakah", "berapa",
      "definisikan", "nyatakan", "manakah", "pilih", "identifikasi",
      "tuliskan nilai", "berapa nilai", "berapa hasil",
    ],
  },
];

// Compile bloom rules
const compiledBloomRules = BLOOM_RULES.map((rule) => ({
  ...rule,
  compiledKeywords: rule.keywords.map(
    (k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  ),
  compiledLatex: (rule.latexPatterns ?? []).map((p) => new RegExp(p, "i")),
}));

// ────────────────────────────────────────────────────────────────────────────
// Difficulty hint heuristic (dari FARUQ-DIFFICULTY-PLAN.md)
// ────────────────────────────────────────────────────────────────────────────

function estimateDifficultyHint(
  contentMarkdown: string,
  eventSubtest: string | null,
  explanationLength: number,
): 1 | 2 | 3 | 4 | 5 {
  const text = contentMarkdown.toLowerCase();

  // D5: Olimpiade / Universitas
  if (
    /\b(grup|ring|lapangan|kongruensi|deret konvergen|terbukti)\b/.test(text) ||
    /\\mathbb\{[ZRQ]\}/.test(contentMarkdown) ||
    /\b(osn|ospin|olimpiade|kompetisi nasional)\b/.test((eventSubtest ?? "").toLowerCase()) ||
    explanationLength > 800
  ) return 5;

  // D4: SMA lanjut / UTBK
  if (
    /\\int|\\lim|\\sum|\\frac\{d\}/.test(contentMarkdown) ||
    /\b(integral|turunan|limit|determinan|transformasi geometri|distribusi normal|distribusi binomial)\b/.test(text) ||
    /\b(tka|utbk|snbt)\b/.test((eventSubtest ?? "").toLowerCase())
  ) return 4;

  // D2: SMP dasar
  if (
    /\b(fpb|kpk|bilangan prima|perimeter|keliling|luas|mean|median|modus|pecahan|perbandingan)\b/.test(text) &&
    !/\\int|\\lim|\\frac\{d\}/.test(contentMarkdown)
  ) return 2;

  // D1: SD / sangat dasar
  if (
    contentMarkdown.length < 80 &&
    !/[a-z]{2,}/.test(contentMarkdown.replace(/[\\{}() ]/g, "")) &&
    /\b(\d{1,3})\s*[×x\*]\s*(\d{1,3})\b/.test(text)
  ) return 1;

  return 3; // default sedang
}

// ────────────────────────────────────────────────────────────────────────────
// Classify bloom level
// ────────────────────────────────────────────────────────────────────────────

function classifyBloom(contentMarkdown: string): "C1" | "C2" | "C3" | "C4" | "C5" | "C6" {
  const text = contentMarkdown.toLowerCase();
  let bestLevel: "C1" | "C2" | "C3" | "C4" | "C5" | "C6" = "C3"; // default: aplikasi
  let bestScore = 0;

  for (const rule of compiledBloomRules) {
    let score = 0;
    for (const pat of rule.compiledKeywords) {
      if (pat.test(text)) score += rule.weight;
    }
    for (const pat of rule.compiledLatex) {
      if (pat.test(contentMarkdown)) score += rule.weight;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLevel = rule.level;
    }
  }

  return bestLevel;
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 5 });

  console.log("=== ACT-10: Auto Tagging ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  // 1. Ensure tags table has our tags
  const tagIdMap = new Map<string, string>(); // slug → id

  if (!DRY_RUN) {
    // Upsert semua tag definitions
    for (const tagDef of TAG_DEFS) {
      const existing = await sql<{ id: string }[]>`
        SELECT id FROM tags WHERE slug = ${tagDef.slug}
      `;
      if (existing.length > 0) {
        tagIdMap.set(tagDef.slug, existing[0].id);
      } else {
        const inserted = await sql<{ id: string }[]>`
          INSERT INTO tags (name, slug, description)
          VALUES (${tagDef.name}, ${tagDef.slug}, ${tagDef.description})
          RETURNING id
        `;
        tagIdMap.set(tagDef.slug, inserted[0].id);
        console.log(`  + Tag dibuat: ${tagDef.slug}`);
      }
    }
    console.log(`Tags siap: ${tagIdMap.size} tag`);
  } else {
    // DRY RUN: load existing or fake IDs
    const existingTags = await sql<{ id: string; slug: string }[]>`SELECT id, slug FROM tags`;
    for (const t of existingTags) tagIdMap.set(t.slug, t.id);
    // Add placeholders for missing
    for (const tagDef of TAG_DEFS) {
      if (!tagIdMap.has(tagDef.slug)) tagIdMap.set(tagDef.slug, `dry-run-${tagDef.slug}`);
    }
    console.log(`[DRY RUN] Tags akan dibuat: ${TAG_DEFS.length}`);
  }

  // 2. Count questions
  const totalRows = await sql<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM questions WHERE deleted_at IS NULL AND question_type != 'stimulus'
  `;
  const total = Number(totalRows[0].count);
  console.log(`Total soal (non-stimulus): ${total}`);

  // 3. Process in batches
  interface QRow {
    id: string;
    question_type: string;
    content_markdown: string;
    event_subtest: string | null;
    answer_key: Record<string, unknown>;
  }

  const tagInserts: { questionId: string; tagId: string }[] = [];

  let offset = 0;
  const bloomCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const diffHintCounts: Record<number, number> = {};

  while (offset < total) {
    const batch = await sql<QRow[]>`
      SELECT id, question_type, content_markdown, event_subtest, answer_key
      FROM questions
      WHERE deleted_at IS NULL AND question_type != 'stimulus'
      ORDER BY created_at
      LIMIT ${BATCH_SIZE} OFFSET ${offset}
    `;
    offset += batch.length;

    for (const q of batch) {
      const tags: string[] = [];

      // ── 1) Tipe soal ──────────────────────────────────────────────────
      let typSlug: string;
      switch (q.question_type) {
        case "single_choice":
          typSlug = "pilihan_ganda"; break;
        case "multiple_choice_checkbox":
          typSlug = "pilihan_ganda_kompleks"; break;
        case "essay":
          typSlug = "essay"; break;
        case "matrix_grid":
          typSlug = "matrix_grid"; break;
        default:
          typSlug = "lainnya";
      }
      tags.push(typSlug);
      typeCounts[typSlug] = (typeCounts[typSlug] ?? 0) + 1;

      // ── 2) Bloom kognitif ─────────────────────────────────────────────
      const bloomLevel = classifyBloom(q.content_markdown);
      const bloomSlug = `kognitif_${bloomLevel}_${
        bloomLevel === "C1" ? "ingatan" :
        bloomLevel === "C2" ? "pemahaman" :
        bloomLevel === "C3" ? "aplikasi" :
        bloomLevel === "C4" ? "analisis" :
        bloomLevel === "C5" ? "evaluasi" : "kreasi"
      }`;
      tags.push(bloomSlug);
      bloomCounts[bloomSlug] = (bloomCounts[bloomSlug] ?? 0) + 1;

      // ── 3) Difficulty hint ────────────────────────────────────────────
      const explanationLength =
        typeof q.answer_key?.explanation === "string"
          ? (q.answer_key.explanation as string).length
          : 0;
      const diffHint = estimateDifficultyHint(q.content_markdown, q.event_subtest, explanationLength);
      const diffSlug = `difficulty_hint_${diffHint}`;
      tags.push(diffSlug);
      diffHintCounts[diffHint] = (diffHintCounts[diffHint] ?? 0) + 1;

      // Add inserts
      for (const slug of tags) {
        const tagId = tagIdMap.get(slug);
        if (tagId) tagInserts.push({ questionId: q.id, tagId });
      }
    }

    process.stdout.write(`\r  Progress: ${Math.min(offset, total)}/${total}`);
  }

  console.log(`\n\nTag distribution:`);
  console.log("Tipe Soal:");
  for (const [slug, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(6)}  ${slug}`);
  }
  console.log("Bloom Kognitif:");
  for (const [slug, count] of Object.entries(bloomCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(6)}  ${slug}`);
  }
  console.log("Difficulty Hints:");
  for (const [level, count] of Object.entries(diffHintCounts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  ${count.toString().padStart(6)}  difficulty_hint_${level}`);
  }

  const bloomTotal = Object.values(bloomCounts).reduce((a, b) => a + b, 0);
  const bloomCoverage = ((bloomTotal / total) * 100).toFixed(1);
  console.log(`\nBloom coverage: ${bloomCoverage}% (${bloomTotal}/${total})`);

  if (!DRY_RUN) {
    console.log(`\nInserting ${tagInserts.length} entri ke question_tags...`);

    // Hapus tag lama (tipe, bloom, difficulty hint)
    const slugsToDelete = TAG_DEFS.map((t) => t.slug);
    const tagIdsToDelete = slugsToDelete
      .map((s) => tagIdMap.get(s))
      .filter(Boolean) as string[];

    if (tagIdsToDelete.length > 0) {
      await sql`
        DELETE FROM question_tags
        WHERE tag_id = ANY(${tagIdsToDelete})
      `;
      console.log(`  Deleted existing auto-tags`);
    }

    // Insert in batches
    const batchSize = 1000;
    for (let i = 0; i < tagInserts.length; i += batchSize) {
      const chunk = tagInserts.slice(i, i + batchSize);
      await sql`
        INSERT INTO question_tags ${sql(chunk.map((r) => ({
          question_id: r.questionId,
          tag_id: r.tagId,
        })))}
        ON CONFLICT (question_id, tag_id) DO NOTHING
      `;
      process.stdout.write(`\r  Insert: ${Math.min(i + batchSize, tagInserts.length)}/${tagInserts.length}`);
    }

    // Update usage_count
    await sql`
      UPDATE tags t
      SET usage_count = sub.cnt
      FROM (
        SELECT tag_id, COUNT(*) as cnt FROM question_tags GROUP BY tag_id
      ) sub
      WHERE t.id = sub.tag_id
    `;

    // Update ai_tagged flag
    await sql`
      UPDATE questions
      SET ai_tagged = true, ai_tagged_at = NOW()
      WHERE deleted_at IS NULL AND question_type != 'stimulus'
    `;

    console.log(`\n\nVerifikasi:`);
    const verif = await sql`
      SELECT t.slug, t.name, COUNT(qt.question_id) as cnt
      FROM tags t
      LEFT JOIN question_tags qt ON t.id = qt.tag_id
      WHERE t.slug IN (
        'pilihan_ganda', 'essay', 'matrix_grid', 'lainnya', 'pilihan_ganda_kompleks',
        'kognitif_C1_ingatan', 'kognitif_C2_pemahaman', 'kognitif_C3_aplikasi',
        'kognitif_C4_analisis', 'kognitif_C5_evaluasi', 'kognitif_C6_kreasi'
      )
      GROUP BY t.slug, t.name
      ORDER BY cnt DESC
    `;
    for (const row of verif) {
      console.log(`  ${String(row.cnt).padStart(6)}  ${row.slug}`);
    }
  } else {
    console.log("\n[DRY RUN] Tidak ada perubahan ke DB.");
    console.log(`  Akan membuat ${tagInserts.length} entri di question_tags`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
