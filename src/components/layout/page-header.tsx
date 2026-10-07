import type { ReactNode } from "react";

/** Judul + deskripsi halaman (konsisten di semua halaman). */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 border-b border-border px-4 py-4 sm:px-6 sm:py-5">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        // Di mobile: wadah aksi MEMBUNGKUS (flex-wrap) & boleh menyusut
        // (min-w-0, bukan shrink-0) agar deretan tombol panjang tidak melebihi
        // layar dan memaksa halaman menggulir horizontal (regresi scroll
        // kanan-kiri pada detail soal). `shrink-0` hanya di ≥sm (desktop),
        // tempat lebar halaman cukup sehingga aksi tetap rapi sejajar judul.
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
          {actions}
        </div>
      )}
    </div>
  );
}
