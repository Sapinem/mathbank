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
  GraduationCap,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { MathContent } from "@/components/math/math-content";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/display/labels";
import { StatusIcon } from "@/components/questions/question-status-badge";
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
 * Buang rujukan gambar shortcode `{{img:...}}` maupun sintaks markdown `![]()`
 * agar teks ringkasan (misal tampilan list) bersih dari elemen gambar.
 */
export function stripImages(text: string): string {
  return text
    .replace(/\{\{\s*img\s*:[^}]+\}\}/gi, "")
    .replace(/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])?/g, "");
}

/**
 * Ratakan lingkungan rumus multi-baris (matrix, cases, aligned, \\)
 * dan bersihkan rujukan gambar agar menjadi datar/inline pada baris ikhtisar mode list.
 */
export function flattenMathForList(text: string): string {
  return stripImages(text)
    .replace(/\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|array|align\*?)\}/g, "")
    .replace(/\\end\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|array|align\*?)\}/g, "")
    .replace(/(?<!\\)&\s*=/g, "=")
    .replace(/(?<!\\)&/g, ",\\; ")
    .replace(/\\\\/g, ",\\; ");
}

export { formatGradeBadge } from "@/lib/display/labels";
import { formatGradeBadge } from "@/lib/display/labels";

/** Label jenjang yang terbaca untuk tooltip/aria: angka jadi "Kelas N",
 *  kode lain (11W, UTBK, UMUM, …) memakai awalan "Jenjang". */
function gradeLabel(grade: string): string {
  const formatted = formatGradeBadge(grade);
  return /^\d+$/.test(formatted) ? `Kelas ${formatted}` : `Jenjang ${formatted}`;
}

/** Penanda jenjang: ikon Lucide `graduation-cap` + angka/kode jenjang.
 *  Topik sengaja TIDAK diubah jadi ikon — topik tetap teks bernama.
 *  Ikon tidak berdiri sendiri: tombol ini punya aria-label dan tooltip
 *  berisi label jenjang lengkap. */
export function GradeMarker({
  grade,
  grades,
  className,
}: {
  grade?: string | null;
  grades?: string[] | null;
  className?: string;
}) {
  const rawList = grades?.length ? grades : grade ? [grade] : [];
  const list = rawList.filter((g) => g && g.toLowerCase() !== "umum");
  if (list.length === 0) return null;

  const display = list.map(formatGradeBadge).join(" · ");
  const label = list.map(gradeLabel).join(", ");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex shrink-0 cursor-help items-center justify-center gap-1 rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/90 transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:ring-1 focus-visible:ring-brand",
              className,
            )}
          >
            <GraduationCap className="size-3.5" aria-hidden="true" />
            {display}
          </button>
        }
      />
      <TooltipContent>
        <span className="text-xs font-medium">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
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
            className="relative flex size-6 shrink-0 cursor-help items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:ring-1 focus-visible:ring-brand after:absolute after:-inset-2 after:content-['']"
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

/** Indikator status alur soal (Draf/Telaah/Arsip/…) dengan dot semantik.
 *  "Siap" SENGAJA dirender sebagai titik netral kecil (•) tanpa teks/badge berlebih
 *  sesuai DESIGN.md §134, agar dapat dibedakan dari status yang belum termuat,
 *  sementara status yang butuh tindakan (Draf/Telaah) tampil lebih menonjol.
 *  `compact` — di mobile mode list, label ringkas agar teks soal mendapat
 *  ruang ≥ 180px pada layar 360px. */
/**
 * Indikator status soal pada kartu (icon-only dengan tooltip dan aria-label).
 *
 * Sesuai arahan pengguna ("icon aja jangan ada tulisan draft"):
 * Status tampil murni berupa ikon Lucide ukuran compact size-6 (ikon size-3.5),
 * seragam dengan QuestionTypeIcon, tanpa memakan ruang teks batang soal.
 */
