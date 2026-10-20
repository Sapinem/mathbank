/**
 * batch-embed-questions.ts — ACT-07 (Sprint 1).
 *
 * Mengisi `questions.embedding` (pgvector 1024-dim) untuk seluruh soal yang
 * belum punya embedding, memakai service BGE-M3 lokal
 * (`POST {BGE_M3_SERVICE_URL}/v1/embeddings`).
 *
 * Sifat:
 *   - **Resumable**: selalu `WHERE embedding IS NULL` → aman dimatikan/dijalankan
 *     ulang; tidak mengulang vektor yang sudah ada.
 *   - **Idempotent per soal**: `embedding_content_hash` disimpan bersama vektor
 *     sehingga soal yang kontennya berubah bisa di-embed ulang secara selektif.
 *   - **Fail-soft**: satu batch gagal → dipecah & dicoba ulang; satu soal gagal →
 *     dicatat ke berkas error, loop lanjut. Satu soal buruk tidak menghentikan
 *     11 ribu soal lain.
 *   - **Bulkhead**: pool DB kecil (max 3) + jeda antar batch (default 100 ms)
 *     supaya service embedding & Postgres tidak kehabisan koneksi/CPU.
 *
 * Ukuran batch: default 32. Pengukuran Sprint 1 pada service ini:
 *   batch 10 → ~0.45–0.55 s/soal, batch 25 → ~0.5–0.67 s/soal,
 *   batch 50 → ~1.7 s/soal (padding ke sekuens terpanjang + CPU 8 core).
 * Jadi 50 justru lebih lambat; 32 adalah titik aman (< 50 sesuai instruksi).
 *
 * Jalankan (background):
 *   nohup pnpm tsx scripts/batch-embed-questions.ts >> logs/embedding-$(date +%F).log 2>&1 &
 *   echo $! > /tmp/mathbank-embed.pid
 *
 * Opsi:
 *   --limit N     batasi jumlah soal (uji cepat)
 *   --batch N     override ukuran batch (default 32, maks 50)
 *   --delay N     override jeda antar batch dalam ms (default 100)
 */
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL wajib (jalankan lewat pnpm tsx)");

const SERVICE = (process.env.BGE_M3_SERVICE_URL?.trim() || "http://127.0.0.1:3005").replace(/\/+$/, "");
const MODEL = process.env.BGE_M3_MODEL?.trim() || "bge-m3";
const TIMEOUT_MS = Number.parseInt(process.env.BGE_M3_TIMEOUT_MS ?? "", 10) || 180_000;
const DIM = 1024;

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number.parseInt(process.argv[i + 1] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const BATCH = Math.min(50, arg("batch", 32));
const DELAY_MS = arg("delay", 100);
const LIMIT = arg("limit", 0);

const TODAY = new Date().toISOString().slice(0, 10);
const LOG_DIR = "logs";
mkdirSync(LOG_DIR, { recursive: true });
const ERROR_LOG = `${LOG_DIR}/embedding-errors-${TODAY}.log`;
const RUN_LOG = `${LOG_DIR}/embedding-${TODAY}.log`;
const PID_FILE = "/tmp/mathbank-embed.pid";

const sql = postgres(DB_URL, { max: 3, idle_timeout: 30 });

const t0 = Date.now();
const log = (msg: string) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  // Hindari baris ganda di berkas log saat stdout proses sudah dialihkan ke
  // berkas yang sama (`nohup … >> logs/embedding-*.log`).
  if (process.stdout.isTTY) console.log(line);
  try {
    appendFileSync(RUN_LOG, line + "\n");
  } catch {
    /* logging tak boleh menggagalkan pekerjaan */
  }
};
const logError = (msg: string) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.error(line.trimEnd());
  try {
    appendFileSync(ERROR_LOG, line);
  } catch {
    /* logging tak boleh menggagalkan pekerjaan */
  }
};

interface EmbedResponse {
  data?: { embedding?: number[]; index?: number }[];
  embeddings?: number[][];
}

