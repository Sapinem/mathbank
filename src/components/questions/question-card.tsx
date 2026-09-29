"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MathContent } from "@/components/math/math-content";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  DIFFICULTY_LABELS,
  statusClass,
  difficultyClass,
} from "@/lib/display/labels";
import type { PublicQuestion } from "@/lib/services/question-service";

/** Kutipan singkat konten (tanpa memotong rumus). */
function excerpt(md: string, max = 180): string {
  const clean = md.replace(/[#*`]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

/** Kartu soal untuk daftar (list padat). */
export function QuestionCard({
  question,
  href,
  selected,
  onToggleSelect,
}: {
  question: PublicQuestion;
  href: string;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const q = question;
  return (
    <div
      className={cn(
        "group relative flex gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/40",
        selected && "bg-brand/5",
      )}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(q.id)}
          aria-label="Pilih soal"
          className="mt-1 size-4 shrink-0 accent-[var(--mb-brand)]"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("text-xs", statusClass(q.status))}>
            {STATUS_LABELS[q.status] ?? q.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {TYPE_LABELS[q.questionType] ?? q.questionType}
          </span>
          <span className="text-xs text-muted-foreground">· {q.grade}</span>
          <span className={cn("text-xs", difficultyClass(q.difficulty))}>
            · {DIFFICULTY_LABELS[q.difficulty] ?? `Level ${q.difficulty}`}
          </span>
          {q.isFlagged && (
            <Flag className="size-3.5 text-gold" aria-label="Ditandai" />
          )}
        </div>

        <Link href={href} className="mt-1.5 block">
          <MathContent
            content={excerpt(q.contentMarkdown)}
            className="text-sm leading-relaxed"
          />
        </Link>

        {q.options.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {q.options.map((o) => (
              <span key={o.id} className={cn(o.isCorrect && "text-success")}>
                <strong>{o.label}.</strong>{" "}
                <MathContent content={o.contentMarkdown} />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
