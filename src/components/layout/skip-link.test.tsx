import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("merender tautan lompat ke #konten-utama", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: "Lompat ke konten utama" });
    expect(link).toHaveAttribute("href", "#konten-utama");
  });

  it("tersembunyi secara visual (sr-only) sampai difokus", () => {
    render(<SkipLink />);
    expect(screen.getByRole("link")).toHaveClass("sr-only");
  });
});
