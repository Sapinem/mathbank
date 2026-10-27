import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionCard, QuestionTypeIcon, excerpt, flattenMathForList, stripImages, formatGradeBadge } from "./question-card";
import type { PublicQuestion } from "@/lib/services/question-service";

/** Soal uji minimal (hanya field yang dirender kartu). */
function q(over: Partial<PublicQuestion> = {}): PublicQuestion {
  const grade = over.grade !== undefined ? over.grade : "SMA-11";
  const grades = over.grades !== undefined ? over.grades : (grade ? [grade] : []);
  return {
    id: "q1",
    parentId: null,
    childOrder: 0,
    questionType: "single_choice",
    difficulty: 3,
    cognitiveLevel: "understand",
    grade,
    grades,
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
    // Status kini berupa ikon dengan aria-label tanpa teks tulisan (ruang teks maksimal)
    expect(screen.getByLabelText("Status: Draf")).toBeInTheDocument();
    // grade dirender sebagai penanda ikon + "SMA-11"
    expect(container.textContent).toContain("SMA-11");
    // Difficulty 3 → penanda ikon gauge + angka "3" langsung (tanpa "Lv.")
    expect(container.textContent).toContain("3");
    expect(container.textContent).not.toContain("Lv.3");
    expect(container.textContent).not.toContain("●●●○○");
    // cognitiveLevel "understand" → penanda ikon brain + angka "2" langsung (tanpa "C")
    expect(container.textContent).toContain("2");
    expect(container.textContent).not.toContain("C2");
  });

  it("status Siap tidak dirender teks eksplisit di kartu namun memiliki penanda aksesibel", () => {
    render(
      <QuestionCard
        question={q({ status: "ready" })}
        href="/questions/q1"
      />,
    );
    expect(screen.queryByText("Siap")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status: Siap")).toBeInTheDocument();
  });

  it("menampilkan topik utama di bagian kiri header kartu mode grid", () => {
    const questionWithTopic = q({
      topics: [
        { id: "t1", name: "Aljabar Linear", level: 2, isPrimary: true },
      ],
    });
    render(<QuestionCard question={questionWithTopic} href="/questions/q1" mode="grid" />);
    expect(screen.getByText("Aljabar Linear")).toBeInTheDocument();
  });

  it("menampilkan topik utama di mode list bila tersedia", () => {
    const questionWithTopic = q({
      topics: [
        { id: "t2", name: "Trigonometri", level: 2, isPrimary: true },
      ],
    });
    render(<QuestionCard question={questionWithTopic} href="/questions/q1" mode="list" />);
    expect(screen.getByText("Trigonometri")).toBeInTheDocument();
  });

  it("penanda jenjang memakai ikon + angka dengan aria-label lengkap", () => {
    render(
      <QuestionCard question={q({ grade: "10" })} href="/questions/q1" />,
    );
    expect(screen.getByLabelText("Kelas 10")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("penanda multi-jenjang merender gabungan kode dan aria-label", () => {
    render(
      <QuestionCard question={q({ grades: ["08", "11"] })} href="/questions/q1" />,
    );
    expect(screen.getByLabelText(/Kelas 08, Kelas 11/)).toBeInTheDocument();
    expect(screen.getByText("08 · 11")).toBeInTheDocument();
  });

  it("soal tanpa jenjang tidak merender penanda kelas (kartu bersih)", () => {
    const { container } = render(
      <QuestionCard question={q({ grade: null, grades: [] })} href="/questions/q1" />,
    );
    expect(container.querySelector('button[aria-label^="Kelas"]')).toBeNull();
  });

  it("checkbox seleksi kartu dapat diakses dan tampil di mode list", () => {
    render(
      <QuestionCard
        question={q()}
        href="/questions/q1"
        onToggleSelect={() => {}}
      />,
    );
    // aria-label PR #6 dipertahankan: "Pilih soal: <kutipan batang>".
    expect(screen.getByLabelText(/Pilih soal:/)).toBeInTheDocument();
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
    expect(screen.queryByLabelText(/Pilih soal/)).not.toBeInTheDocument();
    rerender(<QuestionCard question={q()} href="/x" onToggleSelect={onToggle} />);
    const cb = screen.getByLabelText(/Pilih soal: Berapa/);
    expect(cb).toBeInTheDocument();
    // klik → memanggil callback dengan id soal
    cb.click();
    expect(onToggle).toHaveBeenCalledWith("q1");
  });

  it("nama aksesibel checkbox pada mode list dan tautan Buka berkonteks soal", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <QuestionCard question={q()} href="/x" onToggleSelect={onToggle} mode="list" />,
    );
    expect(screen.getByLabelText(/Pilih soal: Berapa/)).toBeInTheDocument();

    rerender(
      <QuestionCard question={q()} href="/x" onToggleSelect={onToggle} mode="grid" />,
    );
    expect(screen.getByLabelText(/Buka soal: Berapa/)).toBeInTheDocument();
    // Di mode grid, kotak ceklis benar-benar dihilangkan dari UI
    expect(screen.queryByLabelText(/Pilih soal: Berapa/)).not.toBeInTheDocument();
    // Kunci jawaban tidak boleh bocor ke nama aksesibel (batang saja, bukan opsi).
    expect(screen.queryByLabelText(/isCorrect|jawaban benar/i)).not.toBeInTheDocument();
  });

  it("mode grid dapat diseleksi via klik saat mode seleksi atau Ctrl/Cmd+klik tanpa kotak ceklis", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <QuestionCard question={q()} href="/x" onToggleSelect={onToggle} mode="grid" isSelectionMode={true} />,
    );
    // Klik konten naskah saat mode seleksi aktif memanggil onToggleSelect
    screen.getByText(/Berapa/).click();
    expect(onToggle).toHaveBeenCalledWith("q1");

    onToggle.mockClear();
    rerender(
      <QuestionCard question={q()} href="/x" onToggleSelect={onToggle} mode="grid" isSelectionMode={false} />,
    );
    // Ctrl+klik memanggil onToggleSelect
    const content = screen.getByText(/Berapa/);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    content.dispatchEvent(event);
    expect(onToggle).toHaveBeenCalledWith("q1");
  });

  it("status pada kartu berupa ikon murni dengan aria-label tanpa teks tulisan", () => {
    const { container } = render(
      <QuestionCard question={q({ status: "review" })} href="/x" />,
    );
    // Sesuai arahan: status murni ikon tanpa teks ("Telaah"/"Draf") agar ruang teks maksimal,
    // aria-label tetap lengkap untuk aksesibilitas dan tooltip.
    expect(screen.getByLabelText("Status: Perlu Telaah")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Telaah");
    expect(container.textContent).not.toContain("Perlu Telaah");
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
      parent: { id: "p1", contentMarkdown: "Wacana utama bacaan" },
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

describe("stripImages & flattenMathForList", () => {
  it("membersihkan shortcode {{img:...}} dan markdown image termasuk variasi spasi", () => {
    const input = "Perhatikan gambar berikut!\n\n{{ img: n5QjZMTJ }}\n\nBerapa nilai x?";
    expect(stripImages(input)).toBe("Perhatikan gambar berikut!\n\n\n\nBerapa nilai x?");
    expect(stripImages("Teks ![diagram](https://example.com/a.png) lanjut")).toBe("Teks  lanjut");
  });

  it("meratakan lingkungan matriks dan cases menjadi inline sekaligus menghapus gambar untuk mode list", () => {
    const input = "\\begin{matrix} a \\\\ b \\end{matrix} {{img:XYZ123}}";
    expect(flattenMathForList(input)).toBe(" a ,\\;  b  ");
  });

  it("meratakan pmatrix, bmatrix, dan aligned serta mengganti & dengan pemisah aman", () => {
    const input = "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix} dan \\begin{aligned} x &= 1 \\\\ y &= 2 \\end{aligned}";
    expect(flattenMathForList(input)).toBe(" 1 ,\\;  2 ,\\;  3 ,\\;  4  dan  x = 1 ,\\;  y = 2 ");
  });

  it("meratakan vmatrix dan align*", () => {
    const input = "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} dan \\begin{align*} 2x + y &= 5 \\end{align*}";
    expect(flattenMathForList(input)).toBe(" a ,\\;  b ,\\;  c ,\\;  d  dan  2x + y = 5 ");
  });
});
