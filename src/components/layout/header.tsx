"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
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
 * Header — breadcrumb + pencarian (⌘K) + toggle tema.
 * (RENCANA-UI.md §3; tombol "Buat Soal" sengaja TIDAK ada.)
 */
export function Header({ onOpenCommand }: { onOpenCommand: () => void }) {
  const pathname = usePathname();
  const crumbs = breadcrumb(pathname);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border px-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            {i === crumbs.length - 1 ? (
              <span className="font-medium">{c.label}</span>
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

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCommand}
          className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">Cari…</span>
          <kbd className="hidden rounded border border-border px-1 text-xs sm:inline">
            ⌘K
          </kbd>
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
