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

/**
 * Filter kini memakai checkbox (multi-select) — bukan Radix `Select`.
 * Diuji LOGIKA filter (URL = sumber kebenaran), bukan komponen vendornya.
 */

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

  it("centang Status → menulis status ke URL", () => {
    render(<QuestionBankView defaultFiltersOpen />);
    fireEvent.click(screen.getByLabelText("Siap"));
    expect(replace).toHaveBeenCalledWith("/questions?status=ready");
  });

  it("memilih 'Semua' pada Status → menghapus param", () => {
    currentSearch = "status=ready";
    render(<QuestionBankView defaultFiltersOpen />);
    // "Semua" pertama = grup Status
    fireEvent.click(screen.getAllByLabelText("Semua")[0]);
    expect(replace).toHaveBeenCalledWith("/questions?");
  });

  it("centang beberapa Kesulitan → multi-nilai di URL", () => {
    currentSearch = "difficulty=4";
    const { unmount } = render(<QuestionBankView defaultFiltersOpen />);
    fireEvent.click(screen.getByLabelText("Level 3"));
    const url = replace.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("difficulty=4");
    expect(url).toContain("difficulty=3");
    unmount();
  });

  it("multi Jenjang → dua nilai grade di URL (id QBank)", () => {
    useGradesMock.mockReturnValue({
      data: [
        { id: "10", label: "Kelas 10 SMA", levelGroup: "sma", curriculumPhase: "Fase E", orderIndex: 10 },
        { id: "11", label: "Kelas 11 SMA", levelGroup: "sma", curriculumPhase: "Fase F", orderIndex: 11 },
      ],
    });
    currentSearch = "grade=10";
    render(<QuestionBankView defaultFiltersOpen />);
    fireEvent.click(screen.getByLabelText("Kelas 11 SMA"));
    const url = replace.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("grade=10");
    expect(url).toContain("grade=11");
  });

  it("opsi Topik & Sumber berasal dari hook referensi", () => {
    useTopicsMock.mockReturnValue({
      data: [{ id: "t1", name: "Aljabar", slug: "aljabar", parentId: null, level: 1 }],
    });
    useSourcesMock.mockReturnValue({
      data: [{ id: "s1", kind: "book", label: "Buku A", slug: "buku-a" }],
    });
    render(<QuestionBankView defaultFiltersOpen />);
    expect(screen.getByText("Aljabar")).toBeInTheDocument();
    expect(screen.getByText("Buku A")).toBeInTheDocument();
  });

  it("pemilih topik punya pencarian mikro (filter daftar topik)", () => {
    useTopicsMock.mockReturnValue({
      data: [
        { id: "t1", name: "Aljabar", slug: "aljabar", parentId: null, level: 1 },
        { id: "t2", name: "Geometri", slug: "geometri", parentId: null, level: 1 },
      ],
    });
    render(<QuestionBankView defaultFiltersOpen />);
    const search = screen.getByLabelText("Cari topik");
    fireEvent.change(search, { target: { value: "geo" } });
    expect(screen.getByText("Geometri")).toBeInTheDocument();
    expect(screen.queryByText("Aljabar")).not.toBeInTheDocument();
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
    // Sheet ter-render (judul "Saring" muncul)
    expect(screen.getAllByText("Saring").length).toBeGreaterThan(0);
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
