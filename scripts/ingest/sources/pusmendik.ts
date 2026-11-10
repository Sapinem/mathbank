/**
 * Ingest korpus Pusmendik (TKA & Daya Serap) ke Gateway Kanonik MathBank.
 *
 * Penggunaan:
 *   pnpm tsx --env-file=.env scripts/ingest/sources/pusmendik.ts [--kind tka|dayaserap] [--dry] [--direct]
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pusmendikTkaAdapter } from "@/lib/ingest/parsers/adapters/pusmendik-tka";
import { pusmendikDayaserapAdapter } from "@/lib/ingest/parsers/adapters/pusmendik-dayaserap";
import { parsedItemToCanonical, runIngestBatch } from "../runner";

const CORPORA_ROOT = "/home/hari/projects/qbank/data/corpora";

async function ingestDayaserap(options: { dry?: boolean; direct?: boolean; limit?: number }) {
  const dir = join(CORPORA_ROOT, "pusmendik_dayaserap");
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    console.error(`❌ Direktori korpus dayaserap tidak ditemukan: ${dir}`);
    return;
  }

  const selected = options.limit ? files.slice(0, options.limit) : files;
  console.log(`📂 [pusmendik_dayaserap] Memproses ${selected.length} berkas...`);

  for (const f of selected) {
    const raw = await readFile(join(dir, f), "utf8");
    const json = JSON.parse(raw);

    const segment = pusmendikDayaserapAdapter(json, {
      source: "pusmendik_dayaserap",
      title: f.replace(/\.json$/, ""),
    });

    const canonicalItems = segment.items.map(parsedItemToCanonical);

    await runIngestBatch(
      {
        sourceName: "pusmendik_dayaserap",
        sourceUrl: null,
        bundleTitle: `Pusmendik Daya Serap - ${f.replace(/\.json$/, "")}`,
        bundleUrl: null,
        grade: null,
        items: canonicalItems,
      },
      options,
    );
  }
}

async function ingestTka(options: { dry?: boolean; direct?: boolean; limit?: number }) {
  const dir = join(CORPORA_ROOT, "pusmendik_tka");
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    console.error(`❌ Direktori korpus tka tidak ditemukan: ${dir}`);
    return;
  }

  const selected = options.limit ? files.slice(0, options.limit) : files;
  console.log(`📂 [pusmendik_tka] Memproses ${selected.length} berkas...`);

  for (const f of selected) {
    const raw = await readFile(join(dir, f), "utf8");
    const article = JSON.parse(raw);

    const segment = pusmendikTkaAdapter(article.rawHtml, {
      source: "pusmendik_tka",
      title: article.title || f,
      url: article.url,
    });

    const canonicalItems = segment.items.map(parsedItemToCanonical);

    await runIngestBatch(
      {
        sourceName: "pusmendik_tka",
        sourceUrl: article.url || null,
        bundleTitle: `Pusmendik TKA - ${article.title || f}`,
        bundleUrl: article.url || null,
        grade: null,
        items: canonicalItems,
      },
      options,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const direct = args.includes("--direct");

  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : undefined;

  const kindIdx = args.indexOf("--kind");
  const kind = kindIdx !== -1 ? args[kindIdx + 1] : "all";

  if (kind === "dayaserap" || kind === "all") {
    await ingestDayaserap({ dry, direct, limit });
  }
  if (kind === "tka" || kind === "all") {
    await ingestTka({ dry, direct, limit });
  }
}

if (process.argv[1]?.endsWith("pusmendik.ts")) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
