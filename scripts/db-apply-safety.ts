/**
 * Menerapkan `drizzle/manual/db_safety.sql` — fungsi, trigger, & index vektor.
 *
 * KENAPA skrip terpisah (bukan hanya drizzle-kit migrate):
 * `drizzle-kit migrate` hanya menjalankan migrasi yang punya `meta/<tag>_snapshot.json`.
 * File safety ditulis TANGAN (per L7 §6.3 "SQL tangan untuk yang krusial"),
 * diletakkan di `drizzle/manual/` agar drizzle-kit tak menyentuhnya, dan
 * **idempotent** (DROP IF EXISTS / CREATE OR REPLACE / IF NOT EXISTS) sehingga
 * aman dijalankan berulang. Di-chain dari `pnpm db:migrate` agar DB bersih pun
 * mendapat seluruh invarian.
 *
 * Jalankan: `pnpm db:safety` (otomatis via `pnpm db:migrate`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL tidak diset (perlu .env).");
    process.exit(1);
  }

  const file = resolve(process.cwd(), "drizzle/manual/db_safety.sql");
  const body = readFileSync(file, "utf8");

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    // Jalankan sebagai satu transaksi: sukses total atau batal total.
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
    });
    console.log("✓ Safety SQL diterapkan — trigger, invarian & index aktif.");
  } catch (err) {
    console.error("✗ Gagal menerapkan db_safety.sql:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ Tak terduga:", err);
  process.exit(1);
});
