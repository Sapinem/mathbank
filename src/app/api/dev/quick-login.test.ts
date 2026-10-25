import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tes route quick-login (Fase 2) — pagar lingkungan + rate-limit.
 * `auth` di-mock agar tes tidak butuh DB/Better Auth nyata; yang diuji
 * adalah pagar dan rate-limit di route, bukan sign-in Better Auth itu sendiri.
 */
vi.mock("@/lib/auth/server", () => ({
  auth: {
    handler: async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "set-cookie": "session=test; Path=/" },
      }),
  },
}));

import { POST } from "./quick-login/route";
import { getStore } from "@/lib/api/rate-limit";

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/dev/quick-login", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dev/quick-login (Fase 2)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    getStore().clear?.();
  });

  it("produksi + DEMO_LOGIN saja: 404 (pagar ganda)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_LOGIN", "enabled");
    vi.stubEnv("DEMO_LOGIN_PUBLIC", "");
    const res = await POST(req({ key: "admin" }));
    expect(res.status).toBe(404);
  });

  it("produksi + DEMO_LOGIN + DEMO_LOGIN_PUBLIC: lolos pagar, lalu rate-limit 429 setelah 10 permintaan", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_LOGIN", "enabled");
    vi.stubEnv("DEMO_LOGIN_PUBLIC", "true");
    for (let i = 0; i < 10; i++) {
      const res = await POST(req({ key: "admin" }));
      expect(res.status).toBe(200);
    }
    const res = await POST(req({ key: "admin" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("dev: body tak valid → 400, tanpa mengubah pagar", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
