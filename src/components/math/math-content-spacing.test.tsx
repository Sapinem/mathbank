import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MathContent } from "./math-content";

describe("MathContent — penanganan spasi dan baris kosong berlebihan", () => {
  it("menciutkan runtunan newline berlebihan (>= 3 baris kosong) menjadi jeda paragraf biasa", () => {
    const input = "Paragraf 1\n\n\n\n\n\nParagraf 2";
    const { container } = render(<MathContent content={input} />);
    const brs = container.querySelectorAll("br");
    // 2 newline = 2 <br/> (jeda paragraf biasa), bukan 6 <br/>
    expect(brs.length).toBe(2);
    expect(container.textContent).toContain("Paragraf 1");
    expect(container.textContent).toContain("Paragraf 2");
  });

  it("menormalkan baris kosong dengan spasi/tab dan CRLF", () => {
    const input = "Baris A\r\n   \r\n   \r\nBaris B";
    const { container } = render(<MathContent content={input} />);
    const brs = container.querySelectorAll("br");
    expect(brs.length).toBe(2);
    expect(container.textContent).toContain("Baris A");
    expect(container.textContent).toContain("Baris B");
  });

  it("mempertahankan satu baris baru (single newline) apa adanya", () => {
    const input = "Baris 1\nBaris 2";
    const { container } = render(<MathContent content={input} />);
    const brs = container.querySelectorAll("br");
    expect(brs.length).toBe(1);
  });

  it("mempertahankan jeda paragraf standar (dua newline) apa adanya", () => {
    const input = "Baris 1\n\nBaris 2";
    const { container } = render(<MathContent content={input} />);
    const brs = container.querySelectorAll("br");
    expect(brs.length).toBe(2);
  });
});
