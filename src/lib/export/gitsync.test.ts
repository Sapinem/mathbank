import { describe, it, expect } from "vitest";
import { buildGitsyncFiles, sanitizeName, type GitsyncQuestion } from "./gitsync";

function q(over: Partial<GitsyncQuestion> = {}): GitsyncQuestion {
  return {
    type: "single_choice",
    content: "Berapa $1+1$?",
    options: [
      { label: "A", content: "1", isCorrect: false },
      { label: "B", content: "2", isCorrect: true },
    ],
    name: "Soal",
    topicPath: ["Aljabar"],
    ...over,
  };
}

/** Ambil isi berkas berdasarkan jalur. */
function fileContent(res: ReturnType<typeof buildGitsyncFiles>, path: string): string {
  return res.files.find((f) => f.path === path)?.content ?? "";
}

describe("sanitizeName (sesuai BAD_CHARACTERS GitSync)", () => {
  it("spasi → - (spasi termasuk karakter buruk GitSync)", () => {
    expect(sanitizeName("Hitung cepat")).toBe("Hitung-cepat");
  });
  it("titik, $, !, &, backtick → -", () => {
    expect(sanitizeName("x^2.dan-3")).toBe("x^2-dan-3");
    expect(sanitizeName("a$b!c&d`e")).toBe("a-b-c-d-e");
  });
  it("^ dan _ DIPERTAHANKAN (bukan karakter buruk GitSync)", () => {
    expect(sanitizeName("x^2_y")).toBe("x^2_y");
  });
  it("potong dulu lalu sanitasi (maxLength)", () => {
    expect(sanitizeName("a".repeat(300), 50).length).toBe(50);
  });
  it("kosong → 'soal'", () => {
    expect(sanitizeName("   ")).toBe("soal");
  });
});

describe("gitsync berkas (D7 — tanpa ZIP)", () => {
  it("struktur folder topik + gitsync_category.xml tiap level", () => {
    const r = buildGitsyncFiles([q({ topicPath: ["Aljabar", "Operasi"] })]);
    expect(r.ok).toBe(true);
    expect(r.paths).toContain("top/Aljabar/gitsync_category.xml");
    expect(r.paths).toContain("top/Aljabar/Operasi/gitsync_category.xml");
    expect(
      r.paths.some(
        (p) => p.startsWith("top/Aljabar/Operasi/") && p.endsWith(".xml") && !p.includes("gitsync_category"),
      ),
    ).toBe(true);
  });

  it("soal tanpa topik → folder 'Tanpa Topik'", () => {
    const r = buildGitsyncFiles([q({ topicPath: [] })]);
    expect(r.paths.some((p) => p.startsWith("top/Tanpa-Topik/"))).toBe(true);
  });

  it("berkas soal = XML Moodle valid dengan \\( \\)", () => {
    const r = buildGitsyncFiles([q()]);
    const questionFile = r.paths.find((p) => p.endsWith(".xml") && !p.includes("gitsync_category"))!;
    const xml = fileContent(r, questionFile);
    expect(xml).toContain("<quiz>");
    expect(xml).toContain("\\(1+1\\)");
    expect(xml).toContain('fraction="100"');
  });

  it("D4: soal tanpa kunci → ok=false, files kosong", () => {
    const r = buildGitsyncFiles([q({ options: [{ label: "A", content: "x", isCorrect: false }] })]);
    expect(r.ok).toBe(false);
    expect(r.files).toHaveLength(0);
    expect(r.withoutAnswerKey).toHaveLength(1);
  });

  it("tipe tak dipetakan dilewati & dilaporkan", () => {
    const r = buildGitsyncFiles([q({ type: "matrix_grid" })]);
    expect(r.skipped).toHaveLength(1);
    expect(r.exported).toBe(0);
  });

  it("gitsync_category.xml = <question><category><text>top/Path</text>", () => {
    const r = buildGitsyncFiles([q({ topicPath: ["Aljabar & Fungsi"] })]);
    const xml = fileContent(r, "top/Aljabar-Fungsi/gitsync_category.xml");
    expect(xml).toContain("<question>");
    expect(xml).toContain("<category>");
    expect(xml).toContain("<text>top/Aljabar &amp; Fungsi</text>");
  });

  it("tiap level kategori punya jalur bertingkat", () => {
    const r = buildGitsyncFiles([q({ topicPath: ["Aljabar", "Operasi"] })]);
    expect(fileContent(r, "top/Aljabar/gitsync_category.xml")).toContain("<text>top/Aljabar</text>");
    expect(fileContent(r, "top/Aljabar/Operasi/gitsync_category.xml")).toContain(
      "<text>top/Aljabar/Operasi</text>",
    );
  });

  it("nama berkas soal TANPA prefiks nomor; bentrok → _2", () => {
    const r = buildGitsyncFiles([q({ name: "Soal Sama" }), q({ name: "Soal Sama" })]);
    const names = r.paths.filter((p) => !p.includes("gitsync_category"));
    expect(names.some((p) => p.endsWith("Soal-Sama.xml"))).toBe(true);
    expect(names.some((p) => p.endsWith("Soal-Sama_2.xml"))).toBe(true);
  });

  it("folder kategori dibuat sekali walau banyak soal", () => {
    const r = buildGitsyncFiles([q({ name: "A" }), q({ name: "B" }), q({ name: "C" })]);
    const cats = r.paths.filter((p) => p.endsWith("gitsync_category.xml"));
    expect(cats).toEqual(["top/Aljabar/gitsync_category.xml"]);
  });
});
