import { describe, it, expect } from "vitest";
import { structureToMarkdown } from "./clean";

describe("structureToMarkdown — tabel HTML → markdown", () => {
  it("tabel sederhana → markdown pipe", () => {
    const html = "<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>";
    const out = structureToMarkdown(html);
    expect(out).toContain("| A | B |");
    expect(out).toContain("| 1 | 2 |");
    expect(out).toContain("| --- | --- |");
    expect(out).not.toContain("<td>");
    expect(out).not.toContain("<tr>");
  });

  it("tabel dgn rumus di dalam sel tetap utuh", () => {
    const html = "<table><tr><td>Buku</td><td>$Rp1.000$</td></tr></table>";
    const out = structureToMarkdown(html);
    expect(out).toContain("| Buku | $Rp1.000$ |");
    expect(out).not.toContain("<td>");
  });

  it("th jadi baris header", () => {
    const html = "<table><tr><th>Nama</th><th>Nilai</th></tr><tr><td>Ana</td><td>90</td></tr></table>";
    const out = structureToMarkdown(html);
    expect(out).toContain("| Nama | Nilai |");
    expect(out).toContain("| --- | --- |");
  });

  it("baris dgn jumlah sel berbeda tetap ditulis (tak crash)", () => {
    const html = "<table><tr><td>A</td><td>B</td></tr><tr><td>1</td></tr></table>";
    const out = structureToMarkdown(html);
    expect(out).toContain("| A | B |");
    expect(out).toContain("| 1 |");
  });

  it("tag td/tr/table sisa TIDAK lolos", () => {
    const html = "<table class=\"table\"><tr> <td>Buku</td> <td> $Rp1.000$</td></tr></table>";
    const out = structureToMarkdown(html);
    expect(out).not.toMatch(/<\/?t[dhr]|<\/?table/i);
  });
});
