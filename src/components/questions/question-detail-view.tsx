"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Image as ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EnrichButton } from "@/components/questions/enrich-button";
import { MathContent } from "@/components/math/math-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useQuestion,
  useDeleteQuestion,
  useChangeQuestionStatus,
} from "@/lib/hooks/use-questions";
import { TYPE_LABELS } from "@/lib/display/labels";
import { CognitiveBadge, DifficultyBadge } from "@/components/questions/rubric-badge";
import { QuestionStatusBadge } from "@/components/questions/question-status-badge";
import {
  QuestionMediaGallery,
  extractMediaShortIds,
} from "@/components/questions/question-image";
import { TopicTagList } from "@/components/questions/topic-tag";
import { StimulusCard } from "@/components/questions/stimulus-card";
import {
  MatrixGridView,
  readMatrixGridPayload,
} from "@/components/questions/matrix-grid-view";
import { formatGradeBadge } from "@/components/questions/question-card";
import { cn } from "@/lib/utils";

/**
 * Halaman detail soal (M4c) — lihat + edit + ubah status (FSM) + hapus.
 *
 * Format naskah dokumen matematika terpadu (soal + opsi menyatu),
 * bukan format CBT terpisah. Pembahasan KaTeX terstruktur di bawahnya.
 */
export function QuestionDetailView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const { data: q, isLoading, isError, error } = useQuestion(id);
  const del = useDeleteQuestion();
  const changeStatus = useChangeQuestionStatus(id);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedSolutionIdx, setSelectedSolutionIdx] = useState(0);

  if (isLoading) return <LoadingState label="Memuat soal…" />;
  if (isError)
    return (
      <ErrorState
        title="Gagal memuat soal"
        description={error?.message}
      />
    );
  if (!q)
    return (
      <ErrorState title="Soal tidak ditemukan" description="Mungkin sudah dihapus." />
    );

  const key = q.answerKey;
  const correctLabels = key?.correct ?? [];

  return (
    <div className="flex flex-col gap-0">
      <PageHeader
        title="Detail Soal"
        description={TYPE_LABELS[q.questionType] ?? q.questionType}
        actions={
          <>
            <EnrichButton questionId={id} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                changeStatus.mutate("review");
              }}
              disabled={
                changeStatus.isPending || q.status === "review" || q.status === "ready"
              }
            >
              Kirim Telaah
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/questions/${id}/edit`} />}
              nativeButton={false}
            >
              <Pencil data-icon="inline-start" /> Sunting
            </Button>
            <Button
              variant="destructive"
              size="icon-sm"
              aria-label="Hapus soal"
              onClick={() => setConfirmDelete(true)}
              className="min-h-[44px] min-w-[44px]"
            >
              <Trash2 />
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-6 max-w-7xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* KOLOM KIRI (UTAMA: LEMBAR SOAL & PEMBAHASAN) (~68%) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* LEMBAR DOKUMEN SOAL (SOAL + OPSI MENYATU) */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="border-b border-border/40 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <QuestionStatusBadge status={q.status} />
                    <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-foreground/90">
                      Kelas {formatGradeBadge(q.grade)}
                    </span>
                    <DifficultyBadge level={q.difficulty} />
                    <CognitiveBadge level={q.cognitiveLevel} />
                    {q.isFlagged && (
                      <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold-fg">
                        <AlertTriangle data-icon="inline-start" /> Ditandai
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {TYPE_LABELS[q.questionType] ?? q.questionType}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-5 pt-5">
                {/* Wacana Stimulus (Bila Ada) */}
                {q.parent && (
                  <StimulusCard content={q.parent.contentMarkdown} className="text-sm" />
                )}

                {/* Batang Soal (Stem) — Font 17px di Desktop */}
                <div className="text-base lg:text-[17px] lg:leading-[1.7] text-foreground">
                  <MathContent content={q.contentMarkdown} className="no-scrollbar" />
                </div>

                {/* Soal MATRIX GRID (benar-salah): pernyataan ada di dataPayload.rows */}
                {q.questionType === "matrix_grid" && (
                  <MatrixGridView payload={readMatrixGridPayload(q.dataPayload)} />
                )}

                {/* Opsi Pilihan Ganda (Menyatu dalam Dokumen, Format 1 Kolom ke Bawah) */}
                {q.options && q.options.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-border/40 pt-4">
                    {q.options.map((o) => {
                      const isKey = correctLabels.includes(o.label) || o.isCorrect;
                      return (
                        <div
                          key={o.id}
                          className={cn(
                            "flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors",
                            isKey ? "bg-emerald-500/5 dark:bg-emerald-950/20" : "",
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono font-semibold text-base lg:text-[17px] shrink-0",
                              isKey
                                ? "text-success text-emerald-600 dark:text-emerald-400 font-bold"
                                : "text-foreground/70",
                            )}
                          >
                            {o.label}.
                          </span>
                          <div className="min-w-0 flex-1 text-base lg:text-[17px] lg:leading-[1.7]">
                            <MathContent content={o.contentMarkdown} noScroll />
                            {o.distractorRationale && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Pengecoh: {o.distractorRationale}
                              </p>
                            )}
                          </div>
                          {isKey && (
                            <span
                              className="inline-flex items-center text-base lg:text-[17px] font-bold text-success text-emerald-600 dark:text-emerald-400 shrink-0"
                              title="Kunci Jawaban"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KARTU LAMPIRAN GAMBAR (ACT-08) — hanya bila ada aset / shortcode */}
            {(() => {
              const media = q.media ?? [];
              const inlineIds = extractMediaShortIds(q.contentMarkdown);
              if (media.length === 0 && inlineIds.length === 0) return null;
              return (
                <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
                  <CardHeader className="border-b border-border/40 pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <ImageIcon aria-hidden className="size-4 shrink-0 text-primary" />
                      Lampiran Gambar
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {media.length} aset
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <QuestionMediaGallery
                      media={media}
                      emptyHint={
                        inlineIds.length > 0
                          ? `Naskah memuat ${inlineIds.length} rujukan gambar (${inlineIds.join(", ")}) yang tampil di dalam teks, tetapi belum ada aset tertaut di question_media.`
                          : undefined
                      }
                    />
                  </CardContent>
                </Card>
              );
            })()}

            {/* KARTU KUNCI & PEMBAHASAN */}
            {(() => {
              const solList =
                q.solutions && q.solutions.length > 0
                  ? q.solutions
                  : key?.explanation
                    ? [
                        {
                          id: "legacy",
                          questionId: q.id,
                          solutionType: "conceptual",
                          title: "Pembahasan Konseptual",
                          contentMarkdown: key.explanation,
                          authorType: "human",
                          isPrimary: true,
                        },
                      ]
                    : [];
              const activeSol =
                solList[selectedSolutionIdx] || solList[0];

              return (
                <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
                  <CardHeader className="border-b border-border/40 pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="size-4 text-amber-500 shrink-0" />
                      Kunci & Pembahasan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 pt-4">
                    {/* Kunci Jawaban Singkat */}
                    {key && (correctLabels.length > 0 || key.text) && (
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-muted-foreground">Kunci Jawaban:</span>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {correctLabels.join(", ") || key.text} ✓
                        </span>
                      </div>
                    )}

                    {/* Tab Pilihan Solusi bila ada > 1 */}
                    {solList.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
                        {solList.map((sol, idx) => {
                          const isSelected =
                            idx ===
                            (selectedSolutionIdx < solList.length
                              ? selectedSolutionIdx
                              : 0);
                          return (
                            <button
                              key={sol.id || idx}
                              type="button"
                              onClick={() => setSelectedSolutionIdx(idx)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                                isSelected
                                  ? "border-primary bg-primary/10 text-primary shadow-xs"
                                  : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                              )}
                            >
                              <span>{sol.title || `Solusi ${idx + 1}`}</span>
                              {sol.isPrimary && (
                                <span className="rounded bg-primary/15 px-1 py-0.5 text-[10px] font-bold">
                                  Utama
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Pembahasan Detail — Font 20px di Desktop */}
                    {activeSol?.contentMarkdown ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {activeSol.title || "Langkah Penyelesaian"}
                          </p>
                          {activeSol.solutionType && (
                            <span className="rounded border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {activeSol.solutionType === "quick_tip"
                                ? "Trik / Cara Cepat"
                                : activeSol.solutionType === "alternative"
                                ? "Metode Alternatif"
                                : activeSol.solutionType === "video"
                                ? "Video / Multimedia"
                                : "Konseptual"}
                            </span>
                          )}
                        </div>
                        <div className="text-base lg:text-[17px] lg:leading-[1.7] text-foreground whitespace-pre-wrap">
                          <MathContent
                            content={activeSol.contentMarkdown}
                            className="no-scrollbar"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-6 text-center">
                        <p className="text-xs text-muted-foreground max-w-sm">
                          Belum ada naskah pembahasan yang disimpan untuk butir soal ini.
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link href={`/questions/${id}/edit`} />}
                            nativeButton={false}
                          >
                            <Pencil data-icon="inline-start" /> Tulis Pembahasan
                          </Button>
                          <EnrichButton questionId={id} />
                        </div>
                      </div>
                    )}

                    {!key && (
                      <p className="text-sm text-muted-foreground">
                        Kunci jawaban tidak ditampilkan untuk peran Anda.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* KOLOM KANAN (SIDEBAR METADATA & SUMBER) (~32%) */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* KARTU KLASIFIKASI SOAL */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sliders className="size-4 text-primary shrink-0" />
                  Klasifikasi Soal
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <QuestionStatusBadge status={q.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Tipe Soal</span>
                  <span className="font-medium text-foreground">
                    {TYPE_LABELS[q.questionType] ?? q.questionType}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Jenjang Kelas</span>
                  <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-foreground/90">
                    Kelas {formatGradeBadge(q.grade)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Tingkat Kesulitan</span>
                  <DifficultyBadge level={q.difficulty} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Level Kognitif</span>
                  <CognitiveBadge level={q.cognitiveLevel} />
                </div>

                {/* Topik (ACT-09) — klik untuk menyaring Bank Soal */}
                <div className="flex flex-col gap-1.5 border-t border-border/30 pt-2">
                  <span className="text-muted-foreground">Topik</span>
                  <TopicTagList
                    topics={q.topics ?? []}
                    emptyLabel="Belum ada topik (menunggu pengayaan)."
                    showEmptyIcon
                  />
                </div>

                {q.isFlagged && (
                  <div className="rounded-lg border border-gold/40 bg-gold/15 p-2.5 text-gold-fg mt-1">
                    <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                      <AlertTriangle className="size-3.5 shrink-0" /> Ditandai
                    </div>
                    {q.flagNotes && (
                      <p className="text-[11px] leading-relaxed">{q.flagNotes}</p>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-border/30 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>ID Butir</span>
                    <span className="truncate max-w-[150px]" title={q.id}>
                      {q.id.slice(0, 13)}…
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Dibuat</span>
                    <span>
                      {new Date(q.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KARTU ASAL-USUL (ADR-0014: dari BUNDLE/naskah, bukan per-butir) */}
            <QuestionSourcesCard bundles={q.bundles} />
          </div>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus soal ini?</DialogTitle>
            <DialogDescription>
              Soal akan dihapus lunak (bisa dipulihkan oleh admin). Tindakan ini
              akan menghilangkannya dari daftar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => {
                del.mutate(id, {
                  onSuccess: () => router.push("/questions"),
                });
              }}
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Kartu Asal-Usul & Sumber (Slide Carousel bila > 1).
 *
 * Catatan CONSTRAINTS #6: Tanpa useMemo/useCallback.
 * Tanpa tautan asli sesuai instruksi pengguna.
 */
function QuestionSourcesCard({
  bundles = [],
}: {
  bundles?: Array<{
    id: string;
    title?: string | null;
    bundleType?: string | null;
    url?: string | null;
    year?: number | null;
    grade?: string | null;
    sourceLabel?: string | null;
    sourceKind?: string | null;
    itemNumber?: string | null;
  }>;
}) {
  const [index, setIndex] = useState(0);
  const total = bundles.length;

  if (total === 0) {
    return (
      <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="border-b border-border/40 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-primary shrink-0" />
            Asal-Usul
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 text-xs text-muted-foreground">
          Butir ini belum masuk naskah mana pun.
        </CardContent>
      </Card>
    );
  }

  // Jaga index aman bila daftar bundle berubah
  const safeIndex = index < total ? index : 0;
  const current = bundles[safeIndex] ?? bundles[0];

  return (
    <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
      <CardHeader className="border-b border-border/40 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-primary shrink-0" />
            Asal-Usul
          </CardTitle>
          {total > 1 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="icon-sm"
                className="min-h-[44px] min-w-[44px]"
                aria-label="Naskah sebelumnya"
                onClick={() => setIndex((prev) => (prev > 0 ? prev - 1 : total - 1))}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="font-mono font-medium text-[11px]">
                {safeIndex + 1}/{total}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="min-h-[44px] min-w-[44px]"
                aria-label="Naskah berikutnya"
                onClick={() => setIndex((prev) => (prev < total - 1 ? prev + 1 : 0))}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 pt-4 text-xs">
        <div>
          <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold">
            Judul / Dokumen
          </span>
          <span className="font-medium text-foreground text-sm leading-snug">
            {current?.title || "Tanpa judul"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
          <div>
            <span className="text-muted-foreground block text-[11px]">Jenis</span>
            <span className="font-mono text-foreground capitalize">
              {current?.sourceKind || "—"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Tahun</span>
            <span className="font-mono text-foreground">
              {current?.year ?? "—"}
            </span>
          </div>
        </div>

        {current?.sourceLabel && (
          <div className="pt-1 border-t border-border/30">
            <span className="text-muted-foreground block text-[11px]">Sumber</span>
            <span className="text-foreground">{current.sourceLabel}</span>
          </div>
        )}

        {current?.itemNumber && (
          <div className="pt-1 border-t border-border/30">
            <span className="text-muted-foreground block text-[11px]">Nomor Butir</span>
            <span className="font-mono text-foreground">{current.itemNumber}</span>
          </div>
        )}

        {current?.bundleType && (
          <div className="pt-1 border-t border-border/30">
            <span className="text-muted-foreground block text-[11px]">Jenis naskah</span>
            <p className="text-muted-foreground capitalize leading-relaxed">{current.bundleType}</p>
          </div>
        )}

        {/* Indikator titik slide bila > 1 naskah */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-border/30">
            {bundles.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Pindah ke naskah ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === safeIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

