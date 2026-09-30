import { describe, it, expect } from "vitest";
import { escapeXmlAttr, escapeXmlText, cdata } from "./xml-escape";

describe("xml-escape", () => {
  it("escape atribut: & < > \" '", () => {
    expect(escapeXmlAttr(`a&b<c>d"e'f`)).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });

  it("escape teks: & < >", () => {
    expect(escapeXmlText(`a&b<c>d`)).toBe("a&amp;b&lt;c&gt;d");
  });

  it("CDATA membungkus apa adanya", () => {
    expect(cdata("x < y & z")).toBe("<![CDATA[x < y & z]]>");
  });

  it("CDATA memecah urutan terlarang ]]>", () => {
    const out = cdata("a]]>b");
    expect(out).not.toContain("]]>b");
    expect(out.startsWith("<![CDATA[")).toBe(true);
    expect(out.endsWith("]]>")).toBe(true);
    // Hasil akhir setelah strip penanda harus sama dengan input asli.
    const inner = out.slice("<![CDATA[".length, -"]]>".length);
    const rejoined = inner.replace(/\]\]\]\]><!\[CDATA\[>/g, "]]>");
    expect(rejoined).toBe("a]]>b");
  });
});
