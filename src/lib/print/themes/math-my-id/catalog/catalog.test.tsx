import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderCatalogView } from "./header-catalog-view";
import { FooterCatalogView } from "./footer-catalog-view";
import { HEADER_CODES, FOOTER_CODES } from "../types";

describe("Catalog Views (HeaderCatalogView & FooterCatalogView)", () => {
  describe("HeaderCatalogView", () => {
    it("merender tepat 24 kartu header dari kelompok A s.d. F (U4-T1)", () => {
      const handleSelect = vi.fn();
      const handleBack = vi.fn();

      const { container } = render(
        <HeaderCatalogView
          title="Kalkulus Peubah Banyak"
          course="Matematika Lanjut"
          currentHeaderCode="A1"
          onSelectHeader={handleSelect}
          onBackToA4={handleBack}
        />
      );

      // Memverifikasi keberadaan seluruh 24 kartu
      for (const code of HEADER_CODES) {
        expect(container.querySelector(`[data-testid='header-card-${code}']`)).toBeInTheDocument();
      }

      // Memverifikasi teks judul kelompok A s.d. F
      expect(screen.getByText("24 Variasi Header Math My ID (A1–F4)")).toBeInTheDocument();
      expect(screen.getByText("A. Variasi Minimalis (Clean Strip)")).toBeInTheDocument();
      expect(screen.getAllByText(/F\. Variasi Ultra Compact/).length).toBeGreaterThanOrEqual(1);
    });

    it("memanggil onSelectHeader dengan kode yang diklik (U4-T2)", () => {
      const handleSelect = vi.fn();

      const { container } = render(
        <HeaderCatalogView
          title="Aljabar Linier"
          currentHeaderCode="A1"
          onSelectHeader={handleSelect}
        />
      );

      const cardB2 = container.querySelector("[data-testid='header-card-B2']");
      expect(cardB2).toBeInTheDocument();

      if (cardB2) {
        fireEvent.click(cardB2);
      }

      expect(handleSelect).toHaveBeenCalledWith("B2");
    });

    it("memanggil onBackToA4 saat tombol kembali diklik", () => {
      const handleBack = vi.fn();

      render(
        <HeaderCatalogView
          title="Trigonometri"
          currentHeaderCode="A1"
          onSelectHeader={vi.fn()}
          onBackToA4={handleBack}
        />
      );

      const backBtn = screen.getByRole("button", { name: /kembali ke lembar a4/i });
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("FooterCatalogView", () => {
    it("merender tepat 32 kartu footer dari seri F dan G (U4-T3)", () => {
      const handleSelect = vi.fn();

      const { container } = render(
        <FooterCatalogView
          pageNumber={1}
          totalPages={5}
          currentFooterCode="F1"
          onSelectFooter={handleSelect}
        />
      );

      // Memverifikasi seluruh 32 kartu footer
      for (const code of FOOTER_CODES) {
        expect(container.querySelector(`[data-testid='footer-card-${code}']`)).toBeInTheDocument();
      }

      expect(screen.getByText("32 Variasi Footer Math My ID (F1–G16)")).toBeInTheDocument();
      expect(screen.getByText("Seri F — Clean Minimalist (F1–F16)")).toBeInTheDocument();
      expect(screen.getByText("Seri G — Decorative / Aksen Geometris (G1–G16)")).toBeInTheDocument();
    });

    it("memanggil onSelectFooter dengan kode yang diklik (U4-T4)", () => {
      const handleSelect = vi.fn();

      const { container } = render(
        <FooterCatalogView
          pageNumber={1}
          currentFooterCode="F1"
          onSelectFooter={handleSelect}
        />
      );

      const cardG4 = container.querySelector("[data-testid='footer-card-G4']");
      expect(cardG4).toBeInTheDocument();

      if (cardG4) {
        fireEvent.click(cardG4);
      }

      expect(handleSelect).toHaveBeenCalledWith("G4");
    });
  });
});
