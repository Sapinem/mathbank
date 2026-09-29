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
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
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
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { AUTH_DEV_BYPASS: "true" },
  },
});
