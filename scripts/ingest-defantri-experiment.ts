/**
 * Ingest eksperimental 10 artikel Defantri ke MathBank (MAT-52).
 *
 * Menggunakan pipeline resmi:
 *   enqueue() → processQueueItem() → commit ke DB
 *
 * 9 artikel dari korpus lokal qbank, 1 artikel (URL #4) diunduh langsung.
 * Idempoten: enqueue() skip artikel yang sudah ada (hash rawContent cocok).
 *
 * Jalankan:
 *   pnpm --dir /home/hari/projects/mathbank exec tsx --env-file=.env \
 *     scripts/ingest-defantri-experiment.ts
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Actor } from "../src/lib/auth/actor";

const CORPUS_ROOT = "/home/hari/projects/qbank/data/corpora/defantri";
const SOURCE = "defantri";

/** Aktor mesin — sama seperti jalur ingest produksi. */
const MACHINE: Actor = {
  id: "ingest-defantri-experiment",
  name: "Ingest Defantri Experiment",
  roles: ["machine"],
  via: "system",
};

interface CorpusFile {
  url: string;
  slug: string;
  title: string;
  rawHtml: string;
}

/** Dekode entitas HTML umum (mis. `&#8211;` → `–`). */
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

/** Unduh HTML artikel langsung dari URL (untuk artikel tanpa korpus lokal). */
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MathBankIngest/1.0; +https://math.my.id)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} saat mengambil ${url}`);
  return res.text();
}

/** Daftar 10 artikel target. */
interface ArticleTarget {
  /** Judul untuk display. */
  label: string;
  /** URL asli artikel. */
  url: string;
  /** File JSON lokal (null = unduh langsung). */
  localFile: string | null;
  /** Jenjang sekolah. */
  level: "SMA" | "SMP";
  /** Perkiraan kelas (untuk targetGrade). */
  grade: string;
}

const TARGETS: ArticleTarget[] = [
  // SMA — 5 artikel
  {
    label: "TKA SMA Mat Wajib 2025-09",
    url: "https://www.defantri.com/2025/09/soal-tka-sma-matematika-wajib.html",
    localFile: "2025-09-soal-tka-sma-matematika-wajib.json",
    level: "SMA",
    grade: "11",
  },
  {
    label: "TKA SMA Mat Wajib 2024-10",
    url: "https://www.defantri.com/2024/10/contoh-soal-tka-sma-matematika-wajib.html",
    localFile: "2024-10-contoh-soal-tka-sma-matematika-wajib.json",
    level: "SMA",
    grade: "11",
  },
  {
    label: "Statistika SMA 2024-08",
    url: "https://www.defantri.com/2024/08/soal-dan-pembahasan-statistika-sma.html",
    localFile: "2024-08-soal-dan-pembahasan-statistika-sma.json",
    level: "SMA",
    grade: "12",
  },
  {
    // URL #4 — tidak ada di korpus lokal, unduh langsung.
    // Artikel 2014: uji kompetensi eksponen — kemungkinan besar artikel
    // uraian/statis tanpa radio group (akan di-skip oleh adapter).
    label: "Uji Kompetensi Eksponen Kur-2013 (SMA 2014)",
    url: "https://www.defantri.com/2014/06/uji-kompetensi-eksponen-kurikulum-2013.html",
    localFile: null,
    level: "SMA",
    grade: "10",
  },
  {
    label: "Penalaran Matematika PM UTBK 2025-04",
    url: "https://www.defantri.com/2025/04/soal-dan-pembahasan-penalaran-matematika.html",
    localFile: "2025-04-soal-dan-pembahasan-penalaran-matematika.json",
    level: "SMA",
    grade: "12",
  },
  // SMP — 5 artikel
  {
    label: "PAS Genap SMP Kelas 7 2023-04",
    url: "https://www.defantri.com/2023/04/soal-pas-genap-matematika-smp-7.html",
    localFile: "2023-04-soal-pas-genap-matematika-smp-7.json",
    level: "SMP",
    grade: "7",
  },
  {
    label: "PAS Genap SMP Kelas 8 2023-04",
    url: "https://www.defantri.com/2023/04/soal-pas-genap-matematika-smp-8.html",
    localFile: "2023-04-soal-pas-genap-matematika-smp-8.json",
    level: "SMP",
    grade: "8",
  },
  {
    label: "Eksponen & Bentuk Akar SMP 2022-01",
    url: "https://www.defantri.com/2022/01/pembahasan-eksponen-dan-bentuk-akar-matematika-smp.html",
    localFile: "2022-01-pembahasan-eksponen-dan-bentuk-akar-matematika-smp.json",
    level: "SMP",
    grade: "9",
  },
  {
    label: "Aritmetika Sosial SMP 2022-01",
    url: "https://www.defantri.com/2022/01/pembahasan-aritmetika-sosial-matematika-smp.html",
    localFile: "2022-01-pembahasan-aritmetika-sosial-matematika-smp.json",
    level: "SMP",
    grade: "7",
  },
  {
    label: "Soal Matematika SMP OSN-K 2024-02",
    url: "https://www.defantri.com/2024/02/pembahasan-soal-matematika-smp.html",
    localFile: "2024-02-pembahasan-soal-matematika-smp.json",
    level: "SMP",
    grade: "9",
  },
];

async function loadArticle(
  target: ArticleTarget,
): Promise<{ title: string; url: string; rawHtml: string; slug: string | null }> {
  if (target.localFile) {
    const raw = await readFile(join(CORPUS_ROOT, target.localFile), "utf8");
    const data = JSON.parse(raw) as CorpusFile;
    return {
      title: decodeEntities(data.title),
      url: data.url,
      rawHtml: data.rawHtml,
      slug: data.slug,
    };
  }
  // Unduh langsung (URL #4)
  console.log(`  → Mengunduh ${target.url} …`);
  const rawHtml = await fetchHtml(target.url);
  return {
    title: target.label,
    url: target.url,
    rawHtml,
    slug: null,
  };
}

