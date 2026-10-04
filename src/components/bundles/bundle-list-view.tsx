"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Copy,
  Archive,
  NotebookPen,
  Search,
  Package,
  GraduationCap,
  BookOpen,
  Layers,
  Clock,
  ArrowUpRight,
  Printer,
  X,
  LayoutGrid,
  List,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useBundles,
  useCreateBundle,
  useArchiveBundle,
  useDuplicateBundle,
} from "@/lib/hooks/use-bundles";
import type { BundleRow, BundleType } from "@/lib/services/bundle-service";

const TYPE_LABELS: Record<BundleType, string> = {
  source: "Sumber",
  exam: "Ujian",
};

const STATUS_LABELS: Record<BundleRow["status"], string> = {
  draft: "Draf",
  review: "Telaah",
  ready: "Siap",
  archived: "Arsip",
};

function statusBadgeClass(status: BundleRow["status"]): string {
  switch (status) {
    case "ready":
      return "border-success/30 bg-success/10 text-success";
    case "review":
      return "border-gold/30 bg-gold/10 text-gold";
    case "draft":
      return "border-border bg-muted/60 text-muted-foreground";
    case "archived":
      return "border-border/60 bg-muted/30 text-muted-foreground/70";
    default:
      return "";
  }
}

export function BundleListView() {
  const { data, isPending, isError, error } = useBundles();
  const create = useCreateBundle();
  const archive = useArchiveBundle();
  const duplicate = useDuplicateBundle();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<BundleType>("exam");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<BundleRow | null>(null);

  // Filter & tampilan
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | BundleType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | BundleRow["status"]>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  function submit() {
    setFormErr(null);
    create.mutate(
      { title: title.trim(), bundleType: type },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
        },
        onError: (e) => setFormErr((e as Error).message),
      },
    );
  }

  // Statistik ringkas
  const totalBundles = data?.length ?? 0;
  const examCount = data?.filter((b) => b.bundleType === "exam").length ?? 0;
  const sourceCount = data?.filter((b) => b.bundleType === "source").length ?? 0;
  const totalItems = data?.reduce((acc, b) => acc + (b.itemCount ?? 0), 0) ?? 0;

  // Filter data (dihitung langsung tanpa useMemo sesuai CONSTRAINTS #6)
  const filtered = (data ?? []).filter((b) => {
    if (typeFilter !== "all" && b.bundleType !== typeFilter) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = b.title.toLowerCase().includes(q);
      const matchYear = b.year ? String(b.year).includes(q) : false;
      if (!matchTitle && !matchYear) return false;
    }
    return true;
  });

  const hasFilterActive = search.trim() !== "" || typeFilter !== "all" || statusFilter !== "all";

  return (
    <>
      <PageHeader
        title="Paket Soal"
        description="Susun naskah ujian, latihan, atau sumber dari bank soal."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="size-4" data-icon="inline-start" /> Paket Baru
          </Button>
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {/* STATISTIK RINGKAS */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-2xs">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Package className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold tracking-tight tabular-nums">{totalBundles}</div>
              <div className="text-xs text-muted-foreground truncate">Total Paket</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-2xs">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <GraduationCap className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold tracking-tight tabular-nums">{examCount}</div>
              <div className="text-xs text-muted-foreground truncate">Naskah Ujian</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-2xs">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <BookOpen className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold tracking-tight tabular-nums">{sourceCount}</div>
              <div className="text-xs text-muted-foreground truncate">Bank Sumber</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-2xs">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Layers className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold tracking-tight tabular-nums">{totalItems}</div>
              <div className="text-xs text-muted-foreground truncate">Butir Terhimpun</div>
            </div>
          </div>
        </div>

        {/* TOOLBAR PENCARIAN & FILTER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Input Cari */}
            <div className="relative min-w-48 max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul naskah/tahun…"
                aria-label="Cari naskah"
                className="h-9 pl-8.5 pr-8 text-sm bg-muted/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Hapus kata kunci"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Jenis Paket */}
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/20">
              {(
                [
                  { id: "all", label: "Semua" },
                  { id: "exam", label: "Ujian" },
                  { id: "source", label: "Sumber" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    typeFilter === tab.id
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filter Status */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | BundleRow["status"])}
            >
              <SelectTrigger className="h-9 min-w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="draft">Draf</SelectItem>
                  <SelectItem value="review">Telaah</SelectItem>
                  <SelectItem value="ready">Siap</SelectItem>
                  <SelectItem value="archived">Arsip</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {/* Tombol Reset Filter jika aktif */}
            {hasFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>

          {/* Toggle Mode Tampilan (Grid / List) */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-mono text-muted-foreground">
              {filtered.length} dari {totalBundles} paket
            </span>
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/20">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Tampilan Kisi Kartu"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Tampilan Tabel Rinci"
                onClick={() => setViewMode("list")}
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* KONTEN UTAMA */}
        {isPending ? (
          <LoadingState label="Memuat naskah paket…" />
        ) : isError ? (
          <ErrorState title="Gagal memuat paket" description={(error as Error).message} />
        ) : data.length === 0 ? (
          <EmptyState
            title="Belum ada paket soal"
            description="Buat naskah ujian atau paket latihan baru untuk mulai mengelompokkan butir soal."
            action={
              <Button onClick={() => setOpen(true)} className="mt-2">
                <Plus data-icon="inline-start" /> Buat Paket Pertama
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Tidak ada paket yang cocok"
            description="Coba ubah kata kunci pencarian atau sesuaikan filter yang sedang aktif."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
                className="mt-2"
              >
                Reset Semua Filter
              </Button>
            }
          />
        ) : viewMode === "grid" ? (
          /* ================= TAMPILAN GRID KARTU NASKAH (BENTO) ================= */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <article
                key={b.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-4 transition-all duration-150 hover:border-border hover:bg-card hover:shadow-xs dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <div className="flex flex-col gap-3">
                  {/* Top Bar Kartu: Chip Jenis & Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      {b.bundleType === "exam" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                          <GraduationCap className="size-3" /> Ujian
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <BookOpen className="size-3" /> Sumber
                        </span>
                      )}
                      {b.year && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {b.year}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-[11px] font-normal", statusBadgeClass(b.status))}
                    >
                      {STATUS_LABELS[b.status]}
                    </Badge>
                  </div>

                  {/* Judul Paket */}
                  <Link
                    href={`/bundles/${b.id}`}
                    className="font-semibold text-sm leading-snug group-hover:text-brand transition-colors line-clamp-2"
                  >
                    {b.title}
                  </Link>

                  {/* Metrik Jumlah Soal & Durasi */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular-nums font-mono">
                      <Layers className="size-3.5 text-muted-foreground/80" />
                      <strong className="text-foreground">{b.itemCount}</strong> butir
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums font-mono">
                      <Clock className="size-3.5 text-muted-foreground/80" />
                      {b.durationMinutes ? `${b.durationMinutes} mnt` : "Tanpa batas"}
                    </span>
                  </div>
                </div>

                {/* Footer Kartu & Aksi Cepat */}
                <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-2.5">
                  <Link
                    href={`/bundles/${b.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                  >
                    Buka Naskah <ArrowUpRight className="size-3.5" />
                  </Link>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Cetak ${b.title}`}
                      render={<Link href={`/bundles/${b.id}/print`} />}
                      nativeButton={false}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Printer className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Duplikat ${b.title}`}
                      onClick={() => duplicate.mutate(b.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Arsipkan ${b.title}`}
                      onClick={() => setConfirm(b)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Archive className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* ================= TAMPILAN LIST TABEL ================= */
          <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/60 shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Judul Naskah</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="hidden sm:table-cell">Tahun</TableHead>
                  <TableHead className="text-right">Soal</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Durasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium whitespace-normal min-w-[200px] max-w-sm">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/bundles/${b.id}`}
                          className="hover:underline font-semibold text-foreground/90 group-hover:text-brand line-clamp-2"
                        >
                          {b.title}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground sm:hidden">
                          {b.year && <span>Tahun {b.year}</span>}
                          {b.durationMinutes ? <span>{b.durationMinutes} mnt</span> : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal text-xs">
                        {TYPE_LABELS[b.bundleType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">
                      {b.year ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono font-medium">
                      {b.itemCount}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums font-mono">
                      {b.durationMinutes ? `${b.durationMinutes} mnt` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-normal", statusBadgeClass(b.status))}
                      >
                        {STATUS_LABELS[b.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Cetak ${b.title}`}
                          render={<Link href={`/bundles/${b.id}/print`} />}
                          nativeButton={false}
                          className="min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-[32px] text-muted-foreground hover:text-foreground"
                        >
                          <Printer className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Duplikat ${b.title}`}
                          className="min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-[32px] text-muted-foreground hover:text-foreground"
                          onClick={() => duplicate.mutate(b.id)}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Arsipkan ${b.title}`}
                          className="min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-[32px] text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirm(b)}
                        >
                          <Archive className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* DIALOG PAKET BARU */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paket Baru</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="b-title" className="text-sm font-medium">
                Judul Naskah
              </label>
              <Input
                id="b-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="mis. Penilaian Akhir Semester Matematika Peminatan X"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="b-type" className="text-sm font-medium">
                Jenis Paket
              </label>
              <Select value={type} onValueChange={(v) => setType(v as BundleType)}>
                <SelectTrigger id="b-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.keys(TYPE_LABELS) as BundleType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {formErr && <p className="text-destructive text-sm">{formErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={submit} disabled={create.isPending || title.trim() === ""}>
              <NotebookPen data-icon="inline-start" />
              {create.isPending ? "Membuat…" : "Buat Paket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG KONFIRMASI ARSIP */}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arsipkan paket naskah?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            &ldquo;{confirm?.title}&rdquo; akan diarsipkan. Paket dapat dipulihkan kapan saja
            dari arsip.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm) return;
                archive.mutate(confirm.id, {
                  onSuccess: () => setConfirm(null),
                  onError: (e) => setFormErr((e as Error).message),
                });
              }}
            >
              Arsipkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
