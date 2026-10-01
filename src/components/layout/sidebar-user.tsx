"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  LogOut,
  Settings,
  User,
  RefreshCw,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ROLE_LABELS } from "@/lib/display/labels";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

/** Inisial dari nama (maks 1 huruf). */
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/**
 * Footer sidebar — menu pengguna (avatar + nama + peran) memakai komponen
 * `SidebarMenuButton`. Saat sidebar mengecil (`icon`), otomatis jadi avatar saja.
 */
export function SidebarUser() {
  const { data: user, isLoading } = useCurrentUser();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const name = user?.name ?? (isLoading ? "…" : "Tamu");
  const roleLabel = user?.roles?.length
    ? user.roles.map((r) => ROLE_LABELS[r] ?? r).join(" · ")
    : "Tanpa peran";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" aria-label="Menu pengguna" />}
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-brand/15 text-xs font-semibold text-brand">
                {initial(name)}
              </AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {roleLabel}
              </span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-56"
            sideOffset={6}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="block truncate">{name}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {roleLabel}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={
                  <Link href="/system/profile" onClick={handleNavClick} />
                }
              >
                <User /> Profil
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link href="/system/settings" onClick={handleNavClick} />
                }
              >
                <Settings /> Pengaturan
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href="/login" onClick={handleNavClick} />}
            >
              <RefreshCw /> Ganti peran (demo)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={async () => {
                // Better Auth sign-out = POST; lalu ke halaman login.
                await fetch("/api/auth/sign-out", { method: "POST" }).catch(
                  () => {},
                );
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
