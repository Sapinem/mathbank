import { describe, it, expect } from "vitest";
import { canMcp, assertMcp, MCP_CAPABILITIES, MCP_FORBIDDEN } from "./policy";
import { ForbiddenError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";

/** Aktor uji. */
function actor(roles: Actor["roles"], id = "u1"): Actor {
  return { id, name: "t", roles, via: "session" };
}

describe("MCP policy (L1)", () => {
  it("agent boleh baca/buat soal", () => {
    const a = actor(["agent"]);
    expect(canMcp(a, "question.read")).toBe(true);
    expect(canMcp(a, "question.create")).toBe(true);
    expect(canMcp(a, "enrichment.run")).toBe(true);
  });

  it("question.edit = own → hanya soal MILIKNYA", () => {
    const a = actor(["agent"], "agent-1");
    expect(canMcp(a, "question.edit", { ownerId: "agent-1" })).toBe(true);
    expect(canMcp(a, "question.edit", { ownerId: "orang-lain" })).toBe(false);
    expect(canMcp(a, "question.edit", { ownerId: null })).toBe(false);
  });

  it("taxonomy.manage = yes untuk agent (karena taksonomi tak punya pemilik)", () => {
    const a = actor(["agent"], "agent-1");
    expect(canMcp(a, "taxonomy.manage", { ownerId: "agent-1" })).toBe(true);
    expect(canMcp(a, "taxonomy.manage")).toBe(true);
  });

  it("Fase 3: question.flag — teacher own, agent/reviewer yes (L1, tidak diubah)", () => {
    // Teacher hanya soal sendiri; agent & reviewer boleh menandai soal siapa
    // pun (kurasi). assertMcpForQuestion di tools.ts meneruskan ownerId agar
    // lapisan MCP menegakkan semantik yang sama dengan service.
    const teacher = actor(["teacher"], "guru-1");
    expect(canMcp(teacher, "question.flag", { ownerId: "guru-1" })).toBe(true);
    expect(canMcp(teacher, "question.flag", { ownerId: "orang-lain" })).toBe(false);
    expect(canMcp(teacher, "question.flag", { ownerId: null })).toBe(false);
    const agent = actor(["agent"], "agent-1");
    expect(canMcp(agent, "question.flag", { ownerId: "orang-lain" })).toBe(true);
    expect(canMcp(actor(["reviewer"], "rev-1"), "question.flag", { ownerId: "orang-lain" })).toBe(true);
  });

  it("Fase 3: assertMcp tanpa ownerId TIDAK menegakkan own (alasan helper baru)", () => {
    // Cabang opts === undefined di canMcp hanya memeriksa peran tidak `no`.
    // Inilah celah yang ditutup tools.ts: handler per-objek wajib memuat
    // authorId dulu, bukan memanggil assertMcp tanpa ownerId.
    const a = actor(["agent"], "agent-1");
    expect(canMcp(a, "question.edit")).toBe(true);
    expect(canMcp(a, "question.edit", { ownerId: "orang-lain" })).toBe(false);
  });

  it("machine tak boleh baca soal (hanya ingest)", () => {
    expect(canMcp(actor(["machine"]), "question.read")).toBe(false);
  });

  it("taxonomy.read mengikuti question:view", () => {
    expect(canMcp(actor(["agent"]), "taxonomy.read")).toBe(true);
    expect(canMcp(actor(["machine"]), "taxonomy.read")).toBe(false);
  });

  it("assertMcp melempar ForbiddenError bila tak boleh", () => {
    const a = actor(["agent"], "agent-1");
    expect(() => assertMcp(a, "question.edit", { ownerId: "lain" })).toThrow(ForbiddenError);
    expect(() => assertMcp(a, "question.read")).not.toThrow();
  });

  it("pesan ForbiddenError menyebut kapabilitas", () => {
    const a = actor(["machine"]);
    expect(() => assertMcp(a, "question.read")).toThrow(/question\.read/);
  });

  it("API key yang menyempitkan izin menutup kapabilitas", () => {
    const a: Actor = {
      id: "u1",
      name: "t",
      roles: ["agent"],
      via: "apikey",
      apiKeyPermissions: { question: ["read"] }, // tanpa create/enrich
    };
    expect(canMcp(a, "question.read")).toBe(true);
    expect(canMcp(a, "question.create")).toBe(false);
    expect(canMcp(a, "enrichment.run")).toBe(false);
  });

  it("MCP_CAPABILITIES hanya izin yang sah", () => {
    for (const perm of Object.values(MCP_CAPABILITIES)) {
      expect(perm).toMatch(/^(question|taxonomy|enrichment|media):/);
    }
  });

  it("MCP_FORBIDDEN mencakup hapus/status/bundle", () => {
    expect(MCP_FORBIDDEN).toContain("question:delete");
    expect(MCP_FORBIDDEN).toContain("question:setReady");
    expect(MCP_FORBIDDEN).toContain("bundle:manage");
  });
});
