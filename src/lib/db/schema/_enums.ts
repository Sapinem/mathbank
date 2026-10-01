import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Semua enum MathBank — satu tempat.
 * Rujukan: docs/SKEMA-DB-DETAIL.md §ENUM
 */

/** Tipe soal — 11 tipe. */
export const questionTypeEnum = pgEnum("question_type", [
  "stimulus",
  "single_choice",
  "assertion_reason",
  "combination_1234",
  "quantitative_pq",
  "data_sufficiency",
  "multiple_choice_checkbox",
  "matrix_grid",
  "matching",
  "short_answer",
  "essay",
]);

/** Status soal (FSM): draft → review → ready → archived. */
export const questionStatusEnum = pgEnum("question_status", [
  "draft",
  "review",
  "ready",
  "archived",
]);

/** Taksonomi Bloom C1–C6. */
export const cognitiveLevelEnum = pgEnum("cognitive_level", [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]);

/** Tipe pembahasan. */
export const solutionTypeEnum = pgEnum("solution_type", [
  "conceptual",
  "quick_tip",
  "video",
  "alternative",
]);

/**
 * Peran pengguna (L1) — 5 peran formal.
 * Multi-role: union izin (lihat `user_roles`).
 */
export const roleEnum = pgEnum("role", [
  "admin",
  "teacher",
  "reviewer",
  "agent",
  "machine",
]);

/** Tipe aktor untuk solusi & audit (sinkron L1). */
export const authorTypeEnum = pgEnum("author_type", [
  "teacher",
  "agent",
  "machine",
  "system",
]);

/**
 * Jenis sumber.
 *
 * ADR-0015: `competition` DIBUANG — UTBK/OSN/SIMAK UI adalah **event** (jenis
 * ujian), bukan tempat menyalin soal. Rumahnya tabel `events` (ADR-0010/0014).
 */
export const sourceKindEnum = pgEnum("source_kind", [
  "book",
  "website",
  "school",
]);

/** Jenis paket soal. */
export const bundleTypeEnum = pgEnum("bundle_type", [
  "source",
  "exam",
  "exercise",
]);

/** Peran baris di dalam paket. */
export const bundleItemRoleEnum = pgEnum("bundle_item_role", [
  "question",
  "stimulus",
]);

/** Peran media terhadap soal. */
export const mediaRoleEnum = pgEnum("media_role", [
  "content",
  "option",
  "solution",
  "thumbnail",
]);

/** Asal-usul aset media. */
export const mediaOriginEnum = pgEnum("media_origin", [
  "manual_upload",
  "pdf_crop",
  "ai_generated_tikz",
  "ai_generated_svg",
  "web_scrape",
  "web_ingest",
  "tex_import",
]);

/** Aksi audit. */
export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "status_change",
  "restore",
  // M13 S7: catat AKSES BACA data sensitif (kunci jawaban, ekspor), bukan tiap GET.
  "view",
  "export",
]);

/** Entitas yang diaudit. */
export const auditEntityEnum = pgEnum("audit_entity", [
  "question",
  "bundle",
  "topic",
  "source",
  "event",
  "user",
  "setting",
  "media",
  "tag",
]);

/** Status antrean ingest (dipakai M9). */
export const ingestStatusEnum = pgEnum("ingest_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  /** Artikel sah diproses tetapi **tak menghasilkan soal** (mis. artikel teori). */
  "skipped",
]);
