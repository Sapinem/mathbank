import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Actor } from "@/lib/auth/actor";
import { assertMcp, canMcp, MCP_CAPABILITIES, type McpCapability } from "@/lib/mcp/policy";
import { listQuestions, getQuestion, getQuestionInternal, createQuestion, updateQuestion, setQuestionFlag } from "@/lib/services/question-service";
import { listTopics } from "@/lib/services/topic-service";
import { listSources } from "@/lib/services/taxonomy-service";
import { enrichQuestion, embedQuestions } from "@/lib/services/enrichment-service";
import {
  createQuestionSchema,
  listQuestionsQuerySchema,
  listQuestionsMcpInputShape,
} from "@/lib/contracts/question";
import { enrichFieldSchema } from "@/lib/contracts/ai";
import { lintKatex } from "@/lib/math/katex-lint";

/**
 * Tool MCP (M11, L9) — tipis: validasi input → panggil SERVICE yang sudah ada.
 *
 * Aturan:
 *  - Semua izin lewat `policy.ts` (satu tempat), tak ada cek izin ad-hoc.
 *  - **ARC-06:** tool yang kapabilitasnya TIDAK dimiliki aktor **tidak
 *    didaftarkan sama sekali** → tak muncul di `tools/list`, dan pemanggilannya
 *    dijawab "Tool not found". `assertMcp` tetap dipasang di tiap handler
 *    sebagai pertahanan berlapis (jika daftar izin berubah saat runtime).
 *  - Tool yang mengembalikan soal memakai proyeksi aman → **tanpa `answer_key`**
 *    (dijamin `getQuestion`/`listQuestions` dengan viewer `agent`).
 *  - Tulis apa pun lewat service (audit + invarian DB tetap berlaku).
 *  - `env`/`deps` disuntik agar mudah dites.
 */

