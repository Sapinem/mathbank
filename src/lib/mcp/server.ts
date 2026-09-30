import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Actor } from "@/lib/auth/actor";
import { registerTools } from "@/lib/mcp/tools";

/** Nama & versi server MCP (tampil di handshake klien). */
export const MCP_SERVER_INFO = {
  name: "mathbank",
  version: "0.1.0",
} as const;

/**
 * Bangun server MCP yang **terikat pada satu aktor** (M11).
 *
 * Server MCP bersifat per-request: identitas pemanggil (dari API key) disuntik
 * di sini, sehingga setiap tool menilai izin atas nama aktor yang benar. Jangan
 * jadikan singleton lintas-pengguna (akan bocor izin antar-agen).
 */
export function createMcpServer(actor: Actor): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, {
    capabilities: { tools: {} },
  });
  registerTools(server, actor);
  return server;
}
