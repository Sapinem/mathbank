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
 * ⚠️ Sisa pekerjaan: `src/lib/db/invariants.ts` masih menyimpan salinan
 * `EXPECTED_INVARIANTS`/`REQUIRED_*` karena berkas itu sedang disentuh
 * perubahan MAT-146. Setelah itu selesai, ganti isinya dengan `export *`
 * dari berkas ini.
 */

/** Harapan minimum skema (rata-rata setelah 0000..0017). */
export const EXPECTED_INVARIANTS = {
  // MAT-39: collections & collection_items dihapus (28 → 26).
  // MAT-146: question_options dihapus (26 → 25) — opsi kini JSONB.
  // ADR-0019: question_embeddings ditambahkan (25 → 26).
  tables: 26,
  checkConstraints: 2,
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
export const REQUIRED_CHECKS = ["chk_questions_difficulty", "chk_topics_level"] as const;

/**
 * Tabel yang WAJIB sudah TIDAK ada (invarian negatif).
 *
 * MAT-144/MAT-146: `question_options` sudah di-drop, datanya pindah ke
 * `questions.data_payload.options` (JSONB). Bila tabel ini muncul lagi berarti
 * ada migrasi/dump lama yang ter-apply ulang.
 */
export const FORBIDDEN_TABLES = ["question_options"] as const;
