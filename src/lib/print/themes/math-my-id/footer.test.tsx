import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MathMyIdFooter } from "./footer";
import { FOOTER_CODES } from "./types";
import { FOOTER_VARIANTS } from "./footer-variants";

describe("MathMyIdFooter", () => {
  it("memiliki renderer untuk seluruh 32 variasi footer F1-F16 dan G1-G16", () => {
    expect(FOOTER_CODES).toHaveLength(32);
    for (const code of FOOTER_CODES) {
      expect(typeof FOOTER_VARIANTS[code]).toBe("function");
    }
  });

  it("merender footer F1 dengan nomor halaman layar dan elemen cetak dinamis (U3-T1)", () => {
    const { container } = render(
      <MathMyIdFooter
        options={{
          footerCode: "F1",
          pageNumber: 3,
        }}
      />
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(container.querySelector(".print-page-counter")).toBeInTheDocument();
    expect(container.querySelector("footer[data-header-code='F1'], footer[data-footer-code='F1']")).toBeInTheDocument();
  });

  it("merender footer G1 dengan badge sudut dekoratif navy-emas (U3-T2)", () => {
    const { container } = render(
      <MathMyIdFooter
        options={{
          footerCode: "G1",
          pageNumber: 2,
        }}
      />
    );

    expect(container.querySelector("[data-footer-code='G1']")).toBeInTheDocument();
    expect(container.querySelector("polygon[fill='#f5b800']")).toBeInTheDocument();
    expect(container.querySelector("polygon[fill='#072652']")).toBeInTheDocument();
  });

  it("jatuh kembali ke variasi F1 bila footerCode tidak valid atau kosong (U3-T3)", () => {
    const { container } = render(
      <MathMyIdFooter
        options={{
          footerCode: "INVALID_FOOTER",
          pageNumber: 1,
        }}
      />
    );

    expect(container.querySelector("[data-footer-code='F1']")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("merender perwakilan variasi dari seri F dan seri G tanpa galat", () => {
    const testSamples = ["F5", "F7", "F10", "F13", "G4", "G6", "G10", "G16"];

    for (const code of testSamples) {
      const { container } = render(
        <MathMyIdFooter
          options={{
            footerCode: code,
            pageNumber: 5,
            totalPages: 10,
          }}
        />
      );

      expect(container.querySelector(`[data-footer-code='${code}']`)).toBeInTheDocument();
    }
  });
});
