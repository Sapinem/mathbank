import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { PageState } from "./page-state";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";

/**
 * Uji aksesibilitas otomatis "axe-lite" (M15 T7).
 *
 * Menjalankan **axe-core** (mesin audit a11y yang sama dengan DevTools
 * Lighthouse) di atas komponen yang di-render di jsdom. Menangkap pelanggaran
 * WCAG pada level struktur/ARIA yang lolos dari lint. Bukan pengganti uji
 * manual keyboard/screen-reader, tetapi jaring pengaman otomatis.
 */
async function audit(node: HTMLElement) {
  document.body.appendChild(node);
  const results = await axe.run(node, {
    // jsdom tak punya layout → aturan butuh ukuran/geometri diabaikan saja.
    rules: {
      "color-contrast": { enabled: false },
      "region": { enabled: false },
    },
  });
  document.body.removeChild(node);
  return results.violations;
}

describe("a11y (axe-core) — komponen kunci", () => {
  it("PageState (403/404/galat) tanpa pelanggaran", async () => {
    const { container } = render(
      <PageState code="403" title="Akses ditolak" description="Tidak berwenang.">
        <button type="button">Ke Dasbor</button>
      </PageState>,
    );
    expect(await audit(container)).toEqual([]);
  });

  it("EmptyState tanpa pelanggaran", async () => {
    const { container } = render(
      <EmptyState title="Belum ada data" description="Tambahkan dulu." />,
    );
    expect(await audit(container)).toEqual([]);
  });

  it("LoadingState tanpa pelanggaran", async () => {
    const { container } = render(<LoadingState />);
    expect(await audit(container)).toEqual([]);
  });

  it("ErrorState tanpa pelanggaran", async () => {
    const { container } = render(
      <ErrorState title="Gagal" description="Coba lagi." />,
    );
    expect(await audit(container)).toEqual([]);
  });
});
