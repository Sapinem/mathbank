import { describe, it, expect } from "vitest";
import { demoLoginAllowed, isDemoPublic, isProductionLike } from "./demo-login";

describe("demoLoginAllowed (Fase 2, pagar ganda)", () => {
  it("dev: hidup tanpa flag apa pun (kenyamanan dev, seperti dulu)", () => {
    expect(demoLoginAllowed({ NODE_ENV: "development", APP_ENV: "development" })).toBe(true);
    expect(demoLoginAllowed({ NODE_ENV: "development" })).toBe(true);
  });

  it("produksi tanpa flag: MATI", () => {
    expect(demoLoginAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(demoLoginAllowed({ NODE_ENV: "development", APP_ENV: "production" })).toBe(false);
  });

  it("produksi + DEMO_LOGIN saja (bypass lama): MATI — ini regresi utama Fase 2", () => {
    expect(
      demoLoginAllowed({ NODE_ENV: "production", DEMO_LOGIN: "enabled" }),
    ).toBe(false);
    expect(
      demoLoginAllowed({ NODE_ENV: "development", APP_ENV: "production", DEMO_LOGIN: "enabled" }),
    ).toBe(false);
  });

  it("produksi + DEMO_LOGIN + DEMO_LOGIN_PUBLIC: HIDUP (server demo publik saja)", () => {
    expect(
      demoLoginAllowed({
        NODE_ENV: "production",
        DEMO_LOGIN: "enabled",
        DEMO_LOGIN_PUBLIC: "true",
      }),
    ).toBe(true);
  });

  it("DEMO_LOGIN_PUBLIC saja tanpa DEMO_LOGIN: MATI", () => {
    expect(
      demoLoginAllowed({ NODE_ENV: "production", DEMO_LOGIN_PUBLIC: "true" }),
    ).toBe(false);
  });

  it("staging tanpa flag publik: MATI (konsisten dengan AUTH_DEV_BYPASS)", () => {
    expect(
      demoLoginAllowed({ NODE_ENV: "development", APP_ENV: "staging", DEMO_LOGIN: "enabled" }),
    ).toBe(false);
    expect(
      demoLoginAllowed({
        NODE_ENV: "development",
        APP_ENV: "staging",
        DEMO_LOGIN: "enabled",
        DEMO_LOGIN_PUBLIC: "true",
      }),
    ).toBe(true);
  });

  it("APP_ENV case-insensitive", () => {
    expect(
      demoLoginAllowed({ NODE_ENV: "development", APP_ENV: "PRODUCTION", DEMO_LOGIN: "enabled" }),
    ).toBe(false);
    expect(isProductionRuntimeCheck()).toBe(true);
    function isProductionRuntimeCheck() {
      return isProductionLike({ APP_ENV: "PRODUCTION" });
    }
  });

  it("isDemoPublic membutuhkan kedua flag", () => {
    expect(isDemoPublic({ DEMO_LOGIN: "enabled", DEMO_LOGIN_PUBLIC: "true" })).toBe(true);
    expect(isDemoPublic({ DEMO_LOGIN: "enabled" })).toBe(false);
    expect(isDemoPublic({ DEMO_LOGIN_PUBLIC: "true" })).toBe(false);
  });
});
