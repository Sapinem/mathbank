import { describe, it, expect, vi, afterEach } from "vitest";
import {
  embedTexts,
  embedText,
  embeddingHealth,
  embeddingBaseUrl,
  embeddingModel,
  isEmbeddingConfigured,
  EMBEDDING_DIM,
} from "./bge-m3";

function vec(dim = EMBEDDING_DIM, fill = 0.1): number[] {
  return Array.from({ length: dim }, () => fill);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("embedding/bge-m3 — env", () => {
  it("default Ollama localhost", () => {
    expect(embeddingBaseUrl({})).toBe("http://localhost:11434");
    expect(embeddingModel({})).toBe("bge-m3");
    expect(isEmbeddingConfigured({})).toBe(true);
  });
  it("baca ENV + buang garis miring ujung", () => {
    expect(embeddingBaseUrl({ BGE_M3_SERVICE_URL: "http://x:8080/" })).toBe("http://x:8080");
    expect(embeddingModel({ BGE_M3_MODEL: "custom" })).toBe("custom");
  });
});

describe("embedding/bge-m3 — embedTexts", () => {
  it("sukses: kembalikan vektor 1024-dim", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ embeddings: [vec(), vec()] })));
    const r = await embedTexts(["a", "b"], { baseUrl: "http://x" });
    expect(r.ok).toBe(true);
    expect(r.vectors).toHaveLength(2);
    expect(r.vectors![0]).toHaveLength(EMBEDDING_DIM);
  });

  it("menolak dimensi salah (bukan 1024)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ embeddings: [vec(768)] })));
    const r = await embedTexts(["a"], { baseUrl: "http://x" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("768");
  });

  it("menolak jumlah vektor tak sesuai input", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ embeddings: [vec()] })));
    const r = await embedTexts(["a", "b"], { baseUrl: "http://x" });
    expect(r.ok).toBe(false);
  });

  it("input kosong → sukses tanpa panggilan", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r = await embedTexts([], { baseUrl: "http://x" });
    expect(r.ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("HTTP error → {ok:false}", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const r = await embedTexts(["a"], { baseUrl: "http://x" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("503");
  });

  it("mengirim {model, input} ke /api/embed", async () => {
    let url = "";
    let body: { model?: string; input?: string[] } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string, init?: RequestInit) => {
        url = u;
        body = JSON.parse(String(init?.body));
        return jsonResponse({ embeddings: [vec()] });
      }),
    );
    await embedTexts(["hai"], { baseUrl: "http://x", model: "bge-m3" });
    expect(url).toBe("http://x/api/embed");
    expect(body.model).toBe("bge-m3");
    expect(body.input).toEqual(["hai"]);
  });

  it("timeout → error 'timeout'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => {
        return new Promise<Response>((_r, rej) => {
          init?.signal?.addEventListener("abort", () => rej(new Error("The operation was aborted.")));
        });
      }),
    );
    const r = await embedTexts(["a"], { baseUrl: "http://x", timeoutMs: 20 });
    expect(r.error).toBe("timeout");
  });
});

describe("embedding/bge-m3 — embedText & health", () => {
  it("embedText mengembalikan satu vektor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ embeddings: [vec()] })));
    const r = await embedText("x", { baseUrl: "http://x" });
    expect(r.ok).toBe(true);
    expect(r.vector).toHaveLength(EMBEDDING_DIM);
  });
  it("health ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ embeddings: [vec()] })));
    expect((await embeddingHealth({ baseUrl: "http://x" })).ok).toBe(true);
  });
});
