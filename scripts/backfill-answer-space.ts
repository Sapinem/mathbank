/**
 * backfill-answer-space.ts
 *
 * Backfill SATU-KALI: seragamkan `print_config.answerSpaceCm` ke 3 cm.
 *
 * KENAPA dipisah dari `drizzle/manual/`: skrip di sana dijalankan OTOMATIS
 * oleh `pnpm db:migrate`, sedangkan ini menulis ulang 579 baris data nyata.
 * Jalankan sadar, dengan backup lebih dulu.
 *
 * Usage:
 *   pnpm backup:db
 *   pnpm tsx --env-file=.env scripts/backfill-answer-space.ts          # dry-run
 *   pnpm tsx --env-file=.env scripts/backfill-answer-space.ts --apply  # eksekusi
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib");

const APPLY = process.argv.includes("--apply");
const SQL_PATH = resolve(process.cwd(), "drizzle/one-shot/21-normalize-answer-space.sql");
const sql = postgres(url, { max: 1 });

interface Counts {
  total: number;
  cm4: number;
  cm3: number;
  other: number;
}

async function snapshot(tx: postgres.Sql): Promise<Counts> {
  const [row] = await tx<Array<Record<string, string>>>`
    SELECT
      (SELECT count(*) FROM bundles)::text AS total,
      (SELECT count(*) FROM bundles WHERE print_config->>'answerSpaceCm' = '4')::text AS cm4,
      (SELECT count(*) FROM bundles WHERE print_config->>'answerSpaceCm' = '3')::text AS cm3,
      (SELECT count(*) FROM bundles
        WHERE print_config ? 'answerSpaceCm'
          AND print_config->>'answerSpaceCm' NOT IN ('3', '4'))::text AS other
  `;
  return {
    total: Number(row.total),
    cm4: Number(row.cm4),
    cm3: Number(row.cm3),
    other: Number(row.other),
  };
}

async function main() {
  console.log("=== Backfill ruang coretan (answerSpaceCm 4 → 3) ===");
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  const before = await snapshot(sql);
  console.log("Sebelum:", before);

  if (!APPLY) {
    console.log(
      "\n(dry-run) Tidak ada data yang diubah. Backup dulu (pnpm backup:db), lalu jalankan dengan --apply.",
    );
    await sql.end();
    return;
  }

  const body = readFileSync(SQL_PATH, "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
  });

  const after = await snapshot(sql);
  console.log("Sesudah:", after);
  console.log("\nDelta:", { cm4: after.cm4 - before.cm4, cm3: after.cm3 - before.cm3 });
  console.log("\n✓ Backfill selesai.");
  await sql.end();
}

main().catch(async (err) => {
  console.error("✗ Gagal:", err);
  await sql.end();
  process.exit(1);
});
