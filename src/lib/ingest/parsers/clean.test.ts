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
  stripTags,
  isSvgIcon,
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
  it("<br> → newline, <hr> → dibuang", () => {
    expect(structureToMarkdown("a<br/>b")).toBe("a\nb");
    // <hr> kini DIBUANG (temuan: 0 blok di korpus)
    expect(structureToMarkdown("a<hr>b")).not.toContain("---");
    expect(structureToMarkdown("a<hr>b")).toContain("a");
  });

  it("<ol>/<ul>/<li> → daftar markdown", () => {
    const ol = structureToMarkdown("<ol><li>Satu</li><li>Dua</li></ol>");
    expect(ol).toContain("1. Satu");
    expect(ol).toContain("2. Dua");
    const ul = structureToMarkdown("<ul><li>Apel</li><li>Jeruk</li></ul>");
    expect(ul).toContain("- Apel");
    expect(ul).toContain("- Jeruk");
  });

  it("daftar bersarang → indentasi 2 spasi per level", () => {
    const nested = structureToMarkdown(
      "<ul><li>Induk<ol><li>Anak1</li><li>Anak2</li></ol></li><li>Induk2</li></ul>",
    );
    expect(nested).toContain("- Induk");
    expect(nested).toContain("  1. Anak1"); // 2 spasi indent
    expect(nested).toContain("  2. Anak2");
    expect(nested).toContain("- Induk2");
  });

  it("<blockquote> → tag dilepas, ISI TETAP (jangan dibuang)", () => {
    const out = structureToMarkdown("<blockquote>Soal penting A B C</blockquote>");
    expect(out).toContain("Soal penting A B C");
    expect(out).not.toContain(">"); // tak diberi tanda kutipan
  });

  it("<pre>/<code> → DIBUANG (kode/sampah, bukan soal)", () => {
    expect(structureToMarkdown("pakai <code>x=1</code>")).not.toContain("x=1");
    expect(structureToMarkdown("<pre>If(a,b)</pre>")).not.toContain("If(a,b)");
  });

  it("<br> di dalam <table> DIBIARKAN <br>", () => {
    const t = structureToMarkdown("<table><tr><td>A<br>B</td></tr></table>");
    expect(t).toContain("<table>");
    expect(t).toContain("<br");
    expect(t).not.toContain("A\nB");
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

describe("clean — SVG (ikon dibuang, diagram dipertahankan)", () => {
  it("SVG ikon kecil (viewBox 24x24) → dibuang", () => {
    const icon = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 16V4"/></svg>';
    expect(stripNoiseBlocks(`a${icon}b`)).toBe("ab");
  });

  it("SVG diagram (viewBox besar, banyak line) → DIPERTAHANKAN", () => {
    const diagram =
      '<svg viewBox="-130 -130 260 260" width="100%"><line x1="0"/><line x1="1"/><line x1="2"/><line x1="3"/><line x1="4"/><polygon points="0,0"/></svg>';
    expect(stripNoiseBlocks(`a${diagram}b`)).toContain("<svg");
  });

  it("isSvgIcon — klasifikasi ikon vs diagram", () => {
    expect(isSvgIcon('<svg width="18" height="18" viewBox="0 0 24 24"><path d="M1"/></svg>')).toBe(true);
    expect(isSvgIcon('<svg viewBox="-130 -130 260 260"><polygon/></svg>')).toBe(false);
    expect(isSvgIcon('<svg width="200" height="200"><path d="M1"/></svg>')).toBe(false);
    expect(isSvgIcon('<svg viewBox="0 0 100 60"><rect/></svg>')).toBe(false);
    expect(isSvgIcon('<svg><path/><path/><path/><path/><path/></svg>')).toBe(false);
    expect(isSvgIcon('<svg><path/></svg>')).toBe(true);
    // viewBox 24x24 menang walau banyak elemen
    expect(isSvgIcon('<svg viewBox="0 0 24 24"><line/><line/><line/><line/><line/><line/></svg>')).toBe(true);
  });
});

describe("clean — figcaption → caption markdown", () => {
  it("<figcaption> → *caption*", () => {
    const { text } = extractImages(
      '<figure><img src="/x.png" alt="p"><figcaption>Bendera Inggris</figcaption></figure>',
    );
    expect(text).toContain("![p](/x.png)");
    expect(text).toContain("*Bendera Inggris*");
    expect(text).not.toContain("figcaption");
  });
});

describe("clean — stripTags melindungi math (Opsi C)", () => {
  it("math $x>5$ / $a<b$ TIDAK rusak", () => {
    expect(stripTags("nilai $x>5$ penting")).toContain("$x>5$");
    expect(stripTags("$2<x<3$")).toContain("$2<x<3$");
    // kasus lintas-math (sebelumnya rusak jadi "$0 5$")
    expect(stripTags("$0<a<1$ dan $x>5$")).toContain("$0<a<1$ dan $x>5$");
    expect(stripTags("$4<t<5$ jadi $y>2$")).toContain("$4<t<5$ jadi $y>2$");
  });

  it("tag asli tetap dibuang", () => {
    expect(stripTags("<span>Halo</span>")).toContain("Halo");
    expect(stripTags("<span>Halo</span>")).not.toContain("<span>");
  });
});

describe("clean — entitas lengkap (D2)", () => {
  it("&ensp; &ang; &sup2; &sup3; &fnof; &ordm; &pi; ter-decode", () => {
    expect(decodeEntities("A&ensp;B")).toBe("A B");
    expect(decodeEntities("&ang;ABC")).toBe("∠ABC");
    expect(decodeEntities("x&sup2;")).toBe("x²");
    expect(decodeEntities("x&sup3;")).toBe("x³");
    expect(decodeEntities("&fnof;(x)")).toBe("ƒ(x)");
    expect(decodeEntities("1&ordm;")).toBe("1º");
    expect(decodeEntities("&pi;")).toBe("π");
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
