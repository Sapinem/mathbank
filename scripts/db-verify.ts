/**
 * Verifikasi skema DB — mencegah "drift" antara file migrasi dan DB nyata.
 *
 * Latar: audit 2026-09-29 menemukan 21 trigger & invarian ada di DB lokal
 * tetapi TIDAK ada di file migrasi → DB bersih kehilangan invarian.
 * Skrip ini memeriksa jumlah objek kunci dan GAGAL bila tak sesuai harapan.
 *
 * Jalankan: `pnpm db:verify` (dipanggil dari `pnpm check`).
 * Butuh DATABASE_URL (dibaca dari .env).
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

/** Harapan minimum skema (rata-rata setelah 0000..0004). */
const EXPECTED = {
  tables: 28, // 26 + collections + collection_items (ADR-0016)
  checkConstraints: 2,
  hnswIndexes: 1,
  triggers: 25, // 20 updated_at (+collections per ADR-0016) + 1 stimulus + 1 cycle + 2 usage_count + 1 audit-immutable
} as const;

/** Nama constraint/trigger kritis yang WAJIB ada. */
const REQUIRED_CHECKS = [
  "chk_questions_difficulty",
  "chk_topics_level",
];
const REQUIRED_TRIGGERS = [
  "trg_questions_updated_at",
  "trg_questions_stimulus_depth",
  "trg_topics_cycle",
  "trg_question_topics_usage",
  "trg_question_tags_usage",
  "trg_audit_logs_immutable",
];

type Row = Record<string, unknown>;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL tidak diset (perlu .env).");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  const failures: string[] = [];

  try {
    const [counts] = await sql<Row[]>`
      SELECT
        (SELECT count(*) FROM information_schema.tables
          WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
        (SELECT count(*) FROM pg_constraint
          WHERE contype='c' AND connamespace='public'::regnamespace) AS checks,
        (SELECT count(*) FROM pg_indexes
          WHERE indexdef ILIKE '%hnsw%') AS hnsw,
        (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers
    `;

    const got = {
      tables: Number(counts.tables),
      checkConstraints: Number(counts.checks),
      hnswIndexes: Number(counts.hnsw),
      triggers: Number(counts.triggers),
    };

    for (const key of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
      const want = EXPECTED[key];
      const have = got[key];
      const ok = have >= want;
      console.log(
        `${ok ? "✓" : "✗"} ${key}: ${have} (harap ≥ ${want})`,
      );
      if (!ok) failures.push(`${key}: ${have} < ${want}`);
    }

    // Constraint kritis
    const checkRows = await sql<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
       WHERE contype='c' AND connamespace='public'::regnamespace
    `;
    const checkNames = new Set(checkRows.map((r) => r.conname));
    for (const name of REQUIRED_CHECKS) {
      const ok = checkNames.has(name);
      console.log(`${ok ? "✓" : "✗"} CHECK ${name}`);
      if (!ok) failures.push(`CHECK hilang: ${name}`);
    }

    // Trigger kritis
    const trigRows = await sql<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
    `;
    const trigNames = new Set(trigRows.map((r) => r.tgname));
    for (const name of REQUIRED_TRIGGERS) {
      const ok = trigNames.has(name);
      console.log(`${ok ? "✓" : "✗"} TRIGGER ${name}`);
      if (!ok) failures.push(`TRIGGER hilang: ${name}`);
    }

    // PK default wajib uuidv7() (PG 18) — cegah regresi ke gen_random_uuid().
    const [pkDefault] = await sql<{ column_default: string | null }[]>`
      SELECT column_default FROM information_schema.columns
       WHERE table_name='questions' AND column_name='id'
    `;
    const pkOk = (pkDefault?.column_default ?? "").includes("uuidv7");
    console.log(`${pkOk ? "✓" : "✗"} PK default = uuidv7() (kini: ${pkDefault?.column_default ?? "-"})`);
    if (!pkOk) failures.push("PK default bukan uuidv7()");
  } finally {
    await sql.end();
  }

  if (failures.length > 0) {
    console.error(`\n✗ Skema DRIFT — ${failures.length} masalah:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\n✓ Skema OK — tak ada drift.");
}

main().catch((err) => {
  console.error("✗ Verifikasi skema gagal:", err);
  process.exit(1);
});
