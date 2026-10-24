/**
 * Harapan skema DB — SATU tempat untuk angka invarian & daftar objek kritis.
 *
 * KENAPA dipisah dari `invariants.ts`: modul itu mengimpor `db` (drizzle),
 * sehingga skrip yang hanya butuh ANGKA (mis. `scripts/db-verify.ts`,
 * `scripts/snapshot-metrics.ts`) ikut membuka koneksi kedua dan bergantung
 * pada `DATABASE_URL` saat import. Berkas ini murni — tanpa impor apa pun.
 *
 * Sebelumnya angka yang sama disalin di tiga tempat (`invariants.ts`,
 * `scripts/db-verify.ts`, dan tabel di `AGENTS.md` §8) dan ketiganya pernah
 * berbeda. Salinan tangan selalu basi.
 *
 * Dipakai oleh: `src/lib/db/invariants.ts` (health check & guard startup),
 * `scripts/db-verify.ts` (gerbang skema), dan `scripts/snapshot-metrics.ts`.
 */

/** Harapan minimum skema (rata-rata setelah 0000..0017). */
export const EXPECTED_INVARIANTS = {
  // MAT-39: collections & collection_items dihapus (28 → 26).
  // MAT-146: question_options dihapus (26 → 25) — opsi kini JSONB.
  // ADR-0019: question_embeddings ditambahkan (25 → 26).
  tables: 26,
  checkConstraints: 3,
  hnswIndexes: 1,
  // MAT-39: collections trigger dihapus (25 → 24).
  // MAT-146: trg_question_options_updated_at ikut terhapus (24 → 23).
  // ADR-0019: trg_question_embeddings_updated_at ditambahkan (23 → 24).
  triggers: 24,
} as const;

/** Nama trigger kritis yang WAJIB ada (bukan sekadar jumlah). */
export const REQUIRED_TRIGGERS = [
  "trg_questions_updated_at",
  "trg_questions_stimulus_depth",
  "trg_topics_cycle",
  "trg_question_topics_usage",
  "trg_question_tags_usage",
  "trg_audit_logs_immutable",
] as const;

/** Nama CHECK kritis yang WAJIB ada. */
export const REQUIRED_CHECKS = [
  "chk_questions_difficulty",
  "chk_topics_level",
  "chk_media_assets_short_id",
] as const;

/**
 * Tabel yang WAJIB sudah TIDAK ada (invarian negatif).
 *
 * MAT-144/MAT-146: `question_options` sudah di-drop, datanya pindah ke
 * `questions.data_payload.options` (JSONB).
 * ADR-0015: `books` dan `institutions` digabung ke `sources`.
 * MAT-39: `collections` dan `collection_items` dikonsolidasi ke `bundles`.
 * Bila tabel-tabel ini muncul lagi berarti ada dump/migrasi lama yang ter-apply ulang.
 */
export const FORBIDDEN_TABLES = [
  "question_options",
  "collections",
  "collection_items",
  "books",
  "institutions",
] as const;

/**
 * Pola tabel sisa migrasi. Tabel seperti `question_options_mat146_backup`
 * BUKAN bagian skema: ia tidak dihitung sebagai tabel (lihat klausa
 * `right(table_name, 7) <> '_backup'` di ketiga pemanggil) dan dilaporkan
 * sebagai objek terlarang sampai pemilik mengarsipkan lalu me-DROP-nya.
 */
export const LEFTOVER_TABLE_PATTERN = /_backup$/;

/** Satu definisi "objek terlarang" — dipakai gerbang maupun laporan snapshot. */
export function isForbiddenTable(name: string): boolean {
  return (
    (FORBIDDEN_TABLES as readonly string[]).includes(name) || LEFTOVER_TABLE_PATTERN.test(name)
  );
}

/**
 * Bentuk laporan invarian. Tinggal di modul murni (bukan di `invariants.ts`)
 * supaya proyeksi HTTP-nya bisa dipakai route tanpa ikut menarik koneksi DB —
 * dan bisa diuji tanpa DATABASE_URL.
 */
export type InvariantReport = {
  ok: boolean;
  counts: InvariantCounts;
  missingTriggers: string[];
  missingChecks: string[];
  /** Tabel terlarang yang masih ada — invarian negatif (mis. sisa migrasi). */
  forbiddenTablesPresent: string[];
  pkUsesUuidv7: boolean;
  /** Daftar masalah dalam bahasa manusia (kosong bila sehat). */
  problems: string[];
};

export type InvariantCounts = {
  tables: number;
  checkConstraints: number;
  hnswIndexes: number;
  triggers: number;
};

/** Objek yang benar-benar ada di DB, dipakai untuk invarian bernama. */
export type InvariantPresence = {
  tables: ReadonlySet<string>;
  checks: ReadonlySet<string>;
  triggers: ReadonlySet<string>;
  pkUsesUuidv7: boolean;
};

/**
 * Putuskan lulus/gagal. Murni: tanpa DB, tanpa I/O — bisa diuji langsung.
 * Mengembalikan SEMUA masalah (bukan berhenti di yang pertama).
 */
export function evaluateInvariants(
  counts: InvariantCounts,
  present: InvariantPresence,
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];

  for (const key of Object.keys(EXPECTED_INVARIANTS) as (keyof InvariantCounts)[]) {
    if (counts[key] < EXPECTED_INVARIANTS[key]) {
      problems.push(key + ": " + counts[key] + " < " + EXPECTED_INVARIANTS[key]);
    }
  }

  for (const name of REQUIRED_CHECKS) {
    if (!present.checks.has(name)) problems.push("CHECK hilang: " + name);
  }
  for (const name of REQUIRED_TRIGGERS) {
    if (!present.triggers.has(name)) problems.push("TRIGGER hilang: " + name);
  }
  for (const name of present.tables) {
    if (isForbiddenTable(name)) problems.push("Tabel terlarang masih ada: " + name);
  }
  if (!present.pkUsesUuidv7) problems.push("PK default bukan uuidv7()");

  return { ok: problems.length === 0, problems };
}

/**
 * Proyeksi `InvariantReport` untuk respons HTTP.
 *
 * KENAPA ada: `/api/health` dan `/api/ready` dulu menyalin field satu per satu,
 * sehingga field baru yang lupa ditambahkan di salah satunya membuat dua probe
 * memberi jawaban berbeda soal DB yang sama.
 */
export function toInvariantsDto(report: InvariantReport) {
  return {
    ok: report.ok,
    counts: report.counts,
    missingTriggers: report.missingTriggers,
    missingChecks: report.missingChecks,
    forbiddenTablesPresent: report.forbiddenTablesPresent,
    pkUsesUuidv7: report.pkUsesUuidv7,
    problems: report.problems,
  };
}
