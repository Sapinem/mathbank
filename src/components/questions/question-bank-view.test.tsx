import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionBankView } from "./question-bank-view";
import type { PublicQuestion } from "@/lib/services/question-service";

// ── Mock navigasi (URL = sumber kebenaran filter) ──
const replace = vi.fn();
const routerMock = { replace, push: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

/** Query string "URL" saat ini — diubah per-tes. */
let currentSearch = "";

// ── Mock hook data ──
const useQuestionsMock = vi.fn();
const useTopicsMock = vi.fn((): { data: unknown[] } => ({ data: [] }));
const useSourcesMock = vi.fn((): { data: unknown[] } => ({ data: [] }));
vi.mock("@/lib/hooks/use-questions", () => ({
  useQuestions: (q: unknown) => useQuestionsMock(q),
}));
vi.mock("@/lib/hooks/use-reference", () => ({
  useTopics: () => useTopicsMock(),
  useSources: () => useSourcesMock(),
}));

/**
 * Radix `Select` sulit diuji di jsdom (butuh pointer events + portal).
 * Diganti `<select>` polos agar handler onChange filter benar-benar tercakup —
 * yang diuji adalah LOGIKA filter, bukan Radix-nya (vendor).
 */
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select data-testid="filter-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

function q(id: string): PublicQuestion {
  return {
    id,
    parentId: null,
    childOrder: 0,
    questionType: "single_choice",
    difficulty: 3,
    cognitiveLevel: "understand",
    grade: "SMA-11",
    contentMarkdown: `Soal ${id}`,
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
  } as PublicQuestion;
}

/** Hasil `useQuestions` tiruan. */
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
});

describe("QuestionBankView — keadaan render", () => {
  it("menampilkan LoadingState saat memuat", () => {
    render(<QuestionBankView />);
    expect(screen.getByText("Memuat soal…")).toBeInTheDocument();
  });

  it("menampilkan ErrorState saat gagal (dengan pesan)", () => {
    useQuestionsMock.mockReturnValue(
      dataState({ isError: true, error: new Error("Boom") }),
    );
    render(<QuestionBankView />);
    expect(screen.getByText("Gagal memuat soal")).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("EmptyState tanpa filter: ajakan buat soal pertama", () => {
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [], total: 0 } }));
    render(<QuestionBankView />);
    expect(screen.getByText("Tidak ada soal")).toBeInTheDocument();
    expect(screen.getByText(/Belum ada soal/)).toBeInTheDocument();
  });

  it("EmptyState DENGAN filter: saran reset filter", () => {
    currentSearch = "status=ready";
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [], total: 0 } }));
    render(<QuestionBankView />);
    expect(screen.getByText(/Tidak ada soal yang cocok dengan filter/)).toBeInTheDocument();
  });

  it("merender kartu soal saat ada data + jumlah total", () => {
    useQuestionsMock.mockReturnValue(
      dataState({ data: { items: [q("a"), q("b")], total: 2 } }),
    );
    render(<QuestionBankView />);
    expect(screen.getByText("Soal a")).toBeInTheDocument();
    expect(screen.getByText("Soal b")).toBeInTheDocument();
    expect(screen.getByText("2 soal")).toBeInTheDocument();
  });
});

