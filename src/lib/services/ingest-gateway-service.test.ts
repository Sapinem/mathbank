import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { evaluateCanonicalItemQuality } from "./ingest-gateway-service";
import type { CanonicalQuestionItem } from "@/lib/contracts/ingest-canonical";

describe("evaluateCanonicalItemQuality (U2)", () => {
  const baseValidItem: CanonicalQuestionItem = {
    type: "single_choice",
    stem: "Hitunglah nilai $x$ jika $x + 2 = 5$.",
    dataPayload: {
      type: "multiple_choice",
      options: [
        { id: "A", contentMarkdown: "$x = 2$" },
        { id: "B", contentMarkdown: "$x = 3$" },
      ],
    },
    answerKey: {
      correctOptionIds: "B",
      explanationMarkdown: "Pindahkan konstanta: $x = 5 - 2 = 3$.",
    },
  };

  it("lolos untuk butir soal dengan KaTeX dan teks valid", () => {
    const res = evaluateCanonicalItemQuality(baseValidItem);
    expect(res.ok).toBe(true);
  });

  it("gagal jika stem memuat KaTeX rusak / tidak seimbang (CONSTRAINTS #29)", () => {
    const invalidItem: CanonicalQuestionItem = {
      ...baseValidItem,
      stem: "Tentukan nilai dari $\\frac{1}{2$", // kurang kurung tutup
    };
    const res = evaluateCanonicalItemQuality(invalidItem);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain("KaTeX");
    }
  });

  it("gagal jika opsi memuat KaTeX rusak", () => {
    const invalidItem: CanonicalQuestionItem = {
      ...baseValidItem,
      dataPayload: {
        type: "multiple_choice",
        options: [
          { id: "A", contentMarkdown: "$\\sqrt{4 = 2$" }, // kurang kurung tutup
          { id: "B", contentMarkdown: "$3$" },
        ],
      },
    };
    const res = evaluateCanonicalItemQuality(invalidItem);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain("KaTeX");
    }
  });

  it("gagal jika pembahasan memuat KaTeX rusak", () => {
    const invalidItem: CanonicalQuestionItem = {
      ...baseValidItem,
      answerKey: {
        correctOptionIds: "B",
        explanationMarkdown: "Rumus $x = \\frac{a}{b$", // rusak
      },
    };
    const res = evaluateCanonicalItemQuality(invalidItem);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain("KaTeX");
    }
  });
});
