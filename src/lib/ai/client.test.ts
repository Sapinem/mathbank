import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chat, chatJson, listModels, health, parseJsonLoose } from "./client";
import type { AiConfig } from "./config";

const cfg: AiConfig = {
  enabled: true,
  baseUrl: "https://ai.test/v1/",
  apiKey: "sk-test",
  model: "gpt-test",
  maxTokens: 512,
  timeoutMs: 5000,
};

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("ai/client — chat", () => {
  it("sukses: mengembalikan konten + usage", async () => {
    mockFetch(async () =>
      jsonResponse({ choices: [{ message: { content: "halo" } }], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } }),
    );
    const r = await chat(cfg, [{ role: "user", content: "hai" }]);
    expect(r.ok).toBe(true);
    expect(r.content).toBe("halo");
    expect(r.usage?.totalTokens).toBe(4);
  });

  it("base_url dinormalisasi (garis miring di ujung dibuang)", async () => {
    let called = "";
    mockFetch(async (url) => {
      called = url;
      return jsonResponse({ choices: [{ message: { content: "x" } }] });
    });
    await chat(cfg, [{ role: "user", content: "hi" }]);
    expect(called).toBe("https://ai.test/v1/chat/completions");
  });

  it("mengirim Authorization bila apiKey ada", async () => {
    let headers: Record<string, string> = {};
    mockFetch(async (_url, init) => {
      headers = (init?.headers ?? {}) as Record<string, string>;
      return jsonResponse({ choices: [{ message: { content: "x" } }] });
    });
    await chat(cfg, [{ role: "user", content: "hi" }]);
    expect(headers.Authorization).toBe("Bearer sk-test");
  });

  it("HTTP error → {ok:false,error}", async () => {
    mockFetch(async () => new Response("boom", { status: 500 }));
    const r = await chat(cfg, [{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("500");
  });

  it("balasan tanpa konten → error", async () => {
    mockFetch(async () => jsonResponse({ choices: [{}] }));
    const r = await chat(cfg, [{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
  });

  it("dinonaktifkan → error, tak memanggil fetch", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r = await chat({ ...cfg, enabled: false }, [{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("base_url kosong → error", async () => {
    const r = await chat({ ...cfg, baseUrl: "" }, [{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
  });

  it("timeout → {ok:false,error:'timeout'}", async () => {
    mockFetch(async (_url, init) => {
      // Simulasi abort saat signal dipicu.
      return new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new Error("The operation was aborted.")));
      });
    });
    const r = await chat({ ...cfg, timeoutMs: 20 }, [{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("timeout");
  });
});

describe("ai/client — chatJson & parseJsonLoose", () => {
  it("parse JSON bersih", async () => {
    mockFetch(async () => jsonResponse({ choices: [{ message: { content: '{"a":1}' } }] }));
    const r = await chatJson<{ a: number }>(cfg, [{ role: "user", content: "x" }]);
    expect(r.ok).toBe(true);
    expect(r.data?.a).toBe(1);
  });

  it("parse toleran pagar ```json", () => {
    expect(parseJsonLoose('```json\n{"x":2}\n```')).toEqual({ x: 2 });
  });

  it("parse toleran teks bersampul", () => {
    expect(parseJsonLoose('Berikut: {"y":3} selesai')).toEqual({ y: 3 });
  });

  it("bukan JSON → undefined", () => {
    expect(parseJsonLoose("halo dunia")).toBeUndefined();
  });
});

describe("ai/client — listModels & health", () => {
  it("listModels: baca data[].id (OpenAI)", async () => {
    mockFetch(async () => jsonResponse({ data: [{ id: "m2" }, { id: "m1" }] }));
    const r = await listModels(cfg);
    expect(r.ok).toBe(true);
    expect(r.models).toEqual(["m1", "m2"]);
  });

  it("listModels: baca models[].name (Ollama-native)", async () => {
    mockFetch(async () => jsonResponse({ models: [{ name: "bge-m3" }] }));
    const r = await listModels(cfg);
    expect(r.models).toContain("bge-m3");
  });

  it("health: ok bila listModels ok", async () => {
    mockFetch(async () => jsonResponse({ data: [{ id: "x" }] }));
    expect((await health(cfg)).ok).toBe(true);
  });

  it("health: enabled=false → error", async () => {
    expect((await health({ ...cfg, enabled: false })).ok).toBe(false);
  });

  it("listModels tanpa base_url → error", async () => {
    const r = await listModels({ ...cfg, baseUrl: "" });
    expect(r.ok).toBe(false);
  });
});
