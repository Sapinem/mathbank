import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes ROUTE MCP HTTP (TEST-01, SEC-02, ARC-06) — murni, tanpa DB.
 *
 * Handler route `/api/mcp` dipanggil langsung (bukan lewat jaringan) dan
 * menguji tanggung jawab **route**:
 *  - **401** bila API key tak valid / tak ada.
 *  - **405** untuk GET & DELETE (mode stateless hanya POST).
 *  - **200** + protokol JSON-RPC nyata (initialize → tools/list → tools/call).
 *  - **429** saat rate limit terlampaui (SEC-02).
 *  - **ARC-06**: tool di luar kapabilitas aktor tak didaftarkan.
 *
 * Lapisan service DI-MOCK agar tes tetap di level unit (tak butuh DATABASE_URL),
 * sesuai konvensi `docs/STRATEGI-TES.md` (unit = murni; DB = `*.db.test.ts`).
 * SDK MCP tetap nyata → registrasi tool, validasi skema, & dispatch diuji betulan.
 */

/** Aktor tiruan yang dikembalikan resolver — diubah per-tes. */
let mockActor: Actor | null = {
  id: "route-mcp-agent",
  name: "Agen Route",
  roles: ["agent"],
  via: "apikey",
};
vi.mock("@/lib/auth/resolve", () => ({
  resolveActor: async () => mockActor,
  actorFromApiKey: async () => mockActor,
  actorFromSession: async () => null,
}));

// Service di-mock: route hanya perlu memastikan dispatch & pagar berjalan.
const listQuestions = vi.fn(async () => ({ items: [], total: 0 }));
const getQuestion = vi.fn(async () => null);
const createQuestion = vi.fn(async (input: { status?: string }) => ({
  id: "q-mock",
  status: input.status ?? "draft",
}));
const getQuestionInternal = vi.fn(async (): Promise<{ authorId: string } | null> => ({ authorId: "route-mcp-agent" }));
const updateQuestion = vi.fn(async (id: string) => ({ id, status: "draft" }));
const setQuestionFlag = vi.fn(async (id: string) => ({ id, status: "draft" }));
const listTopics = vi.fn(async () => []);
const listSources = vi.fn(async () => []);
const enrichQuestion = vi.fn(async () => ({ ok: true }));
const embedQuestions = vi.fn(async () => ({ ok: 0 }));

vi.mock("@/lib/services/question-service", () => ({
  listQuestions: (...a: unknown[]) => listQuestions(...(a as [])),
  getQuestion: (...a: unknown[]) => getQuestion(...(a as [])),
  createQuestion: (...a: unknown[]) => createQuestion(...(a as [{ status?: string }])),
  getQuestionInternal: (...a: unknown[]) => getQuestionInternal(...(a as [])),
  updateQuestion: (...a: [string, ...unknown[]]) => updateQuestion(a[0]),
  setQuestionFlag: (...a: [string, ...unknown[]]) => setQuestionFlag(a[0]),
}));
vi.mock("@/lib/services/topic-service", () => ({
  listTopics: (...a: unknown[]) => listTopics(...(a as [])),
}));
vi.mock("@/lib/services/taxonomy-service", () => ({
  listSources: (...a: unknown[]) => listSources(...(a as [])),
}));
vi.mock("@/lib/services/enrichment-service", () => ({
  enrichQuestion: (...a: unknown[]) => enrichQuestion(...(a as [])),
  embedQuestions: (...a: unknown[]) => embedQuestions(...(a as [])),
}));

// Impor SETELAH mock.
const { POST, GET, DELETE } = await import("./route");
const { setStore, MemoryStore } = await import("@/lib/api/rate-limit");

/** Header klien MCP yang sah (Streamable HTTP wajib Accept keduanya). */
const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  "x-api-key": "test-key",
};

/** Request JSON-RPC ke route. */
function rpc(method: string, params?: unknown, id: number | string = 1): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

