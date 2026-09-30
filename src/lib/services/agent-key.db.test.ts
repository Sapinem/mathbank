import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes INTEGRASI manajemen API key agen (M11-e) — DB uji nyata.
 * Menyentuh JALUR NYATA: service → Better Auth apiKey → tabel `apikey`.
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const { listAgentKeys, createAgentKey, revokeAgentKey } = await import(
  "@/lib/services/agent-key-service"
);
const { ForbiddenError } = await import("@/lib/auth/guards");

const admin: Actor = { id: "srv-key-admin", name: "Admin", roles: ["admin"], via: "session" };
const guru: Actor = { id: "srv-key-guru", name: "Guru", roles: ["teacher"], via: "session" };

async function cleanAgent() {
  const rows = await sql`SELECT id FROM "user" WHERE email = 'agent@mathbank.local'`;
  for (const r of rows) {
    await sql`DELETE FROM apikey WHERE reference_id = ${r.id}`;
    await sql`DELETE FROM user_roles WHERE user_id = ${r.id}`;
    await sql`DELETE FROM "user" WHERE id = ${r.id}`;
  }
}

beforeAll(cleanAgent);
afterAll(async () => {
  await cleanAgent();
  await sql.end();
});

describe("M11-e — manajemen API key agen", () => {
  it("guru TIDAK boleh mengelola kunci (user:manage = admin saja)", async () => {
    await expect(listAgentKeys(guru)).rejects.toThrow(ForbiddenError);
    await expect(createAgentKey(guru, { name: "x" })).rejects.toThrow(ForbiddenError);
  });

  it("admin buat kunci → nilai penuh sekali + muncul di daftar (tanpa nilai rahasia)", async () => {
    const created = await createAgentKey(admin, { name: "Claude Desktop", expiresInDays: 30 });
    expect(created.key).toMatch(/^[A-Za-z0-9_-]{8,}/); // kunci nyata
    expect(created.id).toBeTruthy();

    const list = await listAgentKeys(admin);
    const found = list.find((k) => k.id === created.id);
    expect(found).toBeTruthy();
    expect(found?.name).toBe("Claude Desktop");
    expect(found?.enabled).toBe(true);
    // Daftar TIDAK memuat nilai kunci mentah.
    expect(JSON.stringify(list)).not.toContain(created.key);
  });

  it("kunci tersimpan sebagai HASH, bukan plaintext", async () => {
    const created = await createAgentKey(admin, { name: "cek-hash" });
    const rows = await sql`SELECT key FROM apikey WHERE id = ${created.id}`;
    expect(rows[0].key).not.toBe(created.key);
    expect(String(rows[0].key).length).toBeGreaterThan(0);
  });

  it("admin cabut kunci → hilang dari daftar", async () => {
    const created = await createAgentKey(admin, { name: "akan-dicabut" });
    await revokeAgentKey(admin, created.id);
    const list = await listAgentKeys(admin);
    expect(list.some((k) => k.id === created.id)).toBe(false);
  });

  it("cabut kunci yang tak ada → NotFoundError", async () => {
    await expect(revokeAgentKey(admin, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });
});
