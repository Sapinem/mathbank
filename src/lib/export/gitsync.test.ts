import { describe, it, expect } from "vitest";
import { buildGitsyncZip, sanitizeName, type GitsyncQuestion } from "./gitsync";
import { inflateRawSync } from "node:zlib";

/** Baca nama entri dari buffer ZIP (baca central directory). */
function zipEntryNames(buf: Buffer): string[] {
  const names: string[] = [];
  // Cari signature central directory 0x02014b50.
  for (let i = 0; i + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(i) === 0x02014b50) {
      const nameLen = buf.readUInt16LE(i + 28);
      const name = buf.subarray(i + 46, i + 46 + nameLen).toString("utf8");
      names.push(name);
    }
  }
  return names;
}

/** Ekstrak satu entri (store/deflate) dari ZIP berdasarkan nama. */
function readEntry(buf: Buffer, want: string): Buffer | null {
  for (let i = 0; i + 30 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    if (buf.subarray(i + 30, i + 30 + nameLen).toString("utf8") !== want) continue;
    const start = i + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + compSize);
    return method === 8 ? inflateRawSync(data) : Buffer.from(data);
  }
  return null;
}

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

describe("sanitizeName", () => {
  it("buang karakter tidak aman", () => {
    expect(sanitizeName("Hitung 2+2 = 4 (benar)")).toBe("Hitung-2-2-4-benar");
  });
  it("jaga huruf/angka/titik/strip", () => {
    expect(sanitizeName("x^2.dan-3")).toBe("x-2.dan-3");
  });
  it("kosong → 'soal'", () => {
    expect(sanitizeName("   ")).toBe("soal");
  });
  it("batasi panjang", () => {
    expect(sanitizeName("a".repeat(300), 50).length).toBe(50);
  });
});

describe("gitsync ZIP", () => {
  it("satu soal = satu berkas .xml + struktur folder topik", () => {
    const r = buildGitsyncZip([q({ topicPath: ["Aljabar", "Operasi"] })]);
    expect(r.ok).toBe(true);
    const names = zipEntryNames(r.zip!);
    expect(names.some((n) => n === "top/Aljabar/gitsync_category.xml")).toBe(true);
    expect(names.some((n) => n === "top/Aljabar/Operasi/gitsync_category.xml")).toBe(true);
    expect(names.some((n) => n.startsWith("top/Aljabar/Operasi/") && n.endsWith(".xml") && !n.includes("gitsync_category"))).toBe(true);
  });

  it("soal tanpa topik → folder 'Tanpa Topik'", () => {
    const r = buildGitsyncZip([q({ topicPath: [] })]);
    expect(zipEntryNames(r.zip!).some((n) => n.startsWith("top/Tanpa-Topik/"))).toBe(true);
  });

  it("isi berkas soal = XML Moodle valid dengan \\ ( )", () => {
    const r = buildGitsyncZip([q()]);
    const soalName = zipEntryNames(r.zip!).find(
      (n) => n.endsWith(".xml") && !n.includes("gitsync_category"),
    )!;
    const xml = readEntry(r.zip!, soalName)!.toString("utf8");
    expect(xml).toContain("<quiz>");
    expect(xml).toContain('\\(1+1\\)');
    expect(xml).toContain('fraction="100"');
  });

  it("D4: soal tanpa kunci → ok=false, zip=null", () => {
    const r = buildGitsyncZip([q({ options: [{ label: "A", content: "x", isCorrect: false }] })]);
    expect(r.ok).toBe(false);
    expect(r.zip).toBeNull();
    expect(r.withoutAnswerKey).toHaveLength(1);
  });

  it("tipe tak dipetakan dilewati & dilaporkan", () => {
    const r = buildGitsyncZip([q({ type: "matrix_grid" })]);
    expect(r.skipped).toHaveLength(1);
    expect(r.exported).toBe(0);
  });

  it("gitsync_category.xml memakai nama ASLI (bukan folder tersanitasi)", () => {
    const r = buildGitsyncZip([q({ topicPath: ["Aljabar & Fungsi"] })]);
    const cat = zipEntryNames(r.zip!).find((n) => n.endsWith("gitsync_category.xml"))!;
    const xml = readEntry(r.zip!, cat)!.toString("utf8");
    expect(xml).toContain("<![CDATA[Aljabar & Fungsi]]>");
    expect(cat).toBe("top/Aljabar-Fungsi/gitsync_category.xml");
  });

  it("folder kategori dibuat sekali walau banyak soal", () => {
    const r = buildGitsyncZip([q({ name: "A" }), q({ name: "B" }), q({ name: "C" })]);
    const cats = zipEntryNames(r.zip!).filter((n) => n.endsWith("gitsync_category.xml"));
    expect(cats).toEqual(["top/Aljabar/gitsync_category.xml"]);
  });
});