/** Baca hasil JSON-RPC (respons JSON biasa). */
async function rpcJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  return JSON.parse(text) as Record<string, unknown>;
}

beforeEach(() => {
  setStore(new MemoryStore()); // bucket segar tiap tes
  mockActor = { id: "route-mcp-agent", name: "Agen Route", roles: ["agent"], via: "apikey" };
  vi.clearAllMocks();
});

describe("POST /api/mcp — auth (401)", () => {
  it("401 tanpa API key", async () => {
    mockActor = null;
    const res = await POST(rpc("initialize") as never);
    expect(res.status).toBe(401);
    const body = await rpcJson(res);
    expect(body.error).toBeTruthy();
  });

  it("401 saat auth gagal untuk tools/list", async () => {
    mockActor = null;
    const res = await POST(rpc("tools/list") as never);
    expect(res.status).toBe(401);
  });
});

describe("GET & DELETE /api/mcp — 405", () => {
  it("GET → 405", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    const body = await rpcJson(res);
    expect(JSON.stringify(body)).toMatch(/method not allowed/i);
  });

  it("DELETE → 405", async () => {
    const res = await DELETE();
    expect(res.status).toBe(405);
  });
});

describe("POST /api/mcp — protokol & tool", () => {
  it("initialize → 200 dengan info server", async () => {
    const res = await POST(
      rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await rpcJson(res);
    const result = body.result as { serverInfo?: { name?: string } } | undefined;
    expect(result?.serverInfo?.name).toBe("mathbank");
  });

  it("tools/list menampilkan tool yang diizinkan", async () => {
    const res = await POST(rpc("tools/list") as never);
    expect(res.status).toBe(200);
    const body = await rpcJson(res);
    const tools = (body.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(tools).toContain("search_questions");
    expect(tools).toContain("create_question");
    expect(tools).not.toMatchObject([]);
    expect(tools.some((n) => /delete|bundle|set_?ready|archive/i.test(n))).toBe(false);
  });

  it("tools/call create_question memaksa status draft", async () => {
    const res = await POST(
      rpc("tools/call", {
        name: "create_question",
        arguments: {
          questionType: "single_choice",
          difficulty: 3,
          cognitiveLevel: "apply",
          grade: "SMA-11",
          contentMarkdown: "Hitung $2+2$.",
          topicIds: [],
          answerKey: { type: "single", value: ["B"] },
        },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await rpcJson(res);
    const text = (body.result as { content: { text: string }[] }).content[0]!.text;
    const payload = JSON.parse(text) as { id: string; status: string };
    expect(payload.status).toBe("draft");
    // Service dipanggil dengan status dipaksa draft.
    expect(createQuestion).toHaveBeenCalledTimes(1);
    const arg = createQuestion.mock.calls[0]![0] as { status?: string };
    expect(arg.status).toBe("draft");
  });

  it("tools/call search_questions memanggil service", async () => {
    const res = await POST(
      rpc("tools/call", { name: "search_questions", arguments: { q: "aljabar" } }) as never,
    );
    expect(res.status).toBe(200);
    expect(listQuestions).toHaveBeenCalledTimes(1);
    const body = await rpcJson(res);
    const text = (body.result as { content: { text: string }[] }).content[0]!.text;
    expect(text).not.toMatch(/answer_key|answerKey/i);
  });

  it("ARC-06: aktor tanpa kapabilitas → tool tak terdaftar", async () => {
    // `machine` boleh buat soal (ingest) & enrichment, TAPI tak boleh BACA soal
    // (`question:view` = no) → tool baca/taksonomi tak didaftarkan.
    mockActor = { id: "route-machine", name: "Machine", roles: ["machine"], via: "apikey" };
    const res = await POST(rpc("tools/list") as never);
    const body = await rpcJson(res);
    const tools = (body.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(tools).not.toContain("search_questions");
    expect(tools).not.toContain("get_question");
    expect(tools).not.toContain("list_topics");
    // Kapabilitas yang memang dimiliki machine tetap terdaftar.
    expect(tools).toContain("create_question");
  });

  it("SEC-02: 429 setelah burst rate limit terlampaui", async () => {
    // Habiskan bucket (burst kebijakan MCP = 60).
    let last: Response | null = null;
    for (let i = 0; i < 70; i++) {
      last = await POST(rpc("tools/list", undefined, i) as never);
      if (last.status === 429) break;
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get("retry-after")).toBeTruthy();
  });
});

/** Fase 3: penegakan ownerId di lapisan MCP + assertMcp validate_math. */
describe("POST /api/mcp — Fase 3 policy per-objek", () => {
  const QID = "11111111-1111-4111-8111-111111111111";
  async function callTool(name: string, args: Record<string, unknown>) {
    const res = await POST(rpc("tools/call", { name, arguments: args }) as never);
    expect(res.status).toBe(200);
    const body = await rpcJson(res);
    const result = body.result as { content: { text: string }[]; isError?: boolean };
    return { body, payload: JSON.parse(result.content[0]!.text) as Record<string, unknown>, isError: result.isError };
  }

  it("update_question soal MILIK SENDIRI lolos ke service", async () => {
    getQuestionInternal.mockResolvedValue({ authorId: "route-mcp-agent" });
    const { payload, isError } = await callTool("update_question", { id: QID, contentMarkdown: "Baru." });
    expect(isError).toBeFalsy();
    expect(payload.status).toBe("draft");
    expect(updateQuestion).toHaveBeenCalledTimes(1);
  });

  it("update_question soal ORANG LAIN ditolak di lapisan MCP, service tak dipanggil", async () => {
    getQuestionInternal.mockResolvedValue({ authorId: "orang-lain" });
    const { payload, isError } = await callTool("update_question", { id: QID, contentMarkdown: "Baru." });
    expect(isError).toBe(true);
    expect(payload.code).toBe("FORBIDDEN");
    expect(updateQuestion).not.toHaveBeenCalled();
  });

  it("update_question soal TAK ADA → NOT_FOUND, service tak dipanggil", async () => {
    getQuestionInternal.mockResolvedValue(null);
    const { payload, isError } = await callTool("update_question", { id: QID, contentMarkdown: "Baru." });
    expect(isError).toBe(true);
    expect(payload.code).toBe("NOT_FOUND");
    expect(updateQuestion).not.toHaveBeenCalled();
  });

  it("flag_question: agent (flag=yes) boleh menandai soal siapa pun; teacher hanya miliknya", async () => {
    getQuestionInternal.mockResolvedValue({ authorId: "orang-lain" });
    const agentCall = await callTool("flag_question", { id: QID, flagged: true });
    expect(agentCall.isError).toBeFalsy();
    expect(setQuestionFlag).toHaveBeenCalledTimes(1);

    mockActor = { id: "guru-1", name: "Guru", roles: ["teacher"], via: "apikey" };
    const teacherCall = await callTool("flag_question", { id: QID, flagged: true });
    expect(teacherCall.isError).toBe(true);
    expect(teacherCall.payload.code).toBe("FORBIDDEN");
    expect(setQuestionFlag).toHaveBeenCalledTimes(1); // tak bertambah
  });

  it("validate_math kini melewati assertMcp: agent lolos, machine tak terdaftar", async () => {
    const ok = await callTool("validate_math", { text: "Hitung $2+2$." });
    expect(ok.isError).toBeFalsy();
    expect(ok.payload.valid).toBe(true);

    mockActor = { id: "route-machine", name: "Machine", roles: ["machine"], via: "apikey" };
    const res = await POST(rpc("tools/call", { name: "validate_math", arguments: { text: "$x$" } }) as never);
    const body = await rpcJson(res);
    // Tool tak didaftarkan untuk machine (ARC-06) → SDK menjawab result
    // isError (bukan JSON-RPC error): "Tool validate_math not found".
    const result = body.result as { content: { text: string }[]; isError?: boolean };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/not found/i);
  });
});