async function ingestDefantriExperiment() {
  const startTime = Date.now();

  const { enqueue, listPending } = await import("../src/lib/ingest/queue");
  const { processQueueItem } = await import("../src/lib/ingest/service");
  const { mediaStorageRoot } = await import("../src/lib/ingest/config");
  // Tidak ada closeDb eksplisit — process.exit(0) menutup pool secara implisit.
  // postgres.js mencegah garbage-collection pool sehingga proses tidak bisa exit
  // tanpa pemanggilan process.exit() yang eksplisit (ada di akhir fungsi).

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   INGEST DEFANTRI EXPERIMENT — MAT-52                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`Target: ${TARGETS.length} artikel (${TARGETS.filter((t) => t.level === "SMA").length} SMA, ${TARGETS.filter((t) => t.level === "SMP").length} SMP)\n`);

  // ── FASE 1: LOAD & ENQUEUE ──────────────────────────────────────────
  console.log("▶ FASE 1: Memuat dan memasukkan ke antrean…\n");
  const ids: string[] = [];
  const deduped: string[] = [];

  for (let i = 0; i < TARGETS.length; i++) {
    const target = TARGETS[i]!;
    const no = i + 1;
    try {
      const article = await loadArticle(target);
      const res = await enqueue({
        title: article.title.slice(0, 255),
        sourceOrigin: SOURCE,
        sourceUrl: article.url,
        rawContent: article.rawHtml,
        rawFormat: "html",
        targetGrade: target.grade,
        targetTopicId: null,
      });

      ids.push(res.id);
      if (res.deduped) deduped.push(res.id);

      const marker = res.deduped ? " (SUDAH ADA — skip)" : "";
      console.log(`  [${no}/10] ${target.level} | ${target.grade} | ↑ ${article.title.slice(0, 65)}${marker}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  [${no}/10] GAGAL memuat/enqueue "${target.label}": ${msg}`);
    }
  }

  // ── FASE 2: PROSES ANTREAN ─────────────────────────────────────────
  console.log(`\n▶ FASE 2: Memproses ${ids.length} antrean…\n`);
  const { items, nonPending } = await listPending(ids);

  if (nonPending.length > 0) {
    console.log(`  Info: ${nonPending.length} item sudah diproses sebelumnya (idempoten).\n`);
  }

  const root = mediaStorageRoot();
  // Shared media cache agar gambar sama tidak diunduh ulang lintas-artikel.
  const mediaCache = new Map();

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalMediaOk = 0;
  let totalMediaFailed = 0;
  const results: Array<{
    label: string;
    status: string;
    created: number;
    skipped: number;
    error?: string;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    // Temukan label dari target
    const target = TARGETS.find((t) => t.url === item.sourceUrl) ?? { label: item.title };
    console.log(`  [${i + 1}/${items.length}] Memproses: ${item.title.slice(0, 65)}…`);

    const r = await processQueueItem(item, {
      actor: MACHINE,
      mediaRoot: root,
      mediaCache,
      mediaDelayMs: 100, // hormati sumber, jeda 100ms antar-unduhan
      grade: item.targetGrade,
    });

    totalCreated += r.created;
    totalSkipped += r.skipped;
    totalMediaOk += r.mediaOk;
    totalMediaFailed += r.mediaFailed;

    results.push({
      label: target.label,
      status: r.status,
      created: r.created,
      skipped: r.skipped,
      error: r.error,
    });

    const mark =
      r.status === "completed" ? "✓" : r.status === "skipped" ? "⊘" : "✗";
    console.log(
      `         ${mark} ${r.status}: soal +${r.created}, dilewati ${r.skipped}, media ${r.mediaOk}/${r.mediaOk + r.mediaFailed}` +
        (r.error ? ` | ${r.error.slice(0, 80)}` : ""),
    );
  }

  // ── LAPORAN AKHIR ──────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const successes = results.filter((r) => r.status === "completed");
  const skips = results.filter((r) => r.status === "skipped");
  const failures = results.filter((r) => r.status === "failed");

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   LAPORAN EKSEKUSI INGEST DEFANTRI                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Artikel diproses    : ${items.length}/${TARGETS.length}`);
  console.log(`  Artikel sukses      : ${successes.length}`);
  console.log(`  Artikel dilewati    : ${skips.length} (tanpa soal/radio grup)`);
  console.log(`  Artikel gagal       : ${failures.length}`);
  console.log(`  Total soal ke DB    : ${totalCreated}`);
  console.log(`  Soal dideduplikasi  : ${totalSkipped}`);
  console.log(`  Media OK / gagal    : ${totalMediaOk} / ${totalMediaFailed}`);
  console.log(`  Waktu eksekusi      : ${elapsed}s`);
  console.log(`  Pool leak guard     : process.exit(0) dipanggil eksplisit\n`);

  console.log("  Rincian per-artikel:");
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const mark =
      r.status === "completed" ? "✓" : r.status === "skipped" ? "⊘" : "✗";
    console.log(
      `    [${i + 1}] ${mark} ${r.status.padEnd(9)} +${String(r.created).padStart(3)} soal | ${r.label.slice(0, 55)}` +
        (r.error ? ` | ERR: ${r.error.slice(0, 60)}` : ""),
    );
  }

  if (failures.length > 0) {
    console.log("\n  [!] Ada artikel gagal — periksa log di atas.");
    process.exit(1);
  }

  // process.exit(0) menghentikan event-loop postgres.js (zero pool leak).
  process.exit(0);
}

ingestDefantriExperiment().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
