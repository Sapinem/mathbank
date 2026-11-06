/**
 * backfill-denormalize-grades.ts
 *
 * Backfill SATU-KALI untuk denormalisasi grade (ADR-0024):
 * menghapus grade non-kelas dari master `grades`, menetralkan `'umum'`,
 * lalu menurunkan `questions.grades`/`grade` dari keanggotaan bundle.
 *
 * KENAPA bukan di `drizzle/manual/`: skrip di sana dijalankan OTOMATIS oleh
 * `pnpm db:migrate` (lihat scripts/db-apply-safety.ts). Berkas ini menghapus
 * baris dan menulis ulang tabel secara massal, jadi ia tidak boleh ikut setiap
 * migrasi rutin. Jalankan sadar, dengan backup lebih dulu.
 *
 * Usage:
 *   pnpm backup:db
 *   pnpm tsx --env-file=.env scripts/backfill-denormalize-grades.ts          # dry-run (hitung saja)
 *   pnpm tsx --env-file=.env scripts/backfill-denormalize-grades.ts --apply  # eksekusi
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib");

const APPLY = process.argv.includes("--apply");
const SQL_PATH = resolve(process.cwd(), "drizzle/one-shot/20-denormalize-grades.sql");
const sql = postgres(url, { max: 1 });

interface Counts {
  grades: number;
  umum: number;
  graded: number;
  bundles: number;
}

async function snapshot(tx: postgres.Sql): Promise<Counts> {
  const [row] = await tx<
    Array<{ grades: string; umum: string; graded: string; bundles: string }>
  >`
    SELECT
      (SELECT count(*) FROM grades)::text AS grades,
      (SELECT count(*) FROM questions WHERE grade = 'umum')::text AS umum,
      (SELECT count(*) FROM questions WHERE deleted_at IS NULL AND grades <> '{}'::varchar[])::text AS graded,
      (SELECT count(*) FROM bundles WHERE deleted_at IS NULL)::text AS bundles
  `;
  return {
    grades: Number(row.grades),
    umum: Number(row.umum),
    graded: Number(row.graded),
    bundles: Number(row.bundles),
  };
}

async function main() {
  console.log("=== Backfill denormalisasi grade (ADR-0024) ===");
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
  console.log("\nDelta:", {
    grades: after.grades - before.grades,
    umum: after.umum - before.umum,
    graded: after.graded - before.graded,
    bundles: after.bundles - before.bundles,
  });
  console.log("\n✓ Backfill selesai.");
  await sql.end();
}

main().catch(async (err) => {
  console.error("✗ Gagal:", err);
  await sql.end();
  process.exit(1);
});
