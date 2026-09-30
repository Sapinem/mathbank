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
import type { Actor } from "@/lib/auth/actor";
import type { Permission } from "@/lib/auth/permissions";

/**
 * Pembungkus route (L4) — menghapus boilerplate yang di QBank ditulis
 * ulang di 39/52 route: resolve aktor → 401 → cek izin → parse →
 * try/catch → ZodError → format respons.
 *
 * Format respons TUNGGAL:
 *   sukses → { data: T }
 *   error  → { error: { code, message } }
 */

export interface RouteContext<TQuery, TBody> {
  actor: Actor;
  query: TQuery;
  body: TBody;
  req: Request;
  /** Parameter rute dinamis, mis. { id } untuk /api/questions/[id]. */
  params: Record<string, string>;
}

export interface RouteOptions<TQuery, TBody, TResult> {
  /** Izin yang dibutuhkan (dari matriks L1). */
  permission?: Permission;
  /** Skema query string (Zod). */
  query?: ZodType<TQuery>;
  /** Skema body JSON (Zod). */
  body?: ZodType<TBody>;
  /** Handler inti. */
  handler: (ctx: RouteContext<TQuery, TBody>) => Promise<TResult>;
  /** Status sukses (default 200). */
  status?: number;
  /**
   * Aktifkan rate limiting untuk route ini.
   * `true` = kebijakan default; atau objek kebijakan khusus.
   * Di-key per aktor (id) atau per IP bila tak terautentikasi.
   */
  rateLimit?: boolean | RateLimitPolicy;
  /** Nama scope (default: dari permission). */
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

/** Ambil IP klien dari header proxy (X-Forwarded-For) atau fallback. */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

/** Bangun objek dari URLSearchParams → plain object untuk Zod. */
function searchParamsToObject(url: string): Record<string, string> {
  const params = new URLSearchParams(new URL(url).searchParams);
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

/** Argumen kedua handler Next.js (params rute dinamis, async di Next 15+). */
type NextRouteArgs = { params?: Promise<Record<string, string>> } | undefined;

/** Petakan error → respons terformat. `requestId` disertakan pada log 500. */
function errorResponse(err: unknown, requestId: string): NextResponse {
  const withRid = (res: NextResponse) => {
    res.headers.set("X-Request-ID", requestId);
    return res;
  };
  if (err instanceof UnauthorizedError) {
    return withRid(
      NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 401 },
      ),
    );
  }
  if (err instanceof PasswordChangeRequiredError) {
    return withRid(
      NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 403 },
      ),
    );
  }
  if (err instanceof ForbiddenError) {
    return withRid(
      NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 403 },
      ),
    );
  }
  if (err instanceof NotFoundError) {
    return withRid(
      NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 404 },
      ),
    );
  }
  if (err instanceof ConflictError) {
    return withRid(
      NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 409 },
      ),
    );
  }
  if (err instanceof InvalidTransitionError) {
    return withRid(
      NextResponse.json(
        { error: { code: "INVALID_TRANSITION", message: err.message } },
        { status: 409 },
      ),
    );
  }
  if (err instanceof NotReadyError) {
    return withRid(
      NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 422 },
      ),
    );
  }
  if (err instanceof RateLimitError) {
    const retryAfterSec = Math.ceil(err.retryAfterMs / 1000);
    return withRid(
      NextResponse.json(
        { error: { code: err.code, message: err.message } },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        },
      ),
    );
  }
  if (err instanceof InvalidJsonError) {
    return withRid(
      NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 400 },
      ),
    );
  }
  if (err instanceof ZodError) {
    return withRid(
      NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Data tidak valid",
            details: err.issues,
          },
        },
        { status: 400 },
      ),
    );
  }
  console.error(`[API] error tak terduga (rid=${requestId}):`, err);
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
export function wrapRoute<TQuery, TBody, TResult>(
  opts: RouteOptions<TQuery, TBody, TResult>,
) {
  return async (req: Request, args?: NextRouteArgs): Promise<NextResponse> => {
    // **#6 (enterprise):** ID permintaan untuk traceability. Pakai header dari
    // proxy bila ada (agar korelasi dgn log eksternal), jika tidak buat baru.
    const requestId =
      req.headers.get("x-request-id")?.slice(0, 64) || crypto.randomUUID();
    let actorIdForCleanup: string | null = null;
    try {
      const actor = await resolveActor(req.headers);
      actorIdForCleanup = actor?.id ?? null;
      if (!actor) throw new UnauthorizedError();
      if (actor.mustChangePassword && !opts.allowPasswordChangePending) {
        throw new PasswordChangeRequiredError();
      }
      if (opts.permission) assertCan(actor, opts.permission);

      // Rate limit (bila diaktifkan) — di-key per aktor, fallback IP.
      if (opts.rateLimit) {
        const policy =
          opts.rateLimit === true ? DEFAULT_POLICY : opts.rateLimit;
        const key = rateLimitKey(
          actor.id,
          clientIp(req),
          opts.rateLimitScope ?? opts.permission ?? "default",
        );
        const result = checkRateLimit(key, policy);
        if (!result.allowed) throw new RateLimitError(result.retryAfterMs);
      }

      const query = opts.query
        ? opts.query.parse(searchParamsToObject(req.url))
        : (undefined as TQuery);

      const body = opts.body
        ? opts.body.parse(await parseJsonBody(req))
        : (undefined as TBody);

      const params = (await args?.params) ?? {};

      // **#4:** idempotensi (opsional) — hanya bila diaktifkan & klien kirim key.
      const idemKey = opts.idempotent
        ? req.headers.get("idempotency-key")?.slice(0, 128)
        : null;
      if (idemKey) {
        const state = checkIdempotency(`${actor.id}:${idemKey}`);
        if (state.kind === "replay") {
          const replay = NextResponse.json(state.body, { status: state.status });
          replay.headers.set("X-Request-ID", requestId);
          replay.headers.set("Idempotent-Replay", "true");
          return replay;
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
          return busy;
        }
      }

      const data = await opts.handler({ actor, query, body, req, params });
      const res = NextResponse.json({ data }, { status: opts.status ?? 200 });
      res.headers.set("X-Request-ID", requestId);
      if (idemKey) {
        rememberResponse(
          `${actor.id}:${idemKey}`,
          opts.status ?? 200,
          { data },
        );
        res.headers.set("Idempotency-Key", idemKey);
      }
      return res;
    } catch (err) {
      // **#4:** bila gagal, buang penanda in-flight agar percobaan berikutnya
      // (key sama) tidak terjebak 409 — kesalahan bukan hasil yang di-cache.
      if (opts.idempotent) {
        const k = req.headers.get("idempotency-key")?.slice(0, 128);
        const actorId = actorIdForCleanup; // diisi sesudah resolve (lihat di bawah)
        if (k && actorId) getIdempotencyStore().forget(`${actorId}:${k}`);
      }
      return errorResponse(err, requestId);
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
async function parseJsonBody(req: Request): Promise<unknown> {
  const raw = await req.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidJsonError();
  }
}
