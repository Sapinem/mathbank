import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BundlePrintFooter } from "./bundle-print-footer";

describe("BundlePrintFooter", () => {
  it("merender seluruh kanal media sosial mathmyid", () => {
    render(<BundlePrintFooter pageNumber={1} />);

    // Harus memuat teks mathmyid untuk kanal medsos
    const mathmyidLabels = screen.getAllByText("mathmyid");
    expect(mathmyidLabels.length).toBe(5);
  });

  it("merender nomor halaman pada badge poligon", () => {
    render(<BundlePrintFooter pageNumber={3} />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("memiliki kelas print-running-footer untuk pengaturan paged media", () => {
    const { container } = render(<BundlePrintFooter pageNumber={1} />);
    const footer = container.querySelector("[data-slot='bundle-print-footer']");
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass("print-running-footer");
  });
});
