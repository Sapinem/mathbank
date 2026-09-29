import { describe, it, expect } from "vitest";
import { authorTypeOf, type Actor } from "./actor";
import { isRole, ROLES } from "./roles";
import {
  can,
  assertCan,
  hasRole,
  effectiveAccess,
  ForbiddenError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "./guards";

function actor(partial: Partial<Actor> & Pick<Actor, "roles">): Actor {
  return { id: "u1", name: "Uji", via: "session", ...partial };
}

describe("roles", () => {
  it("mengenali 5 peran sah", () => {
    expect([...ROLES].sort()).toEqual(
      ["admin", "teacher", "reviewer", "agent", "machine"].sort(),
    );
  });
  it("isRole menerima yang sah & menolak yang tidak", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("hacker")).toBe(false);
    expect(isRole("")).toBe(false);
  });
});

describe("authorTypeOf", () => {
  it("session → teacher", () => {
    expect(authorTypeOf(actor({ roles: ["teacher"] }))).toBe("teacher");
  });
  it("system → system", () => {
    expect(authorTypeOf(actor({ roles: [], via: "system" }))).toBe("system");
  });
  it("apikey + peran agent → agent", () => {
    expect(authorTypeOf(actor({ roles: ["agent"], via: "apikey" }))).toBe("agent");
  });
  it("apikey tanpa peran agent → machine", () => {
    expect(authorTypeOf(actor({ roles: ["machine"], via: "apikey" }))).toBe("machine");
  });
});

describe("guards — izin", () => {
  it("effectiveAccess ambil peran terkuat (union)", () => {
    // teacher 'own', reviewer 'yes' untuk setReady → union = yes
    const a = actor({ roles: ["teacher", "reviewer"] });
    expect(effectiveAccess(a, "question:setReady")).toBe("yes");
  });

  it("hasRole", () => {
    expect(hasRole(actor({ roles: ["admin"] }), "admin")).toBe(true);
    expect(hasRole(actor({ roles: ["admin"] }), "teacher")).toBe(false);
  });

  it("can: 'yes' → true tanpa owner", () => {
    expect(can(actor({ roles: ["admin"] }), "question:view")).toBe(true);
  });

  it("can: 'own' → true hanya bila ownerId cocok", () => {
    const a = actor({ id: "u1", roles: ["teacher"] });
    expect(can(a, "question:edit", { ownerId: "u1" })).toBe(true);
    expect(can(a, "question:edit", { ownerId: "u2" })).toBe(false);
    expect(can(a, "question:edit", { ownerId: null })).toBe(false);
  });

  it("can: 'no' → false", () => {
    expect(can(actor({ roles: ["machine"] }), "question:view")).toBe(false);
  });

  it("assertCan melempar ForbiddenError saat tak boleh", () => {
    expect(() => assertCan(actor({ roles: ["machine"] }), "user:manage")).toThrow(
      ForbiddenError,
    );
  });

  it("assertCan lolos saat boleh", () => {
    expect(() => assertCan(actor({ roles: ["admin"] }), "user:manage")).not.toThrow();
  });
});

describe("guards — kelas error", () => {
  it("punya nama & kode benar", () => {
    expect(new ForbiddenError("x").code).toBe("FORBIDDEN");
    expect(new UnauthorizedError().code).toBe("UNAUTHORIZED");
    expect(new NotFoundError().code).toBe("NOT_FOUND");
    expect(new ConflictError().code).toBe("CONFLICT");
    expect(new ForbiddenError("x").name).toBe("ForbiddenError");
    expect(new UnauthorizedError().message).toBe("Harus login lebih dulu");
    expect(new NotFoundError().name).toBe("NotFoundError");
    expect(new ConflictError("a").message).toBe("a");
  });

  it("pesan khusus diteruskan", () => {
    expect(() => assertCan(actor({ roles: [] }), "question:view", { message: "Nope" })).toThrow(
      "Nope",
    );
  });
});
