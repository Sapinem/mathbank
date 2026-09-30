import { describe, it, expect } from "vitest";
import {
  cleanHtml,
  decodeEntities,
  stripShortcodes,
  structureToMarkdown,
  normalizeMath,
  normalizeWhitespace,
  extractImages,
  stripNoiseBlocks,
} from "./clean";

describe("clean — entitas (decodeEntities)", () => {
  it("decode desimal, hex, dan bernama", () => {
    expect(decodeEntities("you&#8217;re")).toBe("you\u2019re");
    expect(decodeEntities("&#x41;")).toBe("A");
    expect(decodeEntities("A&nbsp;B")).toBe("A B");
    expect(decodeEntities("x &amp; y")).toBe("x & y");
  });

  it("entitas tak dikenal dibiarkan apa adanya", () => {
    expect(decodeEntities("&foo; &bar;")).toBe("&foo; &bar;");
  });

  it("abaikan kode titik tak valid (surrogate/out-of-range)", () => {
    expect(decodeEntities("&#xD800;")).toBe("");
    expect(decodeEntities("&#999999999;")).toBe("");
  });
});

describe("clean — shortcode DAFTAR-HITAM (bukan buang-semua)", () => {
  it("buang [collapse] & [spoiler] (dengan/ tanpa penutup)", () => {
    expect(stripShortcodes("a [collapse] b")).toBe("a  b");
    expect(stripShortcodes("a [/collapse] b")).toBe("a  b");
    expect(stripShortcodes("a [spoiler]x[/spoiler] b")).toBe("a x b");
  });

  it("PERTAHANKAN [n] / [m] / [type] (ini LaTeX, bukan shortcode)", () => {
    // Kasus nyata korpus: $\sqrt[n]{a}$ , $[n]=\{1,\dots,n\}$
    expect(stripShortcodes("$\\sqrt[n]{a}$")).toBe("$\\sqrt[n]{a}$");
    expect(stripShortcodes("$[n] = \\{1, 2\\}$")).toBe("$[n] = \\{1, 2\\}$");
    expect(stripShortcodes("$\\sqrt[m]{\\sqrt[n]{a}}$")).toBe("$\\sqrt[m]{\\sqrt[n]{a}}$");
  });
});

describe("clean — struktur → markdown", () => {
  it("<br> → newline, <hr> → ---", () => {
    expect(structureToMarkdown("a<br/>b")).toBe("a\nb");
    expect(structureToMarkdown("a<hr>b")).toContain("---");
  });

  it("<ol>/<ul>/<li> → daftar markdown", () => {
    const ol = structureToMarkdown("<ol><li>Satu</li><li>Dua</li></ol>");
    expect(ol).toContain("1. Satu");
    expect(ol).toContain("2. Dua");
    const ul = structureToMarkdown("<ul><li>Apel</li><li>Jeruk</li></ul>");
    expect(ul).toContain("- Apel");
    expect(ul).toContain("- Jeruk");
  });

  it("<blockquote> → '>' dan <code> → backtick", () => {
    expect(structureToMarkdown("<blockquote>kutipan</blockquote>")).toContain("> kutipan");
    expect(structureToMarkdown("pakai <code>x=1</code>")).toContain("`x=1`");
  });

  it("<table> DIPERTAHANKAN (tidak diubah markdown)", () => {
    const t = structureToMarkdown("<table><tr><td>A</td></tr></table>");
    expect(t).toContain("<table>");
  });
});

describe("clean — media (extractImages)", () => {
  it("<img> → markdown + kumpulkan URL unik", () => {
    const { text, media } = extractImages(
      '<img src="/a.png" alt="Gambar A"> teks <img src="/a.png"> <img src="/b.jpg">',
    );
    expect(text).toContain("![Gambar A](/a.png)");
    expect(text).toContain("![](/b.jpg)".replace("![]", "![Gambar]"));
    expect(media).toEqual(["/a.png", "/b.jpg"]);
  });
});