/** Hasil standar tool (teks JSON). */
function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** Bungkus aksi supaya error jadi keluaran tool yang rapi, bukan crash. */
async function guard(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await fn());
  } catch (e) {
    const err = e as Error & { code?: string; details?: unknown; issues?: unknown };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: err.message,
              code: err.code ?? "ERROR",
              ...(err.details || err.issues ? { details: err.details ?? err.issues } : {}),
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tegaskan kapabilitas MCP untuk SATU soal konkret (Fase 3).
 *
 * `assertMcp` tanpa `ownerId` tidak menegakkan izin ber-`own` (cabang
 * `opts === undefined` di `policy.ts` hanya memeriksa peran tidak `no`) —
 * jadi tool per-objek WAJIB memuat kepemilikan dulu, lalu meneruskan
 * `ownerId` penulis soal. Baris internal yang dimuat HANYA dipakai untuk
 * `authorId` dan tidak pernah dikembalikan ke pemanggil tool.
 * Soal tak ditemukan → NOT_FOUND, sama seperti perilaku service.
 */
async function assertMcpForQuestion(
  actor: Actor,
  capability: McpCapability,
  id: string,
): Promise<void> {
  const existing = await getQuestionInternal(id);
  if (!existing) {
    throw Object.assign(new Error("Soal tidak ditemukan"), { code: "NOT_FOUND" });
  }
  assertMcp(actor, capability, { ownerId: existing.authorId });
}

/** Daftarkan seluruh tool MCP yang DIIZINKAN ke server. `actor` = pemanggil. */
export function registerTools(server: McpServer, actor: Actor): void {
  /** ARC-06: hanya daftarkan tool bila aktor punya kapabilitasnya. */
  const allowed = (capability: McpCapability, opts?: { ownerId?: string | null }): boolean =>
    canMcp(actor, capability, opts);

  // ── Cari soal (teks / semantik) ──────────────────────────────
  if (allowed("question.read")) {
    server.registerTool(
      "search_questions",
      {
        title: "Cari soal",
        description:
          "Cari soal di bank soal MathBank. Mode 'text' (default, tahan typo) atau 'semantic' (mirip makna). " +
          "Hasil TIDAK menyertakan answer_key.",
        // Satu sumber kebenaran dengan REST (contracts/question.ts).
        inputSchema: listQuestionsMcpInputShape,
      },
      async (args) =>
        guard(async () => {
          assertMcp(actor, "question.read");
          // Skema REST menormalkan nilai tunggal → array sendiri (asArray).
          const query = listQuestionsQuerySchema.parse(args);
          const res = await listQuestions(query, actor);
          return { items: res.items, total: res.total };
        }),
    );

    // ── Ambil satu soal (proyeksi aman) ────────────────────────
    server.registerTool(
      "get_question",
      {
        title: "Ambil soal",
        description: "Ambil satu soal berdasarkan id. Hasil TIDAK menyertakan answer_key.",
        inputSchema: { id: z.string().uuid().describe("ID soal") },
      },
      async ({ id }) =>
        guard(async () => {
          assertMcp(actor, "question.read");
          const q = await getQuestion(id, { viewer: actor });
          if (!q) throw Object.assign(new Error("Soal tidak ditemukan"), { code: "NOT_FOUND" });
          return q;
        }),
    );
  }

  // ── Buat soal (draft) ────────────────────────────────────────
  if (allowed("question.create")) {
    server.registerTool(
      "create_question",
      {
        title: "Buat soal",
        description:
          "Buat satu soal baru (status draft). Gunakan `list_topics` untuk mendapatkan topicIds yang sah.",
        inputSchema: {
          questionType: createQuestionSchema.shape.questionType,
          difficulty: createQuestionSchema.shape.difficulty,
          cognitiveLevel: createQuestionSchema.shape.cognitiveLevel,
          grade: createQuestionSchema.shape.grade,
          contentMarkdown: createQuestionSchema.shape.contentMarkdown,
          dataPayload: createQuestionSchema.shape.dataPayload.optional(),
          answerKey: createQuestionSchema.shape.answerKey.optional(),
          parentId: z.string().uuid().nullable().optional(),
          childOrder: z.number().int().min(0).default(0),
          topicIds: z.array(z.string().uuid()).default([]),
          tagIds: z.array(z.string().uuid()).default([]),
          options: createQuestionSchema.shape.options.optional(),
        },
      },
      async (args) =>
        guard(async () => {
          assertMcp(actor, "question.create");
          // Paksa draft: agen tak boleh langsung menerbitkan (L1).
          const input = createQuestionSchema.parse({ ...args, status: "draft" });
          const q = await createQuestion(input, actor);
          return { id: q.id, status: q.status };
        }),
    );
  }

  // ── Perbarui draf soal milik sendiri ─────────────────────────
  if (allowed("question.edit")) {
    server.registerTool(
      "update_question",
      {
        title: "Perbarui draf soal",
        description: "Perbarui draf soal yang dibuat oleh agen ini sendiri (hanya draf milik sendiri).",
        inputSchema: {
          id: z.string().uuid(),
          version: z.number().int().optional().describe("Versi soal untuk konkurensi optimistik (ADR-0030)"),
          contentMarkdown: z.string().min(1).optional(),
          difficulty: z.number().int().min(1).max(5).optional(),
          cognitiveLevel: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]).optional(),
          grade: z.string().max(20).optional(),
          topicIds: z.array(z.string().uuid()).optional(),
          tagIds: z.array(z.string().uuid()).optional(),
          options: createQuestionSchema.shape.options.optional(),
          dataPayload: z.record(z.string(), z.unknown()).optional(),
          answerKey: z.record(z.string(), z.unknown()).optional(),
        },
      },
      async ({ id, version, ...patch }) =>
        guard(async () => {
          // Fase 3: penegakan `own` di lapisan MCP, bukan hanya di service.
          await assertMcpForQuestion(actor, "question.edit", id);
          const q = await updateQuestion(id, patch, actor, version);
          return { id: q.id, status: q.status, version: q.version };
        }),
    );
  }

  // ── Flagging masalah kualitas soal (kurasi agen) ─────────────
  if (allowed("question.flag")) {
    server.registerTool(
      "flag_question",
      {
        title: "Tandai masalah kualitas soal",
        description: "Tandai soal yang memiliki masalah kualitas (KaTeX rusak, format tidak rapi, dsb) untuk ditinjau guru.",
        inputSchema: {
          id: z.string().uuid(),
          version: z.number().int().optional().describe("Versi soal untuk konkurensi optimistik (ADR-0030)"),
          flagged: z.boolean().default(true),
          notes: z.string().max(1000).optional(),
        },
      },
      async ({ id, version, flagged, notes }) =>
        guard(async () => {
          // Fase 3: ownerId diteruskan agar lapisan MCP konsisten dengan
          // service. Catatan: `question:flag` L1 adalah `yes` untuk agent &
          // reviewer (kurasi soal siapa pun) dan `own` untuk teacher — jadi
          // untuk agent/reviewer ini tetap lolos soal siapa pun, sedangkan
          // teacher hanya soal sendiri. Perilaku flag TIDAK diubah, yang
          // ditutup adalah ketergantungan pada satu lapisan saja.
          await assertMcpForQuestion(actor, "question.flag", id);
          const updated = await setQuestionFlag(id, flagged, notes ?? null, actor, version);
          return { id: updated.id, isFlagged: updated.isFlagged, version: updated.version };
        }),
    );
  }

  // ── Daftar topik & sumber (taksonomi baca) ───────────────────
  if (allowed("taxonomy.read")) {
    server.registerTool(
      "list_topics",
      {
        title: "Daftar topik",
        description: "Daftar seluruh topik (untuk memilih topicIds saat membuat soal).",
        inputSchema: {},
      },
      async () =>
        guard(async () => {
          assertMcp(actor, "taxonomy.read");
          return await listTopics();
        }),
    );

    server.registerTool(
      "list_sources",
      {
        title: "Daftar sumber",
        description: "Daftar sumber & asal soal.",
        inputSchema: {},
      },
      async () =>
        guard(async () => {
          assertMcp(actor, "taxonomy.read");
          return await listSources();
        }),
    );

    server.registerTool(
      "validate_math",
      {
        title: "Validasi KaTeX matematika",
        description: "Periksa keabsahan sintaksis KaTeX/LaTeX pada teks tanpa menyentuh basis data.",
        inputSchema: {
          text: z.string().min(1).max(50000),
        },
      },
      async ({ text }) =>
        guard(async () => {
          // Fase 3: handler ini sebelumnya tanpa assertMcp sama sekali.
          // Kapabilitasnya sudah dipetakan ke `taxonomy.read` (= question:view)
          // di MCP_TOOL_CAPABILITIES dan pendaftarannya sudah digerbang oleh
          // blok `taxonomy.read` di atas; assert di sini menutup pertahanan
          // berlapis seperti tool lain. Ini fungsi murni tanpa DB, jadi tidak
          // ada perubahan perilaku bagi aktor yang memang berhak baca.
          assertMcp(actor, "taxonomy.read");
          const issues = lintKatex(text);
          return {
            valid: issues.length === 0,
            issues,
          };
        }),
    );
  }

  // ── Enrichment AI (usulan metadata + kontrak pedagogi MAT-41) ─
  if (allowed("enrichment.run")) {
    server.registerTool(
      "enrich_question",
      {
        title: "Enrich soal dengan AI",
        description:
          "Minta AI mengusulkan metadata (topik/kesulitan/kognitif/tags) dan kontrak pedagogi MAT-41 " +
          "(distractorRationale A–E untuk tiap pengecoh + rubric penilaian esai) untuk SATU soal lalu " +
          "menerapkannya (status draft→review). Field pedagogi bersifat opt-in: sertakan " +
          "'distractorRationale' dan/atau 'rubric' di `fields`; tanpa `fields` hanya metadata yang diusulkan. " +
          "answer_key TIDAK diubah (rubrik ditambahkan, kunci tetap).",
        inputSchema: {
          questionId: z.string().uuid(),
          // SATU sumber kebenaran: enum kanonikal `@/lib/contracts/ai` (MAT-41),
          // bukan daftar terpisah yang bisa menyimpang dari HTTP API.
          fields: enrichFieldSchema
            .array()
            .optional()
            .describe(
              "Field yang di-enrich: topics · difficulty · cognitiveLevel · tags · " +
                "distractorRationale · rubric (default: metadata saja)",
            ),
        },
      },
      async ({ questionId, fields }) =>
        guard(async () => {
          assertMcp(actor, "enrichment.run");
          return await enrichQuestion(questionId, actor, fields);
        }),
    );

    // ── Embedding ──────────────────────────────────────────────
    server.registerTool(
      "embed_questions",
      {
        title: "Hitung embedding soal",
        description: "Hitung & simpan embedding BGE-M3 untuk soal (aktifkan pencarian semantik).",
        inputSchema: {
          questionIds: z.array(z.string().uuid()).min(1).max(100),
          force: z.boolean().default(false),
        },
      },
      async ({ questionIds, force }) =>
        guard(async () => {
          assertMcp(actor, "enrichment.run");
          return await embedQuestions(questionIds, actor, { force });
        }),
    );
  }
}

/** Daftar nama tool (untuk tes & dokumentasi) + kapabilitas yang dipakai. */
export const MCP_TOOL_CAPABILITIES: Record<string, keyof typeof MCP_CAPABILITIES> = {
  search_questions: "question.read",
  get_question: "question.read",
  create_question: "question.create",
  update_question: "question.edit",
  flag_question: "question.flag",
  list_topics: "taxonomy.read",
  list_sources: "taxonomy.read",
  validate_math: "taxonomy.read",
  enrich_question: "enrichment.run",
  embed_questions: "enrichment.run",
};

/**
 * Nama tool yang DIDAFTARKAN untuk aktor ini (ARC-06) — dipakai tes & refleksi.
 * Urutannya mengikuti `MCP_TOOL_CAPABILITIES` agar deterministik.
 */
export function registeredToolNames(actor: Actor): string[] {
  return Object.entries(MCP_TOOL_CAPABILITIES)
    .filter(([, capability]) => canMcp(actor, capability))
    .map(([name]) => name);
}
