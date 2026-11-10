import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes INTEGRASI manajemen API key agen & preset scoped (M11-e) — DB uji nyata.
 * Menyentuh JALUR NYATA: service → Better Auth apiKey → tabel `apikey`.
 */

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const { listAgentKeys, createAgentKey, revokeAgentKey } = await import(
  "@/lib/services/agent-key-service"
);
const { ForbiddenError, can } = await import("@/lib/auth/guards");
const { actorFromApiKey } = await import("@/lib/auth/resolve");
const { canSeeAnswerKey } = await import("@/lib/db/projections/question");

const admin: Actor = { id: "srv-key-admin", name: "Admin", roles: ["admin"], via: "session" };
const guru: Actor = { id: "srv-key-guru", name: "Guru", roles: ["teacher"], via: "session" };

const TECHNICAL_EMAILS = [
  "agent@mathbank.local",
  "guest-reader@mathbank.local",
  "reader-educator@mathbank.local",
];

async function cleanTechnicalUsers() {
  for (const email of TECHNICAL_EMAILS) {
    const rows = await sql`SELECT id FROM "user" WHERE email = ${email}`;
    for (const r of rows) {
      await sql`DELETE FROM apikey WHERE reference_id = ${r.id}`;
      await sql`DELETE FROM user_roles WHERE user_id = ${r.id}`;
      await sql`DELETE FROM "user" WHERE id = ${r.id}`;
    }
  }
}

beforeAll(cleanTechnicalUsers);
afterAll(async () => {
  await cleanTechnicalUsers();
  await sql.end();
});

describe("M11-e — manajemen API key agen & preset scoped", () => {
  it("guru TIDAK boleh mengelola kunci (user:manage = admin saja)", async () => {
    await expect(listAgentKeys(guru)).rejects.toThrow(ForbiddenError);
    await expect(createAgentKey(guru, { name: "x" })).rejects.toThrow(ForbiddenError);
  });

  it("admin buat kunci preset read_only_guest → hanya baca tanpa kunci jawaban", async () => {
    const created = await createAgentKey(admin, {
      name: "Tamu Tester",
      expiresInDays: 30,
      preset: "read_only_guest",
    });
    expect(created.key).toMatch(/^[A-Za-z0-9_-]{8,}/);
    expect(created.preset).toBe("read_only_guest");

    const list = await listAgentKeys(admin);
    const found = list.find((k) => k.id === created.id);
    expect(found).toBeTruthy();
    expect(found?.name).toBe("Tamu Tester");
    expect(found?.preset).toBe("read_only_guest");

    // Resolusi aktor dari header x-api-key
    const headers = new Headers({ "x-api-key": created.key });
    const actor = await actorFromApiKey(headers);
    expect(actor).not.toBeNull();
    expect(actor?.roles).toContain("agent");
    // L1 checks
    expect(canSeeAnswerKey(actor!)).toBe(false); // Kunci jawaban DISARING
    expect(can(actor!, "question:view")).toBe(true); // Boleh baca
    expect(can(actor!, "question:create")).toBe(false); // Ditolak buat (403)
    expect(can(actor!, "question:edit")).toBe(false); // Ditolak edit (403)
    expect(can(actor!, "question:delete")).toBe(false); // Ditolak hapus (403)
  });

  it("admin buat kunci preset read_only_full → baca lengkap beserta kunci jawaban", async () => {
    const created = await createAgentKey(admin, {
      name: "LMS Integrator",
      expiresInDays: 60,
      preset: "read_only_full",
    });
    expect(created.preset).toBe("read_only_full");

    const list = await listAgentKeys(admin);
    const found = list.find((k) => k.id === created.id);
    expect(found?.preset).toBe("read_only_full");

    // Resolusi aktor dari header x-api-key
    const headers = new Headers({ "x-api-key": created.key });
    const actor = await actorFromApiKey(headers);
    expect(actor).not.toBeNull();
    expect(actor?.roles).toContain("teacher");
    // L1 checks
    expect(canSeeAnswerKey(actor!)).toBe(true); // Kunci jawaban TERLIHAT
    expect(can(actor!, "question:view")).toBe(true); // Boleh baca
    expect(can(actor!, "question:create")).toBe(false); // Ditolak buat (403)
    expect(can(actor!, "question:edit")).toBe(false); // Ditolak edit (403)
    expect(can(actor!, "bundle:manage")).toBe(false); // Ditolak kelola paket (403)
  });

  it("admin buat kunci preset agent_full → hak agen MCP penuh", async () => {
    const created = await createAgentKey(admin, {
      name: "Claude MCP",
      expiresInDays: 90,
      preset: "agent_full",
    });
    expect(created.preset).toBe("agent_full");

    const headers = new Headers({ "x-api-key": created.key });
    const actor = await actorFromApiKey(headers);
    expect(actor).not.toBeNull();
    expect(actor?.roles).toContain("agent");
    expect(canSeeAnswerKey(actor!)).toBe(false); // Agen tidak lihat kunci
    expect(can(actor!, "question:view")).toBe(true);
    expect(can(actor!, "question:create")).toBe(true); // Boleh buat soal
    expect(can(actor!, "question:flag")).toBe(true); // Boleh tandai soal
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
