"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, Search, X, ArrowLeft, LayoutList, Loader2, Plus, ListPlus, Clock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  useBundle,
  useAddBundleItem,
  useRemoveBundleItem,
  useReorderBundleItems,
  useUpdateBundle,
  type BundleItemView,
} from "@/lib/hooks/use-bundles";
import { useQuestions } from "@/lib/hooks/use-questions";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<{ id: string; nomor: number } | null>(null);

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
    limit: 20,
  });

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
    if (dur !== (bundle!.durationMinutes ?? null)) patch.durationMinutes = dur ?? undefined;
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
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari soal…"
          aria-label="Cari soal untuk paket"
          className="pl-9 text-base sm:text-sm"
        />
      </div>
      {searchPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Mencari…
        </p>
      ) : (results?.items ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">Tak ada soal cocok.</p>
      ) : (
        <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
          {(results?.items ?? []).map((item) => {
            const sudah = usedIds.has(item.id);
            return (
              <li key={item.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <MathContent
                  content={item.contentMarkdown}
                  noScroll
                  className="min-w-0 flex-1 truncate text-sm"
                />
                <Button
                  size="sm"
                  variant={sudah ? "ghost" : "outline"}
                  disabled={sudah || addItem.isPending}
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
                  {sudah ? "Ada" : "Tambah"}
                </Button>
              </li>
            );
          })}
        </ul>
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
