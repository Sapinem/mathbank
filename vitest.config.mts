import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Cakupan diukur pada LOGIKA MURNI yang dapat diuji tanpa DB/HTTP
      // (guard izin, FSM, kontrak, tampilan label, renderer matematika).
      // Service/route/hook (butuh DB) diuji lewat e2e (lihat e2e/).
      include: [
        "src/lib/auth/guards.ts",
        "src/lib/auth/roles.ts",
        "src/lib/auth/permissions.ts",
        "src/lib/fsm/question-fsm.ts",
        "src/lib/contracts/question.ts",
        "src/lib/display/labels.ts",
        "src/lib/auth/actor.ts",
      ],
      // Ambang = lantai jujur saat ini; NAIKKAN bertahap, jangan turunkan.
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