describe("QuestionBankView — pencarian & filter (URL = sumber kebenaran)", () => {
  beforeEach(() => {
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [], total: 0 } }));
  });

  it("submit pencarian → router.replace dengan q URL-encoded", () => {
    render(<QuestionBankView />);
    const input = screen.getByPlaceholderText("Cari soal…");
    fireEvent.change(input, { target: { value: "turunan" } });
    fireEvent.submit(input.closest("form")!);
    expect(replace).toHaveBeenCalledWith("/questions?q=turunan");
  });

  it("pencarian kosong → q dihapus dari URL", () => {
    render(<QuestionBankView />);
    const input = screen.getByPlaceholderText("Cari soal…");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(replace).toHaveBeenCalledWith("/questions?");
  });

  it("tombol Reset muncul HANYA saat ada filter aktif", () => {
    const { unmount } = render(<QuestionBankView />);
    expect(screen.queryByText(/Reset/)).not.toBeInTheDocument();
    unmount();

    currentSearch = "status=ready&difficulty=3";
    render(<QuestionBankView />);
    expect(screen.getByText(/Reset \(2\)/)).toBeInTheDocument();
  });

  it("klik Reset → kembali ke /questions polos", () => {
    currentSearch = "status=ready";
    render(<QuestionBankView />);
    fireEvent.click(screen.getByText(/Reset/));
    expect(replace).toHaveBeenCalledWith("/questions");
  });

  it("filter dari URL diteruskan ke query hook (limit & offset)", () => {
    currentSearch = "q=abc&status=ready&page=2";
    render(<QuestionBankView />);
    expect(useQuestionsMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: "abc", status: "ready", limit: 20, offset: 40 }),
    );
  });

  it("mengubah filter Status → menulis ke URL", () => {
    render(<QuestionBankView />);
    const selects = screen.getAllByTestId("filter-select");
    // urutan: Status, Tipe Soal, Kesulitan, Topik, Sumber
    fireEvent.change(selects[0], { target: { value: "ready" } });
    expect(replace).toHaveBeenCalledWith("/questions?status=ready");
  });

  it("memilih 'Semua' pada filter → menghapus param", () => {
    currentSearch = "status=ready";
    render(<QuestionBankView />);
    const selects = screen.getAllByTestId("filter-select");
    fireEvent.change(selects[0], { target: { value: "all" } });
    expect(replace).toHaveBeenCalledWith("/questions?");
  });

  it("filter Kesulitan menerima nilai numerik", () => {
    render(<QuestionBankView />);
    const selects = screen.getAllByTestId("filter-select");
    fireEvent.change(selects[2], { target: { value: "4" } });
    expect(replace).toHaveBeenCalledWith("/questions?difficulty=4");
  });

  it("opsi Topik & Sumber berasal dari hook referensi", () => {
    useTopicsMock.mockReturnValue({ data: [{ id: "t1", name: "Aljabar", slug: "aljabar", parentId: null, level: 1 }] });
    useSourcesMock.mockReturnValue({ data: [{ id: "s1", kind: "book", label: "Buku A", slug: "buku-a" }] });
    render(<QuestionBankView />);
    expect(screen.getByRole("option", { name: "Aljabar" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Buku A" })).toBeInTheDocument();
  });
});

describe("QuestionBankView — panel filter mobile (Sheet)", () => {
  beforeEach(() => {
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [], total: 0 } }));
  });

  it("tombol 'Buka filter' membuka Sheet lalu 'Terapkan' menutupnya", () => {
    render(<QuestionBankView />);
    const openBtn = screen.getByLabelText("Buka filter");
    fireEvent.click(openBtn);
    // Sheet ter-render (judul "Filter" muncul)
    expect(screen.getAllByText("Filter").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Terapkan"));
    // tak melempar — tertutup
    expect(openBtn).toBeInTheDocument();
  });

  it("badge jumlah filter aktif muncul di tombol filter mobile", () => {
    currentSearch = "status=ready&grade=SMA-11";
    render(<QuestionBankView />);
    // activeCount = 2 → badge "2"
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("QuestionBankView — paginasi", () => {
  beforeEach(() => {
    useQuestionsMock.mockReturnValue(
      dataState({ data: { items: [q("a")], total: 45 } }), // 3 halaman
    );
  });

  it("menyembunyikan paginasi bila hanya 1 halaman", () => {
    useQuestionsMock.mockReturnValue(dataState({ data: { items: [q("a")], total: 5 } }));
    render(<QuestionBankView />);
    expect(screen.queryByText("Sebelumnya")).not.toBeInTheDocument();
  });

  it("menampilkan nomor halaman & tombol navigasi", () => {
    render(<QuestionBankView />);
    expect(screen.getByText("Hal. 1/3")).toBeInTheDocument();
    expect(screen.getByText("Sebelumnya")).toBeDisabled(); // halaman 0
    expect(screen.getByText("Berikutnya")).toBeEnabled();
  });

  it("klik Berikutnya → set page=1 di URL", () => {
    render(<QuestionBankView />);
    fireEvent.click(screen.getByText("Berikutnya"));
    expect(replace).toHaveBeenCalledWith("/questions?page=1");
  });

  it("di halaman terakhir: Berikutnya nonaktif, Sebelumnya aktif", () => {
    currentSearch = "page=2";
    render(<QuestionBankView />);
    expect(screen.getByText("Hal. 3/3")).toBeInTheDocument();
    expect(screen.getByText("Berikutnya")).toBeDisabled();
    expect(screen.getByText("Sebelumnya")).toBeEnabled();
  });

  it("ganti filter menghapus page dari URL (kembali ke halaman 1)", () => {
    currentSearch = "q=abc&page=2";
    render(<QuestionBankView />);
    const input = screen.getByPlaceholderText("Cari soal…");
    fireEvent.change(input, { target: { value: "baru" } });
    fireEvent.submit(input.closest("form")!);
    // q berubah, page hilang
    expect(replace).toHaveBeenCalledWith("/questions?q=baru");
  });
});
