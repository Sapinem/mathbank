"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GOTO_SHORTCUTS } from "./use-keyboard-shortcuts";

/** Satu baris pintasan: deskripsi + deretan tombol (kbd). */
function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={`${k}-${i}`}
            className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
          >
            {k}
          </kbd>
        ))}
      </span>
    </div>
  );
}

/**
 * Dialog bantuan pintasan keyboard (M15) — dibuka dengan `?`.
 * Menampilkan pintasan yang tersedia agar bisa ditemukan pengguna.
 */
export function ShortcutsHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pintasan Keyboard</DialogTitle>
          <DialogDescription>
            Percepat navigasi tanpa meninggalkan keyboard.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col divide-y">
          <Row keys={["⌘", "K"]} label="Buka command palette" />
          <Row keys={["/"]} label="Fokus ke pencarian" />
          <Row keys={["?"]} label="Tampilkan bantuan ini" />
          <div className="pt-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Navigasi cepat (tekan G lalu huruf)
            </p>
            {Object.entries(GOTO_SHORTCUTS).map(([key, v]) => (
              <Row
                key={key}
                keys={["G", key.toUpperCase()]}
                label={v.label}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
