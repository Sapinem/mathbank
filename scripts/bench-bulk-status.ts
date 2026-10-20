/**
 * Benchmark ACT-05 — aksi massal status soal (200 butir).
 *
 * Mengukur DUA hal yang berbeda, karena keduanya menjawab pertanyaan berbeda:
 *
 *  1. `dbQueries` — jumlah pernyataan DB yang dieksekusi `bulkQuestionAction`.
 *     Ini deterministik: target DoD ≤ 3 (versi lama ~1.800 = N×9).
 *  2. `durationMs` — latensi dinding (wall-clock). Sangat dipengaruhi beban host
 *     bersama (fsync/CPU). Karena itu skrip menjalankan beberapa putaran dan
 *     melaporkan MIN + MEDIAN, bukan satu angka yang kebetulan.
 *
 * Jalankan (WAJIB DB uji, jangan DB dev):
 *   TEST_DATABASE_URL=postgresql://…/mathbank_test \
 *   DATABASE_URL="$TEST_DATABASE_URL" npx tsx scripts/bench-bulk-status.ts
 */
import postgres from "postgres";
import { bulkQuestionAction } from "../src/lib/services/question-bulk";
import type { Actor } from "../src/lib/auth/actor";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib diisi (DB uji).");
if (!/mathbank_test/.test(url)) {
  throw new Error("Benchmark menulis data — hanya boleh di DB uji (mathbank_test).");
}

const sql = postgres(url, { max: 4 });
const admin: Actor = { id: "bench-admin", name: "Bench", roles: ["admin"], via: "session" };
const N = 200;
const ROUNDS = 5;

async function seed(): Promise<string[]> {
  // Satu pernyataan (satu commit/fsync) — seeding bukan objek ukur, jadi jangan
  // biarkan 200 autocommit mendominasi wall-clock.
  const rows = await sql<{ id: string }[]>`
    INSERT INTO questions
      (question_type, difficulty, cognitive_level, grade, content_markdown,
       data_payload, answer_key, status, child_order)
    SELECT 'single_choice', 3, 'remember', '11', 'Bench ' || g,
           '{}'::jsonb, '{"correct":["A"]}'::jsonb, 'review', 0
    FROM generate_series(1, ${N}) g
    RETURNING id`;
  return rows.map((r) => r.id);
}

async function cleanup() {
  await sql`DELETE FROM questions WHERE content_markdown LIKE 'Bench %'`;
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable`;
  await sql`DELETE FROM audit_logs WHERE actor_id = 'bench-admin'`;
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable`;
}

async function main() {
const durations: number[] = [];
const queries: number[] = [];

try {
  // Tiap putaran memakai 200 soal BARU (status `review`) agar aksi yang diukur
  // selalu `review → ready`; biaya seeding tidak ikut dihitung.
  for (let r = 0; r < ROUNDS; r++) {
    const ids = await seed();
    const res = await bulkQuestionAction(ids, "set_ready", admin);
    if (res.failed.length > 0) {
      throw new Error(`putaran ${r + 1}: ${res.failed.length} gagal — ${res.failed[0].error}`);
    }
    durations.push(res.durationMs ?? -1);
    queries.push(res.dbQueries ?? -1);
    console.log(
      `putaran ${r + 1}: ${String(res.dbQueries).padStart(2)} query  ${String(
        res.durationMs,
      ).padStart(5)} ms  (ok=${res.ok.length}/${N})`,
    );
    await cleanup();
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log("\n--- ringkasan ---");
  console.log(`butir per aksi : ${N}`);
  console.log(`query DB       : ${Math.max(...queries)} (maks, target ≤ 3)`);
  console.log(`latensi min    : ${sorted[0]} ms`);
  console.log(`latensi median : ${median} ms`);
  console.log(`latensi maks   : ${sorted[sorted.length - 1]} ms`);

  const passQueries = Math.max(...queries) <= 3;
  const passLatency = sorted[0] < 300;
  console.log(
    `\nDoD query ≤3 : ${passQueries ? "LULUS" : "GAGAL"} · DoD <300 ms (min): ${
      passLatency ? "LULUS" : "GAGAL"
    }`,
  );
  // Pool drizzle di `@/lib/db` menahan event loop; tanpa exit eksplisit proses
  // menggantung setelah laporan tercetak (dulu terlihat seperti "hang").
  // Exit dilakukan SETELAH `finally` agar cleanup audit_logs tetap berjalan.
  process.exitCode = passQueries ? 0 : 1;
} finally {
  await cleanup();
  await sql.end();
}
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