describe("clean — buang blok kotor (stripNoiseBlocks)", () => {
  it("buang <script> (di mana pun, termasuk badan artikel)", () => {
    const html = '<p>teks</p><script>let lbl=[];lbl.push("x")</script>sisa';
    const out = stripNoiseBlocks(html);
    expect(out).not.toContain("lbl");
    expect(out).toContain("sisa");
  });

  it("buang iklan AdSense + div class hash", () => {
    const html =
      '<p>soal</p><div class="fd26c469e8373073dba45b1b47e66778"><script async src="https://pagead2.googlesyndication.com/x.js"></script><ins class="adsbygoogle"></ins></div><p>lanjut</p>';
    const out = stripNoiseBlocks(html);
    expect(out).not.toContain("adsbygoogle");
    expect(out).toContain("lanjut");
  });

  it("buang komentar HTML dan boilerplate (<footer>)", () => {
    const out = stripNoiseBlocks("<!-- rahasia --><footer>hak cipta</footer>isi");
    expect(out).not.toContain("rahasia");
    expect(out).not.toContain("hak cipta");
    expect(out).toContain("isi");
  });
});

describe("clean — normalisasi math", () => {
  it("$$…$$ → \\[…\\], $…$ → \\(…\\)", () => {
    expect(normalizeMath("$$x^2$$").text).toBe("\\[x^2\\]");
    expect(normalizeMath("nilai $x+1$ disini").text).toBe("nilai \\(x+1\\) disini");
  });

  it("deteksi delimiter tak seimbang", () => {
    expect(normalizeMath("harga $5 tanpa penutup").imbalanced).toBe(true);
    expect(normalizeMath("ok $a$ dan $b$").imbalanced).toBe(false);
  });

  it("perbaiki \\cancelto → \\overset{}{\\cancel{}} dan \\\\[Npt] → \\\\", () => {
    expect(normalizeMath("\\cancelto{a}{b}").text).toBe("\\overset{a}{\\cancel{b}}");
    expect(normalizeMath("x \\\\[10pt] y").text).toBe("x \\\\ y");
  });
});

describe("clean — normalisasi spasi", () => {
  it("nbsp, spasi ganda, baris kosong berlebih", () => {
    expect(normalizeWhitespace("a\u00a0\u00a0b")).toBe("a b");
    expect(normalizeWhitespace("a   b")).toBe("a b");
    expect(normalizeWhitespace("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("clean — pipa lengkap (cleanHtml)", () => {
  it("JB-1: &amp; DI DALAM LaTeX tetap jadi & (perataan align)", () => {
    // Kasus nyata korpus: \begin{aligned} … &amp; = … \end{aligned}
    const raw =
      '<p><span style="font-size:15px">$$\\begin{aligned} \\overline{5abcde} &amp; = 26 \\times x \\\\ 500 &amp; = 2 \\end{aligned}$$</span></p>';
    const { text } = cleanHtml(raw);
    expect(text).toContain("\\begin{aligned}");
    expect(text).toContain("& = 26"); // &amp; → & (bukan "&amp;")
    expect(text).not.toContain("&amp;");
    // math ternormalisasi: $$…$$ → \[…\]
    expect(text).toContain("\\[");
  });

  it("JB-2: artikel tanpa penanda (artikel murni) → teks bersih tanpa error", () => {
    const raw = "<p>Ini hanya artikel biasa tanpa soal.</p>";
    const { text, warnings } = cleanHtml(raw);
    expect(text).toBe("Ini hanya artikel biasa tanpa soal.");
    expect(warnings).toEqual([]);
  });

  it("JB-3: HTML kosong → catatan", () => {
    const r = cleanHtml("");
    expect(r.text).toBe("");
    expect(r.warnings).toContain("HTML kosong");
  });

  it("JB-4: delimiter $ ganjil → peringatan (tidak crash)", () => {
    const { warnings } = cleanHtml("<p>harga $5</p>");
    expect(warnings.some((w) => w.includes("tak seimbang"))).toBe(true);
  });

  it("integrasi: script+iklan+entitas+list+math bersih semuanya", () => {
    const raw = `
      <!-- iklan -->
      <div class="fd26c469e8373073dba45b1b47e66778"><ins class="adsbygoogle"></ins></div>
      <script>adsbygoogle.push({})</script>
      <p>Tentukan nilai $x$ dari persamaan berikut.</p>
      <ol><li>Langkah $&#8217;1&#8217;$</li><li>Langkah kedua</li></ol>
      <footer>© Situs</footer>
      <img src="/gambar.png" alt="Diagram">
    `;
    const { text, media } = cleanHtml(raw);
    expect(text).not.toContain("adsbygoogle");
    expect(text).not.toContain("<");
    expect(text).not.toContain("&amp;");
    expect(text).toContain("1. Langkah"); // list → markdown
    expect(text).toContain("\\("); // math inline ternormalisasi
    expect(text).toContain("![Diagram](/gambar.png)");
    expect(media).toEqual(["/gambar.png"]);
  });
});
