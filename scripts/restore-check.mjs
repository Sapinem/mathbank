#!/usr/bin/env node
/**
 * Uji RESTORE backup MathBank (M16) — "backup yang belum diuji-restore = bukan backup".
 *
 * Alur: buat DB sementara → `pg_restore` dari arsip → jalankan verifikasi invarian
 * skema (lewat `db:verify` dgn DATABASE_URL dialihkan) → hapus DB sementara.
 *
 * Pemakaian:
 *   node scripts/restore-check.mjs backups/mathbank_2026-09-30-23-50-00.dump
 *   # atau tanpa argumen → pakai .dump terbaru di BACKUP_DIR
 *
 * Aman: password via PGPASSWORD (env anak), tak pernah di argumen.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env" });

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

/** Ambil arsip dari argumen, atau yang terbaru di BACKUP_DIR. */
function pickDump() {
  const arg = process.argv[2];
  if (arg) return resolve(arg);
  const dir = resolve(process.env.BACKUP_DIR ?? "./backups");
  if (!existsSync(dir)) throw new Error(`Direktori backup tak ada: ${dir}`);
  const dumps = readdirSync(dir)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ f: join(dir, f), t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!dumps.length) throw new Error(`Tak ada .dump di ${dir}`);
  return dumps[0].f;
}

function psql(env, dbName, sql) {
  return execFileSync("psql", ["-d", dbName, "-tAc", sql], {
    env,
    encoding: "utf8",
  }).trim();
}

function main() {
  const main = parseDbUrl(process.env.DATABASE_URL);
  const dump = pickDump();
  const tmpDb = `mathbank_restore_${Date.now()}`;

  const env = {
    ...process.env,
    PGPASSWORD: main.password,
    PGHOST: main.host,
    PGPORT: main.port,
    PGUSER: main.user,
  };

  console.log(`→ Uji restore ${dump} → DB sementara "${tmpDb}"`);

  // 1. Buat DB kosong (koneksi ke DB administratif "postgres").
  psql(env, "postgres", `CREATE DATABASE ${tmpDb}`);

  try {
    // 2. Restore. Catatan: ekstensi (pgvector) harus tersedia di server —
    //    `pg_restore` akan membuatnya bila role punya hak (lihat db:extensions).
    execFileSync("pg_restore", ["-d", tmpDb, "--no-owner", "--no-acl", dump], {
      env,
      stdio: ["ignore", "inherit", "inherit"],
    });
    console.log("✓ Restore selesai");

    // 3. Verifikasi invarian skema pada DB hasil restore.
    const restoreUrl = `postgresql://${encodeURIComponent(main.user)}:${encodeURIComponent(main.password)}@${main.host}:${main.port}/${tmpDb}`;
    console.log("→ Menjalankan verifikasi skema (db:verify) pada DB restore…");
    execFileSync("npm", ["run", "db:verify"], {
      env: { ...process.env, DATABASE_URL: restoreUrl },
      stdio: ["ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    console.log("✓ VERIFIKASI LULUS — backup dapat dipulihkan & skema utuh.");
  } finally {
    // 4. Bersihkan DB sementara (selalu, walau verifikasi gagal).
    try {
      psql(env, "postgres", `DROP DATABASE IF EXISTS ${tmpDb} WITH (FORCE)`);
      console.log(`· DB sementara "${tmpDb}" dihapus.`);
    } catch (e) {
      console.warn(`⚠ Gagal hapus DB sementara "${tmpDb}":`, e instanceof Error ? e.message : e);
    }
  }
}

main();
