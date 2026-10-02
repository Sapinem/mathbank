/**
 * Ingest korpus nyata dari qbank → MathBank (sekali pakai).
 *
 * Alur resmi: upload (antrean) → commit (segmentasi + parse + soal + bundle).
 * Melewati SERVICE, bukan HTTP, supaya bisa dijalankan sebagai skrip batch —
 * otorisasi tetap lewat `actor` yang sama seperti route pakai.
 *
 * Jalankan: pnpm tsx --env-file=.env scripts/ingest-corpus.ts [jumlah]
 *   contoh: pnpm tsx --env-file=.env scripts/ingest-corpus.ts 3
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Actor } from "../src/lib/auth/actor";

const CORPUS_ROOT = "/home/hari/projects/qbank/data/corpora";
const CORPUS_SOURCE = "mathcyber";
const LIMIT = Number(process.argv[2] ?? 1);

/** Aktor mesin — sama seperti yang dipakai route ingest (`permission` apikey). */
const MACHINE: Actor = {
  id: "ingest-script",
  name: "Ingest Korpus",
  roles: ["machine"],
  via: "system",
};

interface CorpusFile {
  url: string;
  slug: string;
  title: string;
  rawHtml: string;
}

/** Dekode entitas HTML umum pada judul (mis. `&#8211;` → `–`). */
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

async function ingestCorpus() {
  const { enqueue, listPending } = await import("../src/lib/ingest/queue");
  const { processQueueItem } = await import("../src/lib/ingest/service");
  const { mediaStorageRoot } = await import("../src/lib/ingest/config");

  const dir = join(CORPUS_ROOT, CORPUS_SOURCE);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  console.log(`Korpus ${CORPUS_SOURCE}: ${files.length} artikel — mengambil ${LIMIT}\n`);

  const picked = files.slice(0, LIMIT);

  // ── 1) UPLOAD ke antrean ───────────────────────────────────────
  const ids: string[] = [];
  for (const f of picked) {
    const raw = await readFile(join(dir, f), "utf8");
    const data = JSON.parse(raw) as CorpusFile;
    const res = await enqueue({
      title: decodeEntities(data.title).slice(0, 255),
      sourceOrigin: CORPUS_SOURCE,
      sourceUrl: data.url,
      rawContent: data.rawHtml,
      rawFormat: "html",
      slug: data.slug,
      targetGrade: null,
      targetTopicId: null,
    });
    ids.push(res.id);
    console.log(`  ↑ antre: ${decodeEntities(data.title).slice(0, 70)}…`);
  }

  // ── 2) COMMIT (pending → soal) ─────────────────────────────────
  const { items } = await listPending(ids);
  console.log(`\nMemproses ${items.length} antrean…`);
  const root = mediaStorageRoot();

  for (const item of items) {
    const r = await processQueueItem(item, {
      actor: MACHINE,
      mediaRoot: root,
      mediaDelayMs: 0,
      grade: null,
    });
    console.log(
      `  → ${r.status}: soal dibuat ${r.created}, dilewati ${r.skipped}, ` +
        `media ${r.mediaOk}/${r.mediaOk + r.mediaFailed}` +
        (r.error ? ` | galat: ${r.error}` : ""),
    );
  }

  process.exit(0);
}
ingestCorpus();
