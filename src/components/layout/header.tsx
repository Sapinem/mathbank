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
  // Breadcrumb satu item hanya mengulang H1 (mis. Dasbor, Bank Soal) dan
  // tidak menambah navigasi: sembunyikan di desktop, tampilkan hanya
  // breadcrumb bertingkat. Judul mobile tetap tampil sebagai judul halaman.
  const showBreadcrumb = crumbs.length > 1;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
      <SidebarTrigger className="-ml-1 min-h-[44px] min-w-[44px]" />
      <Separator
        orientation="vertical"
        className={`mr-1 data-[orientation=vertical]:h-4 ${showBreadcrumb ? "" : "sm:hidden"}`}
      />

      {/* Mobile: judul halaman saja */}
      <span className="truncate text-sm font-medium sm:hidden">
        {last.label}
      </span>

      {/* Desktop: breadcrumb bertingkat saja */}
      {showBreadcrumb ? (
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
      ) : null}

      <div className="ml-auto flex items-center gap-1.5">
        {/* Desktop: kotak cari (Button resmi, varian outline) */}
        <Button
          variant="outline"
          onClick={onOpenCommand}
          className="hidden sm:inline-flex w-52 lg:w-64 justify-between items-center h-8.5 px-2.5 rounded-lg border-border/80 bg-muted/30 hover:bg-muted/50 text-muted-foreground transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search data-icon="inline-start" className="size-3.5" />
            <span className="text-xs">Cari halaman…</span>
          </div>
          <kbd className="font-mono text-[10px] font-semibold bg-muted/60 border border-border/80 px-1.5 py-0.5 rounded text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
        {/* Mobile: ikon cari — touch target ≥ 44px (CONSTRAINT #11) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenCommand}
          aria-label="Cari halaman"
          className="min-h-[44px] min-w-[44px] sm:hidden"
        >
          <Search />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
