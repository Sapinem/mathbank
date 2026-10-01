"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, AlertTriangle, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionEditor } from "@/components/questions/question-editor";
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
import {
  STATUS_LABELS,
  TYPE_LABELS,
  statusClass,
} from "@/lib/display/labels";
import { CognitiveBadge, DifficultyBadge } from "@/components/questions/rubric-badge";
import { StimulusCard } from "@/components/questions/stimulus-card";
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

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  if (editing) {
    return (
      <>
        <PageHeader
          title="Sunting Soal"
          description="Perubahan tersimpan saat Anda menekan Simpan."
          actions={
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Batal
            </Button>
          }
        />
        <QuestionEditor existing={q} />
      </>
    );
  }

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
              onClick={() => setEditing(true)}
            >
              <Pencil data-icon="inline-start" /> Sunting
            </Button>
            <Button
              variant="destructive"
              size="icon-sm"
              aria-label="Hapus soal"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl">
        {/* LEMBAR DOKUMEN SOAL (SOAL + OPSI MENYATU) */}
        <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusClass(q.status)}>
                  {STATUS_LABELS[q.status] ?? q.status}
                </Badge>
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

            {/* Batang Soal (Stem) */}
            <div className="text-sm sm:text-base leading-relaxed text-foreground">
              <MathContent content={q.contentMarkdown} />
            </div>

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
                          "font-mono font-semibold text-sm shrink-0",
                          isKey
                            ? "text-success text-emerald-600 dark:text-emerald-400 font-bold"
                            : "text-foreground/70",
                        )}
                      >
                        {o.label}.
                      </span>
                      <div className="min-w-0 flex-1 text-sm leading-relaxed">
                        <MathContent content={o.contentMarkdown} />
                        {o.distractorRationale && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Pengecoh: {o.distractorRationale}
                          </p>
                        )}
                      </div>
                      {isKey && (
                        <span
                          className="inline-flex items-center text-sm font-bold text-success text-emerald-600 dark:text-emerald-400 shrink-0"
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

        {/* KARTU KUNCI & PEMBAHASAN */}
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

            {/* Pembahasan Detail */}
            {key?.explanation ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Langkah Penyelesaian
                </p>
                <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  <MathContent content={key.explanation} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-xs text-muted-foreground max-w-sm">
                  Belum ada naskah pembahasan yang disimpan untuk butir soal ini.
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
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
