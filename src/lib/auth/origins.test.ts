import { describe, it, expect } from "vitest";
import {
  isProductionRuntime,
  buildTrustedOrigins,
  resolveAuthSecret,
  PRODUCTION_ORIGINS,
  LOCAL_DEV_ORIGINS,
} from "./origins";

/**
 * Tes gerbang origin/lingkungan auth (M14) — fungsi murni (env eksplisit).
 * Melindungi aturan keamanan: origin dev TIDAK boleh bocor ke produksi.
 */

describe("isProductionRuntime", () => {
  it("NODE_ENV=production → true", () => {
    expect(isProductionRuntime({ NODE_ENV: "production" })).toBe(true);
  });

  it("APP_ENV production/staging (case-insensitive) → true", () => {
    expect(isProductionRuntime({ APP_ENV: "production" })).toBe(true);
    expect(isProductionRuntime({ APP_ENV: "staging" })).toBe(true);
    expect(isProductionRuntime({ APP_ENV: "PRODUCTION" })).toBe(true);
  });

  it("dev/test/absent → false", () => {
    expect(isProductionRuntime({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionRuntime({})).toBe(false);
    expect(isProductionRuntime({ APP_ENV: "local" })).toBe(false);
  });
});

describe("buildTrustedOrigins", () => {
  it("PRODUKSI → hanya APP_URL + domain resmi (TANPA origin dev)", () => {
    const r = buildTrustedOrigins({
      NODE_ENV: "production",
      APP_URL: "https://b.iyo.my.id",
    });
    expect(r).toContain("https://b.iyo.my.id");
    for (const dev of LOCAL_DEV_ORIGINS) expect(r).not.toContain(dev);
    expect(r.some((o) => o.includes("localhost"))).toBe(false);
  });

  it("PRODUKSI tanpa APP_URL → tetap punya domain resmi", () => {
    const r = buildTrustedOrigins({ NODE_ENV: "production" });
    expect(r).toEqual(PRODUCTION_ORIGINS);
  });

  it("DEV → tambah localhost + host LAN dari ALLOWED_DEV_ORIGINS", () => {
    const r = buildTrustedOrigins({
      NODE_ENV: "development",
      ALLOWED_DEV_ORIGINS: "192.168.18.100, 10.0.0.5",
    });
    expect(r).toContain("http://localhost:3001");
    expect(r).toContain("http://192.168.18.100:3001");
    expect(r).toContain("http://192.168.18.100:3000");
    expect(r).toContain("http://10.0.0.5:3001");
  });

  it("DEV tanpa ALLOWED_DEV_ORIGINS → default 192.168.18.100", () => {
    const r = buildTrustedOrigins({ NODE_ENV: "development" });
    expect(r).toContain("http://192.168.18.100:3001");
  });

  it("STAGING diperlakukan produksi (tanpa origin dev)", () => {
    const r = buildTrustedOrigins({ APP_ENV: "staging" });
    expect(r.some((o) => o.includes("localhost"))).toBe(false);
  });
});

describe("resolveAuthSecret", () => {
  it("mengembalikan secret bila ada", () => {
    expect(resolveAuthSecret({ BETTER_AUTH_SECRET: "abc" })).toBe("abc");
  });

  it("produksi tanpa secret → MELEMPAR (fail-fast)", () => {
    expect(() => resolveAuthSecret({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("non-produksi tanpa secret → undefined (boleh)", () => {
    expect(resolveAuthSecret({ NODE_ENV: "development" })).toBeUndefined();
  });
});
