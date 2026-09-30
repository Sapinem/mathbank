import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextRequest } from "next/server";
import { createMcpServer } from "@/lib/mcp/server";
import { actorFromMcpHeaders } from "@/lib/mcp/actor";

/**
 * /api/mcp — transport **Streamable HTTP** (M11).
 *
 * Pola: **stateless** (satu request → satu server → satu transport), karena
 * identitas pemanggil datang dari API key per-request. Tidak ada state lintas
 * request yang disimpan di proses (aman untuk serverless/multi-worker).
 *
 * Auth: `x-api-key` (atau `Authorization: Bearer <key>`). Tanpa kunci valid → 401.
 * Izin: matriks L1 lewat `policy.ts` (agen tak pernah lihat `answer_key`).
 *
 * Catatan: Next.js App Router memakai Web `Request`/`Response`, jadi kita pakai
 * `WebStandardStreamableHTTPServerTransport` (bukan varian Node `IncomingMessage`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bungkus error jadi jawaban JSON-RPC yang sah. */
function jsonRpcError(httpStatus: number, code: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }),
    { status: httpStatus, headers: { "content-type": "application/json" } },
  );
}

async function handleMcp(req: NextRequest): Promise<Response> {
  // 1. Autentikasi (API key) → aktor `agent`.
  let actor;
  try {
    actor = await actorFromMcpHeaders(req.headers);
  } catch {
    return jsonRpcError(401, -32001, "Unauthorized: API key tidak valid");
  }

  // 2. Server + transport di-scope ke request ini (stateless).
  const server = createMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    // Transport menerima Web `Request` & mengembalikan `Response`.
    return await transport.handleRequest(req as unknown as Request);
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
