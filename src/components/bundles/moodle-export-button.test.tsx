import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MoodleExportButton } from "./moodle-export-button";

/**
 * API-01 (CONSTRAINT #17) — kontrak error ekspor Moodle.
 *
 * Respons 422 TIDAK lagi menyertakan `data` di samping `error`; ringkasan
 * ekspor (termasuk `withoutAnswerKey`) dipindah ke `error.details`. Tes ini
 * mengunci pembacaan kontrak baru di komponen tombol ekspor.
 */

function mockResponse(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })),
  );
}

async function clickExport() {
  render(<MoodleExportButton bundleId="b1" />);
  fireEvent.click(screen.getByRole("button", { name: /Ekspor ke GitSync/i }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("MoodleExportButton — kontrak error API-01", () => {
  it("EXPORT_BLOCKED: membaca daftar soal tanpa kunci dari error.details", async () => {
    mockResponse(422, {
      error: {
        code: "EXPORT_BLOCKED",
        message: "Ekspor dibatalkan: ada soal tanpa kunci jawaban.",
        details: { withoutAnswerKey: ["Soal 1", "Soal 3"] },
      },
    });

    await clickExport();

    await waitFor(() => {
      expect(screen.getByText("Ekspor ditolak")).toBeInTheDocument();
    });
    expect(screen.getByText("Soal 1")).toBeInTheDocument();
    expect(screen.getByText("Soal 3")).toBeInTheDocument();
  });

  it("tidak lagi membaca withoutAnswerKey dari body.data (kontrak lama)", async () => {
    mockResponse(422, {
      error: {
        code: "EXPORT_BLOCKED",
        message: "Ekspor dibatalkan: ada soal tanpa kunci jawaban.",
        details: { withoutAnswerKey: ["Soal Baru"] },
      },
      // Warisan kontrak lama — harus DIABAIKAN.
      data: { withoutAnswerKey: ["Soal Lama"] },
    });

    await clickExport();

    await waitFor(() => {
      expect(screen.getByText("Soal Baru")).toBeInTheDocument();
    });
    expect(screen.queryByText("Soal Lama")).not.toBeInTheDocument();
  });

  it("NOTHING_EXPORTED: tetap menampilkan pesan error walau daftar kosong", async () => {
    mockResponse(422, {
      error: {
        code: "NOTHING_EXPORTED",
        message: "Tak ada soal yang bisa diekspor (tipe tak didukung).",
        details: { withoutAnswerKey: [] },
      },
    });

    await clickExport();

    await waitFor(() => {
      expect(screen.getByText("Ekspor ditolak")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Tak ada soal yang bisa diekspor (tipe tak didukung)."),
    ).toBeInTheDocument();
  });

  it("sukses: membaca ringkasan dari body.data", async () => {
    mockResponse(200, {
      data: {
        directory: "/exports/paket",
        written: 12,
        committed: true,
        commitHash: "abc1234",
        note: "",
      },
    });

    await clickExport();

    await waitFor(() => {
      expect(screen.getByText("Ekspor selesai")).toBeInTheDocument();
    });
    expect(screen.getByText("/exports/paket")).toBeInTheDocument();
  });
});
