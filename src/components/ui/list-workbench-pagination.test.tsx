import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListWorkbenchPagination } from "./list-workbench-pagination";

describe("ListWorkbenchPagination", () => {
  it("merender null jika total adalah 0 atau totalPages <= 1", () => {
    const { container: c1 } = render(
      <ListWorkbenchPagination
        page={0}
        pageSize={20}
        total={0}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <ListWorkbenchPagination
        page={0}
        pageSize={20}
        total={15}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(c2.firstChild).toBeNull();
  });

  it("merender jangkauan data dan opsi limit baris", () => {
    render(
      <ListWorkbenchPagination
        page={1}
        pageSize={20}
        total={95}
        itemLabel="paket"
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    // Halaman ke-2 (page=1): Menampilkan 21–40 dari 95 paket
    expect(screen.getByText(/21–40/)).toBeInTheDocument();
    expect(screen.getByText(/95/)).toBeInTheDocument();
    expect(screen.getByText(/paket/)).toBeInTheDocument();
    expect(screen.getByText("Hal. 2/5")).toBeInTheDocument();
  });

  it("memanggil onPageChange saat tombol Sebelumnya / Berikutnya diklik", () => {
    const onPageChange = vi.fn();
    render(
      <ListWorkbenchPagination
        page={2}
        pageSize={20}
        total={100}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );

    const prevBtn = screen.getByRole("button", { name: /Sebelumnya/i });
    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    const nextBtn = screen.getByRole("button", { name: /Berikutnya/i });
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("memanggil onPageSizeChange saat opsi baris diklik", () => {
    const onPageSizeChange = vi.fn();
    render(
      <ListWorkbenchPagination
        page={0}
        pageSize={20}
        total={150}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    const btn50 = screen.getByRole("button", { name: /Tampilkan 50 item per halaman/i });
    fireEvent.click(btn50);
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("menangani lompat halaman cepat via input form", () => {
    const onPageChange = vi.fn();
    render(
      <ListWorkbenchPagination
        page={0}
        pageSize={20}
        total={200}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );

    const jumpInput = screen.getByLabelText("Lompat ke nomor halaman");
    fireEvent.change(jumpInput, { target: { value: "4" } });
    fireEvent.submit(jumpInput.closest("form")!);
    expect(onPageChange).toHaveBeenCalledWith(3); // 0-based page index
  });
});
