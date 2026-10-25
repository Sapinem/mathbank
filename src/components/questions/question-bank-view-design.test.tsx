import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionBankView } from "./question-bank-view";

// ── Mock navigasi & hook data — pola yang sama dengan question-bank-view.test.tsx ──
const replace = vi.fn();
const routerMock = { replace, push: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

let currentSearch = "";

const useQuestionsMock = vi.fn();
const useTopicsMock = vi.fn((): { data: unknown[] } => ({ data: [] }));
const useSourcesMock = vi.fn((): { data: unknown[] } => ({ data: [] }));
const useGradesMock = vi.fn((): { data: unknown[] } => ({ data: [] }));
vi.mock("@/lib/hooks/use-questions", () => ({
  useQuestions: (q: unknown) => useQuestionsMock(q),
  useBulkQuestionAction: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/hooks/use-reference", () => ({
  useTopics: () => useTopicsMock(),
  useSources: () => useSourcesMock(),
  useGrades: () => useGradesMock(),
}));

function dataState(over: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, error: null, ...over };
}

beforeEach(() => {
  currentSearch = "";
  replace.mockReset();
  useQuestionsMock.mockReset();
  useQuestionsMock.mockReturnValue(dataState({ isLoading: true }));
  useTopicsMock.mockReturnValue({ data: [] });
  useSourcesMock.mockReturnValue({ data: [] });
  useGradesMock.mockReturnValue({ data: [] });
});

describe("QuestionBankView — perbaikan desain prioritas", () => {
  it("judul halaman h1 Bank Soal terlihat di atas toolbar", () => {
    render(<QuestionBankView />);
    const heading = screen.getByRole("heading", { name: "Bank Soal", level: 1 });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("Cari, saring, dan kelola soal.")).toBeInTheDocument();
  });

  it("saat memuat, jumlah tidak ditampilkan sebagai 0 soal", () => {
    useQuestionsMock.mockReturnValue(dataState({ isLoading: true }));
    render(<QuestionBankView />);
    expect(screen.queryByText("0 soal")).not.toBeInTheDocument();
    expect(screen.getByText("Memuat…")).toBeInTheDocument();
  });

  it("saat data tiba, jumlah nyata ditampilkan (bukan Memuat…)", () => {
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [], total: 7 } }));
    render(<QuestionBankView />);
    expect(screen.getByText("7 soal")).toBeInTheDocument();
  });

  it("tombol Hapus pencarian langsung mengirim pencarian kosong", () => {
    currentSearch = "q=aljabar";
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [], total: 0 } }));
    render(<QuestionBankView />);
    const input = screen.getByLabelText("Cari soal") as HTMLInputElement;
    expect(input.value).toBe("aljabar");
    fireEvent.click(screen.getByLabelText("Hapus pencarian"));
    // Kotak dikosongkan DAN URL pencarian dihapus (bukan hanya state lokal).
    expect(input.value).toBe("");
    expect(replace).toHaveBeenCalled();
    const url = replace.mock.calls[0][0] as string;
    expect(url).not.toContain("q=");
    expect(url.startsWith("/questions")).toBe(true);
  });

  it("state kosong dengan filter aktif menampilkan tombol Reset filter", () => {
    currentSearch = "status=ready";
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [], total: 0 } }));
    render(<QuestionBankView />);
    const reset = screen.getByRole("button", { name: "Reset filter" });
    expect(reset).toBeInTheDocument();
    fireEvent.click(reset);
    const url = replace.mock.calls[0][0] as string;
    expect(url).not.toContain("status=");
  });

  it("state kosong tanpa filter tidak menampilkan tombol Reset filter", () => {
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [], total: 0 } }));
    render(<QuestionBankView />);
    expect(screen.queryByRole("button", { name: "Reset filter" })).not.toBeInTheDocument();
    expect(screen.getByText(/Belum ada soal/)).toBeInTheDocument();
  });

  it("tombol Buat Soal punya aria-label di semua lebar", () => {
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [], total: 0 } }));
    const { container } = render(<QuestionBankView />);
    // Nama aksesibel eksplisit pada tautan (label teks disembunyikan di <sm).
    expect(container.querySelector('a[aria-label="Buat Soal"]')).not.toBeNull();
  });
});
