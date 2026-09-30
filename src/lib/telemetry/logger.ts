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
 * Sapu nilai sensitif secara rekursif → `"[REDACTED]"`.
 * Nilai primitif dibiarkan; Error → `{name,message,stack?}`.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[…]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(process.env.NODE_ENV !== "production" && value.stack
        ? { stack: value.stack }
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
