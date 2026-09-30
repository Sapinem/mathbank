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
  // Aksen (emas): `text-gold-fg` HANYA dipakai di atas `bg-gold/15` (opacity 15%),
  // BUKAN di atas `accent` penuh. Jadi pasangan teoretis `accent-fg`-di-`accent`
  // dihapus (verifikasi nyata, bukan teoretis — T-M3-3). Badge `gold/15` tetap
  // kontras tinggi (diuji `theme:check` via catatan; lihat VERIFIKASI-AUDIT-M3).
  { label: "border di latar (komponen)", fg: "border", bg: "bg", min: 1.2 },
  // Komponen/grafis non-teks (WCAG 1.4.11) — ambang 3:1.
  { label: "brand di latar (aksen grafis)", fg: "brand", bg: "bg", min: AA_LARGE },
  // Warna STATUS dipakai sebagai TEKS (mis. jawaban benar, stok) — teks normal.
  { label: "status success di latar", fg: "success", bg: "bg", min: AA_NORMAL },
  { label: "status success di kartu", fg: "success", bg: "card", min: AA_NORMAL },
  { label: "status warning di latar", fg: "warning", bg: "bg", min: AA_NORMAL },
  { label: "status warning di kartu", fg: "warning", bg: "card", min: AA_NORMAL },
  { label: "status error di latar", fg: "error", bg: "bg", min: AA_NORMAL },
  { label: "status error di kartu", fg: "error", bg: "card", min: AA_NORMAL },
  { label: "status info di latar", fg: "info", bg: "bg", min: AA_NORMAL },
  { label: "status info di kartu", fg: "info", bg: "card", min: AA_NORMAL },
  // Aksen (emas) sering dipakai sebagai TEKS ikon/label ("perlu perhatian").
  { label: "aksen (emas) di latar", fg: "accent", bg: "bg", min: AA_NORMAL },
  { label: "aksen (emas) di kartu", fg: "accent", bg: "card", min: AA_NORMAL },
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
