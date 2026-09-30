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
    // Tes integrasi DB (*.db.test.ts) dikecualikan di sini — dijalankan
    // terpisah via vitest.db.config.mts (butuh PG). Lihat docs/STRATEGI-TES.md.
    exclude: ["**/node_modules/**", "src/**/*.db.test.ts"],
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
        "src/lib/auth/password-policy.ts",
        "src/lib/api/route-wrapper.ts",
        "src/lib/api/rate-limit.ts",
        "src/lib/db/projections/question.ts",
        "src/lib/theme/color.ts",
        "src/lib/search/fusion.ts",
        "src/lib/taxonomy/tree.ts",
        "src/lib/ingest/parsers/clean.ts",
        "src/lib/crypto/secrets.ts",
        "src/lib/ai/client.ts",
        "src/lib/ai/enrich.ts",
        "src/lib/mcp/policy.ts",
        "src/lib/export/xml-escape.ts",
        "src/lib/export/latex-to-moodle.ts",
        "src/lib/export/moodle-map.ts",
        "src/lib/export/moodle-xml.ts",
        "src/lib/export/gitsync.ts",
        "src/lib/embedding/bge-m3.ts",
        "src/lib/ingest/parsers/segment.ts",
        "src/lib/ingest/parsers/items.ts",
        "src/lib/ingest/parsers/adapters/index.ts",
        "src/lib/ingest/parsers/adapters/mathcyber.ts",
        "src/lib/ingest/parsers/adapters/m4thlab.ts",
        "src/lib/ingest/parsers/adapters/defantri.ts",
        "src/lib/ingest/parsers/adapters/pusmendik-tka.ts",
        "src/lib/ingest/parsers/adapters/pusmendik-dayaserap.ts",
        "src/lib/ingest/media/resolve-url.ts",
        "src/lib/ingest/media/fetch.ts",
        "src/lib/ingest/media/store.ts",
        "src/lib/ingest/media/ingest-media.ts",
        // Komponen kustom (BUKAN vendor ui/**) yang punya tes komponen.
        "src/components/questions/question-card.tsx",
        "src/components/questions/enrich-button.tsx",
        "src/components/questions/bank-soal-view.tsx",
        "src/components/layout/page-header.tsx",
        "src/components/layout/skip-link.tsx",
        "src/components/layout/sidebar-user.tsx",
        "src/lib/hooks/use-media-query.ts",
        "src/components/layout/app-shell.tsx",
        "src/components/layout/command-palette.tsx",
        "src/components/layout/nav-utils.ts",
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
