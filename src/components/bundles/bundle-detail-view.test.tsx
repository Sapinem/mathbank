import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BundleDetailView } from "./bundle-detail-view";
import type { BundleDetail } from "@/lib/hooks/use-bundles";

// ── Mock navigasi Next.js ──
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "b1" }),
}));

// ── Mock hooks data bundle ──
const useBundleMock = vi.fn();
const useBundleValidationMock = vi.fn();

vi.mock("@/lib/hooks/use-bundles", () => ({
  useBundle: (id: string) => useBundleMock(id),
  useBundleValidation: (id: string) => useBundleValidationMock(id),
}));

// ── Mock KaTeX ──
vi.mock("@/components/math/math-content", () => ({
  MathContent: ({ content }: { content: string }) => <span data-testid="math">{content}</span>,
}));

// ── Mock MoodleExportButton ──
vi.mock("@/components/bundles/moodle-export-button", () => ({
  MoodleExportButton: () => <button type="button">Ekspor ke GitSync</button>,
}));

function mockBundle(over: Partial<BundleDetail> = {}): BundleDetail {
  return {
    id: "b1",
    version: 1,
    title: "Pertidaksamaan Eksponen",
    bundleType: "source",
    origin: "ingest",
    sourceId: "src-1",
    url: "https://www.m4th-lab.net/materi/pertidaksamaan-eksponen",
    eventId: null,
    year: null,
    grade: null,
    durationMinutes: 90,
    instructions: "Kerjakan dengan teliti.",
    printConfig: {
      pageSize: "A4",
      twoColumnLayout: true,
      includeAnswerKey: false,
      answerSpaceCm: 4,
    },
    status: "draft",
    createdById: "u1",
    itemCount: 1,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    items: [
      {
        item: {
          id: "item-1",
          bundleId: "b1",
          questionId: "q-101",
          role: "question",
          orderIndex: 0,
          sectionName: null,
          itemNumber: "1",
          notes: null,
        },
        question: {
          id: "q-101",
          contentMarkdown: "Tentukan himpunan penyelesaian $2^{x+1} > 8$.",
          questionType: "single_choice",
          status: "ready",
          options: [
            {
              id: "opt-1",
              questionId: "q-101",
              label: "A",
              contentMarkdown: "$x > 2$",
              orderIndex: 0,
              isCorrect: true,
            },
            {
              id: "opt-2",
              questionId: "q-101",
              label: "B",
              contentMarkdown: "$x < 2$",
              orderIndex: 1,
              isCorrect: false,
            },
          ],
        },
      },
    ],
    ...over,
  } as BundleDetail;
}

beforeEach(() => {
  useBundleValidationMock.mockReturnValue({
    data: { withoutAnswerKey: [], missingQuestions: [], valid: true, itemCount: 1 },
  });
});

describe("BundleDetailView", () => {
  it("merender judul paket dan tombol aksi navigasi PageHeader", () => {
    useBundleMock.mockReturnValue({ data: mockBundle(), isPending: false, isError: false });
    render(<BundleDetailView />);

    expect(screen.getByRole("heading", { name: "Pertidaksamaan Eksponen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Daftar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Susun Paket/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cetak Paket Soal" })).toBeInTheDocument();
  });

  it("merender naskah soal mengalir alami dengan nomor urut pada Mode Naskah tanpa tombol panah", () => {
    useBundleMock.mockReturnValue({ data: mockBundle(), isPending: false, isError: false });
    render(<BundleDetailView />);

    expect(screen.getByText("1.")).toBeInTheDocument();
    // Mode Naskah tidak menampilkan tombol Buka Soal / panah pojok agar mengalir alami
    expect(screen.queryByRole("link", { name: /Buka Soal/i })).not.toBeInTheDocument();
  });

  it("dapat beralih ke Mode Kartu dengan toggle dan menampilkan tautan Buka Soal", () => {
    useBundleMock.mockReturnValue({ data: mockBundle(), isPending: false, isError: false });
    render(<BundleDetailView />);

    const cardsBtn = screen.getByRole("button", { name: /Kartu/i });
    fireEvent.click(cardsBtn);
    expect(screen.getByText("Butir #1")).toBeInTheDocument();
    const openQuestionLink = screen.getByRole("link", { name: /Buka Soal/i });
    expect(openQuestionLink).toBeInTheDocument();
    expect(openQuestionLink).toHaveAttribute("href", "/questions/q-101");
  });

  it("merender sidebar Informasi Naskah dengan tautan web sumber aktif", () => {
    useBundleMock.mockReturnValue({ data: mockBundle(), isPending: false, isError: false });
    render(<BundleDetailView />);

    expect(screen.getByText("Informasi Naskah")).toBeInTheDocument();
    const sourceLink = screen.getByRole("link", { name: /m4th-lab\.net/i });
    expect(sourceLink).toBeInTheDocument();
    expect(sourceLink).toHaveAttribute(
      "href",
      "https://www.m4th-lab.net/materi/pertidaksamaan-eksponen",
    );
  });

  it("merender kartu Pengaturan Cetak dengan konfigurasi A4 dan 2 Kolom", () => {
    useBundleMock.mockReturnValue({ data: mockBundle(), isPending: false, isError: false });
    render(<BundleDetailView />);

    expect(screen.getByText("Pengaturan Cetak")).toBeInTheDocument();
    expect(screen.getByText("Ukuran Kertas")).toBeInTheDocument();
    expect(screen.getByText("A4")).toBeInTheDocument();
    expect(screen.getByText("2 Kolom")).toBeInTheDocument();
  });

  it("merender peringatan ketika terdapat soal tanpa kunci jawaban", () => {
    useBundleValidationMock.mockReturnValue({
      data: {
        withoutAnswerKey: [{ questionId: "q-101", itemNumber: "1" }],
        missingQuestions: [],
        valid: false,
        itemCount: 1,
      },
    });
    useBundleMock.mockReturnValue({ data: mockBundle(), isPending: false, isError: false });
    render(<BundleDetailView />);

    expect(
      screen.getByText(/1 soal belum punya kunci jawaban/i),
    ).toBeInTheDocument();
  });
});
