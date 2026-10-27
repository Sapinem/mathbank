"use client";

import { useState } from "react";
import {
  X,
  Search,
  BookOpen,
  Tag as TagIcon,
  GraduationCap,
  Layers,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Database,
  Brain,
  Gauge,
  CircleDot,
  Flag,
  HelpCircle,
  Check,
  CheckCircle2,
  FilePenLine,
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
  STATUS_SHORT_LABELS,
  TYPE_LABELS,
  COGNITIVE_LABELS,
  formatGradeBadge,
} from "@/lib/display/labels";
import { StatusIcon } from "@/components/questions/question-status-badge";
import type {
  TopicRow,
  SourceRow,
  GradeRow,
} from "@/lib/hooks/use-reference";
import type { TagRow } from "@/lib/services/taxonomy/shared";

export interface FilterValues {
  topicId: string[];
  tagId?: string;
  grade: string[];
  difficulty: number[];
  cognitiveLevel?: string[];
  questionType: string[];
  status?: string;
  sourceId?: string;
  flagged?: boolean;
}

interface QuestionFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterValues;
  topics: TopicRow[];
  tags?: TagRow[];
  grades: GradeRow[];
  sources: SourceRow[];
  onToggleTopic: (id: string) => void;
  onSelectTag?: (id: string | null) => void;
  onToggleGrade: (id: string) => void;
  onToggleDifficulty: (level: number) => void;
  onToggleCognitive?: (level: string) => void;
  onToggleType: (type: string) => void;
  onSelectStatus: (status: string | null) => void;
  onToggleFlagged?: () => void;
  onSelectSource: (sourceId: string | null) => void;
  onReset: () => void;
  totalFiltered: number;
  /** Daftar masih memuat — jumlah tidak boleh ditampilkan sebagai 0. */
  isLoading?: boolean;
}

