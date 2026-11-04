import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddToBundleDialog } from "./add-to-bundle-dialog";

const mutateMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("@/lib/hooks/use-bundles", () => ({
  useBundles: () => ({
    data: [
      { id: "b-1", title: "Paket Latihan Matematika 1", version: 2, bundleType: "exam", itemCount: 10 },
      { id: "b-2", title: "Paket Ujian Akhir Semester", version: 1, bundleType: "exam", itemCount: 20 },
    ],
    isPending: false,
  }),
  useAddBundleItem: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

describe("AddToBundleDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender dialog saat open=true dengan pilihan paket dan tombol submit", () => {
    render(
      <AddToBundleDialog
        open={true}
        onOpenChange={vi.fn()}
        questionId="q-100"
      />,
    );

    expect(screen.getByText("Masukkan Soal ke Paket")).toBeInTheDocument();
    expect(screen.getByText("Pilih Paket Naskah Ujian")).toBeInTheDocument();
    expect(screen.getByText("Peran Butir dalam Naskah")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tambahkan ke Paket/i })).toBeInTheDocument();
  });

  it("tombol submit disabled saat belum ada paket yang dipilih", () => {
    render(
      <AddToBundleDialog
        open={true}
        onOpenChange={vi.fn()}
        questionId="q-100"
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Tambahkan ke Paket/i });
    expect(submitBtn).toBeDisabled();
    fireEvent.click(submitBtn);
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("mengirim mutasi saat paket dipilih dan submit diklik", () => {
    const onOpenChange = vi.fn();
    render(
      <AddToBundleDialog
        open={true}
        onOpenChange={onOpenChange}
        questionId="q-100"
        initialBundleId="b-1"
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Tambahkan ke Paket/i });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(
      {
        questionId: "q-100",
        role: "question",
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );

    // Verifikasi callback onSuccess menutup modal dan menginvalidasi query
    const callbacks = mutateMock.mock.calls[0][1];
    callbacks.onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
  });

  it("menutup dialog saat tombol Batal diklik", () => {
    const onOpenChange = vi.fn();
    render(
      <AddToBundleDialog
        open={true}
        onOpenChange={onOpenChange}
        questionId="q-100"
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: /Batal/i });
    fireEvent.click(cancelBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
