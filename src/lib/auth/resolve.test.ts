import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Uji `resolve.ts` — pintu masuk identitas aktor (SECURITY-CRITICAL).
 *
 * Fokus:
 *  1. Pagar keras dev-bypass (JANGAN pernah aktif di produksi).
 *  2. Prioritas resolusi: dev → session → API key.
 *  3. Pemetaan header API key (`x-api-key` & `Authorization: Bearer`).
 *  4. Tahan banting: error internal tak membocorkan aktor.
 */

// Mock Better Auth + DB (resolve.ts mengimpornya saat import).
const getSession = vi.fn();
const verifyApiKey = vi.fn();
const dbSelect = vi.fn();

vi.mock("./server", () => ({
  auth: {
    api: {
      getSession: (...a: unknown[]) => getSession(...a),
      verifyApiKey: (...a: unknown[]) => verifyApiKey(...a),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => dbSelect(),
      }),
    }),
  },
}));

const { actorFromSession, actorFromApiKey, resolveActor } = await import(
  "./resolve"
);

/** Rantai `db.select().from().where()` mengembalikan baris peran. */
function mockRoles(roles: string[]) {
  dbSelect.mockResolvedValue(roles.map((role) => ({ role })));
}

const H = (init: Record<string, string> = {}) => new Headers(init);

