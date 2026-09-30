/**
 * Embedding BGE-M3 (M10-c) — via Ollama (`POST /api/embed`).
 *
 * **Keputusan D1 (2026-09-30):** BGE-M3 di-host **Ollama lokal**.
 * Terukur: dim **1024**, ~296 ms/teks (CPU), RAM ~1,2 GB.
 *
 * ENV:
 *   `BGE_M3_SERVICE_URL`  (default `http://localhost:11434` untuk Ollama)
 *   `BGE_M3_MODEL`        (default `bge-m3`)
 *
 * **Validasi ketat**: dimensi HARUS 1024 (sesuai skema `vector(1024)`).
 * Bila tidak → tolak (jangan simpan vektor salah dimensi).
 */
export const EMBEDDING_DIM = 1024;

export interface EmbedResult {
  ok: boolean;
  vectors?: number[][];
  error?: string;
}

interface EmbedOptions {
  timeoutMs?: number;
  /** Override endpoint (untuk pengujian). */
  baseUrl?: string;
  model?: string;
  signal?: AbortSignal;
}

/** Base URL Ollama. */
export function embeddingBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.BGE_M3_SERVICE_URL?.trim() || "http://localhost:11434").replace(/\/+$/, "");
}

/** Nama model embedding. */
export function embeddingModel(env: Record<string, string | undefined> = process.env): string {
  return env.BGE_M3_MODEL?.trim() || "bge-m3";
}

/** Apakah service embedding dikonfigurasi? */
export function isEmbeddingConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(embeddingBaseUrl(env));
}

/**
 * Embed banyak teks → array vektor 1024-dim.
 * Tak melempar; kembalikan `{ok:false,error}`.
 */
export async function embedTexts(texts: string[], opts: EmbedOptions = {}): Promise<EmbedResult> {
  if (texts.length === 0) return { ok: true, vectors: [] };
  const base = (opts.baseUrl ?? embeddingBaseUrl()).replace(/\/+$/, "");
  const model = opts.model ?? embeddingModel();
  const timeoutMs = opts.timeoutMs ?? 120000;

  const ctrl = new AbortController();
  if (opts.signal) opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: texts }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}${t ? `: ${t.slice(0, 160)}` : ""}` };
    }
    const data = (await res.json()) as { embeddings?: number[][] };
    const vectors = data.embeddings;
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      return { ok: false, error: "Balasan embedding tak sesuai jumlah input." };
    }
    for (const v of vectors) {
      if (!Array.isArray(v) || v.length !== EMBEDDING_DIM) {
        return { ok: false, error: `Dimensi embedding ${Array.isArray(v) ? v.length : "?"} ≠ ${EMBEDDING_DIM}.` };
      }
    }
    return { ok: true, vectors };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg === "The operation was aborted." ? "timeout" : msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Embed satu teks → satu vektor. */
export async function embedText(text: string, opts: EmbedOptions = {}): Promise<{ ok: boolean; vector?: number[]; error?: string }> {
  const r = await embedTexts([text], opts);
  if (!r.ok || !r.vectors) return { ok: false, error: r.error };
  return { ok: true, vector: r.vectors[0] };
}

/** Cek service embedding hidup (murah: embed 1 kata). */
export async function embeddingHealth(opts: EmbedOptions = {}): Promise<{ ok: boolean; error?: string }> {
  const r = await embedText("ping", { timeoutMs: 30000, ...opts });
  return { ok: r.ok, error: r.error };
}
