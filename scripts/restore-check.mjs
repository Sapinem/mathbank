#!/usr/bin/env node
/**
 * ACT-07 — Latihan restore drill: buktikan dump benar-benar BISA dipulihkan.
 *
 * Alur (setiap fase dicatat durasi + load average):
 *   0. sapu      — buang sisa DB `mathbank_restore_*` dari latihan sebelumnya
 *   1. preflight — arsip terbaca `pg_restore --list` (deteksi arsip terpotong)
 *   2. createdb  — DB sementara `mathbank_restore_<stamp>`
 *   3. pg_restore— pulihkan arsip ke DB sementara
 *   4. verify    — invarian inti via SQL langsung (jumlah baris, orphan FK,
 *                  jumlah indeks/FK/trigger/CHECK, HNSW, PK uuidv7) dan
 *                  opsional `pnpm db:verify` (`--with-db-verify`)
 *   5. cleanup   — DB sementara SELALU dihapus; sisa DB diperiksa di akhir
 *
 * Bukti hasil ditulis ke `backups/restore-drill-<stamp>.json` (angka nyata,
 * bukan asumsi) supaya bisa dilampirkan ke tiket.
 *
 * Pemakaian:
 *   node scripts/restore-check.mjs                    # arsip .dump terbaru
 *   node scripts/restore-check.mjs backups/x.dump     # arsip tertentu
 *   node scripts/restore-check.mjs --with-db-verify   # + `pnpm db:verify`
 *   node scripts/restore-check.mjs --keep             # biarkan DB (debug)
 *
 * Kenapa invarian dicek lewat `psql` langsung, bukan hanya `db:verify`:
 * `tsx` + bundel TS menambah lapisan dependensi yang tak perlu saat insiden;
 * `psql` selalu ada di host yang punya PostgreSQL. `db:verify` tetap tersedia
 * sebagai fase opsional untuk cek drift skema lengkap.
 *
 * Aman: password hanya lewat env anak (PGPASSWORD / DATABASE_URL), tidak
 * pernah muncul di baris perintah (`ps`).
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env" });

const argv = process.argv.slice(2);
const WITH_DB_VERIFY = argv.includes("--with-db-verify");
const KEEP_DB = argv.includes("--keep");
const dumpArg = argv.find((a) => !a.startsWith("--"));

/**
 * Ambang invarian skema — selaras `scripts/db-verify.ts`.
 * MAT-39: 26 tabel. MAT-146: `question_options` di-drop → 25 tabel, −1 FK,
 * −2 indeks (PK + idx_question_options_question), −1 trigger updated_at.
 */
const EXPECTED = {
  tables: 25,
  checks: 2,
  fks: 19,
  indexes: 78,
  hnsw: 1,
  triggers: 23,
};

/**
 * Relasi yang keutuhan foreign key-nya diperiksa langsung (orphan harus 0).
 * MAT-146: `question_options` sudah di-drop — digantikan invarian turunan
 * `questions_with_options` di bawah.
 */
const ORPHAN_CHECKS = ["bundle_items", "question_topics"];

/**
 * Tabel yang jumlah barisnya dilaporkan sebagai bukti isi ikut pulih.
 * `user` milik Better-Auth dan merupakan kata kunci SQL → harus dikutip.
 * `min` = batas bawah yang WAJIB terpenuhi di DB hasil restore. Tabel relasi
 * yang memang masih kosong di produksi (`question_topics`, `question_tags`)
 * memakai `min: 0`: kosongnya bukan kegagalan restore, dan kesetaraan dengan
 * DB sumber tetap dilaporkan.
 */
const ROW_TABLES = [
  { label: "questions", sql: "questions", min: 1 },
  { label: "solutions", sql: "solutions", min: 1 },
  { label: "question_topics", sql: "question_topics", min: 0 },
  { label: "question_tags", sql: "question_tags", min: 0 },
  { label: "topics", sql: "topics", min: 1 },
  { label: "bundles", sql: "bundles", min: 1 },
  { label: "bundle_items", sql: "bundle_items", min: 1 },
  { label: "audit_logs", sql: "audit_logs", min: 1 },
  { label: "media_assets", sql: "media_assets", min: 1 },
  { label: "user", sql: '"user"', min: 1 },
];

