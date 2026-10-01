"use client";

import { useState } from "react";
import { FolderGit2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
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
 * Tombol "Ekspor ke GitSync" (M12) — tulis paket ke folder GitSync di disk.
 *
 * `POST /api/bundles/[id]/export/moodle` → MathBank menulis
 * `<MATHBANK_EXPORT_DIR>/<paket>/top/...` + git commit, lalu mengembalikan
 * ringkasan (folder tujuan + hash commit). **Tak ada unduhan ZIP** — GitSync
 * membaca isi folder, bukan arsip.
 */

interface ExportOk {
  directory: string;
  written: number;
  committed: boolean;
  commitHash: string | null;
  note: string;
}

interface ExportBlocked {
  message: string;
  withoutAnswerKey: string[];
}

export function MoodleExportButton({ bundleId }: { bundleId: string }) {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<ExportOk | null>(null);
  const [blocked, setBlocked] = useState<ExportBlocked | null>(null);

  async function exportMoodle() {
    setBusy(true);
    setOk(null);
    setBlocked(null);
    try {
      const res = await fetch(`/api/bundles/${bundleId}/export/moodle`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.data) {
        setOk(body.data as ExportOk);
      } else {
        setBlocked({
          message: body?.error?.message ?? "Gagal menyusun ekspor.",
          withoutAnswerKey: body?.data?.withoutAnswerKey ?? [],
        });
      }
    } catch (err) {
      setBlocked({ message: (err as Error).message, withoutAnswerKey: [] });
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
          <FolderGit2 data-icon="inline-start" />
        )}
        Ekspor ke GitSync
      </Button>

      {/* Berhasil */}
      <Dialog open={!!ok} onOpenChange={(o) => !o && setOk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" /> Ekspor selesai
            </DialogTitle>
            <DialogDescription>
              {ok?.written} berkas ditulis ke folder GitSync.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Folder tujuan: </span>
              <code className="rounded bg-muted px-1.5 py-0.5">{ok?.directory}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Git: </span>
              {ok?.committed ? (
                <span>
                  commit <code className="rounded bg-muted px-1.5 py-0.5">{ok.commitHash}</code>
                </span>
              ) : (
                <span>{ok?.note || "tidak ada perubahan"}</span>
              )}
            </div>
            <p className="text-muted-foreground">
              Selanjutnya: <code>cd</code> ke folder itu →{" "}
              <code>git remote add … &amp;&amp; git push</code>, atau jadikan repo GitSync Anda.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOk(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ditolak */}
      <Dialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" /> Ekspor ditolak
            </DialogTitle>
            <DialogDescription>{blocked?.message}</DialogDescription>
          </DialogHeader>
          {blocked?.withoutAnswerKey.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
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
    </>
  );
}
