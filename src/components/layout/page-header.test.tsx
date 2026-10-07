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

  it("wadah actions tidak `shrink-0` di mobile & boleh membungkus (cegah scroll horizontal)", () => {
    const { container } = render(
      <PageHeader title="Detail Soal" actions={<button>Aksi</button>} />,
    );
    const wrap = container.querySelector(".flex-wrap");
    expect(wrap, "wadah aksi harus memiliki flex-wrap").not.toBeNull();
    const cls = wrap!.className;
    // `shrink-0` hanya boleh aktif di ≥sm (desktop), bukan tanpa prefix.
    expect(cls).not.toMatch(/(^|\s)shrink-0(\s|$)/);
    expect(cls).toContain("min-w-0");
    expect(cls).toContain("max-w-full");
  });
});
