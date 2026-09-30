#!/usr/bin/env node
/**
 * Pemasang pre-commit hook (M13 — S6). Murni Node, tanpa dependency.
 *
 * Menyalin skrip pemindai rahasia ke `.git/hooks/pre-commit` agar setiap
 * commit otomatis diperiksa. Dipanggil via `pnpm prepare` (otomatis saat
 * `pnpm install`) dan bisa manual: `node scripts/install-hooks.mjs`.
 *
 * Aman dijalankan berkali-kali (idempoten). Tidak menimpa hook asing:
 * bila sudah ada hook buatan pengguna, kita sisipkan pemanggilan kita.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const MARKER = "# >>> mathbank secret-scan >>>";
const END = "# <<< mathbank secret-scan <<<";

function hooksDir() {
  const out = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
    encoding: "utf8",
  }).trim();
  return resolve(out);
}

const BLOCK = `${MARKER}
# Pemindai rahasia MathBank (M13 S6) — memblokir commit berisi kredensial.
if command -v node >/dev/null 2>&1; then
  node "$(git rev-parse --show-toplevel)/scripts/secret-scan.mjs" || exit 1
fi
${END}
`;

function main() {
  let dir;
  try {
    dir = hooksDir();
  } catch {
    console.warn("⚠️  Bukan repositori Git — lewati pemasangan hook.");
    return;
  }
  mkdirSync(dir, { recursive: true });
  const hookPath = resolve(dir, "pre-commit");

  let existing = "";
  if (existsSync(hookPath)) {
    existing = readFileSync(hookPath, "utf8");
    if (existing.includes(MARKER)) {
      // Sudah terpasang — ganti blok agar versi terbaru.
      const clean = existing.replace(
        new RegExp(`${MARKER}[\\s\\S]*?${END}\\n?`, "g"),
        "",
      );
      writeFileSync(hookPath, clean.trimEnd() + "\n" + BLOCK, "utf8");
      console.log("✅ pre-commit hook diperbarui (secret-scan).");
      return;
    }
    existing = existing.trimEnd() + "\n\n";
  } else {
    existing = "#!/bin/sh\n\n";
  }

  writeFileSync(hookPath, existing + BLOCK, "utf8");
  chmodSync(hookPath, 0o755);
  console.log("✅ pre-commit hook terpasang (secret-scan).");
}

main();
