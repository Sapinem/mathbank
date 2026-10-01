"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  cognitiveRubric,
  difficultyRubric,
  type RubricEntry,
} from "@/lib/display/rubrics";

/**
 * Badge mikro dengan popover rubrik pedagogis (hover/focus/tap).
 * Menampilkan kode ringkas (mis. "C4" / "Lv.3"); saat disentuh (hover desktop,
 * focus keyboard, tap mobile), muncul deskripsi operasional untuk memandu
 * klasifikasi soal (audit §3.7).
 *
 * Dirender sebagai `<button>` agar dapat difokus keyboard (WCAG 2.2 AA).
 */
export function RubricBadge({
  rubric,
  className,
  children,
}: {
  rubric: RubricEntry;
  className?: string;
  children: React.ReactNode;
}) {
  const title = `${rubric.code} · ${rubric.title}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`${title}: ${rubric.description}`}
            className={cn(
              "inline-flex h-5 w-fit shrink-0 cursor-help items-center justify-center gap-1 rounded-4xl border px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-64 flex-col items-start gap-0.5 py-2 text-left leading-snug">
        <span className="font-semibold">{title}</span>
        <span className="opacity-90">{rubric.description}</span>
      </TooltipContent>
    </Tooltip>
  );
}

/** Badge kognitif (C1–C6) dengan rubrik. */
export function CognitiveBadge({
  level,
  className,
}: {
  level: string;
  className?: string;
}) {
  const rubric = cognitiveRubric(level);
  return (
    <RubricBadge
      rubric={rubric}
      className={cn("border-border bg-muted text-muted-foreground", className)}
    >
      {rubric.code}
    </RubricBadge>
  );
}

/** Badge kesulitan dengan rubrik + meter titik (●○○○○). */
export function DifficultyBadge({
  level,
  className,
}: {
  level: number;
  className?: string;
}) {
  const rubric = difficultyRubric(level);
  const dots = "●".repeat(Math.max(0, level)) + "○".repeat(Math.max(0, 5 - level));
  return (
    <RubricBadge
      rubric={rubric}
      className={cn("border-border bg-muted text-muted-foreground", className)}
    >
      <span aria-hidden className="font-mono text-[10px] tracking-tight">
        {dots}
      </span>
      {rubric.code}
    </RubricBadge>
  );
}

/**
 * Petunjuk rubrik inline untuk EDITOR (G2.5) — teks bantu di bawah dropdown
 * kesulitan/level kognitif, menjelaskan deskripsi operasional pilihan aktif.
 */
export function RubricHint({
  code,
  description,
}: {
  code: string;
  description: string;
}) {
  return (
    <p className="text-xs leading-snug text-muted-foreground">
      <span className="font-medium text-foreground">{code}</span> — {description}
    </p>
  );
}
