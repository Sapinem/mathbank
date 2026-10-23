import { describe, it, expect } from "vitest";
import { normalizeMath } from "./clean";

describe("normalizeMath — delimiter KOSONG `\\(\\)` / `\\[\\]`", () => {
  it("`\\(\\)` (inline kosong) dibuang", () => {
    const out = normalizeMath("akhir \\(\\).\\therefore$ Pilihan").text;
    expect(out).not.toContain("\\(\\)");
  });

  it("`\\[\\]` (display kosong) dibuang", () => {
    const out = normalizeMath("teks \\[\\] lagi").text;
    expect(out).not.toContain("\\[\\]");
  });

  it("`$(A)$` label tetap utuh", () => {
    expect(normalizeMath("$(A)\\ 63 $").text).toContain("\\((A)");
  });

  it("`\\)` yatim (tanpa pembuka) dibuang", () => {
    const out = normalizeMath("rumus selesai\therefore$ Pilihan \\((C)\\)").text;
    expect(out).not.toMatch(/^\\\)/m);
  });
});
