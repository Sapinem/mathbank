/**
 * Verifikasi skema DB — mencegah "drift" antara file migrasi dan DB nyata.
 *
 * Latar: audit 2026-09-29 menemukan 21 trigger & invarian ada di DB lokal
 * tetapi TIDAK ada di file migrasi → DB bersih kehilangan invarian.
 * Skrip ini memeriksa jumlah objek kunci dan GAGAL bila tak sesuai harapan.
 *
 * Jalankan: `pnpm db:verify` (dipanggil dari CI setelah `pnpm check`,
 * bukan dari `pnpm check` itu sendiri — `pnpm check` hanya menjalankan
 * theme:check, lint:names, typecheck, lint, test:coverage, dan build).
 * Butuh DATABASE_URL (dibaca dari .env).
 *
 * Aturan lulus/gagal TIDAK ditulis di sini: semuanya lewat
 * `evaluateInvariants()` di `src/lib/db/schema-expectations.ts`, sumber yang
 * sama dengan health check dan snapshot metrik. Skrip ini hanya mengumpulkan
 * fakta dan mencetaknya.
 */
import { config } from "dotenv";
import postgres from "postgres";
import {
  EXPECTED_INVARIANTS,
  REQUIRED_CHECKS,
  REQUIRED_TRIGGERS,
  evaluateInvariants,
  isForbiddenTable,
} from "../src/lib/db/schema-expectations";

config({ path: ".env" });

type Row = Record<string, unknown>;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL tidak diset (perlu .env).");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    const [counts] = await sql<Row[]>`
      SELECT
        (SELECT count(*) FROM information_schema.tables
          WHERE table_schema='public' AND table_type='BASE TABLE'
            AND right(table_name, 7) <> '_backup') AS tables,
        (SELECT count(*) FROM pg_constraint
          WHERE contype='c' AND connamespace='public'::regnamespace) AS checks,
        (SELECT count(*) FROM pg_indexes
          WHERE indexdef ILIKE '%hnsw%') AS hnsw,
        (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers
    `;

    const got = {
      tables: Number(counts.tables),
      checkConstraints: Number(counts.checks),
      hnswIndexes: Number(counts.hnsw),
      triggers: Number(counts.triggers),
    };

    for (const key of Object.keys(EXPECTED_INVARIANTS) as (keyof typeof EXPECTED_INVARIANTS)[]) {
      const want = EXPECTED_INVARIANTS[key];
      const have = got[key];
      console.log(`${have >= want ? "✓" : "✗"} ${key}: ${have} (harap ≥ ${want})`);
    }

    // Objek bernama — satu query per jenis, dipakai untuk cetak DAN evaluasi.
    const tableRows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE'
    `;
    const tableNames = new Set(tableRows.map((r) => r.table_name));

    const checkRows = await sql<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
       WHERE contype='c' AND connamespace='public'::regnamespace
    `;
    const checkNames = new Set(checkRows.map((r) => r.conname));

    const trigRows = await sql<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
    `;
    const trigNames = new Set(trigRows.map((r) => r.tgname));

    // PK default wajib uuidv7() (PG 18) — cegah regresi ke gen_random_uuid().
    const [pkDefault] = await sql<{ column_default: string | null }[]>`
      SELECT column_default FROM information_schema.columns
       WHERE table_name='questions' AND column_name='id'
    `;
    const pkUsesUuidv7 = (pkDefault?.column_default ?? "").includes("uuidv7");

    const forbiddenPresent = [...tableNames].filter(isForbiddenTable).sort();
    for (const name of forbiddenPresent) console.log(`✗ tabel terlarang masih ada: ${name}`);
    if (forbiddenPresent.length === 0) console.log("✓ tak ada tabel terlarang/sisa migrasi");

    for (const name of REQUIRED_CHECKS) {
      console.log(`${checkNames.has(name) ? "✓" : "✗"} CHECK ${name}`);
    }
    for (const name of REQUIRED_TRIGGERS) {
      console.log(`${trigNames.has(name) ? "✓" : "✗"} TRIGGER ${name}`);
    }
    console.log(`${pkUsesUuidv7 ? "✓" : "✗"} PK default = uuidv7() (kini: ${pkDefault?.column_default ?? "-"})`);

    const verdict = evaluateInvariants(got, {
      tables: tableNames,
      checks: checkNames,
      triggers: trigNames,
      pkUsesUuidv7,
    });

    if (!verdict.ok) {
      console.error(`\n✗ Skema DRIFT — ${verdict.problems.length} masalah:`);
      for (const p of verdict.problems) console.error(`  - ${p}`);
      process.exitCode = 1;
      return;
    }
    console.log("\n✓ Skema OK — tak ada drift.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ Verifikasi skema gagal:", err);
  process.exit(1);
});
