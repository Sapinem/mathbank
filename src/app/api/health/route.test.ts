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

/** Request tiruan untuk handler yang menerima `req`. */
const req = (url = "http://localhost/api/health") => new Request(url);

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
    const res = await GET(req());
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
    const res = await GET(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.status).toBe("degraded");
    expect(body.data.invariants.missingTriggers).toContain("trg_topics_cycle");
  });

  it("503 & status down bila DB tak terjangkau", async () => {
    mockCheck.mockRejectedValue(new Error("connection refused"));
    const res = await GET(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.status).toBe("down");
    expect(body.data.db).toBe("down");
  });

  it("?probe=liveness → 200 cepat TANPA menyentuh DB", async () => {
    const res = await GET(req("http://localhost/api/health?probe=liveness"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("ok");
    expect(typeof body.data.uptimeSec).toBe("number");
    expect(mockCheck).not.toHaveBeenCalled();
  });
  it("ACT-02: 503 tanpa membocorkan pesan DB mentah ke publik", async () => {
    mockCheck.mockRejectedValue(
      new Error(
        "password authentication failed for user \"mathbank\" host=db.internal port=5433 database=mathbank",
      ),
    );
    const res = await GET(req());
    expect(res.status).toBe(503);
    const raw = await res.text();
    // Tak ada detail driver/DSN/kredensial di body publik.
    expect(raw).not.toContain("password authentication failed");
    expect(raw).not.toContain("db.internal");
    expect(raw).not.toContain("5433");
    expect(raw).not.toContain("mathbank");
    expect(raw).not.toContain("error");
    const body = JSON.parse(raw);
    expect(body.data.status).toBe("down");
    expect(body.data.db).toBe("down");
    expect(typeof body.data.message).toBe("string");
    expect(body.data.message).toContain("tidak tersedia");
  });
});
