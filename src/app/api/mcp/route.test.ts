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
const listTopics = vi.fn(async () => []);
const listSources = vi.fn(async () => []);
const enrichQuestion = vi.fn(async () => ({ ok: true }));
const embedQuestions = vi.fn(async () => ({ ok: 0 }));

vi.mock("@/lib/services/question-service", () => ({
  listQuestions: (...a: unknown[]) => listQuestions(...(a as [])),
  getQuestion: (...a: unknown[]) => getQuestion(...(a as [])),
  createQuestion: (...a: unknown[]) => createQuestion(...(a as [{ status?: string }])),
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
