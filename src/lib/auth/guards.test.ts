import { describe, it, expect } from "vitest";
import { can, effectiveAccess, assertCan, ForbiddenError, hasRole } from "./guards";
import type { Actor } from "./actor";
import { ROLES, type Role } from "./roles";
import { PERMISSIONS, type Permission } from "./permissions";

function actor(roles: Role[], id = "u1"): Actor {
  return { id, name: "Test", roles, via: "session" };
}

describe("matriks izin (L1)", () => {
  it("semua peran punya entri di setiap izin (tak ada lubang)", () => {
    const permissions = Object.keys(PERMISSIONS) as Permission[];
    for (const p of permissions) {
      for (const role of ROLES) {
        expect(PERMISSIONS[p][role]).toBeDefined();
      }
    }
  });

  it("admin boleh SEMUA (tak ada 'no')", () => {
    const permissions = Object.keys(PERMISSIONS) as Permission[];
    for (const p of permissions) {
      expect(PERMISSIONS[p].admin).not.toBe("no");
    }
  });

  it("teacher tak boleh set ready/archive", () => {
    const a = actor(["teacher"]);
    expect(can(a, "question:setReady")).toBe(false);
    expect(can(a, "question:archive")).toBe(false);
  });

  it("reviewer BOLEH set ready, tak boleh archive", () => {
    const a = actor(["reviewer"]);
    expect(can(a, "question:setReady")).toBe(true);
    expect(can(a, "question:archive")).toBe(false);
  });

  it("teacher boleh hard-delete SOAL SENDIRI saja (own)", () => {
    const a = actor(["teacher"], "u1");
    expect(can(a, "question:hardDelete", { ownerId: "u1" })).toBe(true);
    expect(can(a, "question:hardDelete", { ownerId: "u2" })).toBe(false);
    expect(can(a, "question:hardDelete")).toBe(false); // tanpa ownerId
  });

  it("agent TIDAK boleh bundle/hapus/status", () => {
    const a = actor(["agent"]);
    expect(can(a, "bundle:manage")).toBe(false);
    expect(can(a, "question:delete")).toBe(false);
    expect(can(a, "question:setReady")).toBe(false);
    expect(can(a, "question:hardDelete")).toBe(false);
  });

  it("agent BOLEH enrichment & buat soal", () => {
    const a = actor(["agent"]);
    expect(can(a, "enrichment:run")).toBe(true);
    expect(can(a, "question:create")).toBe(true);
  });

  it("machine hanya ingest + enrichment (tak lihat soal)", () => {
    const a = actor(["machine"]);
    expect(can(a, "question:view")).toBe(false);
    expect(can(a, "question:create")).toBe(true);
    expect(can(a, "enrichment:run")).toBe(true);
  });

  it("multi-role: union izin (teacher+reviewer = boleh set ready)", () => {
    const a = actor(["teacher", "reviewer"]);
    expect(can(a, "question:setReady")).toBe(true);
    expect(hasRole(a, "teacher")).toBe(true);
    expect(hasRole(a, "reviewer")).toBe(true);
  });

  it("effectiveAccess ambil yang terkuat (yes > own > no)", () => {
    const a = actor(["teacher", "reviewer"]);
    // teacher: own, reviewer: own → tetap own
    expect(effectiveAccess(a, "question:edit")).toBe("own");
    // teacher: no, reviewer: yes → yes
    expect(effectiveAccess(a, "question:setReady")).toBe("yes");
  });

  it("assertCan melempar ForbiddenError bila tak boleh", () => {
    const a = actor(["machine"]);
    expect(() => assertCan(a, "question:view")).toThrow(ForbiddenError);
  });

  it("taksonomi boleh oleh teacher/reviewer/agent (bukan admin-only)", () => {
    for (const role of ["teacher", "reviewer", "agent"] as Role[]) {
      const a = actor([role]);
      expect(can(a, "taxonomy:manage", { ownerId: a.id })).toBe(true);
    }
  });
});

describe("batasan API key (permission menyempitkan, T3)", () => {
  function apiActor(
    perms: Record<string, string[]> | undefined,
    roles: Role[] = ["agent"],
  ): Actor {
    return {
      id: "u9",
      name: "Agen",
      roles,
      via: "apikey",
      apiKeyPermissions: perms,
    };
  }

  it("tanpa apiKeyPermissions → perilaku peran biasa (tak dibatasi)", () => {
    const a = apiActor(undefined);
    expect(can(a, "question:view")).toBe(true);
    expect(can(a, "question:create")).toBe(true);
  });

  it("dengan apiKeyPermissions → izin dibatasi padanya", () => {
    const a = apiActor({ question: ["read"] });
    expect(can(a, "question:view")).toBe(true); // read → view
    expect(can(a, "question:create")).toBe(false); // tak tercantum
  });

  it("memetakan update→edit & delete→delete", () => {
    // teacher boleh edit/delete SOAL SENDIRI (own) → batas atas izin peran.
    const a = apiActor({ question: ["update", "delete"] }, ["teacher"]);
    expect(can(a, "question:edit", { ownerId: "u9" })).toBe(true);
    expect(can(a, "question:delete", { ownerId: "u9" })).toBe(true);
    expect(can(a, "question:view")).toBe(false);
  });

  it("resource lain di luar daftar → ditolak", () => {
    const a = apiActor({ question: ["read"] });
    expect(can(a, "bundle:manage")).toBe(false);
    expect(can(a, "settings:manage")).toBe(false);
  });

  it("tak pernah MEMPERLUAS: izin peran tetap jadi batas atas", () => {
    // agent tak boleh bundle:manage; apiKey tak bisa memberikannya.
    const a = apiActor({ bundle: ["read"] }, ["agent"]);
    expect(can(a, "bundle:manage")).toBe(false);
  });

  it("daftar aksi kosong → menolak", () => {
    const a = apiActor({ question: [] });
    expect(can(a, "question:view")).toBe(false);
  });
});
