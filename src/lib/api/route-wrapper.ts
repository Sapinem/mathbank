import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { resolveActor } from "@/lib/auth/resolve";
import { InvalidTransitionError, NotReadyError } from "@/lib/fsm/question-fsm";
import {
  UnauthorizedError,
  ForbiddenError,
  PasswordChangeRequiredError,
  InvalidJsonError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  UnsupportedMediaTypeError,
  PayloadTooLargeError,
  assertCan,
} from "@/lib/auth/guards";
import {
  checkRateLimit,
  rateLimitKey,
  RateLimitError,
  DEFAULT_POLICY,
  type RateLimitPolicy,
} from "./rate-limit";
import {
  checkIdempotency,
  rememberResponse,
  getIdempotencyStore,
} from "./idempotency";
import type { ActorFor, Authz } from "./authz";
import { log } from "@/lib/telemetry/logger";
import { recordRequest, normalizeRoutePath } from "@/lib/telemetry/metrics";
import { getClientIp } from "./client-ip";

/**
 * Pembungkus route (L4) — menghapus boilerplate yang di QBank ditulis
 * ulang di 39/52 route: resolve aktor → 401 → cek izin → parse →
 * try/catch → ZodError → format respons.
 *
 * Format respons TUNGGAL:
 *   sukses → { data: T }
 *   error  → { error: { code, message } }
 */

export interface RouteContext<TQuery, TBody, TParams = Record<string, string>, TAuthz extends Authz = Authz> {
  actor: ActorFor<TAuthz>;
  query: TQuery;
  body: TBody;
  req: Request;
  /** Parameter rute dinamis, mis. { id } untuk /api/questions/[id]. */
  params: TParams;
}

export interface RouteOptions<TQuery, TBody, TResult, TParams = Record<string, string>, TAuthz extends Authz = Authz> {
  /**
   * **Wajib.** Deklarasi otorisasi: publik / login saja / gerbang route /
   * ditegakkan di service. Lihat `./authz.ts` untuk alasan & aturannya.
   */
  authz: TAuthz;
  /** Skema query string (Zod). */
  query?: ZodType<TQuery>;
  /** Skema body JSON (Zod). */
  body?: ZodType<TBody>;
  /** Skema parameter rute URL dinamis (Zod), mis. { id: z.string().uuid() }. */
  params?: ZodType<TParams>;
  /** Handler inti. */
  handler: (ctx: RouteContext<TQuery, TBody, TParams, TAuthz>) => Promise<TResult>;
  /** Status sukses (default 200). */
  status?: number;
  /**
   * Aktifkan rate limiting untuk route ini.
   * `true` = kebijakan default; atau objek kebijakan khusus.
   * Di-key per aktor (id) atau per IP bila tak terautentikasi.
   */
  rateLimit?: boolean | RateLimitPolicy;
  /** Nama scope (default: izin gerbang route, atau `authz.kind`). */
  rateLimitScope?: string;
  /**
   * Izinkan akses meski `mustChangePassword=true` (mis. `GET /api/auth/me`,
   * agar UI bisa membaca status & mengarahkan ke halaman ganti password).
   * Default: false → diblokir 403 PASSWORD_CHANGE_REQUIRED.
   */
  allowPasswordChangePending?: boolean;
  /**
   * **#4 (enterprise):** aktifkan proteksi idempotensi via header
   * `Idempotency-Key` untuk endpoint mutasi. Bila diaktifkan & klien mengirim
   * key, permintaan ulang dgn key sama → di-replay dari cache (anti double-submit).
   */
  idempotent?: boolean;
}

