import { describe, it, expect, beforeEach } from "vitest";
import { recordRequest, snapshot, resetMetrics, normalizeRoutePath, MAX_ROUTES } from "./metrics";

/**
 * Tes telemetri in-memory (M16) — penghitungan per-route, kelas status,
 * dan persentil latensi.
 */

beforeEach(() => resetMetrics());

describe("recordRequest + snapshot", () => {
  it("menghitung count & memisahkan error (5xx) vs clientError (4xx)", () => {
    recordRequest("GET", "/api/questions", 200, 10);
    recordRequest("GET", "/api/questions", 404, 5);
    recordRequest("GET", "/api/questions", 500, 20);
    const s = snapshot();
    const r = s.routes.find((x) => x.route === "GET /api/questions")!;
    expect(r.count).toBe(3);
    expect(r.errors).toBe(1); // 500
    expect(r.clientErrors).toBe(1); // 404
    expect(s.totalRequests).toBe(3);
    expect(s.totalErrors).toBe(1);
  });

  it("memisahkan metrik per method+route", () => {
    recordRequest("GET", "/api/x", 200, 1);
    recordRequest("POST", "/api/x", 200, 2);
    const s = snapshot();
    expect(s.routes.map((r) => r.route).sort()).toEqual(["GET /api/x", "POST /api/x"]);
  });

  it("menghitung avg/max dan p50/p95 dari sampel", () => {
    for (const ms of [10, 20, 30, 40, 100]) recordRequest("GET", "/api/y", 200, ms);
    const r = snapshot().routes.find((x) => x.route === "GET /api/y")!;
    expect(r.avgMs).toBe(40); // (10+20+30+40+100)/5
    expect(r.maxMs).toBe(100);
    expect(r.p50Ms).toBe(30);
    expect(r.p95Ms).toBe(100); // persentil atas = nilai terbesar
  });

  it("route tanpa permintaan tak muncul; uptime≥0", () => {
    const s = snapshot();
    expect(s.routes).toEqual([]);
    expect(s.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it("ring buffer tetap benar setelah melebihi kapasitas (512)", () => {
    for (let i = 0; i < 600; i++) recordRequest("GET", "/api/z", 200, 1);
    const r = snapshot().routes.find((x) => x.route === "GET /api/z")!;
    expect(r.count).toBe(600); // penghitung total (bukan terbatas buffer)
    expect(r.p95Ms).toBe(1);
  });
});

/**
 * **ACT-03 (P0)** — normalisasi label & batas memori.
 */
describe("normalisasi label rute (ACT-03 A)", () => {
  it("mengganti UUID/numerik menjadi :id", () => {
    expect(
      normalizeRoutePath("/api/questions/3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/status"),
    ).toBe("/api/questions/:id/status");
    expect(normalizeRoutePath("/api/bundles/42")).toBe("/api/bundles/:id");
    expect(normalizeRoutePath("/api/bundles/42/")).toBe("/api/bundles/:id");
  });

  it("tidak mengubah segmen statis", () => {
    expect(normalizeRoutePath("/api/questions/batch")).toBe("/api/questions/batch");
    expect(normalizeRoutePath("/api/health")).toBe("/api/health");
  });

  it("100 UUID berbeda → SATU key label (DoD ACT-03)", () => {
    for (let i = 0; i < 100; i++) {
      recordRequest("GET", `/api/questions/${crypto.randomUUID()}`, 200, 3);
    }
    const s = snapshot();
    expect(s.routeCount).toBe(1);
    expect(s.routes[0].route).toBe("GET /api/questions/:id");
    expect(s.routes[0].count).toBe(100);
  });
});

describe("batas MAX_ROUTES (ACT-03 B)", () => {
  it("jumlah label tidak pernah melebihi MAX_ROUTES", () => {
    for (let i = 0; i < MAX_ROUTES + 50; i++) {
      recordRequest("GET", `/api/dinamis/segmen-unik-${i}`, 200, 1);
    }
    const s = snapshot();
    expect(s.routeCount).toBe(MAX_ROUTES);
    expect(s.maxRoutes).toBe(MAX_ROUTES);
    expect(s.evictedLabels).toBe(50);
  });

  it("route sibuk bertahan saat eviksi (hitungan kecil dibuang lebih dulu)", () => {
    // satu route sibuk
    for (let i = 0; i < 20; i++) recordRequest("GET", "/api/sibuk", 200, 1);
    for (let i = 0; i < MAX_ROUTES; i++) {
      recordRequest("GET", `/api/lain/segmen-unik-${i}`, 200, 1);
    }
    const s = snapshot();
    expect(s.routeCount).toBe(MAX_ROUTES);
    expect(s.routes.some((r) => r.route === "GET /api/sibuk")).toBe(true);
  });
});
