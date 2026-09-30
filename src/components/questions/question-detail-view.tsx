"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, Check, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionEditor } from "@/components/questions/question-editor";
import { MathContent } from "@/components/math/math-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  DIFFICULTY_LABELS,
  COGNITIVE_LABELS,
  statusClass,
} from "@/lib/display/labels";

/**
 * Halaman detail soal (M4c) — lihat + edit + ubah status (FSM) + hapus.
 *
 * Mode `view` (default) memakai proyeksi aman (`answerKey` hanya bila viewer
 * berwenang). Mode `edit` memuat editor. Desktop-saja untuk menyunting.
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

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusClass(q.status)}>
            {STATUS_LABELS[q.status] ?? q.status}
          </Badge>
          <Badge variant="outline">{q.grade}</Badge>
          <Badge variant="outline">
            {DIFFICULTY_LABELS[q.difficulty] ?? `Level ${q.difficulty}`}
          </Badge>
          <Badge variant="outline">
            {COGNITIVE_LABELS[q.cognitiveLevel] ?? q.cognitiveLevel}
          </Badge>
          {q.isFlagged && (
            <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold-fg">
              <AlertTriangle data-icon="inline-start" /> Ditandai
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pertanyaan</CardTitle>
          </CardHeader>
          <CardContent>
            <MathContent content={q.contentMarkdown} />
          </CardContent>
        </Card>

        {q.options && q.options.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Opsi</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {q.options.map((o) => {
                const isKey = correctLabels.includes(o.label) || o.isCorrect;
                return (
                  <div
                    key={o.id}
                    className="flex items-start gap-3 rounded-md border border-border p-3"
                  >
                    <span
                      className={
                        isKey
                          ? "grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-fg"
                          : "grid size-6 shrink-0 place-items-center rounded-full border border-border text-xs font-medium text-muted-foreground"
                      }
                    >
                      {o.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <MathContent content={o.contentMarkdown} />
                      {o.distractorRationale && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Pengecoh: {o.distractorRationale}
                        </p>
                      )}
                    </div>
                    {isKey && (
                      <Check className="size-4 shrink-0 text-brand" aria-label="Kunci" />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {(key?.text || key?.explanation) && (
          <Card>
            <CardHeader>
              <CardTitle>Kunci & Pembahasan</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {key?.text && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Jawaban</p>
                  <MathContent content={key.text} />
                </div>
              )}
              {key?.explanation && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Pembahasan
                    </p>
                    <MathContent content={key.explanation} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!key && (
          <p className="text-sm text-muted-foreground">
            Kunci jawaban tidak ditampilkan untuk peran Anda.
          </p>
        )}
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
                  onSuccess: () => router.push("/bank-soal"),
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
