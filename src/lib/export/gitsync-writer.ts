import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitsyncFile } from "@/lib/export/gitsync";

const execFileAsync = promisify(execFile);

/**
 * Penulis folder GitSync ke disk (M12, D7/D8).
 *
 * GitSync **tidak** memakai arsip; ia membaca isi folder. Karena MathBank & user
 * berada di mesin yang sama, ekspor **menulis berkas langsung** ke:
 *
 *   `<MATHBANK_EXPORT_DIR>/<slug-paket>/top/...`
 *
 * lalu menjalankan Git (`init` bila perlu → `add` → `commit`) pada folder paket (D8).
 */

/** Akar folder ekspor (default `~/mathbank-export`, bisa dioverride env). */
export function exportRoot(): string {
  const fromEnv = process.env.MATHBANK_EXPORT_DIR?.trim();
  return fromEnv ? resolve(fromEnv) : join(homedir(), "mathbank-export");
}

/** Slug aman untuk nama folder paket. */
function slugify(title: string): string {
  const s = title
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return s || "paket";
}

/** Jalankan git di sebuah direktori; kembalikan stdout (trim). */
async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    timeout: 30_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout.trim();
}

export interface WriteResult {
  /** Folder absolut tempat berkas ditulis. */
  directory: string;
  /** Jumlah berkas ditulis. */
  written: number;
  /** Apakah Git commit dibuat? */
  committed: boolean;
  /** Hash commit (bila ada). */
  commitHash: string | null;
  /** Pesan status (mis. "tidak ada perubahan"). */
  note: string;
}

/**
 * Tulis berkas GitSync ke `<root>/<slug>/`, lalu commit via Git.
 * Folder paket dibersihkan lebih dulu (agar ekspor = cermin persis paket).
 */
export async function writeGitsyncFolder(
  bundleTitle: string,
  files: GitsyncFile[],
  opts: { commit?: boolean; message?: string } = {},
): Promise<WriteResult> {
  const doCommit = opts.commit ?? true;
  const dir = join(exportRoot(), slugify(bundleTitle));

  // Bersihkan folder paket (kecuali `.git` agar riwayat commit tetap ada).
  await mkdir(dir, { recursive: true });
  for (const rel of ["top"]) {
    await rm(join(dir, rel), { recursive: true, force: true });
  }

  // Tulis semua berkas.
  let written = 0;
  for (const f of files) {
    // Cegah path traversal: tolak `..` dan jalur absolut.
    const safeRel = f.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (safeRel.split("/").includes("..")) continue;
    const target = join(dir, safeRel);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, f.content, "utf8");
    written++;
  }

  if (!doCommit) {
    return { directory: dir, written, committed: false, commitHash: null, note: "commit dilewati" };
  }

  // ── Git: init bila perlu → add → commit ──
  const isRepo = existsSync(join(dir, ".git"));
  if (!isRepo) {
    await git(dir, ["init", "-q"]);
    // Identitas lokal (agar commit tak gagal tanpa config global).
    await git(dir, ["config", "user.email", "mathbank@localhost"]);
    await git(dir, ["config", "user.name", "MathBank"]);
  }
  await git(dir, ["add", "-A"]);

  // Ada perubahan? (commit tanpa perubahan = gagal)
  const status = await git(dir, ["status", "--porcelain"]);
  if (!status) {
    return { directory: dir, written, committed: false, commitHash: null, note: "tidak ada perubahan" };
  }

  const message =
    opts.message ?? `Ekspor GitSync: ${bundleTitle} (${written} berkas)`;
  await git(dir, ["commit", "-q", "-m", message]);
  const hash = await git(dir, ["rev-parse", "--short", "HEAD"]);

  return { directory: dir, written, committed: true, commitHash: hash, note: "commit dibuat" };
}
