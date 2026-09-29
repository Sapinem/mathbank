import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Konfigurasi tes INTEGRASI (butuh DB nyata) — lihat docs/STRATEGI-TES.md §5.
 *
 * Terpisah dari `vitest.config.mts` (unit murni, tanpa DB) supaya `pnpm test`
 * tetap cepat. Jalankan dengan: `pnpm test:db`
 *   - DATABASE_URL menunjuk DB UJI (mathbank_test), BUKAN DB dev.
 *   - File: `src/**\/*.db.test.ts`.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.db.test.ts"],
    // Tes integrasi berurutan (hindari rebutan koneksi/transaksi).
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
