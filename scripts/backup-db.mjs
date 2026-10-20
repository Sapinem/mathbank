#!/usr/bin/env node
/**
 * Backup DB MathBank (M16) — `pg_dump` format kustom (terkompresi) + retensi 2 tingkat.
 *
 * Tanpa dependency: memanggil `pg_dump` sistem lewat `child_process`. Aman:
 * URL koneksi dioper via env `PG*` ke proses anak (bukan di baris perintah),
 * sehingga **password tak pernah muncul di `ps`/history**.
 *
 * **ACT-01 (Sprint 0)** — retensi dua tingkat sesuai DoD:
 *   1. `BACKUP_DIR` (harian)  → simpan `BACKUP_KEEP` dump terbaru (default 7).
 *   2. `BACKUP_ARCHIVE_DIR`   → salinan **mingguan** (satu per ISO-week) disimpan
 *      `BACKUP_ARCHIVE_DAYS` hari (default 30) sebagai arsip jangka menengah.
 * Retensi harian saja membuat satu korupsi logis yang baru ketahuan >7 hari
 * mustahil dipulihkan; arsip mingguan 30 hari menutup celah itu tanpa menambah
 * biaya disk berarti (≈4–5 berkas).
 *
 * Log dirotasi sendiri oleh skrip (`BACKUP_LOG`, ambang `BACKUP_LOG_MAX_BYTES`)
 * agar cron tidak butuh `logrotate` dan berkas log tidak tumbuh tanpa batas.
 *
 * Pemakaian:
 *   node scripts/backup-db.mjs                      # backup + retensi + log
 *   BACKUP_DIR=/var/backups/mathbank node scripts/backup-db.mjs
 *   BACKUP_KEEP=14 node scripts/backup-db.mjs       # simpan 14 dump harian
 *   BACKUP_ARCHIVE=0 node scripts/backup-db.mjs     # nonaktifkan arsip mingguan
 *
 * Keluar kode ≠ 0 bila gagal (bisa dipakai cron/systemd-timer + alerting).
 */
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env" });

const dir = resolve(process.env.BACKUP_DIR ?? "./backups");
const keep = Math.max(1, Number.parseInt(process.env.BACKUP_KEEP ?? "7", 10));
const archiveDir = resolve(
  process.env.BACKUP_ARCHIVE_DIR ?? join(dir, "archive"),
);
const archiveDays = Math.max(
  1,
  Number.parseInt(process.env.BACKUP_ARCHIVE_DAYS ?? "30", 10),
);
const archiveEnabled = process.env.BACKUP_ARCHIVE !== "0";
const logFile = resolve(process.env.BACKUP_LOG ?? join(dir, "backup.log"));
const logMaxBytes = Number.parseInt(
  process.env.BACKUP_LOG_MAX_BYTES ?? String(5 * 1024 * 1024),
  10,
);

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

/** Rotasi log bila melewati ambang: `x.log` → `x.log.1` (satu generasi cukup). */
function rotateLogIfNeeded() {
  try {
    if (!existsSync(logFile)) return;
    if (statSync(logFile).size < logMaxBytes) return;
    const rotated = `${logFile}.1`;
    if (existsSync(rotated)) unlinkSync(rotated);
    renameSync(logFile, rotated);
  } catch {
    // Rotasi gagal bukan alasan menggagalkan backup.
  }
}

/** Cetak ke stdout sekaligus append ke log (yang dirotasi sendiri). */
function say(line) {
  console.log(line);
  try {
    mkdirSync(resolve(logFile, ".."), { recursive: true });
    rotateLogIfNeeded();
    appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // Logging best-effort: jangan pernah menggagalkan backup karena log.
  }
}

/** Kandidat biner pg_dump: env → /usr/lib/postgresql/<major> (terbaru dulu) → PATH. */
function pgDumpCandidates() {
  const out = [];
  if (process.env.PG_DUMP_BIN) out.push(process.env.PG_DUMP_BIN);
  try {
    const majors = readdirSync("/usr/lib/postgresql")
      .filter((d) => /^\d+$/.test(d))
      .map(Number)
      .sort((a, b) => b - a);
    for (const m of majors) out.push(`/usr/lib/postgresql/${m}/bin/pg_dump`);
  } catch {
    // direktori tak ada (mis. macOS/Homebrew) → lanjut ke PATH
  }
  out.push("pg_dump"); // fallback PATH
  return [...new Set(out)].filter((p) => p === "pg_dump" || existsSync(p));
}

