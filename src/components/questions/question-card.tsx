"use client";

import { memo } from "react";
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

/**
 * Kutipan singkat konten yang aman terhadap rumus KaTeX/LaTeX.
 * Tidak akan pernah memotong di tengah delimiter \(...\), \[...\], $...$, atau $$...$$.
 */
export function excerpt(md: string, max = 140): string {
  const clean = md.replace(/[#*`]/g, "").replace(/\r?\n+/g, " ").trim();
  if (clean.length <= max) return clean;

  const mathRegex = /(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(clean)) !== null) {
    const textBefore = clean.slice(lastIndex, match.index);
    if (textBefore) {
      if (result.length + textBefore.length >= max) {
        const remaining = max - result.length;
        result += textBefore.slice(0, Math.max(0, remaining)).trimEnd() + "…";
        return result;
      }
      result += textBefore;
    }

    const mathToken = match[0];
    if (result.length + mathToken.length > max) {
      if (result.length > 0) {
        return result.trimEnd() + "…";
      }
      // Jika soal diawali rumus panjang, sertakan rumus pertama utuh lalu elipsis
      return mathToken + "…";
    }

    result += mathToken;
    lastIndex = mathRegex.lastIndex;
  }

  const remainingText = clean.slice(lastIndex);
  if (remainingText) {
    if (result.length + remainingText.length > max) {
      const remaining = max - result.length;
      result += remainingText.slice(0, Math.max(0, remaining)).trimEnd() + "…";
      return result;
    }
    result += remainingText;
  }

  return result.length > max ? result.slice(0, max) + "…" : result;
}

/**
 * Ratakan lingkungan rumus multi-baris (matrix, cases, aligned, \\)
 * agar menjadi datar/inline pada baris ikhtisar mode list.
 */
export function flattenMathForList(text: string): string {
  return text
    .replace(/\\begin\{(?:matrix|pmatrix|bmatrix|cases|aligned|array)\}/g, "")
    .replace(/\\end\{(?:matrix|pmatrix|bmatrix|cases|aligned|array)\}/g, "")
    .replace(/\\\\/g, ",\\; ");
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
            className="flex size-6 shrink-0 cursor-help items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:ring-1 focus-visible:ring-brand pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]"
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

/** Indikator status alur soal (Siap/Draf/Telaah) dengan dot semantik.
 *  `compact` — di mobile mode list, sembunyikan label teks agar teks soal
 *  mendapat ruang ≥ 180px pada layar 360px. */
export function StatusIndicator({
  status,
  compact = false,
}: {
  status: string;
  compact?: boolean;
}) {
  const label = STATUS_LABELS[status] ?? status;
  // Label ringkas untuk mode compact: "Perlu Telaah" (12 karakter) dipersingkat
  // jadi "Telaah" agar status tetap terbaca di layar sempit tanpa hanya mengandalkan
  // warna titik. Trade-off: chip ringkas ini ~25–30px lebih lebar daripada titik saja,
  // sehingga ruang batang di layar 360px berkurang sebesar itu — harga yang dibayar
  // agar makna status tidak hanya dari warna (WCAG 1.4.1). aria-label tetap label penuh.
  const shortLabel = STATUS_SHORT_LABELS[status] ?? label;
  let dotColor = "bg-muted-foreground";
  if (status === "ready") dotColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
  else if (status === "draft") dotColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
  else if (status === "review") dotColor = "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border tabular-nums",
        compact ? "px-1.5 py-0.5 text-[11px] font-medium" : "px-2.5 py-0.5 text-[11px] font-medium",
        status === "ready" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        status === "draft" && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        status === "review" && "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
        !["ready", "draft", "review"].includes(status) && "border-border bg-muted text-muted-foreground",
      )}
      aria-label={compact ? label : undefined}
    >
      <span className={cn("size-1.5 rounded-full", dotColor)} />
      <span>{compact ? shortLabel : label}</span>
    </span>
  );
}

/** Label status ringkas untuk mode compact (lihat komentar di StatusIndicator). */
const STATUS_SHORT_LABELS: Record<string, string> = {
  draft: "Draf",
  review: "Telaah",
  ready: "Siap",
  archived: "Arsip",
};

/**
 * Kutipan batang singkat untuk nama aksesibel — hanya batang soal
 * (contentMarkdown), bukan opsi/kunci jawaban. Bila batang kosong, pemanggil
 * memakai fallback tanpa kutipan.
 */
function shortStem(question: PublicQuestion): string {
  return excerpt(flattenMathForList(question.contentMarkdown), 60).trim();
}

/** Nama aksesibel checkbox seleksi — berkonteks soal, bukan "Pilih soal" generik. */
function selectLabel(question: PublicQuestion): string {
  const stem = shortStem(question);
  return stem ? `Pilih soal: ${stem}` : "Pilih soal";
}

