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
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

/** Satu baris item paket yang dapat diseret (dnd-kit useSortable). */
function SortableRow({
  item,
  index,
  onRemove,
}: {
  item: BundleItemView;
  index: number;
  onRemove: (itemId: string, nomor: number) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: item.item.id, index });
  const nomor = index + 1;

  return (
    <li
      ref={ref}
      className={`flex items-start gap-3 rounded-md border bg-card px-3 py-2 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={`Geser soal nomor ${nomor}`}
        className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="mt-0.5 w-6 shrink-0 text-right text-sm font-medium tabular-nums text-muted-foreground">
        {nomor}.
      </span>
      <div className="min-w-0 flex-1">
        <MathContent
          content={item.question.contentMarkdown}
          noScroll
          className="truncate text-sm"
        />
        <div className="mt-1 flex gap-1">
          <Badge variant="outline" className="text-[10px]">
            {item.question.questionType}
          </Badge>
          {item.item.role === "stimulus" && (
            <Badge variant="secondary" className="text-[10px]">
              Stimulus
            </Badge>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Keluarkan soal nomor ${nomor}`}
        onClick={() => onRemove(item.item.id, nomor)}
      >
        <X />
      </Button>
    </li>
  );
}

/** Daftar item paket dengan drag-and-drop. */
function BundleItemList({
  items,
  onRemove,
  onReorder,
}: {
  items: BundleItemView[];
  onRemove: (itemId: string, nomor: number) => void;
  onReorder: (ids: string[]) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada soal. Tambahkan dari bank soal di sebelah kiri.
      </p>
    );
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
          <SortableRow key={it.item.id} item={it} index={idx} onRemove={onRemove} />
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
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <LayoutList className="size-4" /> Isi Paket
              </span>
            </CardTitle>
            <CardDescription>
              Geser untuk mengurutkan. Stimulus ditampilkan sekali.
            </CardDescription>
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
            />
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
        <ListPlus className="size-3.5" />
        Di layar kecil: buka &ldquo;Tambah Soal&rdquo; untuk memilih soal.
      </p>

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
    </>
  );
}
