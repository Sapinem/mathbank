import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Actor } from "@/lib/auth/actor";

let mockActor: Actor | null = {
  id: "machine-1",
  name: "Mesin Test",
  roles: ["machine"],
  via: "apikey",
};

vi.mock("@/lib/auth/resolve", () => ({
  resolveActor: async () => mockActor,
}));

vi.mock("@/lib/services/ingest-gateway-service", () => ({
  ingestCanonicalBatch: vi.fn(async (input) => ({
    bundleId: "123e4567-e89b-12d3-a456-426614174000",
    totalReceived: input.items.length,
    created: input.items.length,
    linked: 0,
    rejectedCount: 0,
    failures: [],
    questionIds: ["123e4567-e89b-12d3-a456-426614174001"],
  })),
}));

vi.mock("@/lib/db", () => ({ db: {} }));

const { POST } = await import("./route");

function makeReq(body?: unknown): Request {
  return new Request("http://localhost:3000/api/ingest/questions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "test-key-1",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/ingest/questions (U3)", () => {
  beforeEach(() => {
    mockActor = {
      id: "machine-1",
      name: "Mesin Test",
      roles: ["machine"],
      via: "apikey",
    };
  });

  const validBatch = {
    source: { name: "mathcyber", url: "https://mathcyber1997.com" },
    bundle: { title: "Soal Ujian 2024", grade: "12" },
    items: [
      {
        type: "single_choice",
        stem: "Berapa $1 + 1$?",
        dataPayload: {
          type: "multiple_choice",
          options: [
            { id: "A", contentMarkdown: "$1$" },
            { id: "B", contentMarkdown: "$2$" },
          ],
        },
        answerKey: {
          correctOptionIds: "B",
          explanationMarkdown: "Penjelasan.",
        },
      },
    ],
  };

  it("mengembalikan 401 jika unauthenticated", async () => {
    mockActor = null;
    const res = await POST(makeReq(validBatch));
    expect(res.status).toBe(401);
  });

  it("mengembalikan 400 jika body invalid (misal items kosong)", async () => {
    const invalidBatch = { ...validBatch, items: [] };
    const res = await POST(makeReq(invalidBatch));
    expect(res.status).toBe(400);
  });

  it("mengembalikan 200 dengan data laporan jika payload valid", async () => {
    const res = await POST(makeReq(validBatch));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { created: number } };
    expect(json.data.created).toBe(1);
  });
});
