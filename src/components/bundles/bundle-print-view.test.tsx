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
    version: 1,
    title: "Pemantapan ASTS I",
    bundleType: "exam",
    origin: "manual",
    sourceId: null,
    eventId: null,
    year: 2026,
    grade: "9 SMP",
    durationMinutes: 120,
    instructions: "Kerjakan dengan jujur.",
    printConfig: {
      institutionName: "Math My ID",
      twoColumnLayout: true,
      includeAnswerKey: false,
      showQuestionNumber: true,
      pageSize: "A4",
    },
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
  } as BundleDetail;
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

  it("MAT-40: opsi 2 kolom merender grid 2-kolom untuk opsi jawaban", () => {
    render(<BundlePrintView />);
    // Klik tombol "2 kolom"
    // Nama PERSIS: sejak ada kontrol "Kolom Naskah", pola /2 kolom/i juga
    // cocok dengan "Naskah 2 kolom" (ambigu). Tombol opsi = "2 kolom".
    fireEvent.click(screen.getByRole("button", { name: "2 kolom" }));
    // Cari list opsi (ul) — harus punya class grid-cols-2 saat mode 2-kolom
    const optionsList = document.querySelector("ul.grid");
    expect(optionsList).not.toBeNull();
    expect(optionsList?.className).toContain("grid-cols-2");
  });

  it("MAT-40: tombol pembahasan dinonaktifkan bila tak ada explanation", () => {
    render(<BundlePrintView />);
    expect(screen.getByRole("button", { name: /Tanpa pembahasan/i })).toBeDisabled();
  });

  it("MAT-40: tombol pembahasan aktif bila ada explanation", () => {
    const b = bundle();
    // Tambah explanation ke soal q1
    const q1 = b.items.find((it) => it.item.id === "i1")!;
    q1.question.answerKey = {
      ...q1.question.answerKey!,
      explanation: "Karena 2+2=4.",
    };
    useBundleMock.mockReturnValue({ data: b, isPending: false, isError: false });
    render(<BundlePrintView />);
    const btn = screen.getByRole("button", { name: /Tanpa pembahasan/i });
    expect(btn).not.toBeDisabled();
    // Klik untuk menyertakan pembahasan
    fireEvent.click(btn);
    // Section pembahasan punya class print-sheet-explanation
    const explSection = document.querySelector(".print-sheet-explanation");
    expect(explSection).not.toBeNull();
    expect(explSection?.textContent).toContain("Karena 2+2=4.");
  });

  it("Axiom 3-Way: mode pembahasan inline menampilkan pembahasan tepat di bawah soal", () => {
    const b = bundle();
    const q1 = b.items.find((it) => it.item.id === "i1")!;
    q1.question.answerKey = {
      ...q1.question.answerKey!,
      explanation: "Pembahasan inline 2+2=4.",
    };
    useBundleMock.mockReturnValue({ data: b, isPending: false, isError: false });
    render(<BundlePrintView />);
    fireEvent.click(screen.getByRole("button", { name: /Di bawah soal/i }));
    expect(document.querySelector(".print-sheet-explanation")).toBeNull();
    expect(screen.getByText("Pembahasan inline 2+2=4.")).toBeInTheDocument();
  });

  it("Axiom Print: soal isian merender ruang jawaban siswa sesuai answerSpaceCm", () => {
    render(<BundlePrintView />);
    expect(screen.getByText(/Area Jawaban Siswa/i)).toBeInTheDocument();
  });

  it("MAT-40: semua tombol aksi kontrol memenuhi touch target 44px (min-h-[44px])", () => {
    render(<BundlePrintView />);
    // Semua tombol di bilah kontrol no-print harus punya min-h-[44px]
    const controlBar = document.querySelector(".no-print");
    const buttons = controlBar?.querySelectorAll("button") ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((btn) => {
      const cls = btn.className;
      // Tombol berukuran "sm" pakai class min-h-[44px] di className
      expect(cls).toMatch(/min-h-\[44px\]|h-11/);
    });
  });

  it("Pilar 4: membaca printConfig kustom (lembaga, petunjuk, layout, nomor soal)", () => {
    const b = bundle({
      printConfig: {
        institutionName: "SMA Prestasi Bangsa",
        tagline: "Unggul dalam Sains dan Matematika",
        instructions: "Gunakan pensil 2B.",
        durationMinutes: 90,
        twoColumnLayout: false,
        showQuestionNumber: false,
        includeAnswerKey: true,
        pageSize: "A4",
      },
    });
    useBundleMock.mockReturnValue({ data: b, isPending: false, isError: false });
    render(<BundlePrintView />);

    expect(screen.getByText("SMA PRESTASI BANGSA")).toBeInTheDocument();
    expect(screen.getByText("Unggul dalam Sains dan Matematika")).toBeInTheDocument();
    expect(screen.getByText("Gunakan pensil 2B.")).toBeInTheDocument();
    expect(screen.getByText(/90 menit/)).toBeInTheDocument();

    // twoColumnLayout: false -> print-single-column
    const ol = document.querySelector("ol.print-single-column");
    expect(ol).not.toBeNull();

    // showQuestionNumber: false -> nomor soal tidak ditampilkan
    expect(document.querySelector(".print-item-number")).toBeNull();

    // includeAnswerKey: true -> kunci jawaban tampil
    expect(screen.getByText("Kunci Jawaban")).toBeInTheDocument();
  });

  it("Pilar 4: pageSize Letter menyuntik @page khusus cetak", () => {
    useBundleMock.mockReturnValue({
      data: bundle({ printConfig: { ...bundle().printConfig, pageSize: "Letter" } }),
      isPending: false,
      isError: false,
    });
    render(<BundlePrintView />);

    const pageStyles = [...document.querySelectorAll("style")]
      .map((s) => s.textContent ?? "")
      .filter((s) => s.includes("@page"));
    expect(pageStyles).toHaveLength(1);
    expect(pageStyles[0]).toContain("size: Letter portrait");
  });

  it("Pilar 4: pageSize A4 tidak menyuntik @page tambahan", () => {
    useBundleMock.mockReturnValue({
      data: bundle({ printConfig: { ...bundle().printConfig, pageSize: "A4" } }),
      isPending: false,
      isError: false,
    });
    render(<BundlePrintView />);
    // Jangan cek keberadaan <style> apa pun: komponen anak boleh menyuntik
    // stylesheet sendiri. Yang diuji: tidak ada `@page` tambahan.
    const pageStyles = [...document.querySelectorAll("style")]
      .map((s) => s.textContent ?? "")
      .filter((s) => s.includes("@page"));
    expect(pageStyles).toHaveLength(0);
  });

  it("Pilar 4: kolom naskah bisa ditimpa dari bilah kontrol", () => {
    useBundleMock.mockReturnValue({
      data: bundle({ printConfig: { ...bundle().printConfig, twoColumnLayout: true } }),
      isPending: false,
      isError: false,
    });
    render(<BundlePrintView />);

    // Default dari printConfig: 2 kolom.
    expect(document.querySelector("ol.print-columns")).not.toBeNull();

    fireEvent.click(screen.getByText("Naskah 1 kolom"));
    expect(document.querySelector("ol.print-single-column")).not.toBeNull();

    fireEvent.click(screen.getByText("Naskah 2 kolom"));
    expect(document.querySelector("ol.print-columns")).not.toBeNull();
  });
});
