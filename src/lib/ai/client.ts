/**
 * Gerbang LLM tunggal (M10-a) — **satu-satunya** tempat MathBank memanggil LLM.
 *
 * Prinsip L9 (terkunci): provider = **konfigurasi** (`app_settings`), BUKAN hard-code.
 * Endpoint diasumsikan **OpenAI-compatible** (`POST {base_url}/chat/completions`,
 * `GET {base_url}/models`). 9router / OpenAI / Ollama-openai / apa pun yang cocok.
 *
 * **Aturan:** file ini tak menyentuh DB langsung — pengaturan dibaca lewat
 * `ai-config.ts` (yang memakai `settings-service`). Memudahkan pengujian (mock fetch).
 */
import type { AiConfig } from "./config";

/** Hasil panggilan yang selalu eksplisit (tak melempar untuk error yang wajar). */
export interface ChatResult {
  ok: boolean;
  content?: string;
  error?: string;
  /** Statistik pemakaian bila dikirim provider. */
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export interface ChatOptions {
  /** Petunjuk sistem (opsional). */
  system?: string;
  /** Minta keluaran JSON (response_format json_object bila didukung). */
  json?: boolean;
  /** Override suhu (default 0.2 — tugas klasifikasi butuh stabil). */
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/** Normalisasi base_url → tanpa garis miring di ujung. */
function apiBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function authHeaders(cfg: AiConfig): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey}`;
  return h;
}

/** Panggil LLM (chat completion). Tak melempar — kembalikan `{ok:false,error}`. */
export async function chat(
  cfg: AiConfig,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts: ChatOptions = {},
): Promise<ChatResult> {
  if (!cfg.enabled) return { ok: false, error: "AI dinonaktifkan di Pengaturan." };
  if (!cfg.baseUrl) return { ok: false, error: "ai.base_url belum diatur." };
  if (!cfg.model) return { ok: false, error: "ai.model belum dipilih." };

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? cfg.maxTokens,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const ctrl = new AbortController();
  const external = opts.signal;
  if (external) external.addEventListener("abort", () => ctrl.abort(), { once: true });
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(`${apiBase(cfg.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false, error: "Balasan tanpa konten." };
    return {
      ok: true,
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg === "The operation was aborted." ? "timeout" : msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Panggil LLM lalu parse balasan sebagai JSON.
 * Toleran: membuang pagar ```json … ``` bila model menambahkannya.
 */
export async function chatJson<T = unknown>(
  cfg: AiConfig,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts: ChatOptions = {},
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const r = await chat(cfg, messages, { ...opts, json: true });
  if (!r.ok || r.content === undefined) return { ok: false, error: r.error };
  const parsed = parseJsonLoose<T>(r.content);
  if (parsed === undefined) return { ok: false, error: "Balasan bukan JSON valid." };
  return { ok: true, data: parsed };
}

/** Parse JSON toleran (buang pagar kode, ambil objek pertama). */
export function parseJsonLoose<T = unknown>(raw: string): T | undefined {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Coba ambil blok { … } pertama.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

/**
 * Cek konektivitas + ambil daftar model (untuk UI: pilih model dari yang tersedia).
 * `GET {base_url}/models` → `{data:[{id,...}]}` (OpenAI-compatible).
 */
export async function listModels(cfg: AiConfig): Promise<{ ok: boolean; models: string[]; error?: string }> {
  if (!cfg.baseUrl) return { ok: false, models: [], error: "ai.base_url belum diatur." };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${apiBase(cfg.baseUrl)}/models`, {
      method: "GET",
      headers: authHeaders(cfg),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const data = (await res.json()) as { data?: Array<{ id?: string }>; models?: Array<{ name?: string }> };
    const ids = (data.data ?? []).map((m) => m.id).filter((x): x is string => Boolean(x));
    // Ollama-native mengembalikan `models[].name`; dukung juga.
    const alt = (data.models ?? []).map((m) => m.name).filter((x): x is string => Boolean(x));
    const models = [...new Set([...ids, ...alt])].sort();
    return { ok: true, models };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, models: [], error: msg === "The operation was aborted." ? "timeout" : msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Cek LLM hidup: coba `listModels` (murah, tak menghabiskan token). */
export async function health(cfg: AiConfig): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.enabled) return { ok: false, error: "AI dinonaktifkan." };
  const r = await listModels(cfg);
  return { ok: r.ok, error: r.error };
}
