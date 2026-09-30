"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, Search, X, ArrowLeft, LayoutList, Loader2, Plus, ListPlus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  useBundle,
  useAddBundleItem,
  useRemoveBundleItem,
  useReorderBundleItems,
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
  onRemove: (itemId: string) => void;
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
        <p className="truncate text-sm">{item.question.contentMarkdown}</p>
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
        onClick={() => onRemove(item.item.id)}
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
  onRemove: (itemId: string) => void;
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
 * Responsif (best practice shadcn, pola sama dengan `bank-soal-view`):
 *  - Desktop (`lg`): dua kolom berdampingan.
 *  - Mobile/tablet: satu kolom; panel bank soal dibuka lewat **Sheet**
 *    (tombol "Tambah Soal"). Kontennya SAMA — hanya chrome berbeda.
 */
export function BundleBuilder() {
  const params = useParams<{ id: string }>();
  const bundleId = params.id;
  const { data: bundle, isPending, isError, error } = useBundle(bundleId);
  const addItem = useAddBundleItem(bundleId);
  const removeItem = useRemoveBundleItem(bundleId);
  const reorder = useReorderBundleItems(bundleId);

  const [q, setQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: results, isPending: searchPending } = useQuestions({
    q: q.trim() || undefined,
    limit: 20,
  });

  const usedIds = new Set((bundle?.items ?? []).map((i) => i.item.questionId));

  if (isPending) return <LoadingState label="Memuat paket…" />;
  if (isError)
    return <ErrorState title="Gagal memuat paket" description={(error as Error).message} />;
  if (!bundle) return null;

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
                <span className="min-w-0 flex-1 truncate text-sm">
                  {item.contentMarkdown}
                </span>
                <Button
                  size="sm"
                  variant={sudah ? "ghost" : "outline"}
                  disabled={sudah || addItem.isPending}
                  onClick={() => addItem.mutate({ questionId: item.id })}
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
              onRemove={(id) => removeItem.mutate(id)}
              onReorder={(ids) => reorder.mutate(ids)}
            />
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
        <ListPlus className="size-3.5" />
        Di layar kecil: buka &ldquo;Tambah Soal&rdquo; untuk memilih soal.
      </p>
    </>
  );
}
