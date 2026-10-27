import {
  FilePenLine,
  Clock,
  CheckCircle2,
  Archive,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/display/labels";

/**
 * Indikator status soal (Sprint 1 · MAT-127).
 *
 * Pemetaan warna yang diminta operasional (DoD MAT-127):
 *  - draft    → abu-abu netral
 *  - review   → kuning (emas) — menunggu tindakan
 *  - ready    → hijau — siap dipakai
 *  - archived → merah + coret — tidak dipakai lagi
 *
 * ⚠️ `statusClass()` di `lib/display/labels` TETAP dipakai daftar/kartu
 * (kontrak tampilan lama, "Siap" = biru brand). Komponen ini adalah tampilan
 * status untuk halaman DETAIL, di mana makna "siap pakai" harus terbaca
 * hijau. Penyatuan kedua pemetaan dicatat sebagai tindak lanjut di
 * `docs/sprint1/ICHSAN-PROGRESS.md`.
 */
const STATUS_STYLES: Record<string, string> = {
  draft: "border-border bg-muted/70 text-muted-foreground",
  review: "border-gold/40 bg-gold/15 text-gold-fg",
  ready: "border-success/40 bg-success/10 text-success",
  archived: "border-error/40 bg-error/10 text-error line-through decoration-error/60",
};

/** Ikon Lucide untuk status FSM soal & paket. */
export function StatusIcon({
  status,
  className,
  "data-icon": dataIcon,
  "aria-hidden": ariaHidden = true,
}: {
  status: string;
  className?: string;
  "data-icon"?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  switch (status) {
    case "draft":
      return <FilePenLine className={className} data-icon={dataIcon} aria-hidden={ariaHidden} />;
    case "review":
      return <Clock className={className} data-icon={dataIcon} aria-hidden={ariaHidden} />;
    case "ready":
      return <CheckCircle2 className={className} data-icon={dataIcon} aria-hidden={ariaHidden} />;
    case "archived":
      return <Archive className={className} data-icon={dataIcon} aria-hidden={ariaHidden} />;
    default:
      return <HelpCircle className={className} data-icon={dataIcon} aria-hidden={ariaHidden} />;
  }
}

export function QuestionStatusBadge({
  status,
  className,
  showReady = false,
}: {
  status: string;
  className?: string;
  showReady?: boolean;
}) {
  // Siap = kondisi normal/default: tidak dirender sama sekali di tampilan
  // soal (header detail & klasifikasi), kecuali jika showReady diaktifkan.
  if (status === "ready" && !showReady) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        STATUS_STYLES[status] ?? STATUS_STYLES.draft,
        className,
      )}
      title={`Status: ${STATUS_LABELS[status] ?? status}`}
    >
      <StatusIcon status={status} data-icon="inline-start" aria-hidden="true" />
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
