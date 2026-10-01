"use client";

import Link from "next/link";
import {
  Flag,
  CircleDot,
  CheckSquare,
  PenLine,
  Hash,
  ArrowRightLeft,
  Grid2X2,
  HelpCircle,
  ArrowUpRight,
  Scale,
  ListOrdered,
  FileQuestion,
  BookOpen,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { MathContent } from "@/components/math/math-content";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/display/labels";
import { CognitiveBadge, DifficultyBadge } from "@/components/questions/rubric-badge";
import { StimulusCard } from "@/components/questions/stimulus-card";
import type { ViewMode } from "@/components/questions/view-mode-toggle";
import type { PublicQuestion } from "@/lib/services/question-service";

/** Kutipan singkat konten (tanpa memotong rumus). */
function excerpt(md: string, max = 140): string {
  const clean = md.replace(/[#*`]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

/** Format jenjang kelas ringkas: "10", "11W", "11L", "SMP 08", "SD 04", dsb. */
export function formatGradeBadge(grade: string): string {
  const g = grade.trim();
  const lower = g.toLowerCase();

  // SMP (7, 8, 9) -> "07", "08", "09" (hanya angka 2 digit tanpa teks 'SMP')
  if (lower.startsWith("smp")) {
    const num = lower.replace("smp", "").replace(/[^0-9]/g, "");
    return num ? num.padStart(2, "0") : g.toUpperCase();
  }
  if (["7", "8", "9"].includes(lower)) {
    return `0${lower}`;
  }

  // SD (1 s/d 6) -> "01" s/d "06" (hanya angka 2 digit tanpa teks 'SD')
  if (lower.startsWith("sd")) {
    const num = lower.replace("sd", "").replace(/[^0-9]/g, "");
    return num ? num.padStart(2, "0") : g.toUpperCase();
  }
  if (["1", "2", "3", "4", "5", "6"].includes(lower)) {
    return `0${lower}`;
  }

  // SMA Wajib / Lanjut
  if (lower === "11w" || lower === "sma-11w") return "11W";
  if (lower === "11l" || lower === "sma-11l") return "11L";
  if (lower === "12w" || lower === "sma-12w") return "12W";
  if (lower === "12l" || lower === "sma-12l") return "12L";

  // SMA Standar / Ujian
  if (lower === "10" || lower === "sma-10") return "10";
  if (lower === "11") return "11";
  if (lower === "12") return "12";
  if (lower === "utbk") return "UTBK";
  if (lower === "mandiri") return "MDR";
  if (lower === "umum") return "UMUM";

  return g.toUpperCase();
}

/** Ikon tipe soal dengan tooltip interaktif. */
export function QuestionTypeIcon({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type;

  let Icon = HelpCircle;
  if (type === "single_choice") Icon = CircleDot;
  else if (type === "multiple_choice_checkbox" || type === "multiple_choice") Icon = CheckSquare;
  else if (type === "essay") Icon = PenLine;
  else if (type === "short_answer") Icon = Hash;
  else if (type === "matching") Icon = ArrowRightLeft;
  else if (type === "matrix_grid" || type === "matrix" || type === "true_false") Icon = Grid2X2;
  else if (type === "quantitative_pq") Icon = Scale;
  else if (type === "combination_1234") Icon = ListOrdered;
  else if (type === "data_sufficiency") Icon = FileQuestion;
  else if (type === "assertion_reason") Icon = Scale;
  else if (type === "stimulus") Icon = BookOpen;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="flex size-6 shrink-0 cursor-help items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:ring-1 focus-visible:ring-brand"
          >
            <Icon className="size-3.5" />
          </button>
        }
      />
      <TooltipContent>
        <span className="text-xs font-medium">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
}

/** Indikator status alur soal (Siap/Draf/Telaah) dengan dot semantik. */
export function StatusIndicator({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  let dotColor = "bg-muted-foreground";
  if (status === "ready") dotColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
  else if (status === "draft") dotColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
  else if (status === "review") dotColor = "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border tabular-nums",
        status === "ready" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        status === "draft" && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        status === "review" && "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
        !["ready", "draft", "review"].includes(status) && "border-border bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotColor)} />
      {label}
    </span>
  );
}

/** Komponen kartu butir soal adaptif (List, Grid, Masonry). */
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

  // ================= MODE LIST (LINEAR LIST ROW) =================
  if (!isCardLayout) {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-muted/30 cursor-pointer",
          selected && "bg-brand/5 border-l-2 border-l-brand",
        )}
      >
        {/* 1. Checkbox Seleksi */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(q.id)}
            aria-label="Pilih soal"
            className="size-4 shrink-0 rounded border-border accent-[var(--mb-brand)] cursor-pointer"
          />
        )}

        {/* 2. Ikon Tipe Soal (Paling Kiri) */}
        <QuestionTypeIcon type={q.questionType} />

        {/* 3. Chip Kelas Ringkas (mis. 10, 11W, 11L, SMP 08) */}
        <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/90">
          {formatGradeBadge(q.grade)}
        </span>

        {/* 4. Taksonomi: Kognitif & Kesulitan */}
        <CognitiveBadge level={q.cognitiveLevel} />
        <DifficultyBadge level={q.difficulty} />

        {/* Indikator Flag */}
        {q.isFlagged && (
          <Flag className="size-3.5 text-gold shrink-0" role="img" aria-label="Ditandai" />
        )}

        {/* 5. Batang Soal KaTeX & Tautan Utama (Satu elemen link untuk seluruh baris konten) */}
        <Link
          href={href}
          className="flex-1 min-w-0 px-2 flex items-center justify-between gap-2 group-hover:text-foreground"
        >
          <div className="flex items-center gap-2 truncate">
            {q.parent && (
              <span className="shrink-0 rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/60">
                Wacana
              </span>
            )}
            <span className="truncate text-xs text-foreground/90 font-normal">
              <MathContent content={excerpt(q.contentMarkdown, 130)} />
            </span>
          </div>

          <ArrowUpRight className="size-4 opacity-30 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground" />
        </Link>

        {/* Dukungan Stimulus Induk & A11y */}
        {q.parent && (
          <div className="sr-only">
            <StimulusCard content={q.parent.contentMarkdown} />
          </div>
        )}

        {/* Dukungan Opsi Tersembunyi untuk Pembaca Layar & Unit Test pada Mode List */}
        {q.options.length > 0 && (
          <div className="sr-only">
            {q.options.map((o) => (
              <span key={o.id} className={cn(o.isCorrect ? "text-success font-medium" : "")}>
                <strong>{o.label}.</strong> <MathContent content={o.contentMarkdown} />
              </span>
            ))}
          </div>
        )}

        {/* 6. Status Soal di Paling Kanan */}
        <StatusIndicator status={q.status} />
      </div>
    );
  }

  // ================= MODE GRID & MASONRY (BENTO CARD) =================
  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-4 transition-all duration-150",
        "hover:border-border hover:bg-card hover:shadow-xs",
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        mode === "grid" && "h-[320px]",
        selected && "border-brand/70 bg-brand/5 ring-1 ring-brand/30",
      )}
    >
      <div className="flex flex-col gap-2.5">
        {/* TOP BAR KARTU */}
        <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <QuestionTypeIcon type={q.questionType} />
            <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/90">
              {formatGradeBadge(q.grade)}
            </span>
            <CognitiveBadge level={q.cognitiveLevel} />
            <DifficultyBadge level={q.difficulty} />
            {q.isFlagged && (
              <Flag className="size-3.5 text-gold shrink-0" role="img" aria-label="Ditandai" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <StatusIndicator status={q.status} />
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(q.id)}
                aria-label="Pilih soal"
                className="size-4 shrink-0 rounded border-border accent-[var(--mb-brand)] cursor-pointer"
              />
            )}
          </div>
        </div>

        {/* WACANA STIMULUS (JIKA ADA) */}
        {q.parent && (
          <StimulusCard content={q.parent.contentMarkdown} className="text-xs" />
        )}

        {/* KONTEN UTAMA SOAL */}
        <Link href={href} className="block group-hover:text-foreground">
          <MathContent
            content={mode === "grid" ? excerpt(q.contentMarkdown, 200) : q.contentMarkdown}
            className="overflow-x-auto text-xs leading-relaxed text-foreground"
          />
        </Link>

        {/* OPSI JAWABAN (PREVIEW BERBINGKAI HALUS) */}
        {q.options.length > 0 && (
          <div
            className={cn(
              "mt-1 flex flex-col gap-1.5 border-t border-border/50 pt-2 text-xs",
              mode === "grid" && "grid grid-cols-2 gap-1.5",
            )}
          >
            {q.options.slice(0, mode === "grid" ? 4 : undefined).map((o) => (
              <div
                key={o.id}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1 text-muted-foreground border border-transparent transition-colors",
                  o.isCorrect
                    ? "border-emerald-500/30 bg-emerald-500/10 text-foreground font-medium"
                    : "bg-muted/30 hover:bg-muted/60",
                )}
              >
                <span className={cn(o.isCorrect && "text-success font-medium", "truncate")}>
                  <strong className={cn("font-mono", o.isCorrect ? "text-emerald-500" : "text-muted-foreground")}>
                    {o.label}.
                  </strong>{" "}
                  <MathContent content={excerpt(o.contentMarkdown, 36)} />
                </span>
                {o.isCorrect && (
                  <span className="ml-1 rounded font-mono text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                    KUNCI
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER KARTU */}
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] font-mono text-muted-foreground">
        <span>{q.sourceId ?? "Mandiri"}</span>
        <Link href={href} className="flex items-center gap-1 hover:text-foreground">
          Buka <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
