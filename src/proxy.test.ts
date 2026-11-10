import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("proxy middleware", () => {
  it("mengalihkan HTTP ke HTTPS dengan status 308 (preservasi metode mutasi) untuk host kanonikal b.iyo.my.id", () => {
    const req = new NextRequest("http://b.iyo.my.id/questions?page=2", {
      headers: {
        host: "b.iyo.my.id",
        "x-forwarded-proto": "http",
      },
    });

    const res = proxy(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://b.iyo.my.id/questions?page=2");
  });

  it("mencegah open redirect pada pathname protocol-relative (mis. //attacker.com)", () => {
    const req = new NextRequest("http://b.iyo.my.id//attacker.com/steal", {
      headers: {
        host: "b.iyo.my.id",
        "x-forwarded-proto": "http",
      },
    });

    const res = proxy(req);
    expect(res.status).toBe(308);
    const location = res.headers.get("location") || "";
    expect(location.startsWith("https://b.iyo.my.id/")).toBe(true);
    expect(new URL(location).hostname).toBe("b.iyo.my.id");
  });

  it("tidak mengalihkan bila request sudah HTTPS", () => {
    const req = new NextRequest("https://b.iyo.my.id/questions", {
      headers: {
        host: "b.iyo.my.id",
        "x-forwarded-proto": "https",
      },
    });

    const res = proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("mencegah open redirect pada subdomain atau domain penyerang yang memuat substring b.iyo.my.id", () => {
    const maliciousHosts = [
      "b.iyo.my.id.attacker.com",
      "evil-b.iyo.my.id",
      "attacker.com?b.iyo.my.id",
    ];

    for (const host of maliciousHosts) {
      const req = new NextRequest(`http://${host}/login`, {
        headers: {
          host,
          "x-forwarded-proto": "http",
        },
      });

      const res = proxy(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("tidak mengalihkan untuk host lokal / localhost", () => {
    const req = new NextRequest("http://localhost:3000/api/health", {
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "http",
      },
    });

    const res = proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("membuang header CSP kiriman klien dari request masuk (anti CVE-2026-44581)", () => {
    const req = new NextRequest("http://localhost:3000/", {
      headers: {
        host: "localhost:3000",
        "content-security-policy": "script-src 'unsafe-inline'",
        "content-security-policy-report-only": "default-src 'self'",
        "x-custom-header": "valid",
      },
    });

    const res = proxy(req);
    expect(res.status).toBe(200);
    // Request headers yang diteruskan ke downstream oleh NextResponse.next tidak boleh memuat header CSP kiriman klien
    expect(res.headers.get("x-middleware-request-content-security-policy")).toBeNull();
    expect(res.headers.get("x-middleware-request-content-security-policy-report-only")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-custom-header")).toBe("valid");
    const overrideHeaders = res.headers.get("x-middleware-override-headers") || "";
    expect(overrideHeaders.includes("content-security-policy")).toBe(false);
  });
});
