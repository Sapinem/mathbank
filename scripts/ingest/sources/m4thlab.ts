/**
 * Ingest korpus m4th-lab ke Gateway Kanonik MathBank.
 *
 * Penggunaan:
 *   pnpm tsx --env-file=.env scripts/ingest/sources/m4thlab.ts --limit 3 [--dry] [--direct]
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { m4thlabAdapter } from "@/lib/ingest/parsers/adapters/m4thlab";
import { parsedItemToCanonical, runIngestBatch } from "../runner";

const CORPUS_DIR = "/home/hari/projects/qbank/data/corpora/m4thlab";
const SOURCE_NAME = "m4thlab";
const SOURCE_URL = "https://www.m4th-lab.net";

interface CorpusArticle {
  url: string;
  slug: string;
  title: string;
  rawHtml: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const direct = args.includes("--direct");

  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : undefined;

  let files: string[] = [];
  try {
    files = (await readdir(CORPUS_DIR)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    console.error(`❌ Direktori korpus tidak ditemukan: ${CORPUS_DIR}`);
    process.exit(1);
  }

  const selectedFiles = limit ? files.slice(0, limit) : files;
  console.log(
    `📂 [m4thlab] Memproses ${selectedFiles.length} artikel korpus...`,
  );

  for (const file of selectedFiles) {
    const raw = await readFile(join(CORPUS_DIR, file), "utf8");
    const article = JSON.parse(raw) as CorpusArticle;

    const segment = m4thlabAdapter(article.rawHtml, {
      source: SOURCE_NAME,
      url: article.url,
      title: article.title,
    });

    const canonicalItems = segment.items.map(parsedItemToCanonical);

    await runIngestBatch(
      {
        sourceName: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        bundleTitle: decodeEntities(article.title),
        bundleUrl: article.url,
        grade: null,
        items: canonicalItems,
      },
      { dry, direct },
    );
  }
}

if (process.argv[1]?.endsWith("m4thlab.ts")) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
