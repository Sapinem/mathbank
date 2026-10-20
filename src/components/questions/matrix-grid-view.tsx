"use client";

import { Check, X } from "lucide-react";
import { MathContent } from "@/components/math/math-content";
import { cn } from "@/lib/utils";

/**
 * Bentuk `data_payload` untuk soal `matrix_grid` (benar-salah) — BENTUK RESMI
 * yang ditulis pipeline ingest (`defantri-tf.ts`):
 *
 *   { rows: [{ text, answer }], labels: ["Benar", "Salah"] }
 *
 * ⚠️ Sebelumnya editor memakai bentuk lain (`{ rows:[{label}], columns }`) —
 * itu TIDAK cocok dengan data tersimpan (262/262 soal pakai `text`+`answer`).
 */
export interface MatrixGridPayload {
  rows: { text: string; answer?: string | null }[];
  labels: string[];
}

const DEFAULT_LABELS = ["Benar", "Salah"];

/** Normalisasi `data_payload` mentah → bentuk terketik (aman, tanpa asumsi). */
export function readMatrixGridPayload(dp: unknown): MatrixGridPayload {
  const o = (dp ?? {}) as Record<string, unknown>;
  const labels = Array.isArray(o.labels) ? (o.labels as unknown[]).map(String) : DEFAULT_LABELS;
  const rows = Array.isArray(o.rows)
    ? (o.rows as unknown[]).map((r) => {
        const row = (r ?? {}) as Record<string, unknown>;
        // Terima `text` (bentuk resmi) maupun `label` (bentuk editor lama).
        const text = String(row.text ?? row.label ?? "");
        const answer = row.answer != null ? String(row.answer) : null;
        return { text, answer };
      })
    : [];
  return { rows, labels };
}

/**
 * Tampilan soal `matrix_grid` (benar-salah) untuk halaman detail.
 *
 * Setiap baris = satu pernyataan; kolom kunci = `labels` (mis. Benar/Salah).
 * Pernyataan sudah bersih dari markdown defantri DAN sudah punya `{{img:…}}`.
 */
export function MatrixGridView({
  payload,
  className,
}: {
  payload: MatrixGridPayload;
  className?: string;
}) {
  const { rows, labels } = payload;
  if (rows.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2 border-t border-border/40 pt-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pernyataan Benar–Salah
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          {labels.map((l) => (
            <span key={l} className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5">
              {l}
            </span>
          ))}
        </span>
      </div>

      <ol className="flex flex-col gap-1.5">
        {rows.map((r, i) => {
          const isTrue = r.answer ? r.answer.toLowerCase().startsWith("b") || r.answer.toLowerCase() === "true" : false;
          const answered = r.answer != null && r.answer !== "";
          return (
            <li
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border/50 px-3 py-2",
                answered ? "bg-emerald-500/5 dark:bg-emerald-950/20" : "",
              )}
            >
              <span className="mt-0.5 font-mono text-sm font-semibold text-muted-foreground shrink-0">
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1 text-base lg:text-[17px] lg:leading-[1.7]">
                <MathContent content={r.text} noScroll />
              </div>
              <span
                className={cn(
                  "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-bold",
                  !answered
                    ? "bg-muted text-muted-foreground"
                    : isTrue
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-400",
                )}
                title={answered ? "Kunci pernyataan" : "Kunci belum ada"}
              >
                {answered ? (
                  <>
                    {isTrue ? <Check className="size-3" /> : <X className="size-3" />}
                    {r.answer}
                  </>
                ) : (
                  "—"
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
