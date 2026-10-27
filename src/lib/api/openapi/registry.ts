import { z } from "zod";

/**
 * Metadata OpenAPI per operasi (Fase B).
 *
 * KENAPA berkas terpisah: skema request hidup di route (`wrapRoute`), sedangkan
 * ringkasan, tag, dan skema respons adalah **dokumentasi**, bukan kode runtime.
 * Memisahkannya membuat `registry.ts` murni — bisa diimpor tes tanpa DB.
 *
 * ATURAN:
 *  - `response` = bentuk objek `data` (envelope `{ data }` ditambahkan generator).
 *  - Pakai `z.looseObject` untuk baris hasil proyeksi DB: field yang tercantum
 *    dijamin ada, field lain boleh muncul (kolom baru tak memecah kontrak).
 *  - `summary` bahasa Indonesia; `tags` bahasa Inggris (CONSTRAINT #28b).
 *  - Setiap method WAJIB punya entri di sini atau di `MANUAL_OPERATIONS`;
 *    `pnpm openapi:check` gagal bila ada yang tertinggal.
 */

export interface OperationDoc {
  /** Ringkasan satu baris (Indonesia). */
  summary: string;
  description?: string;
  /** Tag OpenAPI (Inggris). */
  tags: readonly string[];
  /** Bentuk objek `data` pada respons sukses. */
  response: z.ZodType;
  /** Deskripsi respons sukses (default "Sukses."). */
  successDescription?: string;
  /** Kode galat tambahan yang spesifik operasi ini. */
  extraErrors?: readonly number[];
  deprecated?: boolean;
  /** Catatan yang tak terbaca dari skema (dipancarkan generator ke `x-mathbank`). */
  notes?: readonly string[];
}

export interface ManualOperationDoc {
  summary: string;
  description: string;
  tags: readonly string[];
  /** `none` = publik; `bearer` = API key; `delegated` = ditangani Better Auth. */
  security: "none" | "bearer" | "delegated";
  /** Parameter path/query (route non-wrap tidak punya skema Zod di route). */
  parameters?: readonly Record<string, unknown>[];
  /** Tandai operasi usang (mis. alias yang akan dimatikan). */
  deprecated?: boolean;
  /**
   * Label kolom "Izin" di tabel KONTRAK-API bila `security` tidak cukup
   * menggambarkan pagar sebenarnya (mis. token opsional). Hanya memengaruhi
   * dokumen, tidak mengubah `security` OpenAPI.
   */
  accessLabel?: string;
  requestBody?: Record<string, unknown>;
  responses: Record<string, unknown>;
  notes?: readonly string[];
}

/* ── Potongan skema bersama ───────────────────────────────────────────── */

const iso = z.string().describe("Timestamp ISO-8601 (UTC).");
const uuid = z.string().uuid();
const okSchema = z.object({ ok: z.literal(true) });

export const questionStatusSchema = z.enum(["draft", "review", "ready", "archived"]);

