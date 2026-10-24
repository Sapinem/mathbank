import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LabelsView } from "./labels-view";
import type { TagRow } from "@/lib/services/taxonomy-service";

// ── Mock seluruh hook use-taxonomy-refs ─────────────────────────────────────
vi.mock("@/lib/hooks/use-taxonomy-refs", () => ({
  useTags: vi.fn(),
  useCreateTag: vi.fn(),
  useUpdateTag: vi.fn(),
  useDeleteTag: vi.fn(),
  useMergeTags: vi.fn(),
}));

import {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useMergeTags,
} from "@/lib/hooks/use-taxonomy-refs";

// ── Helper fixture ──────────────────────────────────────────────────────────

function makeTag(over: Partial<TagRow> = {}): TagRow {
  return {
    id: "tag-1",
    name: "HOTS",
    usageCount: 5,
    ...over,
  };
}

const noopMutation = {
  mutate: vi.fn(),
  isPending: false,
};

function setupHooks(tags: TagRow[], pending = false, error: Error | null = null) {
  vi.mocked(useTags).mockReturnValue({
    data: error || pending ? undefined : tags,
    isPending: pending,
    isError: !!error,
    error,
  } as ReturnType<typeof useTags>);
  // Stub mutasi minimal: komponen hanya memakai `mutate`/`isPending`, sedangkan
  // `UseMutationResult` TanStack Query mewajibkan belasan field lain (context,
  // failureCount, reset, …). Cast lewat `unknown` sekali di sini (bukan `any`)
  // agar sisa berkas tetap type-safe (MAT-159).
  const stubMutation = noopMutation as unknown;
  vi.mocked(useCreateTag).mockReturnValue(stubMutation as ReturnType<typeof useCreateTag>);
  vi.mocked(useUpdateTag).mockReturnValue(stubMutation as ReturnType<typeof useUpdateTag>);
  vi.mocked(useDeleteTag).mockReturnValue(stubMutation as ReturnType<typeof useDeleteTag>);
  vi.mocked(useMergeTags).mockReturnValue(stubMutation as ReturnType<typeof useMergeTags>);
}

function renderLabels() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LabelsView />
    </QueryClientProvider>
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("LabelsView — header tabel", () => {
  beforeEach(() => {
    setupHooks([makeTag()]);
  });

  it("menampilkan kolom Label, Pemakaian, Aksi — TANPA kolom Slug", () => {
    renderLabels();
    // "Label" muncul di page header (h1) DAN di table header (th) — cari yang th
    const headers = screen.getAllByText("Label");
    // Setidaknya ada satu yang merupakan table header
    const tableHeader = headers.find(
      (el) => el.tagName.toLowerCase() === "th"
    );
    expect(tableHeader).toBeInTheDocument();
    expect(screen.getByText("Pemakaian")).toBeInTheDocument();
    expect(screen.getByText("Aksi")).toBeInTheDocument();
    // Kolom Slug harus tidak ada
    expect(screen.queryByText(/^Slug$/i)).not.toBeInTheDocument();
  });

  it("merender baris label dengan benar", () => {
    const tag = makeTag();
    setupHooks([tag]);
    renderLabels();
    expect(screen.getAllByText("HOTS").length).toBeGreaterThan(0);
  });
});

describe("LabelsView — state loading", () => {
  it("menampilkan loading state saat isPending=true", () => {
    setupHooks([], true);
    renderLabels();
    expect(screen.getByText(/Memuat label/i)).toBeInTheDocument();
  });
});

describe("LabelsView — state error", () => {
  it("menampilkan error state saat isError=true", () => {
    setupHooks([], false, new Error("Koneksi gagal"));
    renderLabels();
    expect(screen.getByText(/Gagal memuat label/i)).toBeInTheDocument();
    expect(screen.getByText("Koneksi gagal")).toBeInTheDocument();
  });
});

describe("LabelsView — daftar kosong", () => {
  it("menampilkan pesan 'Belum ada label.' saat data=[]", () => {
    setupHooks([]);
    renderLabels();
    expect(screen.getByText("Belum ada label.")).toBeInTheDocument();
  });
});

