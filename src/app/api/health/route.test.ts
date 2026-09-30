import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tes /api/health — pastikan:
 *  - 200 saat invarian utuh,
 *  - 503 saat invarian rusak (trigger hilang),
 *  - 503 saat DB tak terjangkau.
 * Modul invarian di-mock agar tes murni (tanpa DB).
 */
vi.mock("@/lib/db/invariants", () => ({
  checkDbInvariants: vi.fn(),
}));

import { checkDbInvariants } from "@/lib/db/invariants";
import { GET } from "./route";

const mockCheck = vi.mocked(checkDbInvariants);

const healthy = {
  ok: true,
  counts: { tables: 27, checkConstraints: 2, hnswIndexes: 1, triggers: 26 },
  missingTriggers: [],
  missingChecks: [],
  pkUsesUuidv7: true,
  problems: [],
};

beforeEach(() => {
  mockCheck.mockReset();
});

describe("GET /api/health", () => {
  it("200 & status ok bila invarian utuh", async () => {
    mockCheck.mockResolvedValue(healthy);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("ok");
    expect(body.data.db).toBe("up");
    expect(body.data.invariants.ok).toBe(true);
  });

  it("503 & status degraded bila invarian rusak", async () => {
    mockCheck.mockResolvedValue({
      ...healthy,
      ok: false,
      counts: { ...healthy.counts, triggers: 10 },
      missingTriggers: ["trg_topics_cycle"],
      problems: ["triggers: 10 < 26", "TRIGGER hilang: trg_topics_cycle"],
    });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.status).toBe("degraded");
    expect(body.data.invariants.missingTriggers).toContain("trg_topics_cycle");
  });

  it("503 & status down bila DB tak terjangkau", async () => {
    mockCheck.mockRejectedValue(new Error("connection refused"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.status).toBe("down");
    expect(body.data.db).toBe("down");
  });
});
