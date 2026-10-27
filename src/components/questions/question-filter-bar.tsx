"use client";

import Link from "next/link";
import {
  SlidersHorizontal,
  Search,
  Plus,
  X,
  RotateCcw,
  Gauge,
  Brain,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ViewModeToggle,
  type ViewMode,
} from "@/components/questions/view-mode-toggle";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  COGNITIVE_LABELS,
  formatGradeBadge,
} from "@/lib/display/labels";
import { StatusIcon } from "@/components/questions/question-status-badge";
import type { FilterValues } from "./question-filter-drawer";
import type {
  TopicRow,
  SourceRow,
  GradeRow,
} from "@/lib/hooks/use-reference";
import type { TagRow } from "@/lib/services/taxonomy/shared";

interface QuestionFilterBarProps {
  onOpenDrawer: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  filters: FilterValues;
  topics: TopicRow[];
  tags?: TagRow[];
  grades: GradeRow[];
  sources: SourceRow[];
  onRemoveTopic: (id: string) => void;
  onClearTag?: () => void;
  onRemoveGrade: (id: string) => void;
  onRemoveDifficulty: (level: number) => void;
  onRemoveCognitive?: (level: string) => void;
  onRemoveType: (type: string) => void;
  onClearStatus: () => void;
  onClearFlagged?: () => void;
  onClearSource: () => void;
  onResetAll: () => void;
  /** Hapus pencarian dan langsung kirim pencarian kosong (bukan sekadar kosongkan kotak). */
  onClearSearch: () => void;
  totalFiltered: number;
  /** Daftar masih memuat — jumlah tidak boleh ditampilkan sebagai 0. */
  isLoading?: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function QuestionFilterBar({
  onOpenDrawer,
  search,
  onSearchChange,
  onSearchSubmit,
  filters,
  topics,
  tags = [],
  sources,
  onRemoveTopic,
  onClearTag,
  onRemoveGrade,
  onRemoveDifficulty,
  onRemoveCognitive,
  onRemoveType,
  onClearStatus,
  onClearFlagged,
  onClearSource,
  onResetAll,
  onClearSearch,
  totalFiltered,
  isLoading = false,
  viewMode,
  onViewModeChange,
}: QuestionFilterBarProps) {
  // Hitung jumlah filter aktif
  const activeCount =
    filters.topicId.length +
    (filters.tagId ? 1 : 0) +
    filters.grade.length +
    filters.difficulty.length +
    (filters.cognitiveLevel?.length ?? 0) +
    filters.questionType.length +
    (filters.status ? 1 : 0) +
    (filters.sourceId ? 1 : 0) +
    (filters.flagged ? 1 : 0);

  // Map nama topik untuk badge
  const topicMap = new Map(topics.map((t) => [t.id, t.name]));
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));
  const sourceMap = new Map(sources.map((s) => [s.id, s.label]));

  return (
    <div className="flex flex-col border-b border-border/80 bg-background/95 backdrop-blur-xs">
      {/* Baris Utama: Filter Trigger, Search Input, Total, View Mode, Action */}
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        {/* Tombol Buka Filter Drawer — di mobile ikon saja, di desktop dengan teks */}
        <Button
          variant={activeCount > 0 ? "secondary" : "outline"}
          size="sm"
          onClick={onOpenDrawer}
          className="relative gap-1.5 shrink-0 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 text-xs font-medium"
          aria-label="Buka filter"
        >
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Filter</span>
          {activeCount > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-brand text-[10px] font-bold text-brand-fg">
              {activeCount}
            </span>
          )}
        </Button>

        {/* Form Pencarian Soal */}
        <form onSubmit={onSearchSubmit} className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari soal…"
            aria-label="Cari soal"
            className="h-8 pl-8 text-base sm:text-xs bg-muted/20 pointer-coarse:min-h-[44px]"
          />
          {search && (
            <button
              type="button"
              onClick={onClearSearch}
              aria-label="Hapus pencarian"
              className="absolute right-0 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </form>

        {/* Counter Total Soal (Desktop) — saat memuat, jangan tampilkan 0 yang menyesatkan. */}
        <span
          className="hidden shrink-0 text-xs font-mono text-muted-foreground md:inline"
          aria-live="polite"
        >
          {isLoading ? "Memuat…" : `${totalFiltered} soal`}
        </span>

        {/* Toggle Mode Tampilan (List / Grid / Masonry) */}
        <ViewModeToggle value={viewMode} onChange={onViewModeChange} />

        {/* Tombol Buat Soal — disembunyikan di mobile (< sm) */}
        <Button
          render={<Link href="/questions/new" aria-label="Buat Soal" />}
          nativeButton={false}
          size="sm"
          className="hidden sm:inline-flex shrink-0 gap-1.5 px-3 pointer-coarse:min-h-[44px]"
        >
          <Plus className="size-3.5" />
          <span className="text-xs font-medium">Buat Soal</span>
        </Button>
      </div>

      {/* Baris Tag Filter Aktif (Hanya muncul jika ada filter yang aktif) */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 bg-muted/15 px-3 py-1.5 text-xs sm:px-4">
          <span className="text-[11px] text-muted-foreground">Aktif:</span>

          {/* Status */}
          {filters.status && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              <StatusIcon status={filters.status} className="size-3 shrink-0" aria-hidden="true" />
              <span>Status: {STATUS_LABELS[filters.status] ?? filters.status}</span>
              <button
                type="button"
                onClick={onClearStatus}
                className="relative flex items-center justify-center rounded-sm hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Hapus filter status"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {/* Topik */}
          {filters.topicId.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground"
            >
              {topicMap.get(id) ?? id}
              <button
                type="button"
                onClick={() => onRemoveTopic(id)}
                className="relative flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Hapus filter topik"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          {/* Jenjang */}
          {filters.grade.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground"
            >
              {formatGradeBadge(id)}
              <button
                type="button"
                onClick={() => onRemoveGrade(id)}
                className="relative flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Hapus filter jenjang"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          {/* Kesulitan */}
          {filters.difficulty.map((lvl) => (
            <span
              key={lvl}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground"
            >
              <Gauge className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>{lvl}</span>
              <button
                type="button"
                onClick={() => onRemoveDifficulty(lvl)}
                className="relative flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Hapus filter kesulitan"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          {/* Bloom */}
          {filters.cognitiveLevel?.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground"
            >
              <Brain className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>{COGNITIVE_LABELS[k]?.split(" · ")[0]?.replace(/^C/i, "") ?? k}</span>
              <button
                type="button"
                onClick={() => onRemoveCognitive?.(k)}
                className="relative flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Hapus filter bloom"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          {/* Tipe Soal */}
          {filters.questionType.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground"
            >
              {TYPE_LABELS[t] ?? t}
              <button
                type="button"
                onClick={() => onRemoveType(t)}
                className="relative flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Hapus filter tipe soal"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          {/* Tag */}
          {filters.tagId && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
              Tag: {tagMap.get(filters.tagId) ?? filters.tagId}
              <button
                type="button"
                onClick={onClearTag}
                className="relative flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Hapus filter tag"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {/* Flag */}
          {filters.flagged && (
            <span className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold-fg">
              <Flag className="size-3 text-gold" aria-hidden="true" />
              Ditandai
              <button
                type="button"
                onClick={onClearFlagged}
                className="relative flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Hapus filter ditandai"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {/* Sumber */}
          {filters.sourceId && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
              Sumber: {sourceMap.get(filters.sourceId) ?? filters.sourceId}
              <button
                type="button"
                onClick={onClearSource}
                className="relative flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Hapus filter sumber"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {/* Tombol Bersihkan Semua */}
          <button
            type="button"
            onClick={onResetAll}
            className="relative ml-auto inline-flex items-center gap-1 rounded-sm px-1 py-1 text-[11px] text-muted-foreground hover:text-destructive after:absolute after:-inset-2 after:content-['']"
          >
            <RotateCcw className="size-3" />
            Reset ({activeCount})
          </button>
        </div>
      )}
    </div>
  );
}
