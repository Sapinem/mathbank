import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading UI (M15) — tampil saat halaman (app) memuat (route transition /
 * Suspense). Rangka konsisten dengan tata letak: header + daftar kartu.
 */
export default function Loading() {
  return (
    <div
      className="flex w-full flex-col gap-6 p-4 md:p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Memuat…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
