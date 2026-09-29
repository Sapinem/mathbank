import { test, expect } from "@playwright/test";

/**
 * E2E — Security headers (S2).
 *
 * Dijalankan di dev server (playwright webServer = `pnpm dev`), jadi HSTS
 * TIDAK diharapkan (hanya produksi). Header lain harus ada di semua rute.
 */

const EXPECTED: Record<string, string | RegExp> = {
  "content-security-policy": /default-src 'self'/,
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": /camera=\(\)/,
};

test.describe("Security headers", () => {
  test("halaman HTML membawa header keamanan", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const h = res.headers();
    for (const [key, val] of Object.entries(EXPECTED)) {
      expect(h[key], `header ${key}`).toMatch(val);
    }
  });

  test("respons API juga membawa header keamanan", async ({ request }) => {
    const res = await request.get("/api/stats");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("CSP memuat arahan anti-clickjacking & anti-plugin", async ({
    request,
  }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  test("dev TIDAK memaksa HSTS (http://localhost aman)", async ({ request }) => {
    const res = await request.get("/");
    // Di dev, HSTS sengaja tak diset agar localhost tak dipaksa HTTPS.
    expect(res.headers()["strict-transport-security"]).toBeUndefined();
  });

  test("HTTP polos: TIDAK ada upgrade-insecure-requests (aset tetap termuat)", async ({
    request,
  }) => {
    // Regresi: directive ini pernah membuat LAN (http://<ip>:3001) tampil tanpa CSS.
    // Ia hanya boleh dikirim saat APP_HTTPS=true (di balik TLS).
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"] ?? "";
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