describe("LabelsView — UsageMeter", () => {
  it("usageCount===0 menampilkan em-dash + sr-only 'Belum dipakai'", () => {
    setupHooks([makeTag({ id: "t1", name: "Kosong", usageCount: 0 })]);
    const { container } = renderLabels();
    // em-dash aria-hidden
    const emDash = container.querySelector("[aria-hidden]");
    expect(emDash).toBeInTheDocument();
    // sr-only text
    const srOnly = container.querySelector(".sr-only");
    expect(srOnly?.textContent).toBe("Belum dipakai");
  });

  it("usageCount>0 menampilkan angka pemakaian sebagai teks", () => {
    setupHooks([makeTag({ id: "t2", name: "HOTS", usageCount: 12 })]);
    renderLabels();
    // Komponen merender mobile card + desktop table, angka muncul dua kali
    const counts = screen.getAllByText(/12/);
    expect(counts.length).toBeGreaterThanOrEqual(1);
  });

  it("TIDAK merender angka 0 langsung — hanya em-dash", () => {
    setupHooks([makeTag({ id: "t3", name: "Baru", usageCount: 0 })]);
    const { container } = renderLabels();
    // Pastikan teks "0" tidak ada sebagai konten visibel langsung
    const visibleNumbers = Array.from(
      container.querySelectorAll("span:not(.sr-only):not([aria-hidden])")
    ).filter((el) => el.textContent?.trim() === "0");
    expect(visibleNumbers).toHaveLength(0);
  });
});

describe("LabelsView — aksi baris (aria-label berbasis nama)", () => {
  beforeEach(() => {
    setupHooks([
      makeTag({ id: "t1", name: "Eksponen" }),
      makeTag({ id: "t2", name: "Logaritma" }),
    ]);
  });

  it("tombol Sunting punya aria-label yang memuat nama label", () => {
    renderLabels();
    expect(
      screen.getAllByRole("button", { name: /Sunting Eksponen/i })[0]
    ).toBeInTheDocument();
  });

  it("tombol Hapus punya aria-label yang memuat nama label", () => {
    renderLabels();
    expect(
      screen.getAllByRole("button", { name: /Hapus Eksponen/i })[0]
    ).toBeInTheDocument();
  });

  it("tombol Gabungkan punya aria-label yang memuat nama label", () => {
    renderLabels();
    expect(
      screen.getAllByRole("button", { name: /Gabungkan Eksponen/i })[0]
    ).toBeInTheDocument();
  });

  it("tombol Gabungkan ENABLED bila label >= 2", () => {
    renderLabels();
    const btns = screen.getAllByRole("button", { name: /Gabungkan/i });
    btns.forEach((btn) => expect(btn).not.toBeDisabled());
  });
});

describe("LabelsView — Gabungkan disabled bila label < 2", () => {
  it("tombol Gabungkan disabled bila hanya 1 label", () => {
    setupHooks([makeTag({ id: "t1", name: "Satu-satunya" })]);
    renderLabels();
    // Mobile card + desktop table merender 2 tombol dengan nama yang sama
    const btns = screen.getAllByRole("button", { name: /Gabungkan Satu-satunya/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
    btns.forEach((btn) => expect(btn).toBeDisabled());
  });
});

describe("LabelsView — dialog Sunting", () => {
  beforeEach(() => {
    setupHooks([makeTag({ id: "t1", name: "Aljabar" })]);
  });

  it("membuka dialog Sunting Label saat tombol Sunting diklik", () => {
    renderLabels();
    const suntingBtn = screen.getAllByRole("button", { name: /Sunting Aljabar/i })[0];
    fireEvent.click(suntingBtn);
    expect(screen.getByText("Sunting Label")).toBeInTheDocument();
  });
});

describe("LabelsView — dialog Label Baru", () => {
  beforeEach(() => {
    setupHooks([makeTag()]);
  });

  it("membuka dialog Label Baru saat tombol Label Baru diklik", () => {
    renderLabels();
    fireEvent.click(screen.getByRole("button", { name: /Label Baru/i }));
    // Dialog title ada sebagai heading, bukan hanya teks biasa
    expect(screen.getByRole("heading", { name: "Label Baru" })).toBeInTheDocument();
  });
});

describe("LabelsView — tidak ada slug di DOM sama sekali", () => {
  it("tidak ada elemen header atau kolom Slug di output render", () => {
    setupHooks([makeTag({ id: "t1", name: "Foo" })]);
    renderLabels();
    expect(screen.queryByText(/^Slug$/i)).not.toBeInTheDocument();
  });
});
