"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  GripVertical,
  Search,
  X,
  ArrowLeft,
  LayoutList,
  Loader2,
  Plus,
  ListPlus,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  ArrowUpDown,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SlotInspectorDrawer } from "@/components/bundles/slot-inspector-drawer";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { MathContent } from "@/components/math/math-content";
import { cn } from "@/lib/utils";
import {
  useBundle,
  useAddBundleItem,
  useRemoveBundleItem,
  useReorderBundleItems,
  useUpdateBundle,
  type BundleItemView,
} from "@/lib/hooks/use-bundles";
import { useQuestions } from "@/lib/hooks/use-questions";
import { useTopics } from "@/lib/hooks/use-reference";
import { TYPE_LABELS } from "@/lib/display/labels";
import type { QuestionType } from "@/lib/contracts/question";

/** Satu baris item paket dengan Trio-Mode Reorder dan Slot Inspector. */
function SortableRow({
  item,
  index,
  totalItems,
  onRemove,
  onMoveStep,
  onInspect,
  onQuickShift,
}: {
  item: BundleItemView;
  index: number;
  totalItems: number;
  onRemove: (itemId: string, nomor: number) => void;
  onMoveStep: (index: number, direction: -1 | 1) => void;
  onInspect: (item: BundleItemView, ordinal: number) => void;
  onQuickShift: (item: BundleItemView, ordinal: number) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: item.item.id, index });
  const nomor = index + 1;
  const isStimulus = item.item.role === "stimulus";
  const hasKey = Boolean(item.question.answerKey?.correct?.length || item.question.answerKey?.text);

  return (
    <li
      ref={ref}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border bg-card p-2.5 shadow-2xs transition-all",
        isDragging && "opacity-60 ring-2 ring-primary/40",
        isStimulus && "border-info/40 bg-info/5",
      )}
    >
      {/* 1. Drag Handle Desktop */}
      <button
        ref={handleRef}
        type="button"
        aria-label={`Geser urutan butir ${nomor}`}
        className="mt-1 hidden cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing sm:flex"
      >
        <GripVertical className="size-4" />
      </button>

      {/* 2. Tombol Mikro-Langkah Naik/Turun (A11y & Keyboard) */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onMoveStep(index, -1)}
          disabled={index === 0}
          aria-label={`Naikkan soal nomor ${nomor}`}
          title="Naikkan satu nomor"
          className="flex size-6 items-center justify-center rounded border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-25 relative after:absolute after:-top-2.5 after:bottom-0 after:-inset-x-2.5 after:content-['']"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMoveStep(index, 1)}
          disabled={index === totalItems - 1}
          aria-label={`Turunkan soal nomor ${nomor}`}
          title="Turunkan satu nomor"
          className="flex size-6 items-center justify-center rounded border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-25 relative after:absolute after:top-0 after:-bottom-2.5 after:-inset-x-2.5 after:content-['']"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      {/* 3. Badge Nomor Butir (Klik untuk Quick-Shift) */}
      <button
        type="button"
        onClick={() => onQuickShift(item, nomor)}
        title="Klik untuk pindahkan posisi butir secara instan"
        aria-label={`Nomor butir ${item.item.itemNumber || nomor}, klik untuk lompat posisi`}
        className="mt-0.5 min-h-[44px] min-w-[44px] px-2 py-1 rounded-md border border-border/80 bg-muted/60 text-center font-mono text-xs font-semibold tabular-nums text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]"
      >
        {item.item.itemNumber || `${nomor}.`}
      </button>

      {/* 4. Konten Naskah & Metadata Chip */}
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <MathContent
          content={item.question.contentMarkdown}
          noScroll
          className="line-clamp-2 text-sm leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] font-normal">
            {TYPE_LABELS[item.question.questionType] ?? item.question.questionType}
          </Badge>
          {isStimulus && (
            <Badge variant="secondary" className="gap-1 border-info/30 bg-info/10 text-info text-[10px]">
              <BookOpen className="size-3" /> Wacana
            </Badge>
          )}
          {item.item.sectionName && (
            <Badge variant="outline" className="border-border/80 text-[10px] text-muted-foreground">
              {item.item.sectionName}
            </Badge>
          )}
          {item.item.notes && (
            <span className="font-mono text-[10px] text-muted-foreground" title={item.item.notes}>
              (Ada Catatan)
            </span>
          )}
          {!isStimulus && !hasKey && (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600">
              Tanpa Kunci
            </Badge>
          )}
        </div>
      </div>

      {/* 5. Aksi Slot: Inspector Drawer & Hapus */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Pengaturan naskah butir ${nomor}`}
          title="Pengaturan Butir (Nomor, Peran, Seksi, Catatan)"
          onClick={() => onInspect(item, nomor)}
          className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Keluarkan soal nomor ${nomor}`}
          title="Keluarkan dari paket"
          onClick={() => onRemove(item.item.id, nomor)}
          className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
        >
          <X className="size-4" />
        </Button>
      </div>
    </li>
  );
}

