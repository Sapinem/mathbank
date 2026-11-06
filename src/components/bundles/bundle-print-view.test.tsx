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
const mutateAsyncMock = vi.fn().mockResolvedValue({});
const useUpdateBundleMock = vi.fn().mockReturnValue({
  mutateAsync: mutateAsyncMock,
  isPending: false,
});
vi.mock("@/lib/hooks/use-bundles", () => ({
  useBundle: (id: string) => useBundleMock(id),
  useUpdateBundle: (id: string) => useUpdateBundleMock(id),
}));

// ── KaTeX cukup dipalsukan (vendor); yang diuji = pemetaan opsi→struktur cetak ──
vi.mock("@/components/math/math-content", () => ({
  MathContent: ({ content }: { content: string }) => <span data-testid="math">{content}</span>,
}));

/** Helper membuka Sliding Panel Pengaturan Cetak */
const openSettings = () => {
  const btn = screen.getByRole("button", { name: /Pengaturan Cetak/i });
  fireEvent.click(btn);
};

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
  mutateAsyncMock.mockClear();
  useBundleMock.mockReturnValue({ data: bundle(), isPending: false, isError: false });
});

describe("BundlePrintView (M8 - halaman cetak)", () => {
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

  it("Axiom R5: butir soal pertama ditandai data-first-item='true' untuk relaksasi pemotongan kolom", () => {
    render(<BundlePrintView />);
    const firstItems = document.querySelectorAll('[data-first-item="true"]');
    expect(firstItems.length).toBeGreaterThanOrEqual(1);
    // Stimulus pembuka di slot 0 maupun soal pertama bernomor 1 menerima relaksasi
    expect(firstItems[0]?.textContent).toContain("Bacalah teks berikut.");
    expect(firstItems[1]?.textContent).toContain("1.");
  });

  it("default kunci TERSEMBUNYI (peran tak boleh lihat pun oke)", () => {
    render(<BundlePrintView />);
    expect(screen.queryByRole("heading", { name: /Kunci Jawaban/i })).not.toBeInTheDocument();
  });

  it("mode 'Lembar terpisah' menampilkan kunci + teks jawaban isian", () => {
    render(<BundlePrintView />);
    openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Lembar terpisah/i }));
    expect(screen.getByRole("heading", { name: /Kunci Jawaban/i })).toBeInTheDocument();
    // Soal PG → label benar "B"; isian → teks "3" (unik di lembar kunci).
    const keySheet = screen.getByRole("heading", { name: /Kunci Jawaban/i }).closest("section")!;
    // Format: nomor + jawaban berimpit dalam tabel ("1." lalu "B"; "2." lalu "3").
    expect(keySheet.textContent).toContain("B");
    expect(keySheet.textContent).toContain("3");
  });

  it("mode 'Tandai tebal' menyorot opsi benar tanpa lembar kunci terpisah", () => {
    render(<BundlePrintView />);
    openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Tandai tebal/i }));
    expect(screen.queryByRole("heading", { name: /Kunci Jawaban/i })).not.toBeInTheDocument();
    // Opsi "4" (label B, benar): pembungkusnya bertanda bold, opsi "3" (salah) tidak.
    const bold = document.querySelector(".worksheet")!.querySelectorAll("span.font-bold");
    expect(bold.length).toBeGreaterThan(0);
    expect([...bold].some((el) => el.textContent?.includes("4"))).toBe(true);
    expect([...bold].some((el) => el.textContent?.includes("3"))).toBe(false);
  });

  it("lembar jawaban bisa disembunyikan", () => {
    render(<BundlePrintView />);
    expect(screen.getByRole("heading", { name: /Lembar Jawaban/i })).toBeInTheDocument();
    openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Sertakan/i }));
    expect(screen.queryByRole("heading", { name: /Lembar Jawaban/i })).not.toBeInTheDocument();
  });

  it("opsi kunci dinonaktifkan bila API tak mengirim answerKey", () => {
    const b = bundle();
    b.items = b.items.map((it) => ({
      ...it,
      question: { ...it.question, answerKey: undefined },
    }));
    useBundleMock.mockReturnValue({ data: b, isPending: false, isError: false });
    render(<BundlePrintView />);
    openSettings();
    expect(screen.getByRole("button", { name: /Tandai tebal/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Lembar terpisah/i })).toBeDisabled();
  });

  it("MAT-40: opsi 2 kolom merender grid 2-kolom untuk opsi jawaban", () => {
    render(<BundlePrintView />);
    openSettings();
    // Klik tombol "2 kolom" opsi
    fireEvent.click(screen.getByRole("button", { name: "2 kolom" }));
    // Cari list opsi (ul): harus punya class grid-cols-2 saat mode 2-kolom
    const optionsList = document.querySelector("ul.grid");
    expect(optionsList).not.toBeNull();
    expect(optionsList?.className).toContain("grid-cols-2");
  });

  it("MAT-40: tombol pembahasan dinonaktifkan bila tak ada explanation", () => {
    render(<BundlePrintView />);
    openSettings();
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
    openSettings();
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
    openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Di bawah soal/i }));
    expect(document.querySelector(".print-sheet-explanation")).toBeNull();
    expect(screen.getByText("Pembahasan inline 2+2=4.")).toBeInTheDocument();
  });

  it("Axiom Print: semua tipe soal (PG & isian) merender ruang coretan bersih tanpa border/label sesuai answerSpaceCm", () => {
    render(<BundlePrintView />);
    const scratches = document.querySelectorAll('[data-slot="scratch-space"]');
    // Ada 2 soal (1 PG, 1 isian) -> keduanya memiliki ruang coretan
    expect(scratches.length).toBe(2);
    scratches.forEach((scratch) => {
      // Di mode cetak, ruang coretan harus 100% kosong tanpa keterangan teks dan tanpa border/kotak
      expect(scratch.textContent).toBe("");
      expect(scratch.className).not.toContain("border");
    });
    expect(screen.queryByText(/Area Jawaban Siswa/i)).not.toBeInTheDocument();
  });

  it("Axiom Print: ruang coretan otomatis ditiadakan (auto-collapse) bila pembahasan inline aktif", () => {
    const b = bundle();
    const q2 = b.items.find((it) => it.item.id === "i2")!;
    q2.question.answerKey = {
      ...q2.question.answerKey!,
      explanation: "Penjelasan soal isian 5-2=3.",
    };
    useBundleMock.mockReturnValue({ data: b, isPending: false, isError: false });
    render(<BundlePrintView />);
    // Sebelum mode inline: ruang coretan ada di semua soal (2 butir)
    expect(document.querySelectorAll('[data-slot="scratch-space"]').length).toBe(2);
    // Buka pengaturan dan aktifkan pembahasan di bawah soal (inline)
    openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Di bawah soal/i }));
    // Ruang coretan otomatis hilang di semua soal (0cm / tidak dirender)
    expect(document.querySelectorAll('[data-slot="scratch-space"]').length).toBe(0);
  });

  it("Pilar 4: tombol simpan baku memicu mutasi updateBundle dengan printConfig aktif", async () => {
    render(<BundlePrintView />);
    openSettings();
    const saveBtn = screen.getByRole("button", { name: /Simpan sebagai Baku Paket Ini/i });
    expect(saveBtn).toBeInTheDocument();
    fireEvent.click(saveBtn);
    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        printConfig: expect.objectContaining({
          twoColumnLayout: true,
          includeAnswerKey: false,
          explanationPlacement: "none",
          answerSpaceCm: 3,
          backgroundWatermark: true,
        }),
      }),
    );
  });

  it("MAT-40: semua tombol aksi kontrol memenuhi touch target 44px (min-h-[44px])", () => {
    render(<BundlePrintView />);
    openSettings();
    // Semua tombol di bilah kontrol dan sheet drawer no-print harus punya min-h-[44px]
    const buttons = document.querySelectorAll(".no-print button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((btn) => {
      const cls = btn.className;
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
    expect(screen.getByRole("heading", { name: /Kunci Jawaban/i })).toBeInTheDocument();
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

    openSettings();
    fireEvent.click(screen.getByText("Naskah 1 kolom"));
    expect(document.querySelector("ol.print-single-column")).not.toBeNull();

    fireEvent.click(screen.getByText("Naskah 2 kolom"));
    expect(document.querySelector("ol.print-columns")).not.toBeNull();
  });

  it("merender judul bagian (section header) meskipun butir pembuka bagian adalah stimulus", () => {
    const b = bundle();
    b.items[0]!.item.sectionName = "Bagian I: Literasi";
    b.items[1]!.item.sectionName = "Bagian I: Literasi";
    useBundleMock.mockReturnValue({ data: b, isPending: false, isError: false });
    render(<BundlePrintView />);
    expect(screen.getByText("Bagian I: Literasi")).toBeInTheDocument();
  });

  it("tombol toggle Pas Layar mengubah kelas worksheet-fit-screen", () => {
    render(<BundlePrintView />);
    const toggleBtn = screen.getByRole("button", { name: /Pas Layar/i });
    expect(toggleBtn).toBeInTheDocument();
    const worksheet = document.querySelector(".worksheet")!;
    expect(worksheet.className).not.toContain("worksheet-fit-screen");

    fireEvent.click(toggleBtn);
    expect(worksheet.className).toContain("worksheet-fit-screen");
    expect(screen.getByRole("button", { name: /Ukuran Asli/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ukuran Asli/i }));
    expect(worksheet.className).not.toContain("worksheet-fit-screen");
  });

  it("tidak memuat karakter em-dash pada seluruh teks naskah dan topbar", () => {
    const { container } = render(<BundlePrintView />);
    expect(container.textContent).not.toContain("—");
  });

  it("U1: tombol toggle Kertas Kotak (0,5 cm) menambahkan kelas worksheet-grid", () => {
    render(<BundlePrintView />);
    const worksheet = document.querySelector(".worksheet")!;
    expect(worksheet.className).not.toContain("worksheet-grid");

    openSettings();
    const gridBtn = screen.getByRole("button", { name: "Kertas Kotak (0,5 cm)" });
    fireEvent.click(gridBtn);
    expect(worksheet.className).toContain("worksheet-grid");

    // Klik lagi untuk menonaktifkan kisi kotak
    fireEvent.click(gridBtn);
    expect(worksheet.className).not.toContain("worksheet-grid");
  });

  it("U1: menampilkan tanda air (watermark) logo institusi secara default dan dapat dialihkan secara independen", () => {
    render(<BundlePrintView />);
    const worksheet = document.querySelector(".worksheet")!;
    expect(worksheet.className).toContain("worksheet-watermark");
    expect(document.querySelector(".worksheet-watermark-container")).toBeInTheDocument();
    const watermarkSvg = document.querySelector(".worksheet-watermark-svg");
    expect(watermarkSvg).toBeInTheDocument();

    openSettings();
    // Klik tombol toggle Tanda Air Logo untuk mematikan
    const watermarkBtn = screen.getByRole("button", { name: "Tanda Air Logo" });
    fireEvent.click(watermarkBtn);
    expect(worksheet.className).not.toContain("worksheet-watermark");
    expect(document.querySelector(".worksheet-watermark-container")).toBeNull();

    // Nyalakan kembali tanda air
    fireEvent.click(watermarkBtn);
    expect(worksheet.className).toContain("worksheet-watermark");
    expect(document.querySelector(".worksheet-watermark-container")).toBeInTheDocument();

    // Aktifkan juga Kertas Kotak (mode kombinasi: grid di atas watermark)
    const gridBtn = screen.getByRole("button", { name: "Kertas Kotak (0,5 cm)" });
    fireEvent.click(gridBtn);
    expect(worksheet.className).toContain("worksheet-watermark");
    expect(worksheet.className).toContain("worksheet-grid");
    expect(document.querySelector(".worksheet-watermark-container")).toBeInTheDocument();
  });

  it("Preset B: Pedoman Guru mereset tanda air override", () => {
    render(<BundlePrintView />);
    openSettings();
    const teacherBtn = screen.getByRole("button", { name: /Pedoman Guru/i });
    fireEvent.click(teacherBtn);

    const worksheet = document.querySelector(".worksheet")!;
    expect(worksheet.className).not.toContain("worksheet-watermark");
    expect(document.querySelector(".worksheet-watermark-container")).toBeNull();
  });

  it("U3: butir soal yang ditandai lompat kolom merender data-break='force-column'", () => {
    render(<BundlePrintView />);
    openSettings();
    // Butir nomor 2 (soal q1) ditandai lompat kolom
    const breakBtn = screen.getByRole("button", { name: /Butir nomor 2/i });
    expect(breakBtn).toBeInTheDocument();

    fireEvent.click(breakBtn);
    const brokenItem = document.querySelector('[data-break="force-column"]');
    expect(brokenItem).not.toBeNull();
    expect(brokenItem?.textContent).toContain("2.");

    // Klik lagi untuk membatalkan
    fireEvent.click(breakBtn);
    expect(document.querySelector('[data-break="force-column"]')).toBeNull();
  });

  it("U4: pergantian preset warna brand mengubah variabel --paper-brand", () => {
    render(<BundlePrintView />);
    const worksheet = document.querySelector(".worksheet")! as HTMLElement;
    expect(worksheet.style.getPropertyValue("--paper-brand")).toBe("#0158ca");

    openSettings();
    const greenBtn = screen.getByRole("button", { name: /Hijau/i });
    fireEvent.click(greenBtn);
    expect(worksheet.style.getPropertyValue("--paper-brand")).toBe("#0b6b3a");
  });

  it("U4: menampilkan logo kustom jika institutionLogoUrl tersedia", () => {
    useBundleMock.mockReturnValue({
      data: bundle({
        printConfig: {
          ...bundle().printConfig,
          institutionLogoUrl: "https://example.com/logo.png",
        },
      }),
      isPending: false,
      isError: false,
    });
    render(<BundlePrintView />);
    const logoImg = screen.getByRole("img");
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("merender kop halaman 1, running header halaman 2+, dan running footer lengkap", () => {
    render(<BundlePrintView />);

    // Kop halaman 1
    const kop = document.querySelector('[data-slot="bundle-print-kop"]');
    expect(kop).toBeInTheDocument();
    const logoImg = screen.getByAltText("Math My ID");
    expect(logoImg).toBeInTheDocument();

    // Running header halaman 2+
    const runningHeader = document.querySelector('[data-slot="bundle-print-header"]');
    expect(runningHeader).toBeInTheDocument();
    expect(runningHeader).toHaveClass("print-running-header");

    // Running footer
    const runningFooter = document.querySelector('[data-slot="bundle-print-footer"]');
    expect(runningFooter).toBeInTheDocument();
    expect(runningFooter).toHaveClass("print-running-footer");
    expect(screen.getAllByText("mathmyid").length).toBe(5);
  });

  it("merender itemNumber kustom dan sectionName jika tersedia pada slot naskah", () => {
    useBundleMock.mockReturnValue({
      data: bundle({
        items: [
          {
            item: {
              id: "bi-1",
              bundleId: "b1",
              questionId: "q-1",
              orderIndex: 0,
              role: "question",
              itemNumber: "1a",
              sectionName: "Bagian A - Pilihan Ganda",
              notes: null,
            },
            question: {
              id: "q-1",
              contentMarkdown: "Hitung nilai $x$.",
              questionType: "short_answer",
              status: "ready",
              options: [],
            },
          },
        ],
      }),
      isPending: false,
      isError: false,
    });

    render(<BundlePrintView />);
    // Nomor kustom harus muncul di SEMUA daftar cetak (naskah, kunci,
    // lembar jawaban) — bukan hanya di badan soal.
    expect(screen.getAllByText("1a.").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Bagian A - Pilihan Ganda")).toBeInTheDocument();
  });

  describe("Sistem Tema Naskah Cetak (Print Themes)", () => {
    it("naskah lama tanpa themeId otomatis merender tema standar math-my-id", () => {
      useBundleMock.mockReturnValue({
        data: bundle({
          printConfig: {
            institutionName: "Math My ID",
            twoColumnLayout: true,
          },
        }),
        isPending: false,
        isError: false,
      });

      render(<BundlePrintView />);
      expect(document.querySelector('[data-slot="bundle-print-kop"]')).toBeInTheDocument();
      expect(document.querySelector('[data-slot="formal-exam-kop"]')).not.toBeInTheDocument();
    });

    it("merender tema formal-exam jika themeId disetel di printConfig", () => {
      useBundleMock.mockReturnValue({
        data: bundle({
          printConfig: {
            institutionName: "SMA Negeri 1 Jakarta",
            themeId: "formal-exam",
            themeOptions: {
              "formal-exam": { showSupervisorSignature: true },
            },
          },
        }),
        isPending: false,
        isError: false,
      });

      render(<BundlePrintView />);
      expect(document.querySelector('[data-slot="formal-exam-kop"]')).toBeInTheDocument();
      expect(screen.getAllByText("SMA Negeri 1 Jakarta").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Nomor Peserta")).toBeInTheDocument();
      expect(document.querySelector('[data-slot="supervisor-signature"]')).toBeInTheDocument();
    });

    it("mengganti tema dan opsi secara dinamis di drawer lalu menyimpan baku", async () => {
      useBundleMock.mockReturnValue({
        data: bundle({
          printConfig: {
            institutionName: "SMA 1",
            themeId: "math-my-id",
          },
        }),
        isPending: false,
        isError: false,
      });

      render(<BundlePrintView />);

      // Awalnya tema standar aktif
      expect(document.querySelector('[data-slot="bundle-print-kop"]')).toBeInTheDocument();

      // Buka drawer pengaturan
      openSettings();

      // Pilih tema formal-exam dari dropdown
      const select = screen.getByLabelText(/pilih format bingkai & kop/i);
      fireEvent.change(select, { target: { value: "formal-exam" } });

      // Tampilan kop naskah berganti secara instan
      expect(document.querySelector('[data-slot="formal-exam-kop"]')).toBeInTheDocument();
      expect(document.querySelector('[data-slot="bundle-print-kop"]')).not.toBeInTheDocument();

      // Aktifkan tanda tangan pengawas di opsi tema
      const toggleSign = screen.getByRole("button", { name: /sembunyikan tanda tangan/i });
      fireEvent.click(toggleSign);
      expect(document.querySelector('[data-slot="supervisor-signature"]')).toBeInTheDocument();

      // Simpan pengaturan baku
      const saveBtn = screen.getByRole("button", { name: /simpan sebagai baku/i });
      fireEvent.click(saveBtn);

      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          printConfig: expect.objectContaining({
            themeId: "formal-exam",
            themeOptions: expect.objectContaining({
              "formal-exam": expect.objectContaining({
                showSupervisorSignature: true,
              }),
            }),
          }),
        })
      );
    });
  });
});
