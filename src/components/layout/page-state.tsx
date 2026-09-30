import type { ReactNode } from "react";

/**
 * Keadaan halaman penuh (M15) — dipakai halaman galat/404/403 agar tampilannya
 * seragam & bertema (bukan layar bawaan Next.js).
 *
 * Server-safe (tanpa "use client") supaya bisa dipakai `not-found.tsx` dan
 * `global-error.tsx`; bagian interaktif (tombol) dikirim sebagai `children`.
 */
export function PageState({
  code,
  title,
  description,
  icon,
  children,
}: {
  code?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main
      id="konten-utama"
      tabIndex={-1}
      className="grid min-h-dvh place-items-center bg-muted/30 p-6 outline-none"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-brand/10 text-brand">
          {icon ?? <span className="text-2xl font-semibold">∑</span>}
        </div>
        {code && (
          <p className="font-mono text-sm font-medium tracking-widest text-muted-foreground">
            {code}
          </p>
        )}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
        {children && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{children}</div>}
      </div>
    </main>
  );
}