/** Satu panggilan HTTP ke service embedding. Melempar bila gagal. */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVICE}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: texts }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }
    const json = (await res.json()) as EmbedResponse;
    const vectors = Array.isArray(json.data)
      ? json.data.map((d) => d.embedding)
      : Array.isArray(json.embeddings)
        ? json.embeddings
        : undefined;
    if (!vectors || vectors.length !== texts.length) {
      throw new Error(`Balasan tak sesuai: ${vectors?.length ?? "null"} vektor untuk ${texts.length} input`);
    }
    for (const v of vectors) {
      if (!Array.isArray(v) || v.length !== DIM) throw new Error(`Dimensi ${v?.length} ≠ ${DIM}`);
    }
    return vectors as number[][];
  } finally {
    clearTimeout(timer);
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

interface Row {
  id: string;
  content_markdown: string;
}

/** Tulis satu batch vektor ke DB dalam satu round-trip (unnest). */
async function saveBatch(rows: Row[], vectors: number[][]): Promise<number> {
  const ids = rows.map((r) => r.id);
  const embs = vectors.map((v) => `[${v.join(",")}]`);
  const hashes = rows.map((r) => sha256(r.content_markdown));
  const res = await sql`
    UPDATE questions q
       SET embedding = v.emb::vector,
           embedding_content_hash = v.hash,
           embedding_model_name = ${MODEL},
           updated_at = now()
      FROM (
        SELECT unnest(${ids}::uuid[]) AS id,
               unnest(${embs}::text[]) AS emb,
               unnest(${hashes}::text[]) AS hash
      ) v
     WHERE q.id = v.id
    RETURNING q.id
  `;
  // postgres.js: `Result` adalah array, tapi `count` lebih andal saat
  // RETURNING di-batch (hindari progres dilaporkan 0 padahal baris tersimpan).
  return res.count ?? res.length;
}

let done = 0;
let failed = 0;

async function main() {
  writeFileSync(PID_FILE, String(process.pid));

  // Health check dulu — jangan buang waktu kalau service mati.
  try {
    const h = await fetch(`${SERVICE}/health`, { signal: AbortSignal.timeout(5000) });
    if (!h.ok) throw new Error(`HTTP ${h.status}`);
    log(`service embedding OK: ${SERVICE} (${await h.text()})`);
  } catch (e) {
    logError(`service embedding TIDAK SIAP di ${SERVICE}: ${e instanceof Error ? e.message : e}`);
    throw e;
  }

  const [pending] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM questions
     WHERE embedding IS NULL AND deleted_at IS NULL
  `;
  const [already] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM questions
     WHERE embedding IS NOT NULL AND deleted_at IS NULL
  `;
  const total = pending!.n + already!.n;
  const target = LIMIT > 0 ? Math.min(LIMIT, pending!.n) : pending!.n;
  log(
    `mulai: total=${total} soal, sudah ter-embed=${already!.n}, sisa=${pending!.n}, target run ini=${target} (batch=${BATCH}, delay=${DELAY_MS}ms)`,
  );

  let lastProgressAt = 0;
  let consecutiveFailures = 0;

  while (done + failed < target) {
    const want = Math.min(BATCH, target - done - failed);
    const rows = await sql<Row[]>`
      SELECT id::text AS id, content_markdown
        FROM questions
       WHERE embedding IS NULL
         AND deleted_at IS NULL
       ORDER BY id
       LIMIT ${want}
    `;
    if (rows.length === 0) {
      log("tidak ada baris tersisa — selesai.");
      break;
    }

    try {
      const vectors = await embedBatch(rows.map((r) => r.content_markdown));
      const n = await saveBatch(rows, vectors);
      done += n;
      consecutiveFailures = 0;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(`batch gagal (${rows.length} soal, mulai ${rows[0]!.id}): ${msg}`);

      // Fail-soft: coba satu per satu supaya satu soal buruk tidak memblokir batch.
      let recovered = 0;
      for (const row of rows) {
        try {
          const [v] = await embedBatch([row.content_markdown]);
          await saveBatch([row], [v!]);
          recovered++;
        } catch (e2) {
          failed++;
          logError(`soal ${row.id} GAGAL: ${e2 instanceof Error ? e2.message : e2}`);
        }
      }
      if (recovered > 0) {
        done += recovered;
        log(`pemulihan per-soal: ${recovered}/${rows.length} berhasil`);
      }
      // Service tampak sakit → beri napas, dan berhenti bila gagal beruntun.
      consecutiveFailures++;
      if (consecutiveFailures >= 5) {
        logError("5 batch gagal beruntun — berhenti agar tidak membebani service. Jalankan ulang nanti (resume otomatis).");
        break;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }

    const processed = done + failed;
    if (processed - lastProgressAt >= 500) {
      lastProgressAt = processed;
      const elapsed = (Date.now() - t0) / 1000;
      const rate = done / Math.max(elapsed, 1);
      const etaMin = rate > 0 ? Math.round((target - processed) / rate / 60) : 0;
      const [cov] = await sql<{ emb: number; tot: number }[]>`
        SELECT count(embedding)::int AS emb, count(*)::int AS tot
          FROM questions WHERE deleted_at IS NULL
      `;
      const pct = ((cov!.emb / cov!.tot) * 100).toFixed(1);
      log(
        `Embedded ${done}/${target} soal (${((done / target) * 100).toFixed(1)}%) — cakupan DB ${pct}% — ${rate.toFixed(2)} soal/s — ETA ~${etaMin} mnt`,
      );
    }

    if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const [cov] = await sql<{ tot: number; emb: number; pct: number }[]>`
    SELECT count(*)::int AS tot,
           count(embedding)::int AS emb,
           round(count(embedding)::numeric / count(*) * 100, 1)::float AS pct
      FROM questions WHERE deleted_at IS NULL
  `;
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  log(
    `SELESAI: run ini ${done} berhasil, ${failed} gagal, ${mins} menit. Cakupan DB: ${cov!.emb}/${cov!.tot} (${cov!.pct}%).`,
  );
}

/** Berhenti rapi: batch berjalan diselesaikan dulu, lalu tutup pool & pid file. */
let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    if (stopping) return;
    stopping = true;
    log(`${sig} diterima — berhenti setelah batch ini (resume otomatis saat dijalankan ulang).`);
    void sql.end({ timeout: 10 }).finally(() => {
      try {
        unlinkSync(PID_FILE);
      } catch {
        /* sudah hilang */
      }
      process.exit(0);
    });
  });
}

main()
  .then(async () => {
    await sql.end({ timeout: 10 });
    try {
      unlinkSync(PID_FILE);
    } catch {
      /* sudah hilang */
    }
    process.exit(0);
  })
  .catch(async (e) => {
    logError(`FATAL: ${e instanceof Error ? (e.stack ?? e.message) : e}`);
    await sql.end({ timeout: 10 });
    process.exit(1);
  });
