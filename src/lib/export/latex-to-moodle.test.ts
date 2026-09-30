import { describe, it, expect } from "vitest";
import { tokenizeLatex, toMoodleLatex } from "./latex-to-moodle";

describe("latex-to-moodle", () => {
  it("ubah $…$ → \\(…\\)", () => {
    expect(toMoodleLatex("Berapa $2+2$ ?")).toBe("Berapa \\(2+2\\) ?");
  });

  it("ubah $$…$$ → \\[…\\]", () => {
    expect(toMoodleLatex("$$x^2$$")).toBe("\\[x^2\\]");
  });

  it("biarkan \\(…\\) & \\[…\\] yang sudah benar", () => {
    expect(toMoodleLatex("a \\(x\\) b \\[y\\] c")).toBe("a \\(x\\) b \\[y\\] c");
  });

  it("campuran beberapa rumus", () => {
    expect(toMoodleLatex("$a$ dan $$b$$ dan $c$")).toBe("\\(a\\) dan \\[b\\] dan \\(c\\)");
  });

  it("tanpa rumus → tak berubah", () => {
    expect(toMoodleLatex("teks biasa")).toBe("teks biasa");
  });

  it("string kosong → kosong", () => {
    expect(toMoodleLatex("")).toBe("");
  });

  it("tokenizeLatex memisah teks & rumus dengan benar", () => {
    const t = tokenizeLatex("A $x$ B");
    expect(t.map((x) => x.kind)).toEqual(["text", "math", "text"]);
  });

  it("$ tanpa pasangan tidak dianggap rumus", () => {
    // Satu `$` saja → tetap teks (regex butuh penutup).
    expect(toMoodleLatex("harga $5")).toBe("harga $5");
  });
});
