import { defineConfig, devices } from "@playwright/test";

/**
 * Konfigurasi e2e (Playwright).
 *
 * - `webServer`: menjalankan dev server otomatis di port 3100 (khusus e2e),
 *   dengan `AUTH_DEV_BYPASS=1` agar API dapat diakses tanpa login (dev).
 * - Dua proyek: `desktop` (1280×800) & `mobile` (Pixel 5, ~393px) —
 *   menguji asas responsif "kelola di desktop, lihat di mobile".
 */
export default defineConfig({
  // Pindah ke e2e-manual/ — TIDAK masuk gerbang `pnpm check` (rapuh di dev).
  // Strategi utama: tes alur Vitest (L4/L5) + smoke:prod. Lihat
  // docs/EVALUASI-STRATEGI-E2E.md. Jalankan manual: pnpm e2e:manual.
  testDir: "./e2e-manual",
  // Panaskan rute dulu: dev compile on-demand → hindari ERR_ABORTED saat tes.
  globalSetup: "./e2e-manual/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Dev server kewalahan bila 2 worker menghampar rute belum ter-compile.
  retries: 1,
  workers: 1,
  reporter: [["list"]],
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    // Dev server (port 3100 terpisah). Global-setup memanaskan rute lebih dulu
    // agar compile on-demand tak menabrak tes. 1 worker → beban server stabil.
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { AUTH_DEV_BYPASS: "true", AUTH_GUARD_DISABLED: "true", DEMO_LOGIN: "enabled" },
  },
});
