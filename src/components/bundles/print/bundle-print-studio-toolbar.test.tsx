import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BundlePrintStudioToolbar } from "./bundle-print-studio-toolbar";

describe("BundlePrintStudioToolbar", () => {
  const defaultProps = {
    bundleId: "test-bundle-123",
    title: "Ujian Matematika Semester 1",
    studioViewMode: "a4" as const,
    onViewModeChange: vi.fn(),
    headerCode: "A1",
    onHeaderCodeChange: vi.fn(),
    footerCode: "F1",
    onFooterCodeChange: vi.fn(),
    is1Line: false,
    onToggleLines: vi.fn(),
    onToggleSettings: vi.fn(),
    onPrint: vi.fn(),
    isMathMyIdTheme: true,
  };

  it("merender judul naskah dan 3 tab studio utama (U5-T1)", () => {
    const { container } = render(<BundlePrintStudioToolbar {...defaultProps} />);

    expect(screen.getByText(/Ujian Matematika Semester 1/)).toBeInTheDocument();
    expect(screen.getByTestId("tab-mode-a4")).toBeInTheDocument();
    expect(screen.getByTestId("tab-mode-catalog-header")).toBeInTheDocument();
    expect(screen.getByTestId("tab-mode-catalog-footer")).toBeInTheDocument();

    // Memverifikasi kelas no-print dan print:hidden agar bersih saat dicetak (R16)
    const headerEl = container.querySelector("[data-slot='bundle-print-studio-toolbar']");
    expect(headerEl?.className).toContain("no-print");
    expect(headerEl?.className).toContain("print:hidden");
  });

  it("beralih tab saat tombol mode katalog diklik (U5-T2)", () => {
    const handleViewModeChange = vi.fn();
    render(
      <BundlePrintStudioToolbar
        {...defaultProps}
        onViewModeChange={handleViewModeChange}
      />
    );

    fireEvent.click(screen.getByTestId("tab-mode-catalog-header"));
    expect(handleViewModeChange).toHaveBeenCalledWith("catalog-header");

    fireEvent.click(screen.getByTestId("tab-mode-catalog-footer"));
    expect(handleViewModeChange).toHaveBeenCalledWith("catalog-footer");
  });

  it("memanggil onHeaderCodeChange saat pill header diklik (U5-T3)", () => {
    const handleHeaderChange = vi.fn();
    render(
      <BundlePrintStudioToolbar
        {...defaultProps}
        onHeaderCodeChange={handleHeaderChange}
      />
    );

    const pillC2 = screen.getByTestId("pill-header-C2");
    fireEvent.click(pillC2);
    expect(handleHeaderChange).toHaveBeenCalledWith("C2");
  });

  it("memanggil onFooterCodeChange saat pill footer diklik", () => {
    const handleFooterChange = vi.fn();
    render(
      <BundlePrintStudioToolbar
        {...defaultProps}
        onFooterCodeChange={handleFooterChange}
      />
    );

    const pillG1 = screen.getByTestId("pill-footer-G1");
    fireEvent.click(pillG1);
    expect(handleFooterChange).toHaveBeenCalledWith("G1");
  });

  it("memanggil onToggleLines saat tombol toggle running header diklik", () => {
    const handleToggleLines = vi.fn();
    render(
      <BundlePrintStudioToolbar
        {...defaultProps}
        onToggleLines={handleToggleLines}
      />
    );

    const toggleBtn = screen.getByTestId("toggle-lines-mode");
    fireEvent.click(toggleBtn);
    expect(handleToggleLines).toHaveBeenCalledTimes(1);
  });

  it("memanggil onPrint saat tombol cetak PDF diklik", () => {
    const handlePrint = vi.fn();
    render(
      <BundlePrintStudioToolbar
        {...defaultProps}
        onPrint={handlePrint}
      />
    );

    const printBtn = screen.getByRole("button", { name: /cetak pdf/i });
    fireEvent.click(printBtn);
    expect(handlePrint).toHaveBeenCalledTimes(1);
  });
});
