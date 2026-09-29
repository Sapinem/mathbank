import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("menampilkan judul sebagai heading level 1", () => {
    render(<PageHeader title="Bank Soal" />);
    expect(screen.getByRole("heading", { level: 1, name: "Bank Soal" })).toBeInTheDocument();
  });

  it("deskripsi opsional", () => {
    const { rerender } = render(<PageHeader title="Judul" />);
    expect(screen.queryByText("Deskripsi")).not.toBeInTheDocument();
    rerender(<PageHeader title="Judul" description="Deskripsi" />);
    expect(screen.getByText("Deskripsi")).toBeInTheDocument();
  });

  it("slot actions dirender bila diberi", () => {
    render(<PageHeader title="Judul" actions={<button>Aksi</button>} />);
    expect(screen.getByRole("button", { name: "Aksi" })).toBeInTheDocument();
  });
});
