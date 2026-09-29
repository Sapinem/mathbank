"use client";

import Link from "next/link";
import { Monitor } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

/**
 * Pengalih "desktop-saja" (Fase R, Pola D — RENCANA-UI-MOBILE.md §7.4).
 *
 * Halaman yang butuh presisi (editor, penyusun paket, tikz) TIDAK dioptimalkan
 * untuk HP. Di layar < `lg`, tampilkan pesan ramah — bukan error/rusak.
 * Di desktop, render `children` seperti biasa.
 */
export function DesktopOnly({
  children,
  title = "Penyuntingan paling nyaman di layar besar",
  description = "Buka MathBank di komputer atau tablet lanskap untuk menyunting. Anda tetap bisa melihat daftar dari ponsel.",
  backHref = "/",
  backLabel = "← Kembali",
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (isDesktop) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <Monitor className="size-7" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}
