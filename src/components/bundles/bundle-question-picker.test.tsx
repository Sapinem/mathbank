import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BundleQuestionPicker } from "./bundle-question-picker";

const useQuestionsMock = vi.fn();
vi.mock("@/lib/hooks/use-questions", () => ({
  useQuestions: (params: unknown) => useQuestionsMock(params),
}));

vi.mock("@/lib/hooks/use-reference", () => ({
  useTopics: () => ({ data: [{ id: "t1", name: "Aljabar" }] }),
}));

vi.mock("@/components/math/math-content", () => ({
  MathContent: ({ content }: { content: string }) => <span>{content}</span>,
}));

describe("BundleQuestionPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQuestionsMock.mockReturnValue({
      data: {
        items: [
          {
            id: "q1",
            contentMarkdown: "Hitung $1+1$",
            questionType: "single_choice",
            topic: { name: "Aljabar" },
          },
          {
            id: "q2",
            contentMarkdown: "Hitung $2+2$",
            questionType: "single_choice",
            topic: { name: "Aritmetika" },
          },
        ],
        total: 2,
      },
      isPending: false,
    });
  });

  it("merender daftar soal dan tombol tambah", () => {
    const onAdd = vi.fn();
    render(<BundleQuestionPicker usedIds={new Set(["q1"])} onAddQuestion={onAdd} />);

    expect(screen.getByText("Hitung $1+1$")).toBeInTheDocument();
    expect(screen.getByText("Hitung $2+2$")).toBeInTheDocument();

    // q1 sudah ada di paket -> tombol disabled
    const disabledBtn = screen.getByRole("button", { name: "Soal sudah ada di paket" });
    expect(disabledBtn).toBeDisabled();

    // q2 belum ada di paket -> tombol tambah aktif
    const addBtn = screen.getByRole("button", { name: "Tambahkan soal q2 ke paket" });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledWith({ questionId: "q2" });
  });

  it("menerapkan debounce pada pencarian teks", () => {
    vi.useFakeTimers();
    render(<BundleQuestionPicker usedIds={new Set()} onAddQuestion={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Cari kata kunci soal/i);
    fireEvent.change(searchInput, { target: { value: "persamaan" } });

    // Sebelum 300ms, useQuestions belum dipanggil dengan kata kunci baru
    expect(useQuestionsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: undefined }),
    );

    // Majukan waktu 300ms
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(useQuestionsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "persamaan" }),
    );

    vi.useRealTimers();
  });
});
