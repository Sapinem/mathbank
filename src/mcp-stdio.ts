#!/usr/bin/env tsx
/**
 * Entry MCP — transport STDIO (M11).
 *
 * Dijalankan sebagai proses lokal oleh klien MCP desktop (Claude Desktop,
 * Cursor, dsb):
 *
 *   pnpm mcp:stdio
 *
 * Identitas: API key dari ENV `MCP_API_KEY` (lihat `src/lib/mcp/actor.ts`).
 * Semua tulisan tetap lewat service + matriks izin L1.
 *
 * CATATAN: stdout DIPAKAI protokol MCP — jangan `console.log` ke stdout.
 * Gunakan `console.error` untuk diagnostik (stderr).
 */
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "@/lib/mcp/server";
import { actorFromStdioEnv } from "@/lib/mcp/actor";

async function main() {
  const actor = await actorFromStdioEnv();
  const server = createMcpServer(actor);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp] stdio siap — aktor: ${actor.id} (${actor.roles.join(",")})`);
}

main().catch((err) => {
  console.error("[mcp] gagal start:", (err as Error).message);
  process.exit(1);
});
