import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BundlePrintHeader } from "./bundle-print-header";

describe("BundlePrintHeader", () => {
  it("merender brand Math My ID, judul materi, dan label latihan", () => {
    render(
      <BundlePrintHeader
        title="Barisan dan Deret Geometri"
        exerciseLabel="Latihan 1"
      />
    );

    expect(screen.getByText("Math My ID")).toBeInTheDocument();
    expect(screen.getByText("Barisan dan Deret Geometri")).toBeInTheDocument();
    expect(screen.getByText("Latihan 1")).toBeInTheDocument();
  });

  it("memiliki atribut data-slot running header untuk styling media print", () => {
    const { container } = render(<BundlePrintHeader title="Matematika Lanjut" />);
    const header = container.querySelector("[data-slot='bundle-print-header']");
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("print-running-header");
  });
});
