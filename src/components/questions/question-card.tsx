"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MathContent } from "@/components/math/math-content";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  statusClass,
} from "@/lib/display/labels";
import { CognitiveBadge, DifficultyBadge } from "@/components/questions/rubric-badge";
import { StimulusCard } from "@/components/questions/stimulus-card";
import type { ViewMode } from "@/components/questions/view-mode-toggle";
import type { PublicQuestion } from "@/lib/services/question-service";

/** Kutipan singkat konten (tanpa memotong rumus). */
function excerpt(md: string, max = 180): string {
  const clean = md.replace(/[#*`]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

/** Kartu soal adaptif untuk 3 mode tampilan (List, Grid, Masonry). */
export function QuestionCard({
  question,
  href,
  selected,
  onToggleSelect,
  mode = "list",
}: {
  question: PublicQuestion;
  href: string;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  mode?: ViewMode;
}) {
  const q = question;
  const isCardLayout = mode === "grid" || mode === "masonry";

  return (
    <div
      className={cn(
        "group relative transition-all",
        isCardLayout
          ? "flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 hover:border-brand/40 hover:shadow-xs"
          : "flex gap-3 border-b border-border px-4 py-3 hover:bg-muted/40",
        selected && (isCardLayout ? "border-brand bg-brand/5 ring-1 ring-brand" : "bg-brand/5"),
        mode === "grid" && "h-full",
      )}
    >
      <div className={cn("min-w-0 flex-1", isCardLayout && "flex flex-col gap-2")}>
        {/* Header Metadata Kartu */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(q.id)}
                aria-label="Pilih soal"
                className="size-4 shrink-0 accent-[var(--mb-brand)]"
              />
            )}
            <Badge variant="outline" className={cn("text-xs", statusClass(q.status))}>
              {STATUS_LABELS[q.status] ?? q.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {TYPE_LABELS[q.questionType] ?? q.questionType}
            </span>
            <span className="text-xs text-muted-foreground">· {q.grade}</span>
            <DifficultyBadge level={q.difficulty} />
            <CognitiveBadge level={q.cognitiveLevel} />
            {q.isFlagged && (
              <Flag className="size-3.5 text-gold" role="img" aria-label="Ditandai" />
            )}
          </div>
        </div>

        {/* Wacana Stimulus (Induk) bila ada */}
        {q.parent && (
          <StimulusCard content={q.parent.contentMarkdown} className="mt-1" />
        )}

        {/* Konten Utama Soal */}
        <Link href={href} className="mt-1 block">
          <MathContent
            content={isCardLayout ? q.contentMarkdown : excerpt(q.contentMarkdown)}
            className="overflow-x-auto text-sm leading-relaxed"
          />
        </Link>
      </div>

      {/* Daftar Opsi Jawaban bila ada */}
      {q.options.length > 0 && (
        <div
          className={cn(
            isCardLayout
              ? "mt-3 flex flex-col gap-1 border-t border-border/40 pt-2 text-xs text-muted-foreground"
              : "mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground",
          )}
        >
          {q.options.map((o) => (
            <span key={o.id} className={cn(o.isCorrect && "text-success font-medium")}>
              <strong>{o.label}.</strong>{" "}
              <MathContent content={o.contentMarkdown} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
