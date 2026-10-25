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
 * laporan Fase 4) — tes ini bukan pengganti itu.
 */
function printCss(): string {
  // Kupas komentar: komentar Fase 4 menyebut nilai lama ("visible") sebagai
  // dokumentasi, dan itu bukan deklarasi. Yang ditegakkan = deklarasi nyata.
  return readFileSync(join(process.cwd(), "src/styles/print.css"), "utf-8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

describe("print.css — Fase 4 (A4: tidak meluber)", () => {
  it("tidak ada lagi deklarasi overflow-x: visible di cetak", () => {
    // `overflow: visible` masih dipakai di tempat yang memang harus mengalir
    // (html/body dan [data-app-scroll]) — yang dilarang hanya luapan
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
});
