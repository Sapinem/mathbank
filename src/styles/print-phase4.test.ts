import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Tes aturan cetak (Fase 4) pada tingkat berkas CSS.
 *
 * jsdom tidak menghitung layout cetak nyata (tidak ada mesin paged media),
 * jadi yang bisa ditegakkan di unit test adalah: aturan penyebab luapan
 * sudah tidak ada, dan aturan pengurung/penskalaan sudah hadir. Pembuktian
 * visual di PDF nyata tetap menjadi pekerjaan manual/CI browser (lihat
 * laporan Fase 4) - tes ini bukan pengganti itu.
 */
function printCss(): string {
  // Kupas komentar: komentar Fase 4 menyebut nilai lama ("visible") sebagai
  // dokumentasi, dan itu bukan deklarasi. Yang ditegakkan = deklarasi nyata.
  return readFileSync(join(process.cwd(), "src/styles/print.css"), "utf-8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

describe("print.css - Fase 4 (A4: tidak meluber)", () => {
  it("tidak ada lagi deklarasi overflow-x: visible di cetak", () => {
    // `overflow: visible` masih dipakai di tempat yang memang harus mengalir
    // (html/body dan [data-app-scroll]) - yang dilarang hanya luapan
    // horizontal KaTeX/konten, yang ditegakkan di tes berikutnya.
    const css = printCss();
    expect(css).not.toContain("overflow-x: visible");
  });

  it("rumus display & inline cetak dikurung di dalam kolom", () => {
    const css = printCss();
    expect(css).toContain(".katex-display");
    expect(css).toMatch(/\.katex-display\s*\{[^}]*overflow-x:\s*hidden/);
    expect(css).toMatch(/\.katex-inline\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it("gambar cetak diskalakan ke lebar kolom/halaman", () => {
    const css = printCss();
    expect(css).toMatch(/\.print-sheet img\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.print-sheet img\s*\{[^}]*height:\s*auto/);
  });

  it("sel tabel cetak boleh memecah kata panjang", () => {
    const css = printCss();
    expect(css).toContain("overflow-wrap: anywhere");
  });

  it("running header memakai CSS custom property dan tidak memakai string-set yang rusak di Chromium", () => {
    const css = printCss();
    expect(css).toContain("var(--print-bundle-title");
    expect(css).not.toContain("string-set");
  });

  it("geometri kertas efisien mathmyid.cls diterapkan pada margin @page", () => {
    const css = printCss();
    expect(css).toContain("margin: 0.9cm 1cm 1.2cm 1cm");
  });

  it("gutter nomor soal diperlebar ke 28px dengan perataan kanan", () => {
    const css = printCss();
    expect(css).toMatch(/\.print-item\s*\{[^}]*padding-left:\s*28px/);
    expect(css).toMatch(/\.print-item-number\s*\{[^}]*width:\s*22px/);
    expect(css).toMatch(/\.print-item-number\s*\{[^}]*text-align:\s*right/);
  });

  it("relaksasi butir pertama diterapkan agar halaman 1 tidak bolong di bawah kop", () => {
    const css = printCss();
    expect(css).toContain(".print-item:first-child");
    expect(css).toContain('[data-first-item="true"]');
    expect(css).toMatch(/\.print-item:first-child[^}]*break-inside:\s*auto/);
  });

  it("font adaptif diterapkan per kolom naskah", () => {
    const css = printCss();
    expect(css).toContain("font-size: 10.5pt");
    expect(css).toContain("font-size: 12pt");
  });

  it("semua pembungkus shell dan scroll dinetralkan saat cetak agar halaman mengalir multi-page", () => {
    const css = printCss();
    expect(css).toContain("[data-app-shell]");
    expect(css).toContain("#konten-utama");
    expect(css).toContain("[data-slot=\"sidebar-inset\"]");
    expect(css).toContain(".print-scroll-wrapper");
    expect(css).toMatch(/\[data-app-shell\][^}]*overflow:\s*visible/);
    expect(css).toMatch(/\[data-app-shell\][^}]*height:\s*auto/);
    expect(css).toMatch(/\.worksheet\s*\{[^}]*width:\s*100%/);
  });

  it("latar berpetak worksheet-grid didefinisikan dengan repeating-linear-gradient 0.5cm dan print-color-adjust", () => {
    const css = printCss();
    expect(css).toContain(".worksheet.worksheet-grid");
    expect(css).toContain("repeating-linear-gradient");
    expect(css).toContain("0.5cm");
    expect(css).toContain("print-color-adjust: exact");
  });

  it("named pages kunci, pembahasan, dan jawaban dideklarasikan untuk chip header dinamis", () => {
    const css = printCss();
    expect(css).toContain("@page kunci");
    expect(css).toContain("@page pembahasan");
    expect(css).toContain("@page jawaban");
    expect(css).toContain("page: kunci");
    expect(css).toContain("page: pembahasan");
    expect(css).toContain("page: jawaban");
    expect(css).toContain("KUNCI JAWABAN");
    expect(css).toContain("PEMBAHASAN");
    expect(css).toContain("LEMBAR JAWABAN");
  });

  it("lompat kolom paksa (data-break=force-column) dideklarasikan pada print-columns", () => {
    const css = printCss();
    expect(css).toMatch(/\.print-columns\s+\.print-item\[data-break="force-column"\]\s*\{[^}]*break-before:\s*column/);
  });
});
