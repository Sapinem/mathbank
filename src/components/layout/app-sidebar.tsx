"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_GROUPS } from "./nav-config";
import { SidebarUser } from "./sidebar-user";
import { isActive } from "./nav-utils";

/**
 * Sidebar aplikasi MathBank (komponen resmi shadcn).
 *
 * - `collapsible="icon"`: mengecil jadi ikon; label muncul sebagai tooltip.
 * - Drawer mobile & shortcut ⌘B/Ctrl+B ditangani oleh `SidebarProvider`.
 * - Struktur: Header (merek) · Content (4 grup) · Footer (menu pengguna).
 */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" aria-label="MathBank — Dasbor" />}>
              <span className="grid aspect-square size-8 place-items-center rounded-lg bg-brand font-bold text-brand-fg">
                ∑
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight">
                  MathBank
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Bank Soal Matematika
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.hidden);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.badge === "review" && item.badgeCount ? (
                        <SidebarMenuBadge>{item.badgeCount}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** Re-export agar `useSidebar` dipakai dari satu tempat (mis. header). */
export { useSidebar };