/** Nama aksesibel tautan "Buka" di kartu grid/masonry — berkonteks soal. */
function openLabel(question: PublicQuestion): string {
  const stem = shortStem(question);
  return stem ? `Buka soal: ${stem}` : "Buka soal";
}

/** Komponen kartu butir soal adaptif (List, Grid, Masonry). */
function QuestionCardInner({
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
          "group relative flex h-11 max-h-11 items-center gap-2.5 px-4 transition-colors hover:bg-muted/30 cursor-pointer overflow-hidden",
          selected && "bg-brand/5 border-l-2 border-l-brand",
        )}
      >
        {/* 1. Checkbox Seleksi — area sentuh ≥ 44px (CRIT-03) */}
        {onToggleSelect && (
          <label className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(q.id)}
              aria-label={selectLabel(q)}
              className="size-4 rounded border-border accent-[var(--mb-brand)] cursor-pointer"
            />
          </label>
        )}

        {/* 2. Ikon Tipe Soal (Paling Kiri) */}
        <QuestionTypeIcon type={q.questionType} />

        {/* 3. Chip Kelas Ringkas (mis. 10, 11W, 11L, SMP 08) */}
        <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/90">
          {formatGradeBadge(q.grade)}
        </span>

        {/* 4. Taksonomi: Kognitif & Kesulitan — disembunyikan di mobile (<md) agar teks soal punya ruang lega */}
        <CognitiveBadge level={q.cognitiveLevel} className="hidden md:inline-flex pointer-coarse:min-h-[44px]" />
        <DifficultyBadge level={q.difficulty} className="hidden md:inline-flex pointer-coarse:min-h-[44px]" />

        {/* Indikator Flag */}
        {q.isFlagged && (
          <Flag className="size-3.5 text-gold shrink-0" role="img" aria-label="Ditandai" />
        )}

        {/* 5. Batang Soal KaTeX & Tautan Utama (Satu elemen link untuk seluruh baris konten) */}
        <Link
          href={href}
          className="flex-1 min-w-0 px-2 self-stretch flex items-center justify-between gap-2 group-hover:text-foreground"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            {q.parent && (
              <span className="shrink-0 rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/60">
                Wacana
              </span>
            )}
            <div className="min-w-0 flex-1 truncate text-xs text-foreground/90 font-normal">
              <MathContent
                content={excerpt(flattenMathForList(q.contentMarkdown), 180)}
                noScroll
                className="inline truncate max-w-full text-xs text-foreground/90 font-normal"
              />
            </div>
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
        {(q.options?.length ?? 0) > 0 && (
          <div className="sr-only">
            {(q.options ?? []).map((o) => (
              <span key={o.id} className={cn(o.isCorrect ? "text-success font-medium" : "")}>
                {/* `noScroll`: blok sr-only tak terlihat — jangan jadikan kontainer
                    gulir (dulu membuat area scroll tak kasat mata di daftar). */}
                <strong>{o.label}.</strong> <MathContent content={o.contentMarkdown} noScroll />
              </span>
            ))}
          </div>
        )}

        {/* 6. Status Soal di Paling Kanan — compact di mobile agar teks soal leluasa */}
        <StatusIndicator status={q.status} compact />
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
        mode === "grid" && "min-h-[280px]",
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
            <CognitiveBadge level={q.cognitiveLevel} className="pointer-coarse:min-h-[44px]" />
            <DifficultyBadge level={q.difficulty} className="pointer-coarse:min-h-[44px]" />
            {q.isFlagged && (
              <Flag className="size-3.5 text-gold shrink-0" role="img" aria-label="Ditandai" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <StatusIndicator status={q.status} />
            {onToggleSelect && (
              <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelect(q.id)}
                  aria-label={selectLabel(q)}
                  className="size-4 rounded border-border accent-[var(--mb-brand)] cursor-pointer"
                />
              </label>
            )}
          </div>
        </div>

        {/* WACANA STIMULUS (JIKA ADA) */}
        {q.parent && (
          <StimulusCard content={q.parent.contentMarkdown} className="text-xs" />
        )}

        {/* KONTEN UTAMA SOAL & OPSI PILIHAN GANDA (SATU KESATUAN ALUR NASKAH) */}
        <Link href={href} className="block group-hover:text-foreground">
          {mode === "grid" ? (
            <div className="relative max-h-[220px] overflow-hidden">
              <MathContent
                content={excerpt(q.contentMarkdown, 240)}
                noScroll
                className="text-xs leading-relaxed text-foreground overflow-hidden"
              />

              {/* OPSI PILIHAN GANDA (MENYATU DIDALAM AREA KARTU NASKAH) */}
              {(q.options?.length ?? 0) > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border/40 pt-2 text-xs">
                  {(q.options ?? []).map((o) => (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-center gap-2 leading-relaxed transition-colors min-w-0",
                        o.isCorrect ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      <span className={cn(o.isCorrect ? "text-success" : "")}>
                        <strong
                          className={cn(
                            "font-mono font-semibold shrink-0",
                            o.isCorrect
                              ? "text-success text-emerald-600 dark:text-emerald-400"
                              : "text-foreground/70",
                          )}
                        >
                          {o.label}.
                        </strong>
                      </span>
                      <div className="min-w-0 flex-1 truncate">
                        <MathContent
                          content={o.contentMarkdown}
                          noScroll
                          className="inline truncate max-w-full text-xs"
                        />
                      </div>
                      {o.isCorrect && (
                        <span
                          className="inline-flex items-center text-[12px] font-bold text-success text-emerald-600 dark:text-emerald-400 shrink-0"
                          title="Kunci Jawaban"
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Gradien fade-out lembut di batas bawah jika ruang kartu tidak mencukupi */}
              <span className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-card to-transparent" aria-hidden="true" />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <MathContent
                content={q.contentMarkdown}
                noScroll
                className="text-xs leading-relaxed text-foreground overflow-hidden max-h-[380px]"
              />
              {(q.options?.length ?? 0) > 0 && (
                <div className="mt-1 flex flex-col gap-1.5 border-t border-border/40 pt-2 text-xs">
                  {(q.options ?? []).map((o) => (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-center gap-2 leading-relaxed transition-colors min-w-0",
                        o.isCorrect ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      <span className={cn(o.isCorrect ? "text-success" : "")}>
                        <strong
                          className={cn(
                            "font-mono font-semibold shrink-0",
                            o.isCorrect
                              ? "text-success text-emerald-600 dark:text-emerald-400"
                              : "text-foreground/70",
                          )}
                        >
                          {o.label}.
                        </strong>
                      </span>
                      <div className="min-w-0 flex-1 truncate">
                        <MathContent
                          content={o.contentMarkdown}
                          noScroll
                          className="inline truncate max-w-full text-xs"
                        />
                      </div>
                      {o.isCorrect && (
                        <span
                          className="inline-flex items-center text-[12px] font-bold text-success text-emerald-600 dark:text-emerald-400 shrink-0"
                          title="Kunci Jawaban"
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Link>
      </div>

      {/* FOOTER KARTU */}
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] font-mono text-muted-foreground">
        <span className="truncate max-w-[180px]">
          {q.bundles?.[0]?.sourceLabel ?? (q.bundles?.length ? "Naskah" : "Mandiri")}
        </span>
        <Link
          href={href}
          aria-label={openLabel(q)}
          className="inline-flex min-h-[44px] items-center gap-1 hover:text-foreground shrink-0"
        >
          Buka <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

/**
 * PERF-02 — `React.memo` dengan pembanding prop selektif.
 *
 * Saat guru mencentang/menggeser seleksi, `QuestionBankView` me-render ulang
 * seluruh daftar. Tanpa memo, setiap kartu (beserta puluhan token KaTeX)
 * di-render ulang dan memblokir main thread. Pembanding ini hanya menandai
 * kartu berubah bila `selected` kartu itu sendiri berubah, atau identitas
 * `question`/`href`/`mode` berubah — sehingga kartu yang tak tersentuh seleksi
 * tidak dirender ulang (O(1) alih-alih O(n) per klik).
 *
 * CATATAN `onToggleSelect` SENGAJA tidak dibandingkan: handler dari
 * `QuestionBankView` memakai pembaruan state fungsional (`setSelected(prev => …)`)
 * sehingga **perilakunya stabil** walau identitas fungsinya berubah tiap render.
 * Memasukkan perbandingan identitasnya akan menggagalkan memo setiap render dan
 * menghidupkan kembali freeze yang justru ingin dihilangkan. `question` stabil
 * selama data query React Query belum berubah (referensi objek dipertahankan).
 */
function areCardPropsEqual(
  prev: {
    question: PublicQuestion;
    href: string;
    selected?: boolean;
    onToggleSelect?: (id: string) => void;
    mode?: ViewMode;
  },
  next: {
    question: PublicQuestion;
    href: string;
    selected?: boolean;
    onToggleSelect?: (id: string) => void;
    mode?: ViewMode;
  },
): boolean {
  return (
    prev.question === next.question &&
    prev.href === next.href &&
    prev.mode === next.mode &&
    prev.selected === next.selected
  );
}

export const QuestionCard = memo(QuestionCardInner, areCardPropsEqual);