/** Bangun objek dari URLSearchParams → plain object untuk Zod. */
function searchParamsToObject(url: string): Record<string, string | string[]> {
  const params = new URLSearchParams(new URL(url).searchParams);
  const obj: Record<string, string | string[]> = {};
  params.forEach((value, key) => {
    const existing = obj[key];
    if (existing === undefined) {
      obj[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      obj[key] = [existing, value];
    }
  });
  return obj;
}

/** Argumen kedua handler Next.js (params rute dinamis, async di Next 15+). */
type NextRouteArgs = { params?: Promise<Record<string, string>> } | undefined;

/**
 * Sidik jari request untuk idempotensi: method + path (termasuk query) + body
 * **mentah**. Memakai body mentah (bukan hasil parse) agar dua payload yang
 * berbeda tetapi menghasilkan objek sama tetap dianggap berbeda.
 */
function requestFingerprint(req: Request, rawBody: string): string {
  const url = new URL(req.url);
  return createHash("sha256")
    .update(`${req.method}\n${url.pathname}${url.search}\n${rawBody}`)
    .digest("hex");
}

/** Ambil kode error stabil (bila ada) untuk field log. */
function extractCode(err: unknown): string {
  if (err instanceof ZodError) return "VALIDATION_ERROR";
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; name?: unknown };
    if (typeof e.code === "string") return e.code;
    if (typeof e.name === "string" && e.name.endsWith("Error")) {
      // camelCase → CONSTANT_CASE (mis. InvalidTransitionError → INVALID_TRANSITION)
      return e.name
        .replace(/Error$/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .toUpperCase();
    }
  }
  return "INTERNAL_ERROR";
}

/** Petakan error → respons terformat. `requestId` disertakan pada log 500. */
function errorResponse(
  err: unknown,
  requestId: string,
  ctx: { route?: string; method?: string; actorId?: string } = {},
): NextResponse {
  const withRid = (res: NextResponse) => {
    res.headers.set("X-Request-ID", requestId);
    // Semua respons galat → log terstruktur (level sesuai kelas status).
    const status = res.status;
    log[status >= 500 ? "error" : "warn"]({
      msg: "permintaan gagal",
      requestId,
      route: ctx.route,
      method: ctx.method,
      actorId: ctx.actorId,
      status,
      code: extractCode(err),
      err,
    });
    return res;
  };

  const jsonError = (
    status: number,
    code: string,
    message: string,
    headers?: HeadersInit,
  ) => withRid(NextResponse.json({ error: { code, message } }, { status, headers }));

  if (err instanceof UnauthorizedError) {
    return jsonError(401, err.code, err.message);
  }
  if (err instanceof PasswordChangeRequiredError) {
    return jsonError(403, err.code, err.message);
  }
  if (err instanceof ForbiddenError) {
    return jsonError(403, err.code, err.message);
  }
  // API-04: semantik HTTP yang benar untuk muatan tak valid / tak didukung / terlalu besar.
  if (err instanceof BadRequestError) {
    return jsonError(400, err.code, err.message);
  }
  if (err instanceof PayloadTooLargeError) {
    return jsonError(413, err.code, err.message);
  }
  if (err instanceof UnsupportedMediaTypeError) {
    return jsonError(415, err.code, err.message);
  }
  if (err instanceof NotFoundError) {
    return jsonError(404, err.code, err.message);
  }
  if (err instanceof ConflictError) {
    return jsonError(409, err.code, err.message);
  }
  if (err instanceof InvalidTransitionError) {
    return jsonError(409, "INVALID_TRANSITION", err.message);
  }
  if (err instanceof NotReadyError) {
    return jsonError(422, err.code, err.message);
  }
  if (err instanceof RateLimitError) {
    const retryAfterSec = Math.ceil(err.retryAfterMs / 1000);
    return jsonError(429, err.code, err.message, { "Retry-After": String(retryAfterSec) });
  }
  if (err instanceof InvalidJsonError) {
    return jsonError(400, err.code, err.message);
  }
  if (err instanceof ZodError) {
    const isCustom = err.name !== "ZodError" && err.message && !err.message.startsWith("[");
    return withRid(
      NextResponse.json(
        {
          error: {
            code: (err as { code?: string }).code ?? "VALIDATION_ERROR",
            message: isCustom ? err.message : "Data tidak valid",
            details: err.issues,
          },
        },
        {
          status: (err as { httpStatus?: number }).httpStatus ?? 400,
        },
      ),
    );
  }
  if (
    err &&
    typeof err === "object" &&
    "httpStatus" in err &&
    typeof (err as { httpStatus: unknown }).httpStatus === "number"
  ) {
    const e = err as {
      httpStatus: number;
      code?: string;
      message?: string;
      details?: unknown;
    };
    return withRid(
      NextResponse.json(
        {
          error: {
            code: e.code ?? "ERROR",
            message: e.message ?? "Terjadi kesalahan",
            ...(e.details !== undefined ? { details: e.details } : {}),
          },
        },
        { status: e.httpStatus },
      ),
    );
  }
  // Galat tak terduga (500) — detail sudah di-log terstruktur oleh errorResponse.
  return withRid(
    NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Kesalahan server" } },
      { status: 500 },
    ),
  );
}

