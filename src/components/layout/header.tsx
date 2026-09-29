"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, Menu } from "lucide-react";
import { NAV_GROUPS } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";

/** Bangun breadcrumb dari pathname. */
function breadcrumb(pathname: string): { label: string; href: string }[] {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href !== "/" && (pathname === item.href || pathname.startsWith(item.href + "/"))) {
        const parts = [{ label: item.label, href: item.href }];
        const rest = pathname.slice(item.href.length).split("/").filter(Boolean);
        let acc = item.href;
        for (const seg of rest) {
          acc += "/" + seg;
          parts.push({ label: decodeURIComponent(seg), href: acc });
        }
        return parts;
      }
    }
  }
  return [{ label: "Dasbor", href: "/" }];
}

/**
 * Header — ☰ (mobile) + breadcrumb + pencarian (⌘K) + tema.
 * (RENCANA-UI.md §3, §4b; tombol "Buat Soal" sengaja TIDAK ada.)
 *
 * Responsif: mobile = ☰ + judul singkat + ikon cari; desktop = breadcrumb penuh + kotak cari.
 */
export function Header({
  onOpenCommand,
  onOpenMobileNav,
}: {
  onOpenCommand: () => void;
  onOpenMobileNav: () => void;
}) {
  const pathname = usePathname();
  const crumbs = breadcrumb(pathname);
  const last = crumbs[crumbs.length - 1];

  return (
    <header className="flex h-14 items-center gap-2 border-b border-border px-3 sm:px-4">
      {/* Hamburger — mobile/tablet saja */}
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Buka menu"
        className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile: judul halaman saja */}
      <span className="truncate text-sm font-medium sm:hidden">{last.label}</span>

      {/* Desktop: breadcrumb penuh */}
      <nav
        aria-label="Breadcrumb"
        className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex"
      >
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium">{c.label}</span>
            ) : (
              <Link
                href={c.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Desktop: kotak cari */}
        <button
          type="button"
          onClick={onOpenCommand}
          className="hidden items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted sm:flex"
        >
          <Search className="size-4" />
          <span>Cari…</span>
          <kbd className="rounded border border-border px-1 text-xs">⌘K</kbd>
        </button>
        {/* Mobile: ikon cari */}
        <button
          type="button"
          onClick={onOpenCommand}
          aria-label="Cari"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted sm:hidden"
        >
          <Search className="size-5" />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
