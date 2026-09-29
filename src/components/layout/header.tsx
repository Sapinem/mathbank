"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "./nav-config";
import { breadcrumbFromPath } from "./nav-utils";
import { ThemeToggle } from "./theme-toggle";

/**
 * Header halaman — SidebarTrigger (⌘B) + breadcrumb + pencarian (⌘K) + tema.
 *
 * `SidebarTrigger` resmi shadcn menggantikan tombol ☰ buatan sendiri:
 * di desktop mengecilkan sidebar; di mobile membuka drawer.
 */
export function Header({ onOpenCommand }: { onOpenCommand: () => void }) {
  const pathname = usePathname();
  const crumbs = breadcrumbFromPath(pathname, NAV_GROUPS);
  const last = crumbs[crumbs.length - 1];

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />

      {/* Mobile: judul halaman saja */}
      <span className="truncate text-sm font-medium sm:hidden">
        {last.label}
      </span>

      {/* Desktop: breadcrumb penuh */}
      <Breadcrumb className="hidden min-w-0 sm:block">
        <BreadcrumbList>
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={c.href} className="contents">
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={c.href} />}>
                      {c.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Desktop: kotak cari (Button resmi, varian outline) */}
        <Button
          variant="outline"
          onClick={onOpenCommand}
          className="hidden gap-2 bg-muted/40 text-muted-foreground sm:inline-flex"
        >
          <Search data-icon="inline-start" />
          <span>Cari…</span>
          <kbd className="rounded border border-border px-1 text-xs">⌘K</kbd>
        </Button>
        {/* Mobile: ikon cari */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenCommand}
          aria-label="Cari"
          className="sm:hidden"
        >
          <Search />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
