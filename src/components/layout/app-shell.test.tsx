import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CommandPalette } from "./command-palette";
import { AppShell } from "./app-shell";

/**
 * Tes komponen shell (M14) — `Header`/`CommandPalette`/`AppShell` yang tadinya tipis.
 *
 * Catatan: `CommandDialog` (cmdk/Radix) butuh konteks portal penuh, jadi tes
 * palette di sini fokus pada **perilaku keyboard** (listener ⌘K/Escape) yang
 * tak butuh render pohon dialog — bukan cuplikan vendor.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/questions",
}));

function withQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => push.mockReset());

describe("CommandPalette — keyboard ⌘K", () => {
  it("⌘K memanggil onOpenChange (toggle)", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={false} onOpenChange={onOpenChange} />);
    act(() => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("Ctrl+K juga memicu toggle", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={false} onOpenChange={onOpenChange} />);
    act(() => {
      fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("tombol 'k' biasa tidak memicu", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={false} onOpenChange={onOpenChange} />);
    act(() => {
      fireEvent.keyDown(document, { key: "k" });
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("listener dilepas saat unmount (tak bocor)", () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(<CommandPalette open={false} onOpenChange={onOpenChange} />);
    unmount();
    act(() => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("AppShell", () => {
  it("merender konten anak di dalam area gulir", () => {
    withQuery(
      <AppShell>
        <p>Isi halaman</p>
      </AppShell>,
    );
    expect(screen.getByText("Isi halaman")).toBeInTheDocument();
    const scroller = document.querySelector("[data-app-scroll]");
    expect(scroller?.textContent).toContain("Isi halaman");
  });

  it("menyediakan landmark konten utama + penanda shell", () => {
    withQuery(
      <AppShell>
        <p>x</p>
      </AppShell>,
    );
    expect(document.querySelector("#konten-utama")).toBeTruthy();
    expect(document.querySelector("[data-app-shell]")).toBeTruthy();
  });

  it("menyediakan skip-link ke konten utama", () => {
    withQuery(
      <AppShell>
        <p>x</p>
      </AppShell>,
    );
    // SkipLink shadcn: anchor menuju #konten-utama
    const skip = document.querySelector('a[href="#konten-utama"]');
    expect(skip).toBeTruthy();
  });

  it("memastikan tombol header memiliki touch target minimal 44x44px (CONSTRAINT #11)", () => {
    withQuery(
      <AppShell>
        <p>x</p>
      </AppShell>,
    );
    // SidebarTrigger
    const trigger = document.querySelector('[data-sidebar="trigger"]');
    expect(trigger?.className).toContain("min-h-[44px]");
    expect(trigger?.className).toContain("min-w-[44px]");

    // Tombol cari mobile
    const mobileSearch = screen.getByLabelText("Cari");
    expect(mobileSearch.className).toContain("min-h-[44px]");
    expect(mobileSearch.className).toContain("min-w-[44px]");

    // Tombol ganti tema
    const themeBtn = screen.getByLabelText("Ganti tema");
    expect(themeBtn.className).toContain("min-h-[44px]");
    expect(themeBtn.className).toContain("min-w-[44px]");
  });
});
