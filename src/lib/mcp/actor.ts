import { actorFromApiKey } from "@/lib/auth/resolve";
import type { Actor } from "@/lib/auth/actor";

/**
 * Aktor MCP dari konteks pemanggil (M11).
 *
 * Dipakai oleh kedua transport (stdio & HTTP) supaya identitas pemanggil
 * dibangun lewat **satu jalur** (`actorFromApiKey` → `resolveActor`), sehingga
 * matriks izin L1 tetap sumber kebenaran tunggal.
 */

/** Bangun aktor dari header (HTTP transport: `x-api-key`/`Bearer`). */
export async function actorFromMcpHeaders(headers: Headers): Promise<Actor> {
  const actor = await actorFromApiKey(headers);
  if (!actor) {
    throw Object.assign(new Error("API key MCP tidak valid"), {
      code: "UNAUTHORIZED",
    });
  }
  return actor;
}

/**
 * Aktor untuk transport **stdio** (proses lokal).
 *
 * API key dibaca dari ENV `MCP_API_KEY`. Bila kosong:
 *  - `MCP_ALLOW_ANON=true` di lingkungan non-produksi → aktor `agent` dev
 *    (untuk mencoba; tetap tunduk matriks izin L1).
 *  - selain itu → melempar (stdio tanpa kunci = ditolak).
 */
export async function actorFromStdioEnv(): Promise<Actor> {
  const key = process.env.MCP_API_KEY?.trim();
  if (key) {
    const headers = new Headers({ "x-api-key": key });
    return actorFromMcpHeaders(headers);
  }
  const canAnon =
    process.env.NODE_ENV !== "production" && process.env.MCP_ALLOW_ANON === "true";
  if (canAnon) {
    return { id: "mcp-anon", name: "MCP (anon dev)", roles: ["agent"], via: "apikey" };
  }
  throw Object.assign(new Error("MCP_API_KEY belum diatur"), {
    code: "UNAUTHORIZED",
  });
}