/** Daftar item paket dengan Trio-Mode Reorder dan DragDropProvider. */
function BundleItemList({
  items,
  onRemove,
  onReorder,
  onInspect,
  onQuickShift,
  onOpenPicker,
}: {
  items: BundleItemView[];
  onRemove: (itemId: string, nomor: number) => void;
  onReorder: (ids: string[]) => void;
  onInspect: (item: BundleItemView, ordinal: number) => void;
  onQuickShift: (item: BundleItemView, ordinal: number) => void;
  onOpenPicker?: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 p-8 text-center">
        <p className="text-muted-foreground text-sm font-medium">
          Belum ada butir soal dalam naskah ini.
        </p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Pilih dan tambahkan butir dari panel Bank Soal di sebelah kiri (atau klik tombol di bawah pada layar mobile).
        </p>
        {onOpenPicker && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenPicker}
            className="lg:hidden mt-2 gap-1.5 min-h-[44px]"
          >
            <Plus className="size-4" data-icon="inline-start" /> Buka Bank Soal
          </Button>
        )}
      </div>
    );
  }

  function handleMoveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((i) => i.item.id);
    const itemA = ids[index]!;
    const itemB = ids[target]!;
    const next = [...ids];
    next[index] = itemB;
    next[target] = itemA;
    onReorder(next);
  }

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const source = event.operation.source?.id;
        const target = event.operation.target?.id;
        if (!source || !target || source === target) return;
        const ids = items.map((i) => i.item.id);
        const from = ids.indexOf(String(source));
        const to = ids.indexOf(String(target));
        if (from < 0 || to < 0) return;
        const next = [...ids];
        next.splice(to, 0, ...next.splice(from, 1));
        onReorder(next);
      }}
    >
      <ul className="flex flex-col gap-2">
        {items.map((it, idx) => (
          <SortableRow
            key={it.item.id}
            item={it}
            index={idx}
            totalItems={items.length}
            onRemove={onRemove}
            onMoveStep={handleMoveStep}
            onInspect={onInspect}
            onQuickShift={onQuickShift}
          />
        ))}
      </ul>
    </DragDropProvider>
  );
}

/**
 * Penyusun paket — panel bank soal (kiri) + isi paket (kanan).
 *
 * Responsif (best practice shadcn, pola sama dengan `question-bank-view`):
 *  - Desktop (`lg`): dua kolom berdampingan.
 *  - Mobile/tablet: satu kolom; panel bank soal dibuka lewat **Sheet**
 *    (tombol "Tambah Soal"). Kontennya SAMA — hanya chrome berbeda.
 */
