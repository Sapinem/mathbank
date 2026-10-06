"use client";

import Link from "next/link";
import {
  SlidersHorizontal,
  Search,
  Plus,
  X,
  RotateCcw,
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
} from "@/lib/display/labels";
import type { FilterValues } from "./question-filter-drawer";
import type {
  TopicRow,
  SourceRow,
  GradeRow,
} from "@/lib/hooks/use-reference";

interface QuestionFilterBarProps {
  onOpenDrawer: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  filters: FilterValues;
  topics: TopicRow[];
  grades: GradeRow[];
  sources: SourceRow[];
  onRemoveTopic: (id: string) => void;
  onRemoveGrade: (id: string) => void;
  onRemoveDifficulty: (level: number) => void;
  onRemoveCognitive?: (level: string) => void;
  onRemoveType: (type: string) => void;
  onClearStatus: () => void;
  onClearSource: () => void;
  onResetAll: () => void;
  totalFiltered: number;
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
  grades,
  sources,
  onRemoveTopic,
  onRemoveGrade,
  onRemoveDifficulty,
  onRemoveCognitive,
  onRemoveType,
  onClearStatus,
  onClearSource,
  onResetAll,
  totalFiltered,
  viewMode,
  onViewModeChange,
}: QuestionFilterBarProps) {
  // Hitung jumlah filter aktif
  const activeCount =
    filters.topicId.length +
    filters.grade.length +
    filters.difficulty.length +
    (filters.cognitiveLevel?.length ?? 0) +
    filters.questionType.length +
    (filters.status ? 1 : 0) +
    (filters.sourceId ? 1 : 0);

  // Map nama topik untuk badge
  const topicMap = new Map(topics.map((t) => [t.id, t.name]));
  const gradeMap = new Map(grades.map((g) => [g.id, g.label]));
  const sourceMap = new Map(sources.map((s) => [s.id, s.label]));

  return (
    <div className="flex flex-col border-b border-border/80 bg-background/95 backdrop-blur-xs">
      {/* Baris Utama: Filter Trigger, Search Input, Total, View Mode, Action */}
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        {/* Tombol Buka Filter Drawer */}
        <Button
          variant={activeCount > 0 ? "secondary" : "outline"}
          size="sm"
          onClick={onOpenDrawer}
          className="relative gap-2 shrink-0 min-h-[44px]"
          aria-label="Buka filter"
        >
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Filter</span>
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
            className="h-9 pl-8 text-sm bg-muted/20 pointer-coarse:min-h-[44px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Hapus pencarian"
              className="absolute right-0 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </form>

        {/* Counter Total Soal (Desktop) */}
        <span className="hidden shrink-0 text-xs font-mono text-muted-foreground sm:inline">
          {totalFiltered} soal
        </span>

        {/* Toggle Mode Tampilan (List / Grid / Masonry) */}
        <ViewModeToggle value={viewMode} onChange={onViewModeChange} />

        {/* Tombol Buat Soal */}
        <Button
          render={<Link href="/questions/new" />}
          nativeButton={false}
          size="sm"
          className="shrink-0 gap-1.5"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">Buat Soal</span>
        </Button>
      </div>

      {/* Baris Tag Filter Aktif (Hanya muncul jika ada filter yang aktif) */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 bg-muted/15 px-3 py-1.5 text-xs sm:px-4">
          <span className="text-[11px] text-muted-foreground">Aktif:</span>

          {/* Status */}
          {filters.status && (
            <span className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              Status: {STATUS_LABELS[filters.status] ?? filters.status}
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
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground"
            >
              Kelas: {gradeMap.get(id) ?? id}
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
              Lv.{lvl}
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
              Bloom: {k}
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
            className="ml-auto inline-flex min-h-[44px] items-center gap-1 rounded-sm px-1 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="size-3" />
            Reset ({activeCount})
          </button>
        </div>
      )}
    </div>
  );
}
