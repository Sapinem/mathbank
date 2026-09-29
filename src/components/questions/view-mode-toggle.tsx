"use client";

import { List, LayoutGrid, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "list" | "grid" | "masonry";

const MODES: { value: ViewMode; label: string; Icon: typeof List }[] = [
  { value: "list", label: "Daftar padat", Icon: List },
  { value: "grid", label: "Kisi", Icon: LayoutGrid },
  { value: "masonry", label: "Kolom (masonry)", Icon: Columns3 },
];

/** Kelas kontainer daftar sesuai mode (M6). */
export function modeClass(mode: ViewMode): string {
  switch (mode) {
    case "grid":
      return "grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3";
    case "masonry":
      return "columns-1 gap-3 p-3 sm:columns-2 sm:p-4 xl:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid";
    case "list":
    default:
      return "";
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
  return (
    <div className="hidden shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5 sm:flex">
      {MODES.map(({ value: m, label, Icon }) => (
        <Button
          key={m}
          variant={value === m ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={label}
          aria-pressed={value === m}
          onClick={() => onChange(m)}
        >
          <Icon />
        </Button>
      ))}
    </div>
  );
}
