import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DesktopOnly } from "./desktop-only";

/** Kendali `useMediaQuery` via `matchMedia` tiruan. */
function setDesktop(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("DesktopOnly", () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => setDesktop(true));

  it("di desktop: menampilkan children apa adanya", () => {
    setDesktop(true);
    render(
      <DesktopOnly>
        <div>EDITOR SOAL</div>
      </DesktopOnly>,
    );
    expect(screen.getByText("EDITOR SOAL")).toBeInTheDocument();
    expect(screen.queryByText(/layar besar/)).not.toBeInTheDocument();
  });

  it("di layar kecil: menampilkan pesan ramah + bukan children", () => {
    setDesktop(false);
    render(
      <DesktopOnly>
        <div>EDITOR SOAL</div>
      </DesktopOnly>,
    );
    expect(screen.queryByText("EDITOR SOAL")).not.toBeInTheDocument();
    expect(screen.getByRole("heading")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Kembali" })).toHaveAttribute("href", "/");
  });

  it("menerima judul, deskripsi, & tautan kembali kustom", () => {
    setDesktop(false);
    render(
      <DesktopOnly title="Judul Khusus" description="Deskripsi Khusus" backHref="/paket" backLabel="← Paket">
        <div>X</div>
      </DesktopOnly>,
    );
    expect(screen.getByRole("heading", { name: "Judul Khusus" })).toBeInTheDocument();
    expect(screen.getByText("Deskripsi Khusus")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Paket" })).toHaveAttribute("href", "/paket");
  });
});
