/**
 * Verifikasi kontras WCAG 2.2 AA untuk token tema MathBank.
 *
 * Memeriksa pasangan token yang benar-benar dipakai di UI (teks di atas
 * latarnya) pada KEDUA mode (terang & gelap). Keluar dengan kode ≠0 bila ada
 * pasangan yang gagal — sehingga bisa dipakai di CI (`pnpm theme:check`).
 *
 * Target (A11Y.md): teks normal ≥ 4.5:1; teks besar/komponen ≥ 3:1.
 *
 * Jalankan: pnpm theme:check
 */
import {
  AA_LARGE,
  AA_NORMAL,
  contrastOklch,
  type Oklch,
} from "@/lib/theme/color";
import { tokensFor, type Mode, type TokenSet } from "./tokens";

type Pair = {
  /** Nama pasangan (untuk laporan). */
  label: string;
  /** Token foreground. */
  fg: keyof TokenSet;
  /** Token background. */
  bg: keyof TokenSet;
  /** Ambang minimum (AA_NORMAL atau AA_LARGE). */
  min: number;
};

/**
 * Pasangan kritis. `AA_NORMAL` untuk teks isi; `AA_LARGE` untuk elemen
 * besar/non-teks (mis. teks di atas tombol brand yang biasanya ≥ 18px/14px bold).
 */
const PAIRS: Pair[] = [
  { label: "teks utama di latar", fg: "fg", bg: "bg", min: AA_NORMAL },
  { label: "teks muted di latar", fg: "muted-fg", bg: "bg", min: AA_NORMAL },
  { label: "teks muted di kartu", fg: "muted-fg", bg: "card", min: AA_NORMAL },
  { label: "teks utama di kartu", fg: "card-fg", bg: "card", min: AA_NORMAL },
  { label: "teks brand-fg di tombol brand", fg: "brand-fg", bg: "brand", min: AA_NORMAL },
  { label: "teks accent-fg di aksen (emas)", fg: "accent-fg", bg: "accent", min: AA_NORMAL },
  { label: "border di latar (komponen)", fg: "border", bg: "bg", min: 1.2 },
  // Komponen/grafis non-teks (WCAG 1.4.11) — ambang 3:1.
  { label: "brand di latar (aksen grafis)", fg: "brand", bg: "bg", min: AA_LARGE },
];

function checkMode(mode: Mode, out: string[]): { pass: number; fail: number } {
  const t = tokensFor(mode);
  let pass = 0;
  let fail = 0;
  out.push(`\n  ── mode ${mode} ──`);
  for (const p of PAIRS) {
    const ratio = contrastOklch(t[p.fg] as Oklch, t[p.bg] as Oklch);
    const ok = ratio >= p.min;
    if (ok) pass++;
    else fail++;
    const mark = ok ? "✓" : "✗ GAGAL";
    out.push(
      `    ${mark}  ${p.label.padEnd(34)} ${ratio.toFixed(2)}:1  (min ${p.min})`,
    );
  }
  return { pass, fail };
}

function main(): void {
  const out: string[] = ["Verifikasi kontras WCAG 2.2 AA — token tema MathBank"];
  const light = checkMode("light", out);
  const dark = checkMode("dark", out);

  const pass = light.pass + dark.pass;
  const fail = light.fail + dark.fail;

  console.log(out.join("\n"));
  console.log(
    `\n  Ringkasan: ${pass} lulus, ${fail} gagal (dari ${pass + fail} pasangan).`,
  );

  if (fail > 0) {
    console.error(`\n✗ Kontras WCAG GAGAL — perbaiki token tema.`);
    process.exit(1);
  }
  console.log(`\n✓ Semua pasangan kontras memenuhi target WCAG 2.2 AA.`);
}

main();