export const questionTypeSchema = z.enum([
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

export const optionSchema = z.looseObject({
  label: z.string().describe("Huruf opsi (A–E)."),
  content: z.string().describe("Isi opsi (markdown + LaTeX)."),
  isCorrect: z.boolean().optional().describe("Hanya untuk viewer berwenang."),
});

/** Proyeksi publik soal (`questionColumns` + opsi). */
export const questionSchema = z.looseObject({
  id: uuid,
  parentId: uuid.nullable(),
  childOrder: z.number().int().nullable(),
  questionType: questionTypeSchema,
  difficulty: z.number().int().min(1).max(5),
  cognitiveLevel: z.string(),
  grade: z.string().nullable(),
  grades: z.array(z.string()),
  contentMarkdown: z.string(),
  dataPayload: z.record(z.string(), z.unknown()),
  status: questionStatusSchema,
  isFlagged: z.boolean(),
  flagNotes: z.string().nullable(),
  eventId: uuid.nullable(),
  eventYear: z.number().int().nullable(),
  authorId: z.string(),
  lastReviewedAt: iso.nullable(),
  deletedAt: iso.nullable(),
  createdAt: iso,
  version: z.number().int(),
  updatedAt: iso,
  options: z.array(optionSchema),
  answerKey: z.record(z.string(), z.unknown()).optional().describe("Hanya viewer berwenang."),
});

const bundleSchema = z.looseObject({
  id: uuid,
  title: z.string(),
  bundleType: z.enum(["source", "exam"]),
  origin: z.enum(["ingest", "manual"]).nullable(),
  sourceId: uuid.nullable(),
  eventId: uuid.nullable(),
  year: z.number().int().nullable(),
  grade: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  instructions: z.string().nullable(),
  printConfig: z.record(z.string(), z.unknown()).nullable(),
  status: questionStatusSchema,
  createdById: z.string().nullable(),
  createdAt: iso,
  version: z.number().int(),
  updatedAt: iso,
  itemCount: z.number().int().optional(),
});

const bundleItemSchema = z.looseObject({
  id: uuid,
  bundleId: uuid,
  questionId: uuid,
  orderIndex: z.number().int(),
  role: z.enum(["question", "stimulus"]),
  sectionName: z.string().nullable(),
  itemNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** Item paket + soal tertanam (proyeksi `listBundleItems`). */
const bundleItemWithQuestionSchema = z.looseObject({
  item: bundleItemSchema,
  question: z.looseObject({
    id: uuid,
    questionType: questionTypeSchema,
    contentMarkdown: z.string(),
    status: questionStatusSchema,
    options: z.array(optionSchema),
  }),
});

const bundleDetailSchema = bundleSchema.extend({
  items: z.array(bundleItemWithQuestionSchema),
});

const topicSchema = z.looseObject({
  id: uuid,
  name: z.string(),
  parentId: uuid.nullable(),
  level: z.number().int(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  usageCount: z.number().int(),
  isActive: z.boolean(),
  version: z.number().int(),
});

const tagSchema = z.looseObject({
  id: uuid,
  name: z.string(),
  usageCount: z.number().int(),
  version: z.number().int(),
});

const sourceSchema = z.looseObject({
  id: uuid,
  kind: z.enum(["book", "website", "school"]),
  label: z.string(),
  url: z.string().nullable(),
  publisher: z.string().nullable(),
  author: z.string().nullable(),
  bookYear: z.number().int().nullable(),
  city: z.string().nullable(),
  isActive: z.boolean(),
  usageCount: z.number().int(),
  version: z.number().int(),
});

const eventSchema = z.looseObject({
  id: uuid,
  name: z.string(),
  shortname: z.string(),
  category: z.string(),
  subtests: z.array(z.string()),
  aliases: z.array(z.string()).optional(),
  isActive: z.boolean(),
  version: z.number().int(),
});

const gradeSchema = z.looseObject({
  id: uuid,
  label: z.string(),
  levelGroup: z.string().nullable(),
  curriculumPhase: z.string().nullable(),
  orderIndex: z.number().int(),
});

/** Baris galeri media (`GALLERY_COLUMNS`). */
const galleryRowSchema = z.looseObject({
  id: uuid,
  shortId: z.string(),
  title: z.string().nullable(),
  altText: z.string().nullable(),
  originalImagePath: z.string().nullable(),
  svgPath: z.string().nullable(),
  mimeType: z.string(),
  fileSize: z.number().int(),
  sourceOrigin: z.string().nullable(),
  createdAt: iso,
  version: z.number().int(),
});

const mediaAssetSchema = z.looseObject({
  id: uuid,
  shortId: z.string(),
  shortcode: z.string(),
  title: z.string().nullable(),
  altText: z.string().nullable(),
  mimeType: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  fileSize: z.number().int(),
  sourceOrigin: z.string().nullable(),
  createdAt: iso,
  version: z.number().int(),
});

const agentKeySchema = z.looseObject({
  id: z.string(),
  version: z.number().int(),
  name: z.string().nullable(),
  prefix: z.string().nullable(),
  enabled: z.boolean(),
  createdAt: iso.nullable(),
  expiresAt: iso.nullable(),
  lastRequest: iso.nullable(),
  requestCount: z.number().int().nullable(),
});

const queueItemSchema = z.looseObject({
  id: uuid,
  title: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed", "skipped"]),
  sourceOrigin: z.string(),
  sourceUrl: z.string().nullable(),
  targetType: z.string(),
  createdAt: iso,
});

const settingsItemSchema = z.looseObject({
  key: z.string(),
  value: z.unknown(),
  isSecret: z.boolean(),
  isSet: z.boolean().optional(),
});

const bulkResultSchema = z.object({
  ok: z.array(z.string()).describe("Id yang berhasil."),
  failed: z.array(z.object({ id: z.string(), error: z.string() })),
  dbQueries: z.number().int().optional(),
  durationMs: z.number().optional(),
});

const bundleValidationSchema = z.object({
  itemCount: z.number().int(),
  withoutAnswerKey: z.array(
    z.object({ questionId: uuid, itemNumber: z.string().nullable() }),
  ),
  missingQuestions: z.array(z.string()),
  valid: z.boolean(),
});

const statsSchema = z.looseObject({
  stats: z.object({
    total: z.number().int(),
    ready: z.number().int(),
    review: z.number().int(),
    flagged: z.number().int(),
    bundles: z.number().int(),
    sources: z.number().int(),
  }),
  byDifficulty: z.array(z.object({ key: z.string(), n: z.number().int() })),
  byGrade: z.array(z.object({ key: z.string(), n: z.number().int() })),
  topTopics: z.array(z.object({ id: uuid, name: z.string(), n: z.number().int() })),
  recent: z.array(
    z.object({ id: uuid, content: z.string(), status: questionStatusSchema, createdAt: iso }),
  ),
});

/* ── Operasi `wrapRoute` ──────────────────────────────────────────────── */

export const OPERATIONS: Readonly<Record<string, OperationDoc>> = {
  "GET /api/auth/me": {
    summary: "Identitas aktor aktif",
    tags: ["auth"],
    response: z.looseObject({ id: z.string(), name: z.string(), roles: z.array(z.string()), via: z.string(), mustChangePassword: z.boolean() }),
  },
  "GET /api/questions": {
    summary: "Daftar soal (filter + paginasi)",
    tags: ["questions"],
    response: z.object({ items: z.array(questionSchema), total: z.number().int() }),
    notes: ["Filter array menerima pengulangan (`?grade=g10&grade=g11`) atau CSV (`?grade=g10,g11`)."],
  },
  "POST /api/questions": {
    summary: "Buat soal baru",
    tags: ["questions"],
    response: questionSchema,
  },
  "GET /api/questions/[id]": {
    summary: "Detail soal + opsi",
    tags: ["questions"],
    response: questionSchema,
    notes: ["`answerKey` dan `options[].isCorrect` hanya untuk admin/guru/penelaah."],
  },
  "PATCH /api/questions/[id]": {
    summary: "Perbarui soal",
    tags: ["questions"],
    response: questionSchema,
  },
  "DELETE /api/questions/[id]": {
    summary: "Hapus lunak soal",
    tags: ["questions"],
    response: okSchema,
  },
  "PATCH /api/questions/[id]/status": {
    summary: "Ubah status soal (FSM)",
    tags: ["questions"],
    response: questionSchema,
    extraErrors: [422],
    notes: ["422 `NOT_READY` bila `ready` tanpa kunci jawaban."],
  },
  "PATCH /api/questions/[id]/flag": {
    summary: "Tandai/lepas 'perlu perhatian'",
    tags: ["questions"],
    response: questionSchema,
  },
  "DELETE /api/questions/[id]/permanent": {
    summary: "Hapus permanen soal",
    tags: ["questions"],
    response: okSchema,
  },
  "POST /api/questions/batch": {
    summary: "Aksi massal soal (maks 200 id)",
    tags: ["questions"],
    response: bulkResultSchema,
  },
  "GET /api/bundles": {
    summary: "Daftar paket soal",
    tags: ["bundles"],
    response: z.looseObject({ items: z.array(bundleSchema), total: z.number().int(), limit: z.number().int(), offset: z.number().int(), stats: z.object({ byType: z.record(z.string(), z.number()), totalItems: z.number().int() }) }),
  },
  "POST /api/bundles": {
    summary: "Buat paket soal",
    tags: ["bundles"],
    response: bundleSchema,
  },
  "GET /api/bundles/[id]": {
    summary: "Detail paket + item berurutan",
    tags: ["bundles"],
    response: bundleDetailSchema,
  },
  "PATCH /api/bundles/[id]": {
    summary: "Ubah metadata paket",
    tags: ["bundles"],
    response: bundleSchema,
  },
  "DELETE /api/bundles/[id]": {
    summary: "Arsipkan paket (hapus lunak)",
    tags: ["bundles"],
    response: okSchema,
  },
  "GET /api/bundles/[id]/items": {
    summary: "Item paket berurutan + soal tertanam",
    tags: ["bundles"],
    response: z.array(bundleItemWithQuestionSchema),
  },
  "POST /api/bundles/[id]/items": {
    summary: "Tambah soal ke paket",
    tags: ["bundles"],
    response: bundleItemSchema,
  },
  "PUT /api/bundles/[id]/items": {
    summary: "Susun ulang urutan item (atomik)",
    tags: ["bundles"],
    response: okSchema,
  },
  "DELETE /api/bundles/[id]/items/[itemId]": {
    summary: "Lepas soal dari paket",
    tags: ["bundles"],
    response: okSchema,
  },
  "POST /api/bundles/[id]/duplicate": {
    summary: "Duplikasi paket",
    tags: ["bundles"],
    response: bundleSchema,
  },
  "GET /api/bundles/[id]/validate": {
    summary: "Pratinjau kesiapan ekspor",
    tags: ["bundles"],
    response: bundleValidationSchema,
  },
  "POST /api/bundles/[id]/export/moodle": {
    summary: "Ekspor paket ke folder GitSync",
    tags: ["bundles"],
    response: z.looseObject({ ok: z.boolean(), bundleTitle: z.string(), exported: z.number().int(), skipped: z.array(z.object({ name: z.string(), type: z.string(), reason: z.string() })), withoutAnswerKey: z.array(z.string()), directory: z.string().nullable(), written: z.number().int(), committed: z.boolean(), commitHash: z.string().nullable(), note: z.string() }),
    successDescription: "Ekspor ditulis ke folder GitSync dan di-commit.",
    extraErrors: [422],
    notes: ["422 `EXPORT_BLOCKED` bila ada soal tanpa kunci jawaban."],
  },
  "GET /api/topics": {
    summary: "Daftar topik",
    tags: ["taxonomy"],
    response: z.array(topicSchema),
  },
  "POST /api/topics": {
    summary: "Buat topik",
    tags: ["taxonomy"],
    response: topicSchema,
  },
  "GET /api/topics/[id]": {
    summary: "Detail topik",
    tags: ["taxonomy"],
    response: topicSchema,
  },
  "PATCH /api/topics/[id]": {
    summary: "Ubah/pindah topik (propagasi level)",
    tags: ["taxonomy"],
    response: topicSchema,
    notes: ["Re-parent mempropagasi `level` ke seluruh subtree dalam satu transaksi."],
  },
  "DELETE /api/topics/[id]": {
    summary: "Hapus topik",
    tags: ["taxonomy"],
    response: okSchema,
  },
  "GET /api/tags": {
    summary: "Daftar label",
    tags: ["taxonomy"],
    response: z.array(tagSchema),
  },
  "POST /api/tags": {
    summary: "Buat label",
    tags: ["taxonomy"],
    response: tagSchema,
  },
  "PATCH /api/tags/[id]": {
    summary: "Ubah label",
    tags: ["taxonomy"],
    response: tagSchema,
  },
  "DELETE /api/tags/[id]": {
    summary: "Hapus label",
    tags: ["taxonomy"],
    response: okSchema,
  },
  "POST /api/tags/merge": {
    summary: "Gabung label",
    tags: ["taxonomy"],
    response: z.object({ moved: z.number().int() }),
  },
  "POST /api/tags/clean-unused": {
    summary: "Hapus label tanpa pemakaian",
    tags: ["taxonomy"],
    response: z.object({ removed: z.number().int() }),
  },
  "GET /api/sources": {
    summary: "Daftar sumber",
    tags: ["taxonomy"],
    response: z.array(sourceSchema),
  },
  "POST /api/sources": {
    summary: "Buat sumber",
    tags: ["taxonomy"],
    response: sourceSchema,
  },
  "PATCH /api/sources/[id]": {
    summary: "Ubah sumber",
    tags: ["taxonomy"],
    response: sourceSchema,
  },
  "DELETE /api/sources/[id]": {
    summary: "Hapus sumber",
    tags: ["taxonomy"],
    response: okSchema,
  },
  "GET /api/events": {
    summary: "Daftar event ujian",
    tags: ["taxonomy"],
    response: z.array(eventSchema),
  },
  "POST /api/events": {
    summary: "Buat event",
    tags: ["taxonomy"],
    response: eventSchema,
  },
  "PATCH /api/events/[id]": {
    summary: "Ubah event",
    tags: ["taxonomy"],
    response: eventSchema,
  },
  "DELETE /api/events/[id]": {
    summary: "Hapus event",
    tags: ["taxonomy"],
    response: okSchema,
  },
  "GET /api/grades": {
    summary: "Daftar jenjang",
    tags: ["taxonomy"],
    response: z.array(gradeSchema),
  },
  "GET /api/stats": {
    summary: "Statistik dasbor",
    tags: ["questions"],
    response: statsSchema,
  },
  "GET /api/media": {
    summary: "Daftar aset media",
    tags: ["media"],
    response: z.object({ items: z.array(galleryRowSchema), data: z.array(galleryRowSchema), total: z.number().int() }),
    notes: ["`data` adalah alias lama dari `items` — dipertahankan demi kompatibilitas UI."],
  },
  "POST /api/media/upload": {
    summary: "Unggah aset media (multipart)",
    tags: ["media"],
    response: z.object({ id: z.string(), shortId: z.string(), shortcode: z.string(), reused: z.boolean() }),
    notes: ["Body `multipart/form-data`, field `file` (PNG/JPG/GIF/WebP/SVG/AVIF)."],
  },
  "GET /api/media/[shortId]": {
    summary: "Detail aset + soal pemakai",
    tags: ["media"],
    response: z.looseObject({ asset: mediaAssetSchema, usedBy: z.array(z.object({ questionId: uuid, role: z.string().nullable(), orderIndex: z.number().int().nullable() })) }),
  },
  "PATCH /api/media/[shortId]": {
    summary: "Ubah metadata aset",
    tags: ["media"],
    response: z.object({ id: uuid, shortId: z.string(), title: z.string().nullable() }),
  },
  "DELETE /api/media/[shortId]": {
    summary: "Hapus aset + berkas fisik",
    tags: ["media"],
    response: z.object({ shortId: z.string(), filesRemoved: z.number().int() }),
    extraErrors: [409],
    notes: ["409 bila aset masih dipakai soal (FK RESTRICT)."],
  },
  "GET /api/media/orphans": {
    summary: "Aset tanpa pemakai",
    tags: ["media"],
    response: z.object({ data: z.array(galleryRowSchema), total: z.number().int(), totalBytes: z.number().int() }),
  },
  "POST /api/ai/embed": {
    summary: "Hitung embedding soal",
    tags: ["ai"],
    response: z.object({ ok: z.number().int(), results: z.array(z.object({ questionId: uuid, ok: z.boolean(), skipped: z.boolean().optional(), error: z.string().optional() })) }),
  },
  "POST /api/ai/enrich": {
    summary: "Enrichment pedagogis (satu atau massal)",
    tags: ["ai"],
    response: z.looseObject({ mode: z.enum(["single", "batch"]), result: z.unknown().optional(), ok: z.number().int().optional(), failed: z.number().int().optional(), results: z.array(z.unknown()).optional() }),
  },
  "GET /api/ai/health": {
    summary: "Status layanan LLM & embedding",
    tags: ["ai"],
    response: z.object({ llm: z.object({ enabled: z.boolean(), model: z.string().nullable(), ok: z.boolean(), error: z.string().nullable() }), embedding: z.object({ ok: z.boolean(), error: z.string().nullable() }) }),
  },
  "GET /api/ai/models": {
    summary: "Daftar model yang tersedia",
    tags: ["ai"],
    response: z.object({ models: z.array(z.string()), error: z.string().optional() }),
  },
  "GET /api/ai/settings": {
    summary: "Baca konfigurasi AI",
    tags: ["ai"],
    response: z.object({ items: z.array(settingsItemSchema) }),
  },
  "POST /api/ai/settings": {
    summary: "Simpan konfigurasi AI",
    tags: ["ai"],
    response: z.object({ items: z.array(settingsItemSchema) }),
  },
  "POST /api/ingest/upload": {
    summary: "Unggah naskah ke antrean ingest",
    tags: ["ingest"],
    response: z.object({ id: uuid, status: z.enum(["pending", "processing", "completed", "failed", "skipped"]), deduped: z.boolean() }),
  },
  "GET /api/ingest/queue": {
    summary: "Antrean ingest + ringkasan status",
    tags: ["ingest"],
    response: z.object({ items: z.array(queueItemSchema), counts: z.record(z.string(), z.number()) }),
    notes: ["Izin khusus `ingest:queue:read` — `question:view` tertutup untuk peran `machine`."],
  },
  "POST /api/ingest/commit": {
    summary: "Commit antrean → soal draft",
    tags: ["ingest"],
    response: z.looseObject({ summary: z.record(z.string(), z.unknown()), results: z.array(z.unknown()), eventsTagged: z.number().int(), unknownEvents: z.array(z.string()), eventsError: z.string().optional() }),
  },
  "GET /api/settings": {
    summary: "Baca pengaturan aplikasi",
    tags: ["system"],
    response: z.object({ items: z.array(settingsItemSchema) }),
  },
  "PATCH /api/settings": {
    summary: "Ubah pengaturan aplikasi",
    tags: ["system"],
    response: z.object({ items: z.array(settingsItemSchema) }),
  },
  "GET /api/system/agent-keys": {
    summary: "Daftar API key agen",
    tags: ["system"],
    response: z.object({ items: z.array(agentKeySchema) }),
  },
  "POST /api/system/agent-keys": {
    summary: "Buat API key agen (rahasia sekali)",
    tags: ["system"],
    response: z.object({ id: z.string(), key: z.string(), prefix: z.string().nullable(), name: z.string().nullable() }),
    notes: ["`key` hanya dikembalikan sekali; server menyimpan hash-nya."],
  },
  "DELETE /api/system/agent-keys/[id]": {
    summary: "Cabut API key agen",
    tags: ["system"],
    response: okSchema,
  },
  "GET /api/dev/demo-status": {
    summary: "Status login demo",
    tags: ["system"],
    response: z.object({ demo: z.boolean() }),
    notes: ["Satu-satunya route `public` non-probe; dibaca halaman /login sebelum ada sesi."],
  },
};

/* ── Route non-wrap (overlay manual) ──────────────────────────────────── */

const errorBody = {
  "application/json": {
    schema: {
      type: "object",
      required: ["error"],
      properties: {
        error: {
          type: "object",
          required: ["code", "message"],
          properties: { code: { type: "string" }, message: { type: "string" } },
        },
      },
    },
  },
};

const invariantsSchema = {
  type: "object",
  description: "Hasil evaluator invarian skema (trigger/CHECK/HNSW/uuidv7).",
  properties: {
    ok: { type: "boolean" },
    counts: { type: "object", additionalProperties: { type: "number" } },
    missingTriggers: { type: "array", items: { type: "string" } },
    missingChecks: { type: "array", items: { type: "string" } },
    forbiddenTablesPresent: { type: "array", items: { type: "string" } },
    pkUsesUuidv7: { type: "boolean" },
    problems: { type: "array", items: { type: "string" } },
  },
};

/**
 * Route yang tidak lewat `wrapRoute` — bentuk responsnya tidak bisa diturunkan
 * dari skema Zod, jadi didokumentasikan manual di sini.
 *
 * Kunci: `METHOD /path`. Keberadaannya diperiksa silang dengan `MANUAL_ROUTES`
 * di `route-inventory.ts` (generator gagal bila salah satu tertinggal).
 */
export const MANUAL_OPERATIONS: Readonly<Record<string, ManualOperationDoc>> = {
  "GET /api/health": {
    summary: "Kesehatan aplikasi (liveness + readiness)",
    description: "200 = sehat, 503 = ada masalah (DB tak terjangkau / invarian hilang). Tanpa auth, untuk probe monitoring. `?probe=liveness` melewati pemeriksaan DB.",
    tags: ["observability"],
    security: "none",
    responses: {
      "200": {
        description: "Sehat (atau liveness saja).",
        content: { "application/json": { schema: {
          type: "object",
          required: ["data"],
          properties: { data: {
            type: "object",
            required: ["status"],
            properties: {
              status: { type: "string", enum: ["ok", "degraded"] },
              db: { type: "string", enum: ["up"] },
              uptimeSec: { type: "integer" },
              latencyMs: { type: "integer" },
              invariants: invariantsSchema,
            },
          } },
        } } },
      },
      "503": {
        description: "DB mati atau invarian hilang. Pesan generik (detail hanya di log server).",
        content: { "application/json": { schema: {
          type: "object",
          required: ["data"],
          properties: { data: {
            type: "object",
            required: ["status", "db"],
            properties: {
              status: { type: "string", enum: ["ok", "degraded", "down"] },
              db: { type: "string", enum: ["up", "down"] },
              latencyMs: { type: "integer" },
              message: { type: "string" },
            },
          } },
        } } },
      },
      "429": { description: "Rate limit jalur DB (per IP).", content: errorBody },
    },
    notes: ["Tidak lewat wrapRoute: status sukses dinamis 200/503."],
  },
  "GET /api/ready": {
    summary: "Readiness probe",
    description: "Menjawab 'siap melayani trafik?' — koneksi DB + keutuhan invarian skema. 200 siap, 503 belum.",
    tags: ["observability"],
    security: "none",
    responses: {
      "200": {
        description: "Siap melayani.",
        content: { "application/json": { schema: {
          type: "object",
          properties: { data: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ready", "degraded"] },
              db: { type: "string", enum: ["up"] },
              latencyMs: { type: "integer" },
              invariants: invariantsSchema,
            },
          } },
        } } },
      },
      "503": { description: "Belum siap.", content: errorBody },
      "429": { description: "Rate limit (per IP).", content: errorBody },
    },
  },
  "GET /api/metrics": {
    summary: "Metrik runtime",
    description: "Ringkasan in-memory: uptime, total permintaan/galat, metrik per-route. Dijaga METRICS_TOKEN; 404 di produksi bila token tak diset (agar keberadaan endpoint tak terbongkar).",
    tags: ["observability"],
    security: "none",
    accessLabel: "token",
    responses: {
      "200": {
        description: "Snapshot metrik.",
        content: { "application/json": { schema: {
          type: "object",
          properties: { data: {
            type: "object",
            properties: {
              uptimeSec: { type: "number" },
              totalRequests: { type: "number" },
              totalErrors: { type: "number" },
              routeCount: { type: "integer" },
              evictedLabels: { type: "integer" },
              maxRoutes: { type: "integer" },
              routes: { type: "array", items: {
                type: "object",
                properties: {
                  route: { type: "string" },
                  count: { type: "integer" },
                  errors: { type: "integer" },
                  clientErrors: { type: "integer" },
                  avgMs: { type: "number" },
                  p50Ms: { type: "number" },
                  p95Ms: { type: "number" },
                  maxMs: { type: "number" },
                },
              } },
            },
          } },
        } } },
      },
      "401": { description: "Token salah.", content: errorBody },
      "404": { description: "Nonaktif (produksi tanpa METRICS_TOKEN).", content: errorBody },
    },
  },
  "POST /api/mcp": {
    summary: "Transport MCP (Streamable HTTP, stateless)",
    description: "JSON-RPC 2.0. Otorisasi bearer di handler (API key agen), bukan gerbang izin peran. Stateless: satu POST = satu panggilan; tak ada stream yang ditahan.",
    tags: ["system"],
    security: "bearer",
    requestBody: {
      required: true,
      content: { "application/json": { schema: { type: "object", description: "Pesan JSON-RPC 2.0 (initialize, tools/list, tools/call, ...)." } } },
    },
    responses: {
      "200": {
        description: "Respons JSON-RPC. Bentuk galat memakai `{ jsonrpc, error: { code, message }, id }`, BUKAN envelope REST `{ error }`.",
        content: { "application/json": { schema: { type: "object", properties: { jsonrpc: { type: "string" }, id: { type: ["string", "number", "null"] }, result: {}, error: { type: "object", properties: { code: { type: "integer" }, message: { type: "string" } } } } } } },
      },
      "401": { description: "API key tidak valid (JSON-RPC error).", content: errorBody },
      "429": { description: "Rate limit transport.", content: errorBody },
    },
    notes: ["Tidak lewat wrapRoute: protokol MCP punya bentuk galat sendiri."],
  },
  "GET /api/mcp": {
    summary: "Metode MCP tak dipakai (405)",
    description: "Mode stateless hanya butuh POST; GET ditolak untuk mengurangi permukaan serangan.",
    tags: ["system"],
    security: "none",
    responses: {
      "405": {
        description: "Method Not Allowed (JSON-RPC error -32000).",
        content: { "application/json": { schema: { type: "object", properties: { jsonrpc: { type: "string" }, error: { type: "object", properties: { code: { type: "integer" }, message: { type: "string" } } }, id: { type: "null" } } } } },
      },
    },
  },
  "DELETE /api/mcp": {
    summary: "Akhiri sesi MCP (405 pada mode stateless)",
    description: "Sama seperti GET: tidak dipakai pada transport stateless.",
    tags: ["system"],
    security: "none",
    responses: {
      "405": {
        description: "Method Not Allowed (JSON-RPC error -32000).",
        content: { "application/json": { schema: { type: "object", properties: { jsonrpc: { type: "string" }, error: { type: "object", properties: { code: { type: "integer" }, message: { type: "string" } } }, id: { type: "null" } } } } },
      },
    },
  },
  "POST /api/dev/quick-login": {
    summary: "Login cepat akun demo",
    description: "Mati (404) di lingkungan production-like kecuali DEMO_LOGIN=enabled DAN DEMO_LOGIN_PUBLIC=true. Rate limit manual 10 burst / 0,2 per detik per IP.",
    tags: ["system"],
    security: "none",
    requestBody: {
      required: true,
      content: { "application/json": { schema: { type: "object", required: ["key"], properties: { key: { type: "string", description: "admin | guru | penelaah" } } } } },
    },
    responses: {
      "200": {
        description: "Sesi demo dibuat; cookie sesi diteruskan via Set-Cookie.",
        headers: { "Set-Cookie": { description: "Cookie sesi Better Auth.", schema: { type: "string" } } },
        content: { "application/json": { schema: { type: "object", properties: { data: { type: "object", properties: { ok: { type: "boolean" }, key: { type: "string" }, name: { type: "string" } } } } } } },
      },
      "400": { description: "Body tak valid.", content: errorBody },
      "404": { description: "Demo dimatikan di lingkungan ini, atau akun demo tak dikenal.", content: errorBody },
      "429": { description: "Rate limit.", content: errorBody },
      "500": { description: "Sign-in Better Auth gagal (mis. seed belum dijalankan).", content: errorBody },
    },
    notes: ["Tidak lewat wrapRoute: kontrak respons 404/400/500 + Set-Cookie dipertahankan."],
  },
  "GET /api/auth/[...all]": {
    summary: "Handler Better Auth (semua metode)",
    description: "Delegasi penuh ke Better Auth: login, logout, sesi, API key. Bentuk respons milik pustaka, BUKAN envelope MathBank.",
    tags: ["auth"],
    security: "delegated",
    parameters: [
      {
        name: "all",
        in: "path",
        required: true,
        description: "Sisa jalur Better Auth (boleh lebih dari satu segmen), mis. `sign-in/email`.",
        schema: { type: "string" },
      },
    ],
    responses: {
      "200": { description: "Respons Better Auth (JSON sesi / redirect / Set-Cookie)." },
      "3XX": { description: "Redirect OAuth / callback." },
      "4XX": { description: "Galat Better Auth (mis. kredensial salah)." },
    },
  },
  "POST /api/auth/[...all]": {
    summary: "Handler Better Auth (semua metode)",
    description: "Sama dengan GET: delegasi penuh ke Better Auth (sign-in, sign-out, callback).",
    tags: ["auth"],
    security: "delegated",
    parameters: [
      {
        name: "all",
        in: "path",
        required: true,
        description: "Sisa jalur Better Auth (boleh lebih dari satu segmen).",
        schema: { type: "string" },
      },
    ],
    responses: {
      "200": { description: "Respons Better Auth (JSON sesi / redirect / Set-Cookie)." },
      "3XX": { description: "Redirect OAuth / callback." },
      "4XX": { description: "Galat Better Auth (mis. kredensial salah)." },
    },
  },
  "POST /api/v1/ingest/upload": {
    summary: "Alias deprecated: unggah naskah ke antrean",
    description: "DEPRECATED — pakai POST /api/ingest/upload. Perilaku identik dengan jalur kanonik (handler yang sama), ditambah header Deprecation/Sunset. Alias berakhir 2027-01-25 (ADR-0028).",
    tags: ["ingest"],
    security: "bearer",
    deprecated: true,
    responses: {
      "201": { description: "Sama dengan jalur kanonik." },
      "4XX": { description: "Sama dengan jalur kanonik." },
    },
  },
  "GET /api/v1/ingest/queue": {
    summary: "Alias deprecated: antrean ingest + ringkasan status",
    description: "DEPRECATED — pakai GET /api/ingest/queue. Perilaku identik dengan jalur kanonik (handler yang sama), ditambah header Deprecation/Sunset. Alias berakhir 2027-01-25 (ADR-0028).",
    tags: ["ingest"],
    security: "bearer",
    deprecated: true,
    responses: {
      "200": { description: "Sama dengan jalur kanonik." },
      "4XX": { description: "Sama dengan jalur kanonik." },
    },
  },
  "POST /api/v1/ingest/commit": {
    summary: "Alias deprecated: commit antrean menjadi soal draft",
    description: "DEPRECATED — pakai POST /api/ingest/commit. Perilaku identik dengan jalur kanonik (handler yang sama), ditambah header Deprecation/Sunset. Alias berakhir 2027-01-25 (ADR-0028).",
    tags: ["ingest"],
    security: "bearer",
    deprecated: true,
    responses: {
      "200": { description: "Sama dengan jalur kanonik." },
      "4XX": { description: "Sama dengan jalur kanonik." },
    },
  },
};
