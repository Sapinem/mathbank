/**
 * Menerapkan SELURUH `drizzle/manual/*.sql` — fungsi, trigger, index vektor,
 * dan perubahan skema tulis-tangan (mis. backfill `short_id`).
 *
 * KENAPA skrip terpisah (bukan hanya drizzle-kit migrate):
 * `drizzle-kit migrate` hanya menjalankan migrasi yang punya `meta/<tag>_snapshot.json`.
 * File manual ditulis TANGAN (per L7 §6.3 "SQL tangan untuk yang krusial"),
 * diletakkan di `drizzle/manual/` agar drizzle-kit tak menyentuhnya, dan
 * **idempotent** (DROP IF EXISTS / CREATE OR REPLACE / IF NOT EXISTS) sehingga
 * aman dijalankan berulang. Di-chain dari `pnpm db:migrate` agar DB bersih pun
 * mendapat seluruh invarian.
 *
 * URUTAN: berkas dijalankan **urut abjad nama berkas**. Beri prefiks angka bila
 * urutannya penting (mis. `00-extensions.sql` harus lebih dulu).
 *
 * Jalankan: `pnpm db:safety` (otomatis via `pnpm db:migrate`).
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const MANUAL_DIR = "drizzle/manual";

/**
 * Berkas yang dijalankan lewat `psql` sebagai admin — memakai meta-command
 * psql (`\set`) yang TIDAK bisa dijalankan driver JS. Dikecualikan dari alur
 * otomatis; punya prosedur sendiri (lihat kepala berkasnya).
 */
const PSQL_ONLY = ["provision-prod.sql"];

async function dbApplySafety() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL tidak diset (perlu .env).");
    process.exit(1);
  }

  const files = readdirSync(resolve(process.cwd(), MANUAL_DIR))
    .filter((f) => f.endsWith(".sql") && !PSQL_ONLY.includes(f))
    .sort();

  if (files.length === 0) {
    console.error(`✗ Tidak ada berkas .sql di ${MANUAL_DIR}/`);
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    for (const name of files) {
      const body = readFileSync(resolve(process.cwd(), MANUAL_DIR, name), "utf8");
      // Satu berkas = satu transaksi: sukses total atau batal total.
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
      });
      console.log(`✓ ${name}`);
    }
    console.log("✓ Safety SQL diterapkan — trigger, invarian & index aktif.");
  } catch (err) {
    console.error(`✗ Gagal menerapkan SQL manual:`, err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

dbApplySafety().catch((err) => {
  console.error("✗ Tak terduga:", err);
  process.exit(1);
});