/**
 * Jalankan handler dengan seluruh boilerplate otomatis.
 * Pemakaian:
 *   export const GET = wrapRoute({ query: listQuery, handler: async ({query, actor}) => ... });
 */
export function wrapRoute<TQuery, TBody, TResult, TParams = Record<string, string>, TAuthz extends Authz = Authz>(
  opts: RouteOptions<TQuery, TBody, TResult, TParams, TAuthz>,
) {
  return async (req: Request, args?: NextRouteArgs): Promise<NextResponse> => {
    // **#6 (enterprise):** ID permintaan untuk traceability. Pakai header dari
    // proxy bila ada (agar korelasi dgn log eksternal), jika tidak buat baru.
    const requestId =
      req.headers.get("x-request-id")?.slice(0, 64) || crypto.randomUUID();
    // M16: label route utk metrik (path tanpa query) + waktu mulai.
    // **ACT-03 A:** normalisasi segmen dinamis → `:id` SEBELUM dipakai sebagai
    // label, supaya 100 request `/api/questions/<uuid>` hanya menghasilkan satu
    // key metrik (dan log) alih-alih 100 label yang membanjiri store.
    const routePath = normalizeRoutePath(new URL(req.url).pathname);
    const method = req.method;
    const startedAt = Date.now();
    let actorIdForCleanup: string | null = null;
    // Catat hasil akhir (sukses/error) ke metrik — satu tempat, apa pun jalannya.
    const finish = (res: NextResponse): NextResponse => {
      // Respons API bergantung pada identitas pemanggil (answer_key, draf,
      // kepemilikan). Tanpa `no-store`, CDN/proxy di depan bisa menyajikan
      // payload satu pengguna ke pengguna lain. `Vary` menutup cache yang
      // tetap mengabaikan Cache-Control.
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("Vary", "Cookie, Authorization");
      try {
        recordRequest(method, routePath, res.status, Date.now() - startedAt);
      } catch {
        // metrik tak boleh menjatuhkan permintaan
      }
      return res;
    };
    try {
      const actor = await resolveActor(req.headers);
      actorIdForCleanup = actor?.id ?? null;
      // Otorisasi eksplisit: publik / login saja / gerbang route / service.
      const { authz } = opts;
      if (authz.kind !== "public" && !actor) throw new UnauthorizedError();
      if (actor && actor.mustChangePassword && !opts.allowPasswordChangePending) {
        throw new PasswordChangeRequiredError();
      }
      const routeGate =
        authz.kind === "route"
          ? authz.permission
          : authz.kind === "service"
            ? authz.routeGate
            : undefined;
      if (routeGate) {
        if (!actor) throw new UnauthorizedError();
        assertCan(actor, routeGate);
      }

      // Rate limit (bila diaktifkan) — di-key per aktor, fallback IP.
      if (opts.rateLimit) {
        const policy =
          opts.rateLimit === true ? DEFAULT_POLICY : opts.rateLimit;
        const key = rateLimitKey(
          actor?.id ?? null,
          getClientIp(req),
          opts.rateLimitScope ?? routeGate ?? authz.kind,
        );
        const result = checkRateLimit(key, policy);
        if (!result.allowed) throw new RateLimitError(result.retryAfterMs);
      }

      const query = opts.query
        ? opts.query.parse(searchParamsToObject(req.url))
        : (undefined as TQuery);

      // Body dibaca SEKALI: dipakai validasi Zod dan sidik jari idempotensi.
      const rawBody = opts.body ? await req.text() : "";
      const body = opts.body
        ? opts.body.parse(parseJsonText(rawBody))
        : (undefined as TBody);

      const rawParams = (await args?.params) ?? {};
      const params = opts.params
        ? opts.params.parse(rawParams)
        : (rawParams as TParams);

      // **#4:** idempotensi (opsional) — hanya bila diaktifkan & klien kirim key.
      const idemKey = opts.idempotent
        ? req.headers.get("idempotency-key")?.slice(0, 128)
        : null;
      const fingerprint = idemKey ? requestFingerprint(req, rawBody) : "";
      if (idemKey) {
        const actorKey = actor?.id ?? getClientIp(req) ?? "anon";
        const state = checkIdempotency(`${actorKey}:${idemKey}`, fingerprint);
        if (state.kind === "replay") {
          const replay = NextResponse.json(state.body, { status: state.status });
          replay.headers.set("X-Request-ID", requestId);
          replay.headers.set("Idempotent-Replay", "true");
          return finish(replay);
        }
        if (state.kind === "in-flight") {
          const busy = NextResponse.json(
            {
              error: {
                code: "IDEMPOTENCY_IN_PROGRESS",
                message: "Permintaan dengan key ini sedang diproses.",
              },
            },
            { status: 409 },
          );
          busy.headers.set("X-Request-ID", requestId);
          return finish(busy);
        }
        if (state.kind === "mismatch") {
          // Key dipakai ulang untuk payload lain. Me-replay di sini akan
          // mengembalikan resource yang SALAH secara diam-diam — tolak eksplisit.
          const reuse = NextResponse.json(
            {
              error: {
                code: "IDEMPOTENCY_KEY_REUSED",
                message:
                  "Idempotency-Key sudah dipakai untuk permintaan lain. Gunakan key baru.",
              },
            },
            { status: 422 },
          );
          reuse.headers.set("X-Request-ID", requestId);
          return finish(reuse);
        }
      }

      const data = await opts.handler({
        actor: actor as ActorFor<TAuthz>,
        query,
        body,
        req,
        params,
      });
      const res = NextResponse.json({ data }, { status: opts.status ?? 200 });
      res.headers.set("X-Request-ID", requestId);
      if (idemKey) {
        const actorKey = actor?.id ?? getClientIp(req) ?? "anon";
        rememberResponse(
          `${actorKey}:${idemKey}`,
          opts.status ?? 200,
          { data },
          fingerprint,
        );
        res.headers.set("Idempotency-Key", idemKey);
      }
      return finish(res);
    } catch (err) {
      // **#4:** bila gagal, buang penanda in-flight agar percobaan berikutnya
      // (key sama) tidak terjebak 409 — kesalahan bukan hasil yang di-cache.
      if (opts.idempotent) {
        const k = req.headers.get("idempotency-key")?.slice(0, 128);
        const actorKey = actorIdForCleanup ?? getClientIp(req) ?? "anon";
        if (k) getIdempotencyStore().forget(`${actorKey}:${k}`);
      }
      return finish(
        errorResponse(err, requestId, {
          route: routePath,
          method,
          actorId: actorIdForCleanup ?? undefined,
        }),
      );
    }
  };
}

/** Respons sukses manual (bila tak lewat wrapRoute). */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

/**
 * Baca body JSON; **D9**: bila rusak/kosong pada body wajib, lempar
 * `InvalidJsonError` (400 `INVALID_JSON`) — BUKAN diam-diam `{}` yang lalu
 * memicu pesan Zod menyesatkan ("Data tidak valid").
 */
function parseJsonText(raw: string): unknown {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidJsonError();
  }
}
