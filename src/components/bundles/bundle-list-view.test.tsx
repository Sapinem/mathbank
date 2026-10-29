import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BundleListView } from "./bundle-list-view";
import type { BundleRow } from "@/lib/services/bundle-service";

// ── Mock navigasi (URL = sumber kebenaran filter) ──
const replace = vi.fn();
const routerMock = { replace, push: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

let currentSearch = "";

// ── Mock hook bundles ──
const useBundlesPageMock = vi.fn();
const useCreateBundleMock = vi.fn();
const useArchiveBundleMock = vi.fn();
const useDuplicateBundleMock = vi.fn();

vi.mock("@/lib/hooks/use-bundles", () => ({
  useBundlesPage: (params: unknown) => useBundlesPageMock(params),
  useCreateBundle: () => useCreateBundleMock(),
  useArchiveBundle: () => useArchiveBundleMock(),
  useDuplicateBundle: () => useDuplicateBundleMock(),
}));

function mockBundle(id: string, title: string, status: BundleRow["status"] = "ready"): BundleRow {
  return {
    id,
    title,
    bundleType: "exam",
    origin: "manual",
    status,
    createdById: "u1",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    sourceId: null,
    url: null,
    eventId: null,
    grade: "12",
    itemCount: 10,
    year: 2024,
    durationMinutes: 90,
    instructions: null,
    printConfig: {
      pageSize: "A4",
      twoColumnLayout: true,
      includeAnswerKey: false,
      showQuestionNumber: true,
    },
    enrichment: {
      questionCount: 10,
      avgDifficulty: 3.2,
      topicCount: 4,
      taggedQuestionCount: 4,
      topicCoverage: 1.0,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  currentSearch = "";
  useBundlesPageMock.mockReturnValue({
    data: {
      items: [mockBundle("b1", "Penilaian Akhir Semester 1"), mockBundle("b2", "Simulasi UTBK 2025")],
      total: 55,
      limit: 20,
      offset: 0,
      stats: {
        byType: { exam: 40, source: 15 },
        totalItems: 450,
      },
    },
    isPending: false,
    isError: false,
    error: null,
  });
  useCreateBundleMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useArchiveBundleMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useDuplicateBundleMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("BundleListView — URL-driven state & Workbench Pagination", () => {
  it("merender kartu metrik statistik agregat server di header", () => {
    render(<BundleListView />);
    expect(screen.getByText("Total Paket")).toBeInTheDocument();
    expect(screen.getAllByText("55").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Naskah Ujian").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bank Sumber").length).toBeGreaterThan(0);
    expect(screen.getByText("Butir Terhimpun")).toBeInTheDocument();
  });

  it("beralih tampilan grid kartu dan tabel via parameter mode di URL", () => {
    render(<BundleListView />);
    const listBtn = screen.getByRole("button", { name: "Tampilan Tabel Rinci" });
    fireEvent.click(listBtn);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("mode=list"), { scroll: false });
  });

  it("mendebounce pencarian judul dan memperbarui URL setelah jeda ketik 300ms", () => {
    render(<BundleListView />);
    const searchInput = screen.getByPlaceholderText("Cari judul naskah/tahun…");
    fireEvent.change(searchInput, { target: { value: "Aljabar" } });

    // Sebelum timer selesai: URL belum diperbarui
    expect(replace).not.toHaveBeenCalled();

    // Jalankan timer debounce 300 ms
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(replace).toHaveBeenCalledWith(expect.stringContaining("q=Aljabar"), { scroll: false });
  });

  it("merender paginasi model workbench dan mendukung perubahan limit", () => {
    render(<BundleListView />);
    expect(screen.getByLabelText("Navigasi halaman paket")).toBeInTheDocument();
    const btn50 = screen.getByRole("button", { name: /Tampilkan 50 paket per halaman/i });
    fireEvent.click(btn50);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("limit=50"), { scroll: false });
  });

  it("mendukung klik tombol Sebelumnya / Berikutnya untuk navigasi halaman", () => {
    currentSearch = "page=1";
    render(<BundleListView />);
    const prevBtn = screen.getByRole("button", { name: /Sebelumnya/i });
    fireEvent.click(prevBtn);
    // Halaman 0 tidak menulis page ke URL (clean URL)
    expect(replace).toHaveBeenCalledWith("/bundles", { scroll: false });
  });
});
