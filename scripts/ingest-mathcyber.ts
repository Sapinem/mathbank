/**
 * Ingest artikel mathcyber secara DETERMINISTIK (pilih berdasarkan NAMA).
 *
 * Beda dari `ingest-corpus.ts` yang mengambil N artikel pertama menurut
 * urutan abjad — skrip ini menerima **daftar nama artikel**, jadi hasilnya
 * dapat diprediksi & diulang.
 *
 * Jalankan:
 *   pnpm tsx --env-file=.env scripts/ingest-mathcyber.ts <slug> [<slug> …]
 *   pnpm tsx --env-file=.env scripts/ingest-mathcyber.ts --dry <slug> […]
 *
 * `--dry` hanya MEMPRATINJAU (tak menyimpan apa pun) — menampilkan jumlah soal,
 * kunci yang berhasil diekstrak, & sampel stem. Ini yang mencegah kita
 * memuat data mentah tanpa sadar (pelajaran 177 soal yang lalu).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Actor } from "../src/lib/auth/actor";

const CORPUS = "/home/hari/projects/qbank/data/corpora/mathcyber";
const SOURCE = "mathcyber";

interface CorpusFile {
  url: string;
  slug: string;
  title: string;
  rawHtml: string;
}

/** Aktor mesin — sama seperti yang dipakai jalur ingest produksi. */
const MACHINE: Actor = {
  id: "ingest-mathcyber",
  name: "Ingest MathCyber",
  roles: ["machine"],
  via: "system",
};

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

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i !== -1 ? (process.argv[i + 1] ?? "") : null;
}

async function ingestMathcyber() {
  const dry = process.argv.includes("--dry");
  const slugs = process.argv
    .slice(2)
    .filter((a) => !a.startsWith("--") && a !== arg("--"));

  if (slugs.length === 0) {
    console.error(
      "Pemakaian: pnpm tsx --env-file=.env scripts/ingest-mathcyber.ts [--dry] <slug> [<slug> …]",
    );
    process.exit(1);
  }

  // Muat berkas korpus lebih dulu (dipakai untuk pratinjau & ingest).
  const files: { slug: string; data: CorpusFile; title: string }[] = [];
  for (const slug of slugs) {
    const raw = await readFile(join(CORPUS, `${slug}.json`), "utf8");
    const data = JSON.parse(raw) as CorpusFile;
    files.push({ slug, data, title: decodeEntities(data.title) });
  }

  // ── PRATINJAU (--dry): parse tanpa menyimpan ─────────────────────
  if (dry) {
    const { mathcyberAdapter } = await import(
      "../src/lib/ingest/parsers/adapters/mathcyber"
    );
    console.log("MODE PRATINJAU — tak ada yang disimpan\n");
    for (const f of files) {
      const res = mathcyberAdapter(f.data.rawHtml);
      const withKey = res.items.filter((i) => i.correct.length > 0);
      const flagged = res.items.filter((i) => i.warnings.length > 0);
      console.log(`▸ ${f.slug}`);
      console.log(`  judul  : ${f.title.slice(0, 70)}`);
      console.log(
        `  soal   : ${res.items.length} | berkunci: ${withKey.length} | ditandai: ${flagged.length}`,
      );
      for (const it of res.items.slice(0, 2)) {
        console.log(
          `  contoh : [kunci ${it.correct.join(",") || "-"}] ${it.stem.slice(0, 90).replace(/\s+/g, " ")}`,
        );
      }
      console.log();
    }
    console.log("Jalankan tanpa --dry untuk menyimpan.");
    process.exit(0);
  }

  // ── INGEST NYATA: enqueue → process (jalur produksi) ─────────────
  const { enqueue, listPending } = await import("../src/lib/ingest/queue");
  const { processQueueItem } = await import("../src/lib/ingest/service");
  const { mediaStorageRoot } = await import("../src/lib/ingest/config");

  const ids: string[] = [];
  for (const f of files) {
    const res = await enqueue({
      title: f.title.slice(0, 255),
      sourceOrigin: SOURCE,
      sourceUrl: f.data.url,
      rawContent: f.data.rawHtml,
      rawFormat: "html",
      slug: f.data.slug,
      targetGrade: null,
      targetTopicId: null,
    });
    ids.push(res.id);
    console.log(`↑ antre: ${f.title.slice(0, 66)}${res.deduped ? " (sudah ada)" : ""}`);
  }

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
      `  → ${r.status}: soal ${r.created}, dilewati ${r.skipped}, ` +
        `media ${r.mediaOk}/${r.mediaOk + r.mediaFailed}` +
        (r.error ? ` | galat: ${r.error}` : ""),
    );
  }
  process.exit(0);
}
ingestMathcyber();
