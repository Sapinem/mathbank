import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionBankView } from "./question-bank-view";
import type { PublicQuestion } from "@/lib/services/question-service";

const replace = vi.fn();
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentSearch),
  usePathname: () => "/questions",
}));

const mutate = vi.fn(
  (
    _payload?: unknown,
    options?: { onSuccess?: (res: { ok: string[]; failed: unknown[] }) => void },
  ) => {
    options?.onSuccess?.({ ok: ["q1", "q2"], failed: [] });
  },
);
vi.mock("@/lib/hooks/use-questions", () => ({
  useQuestions: () => ({
    data: {
      items: [
        { id: "q1", contentMarkdown: "Soal 1", options: [], questionType: "single_choice", difficulty: 3, cognitiveLevel: "apply", grade: "11", status: "review", isFlagged: false } as unknown as PublicQuestion,
        { id: "q2", contentMarkdown: "Soal 2", options: [], questionType: "single_choice", difficulty: 3, cognitiveLevel: "apply", grade: "11", status: "review", isFlagged: false } as unknown as PublicQuestion,
      ],
      total: 2,
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useBulkQuestionAction: () => ({ mutate, isPending: false }),
}));
vi.mock("@/lib/hooks/use-reference", () => ({
  useTopics: () => ({ data: [] }),
  useTags: () => ({ data: [] }),
  useSources: () => ({ data: [] }),
  useGrades: () => ({ data: [] }),
}));

describe("QuestionBankView — bulk action bar (G3.1)", () => {
  beforeEach(() => {
    currentSearch = "";
    replace.mockClear();
    mutate.mockClear();
  });

  it("bar seleksi muncul setelah centang, lalu memanggil aksi massal", () => {
    render(<QuestionBankView />);
    // belum ada bar
    expect(screen.queryByText(/terpilih/)).not.toBeInTheDocument();
    // centang dua kotak
    const boxes = screen.getAllByLabelText(/Pilih soal/);
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    expect(screen.getByText("2 terpilih")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Setujui" }));
    expect(mutate).toHaveBeenCalledWith(
      { ids: ["q1", "q2"], action: "set_ready" },
      expect.any(Object),
    );
  });

  it("Batal membersihkan seleksi", () => {
    render(<QuestionBankView />);
    fireEvent.click(screen.getAllByLabelText(/Pilih soal/)[0]);
    expect(screen.getByText("1 terpilih")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Batal/ }));
    expect(screen.queryByText(/terpilih/)).not.toBeInTheDocument();
  });

  it("Arsipkan membuka dialog konfirmasi dan memanggil aksi setelah konfirmasi", () => {
    render(<QuestionBankView />);
    const boxes = screen.getAllByLabelText(/Pilih soal/);
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    expect(screen.getByText("2 terpilih")).toBeInTheDocument();

    // Klik tombol Arsip di bar aksi massal (label dipersingkat di MAT-55)
    fireEvent.click(screen.getByRole("button", { name: "Arsipkan" }));

    // Dialog konfirmasi harus terbuka dengan judul yang menyebutkan jumlah butir
    expect(screen.getByText("Arsipkan 2 butir soal?")).toBeInTheDocument();
    expect(
      screen.getByText(/Soal yang diarsipkan akan disembunyikan dari daftar utama/),
    ).toBeInTheDocument();

    // Mutate belum terpanggil sebelum konfirmasi
    expect(mutate).not.toHaveBeenCalled();

    // Klik Batal terlebih dahulu
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(mutate).not.toHaveBeenCalled();

    // Buka kembali dialog konfirmasi
    fireEvent.click(screen.getByRole("button", { name: "Arsipkan" }));
    expect(screen.getByText("Arsipkan 2 butir soal?")).toBeInTheDocument();

    // Klik tombol konfirmasi "Ya, Arsipkan"
    fireEvent.click(screen.getByRole("button", { name: "Ya, Arsipkan" }));
    expect(mutate).toHaveBeenCalledWith(
      { ids: ["q1", "q2"], action: "archive" },
      expect.any(Object),
    );
  });
});
