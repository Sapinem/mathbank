import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarUser } from "./sidebar-user";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const mockUser = vi.fn();
vi.mock("@/lib/hooks/use-current-user", () => ({
  useCurrentUser: () => mockUser(),
}));

/** `SidebarMenuButton` butuh `SidebarProvider` (konteks vendor shadcn). */
function renderUser() {
  return render(
    <SidebarProvider>
      <SidebarUser />
    </SidebarProvider>,
  );
}

describe("SidebarUser", () => {
  beforeEach(() => push.mockReset());

  it("menampilkan nama & label peran pengguna", () => {
    mockUser.mockReturnValue({
      data: { id: "u1", name: "Budi Santoso", roles: ["teacher"], via: "session" },
      isLoading: false,
    });
    renderUser();
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    // label peran Bahasa Indonesia (teacher → Guru)
    expect(screen.getAllByText(/Guru/).length).toBeGreaterThan(0);
  });

  it("menampilkan '…' saat memuat, 'Tamu' bila tak ada user", () => {
    mockUser.mockReturnValue({ data: undefined, isLoading: true });
    const { unmount } = renderUser();
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
    unmount();

    mockUser.mockReturnValue({ data: undefined, isLoading: false });
    renderUser();
    expect(screen.getByText("Tamu")).toBeInTheDocument();
  });

  it("menampilkan 'Tanpa peran' bila roles kosong", () => {
    mockUser.mockReturnValue({
      data: { id: "u2", name: "X", roles: [], via: "session" },
      isLoading: false,
    });
    renderUser();
    expect(screen.getByText("Tanpa peran")).toBeInTheDocument();
  });

  it("menggabungkan beberapa peran dengan ' · '", () => {
    mockUser.mockReturnValue({
      data: { id: "u3", name: "Multi", roles: ["admin", "reviewer"], via: "session" },
      isLoading: false,
    });
    const { container } = renderUser();
    const text = container.textContent ?? "";
    expect(text).toContain("Administrator");
    expect(text).toContain("Penelaah");
    expect(text).toContain(" · ");
  });
});
