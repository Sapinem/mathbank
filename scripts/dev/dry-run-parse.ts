/**
 * Uji parser pada HTML mentah — TANPA menyentuh DB.
 *
 * Berguna sebelum ingest: memastikan adapter mengenali soal & kunci dengan benar,
 * sehingga kita tahu berapa yang akan masuk dan berapa yang bermasalah.
 *
 * Pemakaian: pnpm tsx scripts/dev/dry-run-parse.ts /tmp/corpus/mathcyber.html mathcyber
 */
import { readFile } from "node:fs/promises";

async function dryRunParse() {
  const [file, adapterName] = process.argv.slice(2);
  if (!file || !adapterName) {
    console.error("Pemakaian: pnpm tsx scripts/dev/dry-run-parse.ts <berkas.html> <mathcyber|defantri>");
    process.exit(1);
  }

  const html = await readFile(file, "utf8");
  const { HTML_ADAPTERS } = await import("../../src/lib/ingest/parsers/adapters");
  const adapter = HTML_ADAPTERS[adapterName];
  if (!adapter) {
    console.error(
      `Adapter tak dikenal: ${adapterName}. Tersedia: ${Object.keys(HTML_ADAPTERS).join(", ")}`,
    );
    process.exit(1);
  }

  const res = adapter(html, { source: adapterName, url: file });

  console.log(`=== ${adapterName} ===`);
  console.log(`Berkas        : ${file} (${(html.length / 1024).toFixed(0)} KB)`);
  console.log(`Soal terbaca  : ${res.items.length}`);
  console.log(`Dilewati      : ${res.skipped}`);
  console.log(`Peringatan    : ${res.warnings.length}`);

  if (res.warnings.length) {
    console.log("\nPeringatan (maks 8):");
    for (const w of res.warnings.slice(0, 8)) console.log(`  ! ${w}`);
  }

  console.log("\nContoh soal (maks 4):");
  for (const it of res.items.slice(0, 4)) {
    const stem = it.stem.replace(/\s+/g, " ").slice(0, 88);
    const kunci = it.correct.length ? it.correct.join(",") : "(TAK ADA)";
    console.log(`\n  [${it.type}] ${stem}…`);
    console.log(
      `    opsi: ${it.options.length} | kunci: ${kunci} | pembahasan: ${it.explanation ? "ada" : "tidak"}`,
    );
    if (it.warnings.length) console.log(`    catatan: ${it.warnings.join("; ")}`);
  }

  const byType: Record<string, number> = {};
  for (const it of res.items) byType[it.type] = (byType[it.type] ?? 0) + 1;
  console.log("\nSebaran tipe  :", JSON.stringify(byType));

  const withKey = res.items.filter((i) => i.correct.length > 0).length;
  const withExpl = res.items.filter((i) => i.explanation).length;
  console.log(`Punya kunci   : ${withKey}/${res.items.length}`);
  console.log(`Punya bahas   : ${withExpl}/${res.items.length}`);
}

dryRunParse().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
