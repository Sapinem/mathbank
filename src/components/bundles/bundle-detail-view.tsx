"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil, Printer, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MoodleExportButton } from "@/components/bundles/moodle-export-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { MathContent } from "@/components/math/math-content";
import { useBundle, useBundleValidation } from "@/lib/hooks/use-bundles";
import { cn } from "@/lib/utils";
import { StatusIcon } from "@/components/questions/question-status-badge";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  review: "Telaah",
  ready: "Siap",
  archived: "Arsip",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "ready":
      return "border-success/30 bg-success/10 text-success";
    case "review":
      return "border-gold/30 bg-gold/10 text-gold";
    case "draft":
      return "border-border bg-muted/60 text-muted-foreground";
    case "archived":
      return "border-border/60 bg-muted/30 text-muted-foreground/70";
    default:
      return "";
  }
}

const ORIGIN_LABELS: Record<string, string> = {
  manual: "Manual",
  ingest: "Ingest",
};

/** Detail paket: pratinjau naskah + peringatan validasi. */
export function BundleDetailView() {
  const params = useParams<{ id: string }>();
  const bundleId = params.id;
  const { data: bundle, isPending, isError, error } = useBundle(bundleId);
  const { data: validation } = useBundleValidation(bundleId);

  if (isPending) return <LoadingState label="Memuat paket…" />;
  if (isError)
    return <ErrorState title="Gagal memuat paket" description={(error as Error).message} />;
  if (!bundle) return null;

  return (
    <>
      <PageHeader
        title={bundle.title}
        description={`${bundle.items.length} soal · ${bundle.durationMinutes ?? 0} menit`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/bundles" />}
              nativeButton={false}
              className="min-h-[44px]"
            >
              <ArrowLeft data-icon="inline-start" /> Daftar
            </Button>
            <Button
              render={<Link href={`/bundles/${bundleId}/edit`} />}
              nativeButton={false}
              className="min-h-[44px]"
            >
              <Pencil data-icon="inline-start" /> Sunting
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/bundles/${bundleId}/print`} />}
              nativeButton={false}
              className="min-h-[44px]"
            >
              <Printer data-icon="inline-start" /> Cetak
            </Button>
            <MoodleExportButton bundleId={bundleId} />
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {validation && validation.withoutAnswerKey.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-medium">
                  {validation.withoutAnswerKey.length} soal belum punya kunci jawaban.
                </p>
                <p className="text-muted-foreground">
                  Boleh tetap dipakai, tapi ditandai untuk ditinjau.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick jump rail untuk naskah panjang (> 5 butir) */}
        {bundle.items.length > 5 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/70 bg-card/60 p-3 shadow-2xs">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Lompat ke butir:</span>
            {bundle.items.map((it, idx) => {
              const nomor = idx + 1;
              const hasNoKey = validation?.withoutAnswerKey?.some((w) => w.questionId === it.question.id);
              return (
                <a
                  key={it.item.id}
                  href={`#item-${nomor}`}
                  className={cn(
                    "flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md border text-xs font-mono font-medium transition-colors hover:bg-muted",
                    hasNoKey
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-border/60 bg-background text-foreground",
                  )}
                  title={`Lompat ke nomor ${nomor}${hasNoKey ? " (tanpa kunci)" : ""}`}
                >
                  {nomor}
                </a>
              );
            })}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Pratinjau Naskah</CardTitle>
              <Badge
                variant="outline"
                className={cn("text-xs font-normal", statusBadgeClass(bundle.status))}
              >
                <StatusIcon status={bundle.status} data-icon="inline-start" aria-hidden="true" />
                {STATUS_LABELS[bundle.status] ?? bundle.status}
              </Badge>
              <Badge variant="secondary" className="text-xs font-normal">
                {bundle.bundleType === "exam" ? "Ujian" : "Sumber"}
              </Badge>
              <Badge variant="secondary" className="text-xs font-normal">
                {ORIGIN_LABELS[bundle.origin] ?? bundle.origin}
              </Badge>
            </div>
            {bundle.instructions && (
              <CardDescription className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">
                {bundle.instructions}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {bundle.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">Paket masih kosong.</p>
            ) : (
              bundle.items.map((it, idx) => {
                const nomor = idx + 1;
                const hasNoKey = validation?.withoutAnswerKey?.some((w) => w.questionId === it.question.id);
                return (
                  <div
                    key={it.item.id}
                    id={`item-${nomor}`}
                    className={cn(
                      "flex scroll-mt-20 gap-3 rounded-lg p-2.5 transition-colors",
                      hasNoKey && "border border-amber-500/40 bg-amber-500/5",
                    )}
                  >
                    <span className="w-6 shrink-0 text-right font-medium tabular-nums text-muted-foreground">
                      {nomor}.
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <MathContent content={it.question.contentMarkdown} />
                      {it.item.role === "stimulus" && (
                        <Badge variant="secondary" className="w-fit text-[10px]">
                          Stimulus
                        </Badge>
                      )}
                      {it.question.options.length > 0 && (
                        <ul className="flex flex-col gap-1 pl-1">
                          {it.question.options.map((o) => {
                            const benar = o.isCorrect === true;
                            return (
                              <li
                                key={o.id}
                                className={
                                  "flex items-start gap-2 text-sm leading-relaxed " +
                                  (benar ? "font-medium text-foreground" : "text-muted-foreground")
                                }
                              >
                                <span className="shrink-0 tabular-nums">{o.label}.</span>
                                <span className="min-w-0 flex-1">
                                  <MathContent content={o.contentMarkdown} />
                                </span>
                                {benar && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[10px] border-success/30 bg-success/10 text-success"
                                  >
                                    Kunci
                                  </Badge>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
