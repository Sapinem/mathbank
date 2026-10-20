/**
 * Benchmark ACT-06 (MAT-123) — HOT-eligibility & fillfactor untuk transisi
 * status soal secara massal.
 *
 * Pertanyaan yang dijawab skrip ini BUKAN "berapa milidetik di host ini"
 * (host bersama selalu jenuh, load average 10–31 pada 8 vCPU sehingga angka
 * dinding tidak representatif). Pertanyaan sebenarnya:
 *
 *   1. Apakah UPDATE `questions.status` bisa menjadi HOT (Heap-Only Tuple)?
 *      HOT = PostgreSQL tidak perlu menyisipkan entri baru ke SETIAP indeks.
 *      Ini properti STRUKTURAL, bukan properti waktu — jadi tetap valid
 *      walau host jenuh.
 *   2. Berapa rasio `n_tup_hot_upd / n_tup_upd` sebelum vs sesudah?
 *      Angka ini diambil dari `pg_stat_user_tables` (penghitung kumulatif),
 *      bukan stopwatch, sehingga bebas derau beban host.
 *   3. Apakah query daftar soal ber-filter status (ORDER BY created_at DESC)
 *      mengalami regresi saat indeks status dilepas?
 *
 * Variabel yang diuji:
 *   baseline      : apa adanya (fillfactor 100, 15 indeks)
 *   ff85          : fillfactor 85 saja
 *   ff85_nostatus : fillfactor 85 + status dilepas dari SEMUA indeks
 *   ff85_nostatus_listing : seperti di atas + indeks daftar (status, created_at DESC)
 *
 * Jalankan (WAJIB DB uji):
 *   TEST_DATABASE_URL=postgresql://…/mathbank_test npx tsx scripts/bench-hot-status.ts
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib diisi (DB uji).");
if (!/mathbank_test/.test(url)) {
  throw new Error("Benchmark menulis & men-drop indeks — hanya boleh di mathbank_test.");
}

const sql = postgres(url, { max: 4, onnotice: () => {} });

const ROWS = Number(process.env.BENCH_ROWS ?? 20_000);
const BATCH = 200;
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 5);

const loadAvg = (): number => Number(readFileSync("/proc/loadavg", "utf8").split(" ")[0]);
const cpus = (() => {
  try {
    return readFileSync("/proc/cpuinfo", "utf8").split("\n").filter((l) => l.startsWith("processor")).length;
  } catch {
    return 0;
  }
})();

type Variant = {
  key: string;
  ddl: string[];
  /** Indeks yang dipakai query daftar soal untuk dievaluasi ulang setelah DDL. */
  listingIdx?: string;
};

const VARIANTS: Variant[] = [
  { key: "baseline", ddl: [] },
  { key: "ff85", ddl: [`ALTER TABLE questions SET (fillfactor = 85)`] },
  {
    key: "ff85_nostatus",
    ddl: [
      `ALTER TABLE questions SET (fillfactor = 85)`,
      `DROP INDEX IF EXISTS idx_questions_status`,
      `DROP INDEX IF EXISTS idx_questions_grade_diff_status`,
      `DROP INDEX IF EXISTS idx_questions_grade`,
      `DROP INDEX IF EXISTS idx_questions_listing`,
    ],
  },
  {
    key: "ff85_nostatus_listing",
    ddl: [
      `ALTER TABLE questions SET (fillfactor = 85)`,
      `DROP INDEX IF EXISTS idx_questions_status`,
      `DROP INDEX IF EXISTS idx_questions_grade_diff_status`,
      `DROP INDEX IF EXISTS idx_questions_grade`,
      `CREATE INDEX idx_questions_listing ON questions (status, created_at DESC) WHERE deleted_at IS NULL`,
    ],
  },
  {
    // Kandidat produksi TANPA perubahan fillfactor: mengisolasi apakah
    // fillfactor benar-benar menyumbang, atau hanya efek dari susunan indeks.
    key: "final_noff",
    ddl: [
      `ALTER TABLE questions SET (fillfactor = 100)`,
      `DROP INDEX IF EXISTS idx_questions_status`,
      `DROP INDEX IF EXISTS idx_questions_grade_diff_status`,
      `DROP INDEX IF EXISTS idx_questions_grade`,
      `DROP INDEX IF EXISTS idx_questions_listing`,
      `CREATE INDEX idx_questions_listing ON questions (status, created_at DESC) WHERE deleted_at IS NULL`,
    ],
  },
  {
    // Kandidat alternatif: PERTAHANKAN idx_questions_status yang sempit (untuk
    // COUNT(*) yang tak butuh urutan) DAN tambahkan idx_questions_listing
    // (untuk halaman yang butuh urutan). Hanya grade_diff_status yang dibuang.
    key: "keep_status_plus_listing",
    ddl: [
      `ALTER TABLE questions SET (fillfactor = 100)`,
      `DROP INDEX IF EXISTS idx_questions_grade_diff_status`,
      `CREATE INDEX IF NOT EXISTS idx_questions_status ON questions (status)`,
      `DROP INDEX IF EXISTS idx_questions_listing`,
      `CREATE INDEX idx_questions_listing ON questions (status, created_at DESC) WHERE deleted_at IS NULL`,
    ],
  },
];

