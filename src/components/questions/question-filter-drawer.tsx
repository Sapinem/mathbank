"use client";

import { useState } from "react";
import {
  X,
  Search,
  BookOpen,
  GraduationCap,
  Layers,
  Check,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  COGNITIVE_LABELS,
} from "@/lib/display/labels";
import type {
  TopicRow,
  SourceRow,
  GradeRow,
} from "@/lib/hooks/use-reference";

export interface FilterValues {
  topicId: string[];
  grade: string[];
  difficulty: number[];
  cognitiveLevel?: string[];
  questionType: string[];
  status?: string;
  sourceId?: string;
}

interface QuestionFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterValues;
  topics: TopicRow[];
  grades: GradeRow[];
  sources: SourceRow[];
  onToggleTopic: (id: string) => void;
  onToggleGrade: (id: string) => void;
  onToggleDifficulty: (level: number) => void;
  onToggleCognitive?: (level: string) => void;
  onToggleType: (type: string) => void;
  onSelectStatus: (status: string | null) => void;
  onSelectSource: (sourceId: string | null) => void;
  onReset: () => void;
  totalFiltered: number;
}

export function QuestionFilterDrawer({
  open,
  onOpenChange,
  filters,
  topics,
  grades,
  sources,
  onToggleTopic,
  onToggleGrade,
  onToggleDifficulty,
  onToggleCognitive,
  onToggleType,
  onSelectStatus,
  onSelectSource,
  onReset,
  totalFiltered,
}: QuestionFilterDrawerProps) {
  const [topicSearch, setTopicSearch] = useState("");
  const [showSD, setShowSD] = useState(false);

  // Filter topik instan tanpa membebani render
  const needle = topicSearch.trim().toLowerCase();
  const filteredTopics = needle
    ? topics.filter((t) => t.name.toLowerCase().includes(needle))
    : topics;

  // Hitung jumlah filter aktif
  const activeCount =
    filters.topicId.length +
    filters.grade.length +
    filters.difficulty.length +
    (filters.cognitiveLevel?.length ?? 0) +
    filters.questionType.length +
    (filters.status ? 1 : 0) +
    (filters.sourceId ? 1 : 0);

  // Kelompok jenjang
  const smaGrades = grades.filter(
    (g) =>
      g.id === "10" ||
      g.id === "11" ||
      g.id === "12" ||
      g.id === "11w" ||
      g.id === "utbk",
  );
  const smpGrades = grades.filter(
    (g) => g.id === "7" || g.id === "8" || g.id === "9",
  );
  const sdGrades = grades.filter((g) =>
    ["1", "2", "3", "4", "5", "6"].includes(g.id),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[340px] max-w-[340px] flex-col justify-between p-0 shadow-2xl"
      >
        {/* Header Drawer */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
          <SheetHeader className="p-0">
            <div className="flex items-center gap-2">
              <div className="grid size-7 place-items-center rounded-md bg-brand/10 text-brand">
                <Layers className="size-4" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold tracking-tight">
                  Saring
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  {totalFiltered} soal ditemukan
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onReset}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw data-icon="inline-start" className="size-3" />
              Reset ({activeCount})
            </Button>
          )}
        </div>

        {/* Konten Scrollable */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 text-xs">
          {/* ================= 1. TOPIK POKOK (PRIORITAS #1 - PALING ATAS) ================= */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <BookOpen className="size-3.5 text-brand" />
                Topik Pokok
              </span>
              {filters.topicId.length > 0 && (
                <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] text-brand">
                  {filters.topicId.length} dipilih
                </span>
              )}
            </div>

            {/* Input Pencarian Cepat Topik */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
                placeholder="Cari topik (mis. Trigo, Aljabar)…"
                aria-label="Cari topik"
                className="h-8 pl-8 text-xs bg-muted/30"
              />
              {topicSearch && (
                <button
                  type="button"
                  onClick={() => setTopicSearch("")}
                  aria-label="Hapus pencarian topik"
                  className="absolute right-0 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Daftar Topik */}
            <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
              {filteredTopics.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Topik tidak ditemukan.
                </p>
              ) : (
                filteredTopics.map((t) => {
                  const checked = filters.topicId.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onToggleTopic(t.id)}
                      aria-label={t.name}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2.5 min-h-[44px] text-left text-xs transition-colors",
                        checked
                          ? "bg-brand/15 font-medium text-brand"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{t.name}</span>
                      {checked && <Check className="size-3.5 shrink-0 text-brand" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ================= 2. JENJANG KELAS (BERKELOMPOK) ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <GraduationCap className="size-3.5 text-muted-foreground" />
              Jenjang Kelas
            </span>

            {/* SMA */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                SMA / SMK / UTBK
              </span>
              <div className="flex flex-wrap gap-1.5">
                {smaGrades.map((g) => {
                  const checked = filters.grade.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onToggleGrade(g.id)}
                      aria-label={g.label}
                      className={cn(
                        "min-h-[44px] rounded-md border px-2.5 py-1 text-xs transition-colors",
                        checked
                          ? "border-brand bg-brand/15 font-medium text-brand"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SMP */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                SMP / MTs
              </span>
              <div className="flex flex-wrap gap-1.5">
                {smpGrades.map((g) => {
                  const checked = filters.grade.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onToggleGrade(g.id)}
                      aria-label={g.label}
                      className={cn(
                        "min-h-[44px] rounded-md border px-2.5 py-1 text-xs transition-colors",
                        checked
                          ? "border-brand bg-brand/15 font-medium text-brand"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SD (Collapsible) */}
            {sdGrades.length > 0 && (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setShowSD(!showSD)}
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground hover:text-foreground"
                >
                  {showSD ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  SD / MI (Kelas 1–6)
                </button>
                {showSD && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {sdGrades.map((g) => {
                      const checked = filters.grade.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => onToggleGrade(g.id)}
                          aria-label={g.label}
                          className={cn(
                            "min-h-[44px] rounded-md border px-2.5 py-1 text-xs transition-colors",
                            checked
                              ? "border-brand bg-brand/15 font-medium text-brand"
                              : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                          )}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ================= 3. TIPE SOAL ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <span className="font-medium text-foreground">Tipe Soal</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TYPE_LABELS).map(([v, label]) => {
                const checked = filters.questionType.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onToggleType(v)}
                    aria-label={label}
                    className={cn(
                      "min-h-[44px] rounded-md border px-2.5 py-1 text-xs transition-colors",
                      checked
                        ? "border-brand bg-brand/15 font-medium text-brand"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================= 4. KESULITAN & TAKSONOMI BLOOM ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="size-3.5 text-muted-foreground" />
              Tingkat Kesulitan & Bloom
            </span>

            {/* Kesulitan 1-5 */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((lvl) => {
                const checked = filters.difficulty.includes(lvl);
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onToggleDifficulty(lvl)}
                    aria-label={`Level ${lvl}`}
                    className={cn(
                      "flex-1 min-h-[44px] rounded-md border py-1 text-center font-mono text-xs transition-colors",
                      checked
                        ? "border-brand bg-brand/15 font-bold text-brand"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    Lv.{lvl}
                  </button>
                );
              })}
            </div>

            {/* Bloom C1 - C6 (jika onToggleCognitive tersedia) */}
            {onToggleCognitive && (
              <div className="flex flex-wrap gap-1 pt-1">
                {Object.entries(COGNITIVE_LABELS).map(([k, label]) => {
                  const checked = filters.cognitiveLevel?.includes(k);
                  const shortLabel = label.split(" · ")[0]; // C1, C2, dst.
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => onToggleCognitive(k)}
                      aria-label={label}
                      title={label}
                      className={cn(
                        "min-h-[44px] rounded-md border px-2 py-0.5 font-mono text-xs transition-colors",
                        checked
                          ? "border-brand bg-brand/15 font-bold text-brand"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      {shortLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================= 5. SUMBER & ASAL ================= */}
          {sources.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Database className="size-3.5 text-muted-foreground" />
                Sumber / Institusi
              </span>
              <div className="flex max-h-28 flex-col gap-1 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => onSelectSource(null)}
                  aria-label="Semua"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 min-h-[44px] text-left text-xs transition-colors",
                    !filters.sourceId
                      ? "bg-brand/15 font-medium text-brand"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <span>Semua Sumber</span>
                  {!filters.sourceId && (
                    <Check className="size-3.5 shrink-0 text-brand" />
                  )}
                </button>
                {sources.map((s) => {
                  const checked = filters.sourceId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectSource(checked ? null : s.id)}
                      aria-label={s.label}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2.5 min-h-[44px] text-left text-xs transition-colors",
                        checked
                          ? "bg-brand/15 font-medium text-brand"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{s.label}</span>
                      {checked && (
                        <Check className="size-3.5 shrink-0 text-brand" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= 6. STATUS ALUR SOAL (RAMPING DI BAWAH) ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <span className="font-medium text-foreground">Status Alur</span>
            <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => onSelectStatus(null)}
                aria-label="Semua"
                className={cn(
                  "flex-1 min-h-[44px] rounded-md py-1 text-center text-xs transition-colors",
                  !filters.status
                    ? "bg-background font-medium text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Semua
              </button>
              {Object.entries(STATUS_LABELS).map(([v, label]) => {
                const checked = filters.status === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onSelectStatus(checked ? null : v)}
                    aria-label={label}
                    className={cn(
                      "flex-1 min-h-[44px] rounded-md py-1 text-center text-xs transition-colors",
                      checked
                        ? "bg-background font-medium text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Drawer */}
        <div className="border-t border-border/80 p-3">
          <Button
            className="w-full min-h-[44px]"
            onClick={() => onOpenChange(false)}
          >
            Terapkan
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
