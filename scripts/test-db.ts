/**
 * Jalankan tes integrasi DB (`pnpm test:db`) terhadap DB UJI.
 *
 * KENAPA skrip ini:
 * Service (L5) mengimpor `@/lib/db`, yang membaca `DATABASE_URL` saat import.
 * Tes integrasi WAJIB menyasar DB uji (`TEST_DATABASE_URL`), bukan DB dev,
 * karena tes ini menulis & menghapus data.
 *
 * Skrip ini:
 *   1. Membaca `.env` (DATABASE_URL dev, TEST_DATABASE_URL uji).
 *   2. Menjalankan Vitest dengan DATABASE_URL = TEST_DATABASE_URL.
 *   3. Gagal cepat bila TEST_DATABASE_URL tak diset (cegah salah sasaran ke dev).
 */
import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env" });

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  console.error(
    "✗ TEST_DATABASE_URL belum diset di .env — tes integrasi butuh DB uji terpisah.\n" +
      "  Contoh: TEST_DATABASE_URL=postgresql://mathbank:***@localhost:5433/mathbank_test\n" +
      "  Siapkan: sudo -u postgres psql -p 5433 -c 'CREATE DATABASE mathbank_test OWNER mathbank;'",
  );
  process.exit(1);
}

// Pagar: jangan pernah menyasar DB bernama sama dengan DB dev.
const devUrl = process.env.DATABASE_URL ?? "";
if (devUrl && testUrl === devUrl) {
  console.error("✗ TEST_DATABASE_URL sama dengan DATABASE_URL — tes destruktif diblokir.");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["vitest", "run", "--config", "vitest.db.config.mts", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl },
  },
);

process.exit(result.status ?? 1);
