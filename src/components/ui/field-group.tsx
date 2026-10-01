import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * FieldGroup + Field — pembungkus form dasar (CONSTRAINTS #9).
 *
 * Sempat dianggap "hantu" oleh audit QBank (diklaim tak ada) — memang belum
 * pernah dibuat sebagai modul bersama; `Field` dulu didefinisikan lokal di
 * `question-editor.tsx`. Diangkat ke sini agar dipakai ulang oleh editor &
 * field khusus tipe (matrix_grid/matching).
 */

export function FieldGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>{children}</div>
  );
}

export function Field({
  label,
  children,
  htmlFor,
  className,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)} htmlFor={htmlFor}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
