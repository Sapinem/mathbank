import { describe, it, expect } from "vitest";
import {
  canonicalQuestionItemSchema,
  canonicalIngestBatchSchema,
  canonicalIngestReportSchema,
} from "./ingest-canonical";

describe("canonicalIngestSchema (U1)", () => {
  const validSingleChoiceItem = {
    type: "single_choice",
    stem: "Berapa nilai dari $2 + 2$?",
    dataPayload: {
      type: "multiple_choice",
      options: [
        { id: "A", contentMarkdown: "$3$" },
        { id: "B", contentMarkdown: "$4$" },
      ],
    },
    answerKey: {
      correctOptionIds: "B",
      explanationMarkdown: "Penjumlahan $2 + 2 = 4$.",
    },
  };

  it("menerima item single choice yang valid", () => {
    const res = canonicalQuestionItemSchema.safeParse(validSingleChoiceItem);
    expect(res.success).toBe(true);
  });

  it("menolak item jika stem kosong", () => {
    const invalid = { ...validSingleChoiceItem, stem: "" };
    const res = canonicalQuestionItemSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("menolak opsi jika mengandung frasa terlarang Haladyna Rule 5", () => {
    const invalid = {
      ...validSingleChoiceItem,
      dataPayload: {
        type: "multiple_choice",
        options: [
          { id: "A", contentMarkdown: "$3$" },
          { id: "B", contentMarkdown: "Semua jawaban di atas benar" },
        ],
      },
    };
    const res = canonicalQuestionItemSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("menerima batch valid dengan metadata source dan bundle", () => {
    const validBatch = {
      source: {
        name: "mathcyber",
        url: "https://mathcyber1997.com",
      },
      bundle: {
        title: "Soal Ujian Matematika 2024",
        url: "https://mathcyber1997.com/soal-2024",
        grade: "12",
      },
      items: [validSingleChoiceItem],
    };
    const res = canonicalIngestBatchSchema.safeParse(validBatch);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.items).toHaveLength(1);
    }
  });

  it("menolak batch jika items kosong atau melebihi 50 butir", () => {
    const emptyBatch = {
      source: { name: "mathcyber" },
      bundle: { title: "Soal Kosong" },
      items: [],
    };
    expect(canonicalIngestBatchSchema.safeParse(emptyBatch).success).toBe(false);

    const oversizedBatch = {
      source: { name: "mathcyber" },
      bundle: { title: "Soal Banyak" },
      items: Array(51).fill(validSingleChoiceItem),
    };
    expect(canonicalIngestBatchSchema.safeParse(oversizedBatch).success).toBe(false);
  });

  it("memvalidasi struktur canonicalIngestReportSchema", () => {
    const validReport = {
      bundleId: "123e4567-e89b-12d3-a456-426614174000",
      totalReceived: 2,
      created: 1,
      linked: 0,
      rejectedCount: 1,
      failures: [
        {
          index: 1,
          stemPreview: "Soal cacat...",
          reason: "KaTeX error",
        },
      ],
      questionIds: ["123e4567-e89b-12d3-a456-426614174001"],
    };
    const res = canonicalIngestReportSchema.safeParse(validReport);
    expect(res.success).toBe(true);
  });
});
