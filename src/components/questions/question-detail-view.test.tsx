import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionDetailView } from "./question-detail-view";
import type { PublicQuestion } from "@/lib/services/question-service";

// ── Mock navigasi Next.js ──
const routerMock = { push: vi.fn(), refresh: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "q-123" }),
  useRouter: () => routerMock,
}));

// ── Mock data hook ──
const useQuestionMock = vi.fn();
const useDeleteQuestionMock = vi.fn();
const useChangeQuestionStatusMock = vi.fn();

vi.mock("@/lib/hooks/use-questions", () => ({
  useQuestion: (id: string) => useQuestionMock(id),
  useDeleteQuestion: () => useDeleteQuestionMock(),
  useChangeQuestionStatus: () => useChangeQuestionStatusMock(),
}));

// ── Mock hook bundles untuk AddToBundleDialog ──
vi.mock("@/lib/hooks/use-bundles", () => ({
  useBundles: () => ({ data: [], isPending: false }),
  useAddBundleItem: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

// ── Mock KaTeX ──
vi.mock("@/components/math/math-content", () => ({
  MathContent: ({ content }: { content: string }) => <span data-testid="math">{content}</span>,
}));

// ── Mock EnrichButton ──
vi.mock("@/components/questions/enrich-button", () => ({
  EnrichButton: () => <button type="button">Pengayaan AI</button>,
}));

function mockQuestion(over: Partial<PublicQuestion> = {}): PublicQuestion {
  return {
    id: "q-123",
    version: 1,
    parentId: null,
    childOrder: 0,
    questionType: "single_choice",
    difficulty: 3,
    cognitiveLevel: "understand",
    grade: "10",
    grades: ["10"],
    contentMarkdown: "Berapa nilai dari $2x + 1 = 5$?",
    dataPayload: {},
    status: "ready",
    isFlagged: false,
    flagNotes: null,
    sourceId: null,
    eventId: null,
    eventYear: null,
    eventSubtest: null,
    eventItemNumber: null,
    eventNotes: null,
    authorId: "u1",
    lastReviewedAt: null,
    deletedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    options: [
      {
        id: "o1",
        questionId: "q-123",
        label: "A",
        contentMarkdown: "2",
        isCorrect: true,
        distractorRationale: null,
        orderIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "o2",
        questionId: "q-123",
        label: "B",
        contentMarkdown: "3",
        isCorrect: false,
        distractorRationale: "Salah hitung",
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    answerKey: {
      correct: ["A"],
      text: "x = 2",
      explanation: "Kurangkan kedua ruas dengan 1 lalu bagi 2.",
    },
    solutions: [],
    bundles: [],
    topics: [],
    ...over,
  } as PublicQuestion;
}

beforeEach(() => {
  useDeleteQuestionMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useChangeQuestionStatusMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("QuestionDetailView", () => {
  it("merender tombol navigasi kembali ke Bank Soal di PageHeader", () => {
    useQuestionMock.mockReturnValue({ data: mockQuestion(), isLoading: false, isError: false });
    render(<QuestionDetailView />);

    const backBtn = screen.getByRole("button", { name: /Bank Soal/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveAttribute("href", "/questions");
  });

  it("selalu menampilkan baris Status di kartu Klasifikasi meskipun status 'ready'", () => {
    useQuestionMock.mockReturnValue({
      data: mockQuestion({ status: "ready" }),
      isLoading: false,
      isError: false,
    });
    render(<QuestionDetailView />);

    expect(screen.getByText("Klasifikasi Soal")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getAllByText("Siap").length).toBeGreaterThan(0);
  });

  it("menampilkan teks nama tipe soal di samping ikon pada kartu Klasifikasi", () => {
    useQuestionMock.mockReturnValue({
      data: mockQuestion({ questionType: "single_choice" }),
      isLoading: false,
      isError: false,
    });
    render(<QuestionDetailView />);

    expect(screen.getByText("Tipe Soal")).toBeInTheDocument();
    expect(screen.getAllByText("Pilihan Ganda").length).toBeGreaterThan(0);
  });

  it("merender badge Kunci jawaban semantik pada opsi yang benar", () => {
    useQuestionMock.mockReturnValue({ data: mockQuestion(), isLoading: false, isError: false });
    render(<QuestionDetailView />);

    expect(screen.getAllByText("Kunci").length).toBeGreaterThan(0);
  });

  it("merender Fallback '-' bukan '—' pada kartu Asal-Usul saat naskah ada namun jenis/tahun kosong", () => {
    useQuestionMock.mockReturnValue({
      data: mockQuestion({
        bundles: [
          {
            id: "b1",
            title: "Paket Latihan",
            bundleType: "exam",
            sourceKind: null,
            year: null,
            url: null,
            grade: null,
            sourceId: null,
            sourceLabel: null,
            itemNumber: null,
            role: "question" as const,
            sectionName: null,
            status: "ready",
          },
        ],
      }),
      isLoading: false,
      isError: false,
    });
    const { container } = render(<QuestionDetailView />);

    expect(screen.getByText("Paket Latihan")).toBeInTheDocument();
    expect(container.textContent).not.toContain("—");
    const yearValue = screen.getByText("Tahun").nextElementSibling;
    expect(yearValue).toHaveTextContent("-");
  });

  it("merender FlagIndicator ber-border saat soal ditandai (isFlagged: true)", () => {
    useQuestionMock.mockReturnValue({
      data: mockQuestion({ isFlagged: true }),
      isLoading: false,
      isError: false,
    });
    render(<QuestionDetailView />);

    expect(screen.getByLabelText("Ditandai")).toBeInTheDocument();
  });
});
