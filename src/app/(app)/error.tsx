"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/layout/page-state";

/**
 * Error boundary (M15) — menangkap galat render di subtree `(app)`.
 *
 * Menampilkan tampilan ramah bertema (bukan layar bawaan Next.js). **Tidak**
 * membocorkan stack trace ke pengguna; detail hanya di-log konsol (dev) dan
 * `digest` ditampilkan sebagai kode rujukan bila ada.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log ke konsol server/klien untuk diagnosa (bukan ditampilkan ke UI).
    console.error("[MathBank] Galat render:", error);
  }, [error]);

  return (
    <PageState
      code={error.digest ? `KODE ${error.digest}` : undefined}
      icon={<AlertTriangle className="size-6 text-error" />}
      title="Terjadi kesalahan"
      description="Maaf, ada gangguan saat memuat halaman ini. Coba lagi — bila terus berlanjut, hubungi administrator."
    >
      <Button onClick={reset} data-icon="inline-start">
        <RotateCcw data-icon="inline-start" />
        Coba lagi
      </Button>
      <Button
        variant="outline"
        onClick={() => router.push("/")}
        data-icon="inline-start"
      >
        <LayoutDashboard data-icon="inline-start" />
        Ke Dasbor
      </Button>
    </PageState>
  );
}
