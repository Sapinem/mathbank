import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionCard } from "./question-card";
import type { PublicQuestion } from "@/lib/services/question-service";

/** Soal uji minimal (hanya field yang dirender kartu). */
function q(over: Partial<PublicQuestion> = {}): PublicQuestion {
  return {
    id: "q1",
    parentId: null,
    childOrder: 0,
    questionType: "single_choice",
    difficulty: 3,
    cognitiveLevel: "understand",
    grade: "SMA-11",
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

describe("QuestionCard", () => {
  it("menampilkan status, tipe, grade, kesulitan (label manusia)", () => {
    const { container } = render(<QuestionCard question={q()} href="/bank-soal/q1" />);
    expect(screen.getByText("Draf")).toBeInTheDocument();
    // grade dirender sebagai "· SMA-11" dalam satu span
    expect(container.textContent).toContain("SMA-11");
    expect(container.textContent).toContain("Sedang"); // difficulty 3
  });

  it("tautan ke href yang diberikan", () => {
    render(<QuestionCard question={q()} href="/bank-soal/q1" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/bank-soal/q1");
  });

  it("menampilkan ikon 'Ditandai' hanya saat flagged", () => {
    const { rerender } = render(<QuestionCard question={q({ isFlagged: false })} href="/x" />);
    expect(screen.queryByLabelText("Ditandai")).not.toBeInTheDocument();
    rerender(<QuestionCard question={q({ isFlagged: true })} href="/x" />);
    expect(screen.getByLabelText("Ditandai")).toBeInTheDocument();
  });

  it("checkbox seleksi hanya muncul bila onToggleSelect diberi", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<QuestionCard question={q()} href="/x" />);
    expect(screen.queryByLabelText("Pilih soal")).not.toBeInTheDocument();
    rerender(<QuestionCard question={q()} href="/x" onToggleSelect={onToggle} />);
    const cb = screen.getByLabelText("Pilih soal");
    expect(cb).toBeInTheDocument();
    // klik → memanggil callback dengan id soal
    cb.click();
    expect(onToggle).toHaveBeenCalledWith("q1");
  });

  it("kartu terpilih diberi latar brand", () => {
    const { container } = render(
      <QuestionCard question={q()} href="/x" selected onToggleSelect={() => {}} />,
    );
    expect(container.firstChild).toHaveClass("bg-brand/5");
  });

  it("menandai opsi benar dengan warna sukses (isCorrect)", () => {
    const withOpts = q({
      options: [
        { id: "o1", questionId: "q1", label: "A", contentMarkdown: "3", isCorrect: false, distractorRationale: null, orderIndex: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: "o2", questionId: "q1", label: "B", contentMarkdown: "4", isCorrect: true, distractorRationale: null, orderIndex: 1, createdAt: new Date(), updatedAt: new Date() },
      ],
    } as Partial<PublicQuestion>);
    const { container } = render(<QuestionCard question={withOpts} href="/x" />);
    // Pembungkus opsi = <span> yang berisi <strong>B.</strong>
    const optB = Array.from(container.querySelectorAll("strong"))
      .find((s) => s.textContent === "B.")
      ?.closest("span");
    const optA = Array.from(container.querySelectorAll("strong"))
      .find((s) => s.textContent === "A.")
      ?.closest("span");
    expect(optB?.className).toContain("text-success");
    expect(optA?.className).not.toContain("text-success");
  });

  it("soal TANPA options tidak menampilkan baris opsi", () => {
    const { container } = render(<QuestionCard question={q({ options: [] })} href="/x" />);
    // hanya konten soal; tak ada label A./B.
    expect(container.textContent).not.toMatch(/\bA\./);
  });

  it("memangkas konten panjang (>180 karakter) dengan elipsis", () => {
    const long = "x".repeat(300);
    render(<QuestionCard question={q({ contentMarkdown: long })} href="/x" />);
    expect(screen.getByText(/…/)).toBeInTheDocument();
  });
});
