import type { ReactNode } from "react";
import { Loader2, AlertTriangle, Inbox } from "lucide-react";

/** Keadaan kosong — belum ada data. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-muted-foreground">
        {icon ?? (
          <div className="relative mx-auto flex size-12 items-center justify-center rounded-2xl border border-border/80 bg-muted/40 text-muted-foreground/70 shadow-2xs">
            {/* Aksen kisi garis koordinat kartesius beropasitas halus */}
            <svg
              className="absolute inset-0 size-full text-foreground/5 stroke-current"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
            >
              <line x1="24" y1="4" x2="24" y2="44" strokeDasharray="2 2" strokeWidth="1" />
              <line x1="4" y1="24" x2="44" y2="24" strokeDasharray="2 2" strokeWidth="1" />
            </svg>
            <Inbox className="relative size-6" aria-hidden="true" />
          </div>
        )}
      </div>
      <h3 className="font-medium">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  );
}

/** Keadaan memuat. */
export function LoadingState({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

/** Keadaan galat. */
export function ErrorState({
  title = "Terjadi kesalahan",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <AlertTriangle className="size-8 text-error" />
      <h3 className="font-medium">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  );
}

/** Halaman belum dibangun (placeholder jujur untuk milestone belum tiba). */
export function ComingSoon({ milestone }: { milestone: string }) {
  return (
    <EmptyState
      title="Belum tersedia"
      description={`Halaman ini direncanakan pada tahap ${milestone}.`}
    />
  );
}
