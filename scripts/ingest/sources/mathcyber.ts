/**
 * Ingest korpus MathCyber1997 ke Gateway Kanonik MathBank.
 *
 * Penggunaan:
 *   pnpm tsx --env-file=.env scripts/ingest/sources/mathcyber.ts --limit 3 [--dry] [--direct]
 *   pnpm tsx --env-file=.env scripts/ingest/sources/mathcyber.ts <slug> [...] [--dry]
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { mathcyberAdapter } from "@/lib/ingest/parsers/adapters/mathcyber";
import { parsedItemToCanonical, runIngestBatch } from "../runner";

const CORPUS_DIR = "/home/hari/projects/qbank/data/corpora/mathcyber";
const SOURCE_NAME = "mathcyber";
const SOURCE_URL = "https://mathcyber1997.com";

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

  const slugs = args.filter(
    (a, idx) =>
      !a.startsWith("--") &&
      (idx === 0 || args[idx - 1] !== "--limit"),
  );

  let files: string[] = [];
  try {
    files = (await readdir(CORPUS_DIR)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    console.error(`❌ Direktori korpus tidak ditemukan: ${CORPUS_DIR}`);
    process.exit(1);
  }

  let selectedFiles = files;
  if (slugs.length > 0) {
    selectedFiles = files.filter((f) => slugs.some((s) => f.includes(s)));
  } else if (limit) {
    selectedFiles = files.slice(0, limit);
  }

  console.log(
    `📂 [mathcyber] Memproses ${selectedFiles.length} artikel korpus...`,
  );

  for (const file of selectedFiles) {
    const raw = await readFile(join(CORPUS_DIR, file), "utf8");
    const article = JSON.parse(raw) as CorpusArticle;

    const segment = mathcyberAdapter(article.rawHtml, {
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

if (process.argv[1]?.endsWith("mathcyber.ts")) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
