import { beforeEach, describe, it, expect } from "vitest";
import {
  MAX_ROUTES,
  normalizeRoutePath,
  recordRequest,
  resetMetrics,
  routeCount,
  snapshot,
} from "./metrics";

/**
 * **ACT-03 (P0)** — label metrik stabil + batas memori.
 *
 * DoD: 100 request dengan UUID berbeda hanya menghasilkan **1** key label, dan
 * jumlah label tak pernah melewati `MAX_ROUTES` (bukti store tidak bocor).
 */

describe("normalizeRoutePath", () => {
  it("UUID dinamis → :id", () => {
    expect(
      normalizeRoutePath("/api/questions/3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"),
    ).toBe("/api/questions/:id");
    expect(
      normalizeRoutePath("/api/questions/3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/status"),
    ).toBe("/api/questions/:id/status");
  });

  it("segmen numerik & trailing slash & query string", () => {
    expect(normalizeRoutePath("/api/bundles/42")).toBe("/api/bundles/:id");
    expect(normalizeRoutePath("/api/bundles/42/")).toBe("/api/bundles/:id");
    expect(normalizeRoutePath("/api/questions?page=2&limit=50")).toBe(
      "/api/questions",
    );
  });

  it("segmen statis tidak diubah", () => {
    expect(normalizeRoutePath("/api/health")).toBe("/api/health");
    expect(normalizeRoutePath("/api/v1/ingest/commit")).toBe(
      "/api/v1/ingest/commit",
    );
  });
});

describe("recordRequest — 1 label untuk 100 UUID berbeda (DoD ACT-03)", () => {
  beforeEach(() => resetMetrics());

  it("100 UUID berbeda → routeCount() === 1 dan count === 100", () => {
    for (let i = 0; i < 100; i += 1) {
      const uuid = crypto.randomUUID();
      recordRequest("GET", `/api/questions/${uuid}`, 200, 12);
    }
    expect(routeCount()).toBe(1);

    const snap = snapshot();
    expect(snap.routes).toHaveLength(1);
    expect(snap.routes[0].route).toBe("GET /api/questions/:id");
    expect(snap.routes[0].count).toBe(100);
    expect(snap.totalRequests).toBe(100);
  });

  it("label liar dari pemanggil tetap dinormalisasi di dalam recordRequest", () => {
    recordRequest("GET", "/api/questions/9f8e7d6c-5b4a-4938-8271-665544332211", 200, 5);
    recordRequest("GET", "/api/questions/:id", 200, 5);
    expect(routeCount()).toBe(1);
  });
});

describe("batas MAX_ROUTES (anti-leak)", () => {
  beforeEach(() => resetMetrics());

  it(`tak pernah melebihi ${MAX_ROUTES} label; kelebihan dieviksi`, () => {
    for (let i = 0; i < MAX_ROUTES * 3; i += 1) {
      // Rute unik yang TIDAK bisa dinormalisasi (nama statis berbeda-beda).
      recordRequest("GET", `/api/uji/rute-unik-${i}`, 200, 1);
    }
    expect(routeCount()).toBeLessThanOrEqual(MAX_ROUTES);

    const snap = snapshot();
    expect(snap.maxRoutes).toBe(MAX_ROUTES);
    expect(snap.evictedLabels).toBeGreaterThan(0);
  });

  it("rute sibuk bertahan saat eviksi (LRU by count)", () => {
    // Rute "panas" dicatat berkali-kali, sisanya sekali.
    for (let i = 0; i < MAX_ROUTES * 2; i += 1) {
      recordRequest("GET", `/api/uji/sekali-${i}`, 200, 1);
      recordRequest("GET", "/api/questions", 200, 1);
    }
    const labels = snapshot().routes.map((r) => r.route);
    expect(labels).toContain("GET /api/questions");
  });
});
