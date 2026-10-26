/**
 * batch-embed-questions.ts — ACT-07 (Sprint 1).
 *
 * ADR-0019 (Pilar 1 v2.0): Vektor disimpan di tabel `question_embeddings`
 * (1:1 dengan `questions`), bukan lagi inline di `questions.embedding`.
 *
 * Mengisi `question_embeddings.embedding` (pgvector 1024-dim) untuk seluruh
 * soal yang belum punya embedding, memakai service BGE-M3 lokal
 * (`POST {BGE_M3_SERVICE_URL}/v1/embeddings`).
 *
 * Sifat:
 *   - **Resumable**: LEFT JOIN + WHERE qe.question_id IS NULL → aman
 *     dimatikan/dijalankan ulang; tidak mengulang vektor yang sudah ada.
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
import { DEFAULT_EMBEDDING_URL } from "../src/lib/embedding/bge-m3";

config({ path: ".env" });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL wajib (jalankan lewat pnpm tsx)");

const SERVICE = (process.env.BGE_M3_SERVICE_URL?.trim() || DEFAULT_EMBEDDING_URL).replace(/\/+$/, "");
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

/**
 * Sharding untuk paralelisme aman (opsional).
 * `--shard i/n` (i mulai 0) mempartisi himpunan soal pending berdasarkan
 * hash id, sehingga dua proses (atau lebih) TIDAK PERNAH mengambil baris yang
 * sama. Tanpa ini, dua worker bisa SELECT baris identik (tidak ada
 * `FOR UPDATE` yang menahan lock selama panggilan HTTP) dan menggandakan
 * pekerjaan sekaligus merusak hitungan progres.
 */
function shardArg(): { index: number; count: number } {
  const i = process.argv.indexOf("--shard");
  if (i === -1) return { index: 0, count: 1 };
  const m = /^(\d+)\/(\d+)$/.exec(process.argv[i + 1] ?? "");
  if (!m) throw new Error("--shard harus berbentuk i/n, mis. --shard 1/2");
  const index = Number.parseInt(m[1]!, 10);
  const count = Number.parseInt(m[2]!, 10);
  if (count < 1 || index < 0 || index >= count) throw new Error(`--shard tidak valid: ${index}/${count}`);
  return { index, count };
}
const SHARD = shardArg();

const TODAY = new Date().toISOString().slice(0, 10);
const LOG_DIR = "logs";
mkdirSync(LOG_DIR, { recursive: true });
const ERROR_LOG = `${LOG_DIR}/embedding-errors-${TODAY}.log`;
const RUN_LOG = `${LOG_DIR}/embedding-${TODAY}.log`;
const PID_FILE = SHARD.count > 1 ? `/tmp/mathbank-embed-${SHARD.index}of${SHARD.count}.pid` : "/tmp/mathbank-embed.pid";

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

/**
 * Tulis satu batch vektor ke DB dalam satu round-trip (unnest).
 * ADR-0019: INSERT ke `question_embeddings` dengan ON CONFLICT upsert.
 */
async function saveBatch(rows: Row[], vectors: number[][]): Promise<number> {
  const ids = rows.map((r) => r.id);
  const embs = vectors.map((v) => `[${v.join(",")}]`);
  const hashes = rows.map((r) => sha256(r.content_markdown));
  const res = await sql`
    INSERT INTO question_embeddings (question_id, embedding, embedding_content_hash, embedding_model_name, created_at, updated_at)
    SELECT v.id, v.emb::vector, v.hash, ${MODEL}, now(), now()
      FROM (
        SELECT unnest(${ids}::uuid[]) AS id,
               unnest(${embs}::text[]) AS emb,
               unnest(${hashes}::text[]) AS hash
      ) v
    ON CONFLICT (question_id) DO UPDATE
       SET embedding = EXCLUDED.embedding,
           embedding_content_hash = EXCLUDED.embedding_content_hash,
           embedding_model_name = EXCLUDED.embedding_model_name,
           updated_at = now()
    RETURNING question_id
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

  // ADR-0019: soal tanpa embedding = LEFT JOIN ke question_embeddings, WHERE qe IS NULL.
  const [pending] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM questions q
     LEFT JOIN question_embeddings qe ON qe.question_id = q.id
     WHERE qe.question_id IS NULL AND q.deleted_at IS NULL
       AND (${SHARD.count} = 1 OR mod(abs(hashtext(q.id::text)), ${SHARD.count}) = ${SHARD.index})
  `;
  const [already] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM question_embeddings qe
     JOIN questions q ON q.id = qe.question_id
     WHERE q.deleted_at IS NULL
  `;
  const total = pending!.n + already!.n;
  const target = LIMIT > 0 ? Math.min(LIMIT, pending!.n) : pending!.n;
  log(
    `mulai: total=${total} soal, sudah ter-embed=${already!.n}, sisa=${pending!.n}, target run ini=${target} (batch=${BATCH}, delay=${DELAY_MS}ms, shard=${SHARD.index}/${SHARD.count}, pid=${process.pid})`,
  );

  let lastProgressAt = 0;
  let consecutiveFailures = 0;

  while (done + failed < target) {
    const want = Math.min(BATCH, target - done - failed);
    // Urutkan berdasarkan panjang konten (bukan id): batch jadi homogen
    // panjangnya sehingga token padding ke sekuens terpanjang hilang.
    // Terukur di mesin ini: batch 32 acak-by-id = 2,25 s/soal; batch 32
    // panjang seragam = 0,93 s/soal → ~2,4x lebih cepat. Ini penyebab
    // sebenarnya dari "lambat", bukan kekurangan CPU.
    const rows = await sql<Row[]>`
      SELECT q.id::text AS id, q.content_markdown
        FROM questions q
        LEFT JOIN question_embeddings qe ON qe.question_id = q.id
       WHERE qe.question_id IS NULL
         AND q.deleted_at IS NULL
         AND (${SHARD.count} = 1 OR mod(abs(hashtext(q.id::text)), ${SHARD.count}) = ${SHARD.index})
       ORDER BY length(q.content_markdown), q.id
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
        SELECT (SELECT count(*)::int FROM question_embeddings qe
                  JOIN questions q ON q.id = qe.question_id
                 WHERE q.deleted_at IS NULL) AS emb,
               count(*)::int AS tot
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
    SELECT (SELECT count(*)::int FROM questions WHERE deleted_at IS NULL) AS tot,
           (SELECT count(*)::int FROM question_embeddings qe
              JOIN questions q ON q.id = qe.question_id
             WHERE q.deleted_at IS NULL) AS emb,
           round((SELECT count(*)::numeric FROM question_embeddings qe
                    JOIN questions q ON q.id = qe.question_id
                   WHERE q.deleted_at IS NULL) /
                 NULLIF((SELECT count(*) FROM questions WHERE deleted_at IS NULL), 0) * 100, 1)::float AS pct
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
