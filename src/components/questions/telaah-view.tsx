"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Flag,
  FlagOff,
  AlertTriangle,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { MathContent } from "@/components/math/math-content";
import {
  useQuestions,
  useChangeQuestionStatus,
  useSetQuestionFlag,
} from "@/lib/hooks/use-questions";
import {
  STATUS_LABELS,
  DIFFICULTY_LABELS,
  statusClass,
} from "@/lib/display/labels";
import type { PublicQuestion } from "@/lib/services/question-service";

/**
 * Telaah (M4d) — antrean kurasi.
 *
 * Dua tab: **Perlu Telaah** (`status=review`) & **Ditandai** (`flagged=1`).
 * Aksi penelaah: setujui → `ready`, tolak → `draft` (+catatan), lepas tanda.
 * Memakai endpoint FSM (`/status`) & flag yang sudah ada.
 */
export function TelaahView() {
  const [tab, setTab] = useState("review");
  return (
    <div className="flex flex-col gap-0">
      <PageHeader
        title="Telaah"
        description="Kurasi soal: setujui, tolak, atau tangani yang ditandai."
      />
      <div className="p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="review">Perlu Telaah</TabsTrigger>
            <TabsTrigger value="flagged">Ditandai</TabsTrigger>
          </TabsList>
          <TabsContent value="review" className="mt-4">
            <ReviewQueue />
          </TabsContent>
          <TabsContent value="flagged" className="mt-4">
            <FlaggedQueue />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ReviewQueue() {
  const { data, isLoading, isError, error } = useQuestions({
    status: "review",
    limit: 50,
  });
  if (isLoading) return <LoadingState label="Memuat antrean telaah…" />;
  if (isError) return <ErrorState title="Gagal memuat" description={error?.message} />;
  const items = data?.items ?? [];
  if (items.length === 0)
    return (
      <EmptyState
        title="Tidak ada soal menunggu telaah"
        description="Antrean kosong — kerja bagus!"
      />
    );
  return (
    <div className="flex flex-col gap-3">
      {items.map((q) => (
        <ReviewRow key={q.id} question={q} />
      ))}
    </div>
  );
}

function ReviewRow({ question: q }: { question: PublicQuestion }) {
  const status = useChangeQuestionStatus(q.id);
  const flag = useSetQuestionFlag(q.id);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes] = useState("");

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusClass(q.status)}>
            {STATUS_LABELS[q.status] ?? q.status}
          </Badge>
          <Badge variant="outline">{q.grade}</Badge>
          <Badge variant="outline">
            {DIFFICULTY_LABELS[q.difficulty] ?? `Level ${q.difficulty}`}
          </Badge>
          {q.isFlagged && (
            <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold-fg">
              <AlertTriangle data-icon="inline-start" /> Ditandai
            </Badge>
          )}
        </div>

        <Link href={`/questions/${q.id}`} className="block text-sm hover:underline">
          <span className="line-clamp-2">
            <MathContent content={q.contentMarkdown} />
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={status.isPending}
            onClick={() => status.mutate("ready")}
          >
            <CheckCircle2 data-icon="inline-start" /> Setujui (Siap)
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={status.isPending}
            onClick={() => setRejectOpen(true)}
          >
            Tolak → Draf
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={flag.isPending}
            onClick={() =>
              flag.mutate({ flagged: !q.isFlagged, notes: q.flagNotes })
            }
          >
            {q.isFlagged ? (
              <>
                <FlagOff data-icon="inline-start" /> Lepas tanda
              </>
            ) : (
              <>
                <Flag data-icon="inline-start" /> Tandai
              </>
            )}
          </Button>
        </div>
      </CardContent>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak soal ini?</DialogTitle>
            <DialogDescription>
              Soal dikembalikan ke <strong>Draf</strong> agar penyusun memperbaiki.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan untuk penyusun (opsional)…"
            rows={3}
            aria-label="Catatan penolakan"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={status.isPending}
              onClick={() => {
                status.mutate("draft", {
                  onSuccess: () => setRejectOpen(false),
                });
              }}
            >
              Tolak ke Draf
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FlaggedQueue() {
  const { data, isLoading, isError, error } = useQuestions({
    flagged: true,
    limit: 50,
  });
  if (isLoading) return <LoadingState label="Memuat soal ditandai…" />;
  if (isError) return <ErrorState title="Gagal memuat" description={error?.message} />;
  const items = data?.items ?? [];
  if (items.length === 0)
    return (
      <EmptyState
        title="Tidak ada soal ditandai"
        description="Semua bersih — tak ada masalah yang dilaporkan."
      />
    );
  return (
    <div className="flex flex-col gap-3">
      {items.map((q) => (
        <FlaggedRow key={q.id} question={q} />
      ))}
    </div>
  );
}

function FlaggedRow({ question: q }: { question: PublicQuestion }) {
  const flag = useSetQuestionFlag(q.id);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-gold" aria-hidden />
          <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold-fg">
            Ditandai
          </Badge>
          <Badge variant="outline">
            {STATUS_LABELS[q.status] ?? q.status}
          </Badge>
        </div>
        <Link href={`/questions/${q.id}`} className="text-sm hover:underline">
          <span className="line-clamp-2">
            <MathContent content={q.contentMarkdown} />
          </span>
        </Link>
        {q.flagNotes && (
          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Catatan: {q.flagNotes}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={flag.isPending}
          onClick={() => flag.mutate({ flagged: false, notes: null })}
        >
          <FlagOff data-icon="inline-start" /> Lepas tanda
        </Button>
      </CardContent>
    </Card>
  );
}
