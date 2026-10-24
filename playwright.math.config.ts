import { defineConfig, devices } from "@playwright/test";

/**
 * Config e2e KHUSUS VERIFIKASI tata letak matematika (sementara).
 *
 * Alasan terpisah dari `playwright.config.ts`: port default (3100) sudah
 * ditempati aplikasi lain (Paperclip) di mesin ini, dan config utama
 * meng-hardcode port itu. Di sini memakai port bebas 3155 + setelan sama
 * (AUTH_DEV_BYPASS) agar tes bisa menembak MathBank dev yang benar.
 */
const PORT = 3010;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e-manual",
  testMatch: /(math-layout|diag-login)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE,
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
    command: `pnpm dev --port ${PORT}`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { AUTH_DEV_BYPASS: "true", AUTH_GUARD_DISABLED: "true", DEMO_LOGIN: "enabled" },
  },
});
