/**
 * Mesin tema MathBank — 3 warna sumber → token OKLCH.
 *
 * Menghasilkan src/styles/tokens/generated.css.
 * Jalankan: pnpm theme:build
 *
 * Verifikasi kontras (WCAG): pnpm theme:check.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { SOURCES, oklch, type Oklch } from "@/lib/theme/color";
import { accent, primary, tokensFor } from "./tokens";

const n = (v: Oklch) => oklch(v.l, v.c, v.h);

function block(mode: "light" | "dark"): string {
  const t = tokensFor(mode);
  return `  --mb-bg: ${n(t.bg)};
  --mb-fg: ${n(t.fg)};
  --mb-muted-fg: ${n(t["muted-fg"])};
  --mb-card: ${n(t.card)};
  --mb-card-fg: ${n(t["card-fg"])};
  --mb-border: ${n(t.border)};

  /* Brand — primer */
  --mb-brand: ${n(t.brand)};
  --mb-brand-hover: ${oklch(t.brand.l - 0.06, t.brand.c, t.brand.h)};
  --mb-brand-fg: ${n(t["brand-fg"])};

  /* Brand — aksen (emas, "perlu perhatian") */
  --mb-accent: ${n(t.accent)};
  --mb-accent-fg: ${n(t["accent-fg"])};

  /* Status — UNIVERSAL (tak ikut brand); sumber: tokens.ts */
  --mb-success: ${n(t.success)};
  --mb-error: ${n(t.error)};
  --mb-warning: ${n(t.warning)};
  --mb-info: ${n(t.info)};`;
}

const css = `/* GENERATED — jangan sunting manual. Jalankan: pnpm theme:build */
/* Sumber: primary ${SOURCES.primary}, accent ${SOURCES.accent} */

:root {
${block("light")}
}

.dark {
${block("dark")}
}
`;

const outPath = resolve("src/styles/tokens/generated.css");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, css);
console.log(`✓ Token tema ditulis: ${outPath}`);
console.log(`  primary = ${oklch(primary.l, primary.c, primary.h)}`);
console.log(`  accent  = ${oklch(accent.l, accent.c, accent.h)}`);
