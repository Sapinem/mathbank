"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Brand, SidebarNav } from "./sidebar";

/**
 * Drawer navigasi mobile (< lg) — RENCANA-UI §4b.
 * Terbuka dari tombol ☰ di header; menutup setelah memilih menu.
 */
export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="h-14 justify-center border-b border-border px-3">
          <SheetTitle className="flex items-center gap-2">
            <Brand />
          </SheetTitle>
        </SheetHeader>
        <SidebarNav onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