/**
 * Invarian turunan (bukan tabel) — MAT-146: karena `question_options` di-drop,
 * bukti "opsi ikut pulih" harus dibaca dari `questions.data_payload.options`
 * (JSONB). Dievaluasi sebagai subquery, jadi bentuknya `SELECT <expr>`.
 */
const DERIVED_CHECKS = [
  {
    label: "questions_with_options",
    sql: `SELECT count(*)::text FROM questions
           WHERE deleted_at IS NULL
             AND jsonb_array_length(
                   CASE jsonb_typeof(data_payload->'options')
                     WHEN 'array' THEN data_payload->'options'
                     ELSE '[]'::jsonb
                   END) > 0`,
    min: 1,
  },
];

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
  if (dumpArg) return resolve(dumpArg);
  const dir = resolve(process.env.BACKUP_DIR ?? "./backups");
  if (!existsSync(dir)) throw new Error(`Direktori backup tak ada: ${dir}`);
  const dumps = readdirSync(dir)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ f: join(dir, f), t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!dumps.length) throw new Error(`Tak ada .dump di ${dir}`);
  return dumps[0].f;
}

/**
 * Kandidat `pg_restore`: env → `/usr/lib/postgresql/<major>` (mayor tertinggi
 * dulu) → PATH. Di host ini `/usr/bin/pg_restore` = 17 sementara server = 18;
 * klien yang lebih tua bisa menolak/menyalahartikan arsip v18.
 */
function pgRestoreCandidates() {
  const out = [];
  if (process.env.PG_RESTORE_BIN) out.push(process.env.PG_RESTORE_BIN);
  try {
    const majors = readdirSync("/usr/lib/postgresql")
      .filter((d) => /^\d+$/.test(d))
      .map(Number)
      .sort((a, b) => b - a);
    for (const m of majors) out.push(`/usr/lib/postgresql/${m}/bin/pg_restore`);
  } catch {
    // direktori tak ada (macOS/Homebrew) → andalkan PATH
  }
  out.push("pg_restore");
  return [...new Set(out)].filter((p) => p === "pg_restore" || existsSync(p));
}

