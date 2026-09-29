"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { Header } from "./header";
import { CommandPalette } from "./command-palette";

/**
 * Shell aplikasi (Fase C + Fase R) — sidebar (desktop) / drawer (mobile)
 * + header + command palette.
 *
 * Responsif (RENCANA-UI-MOBILE.md §6): di bawah `lg` sidebar jadi drawer.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onOpenCommand={() => setCommandOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
