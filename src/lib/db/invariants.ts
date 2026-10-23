/**
 * Verifikasi invarian DB — SATU sumber kebenaran untuk health check (P1) &
 * guard startup (P2). Dipakai `/api/health` dan log saat server menyala.
 *
 * Latar: invarian bisnis (trigger, CHECK, HNSW, uuidv7) hidup di
 * `drizzle/manual/db_safety.sql` yang diterapkan lewat `pnpm db:migrate`.
 * Bila seseorang menjalankan `drizzle-kit push/migrate` langsung, invarian itu
 * TIDAK terpasang → aplikasi berjalan "tanpa jaring pengaman". Modul ini
 * mendeteksi kondisi itu lebih awal (bukan menunggu insiden).
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

/** Harapan minimum skema — selaras `scripts/db-verify.ts`. */
export const EXPECTED_INVARIANTS = {
  // MAT-39: collections & collection_items dihapus (28 → 26).
  // ADR-0019: question_embeddings ditambahkan (26 → 27).
  tables: 27,
  checkConstraints: 2,
  hnswIndexes: 1,
  // MAT-39: collections trigger dihapus (25 → 24).
  // ADR-0019: question_embeddings trigger ditambahkan (24 → 25).
  triggers: 25,
} as const;

/** Trigger & CHECK kritis yang WAJIB ada (bukan sekadar jumlah). */
export const REQUIRED_TRIGGERS = [
  "trg_questions_updated_at",
  "trg_questions_stimulus_depth",
  "trg_topics_cycle",
  "trg_question_topics_usage",
  "trg_question_tags_usage",
  "trg_audit_logs_immutable",
] as const;

export const REQUIRED_CHECKS = [
  "chk_questions_difficulty",
  "chk_topics_level",
] as const;

export type InvariantReport = {
  ok: boolean;
  counts: {
    tables: number;
    checkConstraints: number;
    hnswIndexes: number;
    triggers: number;
  };
  missingTriggers: string[];
  missingChecks: string[];
  pkUsesUuidv7: boolean;
  /** Daftar masalah dalam bahasa manusia (kosong bila sehat). */
  problems: string[];
};

type CountRow = {
  tables: number;
  checks: number;
  hnsw: number;
  triggers: number;
};

/**
 * Periksa seluruh invarian. Read-only & cepat (satu round-trip + 3 kueri kecil).
 * Tidak melempar — kembalikan laporan agar pemanggil memutuskan (log/blok).
 */
export async function checkDbInvariants(): Promise<InvariantReport> {
  const problems: string[] = [];

  const countRows = await db.execute<CountRow>(sql`
    SELECT
      (SELECT count(*) FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
      (SELECT count(*) FROM pg_constraint
        WHERE contype='c' AND connamespace='public'::regnamespace) AS checks,
      (SELECT count(*) FROM pg_indexes
        WHERE indexdef ILIKE '%hnsw%') AS hnsw,
      (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers
  `);
  const c = countRows[0] ?? { tables: 0, checks: 0, hnsw: 0, triggers: 0 };
  const counts = {
    tables: Number(c.tables),
    checkConstraints: Number(c.checks),
    hnswIndexes: Number(c.hnsw),
    triggers: Number(c.triggers),
  };

  for (const key of Object.keys(EXPECTED_INVARIANTS) as (keyof typeof EXPECTED_INVARIANTS)[]) {
    if (counts[key] < EXPECTED_INVARIANTS[key]) {
      problems.push(`${key}: ${counts[key]} < ${EXPECTED_INVARIANTS[key]}`);
    }
  }

  const checkRows = await db.execute<{ conname: string }>(sql`
    SELECT conname FROM pg_constraint
     WHERE contype='c' AND connamespace='public'::regnamespace
  `);
  const checkNames = new Set(checkRows.map((r) => r.conname));
  const missingChecks = REQUIRED_CHECKS.filter((n) => !checkNames.has(n));
  for (const n of missingChecks) problems.push(`CHECK hilang: ${n}`);

  const trigRows = await db.execute<{ tgname: string }>(sql`
    SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
  `);
  const trigNames = new Set(trigRows.map((r) => r.tgname));
  const missingTriggers = REQUIRED_TRIGGERS.filter((n) => !trigNames.has(n));
  for (const n of missingTriggers) problems.push(`TRIGGER hilang: ${n}`);

  const pkRows = await db.execute<{ column_default: string | null }>(sql`
    SELECT column_default FROM information_schema.columns
     WHERE table_name='questions' AND column_name='id'
  `);
  const pkUsesUuidv7 = (pkRows[0]?.column_default ?? "").includes("uuidv7");
  if (!pkUsesUuidv7) problems.push("PK default bukan uuidv7()");

  return {
    ok: problems.length === 0,
    counts,
    missingTriggers,
    missingChecks,
    pkUsesUuidv7,
    problems,
  };
}
