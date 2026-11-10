import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BundlePrintKop } from "./bundle-print-kop";

describe("BundlePrintKop", () => {
  it("merender judul naskah dan label latihan dengan benar", () => {
    render(
      <BundlePrintKop
        title="Barisan dan Deret Geometri"
        exerciseLabel="Latihan 1"
      />
    );

    expect(screen.getByText("BARISAN DAN DERET GEOMETRI")).toBeInTheDocument();
    expect(screen.getByText("LATIHAN 1")).toBeInTheDocument();
  });

  it("merender logo resmi Math My ID dengan path gambar publik", () => {
    render(<BundlePrintKop title="Aljabar Linear" />);

    const logoImg = screen.getByAltText("Math My ID");
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute("src", "/brand/logo-text-lite.png");
  });

  it("merender nama institusi kustom jika diberikan", () => {
    render(
      <BundlePrintKop
        title="Trigonometri"
        grade="10"
        institutionName="SMA Prestasi Bangsa"
        tagline="Unggul dan Cerdas"
      />
    );

    expect(screen.getByText("SMA PRESTASI BANGSA")).toBeInTheDocument();
    expect(screen.getByText("Unggul dan Cerdas")).toBeInTheDocument();
  });
});
