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
        {icon ?? <Inbox className="size-8" />}
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
