"use client";

import { useState } from "react";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Tombol "Ekspor Moodle" (M12) — unduh paket sebagai ZIP skema GitSync.
 *
 * Alur: tekan → `GET /api/bundles/[id]/export/moodle`.
 *  - 200 `application/zip` → unduh berkas.
 *  - 422 (ada soal tanpa kunci / tak ada yang bisa diekspor) → dialog peringatan.
 *  - lainnya → dialog error.
 *
 * Unduhan dilakukan via `<a>` sementara + object URL (agar header Content-Disposition
 * tetap dipakai, tapi kita bisa menangani galat JSON dengan rapi).
 */

interface ExportBlocked {
  code: string;
  message: string;
  withoutAnswerKey: string[];
  skipped: { name: string; type: string; reason: string }[];
}

export function MoodleExportButton({ bundleId }: { bundleId: string }) {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<ExportBlocked | null>(null);
  const [skipped, setSkipped] = useState<ExportBlocked["skipped"]>([]);

  async function exportMoodle() {
    setBusy(true);
    setBlocked(null);
    try {
      const res = await fetch(`/api/bundles/${bundleId}/export/moodle`);
      if (res.ok && res.headers.get("content-type")?.includes("zip")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const name =
          /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
          "paket-gitsync.zip";
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        // Bila sebagian soal dilewati, beri tahu lewat dialog ringan.
        const skippedCount = Number(res.headers.get("x-export-skipped") ?? "0");
        if (skippedCount > 0) {
          setSkipped([
            {
              name: `${skippedCount} soal`,
              type: "—",
              reason: "Tipe soal tak punya padanan Moodle langsung (lihat ringkasan).",
            },
          ]);
        }
      } else {
        const body = await res.json().catch(() => null);
        setBlocked({
          code: body?.error?.code ?? "ERROR",
          message: body?.error?.message ?? "Gagal menyusun ekspor.",
          withoutAnswerKey: body?.data?.withoutAnswerKey ?? [],
          skipped: body?.data?.skipped ?? [],
        });
      }
    } catch (err) {
      setBlocked({
        code: "NETWORK",
        message: (err as Error).message,
        withoutAnswerKey: [],
        skipped: [],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={exportMoodle} disabled={busy}>
        {busy ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <Download data-icon="inline-start" />
        )}
        Ekspor Moodle
      </Button>

      <Dialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" /> Ekspor ditolak
            </DialogTitle>
            <DialogDescription>{blocked?.message}</DialogDescription>
          </DialogHeader>
          {blocked?.withoutAnswerKey.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {blocked.withoutAnswerKey.slice(0, 12).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
              {blocked.withoutAnswerKey.length > 12 && (
                <li>… dan {blocked.withoutAnswerKey.length - 12} lainnya</li>
              )}
            </ul>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocked(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={skipped.length > 0} onOpenChange={(o) => !o && setSkipped([])}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" /> Ekspor selesai dengan catatan
            </DialogTitle>
            <DialogDescription>
              Berkas ZIP terunduh, tetapi sebagian soal dilewati.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {skipped.slice(0, 12).map((s, i) => (
              <li key={i}>
                {s.name} — {s.reason}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipped([])}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