describe("resolve.ts — identitas aktor (L1)", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV };
    delete process.env.AUTH_DEV_BYPASS;
    delete process.env.APP_ENV;
    mockRoles([]);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe("pagar dev-bypass (kritis)", () => {
    it("NONAKTIF bila AUTH_DEV_BYPASS tak diset", async () => {
      getSession.mockResolvedValue(null);
      verifyApiKey.mockResolvedValue({ valid: false });
      expect(await resolveActor(H())).toBeNull();
    });

    it("AKTIF bila AUTH_DEV_BYPASS=true (non-produksi)", async () => {
      process.env.AUTH_DEV_BYPASS = "true";
      const a = await resolveActor(H());
      expect(a?.id).toBe("dev-user");
      expect(a?.roles).toEqual(["admin"]);
    });

    it("MATI TOTAL di produksi meski AUTH_DEV_BYPASS=true (pagar keras)", async () => {
      process.env.AUTH_DEV_BYPASS = "true";
      vi.stubEnv("NODE_ENV", "production");
      getSession.mockResolvedValue(null);
      verifyApiKey.mockResolvedValue({ valid: false });
      expect(await resolveActor(H())).toBeNull();
      vi.unstubAllEnvs();
    });

    it("hanya menerima nilai 'true' literal", async () => {
      process.env.AUTH_DEV_BYPASS = "1"; // bukan "true"
      getSession.mockResolvedValue(null);
      verifyApiKey.mockResolvedValue({ valid: false });
      expect(await resolveActor(H())).toBeNull();
    });

    it("MATI di staging meski AUTH_DEV_BYPASS=true (pagar kedua, T2)", async () => {
      process.env.AUTH_DEV_BYPASS = "true";
      process.env.APP_ENV = "staging";
      getSession.mockResolvedValue(null);
      verifyApiKey.mockResolvedValue({ valid: false });
      expect(await resolveActor(H())).toBeNull();
    });

    it("MATI bila APP_ENV=production meski NODE_ENV bukan production", async () => {
      process.env.AUTH_DEV_BYPASS = "true";
      process.env.APP_ENV = "production";
      getSession.mockResolvedValue(null);
      verifyApiKey.mockResolvedValue({ valid: false });
      expect(await resolveActor(H())).toBeNull();
    });

    it("AKTIF bila APP_ENV=development (dev eksplisit)", async () => {
      process.env.AUTH_DEV_BYPASS = "true";
      process.env.APP_ENV = "development";
      const a = await resolveActor(H());
      expect(a?.id).toBe("dev-user");
    });
  });

  describe("aktor dari session", () => {
    it("memetakan user + peran multi-role dari DB", async () => {
      getSession.mockResolvedValue({
        user: { id: "u1", name: "Guru A", mustChangePassword: false },
      });
      mockRoles(["teacher", "reviewer"]);
      const a = await actorFromSession(H());
      expect(a).toEqual({
        id: "u1",
        name: "Guru A",
        roles: ["teacher", "reviewer"],
        via: "session",
        mustChangePassword: false,
      });
    });

    it("menandai mustChangePassword bila true", async () => {
      getSession.mockResolvedValue({
        user: { id: "u2", name: "X", mustChangePassword: true },
      });
      mockRoles(["teacher"]);
      expect((await actorFromSession(H()))?.mustChangePassword).toBe(true);
    });

    it("menyaring peran tak dikenal dari DB", async () => {
      getSession.mockResolvedValue({ user: { id: "u3", name: "Y" } });
      mockRoles(["teacher", "bogus"]);
      expect((await actorFromSession(H()))?.roles).toEqual(["teacher"]);
    });

    it("null bila tak ada session", async () => {
      getSession.mockResolvedValue(null);
      expect(await actorFromSession(H())).toBeNull();
    });

    it("null (bukan lempar) bila getSession error", async () => {
      getSession.mockRejectedValue(new Error("boom"));
      expect(await actorFromSession(H())).toBeNull();
    });
  });

  describe("aktor dari API key", () => {
    it("null bila tak ada header kunci", async () => {
      expect(await actorFromApiKey(H())).toBeNull();
      expect(verifyApiKey).not.toHaveBeenCalled();
    });

    it("membaca x-api-key", async () => {
      verifyApiKey.mockResolvedValue({
        valid: true,
        key: { id: "k1", name: "Agen 1", referenceId: "u9" },
      });
      mockRoles(["agent"]);
      const a = await actorFromApiKey(H({ "x-api-key": "secret123" }));
      expect(verifyApiKey).toHaveBeenCalledWith({
        body: { key: "secret123" },
      });
      expect(a?.via).toBe("apikey");
      expect(a?.id).toBe("u9");
      expect(a?.roles).toEqual(["agent"]);
    });

    it("membaca Authorization: Bearer", async () => {
      verifyApiKey.mockResolvedValue({
        valid: true,
        key: { id: "k2", referenceId: "u10" },
      });
      mockRoles(["machine"]);
      const a = await actorFromApiKey(H({ authorization: "Bearer tok456" }));
      expect(verifyApiKey).toHaveBeenCalledWith({ body: { key: "tok456" } });
      expect(a?.name).toBe("API Client"); // nama default bila kosong
    });

    it("null bila kunci tak valid", async () => {
      verifyApiKey.mockResolvedValue({ valid: false });
      expect(await actorFromApiKey(H({ "x-api-key": "bad" }))).toBeNull();
    });

    it("null bila verifikasi error", async () => {
      verifyApiKey.mockRejectedValue(new Error("down"));
      expect(await actorFromApiKey(H({ "x-api-key": "x" }))).toBeNull();
    });
  });

  describe("prioritas resolusi", () => {
    it("session dipakai sebelum API key", async () => {
      getSession.mockResolvedValue({ user: { id: "u1", name: "Guru" } });
      mockRoles(["teacher"]);
      const a = await resolveActor(H({ "x-api-key": "ignored" }));
      expect(a?.via).toBe("session");
      expect(verifyApiKey).not.toHaveBeenCalled();
    });

    it("fallback ke API key bila session null", async () => {
      getSession.mockResolvedValue(null);
      verifyApiKey.mockResolvedValue({
        valid: true,
        key: { id: "k", referenceId: "u7" },
      });
      mockRoles(["agent"]);
      const a = await resolveActor(H({ "x-api-key": "k" }));
      expect(a?.via).toBe("apikey");
    });
  });
});