export function BundleBuilder() {
  const params = useParams<{ id: string }>();
  const bundleId = params.id;
  const { data: bundle, isPending, isError, error } = useBundle(bundleId);
  const addItem = useAddBundleItem(bundleId, bundle?.version);
  const removeItem = useRemoveBundleItem(bundleId, bundle?.version);
  const reorder = useReorderBundleItems(bundleId, bundle?.version);
  const updateBundle = useUpdateBundle(bundleId, bundle?.version);

  const [q, setQ] = useState("");
  const [topicId, setTopicId] = useState<string>("all");
  const [questionType, setQuestionType] = useState<string>("all");
  const [pickerPage, setPickerPage] = useState<number>(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<{ id: string; nomor: number } | null>(null);

  // Slot Inspector Drawer State
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectSlotItem, setInspectSlotItem] = useState<BundleItemView | null>(null);
  const [inspectSlotOrdinal, setInspectSlotOrdinal] = useState(1);

  // Quick-Shift Popover/Dialog State
  const [quickShiftOpen, setQuickShiftOpen] = useState(false);
  const [quickShiftItem, setQuickShiftItem] = useState<BundleItemView | null>(null);
  const [quickShiftCurrentOrdinal, setQuickShiftCurrentOrdinal] = useState(1);
  const [quickShiftTarget, setQuickShiftTarget] = useState("");

  const PICKER_PAGE_SIZE = 15;

  const { data: topics = [] } = useTopics();

  // MAT-40: pengaturan durasi & petunjuk pengerjaan (editable, auto-save).
  // Pattern: derived state dari bundle + local override untuk editing.
  // Reset saat bundle berubah (id baru) dengan key-based remount pattern.
  const [durationDraft, setDurationDraft] = useState<string>("");
  const [instructionsDraft, setInstructionsDraft] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastBundleId, setLastBundleId] = useState<string | null>(null);

  // Sync draft saat bundle ID berubah (bukan tiap render — hanya saat id ganti)
  if (bundle && bundle.id !== lastBundleId) {
    setLastBundleId(bundle.id);
    setDurationDraft(bundle.durationMinutes ? String(bundle.durationMinutes) : "");
    setInstructionsDraft(bundle.instructions ?? "");
  }

  const { data: results, isPending: searchPending } = useQuestions({
    q: q.trim() || undefined,
    topicId: topicId !== "all" ? [topicId] : undefined,
    questionType: questionType !== "all" ? [questionType as QuestionType] : undefined,
    limit: PICKER_PAGE_SIZE,
    offset: pickerPage * PICKER_PAGE_SIZE,
  });

  const totalQuestions = results?.total ?? 0;
  const totalPickerPages = Math.max(1, Math.ceil(totalQuestions / PICKER_PAGE_SIZE));
  const safePickerPage = Math.min(pickerPage, totalPickerPages - 1);

  const usedIds = new Set((bundle?.items ?? []).map((i) => i.item.questionId));

  if (isPending) return <LoadingState label="Memuat paket…" />;
  if (isError)
    return <ErrorState title="Gagal memuat paket" description={(error as Error).message} />;
  if (!bundle) return null;

  const totalItems = bundle.items.length;
  const stimulusCount = bundle.items.filter((i) => i.item.role === "stimulus").length;
  const scoredCount = totalItems - stimulusCount;
  const missingKeyCount = bundle.items.filter(
    (i) => i.item.role !== "stimulus" && !i.question.answerKey?.correct?.length && !i.question.answerKey?.text,
  ).length;

  /** Simpan pengaturan durasi & petunjuk. */
  function saveSettings() {
    const patch: Record<string, unknown> = {};
    const dur = durationDraft.trim() === "" ? null : parseInt(durationDraft, 10);
    if (dur !== null && (!Number.isFinite(dur) || dur < 1 || dur > 600)) return;
    if (dur !== (bundle!.durationMinutes ?? null)) patch.durationMinutes = dur;
    const instr = instructionsDraft.trim() === "" ? null : instructionsDraft.trim();
    if (instr !== (bundle!.instructions ?? null)) patch.instructions = instr;
    if (Object.keys(patch).length === 0) return;
    updateBundle.mutate(patch, {
      onSuccess: () => toast.success("Pengaturan naskah disimpan."),
      onError: (e) => toast.error("Gagal menyimpan pengaturan", { description: (e as Error).message }),
    });
  }

  /** Pindahkan posisi item secara langsung (Quick-Shift). */
  function executeQuickShift() {
    if (!quickShiftItem || !bundle) return;
    const targetNum = parseInt(quickShiftTarget, 10);
    const total = bundle.items.length;
    if (!Number.isFinite(targetNum) || targetNum < 1 || targetNum > total) {
      toast.error(`Nomor posisi tujuan harus antara 1 sampai ${total}.`);
      return;
    }
    const fromIndex = bundle.items.findIndex((i) => i.item.id === quickShiftItem.item.id);
    if (fromIndex === -1) {
      toast.error("Butir soal tidak ditemukan dalam paket.");
      setQuickShiftOpen(false);
      return;
    }
    const toIndex = targetNum - 1;
    if (fromIndex === toIndex) {
      setQuickShiftOpen(false);
      return;
    }
    const ids = bundle.items.map((i) => i.item.id);
    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved!);
    reorder.mutate(next, {
      onSuccess: () => {
        toast.success(`Soal berhasil dipindahkan ke posisi #${targetNum}.`);
        setQuickShiftOpen(false);
      },
      onError: (e) =>
        toast.error("Gagal memindahkan posisi soal", {
          description: (e as Error).message,
        }),
    });
  }

  /** Panel bank soal — dipakai di desktop (aside) & mobile (Sheet). */
  const pickerContent = (
    <div className="flex flex-col gap-3">
      {/* Kotak Cari Soal */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPickerPage(0);
          }}
          placeholder="Cari kata kunci soal…"
          aria-label="Cari soal untuk paket"
          className="pl-9 pr-8 text-base sm:text-sm"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setPickerPage(0);
            }}
            aria-label="Hapus pencarian"
            className="absolute right-0 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Filter Topik & Tipe Soal */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={topicId}
          onValueChange={(val) => {
            setTopicId(val ?? "all");
            setPickerPage(0);
          }}
        >
          <SelectTrigger className="h-9 min-w-36 flex-1 text-xs">
            <SelectValue placeholder="Semua Topik" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Semua Topik</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={questionType}
          onValueChange={(val) => {
            setQuestionType(val ?? "all");
            setPickerPage(0);
          }}
        >
          <SelectTrigger className="h-9 min-w-32 flex-1 text-xs">
            <SelectValue placeholder="Semua Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {(q !== "" || topicId !== "all" || questionType !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setTopicId("all");
              setQuestionType("all");
              setPickerPage(0);
            }}
            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Indikator Jumlah & Status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {searchPending
            ? "Mencari butir…"
            : `${totalQuestions} butir ditemukan`}
        </span>
        {totalPickerPages > 1 && (
          <span className="font-mono">
            Hal. {safePickerPage + 1}/{totalPickerPages}
          </span>
        )}
      </div>

      {/* Daftar Butir Soal */}
      {searchPending ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuat soal…
        </p>
      ) : (results?.items ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
          Tidak ada soal yang cocok dengan filter.
        </div>
      ) : (
        <ul className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
          {(results?.items ?? []).map((item) => {
            const sudah = usedIds.has(item.id);
            const typeLabel = TYPE_LABELS[item.questionType] ?? item.questionType;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3 shadow-2xs transition-colors",
                  sudah && "bg-muted/30 opacity-60",
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <MathContent
                    content={item.contentMarkdown}
                    noScroll
                    className="line-clamp-2 text-sm leading-relaxed"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {typeLabel}
                    </Badge>
                    {item.grade && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Kelas {item.grade}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={sudah ? "ghost" : "outline"}
                  disabled={sudah || addItem.isPending}
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  onClick={() =>
                    addItem.mutate(
                      { questionId: item.id },
                      {
                        onSuccess: () => toast.success("Soal ditambahkan."),
                        onError: (e) =>
                          toast.error("Gagal menambahkan soal", {
                            description: (e as Error).message,
                          }),
                      },
                    )
                  }
                >
                  {sudah ? (
                    "Ada"
                  ) : (
                    <>
                      <Plus data-icon="inline-start" /> Tambah
                    </>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Paginasi Picker */}
      {!searchPending && totalPickerPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
          <span className="font-mono text-muted-foreground">
            {safePickerPage * PICKER_PAGE_SIZE + 1}-
            {Math.min((safePickerPage + 1) * PICKER_PAGE_SIZE, totalQuestions)} dari {totalQuestions}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={safePickerPage <= 0}
              onClick={() => setPickerPage((p) => Math.max(0, p - 1))}
              className="min-h-[36px]"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft data-icon="inline-start" />
            </Button>
            <span className="px-1.5 font-mono text-xs">
              {safePickerPage + 1}/{totalPickerPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePickerPage + 1 >= totalPickerPages}
              onClick={() => setPickerPage((p) => p + 1)}
              className="min-h-[36px]"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title={bundle.title}
        description={`Susun naskah · ${bundle.items.length} soal`}
        actions={
          <Button variant="outline" render={<Link href="/bundles" />} nativeButton={false}>
            <ArrowLeft data-icon="inline-start" /> Selesai
          </Button>
        }
      />
      <div className="p-4 sm:p-6 max-w-7xl w-full mx-auto flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
        {/* Kiri: bank soal (desktop) */}

        {/* Kiri: pengaturan naskah (durasi & petunjuk) */}
        <Card>
          <CardHeader>
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              className="flex min-h-[44px] items-center justify-between gap-2 text-left"
            >
              <div className="flex items-center gap-2">
                <Clock className="size-4" />
                <div>
                  <CardTitle className="text-base">Pengaturan Naskah</CardTitle>
                  <CardDescription className="text-xs">
                    Durasi ujian & petunjuk pengerjaan
                  </CardDescription>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {settingsOpen ? "Sembunyikan" : "Tampilkan"}
              </span>
            </button>
          </CardHeader>
          {settingsOpen && (
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="b-duration" className="text-sm font-medium">Durasi (menit)</label>
                <Input
                  id="b-duration"
                  type="number"
                  min={1}
                  max={600}
                  value={durationDraft}
                  onChange={(e) => setDurationDraft(e.target.value)}
                  placeholder="mis. 120"
                  className="max-w-32"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="b-instructions" className="text-sm font-medium">Petunjuk Pengerjaan</label>
                <Textarea
                  id="b-instructions"
                  value={instructionsDraft}
                  onChange={(e) => setInstructionsDraft(e.target.value)}
                  placeholder="Petunjuk pengerjaan soal untuk siswa…"
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={saveSettings}
                  disabled={updateBundle.isPending}
                  className="min-h-[44px]"
                >
                  {updateBundle.isPending ? "Menyimpan…" : "Simpan Pengaturan"}
                </Button>
                {updateBundle.isError && (
                  <span className="text-xs text-destructive">
                    {(updateBundle.error as Error).message}
                  </span>
                )}
                {updateBundle.isSuccess && (
                  <span className="text-xs text-success">Tersimpan</span>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Bank soal (desktop) */}
        <Card className="hidden lg:block">
          <CardHeader>
            <CardTitle>Bank Soal</CardTitle>
            <CardDescription>Cari & tambahkan soal ke paket.</CardDescription>
          </CardHeader>
          <CardContent>{pickerContent}</CardContent>
        </Card>

        {/* Sheet pemilih soal (mobile/tablet) */}
        <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader className="mb-2">
              <SheetTitle className="text-base">Tambah Soal</SheetTitle>
            </SheetHeader>
            {pickerContent}
          </SheetContent>
        </Sheet>

        {/* Kanan: isi paket */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1.5">
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <LayoutList className="size-4" /> Isi Paket ({totalItems})
                </span>
              </CardTitle>
              <CardDescription>
                Trio-Mode: geser kartu (desktop), tombol naik/turun, atau klik nomor untuk pindah instan.
              </CardDescription>

              {/* Indikator Kelengkapan Mutu Pedagogis Naskah */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge variant="outline" className="font-mono text-[11px]">
                  {scoredCount} Soal Bernomor
                </Badge>
                {stimulusCount > 0 && (
                  <Badge variant="secondary" className="gap-1 border-info/30 bg-info/10 text-info text-[11px]">
                    <BookOpen className="size-3" /> {stimulusCount} Wacana
                  </Badge>
                )}
                {missingKeyCount > 0 ? (
                  <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 text-[11px]">
                    <AlertTriangle className="size-3" /> {missingKeyCount} Tanpa Kunci
                  </Badge>
                ) : totalItems > 0 ? (
                  <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-success text-[11px]">
                    <CheckCircle2 className="size-3" /> Kunci Lengkap
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="lg:hidden"
              onClick={() => setPickerOpen(true)}
            >
              <Plus data-icon="inline-start" /> Tambah Soal
            </Button>
            <BundleItemList
              items={bundle.items}
              onRemove={(id, nomor) => {
                setConfirmRemoveItem({ id, nomor });
                setIsRemoveOpen(true);
              }}
              onReorder={(ids) =>
                reorder.mutate(ids, {
                  onError: (e) =>
                    toast.error("Gagal menyusun urutan soal", {
                      description: (e as Error).message,
                    }),
                })
              }
              onInspect={(item, ordinal) => {
                setInspectSlotItem(item);
                setInspectSlotOrdinal(ordinal);
                setInspectorOpen(true);
              }}
              onQuickShift={(item, ordinal) => {
                setQuickShiftItem(item);
                setQuickShiftCurrentOrdinal(ordinal);
                setQuickShiftTarget(String(ordinal));
                setQuickShiftOpen(true);
              }}
              onOpenPicker={() => setPickerOpen(true)}
            />
          </CardContent>
        </Card>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
        <ListPlus className="size-3.5" />
        Di layar kecil: buka &ldquo;Tambah Soal&rdquo; untuk memilih soal.
      </p>
    </div>

      {/* Dialog Konfirmasi Hapus Item */}
      <Dialog
        open={isRemoveOpen}
        onOpenChange={(open) => {
          if (!removeItem.isPending) setIsRemoveOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keluarkan soal nomor {confirmRemoveItem?.nomor}?</DialogTitle>
            <DialogDescription>
              Soal akan dikeluarkan dari susunan paket ujian ini (soal tidak terhapus dari bank soal).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={removeItem.isPending}
              onClick={() => setIsRemoveOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={removeItem.isPending || !confirmRemoveItem}
              onClick={() => {
                if (confirmRemoveItem) {
                  removeItem.mutate(confirmRemoveItem.id, {
                    onSuccess: () => {
                      setIsRemoveOpen(false);
                      setConfirmRemoveItem(null);
                      toast.success("Soal dikeluarkan dari paket.");
                    },
                    onError: (e) =>
                      toast.error("Gagal mengeluarkan soal", {
                        description: (e as Error).message,
                      }),
                  });
                }
              }}
            >
              Keluarkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Quick-Shift: Pindah Posisi Soal Instan (Mobile / Touch Friendly) */}
      <Dialog open={quickShiftOpen} onOpenChange={setQuickShiftOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ArrowUpDown className="size-4" />
              <span>Pindah Posisi Soal</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pindahkan butir soal #{quickShiftCurrentOrdinal} langsung ke nomor posisi tujuan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <label htmlFor="quick-shift-target" className="text-xs font-medium text-muted-foreground">
              Nomor Posisi Tujuan (1 - {bundle.items.length}):
            </label>
            <Input
              id="quick-shift-target"
              type="number"
              min={1}
              max={bundle.items.length}
              value={quickShiftTarget}
              onChange={(e) => setQuickShiftTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  executeQuickShift();
                }
              }}
              className="min-h-[44px] text-center font-mono text-base"
            />
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setQuickShiftOpen(false)}
              className="flex-1 sm:flex-initial"
            >
              Batal
            </Button>
            <Button
              onClick={executeQuickShift}
              disabled={reorder.isPending}
              className="flex-1 sm:flex-initial"
            >
              {reorder.isPending ? "Memindah…" : "Pindahkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawer Slot Inspector: Edit itemNumber, role, sectionName, notes */}
      <SlotInspectorDrawer
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        bundleId={bundle.id}
        bundleVersion={bundle.version}
        slotItem={inspectSlotItem}
        slotOrdinal={inspectSlotOrdinal}
      />
    </>
  );
}
