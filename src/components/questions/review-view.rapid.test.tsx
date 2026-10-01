import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewView } from "./review-view";
import type { PublicQuestion } from "@/lib/services/question-service";

const statusMutate = vi.fn();
const flagMutate = vi.fn();
vi.mock("@/lib/hooks/use-questions", () => ({
  useQuestions: () => ({
    data: {
      items: [
        q("q1", "Soal satu"),
        q("q2", "Soal dua"),
      ],
      total: 2,
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useChangeQuestionStatus: () => ({ mutate: statusMutate, isPending: false }),
  useSetQuestionFlag: () => ({ mutate: flagMutate, isPending: false }),
}));

function q(id: string, md: string): PublicQuestion {
  return {
    id,
    parentId: null,
    childOrder: 0,
    questionType: "single_choice",
    difficulty: 3,
    cognitiveLevel: "apply",
    grade: "11",
    contentMarkdown: md,
    dataPayload: {},
    status: "review",
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
    answerKey: { correct: ["A"] },
  } as unknown as PublicQuestion;
}

describe("ReviewView — Mode Kilat (G3.2)", () => {
  beforeEach(() => {
    statusMutate.mockClear();
    flagMutate.mockClear();
  });

  it("menampilkan satu kartu & navigasi berikutnya", () => {
    render(<ReviewView />);
    fireEvent.click(screen.getByRole("button", { name: /Mode Kilat/ }));
    expect(screen.getByText("Soal 1 dari 2")).toBeInTheDocument();
    expect(screen.getByText("Soal satu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Berikutnya/ }));
    expect(screen.getByText("Soal 2 dari 2")).toBeInTheDocument();
  });

  it("navigasi keyboard → (ArrowRight) berpindah soal", () => {
    render(<ReviewView />);
    fireEvent.click(screen.getByRole("button", { name: /Mode Kilat/ }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Soal 2 dari 2")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("Soal 1 dari 2")).toBeInTheDocument();
  });

  it("Setujui memanggil FSM ke ready", () => {
    render(<ReviewView />);
    fireEvent.click(screen.getByRole("button", { name: /Mode Kilat/ }));
    fireEvent.click(screen.getByRole("button", { name: /Setujui/ }));
    expect(statusMutate).toHaveBeenCalledWith("ready", expect.any(Object));
  });
});
