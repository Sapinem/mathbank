import { describe, it, expect } from "vitest";
import {
  matchingKeySummary,
  matchingResponseLabel,
  premiseLabel,
  responseLabel,
} from "./matching-labels";
import type { MatchingItem } from "./matching-view";

const responses: MatchingItem[] = [
  { id: "r1", contentMarkdown: "Jakarta" },
  { id: "r2", contentMarkdown: "Bandung" },
  { id: "r3", contentMarkdown: "Surabaya" },
];
const premises: MatchingItem[] = [
  { id: "p1", contentMarkdown: "Ibu kota Jawa Barat" },
  { id: "p2", contentMarkdown: "Ibu kota Indonesia" },
];

describe("matching-labels (Fase 4 — satu sumber label detail & cetak)", () => {
  it("premis memakai huruf, respons memakai angka", () => {
    expect([premiseLabel(0), premiseLabel(1), premiseLabel(2)]).toEqual(["A", "B", "C"]);
    expect([responseLabel(0), responseLabel(1), responseLabel(2)]).toEqual(["1", "2", "3"]);
  });

  it("kunci pasangan mengembalikan LABEL respons, bukan ID mentah", () => {
    // p1 dipasangkan ke r2 (id mentah "r2") → labelnya "2", bukan "r2".
    expect(matchingResponseLabel({ p1: "r2" }, "p1", responses)).toBe("2");
    expect(matchingResponseLabel({ p2: "r1" }, "p2", responses)).toBe("1");
  });

  it("pasangan tak terpetakan mengembalikan null, bukan menebak", () => {
    expect(matchingResponseLabel({ p1: "r99" }, "p1", responses)).toBeNull();
    expect(matchingResponseLabel({}, "p1", responses)).toBeNull();
    expect(matchingResponseLabel(null, "p1", responses)).toBeNull();
  });

  it("ringkasan kunci lembar terpisah berbentuk label-ke-label", () => {
    expect(matchingKeySummary({ p1: "r2", p2: "r1" }, premises, responses)).toBe("A→2, B→1");
  });

  it("ringkasan melewati premis tanpa pasangan terpetakan", () => {
    expect(matchingKeySummary({ p1: "r2" }, premises, responses)).toBe("A→2");
  });
});
