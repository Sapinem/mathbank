import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { resolveActor } from "@/lib/auth/resolve";
import { InvalidTransitionError } from "@/lib/fsm/question-fsm";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  assertCan,
} from "@/lib/auth/guards";
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

/** Petakan error → respons terformat. */
function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 401 },
    );
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 403 },
    );
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 404 },
    );
  }
  if (err instanceof ConflictError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 409 },
    );
  }
  if (err instanceof InvalidTransitionError) {
    return NextResponse.json(
      { error: { code: "INVALID_TRANSITION", message: err.message } },
      { status: 409 },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data tidak valid",
          details: err.issues,
        },
      },
      { status: 400 },
    );
  }
  console.error("[API] error tak terduga:", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Kesalahan server" } },
    { status: 500 },
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
    try {
      const actor = await resolveActor(req.headers);
      if (!actor) throw new UnauthorizedError();
      if (actor.mustChangePassword) {
        throw new ForbiddenError("Harus ganti password lebih dulu");
      }
      if (opts.permission) assertCan(actor, opts.permission);

      const query = opts.query
        ? opts.query.parse(searchParamsToObject(req.url))
        : (undefined as TQuery);

      const body = opts.body
        ? opts.body.parse(await req.json().catch(() => ({})))
        : (undefined as TBody);

      const params = (await args?.params) ?? {};

      const data = await opts.handler({ actor, query, body, req, params });
      return NextResponse.json({ data }, { status: opts.status ?? 200 });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Respons sukses manual (bila tak lewat wrapRoute). */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}
