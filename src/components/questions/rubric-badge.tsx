"use client";

import { Brain, Gauge } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DIFFICULTY_LABELS } from "@/lib/display/labels";
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

/** Penanda Bloom (C1–C6): ikon Lucide `brain` + kode, dengan rubrik.
 *  Ikon tidak pernah berdiri sendiri tanpa arti: `RubricBadge` memberi
 *  aria-label berisi kode, judul, dan deskripsi rubrik, serta tooltip. */
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
      <Brain className="size-3.5" aria-hidden="true" />
      {rubric.code}
    </RubricBadge>
  );
}

/** Warna badge kesulitan 1→5: hijau → biru → kuning → oranye → merah. */
const DIFFICULTY_TONE: Record<number, string> = {
  1: "border-success/40 bg-success/10 text-success",
  2: "border-info/40 bg-info/10 text-info",
  3: "border-gold/40 bg-gold/15 text-gold-fg",
  4: "border-warning/40 bg-warning/10 text-warning",
  5: "border-error/40 bg-error/10 text-error",
};

/** Kelas warna badge kesulitan (dipakai juga oleh kartu paket/ringkasan). */
export function difficultyToneClass(level: number): string {
  return DIFFICULTY_TONE[level] ?? DIFFICULTY_TONE[3];
}

/** Penanda kesulitan dengan rubrik: ikon Lucide `gauge` + kode level
 *  (Lv.1–Lv.5) + warna 1→5. Meter titik (●○○○○) diganti ikon karena
 *  titik bukan ikon bermakna dan mudah tertukar dengan status. Arti
 *  tetap lewat aria-label dan tooltip rubrik di `RubricBadge`. */
export function DifficultyBadge({
  level,
  className,
  showLabel = false,
}: {
  level: number;
  className?: string;
  /** Tampilkan label teks (Sangat Mudah…Sangat Sulit) di samping kode. */
  showLabel?: boolean;
}) {
  const rubric = difficultyRubric(level);
  return (
    <RubricBadge
      rubric={rubric}
      className={cn(difficultyToneClass(level), className)}
    >
      <Gauge className="size-3.5" aria-hidden="true" />
      {rubric.code}
      {showLabel && (
        <span className="font-normal">{DIFFICULTY_LABELS[level] ?? `Level ${level}`}</span>
      )}
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
