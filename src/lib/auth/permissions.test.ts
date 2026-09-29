import { describe, it, expect } from "vitest";
import { PERMISSIONS, type Permission } from "./permissions";
import { ROLES, type Role } from "./roles";

/**
 * Uji KUNCI MATRIKS (L1) — exhaustive.
 *
 * Tujuan: mengunci SELURUH matriks izin (setiap sel) agar perubahan tak
 * sengaja tertangkap. Bila ada yang mengubah matriks, tes ini gagal dan
 * memaksa tinjauan sadar (bukan "kebetulan berubah").
 */

/** Matriks izin yang DISENGAJA — sumber kebenaran yang di-review. */
const EXPECTED: Record<Permission, Record<Role, "yes" | "own" | "no">> = {
  "question:view": { admin: "yes", teacher: "yes", reviewer: "yes", agent: "yes", machine: "no" },
  "question:create": { admin: "yes", teacher: "yes", reviewer: "yes", agent: "yes", machine: "yes" },
  "question:edit": { admin: "yes", teacher: "own", reviewer: "own", agent: "own", machine: "no" },
  "question:delete": { admin: "yes", teacher: "own", reviewer: "own", agent: "no", machine: "no" },
  "question:hardDelete": { admin: "yes", teacher: "own", reviewer: "own", agent: "no", machine: "no" },
  "question:setReady": { admin: "yes", teacher: "no", reviewer: "yes", agent: "no", machine: "no" },
  "question:archive": { admin: "yes", teacher: "no", reviewer: "no", agent: "no", machine: "no" },
  "question:flag": { admin: "yes", teacher: "own", reviewer: "yes", agent: "yes", machine: "no" },
  "taxonomy:manage": { admin: "yes", teacher: "own", reviewer: "own", agent: "own", machine: "yes" },
  "reference:manage": { admin: "yes", teacher: "own", reviewer: "own", agent: "own", machine: "no" },
  "bundle:manage": { admin: "yes", teacher: "yes", reviewer: "yes", agent: "no", machine: "no" },
  "media:manage": { admin: "yes", teacher: "yes", reviewer: "yes", agent: "yes", machine: "no" },
  "settings:manage": { admin: "yes", teacher: "no", reviewer: "no", agent: "no", machine: "no" },
  "user:manage": { admin: "yes", teacher: "no", reviewer: "no", agent: "no", machine: "no" },
  "enrichment:run": { admin: "yes", teacher: "no", reviewer: "no", agent: "yes", machine: "yes" },
};

describe("matriks izin — kunci exhaustive", () => {
  it("setiap izin di EXPECTED ada di PERMISSIONS (dan sebaliknya)", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it.each(Object.keys(EXPECTED) as Permission[])(
    "izin '%s' cocok dengan matriks yang dirancang",
    (perm) => {
      expect(PERMISSIONS[perm]).toEqual(EXPECTED[perm]);
    },
  );

  it("setiap peran terdefinisi di setiap izin (tak ada lubang)", () => {
    for (const perm of Object.keys(PERMISSIONS) as Permission[]) {
      for (const role of ROLES) {
        expect(["yes", "own", "no"]).toContain(PERMISSIONS[perm][role]);
      }
    }
  });

  it("hanya izin yang jelas yang boleh 'own' (audit kesengajaan)", () => {
    // 'own' hanya masuk akal untuk resource yang punya pemilik (authorId).
    const ownPerms = (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
      ROLES.some((r) => PERMISSIONS[p][r] === "own"),
    );
    expect(ownPerms.sort()).toEqual(
      [
        "question:delete",
        "question:edit",
        "question:flag",
        "question:hardDelete",
        "reference:manage",
        "taxonomy:manage",
      ].sort(),
    );
  });

  it("peran 'machine' tak boleh aksi destruktif/status", () => {
    for (const p of [
      "question:delete",
      "question:hardDelete",
      "question:setReady",
      "question:archive",
      "settings:manage",
      "user:manage",
    ] as Permission[]) {
      expect(PERMISSIONS[p].machine).toBe("no");
    }
  });

  it("peran 'agent' tak boleh bundle & hapus & status", () => {
    for (const p of [
      "bundle:manage",
      "question:delete",
      "question:hardDelete",
      "question:setReady",
      "question:archive",
    ] as Permission[]) {
      expect(PERMISSIONS[p].agent).toBe("no");
    }
  });
});
