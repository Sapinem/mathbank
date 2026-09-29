"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_GROUPS } from "./nav-config";

/**
 * Command palette (⌘K) — navigasi cepat (RENCANA-UI.md §2).
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Cari halaman…" />
      <CommandList>
        <CommandEmpty>Tidak ditemukan.</CommandEmpty>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.hidden);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={group.label} heading={group.label}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`${group.label} ${item.label}`}
                    onSelect={() => go(item.href)}
                  >
                    <Icon />
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
