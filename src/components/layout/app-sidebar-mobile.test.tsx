import { describe, it, expect, vi } from "vitest";
import * as React from "react";
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

// Paksa mode mobile untuk berkas tes ini saja: useIsMobile di provider
// membaca window.innerWidth di jsdom (default 1024 = desktop), sehingga
// cabang mobile tidak terpicu lewat innerWidth saja.
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

function MobileSidebarChecker() {
  const { openMobile } = useSidebar();
  return <div data-testid="mobile-state">{openMobile ? "open" : "closed"}</div>;
}

// Drawer mobile (Sheet) hanya merender isinya saat openMobile=true, jadi
// tes ini membuka drawer dulu lewat context, baru memeriksa tombol tutup.
function OpenMobileDrawer() {
  const { setOpenMobile } = useSidebar();
  React.useEffect(() => {
    setOpenMobile(true);
  }, [setOpenMobile]);
  return null;
}

describe("AppSidebar — drawer mobile", () => {
  it("menampilkan tombol tutup yang terlihat dan menutup drawer saat diklik", () => {
    render(
      <SidebarProvider>
        <OpenMobileDrawer />
        <MobileSidebarChecker />
        <AppSidebar />
      </SidebarProvider>,
    );
    const closeBtn = screen.getByLabelText("Tutup sidebar");
    expect(closeBtn.className).toContain("min-h-[44px]");
    expect(closeBtn.className).toContain("min-w-[44px]");
    fireEvent.click(closeBtn);
    expect(screen.getByTestId("mobile-state").textContent).toBe("closed");
  });
});
