import { describe, it, expect } from "vitest";
import {
  aiEnrichSchema,
  aiEnrichBodySchema,
  aiEnrichBatchSchema,
  aiEmbedSchema,
} from "./ai";

/**
 * API-14: `questionId`/`questionIds` harus divalidasi sebagai UUID, bukan
 * sekadar string non-kosong. String non-UUID sebelumnya lolos boundary API dan
 * baru gagal di level kueri PostgreSQL (sintaks UUID) → 500, bukan 400.
 */
const VALID_UUID = "0191f5b8-9f2a-7000-8000-000000000001";
const VALID_UUID_2 = "0191f5b8-9f2a-7000-8000-000000000002";

describe("contracts/ai — API-14 validasi UUID", () => {
  it("aiEnrichSchema menerima UUID valid", () => {
    expect(aiEnrichSchema.parse({ questionId: VALID_UUID }).questionId).toBe(VALID_UUID);
  });

  it("aiEnrichSchema menolak string non-UUID", () => {
    expect(() => aiEnrichSchema.parse({ questionId: "not-a-uuid" })).toThrow();
    expect(() => aiEnrichSchema.parse({ questionId: "" })).toThrow();
  });

  it("aiEnrichBodySchema (single) menolak UUID palsu", () => {
    expect(() => aiEnrichBodySchema.parse({ questionId: "abc" })).toThrow();
  });

  it("aiEnrichBodySchema (batch) menerima daftar UUID & menolak non-UUID", () => {
    const ok = aiEnrichBodySchema.parse({ questionIds: [VALID_UUID, VALID_UUID_2] });
    expect(ok).toHaveProperty("questionIds");
    expect(() => aiEnrichBodySchema.parse({ questionIds: ["nope"] })).toThrow();
  });

  it("aiEnrichBatchSchema & aiEmbedSchema menolak non-UUID", () => {
    expect(() => aiEnrichBatchSchema.parse({ questionIds: ["x"] })).toThrow();
    expect(() => aiEmbedSchema.parse({ questionIds: ["x"] })).toThrow();
    expect(aiEmbedSchema.parse({ questionIds: [VALID_UUID] }).questionIds).toHaveLength(1);
  });
});
