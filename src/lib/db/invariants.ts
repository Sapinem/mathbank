/**
 * Verifikasi invarian DB — health check (P1) & guard startup (P2).
 * Dipakai `/api/health`, `/api/ready`, dan log saat server menyala.
 *
 * Latar: invarian bisnis (trigger, CHECK, HNSW, uuidv7) hidup di
 * `drizzle/manual/db_safety.sql` yang diterapkan lewat `pnpm db:migrate`.
 * Bila seseorang menjalankan `drizzle-kit push/migrate` langsung, invarian itu
 * TIDAK terpasang → aplikasi berjalan "tanpa jaring pengaman". Modul ini
 * mendeteksi kondisi itu lebih awal (bukan menunggu insiden).
 *
 * Angka & aturan lulus/gagal TINGGAL di `schema-expectations.ts` (murni, tanpa
 * impor db) supaya `scripts/db-verify.ts` dan `scripts/snapshot-metrics.ts`
 * memakai sumber yang sama tanpa ikut membuka koneksi kedua. Modul ini hanya
 * mengumpulkan fakta dari DB lalu menyerahkannya ke `evaluateInvariants()`.
 */
import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  REQUIRED_CHECKS,
  REQUIRED_TRIGGERS,
  evaluateInvariants,
  isForbiddenTable,
  type InvariantReport,
} from "./schema-expectations";

type CountRow = {
  tables: number;
  checks: number;
  hnsw: number;
  triggers: number;
};

/**
 * Periksa seluruh invarian. Read-only & cepat (satu round-trip + 4 kueri kecil).
 * Tidak melempar — kembalikan laporan agar pemanggil memutuskan (log/blok).
 *
 * Catatan hitungan: `tables` MENGECUALIKAN tabel sisa migrasi (`*_backup`).
 * Tanpa pengecualian itu, satu tabel sisa menjadi kelonggaran yang menutupi
 * hilangnya satu tabel skema sungguhan.
 */
export async function checkDbInvariants(): Promise<InvariantReport> {
  const countRows = await db.execute<CountRow>(sql`
    SELECT
      (SELECT count(*) FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
          AND right(table_name, 7) <> '_backup') AS tables,
      (SELECT count(*) FROM pg_constraint
        WHERE contype='c' AND connamespace='public'::regnamespace) AS checks,
      (SELECT count(*) FROM pg_indexes
        WHERE indexdef ILIKE '%hnsw%') AS hnsw,
      (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers
  `);
  const c = countRows[0] ?? { tables: 0, checks: 0, hnsw: 0, triggers: 0 };
  const counts = {
    tables: Number(c.tables),
    checkConstraints: Number(c.checks),
    hnswIndexes: Number(c.hnsw),
    triggers: Number(c.triggers),
  };

  const checkRows = await db.execute<{ conname: string }>(sql`
    SELECT conname FROM pg_constraint
     WHERE contype='c' AND connamespace='public'::regnamespace
  `);
  const checkNames = new Set(checkRows.map((r) => r.conname));

  const trigRows = await db.execute<{ tgname: string }>(sql`
    SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
  `);
  const trigNames = new Set(trigRows.map((r) => r.tgname));

  const pkRows = await db.execute<{ column_default: string | null }>(sql`
    SELECT column_default FROM information_schema.columns
     WHERE table_name='questions' AND column_name='id'
  `);
  const pkUsesUuidv7 = (pkRows[0]?.column_default ?? "").includes("uuidv7");

  // Invarian negatif: tabel yang seharusnya sudah di-drop (MAT-144/MAT-146)
  // atau sisa migrasi (*_backup). Hitungan `tables` saja tak bisa menangkapnya.
  const tableRows = await db.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'
  `);
  const tableNames = new Set(tableRows.map((r) => r.table_name));

  const { ok, problems } = evaluateInvariants(counts, {
    tables: tableNames,
    checks: checkNames,
    triggers: trigNames,
    pkUsesUuidv7,
  });

  return {
    ok,
    counts,
    missingTriggers: REQUIRED_TRIGGERS.filter((n) => !trigNames.has(n)),
    missingChecks: REQUIRED_CHECKS.filter((n) => !checkNames.has(n)),
    forbiddenTablesPresent: [...tableNames].filter(isForbiddenTable).sort(),
    pkUsesUuidv7,
    problems,
  };
}
