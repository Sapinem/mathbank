"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Toggle tema: Terang / Gelap / Ikuti Sistem (RENCANA-UI.md §6).
 *
 * Ikon dirender oleh CSS (`.dark` / `.light`) agar tak perlu state "mounted" —
 * menghindari setState dalam effect (larangan React Compiler).
 *
 * Memakai `Button variant="ghost" size="icon-sm"` resmi (bukan tombol kustom);
 * ukuran ikon ditangani komponen (`[&_svg]:size-4`), jadi TIDAK ada `size-4` manual.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            aria-label="Ganti tema"
          />
        }
      >
        <Sun className="dark:hidden" />
        <Moon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun data-icon="inline-start" /> Terang
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon data-icon="inline-start" /> Gelap
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor data-icon="inline-start" /> Ikuti Sistem
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
