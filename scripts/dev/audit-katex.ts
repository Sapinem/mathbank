/**
 * Uji render KaTeX NYATA pada seluruh soal.
 *
 * Berbeda dari audit pola teks: di sini setiap token rumus benar-benar
 * di-render lewat KaTeX. Kalau KaTeX melempar, browser akan menampilkan
 * tanda merah "KaTeX parse error" — inilah yang paling mungkin dilihat guru.
 */
import { config } from "dotenv";

config({ path: ".env" });

async function main() {
  const { db } = await import("../../src/lib/db");
  const { questions } = await import("../../src/lib/db/schema/question");
  const { sources } = await import("../../src/lib/db/schema/source");
  const { bundles, bundleItems } = await import("../../src/lib/db/schema/bundle");
  const { tokenizeMath } = await import("../../src/components/math/math-content");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({
      id: questions.id,
      content: questions.contentMarkdown,
      answerKey: questions.answerKey,
      sumber: sources.label,
    })
    .from(questions)
    .leftJoin(bundleItems, eq(bundleItems.questionId, questions.id))
    .leftJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .leftJoin(sources, eq(sources.id, bundles.sourceId));

  const katex = (await import("katex")).default;

  let totalRumus = 0;
  const gagal: { id: string; sumber: string; expr: string; pesan: string }[] = [];
  let adaGambar = 0;

  for (const r of rows) {
    const eks = (r.answerKey as { explanation?: string } | null)?.explanation;
    const teks = [r.content, eks ?? ""];

    for (const t of teks) {
      if (!t) continue;
      for (const tok of tokenizeMath(t)) {
        if (tok.kind === "img") {
          adaGambar++;
          continue;
        }
        if (tok.kind !== "math") continue;
        totalRumus++;
        try {
          katex.renderToString(tok.value, { displayMode: tok.display, throwOnError: true });
        } catch (e) {
          gagal.push({
            id: r.id,
            sumber: r.sumber ?? "-",
            expr: tok.value.replace(/\n/g, " ").slice(0, 70),
            pesan: (e instanceof Error ? e.message : String(e)).slice(0, 90),
          });
        }
      }
    }
  }

  console.log(`Soal diperiksa   : ${rows.length}`);
  console.log(`Rumus ter-render : ${totalRumus}`);
  console.log(`Gambar tersisip  : ${adaGambar}`);
  console.log(`Rumus GAGAL      : ${gagal.length}\n`);

  if (gagal.length) {
    console.log("Contoh kegagalan KaTeX (maks 10):");
    for (const g of gagal.slice(0, 10)) {
      console.log(`  ✗ ${g.id} [${g.sumber}]`);
      console.log(`     rumus: ${g.expr}`);
      console.log(`     sebab: ${g.pesan}`);
    }
    const soalUnik = new Set(gagal.map((g) => g.id));
    console.log(`\nSoal terdampak: ${soalUnik.size}`);
  } else {
    console.log("✓ Semua rumus ter-render tanpa galat.");
  }
  process.exit(gagal.length ? 1 : 0);
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
