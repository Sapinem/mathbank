import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/questions",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-current-user", () => ({
  useCurrentUser: () => ({
    data: { id: "u1", name: "Guru Pengguna", roles: ["teacher"], via: "session" },
    isLoading: false,
  }),
}));

// Helper component untuk memeriksa state drawer mobile
function MobileSidebarChecker() {
  const { openMobile } = useSidebar();
  return <div data-testid="mobile-state">{openMobile ? "open" : "closed"}</div>;
}

describe("AppSidebar — Responsif & Navigasi", () => {
  it("merender item menu navigasi utama", () => {
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );

    expect(screen.getByText("Bank Soal")).toBeInTheDocument();
    expect(screen.getByText("Dasbor")).toBeInTheDocument();
    expect(screen.getByText("Paket Soal")).toBeInTheDocument();
  });

  it("menutup drawer mobile ketika link navigasi diklik pada layar mobile", () => {
    // Render dengan konteks mobile aktif
    render(
      <SidebarProvider defaultOpen={false}>
        <MobileSidebarChecker />
        <AppSidebar />
      </SidebarProvider>,
    );

    const link = screen.getByText("Bank Soal");
    fireEvent.click(link);

    const state = screen.getByTestId("mobile-state");
    expect(state.textContent).toBe("closed");
  });

  it("tidak menampilkan tombol tutup sidebar di desktop", () => {
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );
    expect(screen.queryByLabelText("Tutup sidebar")).toBeNull();
  });
});
