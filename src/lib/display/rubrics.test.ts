import { describe, it, expect } from "vitest";
import {
  COGNITIVE_RUBRICS,
  DIFFICULTY_RUBRICS,
  cognitiveRubric,
  difficultyRubric,
} from "./rubrics";

describe("rubrik pedagogis", () => {
  it("punya 6 level kognitif (C1–C6) dan 5 tingkat kesulitan", () => {
    expect(Object.keys(COGNITIVE_RUBRICS)).toHaveLength(6);
    expect(Object.keys(DIFFICULTY_RUBRICS)).toHaveLength(5);
  });

  it("kode kognitif berurut C1..C6", () => {
    const codes = [
      "remember",
      "understand",
      "apply",
      "analyze",
      "evaluate",
      "create",
    ].map((l) => cognitiveRubric(l).code);
    expect(codes).toEqual(["C1", "C2", "C3", "C4", "C5", "C6"]);
  });

  it("kode kesulitan Lv.1..Lv.5 dengan deskripsi non-kosong", () => {
    for (let i = 1; i <= 5; i++) {
      const r = difficultyRubric(i);
      expect(r.code).toBe(`Lv.${i}`);
      expect(r.description.length).toBeGreaterThan(10);
    }
  });

  it("fallback aman untuk level tak dikenal", () => {
    expect(cognitiveRubric("unknown").code).toBe("—");
    expect(difficultyRubric(99).code).toBe("Lv.99");
  });
});