export function QuestionFilterDrawer({
  open,
  onOpenChange,
  filters,
  topics,
  tags = [],
  grades,
  sources,
  onToggleTopic,
  onSelectTag,
  onToggleGrade,
  onToggleDifficulty,
  onToggleCognitive,
  onToggleType,
  onSelectStatus,
  onToggleFlagged,
  onSelectSource,
  onReset,
  totalFiltered,
  isLoading = false,
}: QuestionFilterDrawerProps) {
  const [topicSearch, setTopicSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [showLegend, setShowLegend] = useState(false);

  // Urutkan topik berdasarkan jumlah penggunaan terbanyak (paling banyak teratas), lalu abjad
  const sortedTopics = [...topics].sort((a, b) => {
    const diff = (b.usageCount ?? 0) - (a.usageCount ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  // Filter topik instan
  const needleTopic = topicSearch.trim().toLowerCase();
  const filteredTopics = needleTopic
    ? sortedTopics.filter((t) => t.name.toLowerCase().includes(needleTopic))
    : sortedTopics;

  // Urutkan tag berdasarkan jumlah penggunaan terbanyak (paling banyak teratas), lalu abjad
  const sortedTags = [...tags].sort((a, b) => {
    const diff = (b.usageCount ?? 0) - (a.usageCount ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  // Filter tag
  const needleTag = tagSearch.trim().toLowerCase();
  const filteredTags = needleTag
    ? sortedTags.filter((t) => t.name.toLowerCase().includes(needleTag))
    : sortedTags;

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

  // Daftar jenjang bersih dari database (tanpa varian w/l)
  const cleanGrades = grades.filter((g) => !["11w", "11l", "12w", "12l"].includes(g.id));

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
                  {isLoading ? "Memuat jumlah soal…" : `${totalFiltered} soal ditemukan`}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex items-center gap-1">
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
        </div>

        {/* Konten Scrollable — Urutan Hierarkis Sesuai Rekomendasi */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 text-xs">
          {/* ================= 1. TOPIK POKOK ================= */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <BookOpen className="size-3.5 text-muted-foreground" />
                Topik Materi
              </span>
              {filters.topicId.length > 0 && (
                <span className="text-[11px] font-semibold text-brand">
                  {filters.topicId.length} dipilih
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
                placeholder="Cari topik…"
                aria-label="Cari topik"
                className="h-9 pl-7 text-base sm:text-xs bg-muted/20"
              />
              {topicSearch && (
                <button
                  type="button"
                  onClick={() => setTopicSearch("")}
                  aria-label="Hapus pencarian topik"
                  className="absolute right-0 top-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto pr-1">
              {filteredTopics.length === 0 ? (
                <span className="py-2 text-center text-xs text-muted-foreground">
                  Topik tidak ditemukan
                </span>
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
                        "flex w-full items-center justify-between rounded-md px-2.5 min-h-[36px] text-left text-xs transition-colors pointer-coarse:min-h-[44px]",
                        checked
                          ? "bg-brand/15 font-medium text-brand"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{t.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {t.usageCount !== undefined && t.usageCount > 0 && (
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            {t.usageCount.toLocaleString("id-ID")}
                          </span>
                        )}
                        {checked && <Check className="size-3.5 text-brand" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ================= 2. TAGAR / LABEL ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <TagIcon className="size-3.5 text-muted-foreground" />
                Tagar / Label
              </span>
              {filters.tagId && (
                <button
                  type="button"
                  onClick={() => onSelectTag?.(null)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Hapus
                </button>
              )}
            </div>

            {tags.length > 8 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Cari label/tagar…"
                  aria-label="Cari label"
                  className="h-9 pl-7 text-base sm:text-xs bg-muted/20"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {filteredTags.length === 0 ? (
                <span className="py-2 text-center text-xs text-muted-foreground">
                  Belum ada label
                </span>
              ) : (
                filteredTags.map((tag) => {
                  const checked = filters.tagId === tag.id;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onSelectTag?.(checked ? null : tag.id)}
                      aria-label={`Tag: ${tag.name}`}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors min-h-[32px] pointer-coarse:min-h-[44px]",
                        checked
                          ? "border-brand bg-brand/15 font-medium text-brand"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      <span className="truncate max-w-[140px]">{tag.name}</span>
                      {tag.usageCount > 0 && (
                        <span className="text-[10px] opacity-60">({tag.usageCount})</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ================= 3. JENJANG KELAS (DISATUKAN) ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <GraduationCap className="size-3.5 text-muted-foreground" />
                Jenjang Kelas
              </span>
              {filters.grade.length > 0 && (
                <span className="text-[11px] font-semibold text-brand">
                  {filters.grade.length} dipilih
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {cleanGrades.map((g) => {
                const checked = filters.grade.includes(g.id);
                const display = formatGradeBadge(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onToggleGrade(g.id)}
                    aria-label={g.label}
                    title={g.label}
                    className={cn(
                      "min-h-[36px] min-w-[36px] rounded-md border px-2 py-1 font-mono text-xs font-medium transition-colors pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]",
                      checked
                        ? "border-brand bg-brand/15 font-bold text-brand"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    {display}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================= 4. TIPE SOAL ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Layers className="size-3.5 text-muted-foreground" />
              Tipe Soal
            </span>
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
                      "min-h-[36px] rounded-md border px-2.5 py-1 text-xs transition-colors pointer-coarse:min-h-[44px]",
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

          {/* ================= 5. TINGKAT KESULITAN & BLOOM ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="size-3.5 text-muted-foreground" />
              Kesulitan & Bloom
            </span>

            {/* Kesulitan 1-5 */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Tingkat Kesulitan (1–5)
              </span>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const checked = filters.difficulty.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onToggleDifficulty(lvl)}
                      aria-label={`Level ${lvl}`}
                      className={cn(
                        "min-h-[36px] rounded-md border py-1 text-center font-mono text-xs transition-colors pointer-coarse:min-h-[44px]",
                        checked
                          ? "border-brand bg-brand/15 font-bold text-brand"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      <span className="flex items-center justify-center gap-1">
                        <Gauge className="size-3.5" aria-hidden="true" />
                        <span>{lvl}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bloom 1 - 6 */}
            {onToggleCognitive && (
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Dimensi Kognitif (1–6)
                </span>
                <div className="grid grid-cols-6 gap-1">
                  {Object.entries(COGNITIVE_LABELS).map(([k, label]) => {
                    const checked = filters.cognitiveLevel?.includes(k);
                    const shortNum = label.split(" · ")[0]?.replace(/^C/i, "") ?? k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => onToggleCognitive(k)}
                        aria-label={label}
                        title={label}
                        className={cn(
                          "min-h-[36px] rounded-md border py-1 font-mono text-xs transition-colors pointer-coarse:min-h-[44px]",
                          checked
                            ? "border-brand bg-brand/15 font-bold text-brand"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                        )}
                      >
                        <span className="flex items-center justify-center gap-1">
                          <Brain className="size-3.5" aria-hidden="true" />
                          <span>{shortNum}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ================= 6. STATUS & KESIAPAN ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <CircleDot className="size-3.5 text-muted-foreground" />
              Status & Kesiapan
            </span>
            <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => onSelectStatus(null)}
                aria-label="Semua"
                className={cn(
                  "flex-1 min-h-[36px] rounded-md py-1 text-center text-xs transition-colors pointer-coarse:min-h-[44px]",
                  !filters.status
                    ? "bg-background font-medium text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Semua
              </button>
              {Object.entries(STATUS_LABELS).map(([v, label]) => {
                const checked = filters.status === v;
                const shortLabel = STATUS_SHORT_LABELS[v] ?? label;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onSelectStatus(checked ? null : v)}
                    aria-label={label}
                    title={label}
                    className={cn(
                      "flex-1 min-h-[36px] rounded-md py-1 px-1 text-center text-xs transition-colors pointer-coarse:min-h-[44px]",
                      checked
                        ? "bg-background font-medium text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <StatusIcon status={v} className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{shortLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Toggle Flag */}
            {onToggleFlagged && (
              <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-foreground select-none min-h-[44px] pointer-coarse:min-h-[44px]">
                <input
                  type="checkbox"
                  checked={Boolean(filters.flagged)}
                  onChange={onToggleFlagged}
                  className="size-3.5 rounded border-border accent-[var(--mb-brand)] cursor-pointer"
                />
                <Flag className="size-3.5 text-gold" aria-hidden="true" />
                <span>Hanya soal yang ditandai (Flag)</span>
              </label>
            )}
          </div>

          {/* ================= 7. SUMBER / INSTITUSI ================= */}
          {sources.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Database className="size-3.5 text-muted-foreground" />
                  Sumber / Institusi
                </span>
                {filters.sourceId && (
                  <button
                    type="button"
                    onClick={() => onSelectSource(null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Semua
                  </button>
                )}
              </div>
              <div className="flex max-h-24 flex-col gap-1 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => onSelectSource(null)}
                  aria-label="Semua Sumber"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 min-h-[32px] text-left text-xs transition-colors pointer-coarse:min-h-[44px]",
                    !filters.sourceId
                      ? "bg-brand/15 font-medium text-brand"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <span>Semua Sumber</span>
                  {!filters.sourceId && <Check className="size-3.5 shrink-0 text-brand" />}
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
                        "flex w-full items-center justify-between rounded-md px-2.5 min-h-[32px] text-left text-xs transition-colors pointer-coarse:min-h-[44px]",
                        checked
                          ? "bg-brand/15 font-medium text-brand"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{s.label}</span>
                      {checked && <Check className="size-3.5 shrink-0 text-brand" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= 8. BANTUAN LEGENDA SIMBOL (COLLAPSIBLE) ================= */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              className="flex items-center justify-between text-muted-foreground hover:text-foreground text-left py-1"
            >
              <span className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                <HelpCircle className="size-3.5 text-muted-foreground" />
                Legenda Simbol & Ikon
              </span>
              {showLegend ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
            {showLegend && (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
                    <span><strong className="text-foreground font-medium">Topik:</strong> Teks nama</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="size-3.5 shrink-0 text-foreground/80" aria-hidden="true" />
                    <span><strong className="text-foreground font-medium">Jenjang:</strong> Angka/kode</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Brain className="size-3.5 shrink-0 text-foreground/80" aria-hidden="true" />
                    <span><strong className="text-foreground font-medium">Bloom:</strong> Angka 1–6</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Gauge className="size-3.5 shrink-0 text-foreground/80" aria-hidden="true" />
                    <span><strong className="text-foreground font-medium">Kesulitan:</strong> Angka 1–5</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-muted-foreground/60 shrink-0" aria-hidden="true" />
                    <span><strong className="text-foreground font-medium">Siap:</strong> Ikon centang</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FilePenLine className="size-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                    <span><strong className="text-foreground font-medium">Draf:</strong> Ikon draf</span>
                  </div>
                </div>
              </div>
            )}
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
