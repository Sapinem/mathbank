"use client";

import { List, LayoutGrid, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ViewMode = "list" | "grid" | "masonry";

const MODES: { value: ViewMode; label: string; Icon: typeof List }[] = [
  { value: "list", label: "List", Icon: List },
  { value: "grid", label: "Grid", Icon: LayoutGrid },
  { value: "masonry", label: "Masonry", Icon: Columns3 },
];

/** Kelas kontainer daftar sesuai mode (M6). */
export function modeClass(mode: ViewMode): string {
  switch (mode) {
    case "grid":
      return "grid grid-cols-1 gap-3.5 p-3 sm:grid-cols-2 sm:p-4";
    case "masonry":
      return "columns-1 gap-3.5 p-3 sm:columns-2 sm:p-4 [&>*]:mb-3.5 [&>*]:break-inside-avoid";
    case "list":
    default:
      return "m-3 sm:m-4 divide-y divide-border/60 rounded-xl border border-border/80 bg-card/40 overflow-hidden shadow-xs";
  }
}

/** Tombol beralih mode tampilan — disimpan di URL oleh pemanggil. */
export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const current = MODES.find((m) => m.value === value) ?? MODES[0];
  const CurrentIcon = current.Icon;

  return (
    <>
      {/* Mobile: Dropdown menu setipe ThemeToggle */}
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="relative size-8 min-h-[44px] min-w-[44px]"
                aria-label={`Mode tampilan: ${current.label}`}
              />
            }
          >
            <CurrentIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {MODES.map(({ value: m, label, Icon }) => (
                <DropdownMenuItem key={m} onClick={() => onChange(m)}>
                  <Icon data-icon="inline-start" className="size-4" />
                  <span>{label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop (>= sm): Segmented button group yang rapi */}
      <div className="hidden sm:flex h-8 shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/20">
        {MODES.map(({ value: m, label, Icon }) => (
          <Button
            key={m}
            variant={value === m ? "secondary" : "ghost"}
            size="icon"
            aria-label={label}
            aria-pressed={value === m}
            onClick={() => onChange(m)}
            className="size-7 rounded-md"
          >
            <Icon className="size-3.5" />
          </Button>
        ))}
      </div>
    </>
  );
}