function versionOf(bin) {
  try {
    return execFileSync(bin, ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return "?";
  }
}

/**
 * Jalankan `pg_dump`, memilih biner yang **mayornya cocok** dengan server.
 *
 * `pg_dump` menolak server yang lebih baru ("aborting because of server version
 * mismatch"). Di mesin ini `/usr/bin/pg_dump` = 17 sementara server = 18, jadi
 * backup harian GAGAL diam-diam bila hanya mengandalkan PATH. Kita coba
 * kandidat satu per satu dan berhenti pada galat yang bukan soal versi.
 */
function runDump(db, file, env) {
  const timeout = Number.parseInt(process.env.BACKUP_TIMEOUT_MS ?? "600000", 10);
  let lastError = "";
  for (const bin of pgDumpCandidates()) {
    try {
      execFileSync(bin, ["-Fc", "-d", db.database, "-f", file], {
        env,
        stdio: ["ignore", "inherit", "pipe"],
        timeout,
      });
      return { bin, version: versionOf(bin) };
    } catch (err) {
      const stderr = String(err?.stderr ?? err?.message ?? "");
      lastError = stderr.split("\n")[0] || String(err?.message ?? err);
      if (/version mismatch/i.test(stderr)) {
        say(`· ${bin} (${versionOf(bin)}) tak cocok dengan server — coba kandidat lain`);
        continue;
      }
      throw new Error(`${bin}: ${lastError}`);
    }
  }
  throw new Error(`tidak ada pg_dump yang cocok dengan server — ${lastError}`);
}

/** Verifikasi dump dapat dibaca `pg_restore --list` (deteksi arsip terpotong). */
function verifyDump(pgDumpBin, file) {
  const sibling = join(pgDumpBin.replace(/\/pg_dump$/, ""), "pg_restore");
  const restore = existsSync(sibling) ? sibling : "pg_restore";
  const out = execFileSync(restore, ["--list", file], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const objects = out.split("\n").filter((l) => l && !l.startsWith(";")).length;
  if (objects < 1) throw new Error("arsip kosong menurut pg_restore --list");
  return objects;
}

/** Kunci ISO-week (`2026-W43`) — dasar dedupe arsip mingguan. */
function isoWeekKey(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay() || 7; // Senin = 1 … Minggu = 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Kamis pada minggu ISO tsb
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Daftar berkas `.dump` pada sebuah direktori, terbaru lebih dulu. */
function listDumps(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ f, t: statSync(join(path, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
}

/**
 * Salin dump hari ini ke arsip bila ISO-week ini belum punya arsip.
 * Idempoten: menjalankan backup dua kali dalam satu minggu tidak menumpuk arsip.
 */
function archiveWeekly(file, dbName, now) {
  if (!archiveEnabled) return;
  mkdirSync(archiveDir, { recursive: true });
  const week = isoWeekKey(now);
  const marker = `${dbName}_${week}`;
  if (listDumps(archiveDir).some((d) => d.f.startsWith(marker))) {
    say(`· arsip mingguan ${week} sudah ada — lewati`);
    return;
  }
  const target = join(archiveDir, `${marker}.dump`);
  copyFileSync(file, target);
  say(`✓ arsip mingguan dibuat: ${target}`);
}

/** Hapus arsip mingguan yang lebih tua dari `archiveDays`. */
function pruneArchive(now) {
  if (!archiveEnabled) return;
  const cutoff = now.getTime() - archiveDays * 86400000;
  for (const old of listDumps(archiveDir)) {
    if (old.t < cutoff) {
      unlinkSync(join(archiveDir, old.f));
      say(`· hapus arsip mingguan kedaluwarsa: ${old.f}`);
    }
  }
}

function main() {
  const db = parseDbUrl(process.env.DATABASE_URL);
  mkdirSync(dir, { recursive: true });

  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..+$/, ""); // 2026-09-30-23-50-00
  const file = join(dir, `${db.database}_${stamp}.dump`);

  say(`→ Backup ${db.database}@${db.host}:${db.port} → ${file}`);

  // Password via env anak (PGPASSWORD) — TIDAK lewat argumen (aman dari `ps`).
  const env = {
    ...process.env,
    PGPASSWORD: db.password,
    PGHOST: db.host,
    PGPORT: db.port,
    PGUSER: db.user,
  };
  let usedBin = "pg_dump";
  try {
    const used = runDump(db, file, env);
    usedBin = used.bin;
    say(`· pg_dump: ${used.version}`);
  } catch (err) {
    // Jangan tinggalkan dump parsial yang bisa dikira valid saat restore.
    try {
      if (existsSync(file)) unlinkSync(file);
    } catch {
      /* abaikan */
    }
    say(`✗ pg_dump gagal: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const size = statSync(file).size;
  if (size === 0) {
    try {
      unlinkSync(file);
    } catch {
      /* abaikan */
    }
    say("✗ dump kosong (0 byte) — dibuang");
    process.exit(1);
  }
  say(`✓ Backup selesai (${(size / 1024 / 1024).toFixed(2)} MB)`);

  // Retensi tingkat 1: hanya `keep` dump harian terbaru.
  const dumps = listDumps(dir);
  for (const old of dumps.slice(keep)) {
    unlinkSync(join(dir, old.f));
    say(`· hapus dump harian lama: ${old.f}`);
  }
  say(`✓ Selesai. Dump harian disimpan: ${Math.min(dumps.length, keep)}.`);

  // Retensi tingkat 2: arsip mingguan 30 hari.
  archiveWeekly(file, db.database, now);
  pruneArchive(now);
  if (archiveEnabled) {
    say(`✓ Arsip mingguan tersimpan: ${listDumps(archiveDir).length}.`);
  }
}

try {
  main();
} catch (err) {
  // Tangkap juga kegagalan non-pg_dump (mis. DATABASE_URL hilang) → tetap ke log.
  say(`✗ backup gagal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
