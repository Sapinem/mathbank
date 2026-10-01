#!/usr/bin/env node
/**
 * Backup DB MathBank (M16) — `pg_dump` format kustom (terkompresi) + retensi.
 *
 * Tanpa dependency: memanggil `pg_dump` sistem lewat `child_process`. Aman:
 * URL koneksi dioper via env `PG*` ke proses anak (bukan di baris perintah),
 * sehingga **password tak pernah muncul di `ps`/history**.
 *
 * Pemakaian:
 *   node scripts/backup-db.mjs                 # backup ke BACKUP_DIR (default ./backups)
 *   BACKUP_DIR=/var/backups/mathbank node scripts/backup-db.mjs
 *   BACKUP_KEEP=14 node scripts/backup-db.mjs  # simpan 14 arsip terbaru
 *
 * Keluar kode ≠ 0 bila gagal (bisa dipakai cron/systemd-timer + alerting).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env" });

const dir = resolve(process.env.BACKUP_DIR ?? "./backups");
const keep = Number.parseInt(process.env.BACKUP_KEEP ?? "7", 10);

/** Parse DATABASE_URL → komponen (tanpa pernah mencetak password). */
function parseDbUrl(raw) {
  if (!raw) throw new Error("DATABASE_URL tidak di-set (cek .env).");
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: u.port || "5432",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

function main() {
  const db = parseDbUrl(process.env.DATABASE_URL);
  mkdirSync(dir, { recursive: true });

  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..+$/, ""); // 2026-09-30-23-50-00
  const file = join(dir, `${db.database}_${stamp}.dump`);

  console.log(`→ Backup ${db.database}@${db.host}:${db.port} → ${file}`);

  // Password via env anak (PGPASSWORD) — TIDAK lewat argumen (aman dari `ps`).
  const env = {
    ...process.env,
    PGPASSWORD: db.password,
    PGHOST: db.host,
    PGPORT: db.port,
    PGUSER: db.user,
  };
  try {
    execFileSync("pg_dump", ["-Fc", "-d", db.database, "-f", file], {
      env,
      stdio: ["ignore", "inherit", "inherit"],
    });
  } catch (err) {
    console.error("✗ pg_dump gagal:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const size = statSync(file).size;
  console.log(`✓ Backup selesai (${(size / 1024 / 1024).toFixed(2)} MB)`);

  // Retensi: hapus arsip .dump lama di luar `keep` terbaru.
  const dumps = readdirSync(dir)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of dumps.slice(keep)) {
    unlinkSync(join(dir, old.f));
    console.log(`· hapus arsip lama: ${old.f}`);
  }
  console.log(`✓ Selesai. Total arsip disimpan: ${Math.min(dumps.length, keep)}.`);
}

main();