/** DDL pemulihan — mengembalikan skema ke definisi Drizzle semula. */
const RESTORE_DDL = [
  `ALTER TABLE questions SET (fillfactor = 100)`,
  `DROP INDEX IF EXISTS idx_questions_listing`,
  `CREATE INDEX IF NOT EXISTS idx_questions_status ON questions (status)`,
  `CREATE INDEX IF NOT EXISTS idx_questions_grade ON questions (grade)`,
  `CREATE INDEX IF NOT EXISTS idx_questions_grade_diff_status ON questions (grade, difficulty, status)`,
];

async function buildDataset() {
  console.log(`membangun dataset ${ROWS.toLocaleString("id-ID")} baris…`);
  await sql`DROP TABLE IF EXISTS bench_stash`;
  await sql`TRUNCATE questions CASCADE`;
  const [{ n: zero }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM questions`;
  if (zero !== 0) throw new Error(`TRUNCATE tidak bersih: ${zero} baris tersisa`);

  // 8 vektor templat → cukup untuk memberi beban HNSW tanpa 20 ribu vektor acak
  // yang mahal dibangkitkan. Nilai vektor tidak memengaruhi biaya sisip HNSW.
  await sql`
    CREATE TEMP TABLE IF NOT EXISTS bench_vec AS
    SELECT g AS k,
           (SELECT ('[' || string_agg((sin(g * 0.001 + i))::text, ',') || ']')::vector
              FROM generate_series(1, 1024) i) AS v
    FROM generate_series(0, 7) g`;

  await sql`
    INSERT INTO questions
      (question_type, difficulty, cognitive_level, grade, content_markdown,
       data_payload, answer_key, status, child_order, created_at,
       embedding, embedding_model_name)
    SELECT
      'single_choice',
      1 + (g % 5),
      (ARRAY['remember','understand','apply','analyze','evaluate','create'])[1 + (g % 6)]::cognitive_level,
      (ARRAY['10','11','12'])[1 + (g % 3)],
      -- ~600 karakter (inline) untuk 80%, ~3 kB (TOAST) untuk 20%
      repeat('Soal bench nomor ' || g || '. ', CASE WHEN g % 5 = 0 THEN 130 ELSE 25 END),
      '{}'::jsonb,
      '{"correct":["A"]}'::jsonb,
      (CASE
         WHEN g % 20 < 12 THEN 'draft'    -- 60%
         WHEN g % 20 < 14 THEN 'review'   -- 10% (2.000 baris → 5 putaran × 200)
         WHEN g % 20 < 19 THEN 'ready'    -- 25%
         ELSE 'archived'                  --  5%
       END)::question_status,
      0,
      now() - (g || ' seconds')::interval,
      CASE WHEN g % 5 = 0 THEN (SELECT v FROM bench_vec WHERE k = g % 8) END,
      CASE WHEN g % 5 = 0 THEN 'bench' END
    FROM generate_series(1, ${ROWS}) g`;

  await sql`ANALYZE questions`;
  const [{ n: built }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM questions`;
  if (built !== ROWS) throw new Error(`dataset ${built} baris, seharusnya ${ROWS}`);
  await sql`CREATE TABLE bench_stash AS SELECT * FROM questions`;
  console.log(`dataset siap: ${built.toLocaleString("id-ID")} baris`);
}

async function resetData() {
  await sql`TRUNCATE questions CASCADE`;
  await sql`INSERT INTO questions SELECT * FROM bench_stash`;
  // VACUUM FULL: satu-satunya cara fillfactor baru berlaku untuk halaman lama.
  await sql`VACUUM (FULL, ANALYZE) questions`;
}

type Stats = { upd: number; hot: number };

async function readStats(): Promise<Stats> {
  // Paksa flush penghitung statistik ke pg_stat (PG15+), lalu baca.
  await sql`SELECT pg_stat_force_next_flush()`;
  const [r] = await sql<{ upd: number; hot: number }[]>`
    SELECT n_tup_upd::int AS upd, n_tup_hot_upd::int AS hot
    FROM pg_stat_user_tables WHERE relname = 'questions'`;
  return { upd: r?.upd ?? 0, hot: r?.hot ?? 0 };
}

async function timeIt(fn: () => Promise<void>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return Math.round(performance.now() - t0);
}

type Round = { updateMs: number; auditMs: number; totalMs: number; load: number };

async function measureVariant(v: Variant) {
  for (const stmt of v.ddl) await sql.unsafe(stmt);
  await resetData();

  const loadStart = loadAvg();
  const before = await readStats();
  const rounds: Round[] = [];

  // Ambil seluruh id kandidat sekali di luar jendela ukur; tiap putaran memakai
  // potongan 200 id yang berbeda sehingga tidak ada update berulang.
  const candidates = (
    await sql<{ id: string }[]>`
      SELECT id FROM questions
      WHERE status = 'review'::question_status AND deleted_at IS NULL
      ORDER BY id
      LIMIT ${ROUNDS * BATCH}`
  ).map((x) => x.id);
  if (candidates.length !== ROUNDS * BATCH) {
    throw new Error(
      `kandidat 'review' kurang: ${candidates.length}, butuh ${ROUNDS * BATCH} (naikkan BENCH_ROWS)`,
    );
  }

  for (let r = 0; r < ROUNDS; r++) {
    const ids = candidates.slice(r * BATCH, (r + 1) * BATCH);

    const load = loadAvg();
    let updateMs = 0;
    let auditMs = 0;
    const totalMs = await timeIt(async () => {
      await sql.begin(async (tx) => {
        updateMs = await timeIt(async () => {
          await tx`
            UPDATE questions AS q
               SET status = 'ready', updated_at = now()
              FROM (SELECT unnest(${ids}::uuid[]) AS id) AS v
             WHERE q.id = v.id AND q.status = 'review'`;
        });
        auditMs = await timeIt(async () => {
          await tx`
            INSERT INTO audit_logs (entity_type, entity_id, action, actor_type, actor_id, change_summary)
            SELECT 'question', id::text, 'status_change', 'system', 'bench-admin', 'review→ready'
            FROM unnest(${ids}::uuid[]) AS id`;
        });
      });
    });
    rounds.push({ updateMs, auditMs, totalMs, load });
  }

  const after = await readStats();
  const upd = after.upd - before.upd;
  const hot = after.hot - before.hot;

  // Kontrol: UPDATE kolom yang TIDAK terindeks (is_flagged). Ini memisahkan
  // efek fillfactor dari efek "status ada di indeks": kalau fillfactor bekerja,
  // update jenis ini HARUS HOT pada varian ber-fillfactor 85.
  const beforeFlag = await readStats();
  const flagMs = await timeIt(async () => {
    await sql`
      UPDATE questions SET is_flagged = NOT is_flagged, flag_notes = 'bench'
      WHERE id = ANY(${candidates.slice(0, BATCH)}::uuid[])`;
  });
  const afterFlag = await readStats();
  const flagUpd = afterFlag.upd - beforeFlag.upd;
  const flagHot = afterFlag.hot - beforeFlag.hot;

  const totals = rounds.map((r) => r.totalMs).sort((a, b) => a - b);
  const median = totals[Math.floor(totals.length / 2)];
  const loads = rounds.map((r) => r.load);

  return {
    key: v.key,
    updateMedian: medianOf(rounds.map((r) => r.updateMs)),
    auditMedian: medianOf(rounds.map((r) => r.auditMs)),
    totalMin: totals[0],
    totalMedian: median,
    totalMax: totals[totals.length - 1],
    loads,
    loadStart,
    loadEnd: loadAvg(),
    upd,
    hot,
    hotPct: upd > 0 ? Math.round((hot / upd) * 1000) / 10 : 0,
    flagMs,
    flagUpd,
    flagHot,
    flagHotPct: flagUpd > 0 ? Math.round((flagHot / flagUpd) * 1000) / 10 : 0,
    expected: ROUNDS * BATCH,
  };
}

function medianOf(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Query daftar soal yang dipakai UI (filter status utama, urut terbaru). */
const LISTING = {
  page: (status: string) => sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT id, content_markdown, created_at FROM questions
    WHERE status = ${status}::question_status AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 20 OFFSET 0`,
  count: (status: string) => sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT count(*)::int FROM questions
    WHERE status = ${status}::question_status AND deleted_at IS NULL`,
};

type Plan = { node: string; ms: number; rows: number; detail: string };

async function explain(q: ReturnType<typeof LISTING.page>): Promise<Plan> {
  const [row] = await q as unknown as { "QUERY PLAN": { Plan: Record<string, unknown>; "Execution Time": number }[] }[];
  const plan = row["QUERY PLAN"][0];
  const p = plan.Plan as {
    "Node Type": string;
    "Actual Rows": number;
    Plans?: { "Node Type": string; "Index Name"?: string }[];
  };
  const child = p.Plans?.[0];
  return {
    node: p["Node Type"] + (child ? ` → ${child["Node Type"]}${child["Index Name"] ? `(${child["Index Name"]})` : ""}` : ""),
    ms: Math.round(plan["Execution Time"] * 1000) / 1000,
    rows: p["Actual Rows"],
    detail: JSON.stringify(p).slice(0, 0),
  };
}

async function measureListing() {
  const out: Record<string, { page: Plan; count: Plan }> = {};
  for (const status of ["ready", "review", "draft", "archived"]) {
    out[status] = { page: await explain(LISTING.page(status)), count: await explain(LISTING.count(status)) };
  }
  return out;
}

async function indexInventory() {
  const rows = await sql<{ indexname: string; def: string }[]>`
    SELECT indexname, regexp_replace(indexdef, '^.* USING ', '') AS def
    FROM pg_indexes WHERE tablename = 'questions' ORDER BY 1`;
  return rows;
}

async function main() {
  console.log(`host: ${cpus} vCPU · load average awal ${loadAvg()}`);
  // Pastikan titik awal = skema Drizzle asli (fillfactor 100, idx_questions_status
  // + idx_questions_grade_diff_status ada, tanpa idx_questions_listing). Tanpa ini
  // "baseline" bisa diam-diam mengukur skema yang sudah dimigrasikan.
  for (const stmt of RESTORE_DDL) await sql.unsafe(stmt);
  await buildDataset();

  const results = [];
  const listings: Record<string, unknown> = {};

  const only = (process.env.BENCH_VARIANTS ?? "").split(",").filter(Boolean);
  for (const v of VARIANTS) {
    if (only.length > 0 && !only.includes(v.key)) continue;
    console.log(`\n=== varian ${v.key} ===`);
    const r = await measureVariant(v);
    listings[v.key] = await measureListing();
    results.push(r);
    console.log(
      `  update ${r.updateMedian} ms · audit ${r.auditMedian} ms · total ${r.totalMin}/${r.totalMedian}/${r.totalMax} ms` +
        ` · HOT ${r.hot}/${r.upd} = ${r.hotPct}% · flag-update ${r.flagMs} ms HOT ${r.flagHot}/${r.flagUpd} = ${r.flagHotPct}%` +
        ` · load ${r.loadStart}→${r.loadEnd}`,
    );
  }

  // Kembalikan skema ke definisi Drizzle semula.
  for (const stmt of RESTORE_DDL) await sql.unsafe(stmt);
  await sql`DROP TABLE IF EXISTS bench_stash`;
  await sql`TRUNCATE questions CASCADE`;
  await sql`VACUUM (FULL, ANALYZE) questions`;

  console.log("\n\n=== RINGKASAN ===");
  console.log(
    "| varian | update (median) | audit (median) | total min/med/max | n_tup_upd | n_tup_hot_upd | HOT% | flag-update HOT% | load (min–max) |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    console.log(
      `| ${r.key} | ${r.updateMedian} ms | ${r.auditMedian} ms | ${r.totalMin}/${r.totalMedian}/${r.totalMax} ms | ${r.upd} | ${r.hot} | ${r.hotPct}% | ${r.flagHotPct}% (${r.flagHot}/${r.flagUpd}) | ${Math.min(...r.loads)}–${Math.max(...r.loads)} |`,
    );
  }

  console.log("\n=== EXPLAIN daftar soal (status filter) ===");
  for (const [k, v] of Object.entries(listings)) {
    const l = v as Record<string, { page: Plan; count: Plan }>;
    console.log(`\n[${k}]`);
    for (const s of Object.keys(l)) {
      console.log(`  ${s.padEnd(9)} page ${String(l[s].page.ms).padStart(7)} ms  ${l[s].page.node}`);
      console.log(`  ${"".padEnd(9)} count ${String(l[s].count.ms).padStart(6)} ms  ${l[s].count.node}`);
    }
  }

  console.log("\n=== indeks akhir ===");
  for (const i of await indexInventory()) console.log(`  ${i.indexname}: ${i.def}`);
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