export function StatusIndicator({
  status,
}: {
  status: string;
  compact?: boolean;
}) {
  const label = STATUS_LABELS[status] ?? status;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              "relative flex size-6 shrink-0 cursor-help items-center justify-center rounded-md border transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-brand",
              status === "draft" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
              status === "review" &&
                "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
              status === "ready" &&
                "border-transparent bg-transparent text-muted-foreground/40 hover:text-emerald-500",
              status === "archived" &&
                "border-border/80 bg-muted/60 text-muted-foreground",
              !["draft", "review", "ready", "archived"].includes(status) &&
                "border-border bg-muted text-muted-foreground",
            )}
            aria-label={`Status: ${label}`}
          >
            <StatusIcon status={status} className="size-3.5" aria-hidden="true" />
          </button>
        }
      />
      <TooltipContent>
        <span className="text-xs font-medium">Status: {label}</span>
      </TooltipContent>
    </Tooltip>
  );
}

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
  isSelectionMode = false,
}: {
  question: PublicQuestion;
  href: string;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  mode?: ViewMode;
  isSelectionMode?: boolean;
}) {
  const q = question;
  const isCardLayout = mode === "grid" || mode === "masonry";
  const primaryTopic = q.topics?.find((t) => t.isPrimary) ?? q.topics?.[0];
  const topicName = primaryTopic?.name;

  function handleCardClick(e: React.MouseEvent) {
    if (!onToggleSelect) return;
    if (e.ctrlKey || e.metaKey || isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(q.id);
    }
  }

  // ================= MODE LIST (LINEAR LIST ROW) =================
  if (!isCardLayout) {
    return (
      <div
        className={cn(
          "group relative flex h-11 max-h-11 items-center gap-2 px-3 transition-colors hover:bg-muted/30 cursor-pointer overflow-hidden",
          selected && "bg-brand/5 border-l-2 border-l-brand",
        )}
      >
        {/* 1. Checkbox Seleksi — area sentuh ≥ 44px (CRIT-03).
            Di mode list, checklist ditampilkan selalu (tampil aktif, bukan hanya saat hover). */}
        {onToggleSelect && (
          <label
            className="flex min-h-[44px] min-w-[28px] sm:min-w-[32px] shrink-0 cursor-pointer items-center justify-center pointer-coarse:min-w-[44px]"
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(q.id)}
              aria-label={selectLabel(q)}
              className="size-3.5 rounded border-border accent-[var(--mb-brand)] cursor-pointer"
            />
          </label>
        )}

        {/* 2. Batang Soal KaTeX & Tautan Utama — Langsung di Kiri, Mengambil Ruang Utama */}
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
            {q.isFlagged && (
              <Flag className="size-3.5 text-gold shrink-0" role="img" aria-label="Ditandai" />
            )}
            <div className="min-w-0 flex-1 truncate text-base text-foreground/90 font-normal">
              <MathContent
                content={excerpt(flattenMathForList(q.contentMarkdown), 180)}
                noScroll
                className="inline truncate max-w-full text-base text-foreground/90 font-normal"
              />
            </div>
          </div>

          <ArrowUpRight className="size-3.5 opacity-30 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground" />
        </Link>

        {/* 3. Topik Utama — Kolom Tetap Terkunci (hidden di mobile <sm) */}
        <div className="hidden sm:flex shrink-0 w-[130px] lg:w-[150px] items-center gap-1.5 overflow-hidden">
          {topicName ? (
            <>
              <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              <span className="truncate text-xs font-semibold text-foreground/80" title={topicName}>
                {topicName}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground/30 font-mono pl-3" aria-label="Tanpa topik">
              -
            </span>
          )}
        </div>

        {/* 4. Penanda Jenjang & Tipe Soal — Kluster Sejajar */}
        <div className="flex shrink-0 items-center gap-1.5">
          <QuestionTypeIcon type={q.questionType} />
          <GradeMarker grade={q.grade} grades={q.grades} />
        </div>

        {/* 5. Taksonomi: Kognitif & Kesulitan — disembunyikan di mobile (<md) */}
        <div className="hidden md:flex shrink-0 items-center gap-1.5">
          <CognitiveBadge level={q.cognitiveLevel} />
          <DifficultyBadge level={q.difficulty} />
        </div>

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

        {/* 6. Status Soal di Paling Ujung Kanan */}
        <div className="flex shrink-0 items-center justify-end min-w-[36px] sm:min-w-[48px]">
          <StatusIndicator status={q.status} compact />
        </div>
      </div>
    );
  }

  // ================= MODE GRID & MASONRY (BENTO CARD) =================
  return (
    <article
      data-selected={selected ? "true" : undefined}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-3 transition-all duration-150",
        "hover:border-border hover:bg-card hover:shadow-xs",
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        mode === "grid" && "min-h-[280px]",
        selected && "border-brand ring-2 ring-brand/40 bg-brand/5 shadow-xs",
      )}
    >
      <div className="flex flex-col gap-2">
        {/* TOP BAR KARTU: TOPIK KIRI, IKON METADATA KANAN (TANPA CEKLIS) */}
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
          {/* Kiri: Topik Utama */}
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            <span className="truncate text-xs font-semibold text-foreground" title={topicName}>
              {topicName ?? "Tanpa Topik"}
            </span>
          </div>

          {/* Kanan: Ikon Metadata */}
          <div className="flex shrink-0 items-center gap-1.5">
            <GradeMarker grade={q.grade} grades={q.grades} />
            <QuestionTypeIcon type={q.questionType} />
            <CognitiveBadge level={q.cognitiveLevel} />
            <DifficultyBadge level={q.difficulty} />
            {q.isFlagged && (
              <Flag className="size-3.5 text-gold shrink-0" role="img" aria-label="Ditandai" />
            )}
            <StatusIndicator status={q.status} />
          </div>
        </div>

        {/* WACANA STIMULUS (JIKA ADA) */}
        {q.parent && (
          <StimulusCard content={q.parent.contentMarkdown} className="text-sm" />
        )}

        {/* KONTEN UTAMA SOAL & OPSI PILIHAN GANDA (SATU KESATUAN ALUR NASKAH) */}
        <Link href={href} onClick={handleCardClick} className="block group-hover:text-foreground">
          {mode === "grid" ? (
            <div className="relative max-h-[300px] overflow-hidden">
              <MathContent
                content={excerpt(stripImages(q.contentMarkdown), 240)}
                noScroll
                className="text-base leading-relaxed text-foreground overflow-hidden"
              />

              {/* OPSI PILIHAN GANDA (MENYATU DIDALAM AREA KARTU NASKAH — SETARA TEXT-BASE) */}
              {(q.options?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-2.5 text-base">
                  {(q.options ?? []).map((o) => (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-center gap-2 leading-relaxed transition-colors min-w-0 text-base",
                        o.isCorrect ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      <span className={cn(o.isCorrect ? "text-success" : "")}>
                        <strong
                          className={cn(
                            "font-mono font-semibold shrink-0 text-base",
                            o.isCorrect
                              ? "text-success text-emerald-600 dark:text-emerald-400 font-bold"
                              : "text-foreground/70",
                          )}
                        >
                          {o.label}.
                        </strong>
                      </span>
                      <div className="min-w-0 flex-1 truncate text-base">
                        <MathContent
                          content={o.contentMarkdown}
                          noScroll
                          className="inline truncate max-w-full text-base"
                        />
                      </div>
                      {o.isCorrect && (
                        <span
                          className="inline-flex items-center text-sm font-bold text-success text-emerald-600 dark:text-emerald-400 shrink-0"
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
                className="text-base leading-relaxed text-foreground overflow-hidden max-h-[440px]"
              />
              {(q.options?.length ?? 0) > 0 && (
                <div className="mt-2.5 flex flex-col gap-2 border-t border-border/40 pt-2.5 text-base">
                  {(q.options ?? []).map((o) => (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-center gap-2 leading-relaxed transition-colors min-w-0 text-base",
                        o.isCorrect ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      <span className={cn(o.isCorrect ? "text-success" : "")}>
                        <strong
                          className={cn(
                            "font-mono font-semibold shrink-0 text-base",
                            o.isCorrect
                              ? "text-success text-emerald-600 dark:text-emerald-400 font-bold"
                              : "text-foreground/70",
                          )}
                        >
                          {o.label}.
                        </strong>
                      </span>
                      <div className="min-w-0 flex-1 truncate text-base">
                        <MathContent
                          content={o.contentMarkdown}
                          noScroll
                          className="inline truncate max-w-full text-base"
                        />
                      </div>
                      {o.isCorrect && (
                        <span
                          className="inline-flex items-center text-sm font-bold text-success text-emerald-600 dark:text-emerald-400 shrink-0"
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
      <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] font-mono text-muted-foreground">
        <span className="truncate max-w-[180px]">
          {q.bundles?.[0]?.sourceLabel ?? (q.bundles?.length ? "Naskah" : "Mandiri")}
        </span>
        <Link
          href={href}
          aria-label={openLabel(q)}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="inline-flex min-h-[44px] items-center gap-1 hover:text-foreground shrink-0 text-brand font-medium"
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
    isSelectionMode?: boolean;
  },
  next: {
    question: PublicQuestion;
    href: string;
    selected?: boolean;
    onToggleSelect?: (id: string) => void;
    mode?: ViewMode;
    isSelectionMode?: boolean;
  },
): boolean {
  return (
    prev.question === next.question &&
    prev.href === next.href &&
    prev.mode === next.mode &&
    prev.selected === next.selected &&
    prev.isSelectionMode === next.isSelectionMode
  );
}

export const QuestionCard = memo(QuestionCardInner, areCardPropsEqual);

