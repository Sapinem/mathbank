import { describe, it, expect } from "vitest";
import {
  EXPECTED_INVARIANTS,
  evaluateInvariants,
  isForbiddenTable,
  type InvariantCounts,
  type InvariantPresence,
} from "./schema-expectations";

/**
 * Tes murni gerbang invarian — TANPA DB.
 *
 * Latar: gerbang yang sama dipakai health check, `pnpm db:verify`, dan snapshot
 * metrik. Sebelum disatukan, ambangnya sempat turun tanpa ketahuan sehingga
 * satu tabel yang hilang bisa lolos. Tes ini mengunci perilaku yang harus
 * dipertahankan: hitungan di bawah minimum memerahkan gerbang.
 */

const sehat: InvariantCounts = {
  tables: EXPECTED_INVARIANTS.tables,
  checkConstraints: EXPECTED_INVARIANTS.checkConstraints,
  hnswIndexes: EXPECTED_INVARIANTS.hnswIndexes,
  triggers: EXPECTED_INVARIANTS.triggers,
};

const presence = (over: Partial<InvariantPresence> = {}): InvariantPresence => ({
  tables: new Set(["questions", "bundles", "topics"]),
  checks: new Set([
    "chk_questions_difficulty",
    "chk_topics_level",
    "chk_media_assets_short_id",
  ]),
  triggers: new Set([
    // Fase 5: fixture ini harus berisi KE-24 trigger yang dipasang
    // drizzle/manual/db_safety.sql, karena REQUIRED_TRIGGERS kini penuh.
    "trg_account_updated_at",
    "trg_apikey_updated_at",
    "trg_app_settings_updated_at",
    "trg_bundles_updated_at",
    "trg_cognitive_levels_updated_at",
    "trg_difficulty_levels_updated_at",
    "trg_events_updated_at",
    "trg_grades_updated_at",
    "trg_ingest_queue_updated_at",
    "trg_media_assets_updated_at",
    "trg_question_embeddings_updated_at",
    "trg_questions_updated_at",
    "trg_session_updated_at",
    "trg_solutions_updated_at",
    "trg_sources_updated_at",
    "trg_tags_updated_at",
    "trg_topics_updated_at",
    "trg_user_updated_at",
    "trg_verification_updated_at",
    "trg_questions_stimulus_depth",
    "trg_topics_cycle",
    "trg_question_topics_usage",
    "trg_question_tags_usage",
    "trg_audit_logs_immutable",
    "trg_bundle_items_sync_grades",
    "trg_bundles_sync_grades",
    "trg_questions_bump_version",
    "trg_bundles_bump_version",
    "trg_events_bump_version",
    "trg_media_assets_bump_version",
    "trg_sources_bump_version",
    "trg_tags_bump_version",
    "trg_topics_bump_version",
    "trg_apikey_bump_version",
  ]),
  pkUsesUuidv7: true,
  ...over,
});

describe("evaluateInvariants", () => {
  it("lulus saat semua minimum terpenuhi", () => {
    expect(evaluateInvariants(sehat, presence())).toEqual({ ok: true, problems: [] });
  });

  it("gagal saat satu tabel hilang (tanpa kelonggaran)", () => {
    const v = evaluateInvariants({ ...sehat, tables: sehat.tables - 1 }, presence());
    expect(v.ok).toBe(false);
    expect(v.problems).toContain(
      `tables: ${sehat.tables - 1} < ${EXPECTED_INVARIANTS.tables}`,
    );
  });

  it("gagal saat satu trigger hilang walau jumlahnya masih cukup", () => {
    const triggers = new Set([...presence().triggers].filter((t) => t !== "trg_topics_cycle"));
    const v = evaluateInvariants({ ...sehat, triggers: sehat.triggers + 5 }, presence({ triggers }));
    expect(v.ok).toBe(false);
    expect(v.problems).toContain("TRIGGER hilang: trg_topics_cycle");
  });

  it("gagal saat satu trigger updated_at hilang walau jumlahnya masih cukup", () => {
    const triggers = new Set(
      [...presence().triggers].filter((t) => t !== "trg_bundles_updated_at"),
    );
    const v = evaluateInvariants({ ...sehat, triggers: sehat.triggers + 5 }, presence({ triggers }));
    expect(v.ok).toBe(false);
    expect(v.problems).toContain("TRIGGER hilang: trg_bundles_updated_at");
  });

  it("gagal saat CHECK kritis hilang", () => {
    const checks = new Set(["chk_questions_difficulty"]);
    const v = evaluateInvariants(sehat, presence({ checks }));
    expect(v.ok).toBe(false);
    expect(v.problems).toContain("CHECK hilang: chk_topics_level");
  });

  it("gagal saat PK bukan uuidv7()", () => {
    const v = evaluateInvariants(sehat, presence({ pkUsesUuidv7: false }));
    expect(v.ok).toBe(false);
    expect(v.problems).toContain("PK default bukan uuidv7()");
  });

  it("melaporkan tabel sisa migrasi sebagai masalah", () => {
    const tables = new Set([...presence().tables, "question_options_mat146_backup"]);
    const v = evaluateInvariants(sehat, presence({ tables }));
    expect(v.ok).toBe(false);
    expect(v.problems).toContain(
      "Tabel terlarang masih ada: question_options_mat146_backup",
    );
  });
});

describe("isForbiddenTable", () => {
  it("menangkap nama di daftar terlarang dan pola sisa migrasi", () => {
    expect(isForbiddenTable("question_options")).toBe(true);
    expect(isForbiddenTable("question_options_mat146_backup")).toBe(true);
  });

  it("tidak menuduh tabel skema biasa", () => {
    expect(isForbiddenTable("questions")).toBe(false);
    expect(isForbiddenTable("question_embeddings")).toBe(false);
  });
});
