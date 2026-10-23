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

/** Harapan minimum skema (rata-rata setelah 0000..0017). */
const EXPECTED = {
  // MAT-39: collections & collection_items dihapus (28 → 26).
  // MAT-146: question_options dihapus (26 → 25) — opsi kini JSONB.
  // ADR-0019: question_embeddings ditambahkan (25 → 26).
  tables: 26,
  checkConstraints: 2,
  hnswIndexes: 1,
  // MAT-39: collections trigger dihapus (25 → 24).
  // MAT-146: trg_question_options_updated_at ikut terhapus (24 → 23).
  // ADR-0019: trg_question_embeddings_updated_at ditambahkan (23 → 24).
  triggers: 24, // 19 updated_at + 1 stimulus + 1 cycle + 2 usage_count + 1 audit-immutable
} as const;

/**
 * Tabel yang WAJIB sudah TIDAK ada (invarian negatif).
 *
 * MAT-144/MAT-146: `question_options` sudah di-drop dan datanya dipindah ke
 * `questions.data_payload.options` (JSONB). Bila tabel ini muncul lagi berarti
 * ada migrasi/dump lama yang ter-apply ulang — gerbang ini menangkapnya lebih
 * awal daripada bug produksi.
 */
const FORBIDDEN_TABLES = ["question_options"] as const;

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

    // Tabel terlarang (invarian negatif MAT-144/MAT-146)
    const forbiddenRows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE'
         AND table_name IN ${sql(FORBIDDEN_TABLES as unknown as string[])}
    `;
    for (const name of FORBIDDEN_TABLES) {
      const exists = forbiddenRows.some((r) => r.table_name === name);
      console.log(`${exists ? "✗" : "✓"} tabel ${name} sudah di-drop`);
      if (exists) failures.push(`tabel terlarang masih ada: ${name}`);
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
