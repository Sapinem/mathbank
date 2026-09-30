import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EnrichButton } from "./enrich-button";

/** Bungkus dengan QueryClientProvider (komponen memakai React Query). */
function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("EnrichButton", () => {
  it("menampilkan tombol 'Enrich dengan AI'", () => {
    wrap(<EnrichButton questionId="q1" />);
    expect(screen.getByRole("button", { name: /Enrich dengan AI/i })).toBeInTheDocument();
  });

  it("sukses → dialog menampilkan usulan AI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              mode: "single",
              result: {
                questionId: "q1",
                ok: true,
                status: "review",
                proposal: {
                  topics: ["Aljabar"],
                  difficulty: 3,
                  cognitiveLevel: "apply",
                  tags: ["persamaan"],
                  notes: "usulan uji",
                },
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    wrap(<EnrichButton questionId="q1" />);
    fireEvent.click(screen.getByRole("button", { name: /Enrich dengan AI/i }));

    await waitFor(() => {
      expect(screen.getByText("Usulan AI")).toBeInTheDocument();
    });
    expect(screen.getByText("Aljabar")).toBeInTheDocument();
    expect(screen.getByText("persamaan")).toBeInTheDocument();
    expect(screen.getByText(/usulan uji/)).toBeInTheDocument();
  });

  it("gagal → dialog menampilkan pesan error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: { mode: "single", result: { questionId: "q1", ok: false, error: "AI belum siap" } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    wrap(<EnrichButton questionId="q1" />);
    fireEvent.click(screen.getByRole("button", { name: /Enrich dengan AI/i }));

    await waitFor(() => {
      expect(screen.getByText(/Enrichment gagal/)).toBeInTheDocument();
    });
    expect(screen.getByText("AI belum siap")).toBeInTheDocument();
  });

  it("HTTP error (mis. 403) → pesan gagal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { code: "FORBIDDEN", message: "Tidak punya izin: question:edit" } }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    wrap(<EnrichButton questionId="q1" />);
    fireEvent.click(screen.getByRole("button", { name: /Enrich dengan AI/i }));

    await waitFor(() => {
      expect(screen.getByText(/Enrichment gagal/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Tidak punya izin/)).toBeInTheDocument();
  });
});
