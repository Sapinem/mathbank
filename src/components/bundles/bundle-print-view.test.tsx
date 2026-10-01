import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BundlePrintView } from "./bundle-print-view";
import type { BundleDetail } from "@/lib/hooks/use-bundles";

// ── Mock navigasi ──
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "b1" }),
}));

// ── Mock hook data ──
const useBundleMock = vi.fn();
vi.mock("@/lib/hooks/use-bundles", () => ({
  useBundle: (id: string) => useBundleMock(id),
}));

// ── KaTeX cukup dipalsukan (vendor); yang diuji = pemetaan opsi→struktur cetak ──
vi.mock("@/components/math/math-content", () => ({
  MathContent: ({ content }: { content: string }) => <span data-testid="math">{content}</span>,
}));

/** Data paket uji: 1 stimulus + 2 soal (satu PG beropsi, satu isian). */
function bundle(over: Partial<BundleDetail> = {}): BundleDetail {
  return {
    id: "b1",
    title: "Pemantapan ASTS I",
    slug: "pemantapan-asts-i",
    bundleType: "exam",
    sourceId: null,
    eventId: null,
    year: 2026,
    grade: "9 SMP",
    durationMinutes: 120,
    instructions: "Kerjakan dengan jujur.",
    status: "ready",
    createdById: "u1",
    itemCount: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        item: {
          id: "i0",
          bundleId: "b1",
          questionId: "q0",
          role: "stimulus",
          orderIndex: 0,
          sectionName: null,
          itemNumber: null,
          notes: null,
        },
        question: {
          id: "q0",
          contentMarkdown: "Bacalah teks berikut.",
          questionType: "stimulus",
          status: "ready",
          options: [],
        },
      },
      {
        item: {
          id: "i1",
          bundleId: "b1",
          questionId: "q1",
          role: "question",
          orderIndex: 1,
          sectionName: null,
          itemNumber: null,
          notes: null,
        },
        question: {
          id: "q1",
          contentMarkdown: "Berapa $2+2$?",
          questionType: "single_choice",
          status: "ready",
          answerKey: { correct: ["B"] },
          options: [
            { id: "o1", label: "A", contentMarkdown: "3", orderIndex: 0, isCorrect: false },
            { id: "o2", label: "B", contentMarkdown: "4", orderIndex: 1, isCorrect: true },
          ],
        },
      },
      {
        item: {
          id: "i2",
          bundleId: "b1",
          questionId: "q2",
          role: "question",
          orderIndex: 2,
          sectionName: null,
          itemNumber: null,
          notes: null,
        },
        question: {
          id: "q2",
          contentMarkdown: "Sebutkan hasil $5-2$.",
          questionType: "short_answer",
          status: "ready",
          answerKey: { text: "3" },
          options: [],
        },
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  useBundleMock.mockReset();
  useBundleMock.mockReturnValue({ data: bundle(), isPending: false, isError: false });
});

describe("BundlePrintView (M8 — halaman cetak)", () => {
  it("menampilkan kop: judul, kelas/tahun, durasi, dan petunjuk", () => {
    render(<BundlePrintView />);
    expect(screen.getByText("Pemantapan ASTS I")).toBeInTheDocument();
    // Baris info menggabungkan kelas · tahun · waktu · jumlah soal.
    expect(screen.getByText(/9 SMP/)).toBeInTheDocument();
    expect(screen.getByText(/120 menit/)).toBeInTheDocument();
    expect(screen.getByText("Kerjakan dengan jujur.")).toBeInTheDocument();
  });

  it("hanya menomori soal (bukan stimulus) dan menampilkan opsi berlabel", () => {
    render(<BundlePrintView />);
    // 2 soal → nomor 1 & 2. Stimulus tak dapat nomor soal.
    expect(screen.getByText("Bacalah teks berikut.")).toBeInTheDocument();
    // Opsi A/B dari soal PG tampil dengan label.
    expect(screen.getByText("A.")).toBeInTheDocument();
    expect(screen.getByText("B.")).toBeInTheDocument();
    // Isian singkat (tanpa opsi) tak merender daftar opsi.
    expect(screen.getByText("Sebutkan hasil $5-2$.")).toBeInTheDocument();
  });

  it("default kunci TERSEMBUNYI (peran tak boleh lihat pun oke)", () => {
    render(<BundlePrintView />);
    expect(screen.queryByText("Kunci Jawaban")).not.toBeInTheDocument();
  });

  it("mode 'Lembar terpisah' menampilkan kunci + teks jawaban isian", () => {
    render(<BundlePrintView />);
    fireEvent.click(screen.getByRole("button", { name: /Lembar terpisah/i }));
    expect(screen.getByText("Kunci Jawaban")).toBeInTheDocument();
    // Soal PG → label benar "B"; isian → teks "3" (unik di lembar kunci).
    const keySheet = screen.getByText("Kunci Jawaban").closest("section")!;
    // Format: nomor + jawaban berimpit dalam tabel ("1." lalu "B"; "2." lalu "3").
    expect(keySheet.textContent).toContain("B");
    expect(keySheet.textContent).toContain("3");
  });

  it("mode 'Tandai tebal' menyorot opsi benar tanpa lembar kunci terpisah", () => {
    render(<BundlePrintView />);
    fireEvent.click(screen.getByRole("button", { name: /Tandai tebal/i }));
    expect(screen.queryByText("Kunci Jawaban")).not.toBeInTheDocument();
    // Opsi "4" (label B, benar): pembungkusnya bertanda bold, opsi "3" (salah) tidak.
    const bold = document.querySelectorAll("span.font-bold");
    expect(bold.length).toBeGreaterThan(0);
    expect([...bold].some((el) => el.textContent?.includes("4"))).toBe(true);
    expect([...bold].some((el) => el.textContent?.includes("3"))).toBe(false);
  });

  it("lembar jawaban bisa disembunyikan", () => {
    render(<BundlePrintView />);
    expect(screen.getByText("Lembar Jawaban")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sertakan/i }));
    expect(screen.queryByText("Lembar Jawaban")).not.toBeInTheDocument();
  });

  it("opsi kunci dinonaktifkan bila API tak mengirim answerKey", () => {
    const b = bundle();
    b.items = b.items.map((it) => ({
      ...it,
      question: { ...it.question, answerKey: undefined },
    }));
    useBundleMock.mockReturnValue({ data: b, isPending: false, isError: false });
    render(<BundlePrintView />);
    expect(screen.getByRole("button", { name: /Tandai tebal/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Lembar terpisah/i })).toBeDisabled();
  });
});
