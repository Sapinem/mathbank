import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tes /api/ready — kontrak readiness probe.
 *
 * Dua hal yang dikunci di sini:
 *  1. status 503 saat invarian rusak,
 *  2. jalur gagal TIDAK membocorkan `err.message` mentah ke publik
 *     (ACT-02). Sebelumnya probe ini mengembalikan pesan driver apa adanya,
 *     lengkap dengan host/port/user database.
 */
vi.mock("@/lib/db/invariants", () => ({
  checkDbInvariants: vi.fn(),
}));

import { checkDbInvariants } from "@/lib/db/invariants";
import { setStore, MemoryStore, HEALTH_POLICY } from "@/lib/api/rate-limit";
import { GET } from "./route";

const mockCheck = vi.mocked(checkDbInvariants);

const sehat = {
  ok: true,
  counts: { tables: 26, checkConstraints: 2, hnswIndexes: 1, triggers: 24 },
  missingTriggers: [],
  missingChecks: [],
  forbiddenTablesPresent: [],
  pkUsesUuidv7: true,
  problems: [],
};

beforeEach(() => {
  mockCheck.mockReset();
  setStore(new MemoryStore());
});

const req = () => new Request("http://localhost/api/ready");

describe("GET /api/ready", () => {
  it("200 & status ready bila invarian utuh", async () => {
    mockCheck.mockResolvedValue(sehat);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("ready");
    expect(body.data.invariants.ok).toBe(true);
  });

  it("503 saat tabel terlarang masih ada", async () => {
    mockCheck.mockResolvedValue({
      ...sehat,
      ok: false,
      forbiddenTablesPresent: ["question_options"],
      problems: ["Tabel terlarang masih ada: question_options"],
    });
    const res = await GET(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.status).toBe("degraded");
    expect(body.data.invariants.forbiddenTablesPresent).toEqual(["question_options"]);
  });

  it("Fase 3: 429 + Retry-After setelah burst HEALTH_POLICY terlampaui, DB tak lagi dipanggil", async () => {
    mockCheck.mockResolvedValue(sehat);
    let last: Response | null = null;
    for (let i = 0; i < HEALTH_POLICY.capacity + 1; i++) {
      last = await GET(req());
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get("Retry-After")).toBeTruthy();
    const body = await last!.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(mockCheck).toHaveBeenCalledTimes(HEALTH_POLICY.capacity);
  });

  it("tidak membocorkan pesan driver saat DB tak terjangkau", async () => {
    mockCheck.mockRejectedValue(
      new Error("connect ECONNREFUSED 127.0.0.1:5433 user=mathbank database=mathbank"),
    );
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const raw = await res.text();
    expect(raw).not.toContain("ECONNREFUSED");
    expect(raw).not.toContain("5433");
    expect(raw).not.toContain("mathbank");
    const body = JSON.parse(raw);
    expect(body.data.status).toBe("down");
    expect(body.data.message).toBe("Layanan basis data tidak tersedia.");
    expect(body.data.error).toBeUndefined();
  });
});
