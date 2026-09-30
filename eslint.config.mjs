import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

/**
 * Aturan kustom MathBank.
 *
 * CONSTRAINT #34: **jangan `.select()` tanpa kolom di jalur baca API** — itu
 * `SELECT *` yang membocorkan `answer_key`, `embedding*`, `aiTagged*`. Pakai
 * proyeksi `questionColumns()`/`optionColumns()` (`src/lib/db/projections/question.ts`).
 *
 * Cakupan: hanya **`src/app/api/**`** (jalur yang menghasilkan respons API).
 * Jalur internal (FSM, audit, worker ingest) boleh `selectAll()` dengan alasan
 * terdokumentasi (lihat `projections/question.ts`).
 */
const noBareSelectInApi = {
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.property.name='select'][arguments.length=0]",
        message:
          "CONSTRAINT #34: jangan `.select()` tanpa kolom di jalur baca API — bisa bocorkan answer_key/embedding. Pakai proyeksi (questionColumns()/optionColumns()).",
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Hasil generate (bukan kode sumber):
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  // CONSTRAINT #34 — berlaku khusus jalur API.
  {
    files: ["src/app/api/**/*.ts"],
    ...noBareSelectInApi,
  },
  /**
   * M15 — aksesibilitas (WCAG 2.2 AA). `eslint-config-next` sudah mendaftarkan
   * plugin `jsx-a11y`; di sini kita **melengkapi aturannya** agar masalah a11y
   * tertangkap saat menulis (mis. alt gambar, label kontrol, peran ARIA). Tidak
   * mendeklarasikan ulang plugin (akan error "Cannot redefine plugin").
   */
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
]);

export default eslintConfig;
