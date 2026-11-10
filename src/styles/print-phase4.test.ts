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

/**
 * Potongan CSS mulai dari blok `@media print` saja.
 *
 * Tes lapisan cetak WAJIB memakai ini: aturan layar (`@media screen`) memakai
 * nilai z-index yang sama, sehingga assertion pada seluruh berkas bisa hijau
 * meski aturan cetaknya hilang.
 */
function printOnly(): string {
  const css = printCss();
  const start = css.indexOf("@media print");
  return start < 0 ? "" : css.slice(start);
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

  it("gambar cetak diskalakan dengan batas tinggi maksimal 6.5cm dan tanpa border", () => {
    const css = printCss();
    expect(css).toMatch(/\.print-sheet img\s*\{[^}]*max-height:\s*6\.5cm/);
    expect(css).toMatch(/\.print-sheet img\s*\{[^}]*border:\s*none/);
  });

  it("gambar dengan modifier full atau kelas img-full memiliki column-span all", () => {
    const css = printCss();
    expect(css).toMatch(/\[data-size="full"\][^}]*column-span:\s*all/);
  });

  it("gambar dalam opsi pilihan ganda dibatasi maksimal tinggi 3.2cm", () => {
    const css = printCss();
    expect(css).toMatch(/\.print-options img\s*\{[^}]*max-height:\s*3\.2cm/);
  });

  it("sel tabel cetak boleh memecah kata panjang", () => {
    const css = printCss();
    expect(css).toContain("overflow-wrap: anywhere");
  });

  it("geometri kertas efisien mathmyid.cls diterapkan pada margin @page", () => {
    const css = printCss();
    expect(css).toContain("margin: 1.9cm 0.6cm 1.8cm 1cm");
  });

  it("header bagian cetak mencegah putus halaman yatim di dasar kolom", () => {
    const css = printCss();
    expect(css).toMatch(/\.print-section-header\s*\{[^}]*break-after:\s*avoid/);
  });

  it("running header dan footer ditempatkan di gutter margin aman", () => {
    const css = printCss();
    expect(css).toMatch(/\.print-running-header\s*\{[^}]*top:\s*-1\.3cm/);
    expect(css).toMatch(/\.print-running-footer\s*\{[^}]*bottom:\s*-1\.2cm/);
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

  it("susunan stacking context 3-lapisan berlaku DI DALAM @media print", () => {
    // Hanya blok cetak yang diperiksa: nilai layar tidak membuktikan apa pun
    // tentang PDF/hasil cetak.
    const print = printOnly();
    expect(print).not.toBe("");
    expect(print).toContain(".worksheet-grid::before");
    expect(print).toMatch(/\.worksheet-watermark-container\s*\{[^}]*z-index:\s*var\(--print-layer-watermark\)/);
    expect(print).toMatch(/\.worksheet\.worksheet-grid::before\s*\{[^}]*z-index:\s*var\(--print-layer-grid\)/);
    expect(print).toMatch(/\.print-item[^}]*z-index:\s*var\(--print-layer-content\)/);
  });

  it("header bagian cetak melintasi seluruh kolom naskah 2-kolom", () => {
    const css = printCss();
    expect(css).toMatch(/\.print-section-header\s*\{[^}]*column-span:\s*all/);
  });

  it("lompat kolom paksa (data-break=force-column) dideklarasikan pada print-columns", () => {
    const css = printCss();
    expect(css).toMatch(/\.print-columns\s+\.print-item\[data-break="force-column"\]\s*\{[^}]*break-before:\s*column/);
  });

  it("tanda air worksheet-watermark-container didefinisikan dengan position fixed dan lebar 90% untuk menempel ke pinggir kanan tanpa bocor", () => {
    const css = printCss();
    expect(css).toContain(".worksheet-watermark-container");
    expect(css).toMatch(/\.worksheet-watermark-container\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.worksheet-watermark-container\s*\{[^}]*bottom:\s*0/);
    expect(css).toMatch(/\.worksheet-watermark-container\s*\{[^}]*width:\s*90%/);
  });

  it("penomoran halaman dinamis pada footer cetak didefinisikan dengan counter(page)", () => {
    const css = printCss();
    expect(css).toContain(".print-page-counter::after");
    expect(css).toContain("content: counter(page)");
  });
});
