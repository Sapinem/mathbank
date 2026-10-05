import { defineConfig, globalIgnores } from "eslint/config";
import { fixupPluginRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";

/**
 * ESLint 10 compatibility shim (MAT-48).
 *
 * ESLint 10 menghapus API rule-context usang (`context.getFilename()`,
 * `context.getSourceCode()`, `sourceCode.isSpaceBetweenTokens()`). Beberapa
 * plugin yang ditarik `eslint-config-next@16.3.8` (versi stabil terakhir) belum
 * merilis dukungan ESLint 10 dan crash saat aturannya dimuat
 * (`TypeError: ...getFilename is not a function`). `fixupPluginRules` dari
 * `@eslint/compat` memulihkan API lama secara transparan hingga plugin upstream
 * menyusul (jsx-eslint/eslint-plugin-react#3977).
 *
 * Plugin yang di-shim: `react`, `react-hooks`, `import`.
 * `eslint-plugin-jsx-a11y@6.10.2` & `@next/eslint-plugin-next@16.3.8` sudah
 * bersih di ESLint 10, jadi tidak di-shim.
 *
 * Hapus shim ini setelah plugin-plugin di atas menyatakan peer `eslint: ^10`.
 */
const fixedUp = {
  react: fixupPluginRules(react),
  "react-hooks": fixupPluginRules(reactHooks),
  import: fixupPluginRules(importPlugin),
};

/**
 * Ganti definisi plugin di dalam config bawaan `eslint-config-next` dengan
 * versi yang sudah di-shim. Dilakukan in-place (bukan config terpisah) karena
 * flat config melarang mendeklarasikan ulang nama plugin yang sama.
 */
const applyShim = (configs) =>
  configs.map((entry) => {
    if (!entry.plugins) return entry;
    const plugins = { ...entry.plugins };
    for (const [name, fixed] of Object.entries(fixedUp)) {
      if (plugins[name]) plugins[name] = fixed;
    }
    return { ...entry, plugins };
  });

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
  ...applyShim(nextVitals),
  ...applyShim(nextTs),
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
