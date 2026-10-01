import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionCard, QuestionTypeIcon, excerpt, formatGradeBadge } from "./question-card";
import type { PublicQuestion } from "@/lib/services/question-service";

/** Soal uji minimal (hanya field yang dirender kartu). */
function q(over: Partial<PublicQuestion> = {}): PublicQuestion {
  return {
    id: "q1",
    parentId: null,
    childOrder: 0,
    questionType: "single_choice",
    difficulty: 3,
    cognitiveLevel: "understand",
    grade: "SMA-11",
    contentMarkdown: "Berapa $2+2$?",
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
    ...over,
  } as PublicQuestion;
}

describe("QuestionCard", () => {
  it("menampilkan status, tipe, grade, dan badge rubrik (kesulitan + kognitif)", () => {
    const { container } = render(<QuestionCard question={q()} href="/questions/q1" />);
    expect(screen.getByText("Draf")).toBeInTheDocument();
    // grade dirender sebagai "· SMA-11" dalam satu span
    expect(container.textContent).toContain("SMA-11");
    // Difficulty 3 → badge "Lv.3" + meter titik ●●●○○
    expect(container.textContent).toContain("Lv.3");
    expect(container.textContent).toContain("●●●○○");
    // cognitiveLevel "understand" → badge mikro "C2"
    expect(container.textContent).toContain("C2");
  });

  it("badge rubrik dapat difokus keyboard & punya aria-label rubrik", () => {
    render(<QuestionCard question={q()} href="/questions/q1" />);
    // Badge kognitif C2 → aria-label memuat rubrik operasional
    expect(
      screen.getByLabelText(/C2 · Memahami:/),
    ).toBeInTheDocument();
    // Badge kesulitan → aria-label memuat rubrik Lv.3
    expect(screen.getByLabelText(/Lv\.3 · Sedang/)).toBeInTheDocument();
  });

  it("merender wacana stimulus induk bila soal anak punya parent", () => {
    render(
      <QuestionCard
        question={q({
          parent: { id: "p1", contentMarkdown: "Bacalah tabel berikut." },
        } as Partial<PublicQuestion>)}
        href="/questions/q1"
      />,
    );
    expect(screen.getByText("Wacana Stimulus (Induk)")).toBeInTheDocument();
    expect(screen.getByText("Bacalah tabel berikut.")).toBeInTheDocument();
  });

  it("tautan ke href yang diberikan", () => {
    render(<QuestionCard question={q()} href="/questions/q1" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/questions/q1");
  });

  it("menampilkan ikon 'Ditandai' hanya saat flagged", () => {
    const { rerender } = render(<QuestionCard question={q({ isFlagged: false })} href="/x" />);
    expect(screen.queryByLabelText("Ditandai")).not.toBeInTheDocument();
    rerender(<QuestionCard question={q({ isFlagged: true })} href="/x" />);
    expect(screen.getByLabelText("Ditandai")).toBeInTheDocument();
  });

  it("checkbox seleksi hanya muncul bila onToggleSelect diberi", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<QuestionCard question={q()} href="/x" />);
    expect(screen.queryByLabelText("Pilih soal")).not.toBeInTheDocument();
    rerender(<QuestionCard question={q()} href="/x" onToggleSelect={onToggle} />);
    const cb = screen.getByLabelText("Pilih soal");
    expect(cb).toBeInTheDocument();
    // klik → memanggil callback dengan id soal
    cb.click();
    expect(onToggle).toHaveBeenCalledWith("q1");
  });

  it("kartu terpilih diberi latar brand", () => {
    const { container } = render(
      <QuestionCard question={q()} href="/x" selected onToggleSelect={() => {}} />,
    );
    expect(container.firstChild).toHaveClass("bg-brand/5");
  });

  it("menandai opsi benar dengan warna sukses (isCorrect)", () => {
    const withOpts = q({
      options: [
        { id: "o1", questionId: "q1", label: "A", contentMarkdown: "3", isCorrect: false, distractorRationale: null, orderIndex: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: "o2", questionId: "q1", label: "B", contentMarkdown: "4", isCorrect: true, distractorRationale: null, orderIndex: 1, createdAt: new Date(), updatedAt: new Date() },
      ],
    } as Partial<PublicQuestion>);
    const { container } = render(<QuestionCard question={withOpts} href="/x" />);
    // Pembungkus opsi = <span> yang berisi <strong>B.</strong>
    const optB = Array.from(container.querySelectorAll("strong"))
      .find((s) => s.textContent === "B.")
      ?.closest("span");
    const optA = Array.from(container.querySelectorAll("strong"))
      .find((s) => s.textContent === "A.")
      ?.closest("span");
    expect(optB?.className).toContain("text-success");
    expect(optA?.className).not.toContain("text-success");
  });

  it("soal TANPA options tidak menampilkan baris opsi", () => {
    const { container } = render(<QuestionCard question={q({ options: [] })} href="/x" />);
    // hanya konten soal; tak ada label A./B.
    expect(container.textContent).not.toMatch(/\bA\./);
  });

  it("memangkas konten panjang (>180 karakter) dengan elipsis pada mode list", () => {
    const long = "x".repeat(300);
    render(<QuestionCard question={q({ contentMarkdown: long })} href="/x" mode="list" />);
    expect(screen.getByText(/…/)).toBeInTheDocument();
  });

  it("merender kartu dengan border bulat dan padding pada mode grid & masonry", () => {
    const { container: gridContainer } = render(
      <QuestionCard question={q()} href="/x" mode="grid" />,
    );
    expect(gridContainer.firstElementChild?.className).toContain("rounded-xl");
    expect(gridContainer.firstElementChild?.className).toContain("border");

    const { container: masonryContainer } = render(
      <QuestionCard question={q()} href="/x" mode="masonry" />,
    );
    expect(masonryContainer.firstElementChild?.className).toContain("rounded-xl");
  });
});

