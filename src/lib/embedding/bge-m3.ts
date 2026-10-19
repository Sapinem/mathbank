/**
 * Embedding BGE-M3 (M10-c) — klien HTTP OpenAI-compatible (`POST /v1/embeddings`).
 *
 * **Keputusan (MAT-115, 2026-10-19):** sumber kebenaran service embedding adalah
 * **FastAPI BGE-M3** di `http://127.0.0.1:3005` (dimensi **1024**, endpoint
 * `/v1/embeddings` + `/health`). Default ENV diarahkan ke sana.
 *
 * Transport memakai kontrak OpenAI (`{ model, input } → { data: [{ embedding }] }`)
 * karena kontrak itu juga yang dipakai Ollama (`/v1/embeddings`), sehingga
 * penggantian backend tak menuntut perubahan kode. Balasan gaya lama
 * (`{ embeddings: [[…]] }`, Ollama `/api/embed`) tetap diterima agar rollout
 * tidak memutus pemanggil lama.
 *
 * ENV:
 *   `BGE_M3_SERVICE_URL`  (default `http://127.0.0.1:3005`)
 *   `BGE_M3_MODEL`        (default `bge-m3`)
 *   `BGE_M3_TIMEOUT_MS`   (default `120000` — cold start model CPU bisa ~60 dtk)
 *
 * **Validasi ketat**: dimensi HARUS 1024 (sesuai skema `vector(1024)`).
 * Bila tidak → tolak (jangan simpan vektor salah dimensi).
 */
export const EMBEDDING_DIM = 1024;

/** Default service embedding aktif (FastAPI BGE-M3, MAT-115). */
export const DEFAULT_EMBEDDING_URL = "http://127.0.0.1:3005";

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

/** Base URL service embedding (tanpa garis miring ujung). */
export function embeddingBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.BGE_M3_SERVICE_URL?.trim() || DEFAULT_EMBEDDING_URL).replace(/\/+$/, "");
}

/** Nama model embedding. */
export function embeddingModel(env: Record<string, string | undefined> = process.env): string {
  return env.BGE_M3_MODEL?.trim() || "bge-m3";
}

/** Batas waktu default panggilan embed (ms). */
export function embeddingTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt(env.BGE_M3_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 120000;
}

/** Apakah service embedding dikonfigurasi? */
export function isEmbeddingConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(embeddingBaseUrl(env));
}

/**
 * URL endpoint embedding. Menerima base polos (`http://host:port`), base ber-`/v1`,
 * atau URL penuh (`…/v1/embeddings`).
 */
export function embeddingEndpoint(baseUrl: string = embeddingBaseUrl()): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (/\/v1\/embeddings$/.test(base)) return base;
  if (/\/v1$/.test(base)) return `${base}/embeddings`;
  return `${base}/v1/embeddings`;
}

/** Ambil array vektor dari balasan OpenAI (`data[].embedding`) atau gaya lama (`embeddings[][]`). */
function extractVectors(data: unknown): number[][] | undefined {
  if (!data || typeof data !== "object") return undefined;
  const body = data as { data?: unknown; embeddings?: unknown };
  if (Array.isArray(body.data)) {
    const vectors = body.data.map((item) =>
      item && typeof item === "object" ? (item as { embedding?: unknown }).embedding : undefined,
    );
    return vectors.every((v) => Array.isArray(v)) ? (vectors as number[][]) : undefined;
  }
  if (Array.isArray(body.embeddings)) return body.embeddings as number[][];
  return undefined;
}

/**
 * Embed banyak teks → array vektor 1024-dim.
 * Tak melempar; kembalikan `{ok:false,error}`.
 */
export async function embedTexts(texts: string[], opts: EmbedOptions = {}): Promise<EmbedResult> {
  if (texts.length === 0) return { ok: true, vectors: [] };
  const base = (opts.baseUrl ?? embeddingBaseUrl()).replace(/\/+$/, "");
  const url = embeddingEndpoint(base);
  const model = opts.model ?? embeddingModel();
  const timeoutMs = opts.timeoutMs ?? embeddingTimeoutMs();

  const ctrl = new AbortController();
  if (opts.signal) opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: texts }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}${t ? `: ${t.slice(0, 160)}` : ""}` };
    }
    const vectors = extractVectors(await res.json());
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      return { ok: false, error: "Balasan embedding tak sesuai jumlah input." };
    }
    // `extractVectors` sudah menjamin tiap elemen berupa array angka.
    for (const v of vectors) {
      if (v.length !== EMBEDDING_DIM) {
        return { ok: false, error: `Dimensi embedding ${v.length} ≠ ${EMBEDDING_DIM}.` };
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

/**
 * Cek service embedding hidup.
 *
 * Prioritas `GET {base}/health` (murah, tak memuat model). Bila service tak punya
 * endpoint itu (404/405/501), jatuh ke probe fungsional: embed 1 kata.
 */
export async function embeddingHealth(
  opts: EmbedOptions = {},
): Promise<{ ok: boolean; error?: string; detail?: unknown }> {
  const base = (opts.baseUrl ?? embeddingBaseUrl()).replace(/\/+$/, "");
  const ctrl = new AbortController();
  if (opts.signal) opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    if (res.ok) {
      const detail = await res.json().catch(() => undefined);
      const dim = (detail as { dim?: unknown } | undefined)?.dim;
      if (typeof dim === "number" && dim !== EMBEDDING_DIM) {
        return { ok: false, error: `Dimensi service ${dim} ≠ ${EMBEDDING_DIM}.`, detail };
      }
      return { ok: true, detail };
    }
    // Service tanpa /health → probe fungsional di bawah.
    if (![404, 405, 501].includes(res.status)) return { ok: false, error: `HTTP ${res.status}` };
  } catch {
    // Jaringan mati / timeout → probe fungsional masih bisa menentukan status.
  } finally {
    clearTimeout(timer);
  }
  const r = await embedText("ping", { timeoutMs: 30000, ...opts });
  return { ok: r.ok, error: r.error };
}
