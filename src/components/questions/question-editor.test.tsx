import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuestionEditor } from "./question-editor";
import type { PublicQuestion } from "@/lib/services/question-service";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock("@/lib/hooks/use-questions", () => ({
  useCreateQuestion: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useUpdateQuestion: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock("@/lib/hooks/use-reference", () => ({
  useGrades: () => ({
    data: [{ id: "11", label: "Kelas 11 SMA", levelGroup: "sma", curriculumPhase: "F", orderIndex: 10 }],
  }),
  useStimulusParents: () => ({
    data: [{ id: "stim-1", contentMarkdown: "Bacaan panjang tentang toko." }],
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function q(over: Partial<PublicQuestion> = {}): PublicQuestion {
  return {
    id: "q1",
    parentId: null,
    childOrder: 0,
    questionType: "single_choice",
    difficulty: 3,
    cognitiveLevel: "understand",
    grade: "11",
    contentMarkdown: "Berapa $2+2$?",
    dataPayload: {},
    status: "draft",
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
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [],
    ...over,
  } as PublicQuestion;
}

describe("QuestionEditor — G2", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  it("menampilkan field matriks saat tipe = matrix_grid (G2.1)", () => {
    renderWithClient(<QuestionEditor existing={q({ questionType: "matrix_grid" })} />);
    expect(screen.getByText("Pernyataan Matriks")).toBeInTheDocument();
    expect(screen.getByLabelText("Pernyataan 1")).toBeInTheDocument();
  });

  it("menampilkan field matching (dua kolom) saat tipe = matching (G2.1)", () => {
    renderWithClient(<QuestionEditor existing={q({ questionType: "matching" })} />);
    expect(screen.getByText("Pasangan Menjodohkan")).toBeInTheDocument();
    expect(screen.getByLabelText("Kolom Kiri (premis) item 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Kolom Kanan (respons) item 1")).toBeInTheDocument();
  });

  it("menambah baris matriks via tombol", () => {
    renderWithClient(<QuestionEditor existing={q({ questionType: "matrix_grid" })} />);
    fireEvent.click(screen.getByText("Tambah pernyataan"));
    expect(screen.getByLabelText("Pernyataan 2")).toBeInTheDocument();
  });

  it("menampilkan peringatan KaTeX saat rumus salah (G2.4)", () => {
    renderWithClient(
      <QuestionEditor existing={q({ contentMarkdown: "Hitung $\\frac{1}$" })} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/rumus tampaknya bermasalah/);
  });

  it("tidak menampilkan peringatan bila rumus valid", () => {
    renderWithClient(
      <QuestionEditor existing={q({ contentMarkdown: "Hitung $\\frac{1}{2}$" })} />,
    );
    expect(screen.queryByText(/rumus tampaknya bermasalah/)).not.toBeInTheDocument();
  });

  it("menampilkan pemilih wacana stimulus induk (G2.2)", () => {
    renderWithClient(<QuestionEditor existing={q()} />);
    expect(screen.getByLabelText("Wacana stimulus induk")).toBeInTheDocument();
  });

  it("menampilkan petunjuk rubrik kesulitan & kognitif (G2.5)", () => {
    renderWithClient(<QuestionEditor existing={q()} />);
    expect(screen.getByText("Lv.3")).toBeInTheDocument();
    expect(screen.getByText("C2")).toBeInTheDocument();
  });

  it("memulihkan draf tersimpan dari localStorage (G2.3)", () => {
    window.localStorage.setItem(
      "mathbank:qeditor:q1",
      JSON.stringify({ value: "Naskah draf lama", savedAt: 1 }),
    );
    renderWithClient(<QuestionEditor existing={q({ contentMarkdown: "Naskah asli" })} />);
    expect(screen.getByText(/Ditemukan draf tersimpan/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Pulihkan"));
    expect((screen.getByLabelText("Isi soal") as HTMLTextAreaElement).value).toBe(
      "Naskah draf lama",
    );
  });
});
