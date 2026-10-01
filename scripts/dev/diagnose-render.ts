/**
 * Diagnosa render: uji tokenizer MathContent pada teks soal NYATA dari DB.
 * Membandingkan hasil tokenisasi vs yang terlihat di browser.
 */
import { config } from "dotenv";

config({ path: ".env" });

async function main() {
  const { db } = await import("../../src/lib/db");
  const { questions } = await import("../../src/lib/db/schema/question");
  const { tokenizeMath } = await import("../../src/components/math/math-content");
  const { eq } = await import("drizzle-orm");

  const ids = process.argv.slice(2);
  if (!ids.length) {
    console.error("Pemakaian: pnpm tsx scripts/dev/diagnose-render.ts <id-soal>...");
    process.exit(1);
  }

  for (const id of ids) {
    const [q] = await db
      .select({ content: questions.contentMarkdown })
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);
    if (!q) {
      console.log(`\n### ${id} — TIDAK DITEMUKAN`);
      continue;
    }

    const tokens = tokenizeMath(q.content);
    console.log(`\n### ${id}`);
    console.log(`Teks (${q.content.length} char):`);
    console.log(
      q.content
        .split("\n")
        .map((l, i) => `  ${i + 1}| ${l}`)
        .join("\n"),
    );
    console.log(`\nToken (${tokens.length}):`);
    for (const t of tokens) {
      if (t.kind === "text") {
        const v = t.value.replace(/\n/g, "\\n");
        console.log(`  [teks] ${v.length > 70 ? v.slice(0, 70) + "…" : v}`);
      } else if (t.kind === "math") {
        const v = t.value.replace(/\n/g, "\\n");
        console.log(`  [RUMUS${t.display ? " display" : ""}] ${v.length > 70 ? v.slice(0, 70) + "…" : v}`);
      } else {
        console.log(`  [gambar] ${t.shortId}`);
      }
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
