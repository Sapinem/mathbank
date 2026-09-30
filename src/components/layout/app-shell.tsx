"use client";

import { useState, type ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { CommandPalette } from "./command-palette";
import { ShortcutsHelp } from "./shortcuts-help";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { SkipLink } from "./skip-link";

/**
 * Shell aplikasi MathBank.
 *
 * Memakai komponen **`sidebar` resmi shadcn**:
 * - `SidebarProvider` menangani collapse, drawer mobile, shortcut ⌘B/Ctrl+B,
 *   dan persistensi state (cookie) — tanpa kode buatan sendiri.
 * - `SidebarInset` membungkus konten utama (header + main).
 *
 * Tinggi memakai `min-h-svh` dari provider; konten menggulir di dalam `main`.
 * Pintasan global (M15): ⌘K palette, `/` cari, `g`+huruf navigasi, `?` bantuan.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useKeyboardShortcuts({
    onHelp: () => setHelpOpen(true),
    onSearch: () => setCommandOpen(true),
  });

  return (
    <TooltipProvider delay={0}>
      <SidebarProvider className="h-svh overflow-hidden" data-app-shell>
        <SkipLink />
        <AppSidebar />
        <SidebarInset
          id="konten-utama"
          tabIndex={-1}
          className="flex min-w-0 flex-col overflow-hidden outline-none"
        >
          <Header onOpenCommand={() => setCommandOpen(true)} />
          <div className="flex-1 overflow-y-auto" data-app-scroll>
            {children}
          </div>
        </SidebarInset>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
      </SidebarProvider>
    </TooltipProvider>
  );
}
