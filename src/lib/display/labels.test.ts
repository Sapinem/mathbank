import { describe, it, expect } from "vitest";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  COGNITIVE_LABELS,
  DIFFICULTY_LABELS,
  statusClass,
  difficultyClass,
} from "./labels";

describe("labels", () => {
  it("punya label lengkap untuk semua status", () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual(
      ["archived", "draft", "ready", "review"].sort(),
    );
  });

  it("punya 11 label tipe soal", () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(11);
  });

  it("punya 6 tingkat kognitif (C1–C6)", () => {
    expect(Object.keys(COGNITIVE_LABELS)).toHaveLength(6);
  });

  it("punya 5 tingkat kesulitan", () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(5);
  });

  describe("statusClass", () => {
    it("ready → biru brand", () => {
      expect(statusClass("ready")).toContain("text-brand");
    });
    it("review → emas", () => {
      expect(statusClass("review")).toContain("gold");
    });
    it("archived → netral", () => {
      expect(statusClass("archived")).toContain("muted");
    });
    it("draft (default) → netral", () => {
      expect(statusClass("draft")).toContain("muted");
    });
    it("status tak dikenal → netral (fallback)", () => {
      expect(statusClass("ntah")).toContain("muted");
    });
  });

  describe("difficultyClass", () => {
    it("≤2 → hijau (success)", () => expect(difficultyClass(1)).toContain("success"));
    it("3 → redup", () => expect(difficultyClass(3)).toContain("muted"));
    it("4 → kuning (warning)", () => expect(difficultyClass(4)).toContain("warning"));
    it("5 → merah (error)", () => expect(difficultyClass(5)).toContain("error"));
  });
});
