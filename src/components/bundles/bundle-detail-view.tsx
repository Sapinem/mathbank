"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Printer,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  BookOpen,
  Sliders,
  FileText,
  LayoutGrid,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MoodleExportButton } from "@/components/bundles/moodle-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { MathContent } from "@/components/math/math-content";
import { useBundle, useBundleValidation } from "@/lib/hooks/use-bundles";
import { cn } from "@/lib/utils";
import { statusBadgeClass } from "@/lib/display/bundle-labels";
import { StatusIcon } from "@/components/questions/question-status-badge";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  review: "Telaah",
  ready: "Siap",
  archived: "Arsip",
};

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
  const [viewMode, setViewMode] = useState<"document" | "cards">("document");

  if (isPending) return <LoadingState label="Memuat paket…" />;
  if (isError)
    return <ErrorState title="Gagal memuat paket" description={(error as Error).message} />;
  if (!bundle) return null;

  const withoutKeySet = new Set(validation?.withoutAnswerKey?.map((w) => w.questionId));
  const questionItems = bundle.items.filter((it) => it.item.role !== "stimulus");

  return (
    <>
      <PageHeader
        title={bundle.title}
        description={`${bundle.items.length} soal · ${bundle.durationMinutes ?? 0} menit`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/bundles" />}
              nativeButton={false}
              className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3"
              aria-label="Kembali ke Daftar Paket"
              title="Kembali ke Daftar Paket"
            >
              <ArrowLeft data-icon="inline-start" />
              <span className="hidden sm:inline">Daftar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/bundles/${bundleId}/edit`} />}
              nativeButton={false}
              className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3"
              aria-label="Susun Paket Soal"
              title="Susun Paket Soal"
            >
              <Pencil data-icon="inline-start" />
              <span className="hidden sm:inline">Susun Paket</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/bundles/${bundleId}/print`} />}
              nativeButton={false}
              className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3"
              aria-label="Cetak Paket Soal"
              title="Cetak Paket Soal"
            >
              <Printer data-icon="inline-start" />
              <span className="hidden sm:inline">Cetak PDF</span>
            </Button>
            <MoodleExportButton bundleId={bundleId} />
          </div>
        }
      />

      <div className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* KOLOM KIRI (UTAMA: PRATINJAU NASKAH SOAL) (~67%) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Peringatan Kunci Jawaban Belum Lengkap */}
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

            {/* Bilah Navigasi Butir & Mode Tampilan */}
            {bundle.items.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/60 p-2.5 sm:p-3 shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground shrink-0">Butir:</span>
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                      {bundle.items.map((it) => {
                        const isStimulus = it.item.role === "stimulus";
                        const qNum = isStimulus ? null : questionItems.findIndex((q) => q.item.id === it.item.id) + 1;
                        const nomorDisplay = it.item.itemNumber || (qNum ? String(qNum) : "W");
                        const hasNoKey = withoutKeySet.has(it.question.id);
                        return (
                          <a
                            key={it.item.id}
                            href={`#item-${it.item.id}`}
                            className={cn(
                              "relative flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-mono font-medium transition-colors hover:bg-muted active:scale-95",
                              hasNoKey
                                ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "border-border/60 bg-background text-foreground",
                            )}
                            title={`${isStimulus ? "Wacana" : `Soal #${qNum}`}${it.item.itemNumber ? ` (${it.item.itemNumber})` : ""}${hasNoKey ? " (tanpa kunci)" : ""}`}
                          >
                            {nomorDisplay}
                            {hasNoKey && (
                              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-amber-500" />
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>

                  {/* Segmented Mode Toggle: Naskah vs Kartu */}
                  <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/20">
                    <button
                      type="button"
                      onClick={() => setViewMode("document")}
                      aria-pressed={viewMode === "document"}
                      title="Mode Naskah (artikel mengalir)"
                      className={cn(
                        "flex min-h-[44px] sm:min-h-[32px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                        viewMode === "document"
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <FileText className="size-3.5" data-icon="inline-start" />
                      <span className="hidden sm:inline">Naskah</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("cards")}
                      aria-pressed={viewMode === "cards"}
                      title="Mode Kartu (blok terpisah)"
                      className={cn(
                        "flex min-h-[44px] sm:min-h-[32px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                        viewMode === "cards"
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <LayoutGrid className="size-3.5" data-icon="inline-start" />
                      <span className="hidden sm:inline">Kartu</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Konten Butir Soal Berdasarkan Mode Tampilan */}
            {bundle.items.length === 0 ? (
              <Card className="rounded-xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">
                Paket masih kosong. Tambahkan butir soal di menu &ldquo;Susun Paket&rdquo;.
              </Card>
            ) : viewMode === "document" ? (
              /* MODE NASKAH (ARTIKEL TERPADU / DOKUMEN MENYATU ALAMI) */
              <Card className="rounded-xl border border-border/70 bg-card divide-y divide-border/40 shadow-xs overflow-hidden">
                {bundle.items.map((it) => {
                  const isStimulus = it.item.role === "stimulus";
                  const qNum = isStimulus ? null : questionItems.findIndex((q) => q.item.id === it.item.id) + 1;
                  const hasNoKey = withoutKeySet.has(it.question.id);
                  return (
                    <div
                      key={it.item.id}
                      id={`item-${it.item.id}`}
                      className={cn(
                        "group relative flex scroll-mt-20 gap-3 p-4 sm:p-5 transition-colors",
                        hasNoKey && "bg-amber-500/5",
                      )}
                    >
                      <span className="w-8 shrink-0 text-right font-medium tabular-nums text-muted-foreground pt-0.5 font-mono text-xs">
                        {it.item.itemNumber
                          ? it.item.itemNumber.endsWith(".")
                            ? it.item.itemNumber
                            : `${it.item.itemNumber}.`
                          : isStimulus
                            ? ""
                            : `${qNum}.`}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                        <div className="text-base leading-relaxed text-foreground">
                          <MathContent content={it.question.contentMarkdown} />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {it.item.role === "stimulus" && (
                            <Badge variant="secondary" className="gap-1 border-info/30 bg-info/10 text-info text-[10px]">
                              <BookOpen className="size-3" /> Wacana
                            </Badge>
                          )}
                          {it.item.sectionName && (
                            <Badge variant="outline" className="border-border/80 text-[10px] text-muted-foreground">
                              {it.item.sectionName}
                            </Badge>
                          )}
                          {it.item.notes && (
                            <span className="font-mono text-[10px] text-muted-foreground" title={it.item.notes}>
                              (Ada Catatan)
                            </span>
                          )}
                        </div>

                        {it.question.options.length > 0 && (
                          <ul className="flex flex-col gap-1.5 pl-1">
                            {it.question.options.map((o) => {
                              const benar = o.isCorrect === true;
                              return (
                                <li
                                  key={o.id}
                                  className={cn(
                                    "flex items-start gap-2 text-sm leading-relaxed",
                                    benar
                                      ? "font-medium text-foreground"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "shrink-0 font-medium tabular-nums",
                                      benar ? "text-success font-bold" : "",
                                    )}
                                  >
                                    {o.label}.
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <MathContent content={o.contentMarkdown} />
                                  </span>
                                  {benar && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 text-[10px] border-success/30 bg-success/10 text-success font-mono font-semibold"
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
                })}
              </Card>
            ) : (
              /* MODE KARTU (BLOK MODULAR TERPISAH) */
              <div className="flex flex-col gap-4">
                {bundle.items.map((it) => {
                  const isStimulus = it.item.role === "stimulus";
                  const qNum = isStimulus ? null : questionItems.findIndex((q) => q.item.id === it.item.id) + 1;
                  const hasNoKey = withoutKeySet.has(it.question.id);
                  return (
                    <div
                      key={it.item.id}
                      id={`item-${it.item.id}`}
                      className={cn(
                        "flex scroll-mt-20 flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-colors",
                        hasNoKey && "border-amber-500/40 bg-amber-500/5",
                      )}
                    >
                      {/* Baris Atas Butir: Nomor di kiri, Tautan Buka Soal di kanan */}
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand">
                            {isStimulus
                              ? (it.item.itemNumber ? `Wacana #${it.item.itemNumber}` : "Wacana")
                              : `Butir #${it.item.itemNumber || qNum}`}
                          </span>
                          {it.item.role === "stimulus" && (
                            <Badge variant="secondary" className="gap-1 border-info/30 bg-info/10 text-info text-[10px]">
                              <BookOpen className="size-3" /> Wacana
                            </Badge>
                          )}
                          {it.item.sectionName && (
                            <Badge variant="outline" className="border-border/80 text-[10px] text-muted-foreground">
                              {it.item.sectionName}
                            </Badge>
                          )}
                        </div>
                        <Link
                          href={`/questions/${it.question.id}`}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Buka detail butir soal ini"
                        >
                          <span>Buka Soal</span>
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </div>

                      {/* Batang Soal */}
                      <div className="min-w-0 flex-1 text-base leading-relaxed text-foreground">
                        <MathContent content={it.question.contentMarkdown} />
                      </div>

                      {/* Opsi Jawaban (Bila Ada) */}
                      {it.question.options.length > 0 && (
                        <ul className="flex flex-col gap-1.5 border-t border-border/30 pt-3 pl-1">
                          {it.question.options.map((o) => {
                            const benar = o.isCorrect === true;
                            return (
                              <li
                                key={o.id}
                                className={cn(
                                  "flex items-start gap-2 text-sm leading-relaxed rounded-md px-2 py-1 transition-colors",
                                  benar
                                    ? "bg-success/8 border border-success/20 font-medium text-foreground"
                                    : "text-muted-foreground",
                                )}
                              >
                                <span className={cn("shrink-0 font-mono font-semibold tabular-nums", benar && "text-success font-bold")}>
                                  {o.label}.
                                </span>
                                <span className="min-w-0 flex-1">
                                  <MathContent content={o.contentMarkdown} />
                                </span>
                                {benar && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[10px] border-success/30 bg-success/10 text-success font-mono font-semibold"
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
                  );
                })}
              </div>
            )}
          </div>

          {/* KOLOM KANAN (SIDEBAR: INFORMASI NASKAH & CETAK) (~33%) */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* KARTU INFORMASI NASKAH */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="size-4 text-primary shrink-0" />
                  Informasi Naskah
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-normal", statusBadgeClass(bundle.status))}
                  >
                    <StatusIcon status={bundle.status} data-icon="inline-start" aria-hidden="true" />
                    {STATUS_LABELS[bundle.status] ?? bundle.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Jenis Paket</span>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {bundle.bundleType === "exam" ? "Naskah Ujian" : "Bank Sumber"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Asal Paket</span>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {ORIGIN_LABELS[bundle.origin] ?? bundle.origin}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Durasi Pengerjaan</span>
                  <span className="font-mono text-foreground">
                    {bundle.durationMinutes ? `${bundle.durationMinutes} menit` : "Tanpa batas"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Jumlah Butir</span>
                  <span className="font-mono font-semibold text-foreground">
                    {bundle.items.length} butir
                  </span>
                </div>

                {bundle.url && (bundle.url.startsWith("http://") || bundle.url.startsWith("https://")) && (
                  <div className="pt-2 border-t border-border/30 flex flex-col gap-1">
                    <span className="text-muted-foreground">Tautan Sumber Web</span>
                    <a
                      href={bundle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-brand hover:underline font-mono text-[11px] truncate max-w-full"
                      title={bundle.url}
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{bundle.url.replace(/^https?:\/\//, "")}</span>
                    </a>
                  </div>
                )}

                {bundle.instructions && (
                  <div className="pt-2 border-t border-border/30 flex flex-col gap-1.5">
                    <span className="text-muted-foreground flex items-center gap-1 font-medium">
                      <FileText className="size-3.5" /> Petunjuk Pengerjaan
                    </span>
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80 bg-muted/30 p-2.5 rounded-lg border border-border/40">
                      {bundle.instructions}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KARTU PENGATURAN CETAK */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sliders className="size-4 text-primary shrink-0" />
                  Pengaturan Cetak
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5 pt-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Ukuran Kertas</span>
                  <span className="font-mono text-foreground">
                    {bundle.printConfig?.pageSize ?? "A4"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Tata Letak Naskah</span>
                  <span className="font-mono text-foreground">
                    {bundle.printConfig?.twoColumnLayout !== false ? "2 Kolom" : "1 Kolom"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Lembar Kunci Jawaban</span>
                  <span className="font-mono text-foreground">
                    {bundle.printConfig?.includeAnswerKey ? "Sertakan" : "Sembunyikan"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Ruang Jawaban Esai</span>
                  <span className="font-mono text-foreground">
                    {bundle.printConfig?.answerSpaceCm ?? 3} cm
                  </span>
                </div>
                <div className="pt-2 border-t border-border/30">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full min-h-[36px]"
                    render={<Link href={`/bundles/${bundleId}/print`} />}
                    nativeButton={false}
                  >
                    <Printer data-icon="inline-start" /> Buka Tampilan Cetak
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
