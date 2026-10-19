import { describe, it, expect, vi, afterEach } from "vitest";
import {
  embedTexts,
  embedText,
  embeddingHealth,
  embeddingBaseUrl,
  embeddingEndpoint,
  embeddingModel,
  isEmbeddingConfigured,
  embeddingTimeoutMs,
  EMBEDDING_DIM,
  DEFAULT_EMBEDDING_URL,
} from "./bge-m3";

function vec(dim = EMBEDDING_DIM, fill = 0.1): number[] {
  return Array.from({ length: dim }, () => fill);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Balasan kontrak OpenAI: `{ data: [{ embedding }] }`. */
function openaiBody(vectors: number[][]) {
  return { data: vectors.map((embedding, index) => ({ embedding, index, object: "embedding" })) };
}

afterEach(() => vi.unstubAllGlobals());

describe("embedding/bge-m3 — env", () => {
  it("default = service FastAPI BGE-M3 (127.0.0.1:3005)", () => {
    expect(DEFAULT_EMBEDDING_URL).toBe("http://127.0.0.1:3005");
    expect(embeddingBaseUrl({})).toBe("http://127.0.0.1:3005");
    expect(embeddingModel({})).toBe("bge-m3");
    expect(isEmbeddingConfigured({})).toBe(true);
  });
  it("baca ENV + buang garis miring ujung", () => {
    expect(embeddingBaseUrl({ BGE_M3_SERVICE_URL: "http://x:8080/" })).toBe("http://x:8080");
    expect(embeddingModel({ BGE_M3_MODEL: "custom" })).toBe("custom");
  });
  it("timeout: default 120000, ENV valid dipakai, ENV rusak diabaikan", () => {
    expect(embeddingTimeoutMs({})).toBe(120000);
    expect(embeddingTimeoutMs({ BGE_M3_TIMEOUT_MS: "45000" })).toBe(45000);
    expect(embeddingTimeoutMs({ BGE_M3_TIMEOUT_MS: "abc" })).toBe(120000);
    expect(embeddingTimeoutMs({ BGE_M3_TIMEOUT_MS: "-1" })).toBe(120000);
  });
  it("endpoint: base polos / ber-v1 / URL penuh", () => {
    expect(embeddingEndpoint("http://x:3005")).toBe("http://x:3005/v1/embeddings");
    expect(embeddingEndpoint("http://x:3005/v1")).toBe("http://x:3005/v1/embeddings");
    expect(embeddingEndpoint("http://x:3005/v1/embeddings")).toBe("http://x:3005/v1/embeddings");
  });
});

describe("embedding/bge-m3 — embedTexts", () => {
  it("sukses: kembalikan vektor 1024-dim", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(openaiBody([vec(), vec()]))));
    const r = await embedTexts(["a", "b"], { baseUrl: "http://x" });
    expect(r.ok).toBe(true);
    expect(r.vectors).toHaveLength(2);
    expect(r.vectors![0]).toHaveLength(EMBEDDING_DIM);
  });

  it("menerima balasan gaya lama `{embeddings:[[…]]}`", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ embeddings: [vec()] })));
    const r = await embedTexts(["a"], { baseUrl: "http://x" });
    expect(r.ok).toBe(true);
    expect(r.vectors![0]).toHaveLength(EMBEDDING_DIM);
  });

  it("menolak dimensi salah (bukan 1024)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(openaiBody([vec(768)]))));
    const r = await embedTexts(["a"], { baseUrl: "http://x" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("768");
  });

  it("menolak jumlah vektor tak sesuai input", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(openaiBody([vec()]))));
    const r = await embedTexts(["a", "b"], { baseUrl: "http://x" });
    expect(r.ok).toBe(false);
  });

  it("balasan tanpa vektor → {ok:false}", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ foo: 1 })));
    const r = await embedTexts(["a"], { baseUrl: "http://x" });
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

  it("mengirim {model, input} ke /v1/embeddings", async () => {
    let url = "";
    let body: { model?: string; input?: string[] } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string, init?: RequestInit) => {
        url = u;
        body = JSON.parse(String(init?.body));
        return jsonResponse(openaiBody([vec()]));
      }),
    );
    await embedTexts(["hai"], { baseUrl: "http://x", model: "bge-m3" });
    expect(url).toBe("http://x/v1/embeddings");
    expect(body.model).toBe("bge-m3");
    expect(body.input).toEqual(["hai"]);
  });

  it("vektor bukan array → {ok:false} tanpa melempar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: [{ embedding: "bukan-vektor" }] })));
    const r = await embedTexts(["a"], { baseUrl: "http://x" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("tak sesuai");
  });

  it("fetch melempar non-Error → pesan diteruskan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw "koneksi putus";
      }),
    );
    const r = await embedTexts(["a"], { baseUrl: "http://x" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("koneksi putus");
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
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(openaiBody([vec()]))));
    const r = await embedText("x", { baseUrl: "http://x" });
    expect(r.ok).toBe(true);
    expect(r.vector).toHaveLength(EMBEDDING_DIM);
  });

  it("embedText: gagal → ok:false + error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 502 })));
    const r = await embedText("x", { baseUrl: "http://x" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("502");
    expect(r.vector).toBeUndefined();
  });

  it("health: GET /health → ok + detail", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        urls.push(String(u));
        return jsonResponse({ status: "ok", model: "BAAI/bge-m3", dim: 1024 });
      }),
    );
    const r = await embeddingHealth({ baseUrl: "http://x" });
    expect(r.ok).toBe(true);
    expect(urls).toEqual(["http://x/health"]);
    expect((r.detail as { dim?: number }).dim).toBe(1024);
  });

  it("health: dimensi service salah → ok:false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ status: "ok", dim: 768 })));
    const r = await embeddingHealth({ baseUrl: "http://x" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("768");
  });

  it("health: tanpa /health (404) → probe fungsional embed", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        call += 1;
        if (String(u).endsWith("/health")) return new Response("not found", { status: 404 });
        return jsonResponse(openaiBody([vec()]));
      }),
    );
    const r = await embeddingHealth({ baseUrl: "http://x" });
    expect(r.ok).toBe(true);
    expect(call).toBe(2);
  });

  it("health: balasan /health bukan JSON → tetap ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const r = await embeddingHealth({ baseUrl: "http://x" });
    expect(r.ok).toBe(true);
    expect(r.detail).toBeUndefined();
  });

  it("health: status 500 → ok:false tanpa probe embed", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        return new Response("boom", { status: 500 });
      }),
    );
    const r = await embeddingHealth({ baseUrl: "http://x" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("HTTP 500");
    expect(call).toBe(1);
  });

  it("health: memakai base default + menerima signal", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        urls.push(String(u));
        return jsonResponse({ status: "ok", dim: 1024 });
      }),
    );
    const ctrl = new AbortController();
    const r = await embeddingHealth({ signal: ctrl.signal });
    expect(r.ok).toBe(true);
    expect(urls).toEqual([`${DEFAULT_EMBEDDING_URL}/health`]);
  });

  it("health: service mati → ok:false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    );
    const r = await embeddingHealth({ baseUrl: "http://x" });
    expect(r.ok).toBe(false);
  });
});
