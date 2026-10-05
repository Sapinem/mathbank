import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Actor } from "@/lib/auth/actor";
import { assertMcp, MCP_CAPABILITIES } from "@/lib/mcp/policy";
import { listQuestions, getQuestion, createQuestion } from "@/lib/services/question-service";
import { listTopics } from "@/lib/services/topic-service";
import { listSources } from "@/lib/services/taxonomy-service";
import { enrichQuestion, embedQuestions } from "@/lib/services/enrichment-service";
import { createQuestionSchema, listQuestionsQuerySchema } from "@/lib/contracts/question";
import { enrichFieldSchema } from "@/lib/contracts/ai";

/**
 * Tool MCP (M11, L9) — tipis: validasi input → panggil SERVICE yang sudah ada.
 *
 * Aturan:
 *  - Semua izin lewat `policy.ts` (satu tempat), tak ada cek izin ad-hoc.
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
    const err = e as Error & { code?: string };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: err.message, code: err.code ?? "ERROR" }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

/** Daftarkan seluruh tool MCP ke server. `actor` = identitas pemanggil (per-request). */
export function registerTools(server: McpServer, actor: Actor): void {
  // ── Cari soal (teks / semantik) ──────────────────────────────
  server.registerTool(
    "search_questions",
    {
      title: "Cari soal",
      description:
        "Cari soal di bank soal MathBank. Mode 'text' (default, tahan typo) atau 'semantic' (mirip makna). " +
        "Hasil TIDAK menyertakan answer_key.",
      inputSchema: {
        q: z.string().optional().describe("Kata kunci / pertanyaan alami"),
        mode: z.enum(["text", "semantic"]).default("text"),
        status: z.string().optional().describe("Filter status (draft/review/ready)"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async (args) =>
      guard(async () => {
        assertMcp(actor, "question.read");
        const query = listQuestionsQuerySchema.parse({ ...args });
        const res = await listQuestions(query, actor);
        return { items: res.items, total: res.total };
      }),
  );

  // ── Ambil satu soal (proyeksi aman) ──────────────────────────
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

  // ── Buat soal (draft) ────────────────────────────────────────
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

  // ── Daftar topik ─────────────────────────────────────────────
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

  // ── Daftar sumber ────────────────────────────────────────────
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

  // ── Enrichment AI (usulan metadata + kontrak pedagogi MAT-41) ─
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

  // ── Embedding ────────────────────────────────────────────────
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

/** Daftar nama tool (untuk tes & dokumentasi) + kapabilitas yang dipakai. */
export const MCP_TOOL_CAPABILITIES: Record<string, keyof typeof MCP_CAPABILITIES> = {
  search_questions: "question.read",
  get_question: "question.read",
  create_question: "question.create",
  list_topics: "taxonomy.read",
  list_sources: "taxonomy.read",
  enrich_question: "enrichment.run",
  embed_questions: "enrichment.run",
};
