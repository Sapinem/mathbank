/**
 * Smoke test — memverifikasi harness test berjalan.
 */
import { describe, it, expect } from "vitest";

describe("harness", () => {
  it("menjalankan test", () => {
    expect(1 + 1).toBe(2);
  });
});
