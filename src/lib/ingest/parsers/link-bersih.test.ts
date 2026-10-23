import { describe, it, expect } from "vitest";
import { stripTags, cleanHtml } from "./clean";

/**
 * BUG NYATA (43 soal/solusi defantri): tag `<a href=…>` BOCOR ke output.
 *
 * Akar: penyembunyian math di `stripTags` memakai `[\s\S]` yang menyeberangi
 * PARAGRAF → `<a href=… style=… title=…>` ikut tersembunyi di placeholder,
 * lalu dikembalikan UTUH (jadi tak pernah dibuang).
 *
 * Perbaikan: (a) penanda `<a[\s>]` dilarang di semua pola hide, (b) `<a …>…</a>`
 * dibuang pakai penanda `</a>` setelah hide & sebelum buang-tag.
 */
describe("stripTags — link <a> tidak boleh bocor", () => {
  const LINK_PANJANG =
    '<a href="https://www.defantri.com/2019/11/cara.html" style="color: black" target="_blank" title="Cara Menentukan Fungsi Kuadrat dan Pembahasan Soal">catatan fungsi kuadrat</a>';

  it("link di antara dua rumus TIDAK bocor (bug asli)", () => {
    const html = `$y=\\dfrac{df(x)}{dx}$ atau turunan $f(x)$, sehingga $f(x)$ belum diketahui.</p>\n\n<p>Dengan menggunakan ${LINK_PANJANG}, dapat kita ketahui $f(x)$ adalah:`;
    const out = stripTags(html);
    expect(out).not.toMatch(/<a\b/i);
    expect(out).not.toMatch(/href=/i);
    expect(out).toContain("catatan fungsi kuadrat"); // teks jangkar tetap ada
  });

  it("cleanHtml juga bersih", () => {
    const html = `teks $x$ ${LINK_PANJANG} lalu $y$ dan $z$`;
    expect(cleanHtml(html).text).not.toMatch(/<a\b/i);
  });

  it("beberapa link berturut-turut", () => {
    const out = stripTags(`A ${LINK_PANJANG} B ${LINK_PANJANG} C`);
    expect(out.match(/<a\b/gi)).toBeNull();
    expect(out.match(/catatan fungsi kuadrat/g)?.length).toBe(2);
  });

  it("math sah memuat `<a` TIDAK rusak (`$0<a<1$`)", () => {
    expect(stripTags("$0<a<1$ dan $x>5$")).toContain("$0<a<1$ dan $x>5$");
  });

  it("math sah `<a` + link nyata bercampur", () => {
    const out = stripTags(`nilai $0<a<1$ dan ${LINK_PANJANG} selesai`);
    expect(out).toContain("$0<a<1$"); // math sah utuh
    expect(out).not.toMatch(/<a\s+href/i); // tag link benar-benar hilang
    expect(out).toContain("catatan fungsi kuadrat");
  });

  it("`</a>` yatim (tanpa pembuka) dibuang", () => {
    const out = stripTags("teks </a> lanjut");
    expect(out).not.toMatch(/<\/a>/i);
  });
});
