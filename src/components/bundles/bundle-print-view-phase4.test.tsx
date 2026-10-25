import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BundlePrintView } from "./bundle-print-view";
import { MatchingView, readMatchingPayload } from "@/components/questions/matching-view";
import type { BundleDetail } from "@/lib/hooks/use-bundles";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "b1" }),
}));

const useBundleMock = vi.fn();
vi.mock("@/lib/hooks/use-bundles", () => ({
  useBundle: (id: string) => useBundleMock(id),
}));

// KaTeX dipalsukan seperti tes cetak lain; yang diuji = label & kunci cetak.
vi.mock("@/components/math/math-content", () => ({
  MathContent: ({ content }: { content: string }) => <span data-testid="math">{content}</span>,
}));

const MATCHING_PAYLOAD = {
  premises: [
    { id: "p1", contentMarkdown: "Ibu kota Jawa Barat" },
    { id: "p2", contentMarkdown: "Ibu kota Indonesia" },
  ],
  responses: [
    { id: "r1", contentMarkdown: "Jakarta" },
    { id: "r2", contentMarkdown: "Bandung" },
  ],
};
const MATRIX_PAYLOAD = {
  labels: ["Benar", "Salah"],
  rows: [
    { text: "Pernyataan satu benar", answer: "Benar" },
    { text: "Pernyataan dua salah", answer: "Salah" },
  ],
};

function item(id: string, question: Record<string, unknown>) {
  return {
    item: {
      id,
      bundleId: "b1",
      questionId: question.id as string,
      role: "question" as const,
      orderIndex: 0,
      sectionName: null,
      itemNumber: null,
      notes: null,
    },
    question: {
      id: question.id as string,
      contentMarkdown: question.contentMarkdown as string,
      questionType: question.questionType as string,
      status: "ready",
      dataPayload: question.dataPayload,
      answerKey: question.answerKey as never,
      options: [],
    },
  };
}

function bundle(): BundleDetail {
  return {
    id: "b1",
    title: "Paket Fase 4",
    bundleType: "exam",
    origin: "manual",
    sourceId: null,
    eventId: null,
    year: 2026,
    grade: "9 SMP",
    durationMinutes: 60,
    instructions: null,
    printConfig: {
      institutionName: "Math My ID",
      twoColumnLayout: false,
      includeAnswerKey: true,
      showQuestionNumber: true,
      pageSize: "A4",
    },
    status: "ready",
    createdById: "u1",
    itemCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      item("i1", {
        id: "q1",
        contentMarkdown: "Jodohkan berikut.",
        questionType: "matching",
        dataPayload: MATCHING_PAYLOAD,
        answerKey: { matchingPairs: { p1: "r2", p2: "r1" } },
      }),
      item("i2", {
        id: "q2",
        contentMarkdown: "Tentukan benar-salah.",
        questionType: "matrix_grid",
        dataPayload: MATRIX_PAYLOAD,
        answerKey: null,
      }),
    ],
  } as unknown as BundleDetail;
}

beforeEach(() => {
  useBundleMock.mockReset();
  useBundleMock.mockReturnValue({ data: bundle(), isPending: false, isError: false });
});

describe("BundlePrintView — Fase 4 (penyatuan label dengan detail)", () => {
  it("label matching cetak SAMA dengan detail: premis A/B, respons 1/2", () => {
    const { container: detail } = render(
      <MatchingView payload={readMatchingPayload(MATCHING_PAYLOAD)} />,
    );
    expect(detail.textContent).toContain("A.");
    expect(detail.textContent).toContain("1.");

    render(<BundlePrintView />);
    const sheet = document.querySelector(".print-sheet")!;
    // Premis pertama berlabel A (bukan 1), respons pertama berlabel 1 (bukan A).
    expect(sheet.textContent).toContain("A.");
    expect(sheet.textContent).toContain("B.");
    const premiseA = [...sheet.querySelectorAll("span.font-bold")].find(
      (el) => el.textContent === "A.",
    );
    expect(premiseA).toBeDefined();
  });

  it("kunci matching inline menampilkan LABEL respons, bukan ID mentah", () => {
    render(<BundlePrintView />);
    fireEvent.click(screen.getByRole("button", { name: /Tandai tebal/i }));
    const sheet = document.querySelector(".print-sheet")!;
    // p1 → r2 berarti label "2"; p2 → r1 berarti label "1".
    expect(sheet.textContent).toContain("→ 2");
    expect(sheet.textContent).toContain("→ 1");
    // ID mentah tidak boleh muncul sebagai kunci.
    expect(sheet.textContent).not.toContain("→ r1");
    expect(sheet.textContent).not.toContain("→ r2");
  });

  it("lembar kunci terpisah menampilkan pasangan label-ke-label", () => {
    render(<BundlePrintView />);
    // includeAnswerKey: true → mode default "separate".
    const keySheet = screen.getByText("Kunci Jawaban").closest("section")!;
    expect(keySheet.textContent).toContain("A→2");
    expect(keySheet.textContent).toContain("B→1");
    expect(keySheet.textContent).not.toContain("r1");
    expect(keySheet.textContent).not.toContain("r2");
  });

  it("tabel matriks cetak memakai payload detail + nomor baris yang sama", () => {
    render(<BundlePrintView />);
    const sheet = document.querySelector(".print-sheet")!;
    expect(sheet.textContent).toContain("Pernyataan satu benar");
    expect(sheet.textContent).toContain("Pernyataan dua salah");
    expect(sheet.textContent).toContain("Benar");
    expect(sheet.textContent).toContain("Salah");
    // Header No. + nomor baris 1./2. (penomoran yang sama dengan detail).
    const table = sheet.querySelector("table");
    expect(table?.textContent).toContain("No.");
  });
});
