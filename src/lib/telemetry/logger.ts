/**
 * Logger terstruktur (M16) — satu baris JSON per kejadian.
 *
 * Tanpa dependency: memakai `process.stdout/stderr` langsung (di produksi
 * dikumpulkan oleh journald/Docker). Setiap baris punya field konsisten agar
 * mudah di-query (`jq`, Loki, dsb):
 *
 *   {"level":"error","time":"…","msg":"…","route":"/api/questions","requestId":"…"}
 *
 * **Aturan rahasia:** jangan pernah log `BETTER_AUTH_SECRET`, password, API key,
 * isi `answer_key`, atau token. `redact()` menyapu field bernama sensitif.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Ambang minimum; diatur via env `LOG_LEVEL` (default `info`). */
function minLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return (["debug", "info", "warn", "error"] as const).includes(raw as LogLevel)
    ? (raw as LogLevel)
    : "info";
}

/** Nama field yang isinya tak boleh tampil apa adanya. */
const SENSITIVE_KEYS = [
  "password",
  "pass",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "answerkey",
  "answer_key",
  "correctanswer",
  "correct",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_]/g, "");
  return SENSITIVE_KEYS.some((s) => k.includes(s.replace(/[-_]/g, "")));
}

/**
 * **ACT-02 (P0):** scrubber pola untuk nilai yang LOLOS dari redaksi berbasis
 * nama field — mis. `Error.message` hasil `throw new Error(\`gagal: ${url}\`)`,
 * di mana URL membawa `?token=…` atau `postgres://user:pass@host/db`.
 *
 * Redaksi berbasis nama field saja TIDAK cukup: pesan error & stack adalah
 * string bebas, dan di situlah kredensial paling sering bocor ke log.
 * Semua pola diganti penanda tetap agar tak ada byte rahasia yang tersisa.
 */
const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Header otorisasi: "Bearer eyJ…", "Basic dXNlcjpwYXNz", "Token abc…"
  [/\b(Bearer|Basic|Token|Digest)\s+[A-Za-z0-9\-._~+/=]{6,}/gi, "$1 [REDACTED]"],
  // Kredensial di dalam URL koneksi: postgres://user:pass@host:5432/db
  [/\b([a-z][a-z0-9+.-]*:\/\/)([^\s:@/]+):([^\s@/]+)@/gi, "$1$2:[REDACTED]@"],
  // Pasangan kunci=nilai pada query string / pesan bebas: ?token=…, password: "…"
  [
    /\b(password|passwd|pwd|secret|client[_-]?secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|apikey|authorization|cookie|session[_-]?id|signature|sig)\b\s*[=:]\s*("[^"]*"|'[^']*'|[^\s&,;)\]}"']+)/gi,
    "$1=[REDACTED]",
  ],
  // JWT (header.payload.signature base64url)
  [/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\b/g, "[REDACTED_JWT]"],
  // Kunci penyedia (Stripe/OpenAI dsb.)
  [/\b(sk|pk|rk)[-_](live|test)[-_][A-Za-z0-9]{8,}\b/g, "[REDACTED_KEY]"],
];

/** Sapu pola rahasia dari sebuah string bebas (pesan error, stack, URL). */
export function scrubString(input: string): string {
  let out = input;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Deteksi ZodError tanpa mengimpor zod (logger tetap ringan & bebas siklus). */
function zodIssuesOf(value: object): Array<Record<string, unknown>> | null {
  const issues = (value as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return null;
  return issues as Array<Record<string, unknown>>;
}

/**
 * Sapu nilai sensitif secara rekursif → `"[REDACTED]"`.
 * Nilai primitif dibiarkan; Error → `{name,message,stack?}` yang **di-scrub**;
 * ZodError → `{name,message,issues}` tanpa `input` mentah (payload pengguna).
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[…]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    const issues = zodIssuesOf(value);
    if (issues) {
      return {
        name: value.name,
        message: scrubString(value.message),
        // `path` + `code` cukup untuk debug; `input`/`received` dibuang karena
        // bisa memuat password atau isi soal yang belum dipublikasikan.
        issues: issues.map((issue) => ({
          path: Array.isArray(issue.path) ? issue.path : [],
          code: typeof issue.code === "string" ? issue.code : "invalid",
          message: typeof issue.message === "string" ? scrubString(issue.message) : "",
        })),
      };
    }
    return {
      name: value.name,
      message: scrubString(value.message),
      ...(process.env.NODE_ENV !== "production" && value.stack
        ? { stack: scrubString(value.stack) }
        : {}),
    };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  // String bebas (mis. `msg` hasil interpolasi) tetap disapu pola rahasia.
  if (typeof value === "string") return scrubString(value);
  return value;
}

export interface LogContext {
  msg: string;
  requestId?: string;
  route?: string;
  method?: string;
  actorId?: string;
  code?: string;
  durationMs?: number;
  status?: number;
  [key: string]: unknown;
}

/** Bangun objek log final (sudah diredaksi + disaring level). */
export function buildEntry(
  level: LogLevel,
  ctx: LogContext,
): Record<string, unknown> {
  const { msg, ...rest } = ctx;
  return {
    level,
    time: new Date().toISOString(),
    msg,
    ...(redact(rest) as Record<string, unknown>),
  };
}

function emit(level: LogLevel, ctx: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;
  // Saat tes, jangan cemari stdout — kecuali LOG_LEVEL dipaksa eksplisit.
  if (process.env.NODE_ENV === "test" && !process.env.LOG_LEVEL) return;
  const line = JSON.stringify(buildEntry(level, ctx));
  // warn/error → stderr (mudah difilter), sisanya stdout.
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

/** Logger — panggil `log.info({ msg, ... })`. */
export const log = {
  debug: (ctx: LogContext) => emit("debug", ctx),
  info: (ctx: LogContext) => emit("info", ctx),
  warn: (ctx: LogContext) => emit("warn", ctx),
  error: (ctx: LogContext) => emit("error", ctx),
};