describe("excerpt (math-aware)", () => {
  it("mengembalikan teks apa adanya jika lebih pendek dari batas", () => {
    expect(excerpt("Teks pendek", 50)).toBe("Teks pendek");
  });

  it("memotong teks biasa dengan elipsis", () => {
    const res = excerpt("Ini adalah teks yang cukup panjang untuk diuji pemotongannya", 20);
    expect(res).toContain("…");
    expect(res.endsWith("…")).toBe(true);
  });

  it("tidak membelah rumus matematika di tengah delimiter", () => {
    const input = "Tentukan nilai dari \\(x^2 - 4x + 4 = 0\\) jika diketahui x positif";
    const res = excerpt(input, 30);
    expect(res).toBe("Tentukan nilai dari…");
  });

  it("menyertakan rumus lengkap jika muat sebelum batas", () => {
    const input = "Hitung \\(2+2\\) sekarang juga";
    const res = excerpt(input, 50);
    expect(res).toBe("Hitung \\(2+2\\) sekarang juga");
  });

  it("menangani rumus display \\[...\\] dan $$...$$", () => {
    const input = "Rumus: \\[E = mc^2\\] dengan c konstan";
    const res = excerpt(input, 10);
    expect(res).toBe("Rumus:…");

    const input2 = "Rumus: $$a^2 + b^2 = c^2$$";
    expect(excerpt(input2, 10)).toBe("Rumus:…");
  });

  it("jika soal diawali rumus panjang, mengembalikan rumus pertama utuh dengan elipsis", () => {
    const input = "\\(x^2 + y^2 = r^2\\) adalah persamaan lingkaran dengan pusat di titik asal";
    const res = excerpt(input, 10);
    expect(res).toBe("\\(x^2 + y^2 = r^2\\)…");
  });

  it("memotong teks sisa setelah rumus jika melebihi batas", () => {
    const input = "Nilai $x$ adalah bilangan bulat positif yang sangat amat besar sekali";
    const res = excerpt(input, 20);
    expect(res).toContain("Nilai $x$ adalah");
    expect(res.endsWith("…")).toBe(true);
  });
});

describe("formatGradeBadge", () => {
  it("menormalkan jenjang SMP ke format 2 digit", () => {
    expect(formatGradeBadge("SMP 08")).toBe("08");
    expect(formatGradeBadge("smp7")).toBe("07");
    expect(formatGradeBadge("8")).toBe("08");
  });

  it("menormalkan jenjang SD ke format 2 digit", () => {
    expect(formatGradeBadge("SD 04")).toBe("04");
    expect(formatGradeBadge("sd5")).toBe("05");
    expect(formatGradeBadge("3")).toBe("03");
  });

  it("mempertahankan SMA dan variasi lain", () => {
    expect(formatGradeBadge("10")).toBe("10");
    expect(formatGradeBadge("11W")).toBe("11W");
    expect(formatGradeBadge("12L")).toBe("12L");
    expect(formatGradeBadge("utbk")).toBe("UTBK");
    expect(formatGradeBadge("mandiri")).toBe("MDR");
    expect(formatGradeBadge("umum")).toBe("UMUM");
    expect(formatGradeBadge("olimpiade")).toBe("OLIMPIADE");
  });
});

describe("QuestionTypeIcon", () => {
  const types = [
    "single_choice",
    "multiple_choice_checkbox",
    "essay",
    "short_answer",
    "matching",
    "matrix_grid",
    "quantitative_pq",
    "combination_1234",
    "data_sufficiency",
    "assertion_reason",
    "stimulus",
    "unknown_custom_type",
  ];

  it.each(types)("merender ikon untuk tipe %s tanpa crash", (type) => {
    const { container } = render(<QuestionTypeIcon type={type} />);
    expect(container.querySelector("button")).toBeInTheDocument();
  });
});

describe("QuestionCard grid & masonry dengan opsi dan stimulus", () => {
  it("merender kartu dengan opsi dan stimulus pada mode grid", () => {
    const withParentAndOpts = q({
      parent: { id: "p1", contentMarkdown: "Wacana utama bacaan" } as any,
      options: [
        { id: "o1", questionId: "q1", label: "A", contentMarkdown: "Opsi A", isCorrect: true, distractorRationale: null, orderIndex: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: "o2", questionId: "q1", label: "B", contentMarkdown: "Opsi B", isCorrect: false, distractorRationale: null, orderIndex: 1, createdAt: new Date(), updatedAt: new Date() },
      ],
    });
    const { container } = render(
      <QuestionCard question={withParentAndOpts} href="/q/1" mode="grid" onToggleSelect={() => {}} selected />,
    );
    expect(container.textContent).toContain("Wacana utama bacaan");
    expect(container.textContent).toContain("Opsi A");
    expect(container.textContent).toContain("✓");
  });

  it("merender kartu dengan opsi pada mode masonry", () => {
    const withOpts = q({
      options: [
        { id: "o1", questionId: "q1", label: "A", contentMarkdown: "Opsi A", isCorrect: false, distractorRationale: null, orderIndex: 0, createdAt: new Date(), updatedAt: new Date() },
      ],
    });
    const { container } = render(
      <QuestionCard question={withOpts} href="/q/1" mode="masonry" />,
    );
    expect(container.textContent).toContain("Opsi A");
  });
});