function versionOf(bin) {
  try {
    return execFileSync(bin, ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return "?";
  }
}

/** `psql` ke DB tertentu, keluaran `k|v` tanpa header (siap di-parse). */
function psql(env, dbName, sql) {
  return execFileSync(
    "psql",
    ["-X", "-q", "-tA", "-F", "|", "-v", "ON_ERROR_STOP=1", "-d", dbName, "-c", sql],
    { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

function loadAvg() {
  try {
    const [a, b, c] = readFileSync("/proc/loadavg", "utf8").trim().split(" ");
    return `${a} ${b} ${c}`;
  } catch {
    return "?";
  }
}

/** Jalankan satu fase; catat durasi & load average. */
function phase(name, fn, timings) {
  const t0 = Date.now();
  const load = loadAvg();
  try {
    const out = fn();
    const ms = Date.now() - t0;
    timings.push({ phase: name, ms, loadAvg: load, ok: true });
    console.log(`✓ ${name}: ${(ms / 1000).toFixed(2)}s (load ${load})`);
    return out;
  } catch (err) {
    const ms = Date.now() - t0;
    const message = String(err?.stderr ?? err?.message ?? err)
      .split("\n")
      .filter(Boolean)
      .slice(-3)
      .join(" / ");
    timings.push({ phase: name, ms, loadAvg: load, ok: false, error: message });
    console.log(`✗ ${name}: ${(ms / 1000).toFixed(2)}s (load ${load}) — ${message}`);
    throw err;
  }
}

/** Daftar DB sementara yang tertinggal (dari latihan sebelumnya). */
function leftoverTempDbs(env) {
  const out = psql(
    env,
    "postgres",
    "SELECT datname FROM pg_database WHERE datname LIKE 'mathbank\\_restore\\_%' ORDER BY datname",
  );
  return out ? out.split("\n").filter(Boolean) : [];
}

/** SQL invarian inti — satu perjalanan ke server. */
function invariantSql() {
  const rows = ROW_TABLES.map(
    (t) => `SELECT 'rows:${t.label}' AS k, count(*)::text AS v FROM ${t.sql}`,
  );
  for (const c of DERIVED_CHECKS) {
    rows.push(`SELECT 'rows:${c.label}' AS k, (${c.sql}) AS v`);
  }
  return `
SELECT 'tables' k, count(*)::text v FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
UNION ALL SELECT 'checks', count(*)::text FROM pg_constraint
  WHERE contype='c' AND connamespace='public'::regnamespace
UNION ALL SELECT 'fks', count(*)::text FROM pg_constraint
  WHERE contype='f' AND connamespace='public'::regnamespace
UNION ALL SELECT 'indexes', count(*)::text FROM pg_indexes WHERE schemaname='public'
UNION ALL SELECT 'hnsw', count(*)::text FROM pg_indexes WHERE indexdef ILIKE '%hnsw%'
UNION ALL SELECT 'triggers', count(*)::text FROM pg_trigger WHERE NOT tgisinternal
UNION ALL SELECT 'pk_default', COALESCE((SELECT column_default FROM information_schema.columns
  WHERE table_name='questions' AND column_name='id'),'-')
UNION ALL SELECT 'extensions', COALESCE((SELECT string_agg(extname,',' ORDER BY extname)
  FROM pg_extension),'-')
UNION ALL SELECT 'orphans:bundle_items',
  (SELECT count(*)::text FROM bundle_items bi
     LEFT JOIN bundles b ON b.id=bi.bundle_id WHERE b.id IS NULL)
UNION ALL SELECT 'orphans:question_topics',
  (SELECT count(*)::text FROM question_topics qt
     LEFT JOIN questions q ON q.id=qt.question_id WHERE q.id IS NULL)
UNION ALL ${rows.join("\nUNION ALL ")}
`.trim();
}

function parseKv(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf("|");
    if (i < 0) continue;
    map.set(line.slice(0, i), line.slice(i + 1));
  }
  return map;
}

function main() {
  const main = parseDbUrl(process.env.DATABASE_URL);
  const dump = pickDump();
  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..+$/, "");
  const tmpDb = `mathbank_restore_${Date.now()}`;
  const timings = [];
  const started = Date.now();

  const env = {
    ...process.env,
    PGPASSWORD: main.password,
    PGHOST: main.host,
    PGPORT: main.port,
    PGUSER: main.user,
    PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT ?? "10",
  };

  // URL untuk proses anak yang butuh DATABASE_URL (`db:verify`). Password asli
  // dioper lewat env — bukan argumen — jadi tak terlihat di `ps`.
  const restoreUrl = `postgresql://${encodeURIComponent(main.user)}:${encodeURIComponent(
    main.password,
  )}@${main.host}:${main.port}/${tmpDb}`;

  console.log(`→ Latihan restore: ${dump}`);
  console.log(`  sumber: ${main.database}@${main.host}:${main.port} | target: ${tmpDb}`);
  console.log(`  load average awal: ${loadAvg()}`);

  const result = {
    startedAt: new Date(started).toISOString(),
    dump,
    dumpBytes: statSync(dump).size,
    source: `${main.database}@${main.host}:${main.port}`,
    tempDatabase: tmpDb,
    pgRestore: null,
    archiveObjects: null,
    invariants: {},
    sourceCounts: {},
    timings,
    leftovers: [],
    ok: false,
  };

  let exitCode = 0;
  let created = false;
  try {
    // ── 0. sapu sisa DB sementara dari latihan sebelumnya ────────────────────
    const stale = leftoverTempDbs(env);
    if (stale.length) {
      console.log(`· sisa DB sementara: ${stale.join(", ")} — dibersihkan`);
      for (const db of stale) {
        psql(env, "postgres", `DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
      }
      const still = leftoverTempDbs(env);
      if (still.length) throw new Error(`DB sementara tak bisa dibersihkan: ${still.join(", ")}`);
    }

    // ── 1. preflight: arsip terbaca + jumlah objek ───────────────────────────
    const restoreBin = phase(
      "preflight (pg_restore --list)",
      () => {
        let lastErr = "";
        for (const bin of pgRestoreCandidates()) {
          try {
            const out = execFileSync(bin, ["--list", dump], {
              encoding: "utf8",
              maxBuffer: 64 * 1024 * 1024,
            });
            const objects = out.split("\n").filter((l) => l && !l.startsWith(";")).length;
            if (objects < 1) throw new Error("arsip kosong menurut pg_restore --list");
            result.archiveObjects = objects;
            result.pgRestore = { bin, version: versionOf(bin) };
            console.log(`  ${bin} → ${objects} objek (${versionOf(bin)})`);
            return bin;
          } catch (err) {
            lastErr = String(err?.stderr ?? err?.message ?? err).split("\n")[0];
            if (/version|unsupported/i.test(lastErr)) continue;
            throw new Error(lastErr);
          }
        }
        throw new Error(`tidak ada pg_restore yang bisa membaca arsip — ${lastErr}`);
      },
      timings,
    );

    // ── 2. createdb ──────────────────────────────────────────────────────────
    phase(
      "createdb",
      () => {
        psql(env, "postgres", `CREATE DATABASE "${tmpDb}"`);
        created = true;
      },
      timings,
    );

    // ── 3. pg_restore ────────────────────────────────────────────────────────
    phase(
      "pg_restore",
      () => {
        execFileSync(
          restoreBin,
          ["-d", tmpDb, "--no-owner", "--no-acl", "--exit-on-error", dump],
          { env, stdio: ["ignore", "inherit", "inherit"] },
        );
      },
      timings,
    );

    // ── 4. verify: invarian inti ─────────────────────────────────────────────
    const got = phase(
      "verify (invarian SQL)",
      () => parseKv(psql(env, tmpDb, invariantSql())),
      timings,
    );

    const failures = [];
    for (const [key, want] of Object.entries(EXPECTED)) {
      const have = Number(got.get(key) ?? -1);
      const ok = have >= want;
      console.log(`  ${ok ? "✓" : "✗"} ${key}: ${have} (harap ≥ ${want})`);
      if (!ok) failures.push(`${key}: ${have} < ${want}`);
      result.invariants[key] = have;
    }
    for (const { label, min } of ROW_TABLES) {
      const have = Number(got.get(`rows:${label}`) ?? 0);
      const ok = have >= min;
      console.log(`  ${ok ? "✓" : "✗"} rows ${label}: ${have} (harap ≥ ${min})`);
      if (!ok) failures.push(`${label}: ${have} < ${min}`);
      result.invariants[`rows:${label}`] = have;
    }
    for (const { label, min } of DERIVED_CHECKS) {
      const have = Number(got.get(`rows:${label}`) ?? 0);
      const ok = have >= min;
      console.log(`  ${ok ? "✓" : "✗"} rows ${label}: ${have} (harap ≥ ${min})`);
      if (!ok) failures.push(`${label}: ${have} < ${min}`);
      result.invariants[`rows:${label}`] = have;
    }

    result.invariants.pkDefault = got.get("pk_default");
    result.invariants.extensions = got.get("extensions");
    const pkOk = String(got.get("pk_default") ?? "").includes("uuidv7");
    console.log(`  ${pkOk ? "✓" : "✗"} PK default questions.id = ${got.get("pk_default")}`);
    if (!pkOk) failures.push("PK default bukan uuidv7()");
    console.log(`  · ekstensi: ${got.get("extensions")}`);

    for (const t of ORPHAN_CHECKS) {
      const orphans = Number(got.get(`orphans:${t}`) ?? 0);
      const ok = orphans === 0;
      console.log(`  ${ok ? "✓" : "✗"} orphan ${t}: ${orphans}`);
      if (!ok) failures.push(`orphan ${t}: ${orphans}`);
    }

    // ── 4b. pembanding: hitung di DB sumber (informasi, bukan gerbang) ───────
    try {
      const src = parseKv(
        psql(
          env,
          main.database,
          ROW_TABLES.map((t) => `SELECT 'rows:${t.label}' k, count(*)::text v FROM ${t.sql}`).join(
            " UNION ALL ",
          ),
        ),
      );
      let same = 0;
      const diffs = [];
      for (const { label } of ROW_TABLES) {
        const s = Number(src.get(`rows:${label}`) ?? 0);
        const r = Number(got.get(`rows:${label}`) ?? 0);
        result.sourceCounts[label] = s;
        if (s === r) same += 1;
        else diffs.push(`${label}: dump ${r} vs sumber ${s}`);
      }
      console.log(
        `  · kesetaraan dengan DB sumber: ${same}/${ROW_TABLES.length} tabel sama` +
          (diffs.length ? ` — ${diffs.join("; ")} (sumber berubah setelah dump)` : ""),
      );
    } catch (e) {
      console.log(`  · pembanding sumber dilewati: ${e instanceof Error ? e.message : e}`);
    }

    if (failures.length) {
      throw new Error(`invarian gagal — ${failures.length} masalah: ${failures.join("; ")}`);
    }

    // ── 4c. opsional: db:verify (cek drift skema lengkap) ────────────────────
    if (WITH_DB_VERIFY) {
      phase(
        "db:verify",
        () => {
          execFileSync("pnpm", ["db:verify"], {
            env: { ...process.env, DATABASE_URL: restoreUrl },
            stdio: ["ignore", "inherit", "inherit"],
            timeout: 180_000,
          });
        },
        timings,
      );
    }

    result.ok = true;
    console.log("\n✓ VERIFIKASI LULUS — dump dapat dipulihkan & invarian utuh.");
  } catch (err) {
    exitCode = 1;
    result.error = String(err?.stderr ?? err?.message ?? err).slice(0, 2000);
    console.error(`\n✗ LATIHAN RESTORE GAGAL: ${result.error.split("\n")[0]}`);
  } finally {
    // ── 5. cleanup: selalu hapus DB sementara ────────────────────────────────
    if (created && !KEEP_DB) {
      try {
        psql(env, "postgres", `DROP DATABASE IF EXISTS "${tmpDb}" WITH (FORCE)`);
        console.log(`· DB sementara "${tmpDb}" dihapus.`);
      } catch (e) {
        exitCode = 1;
        console.error(`✗ Gagal hapus "${tmpDb}": ${e instanceof Error ? e.message : e}`);
      }
    }
    if (created && KEEP_DB) console.log(`· DB "${tmpDb}" DIPERTAHANKAN (--keep).`);

    const remaining = leftoverTempDbs(env);
    result.leftovers = remaining;
    if (remaining.length) {
      exitCode = 1;
      console.error(`✗ Masih ada DB sementara tertinggal: ${remaining.join(", ")}`);
    } else {
      console.log("✓ Tak ada DB sementara tertinggal.");
    }

    result.finishedAt = new Date().toISOString();
    result.durationMs = Date.now() - started;
    result.loadAvgEnd = loadAvg();

    const outDir = resolve(process.env.BACKUP_DIR ?? "./backups");
    mkdirSync(outDir, { recursive: true });
    const reportPath = join(outDir, `restore-drill-${stamp}.json`);
    try {
      writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`);
      console.log(`· Bukti drill: ${reportPath}`);
    } catch (e) {
      console.warn(`⚠ Gagal tulis bukti drill: ${e instanceof Error ? e.message : e}`);
    }

    console.log(`\nRingkasan fase (total ${(result.durationMs / 1000).toFixed(2)}s):`);
    for (const t of timings) {
      console.log(
        `  ${t.ok ? "✓" : "✗"} ${t.phase}: ${(t.ms / 1000).toFixed(2)}s  (load ${t.loadAvg})`,
      );
    }
    process.exit(exitCode);
  }
}

main();
