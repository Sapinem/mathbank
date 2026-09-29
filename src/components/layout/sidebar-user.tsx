"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react";
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
              <DropdownMenuItem render={<Link href="/sistem/profil" />}>
                <User className="size-4" /> Profil
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/sistem/pengaturan" />}>
                <Settings className="size-4" /> Pengaturan
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                // Endpoint keluar (Better Auth); muat ulang agar sesi tereset.
                router.push("/api/auth/sign-out");
              }}
            >
              <LogOut className="size-4" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
