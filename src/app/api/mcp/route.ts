import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextRequest } from "next/server";
import { createMcpServer } from "@/lib/mcp/server";
import { actorFromMcpHeaders } from "@/lib/mcp/actor";
import type { Actor } from "@/lib/auth/actor";
import { checkRateLimit, rateLimitKey, type RateLimitPolicy } from "@/lib/api/rate-limit";
import { getClientIp } from "@/lib/api/client-ip";

/**
 * /api/mcp — transport **Streamable HTTP** (M11).
 *
 * Pola: **stateless** (satu request → satu server → satu transport), karena
 * identitas pemanggil datang dari API key per-request. Tidak ada state lintas
 * request yang disimpan di proses (aman untuk serverless/multi-worker).
 *
 * Auth: `x-api-key` (atau `Authorization: Bearer *** Tanpa kunci valid → 401.
 * Izin: matriks L1 lewat `policy.ts` (agen tak pernah lihat `answer_key`).
 * Rate limit (SEC-02, CONSTRAINT #33): token bucket per-aktor → 429 saat lewat.
 *
 * Catatan: Next.js App Router memakai Web `Request`/`Response`, jadi kita pakai
 * `WebStandardStreamableHTTPServerTransport` (bukan varian Node `IncomingMessage`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kebijakan rate limit panggilan MCP (SEC-02). Agen biasanya memanggil
 * berurutan (bukan burst besar); burst 60 dengan isi 2/detik cukup lega.
 */
export const MCP_RATE_POLICY: RateLimitPolicy = {
  capacity: 60,
  refillPerSec: 2, // ≈ 120/menit steady-state
};

/** Bungkus error jadi jawaban JSON-RPC yang sah. */
function jsonRpcError(httpStatus: number, code: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }),
    {
      status: httpStatus,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}

/** IP klien dari header proxy (pola sama dengan route-wrapper). */
function clientIp(req: Request): string | null {
  return getClientIp(req);
}

async function handleMcp(req: NextRequest): Promise<Response> {
  // 1. Autentikasi (API key) → aktor `agent`.
  let actor: Actor;
  try {
    actor = await actorFromMcpHeaders(req.headers);
  } catch {
    return jsonRpcError(401, -32001, "Unauthorized: API key tidak valid");
  }

  // 2. Rate limit per-kunci API (SEC-02). Kunci pakai apiKeyId bila ada; fallback id aktor / IP.
  const targetId = actor.apiKeyId ?? actor.id;
  const rl = await checkRateLimit(
    rateLimitKey(targetId, clientIp(req), "mcp:call"),
    MCP_RATE_POLICY,
  );
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Terlalu banyak permintaan. Coba lagi nanti." },
        id: null,
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    );
  }

  // 3. Server + transport di-scope ke request ini (stateless).
  const server = createMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    // Transport menerima Web `Request` & mengembalikan `Response`.
    const res = await transport.handleRequest(req as unknown as Request);
    // Isi bergantung pada API key pemanggil — jangan masuk cache bersama.
    res.headers.set("cache-control", "no-store");
    return res;
  } catch (err) {
    console.error("[mcp] http error:", (err as Error).message);
    return jsonRpcError(500, -32603, "Internal error");
  } finally {
    void server.close().catch(() => {});
    void transport.close().catch(() => {});
  }
}

/** POST = panggilan protokol MCP. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleMcp(req);
}

/**
 * GET/DELETE tak dipakai pada mode stateless → 405 (klien stateless hanya butuh
 * POST). Ini mengurangi permukaan serangan.
 */
export async function GET(): Promise<Response> {
  return jsonRpcError(405, -32000, "Method Not Allowed (stateless MCP: gunakan POST)");
}

export async function DELETE(): Promise<Response> {
  return jsonRpcError(405, -32000, "Method Not Allowed (stateless MCP: gunakan POST)");
}

