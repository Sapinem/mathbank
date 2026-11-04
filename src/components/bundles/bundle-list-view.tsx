"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
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
import { ListWorkbenchPagination } from "@/components/ui/list-workbench-pagination";
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
import { STATUS_SHORT_LABELS as STATUS_LABELS } from "@/lib/display/labels";
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
import {
  BundleEnrichmentSummary,
  DifficultyAverageChip,
  TopicCoverageChip,
} from "@/components/bundles/bundle-enrichment";
import { cn } from "@/lib/utils";
import { useDebouncedSearchParam } from "@/lib/hooks/use-debounced-search-param";
import { StatusIcon } from "@/components/questions/question-status-badge";
import {
  useBundlesPage,
  useCreateBundle,
  useArchiveBundle,
  useDuplicateBundle,
} from "@/lib/hooks/use-bundles";
import type { BundleRow, BundleType, BundleOrigin } from "@/lib/services/bundle-service";

const TYPE_LABELS: Record<BundleType, string> = {
  source: "Sumber",
  exam: "Ujian",
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

/**
 * Tab jenis paket — sinkron dengan URL `?type=`.
 * MAT-40: sub-tab instan antara "Bank Sumber" dan "Naskah Ujian".
 */
const TYPE_TABS: { id: "all" | BundleType; label: string; param: string }[] = [
  { id: "all", label: "Semua", param: "" },
  { id: "exam", label: "Naskah Ujian", param: "exam" },
  { id: "source", label: "Bank Sumber", param: "source" },
];

/**
 * Tab asal paket — sinkron dengan URL `?origin=`.
 */
const ORIGIN_TABS: { id: "all" | BundleOrigin; label: string; param: string }[] = [
  { id: "all", label: "Semua Asal", param: "" },
  { id: "manual", label: "Manual", param: "manual" },
  { id: "ingest", label: "Ingest", param: "ingest" },
];

export function BundleListView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL-driven filter, search, & pagination state (Single Source of Truth) ──
  const typeParam = searchParams.get("type") as BundleType | null;
  const originParam = searchParams.get("origin") as BundleOrigin | null;
  const statusParam = searchParams.get("status") as BundleRow["status"] | null;
  const qParam = searchParams.get("q") ?? "";
  const modeParam = (searchParams.get("mode") as "grid" | "list") ?? "grid";
  const pageParam = Number(searchParams.get("page") ?? "0");
  const limitParam = Number(searchParams.get("limit") ?? "20");

  const typeFilter: "all" | BundleType =
    typeParam === "exam" || typeParam === "source" ? typeParam : "all";
  const originFilter: "all" | BundleOrigin =
    originParam === "ingest" || originParam === "manual" ? originParam : "all";
  const statusFilter: "all" | BundleRow["status"] =
    statusParam && ["draft", "review", "ready", "archived"].includes(statusParam)
      ? statusParam
      : "all";
  const viewMode: "grid" | "list" = modeParam === "list" ? "list" : "grid";
  const pageSize = [20, 50, 100].includes(limitParam) ? limitParam : 20;
  const page = Number.isInteger(pageParam) && pageParam >= 0 ? pageParam : 0;

  // Local state untuk input search yang ter-debounce 300 ms ke URL
  const [search, setSearch] = useDebouncedSearchParam("/bundles", "q", 300);

  /** Helper untuk memperbarui satu parameter URL */
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`/bundles${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  }

  /** Reset seluruh filter dan pencarian */
  function resetAllFilters() {
    setSearch("");
    router.replace("/bundles", { scroll: false });
  }

  /**
   * ACT-04 — SATU request HTTP per halaman.
   *
   * Filter (jenis/asal/status/cari) + `limit` + `offset` dikirim ke server.
   * Statistik ikut di amplop (`stats`) sehingga kartu ringkas tetap akurat tanpa request tambahan.
   */
  const { data: pageData, isPending, isError, error } = useBundlesPage({
    bundleType: typeFilter !== "all" ? typeFilter : undefined,
    origin: originFilter !== "all" ? originFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    q: qParam || undefined,
    limit: pageSize,
    offset: page * pageSize,
  });
  const data: BundleRow[] = pageData?.items ?? [];
  /** Total paket cocok filter menurut API (seluruh halaman). */
  const total = pageData?.total ?? 0;
  const stats = pageData?.stats;
  const create = useCreateBundle();
  const archive = useArchiveBundle();
  const duplicate = useDuplicateBundle();

  // Dialog & local-only state
  const [open, setOpen] = useState(searchParams.get("new") === "true");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<BundleType>(typeFilter !== "all" ? typeFilter : "exam");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<BundleRow | null>(null);

  /** Push filter ke URL (single source of truth untuk type/origin). */
  function updateUrl(next: { type?: "all" | BundleType; origin?: "all" | BundleOrigin }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextType = next.type ?? typeFilter;
    const nextOrigin = next.origin ?? originFilter;
    if (nextType === "all") params.delete("type");
    else params.set("type", nextType);
    if (nextOrigin === "all") params.delete("origin");
    else params.set("origin", nextOrigin);
    params.delete("page");
    const qs = params.toString();
    router.replace(`/bundles${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function submit() {
    setFormErr(null);
    create.mutate(
      { title: title.trim(), bundleType: type },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          toast.success("Paket baru dibuat.");
        },
        onError: (e) => {
          const message = (e as Error).message;
          setFormErr(message);
          toast.error("Gagal membuat paket", { description: message });
        },
      },
    );
  }

  /** Duplikat paket dengan umpan balik toast (MAJ — pasca-mutasi). */
  function duplicateBundle(id: string, title: string) {
    duplicate.mutate(id, {
      onSuccess: () => toast.success(`Paket "${title}" diduplikat.`),
      onError: (e) => toast.error("Gagal menduplikat paket", { description: (e as Error).message }),
    });
  }

  // Statistik ringkas — dari `stats` server (seluruh paket cocok filter,
  // bukan hanya 20 baris halaman ini).
  const totalBundles = total;
  const examCount = stats?.byType.exam ?? 0;
  const sourceCount = stats?.byType.source ?? 0;
  const totalItems = stats?.totalItems ?? 0;

  // Paginasi server-side: halaman ini sudah berisi maksimal `pageSize`
  // baris, jadi tak ada lagi `filter`/`slice` di klien.
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  // Jaring aman tanpa efek: bila halaman ini kosong padahal ada hasil (mis.
  // data menyusut di tab lain), UI menawarkan kembali ke halaman pertama —
  // lihat cabang `total > 0 && data.length === 0` di bawah.

  const hasFilterActive =
    qParam !== "" || statusFilter !== "all" || typeFilter !== "all" || originFilter !== "all";

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

        {/* TAB UTAMA & TOOLBAR FILTER */}
        <div className="flex flex-col gap-3">
          {/* Baris Tab Jenis Paket & Toggle Tampilan */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/20">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => updateUrl({ type: tab.id })}
                  aria-pressed={typeFilter === tab.id}
                  className={cn(
                    "min-h-[44px] rounded-md px-3.5 py-1 text-xs font-medium motion-safe:transition-colors",
                    typeFilter === tab.id
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Toggle Mode Tampilan (Grid / List) & Indikator Halaman */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-mono text-muted-foreground">
                {data.length} dari {totalBundles} paket
                {totalPages > 1 && (
                  <>
                    {" · "}
                    <span className="text-foreground/80">
                      hal. {safePage + 1}/{totalPages}
                    </span>
                  </>
                )}
              </span>
              <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/20">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Tampilan Kisi Kartu"
                  onClick={() => setParam("mode", "grid")}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <LayoutGrid className="size-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Tampilan Tabel Rinci"
                  onClick={() => setParam("mode", "list")}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <List className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Toolbar Pencarian, Status, dan Asal Paket */}
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
                  onClick={() => {
                    setSearch("");
                    setParam("q", null);
                  }}
                  aria-label="Hapus kata kunci"
                  className="absolute right-0 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Status */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setParam("status", v === "all" ? null : v)}
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

            {/* Filter Asal Paket */}
            <Select
              value={originFilter}
              onValueChange={(v) => updateUrl({ origin: v as "all" | BundleOrigin })}
            >
              <SelectTrigger className="h-9 min-w-28 text-xs">
                <SelectValue placeholder="Asal Paket" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ORIGIN_TABS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {/* Tombol Reset Filter jika aktif */}
            {hasFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAllFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset Filter
              </Button>
            )}
          </div>
        </div>

        {/* KONTEN UTAMA */}
        {isPending ? (
          <LoadingState label="Memuat naskah paket…" />
        ) : isError ? (
          <ErrorState title="Gagal memuat paket" description={(error as Error).message} />
        ) : total === 0 && hasFilterActive ? (
          <EmptyState
            title="Tidak ada paket yang cocok"
            description="Coba ubah kata kunci pencarian atau sesuaikan filter yang sedang aktif."
            action={
              <Button
                variant="outline"
                onClick={resetAllFilters}
                className="mt-2"
              >
                Reset Semua Filter
              </Button>
            }
          />
        ) : total === 0 ? (
          <EmptyState
            title="Belum ada paket soal"
            description="Buat naskah ujian atau paket latihan baru untuk mulai mengelompokkan butir soal."
            action={
              <Button onClick={() => setOpen(true)} className="mt-2">
                <Plus data-icon="inline-start" /> Buat Paket Pertama
              </Button>
            }
          />
        ) : data.length === 0 ? (
          <EmptyState
            title="Halaman ini kosong"
            description={`Hanya tersedia ${totalPages} halaman untuk filter saat ini.`}
            action={
              <Button variant="outline" onClick={() => setParam("page", null)} className="mt-2">
                Ke Halaman Pertama
              </Button>
            }
          />
        ) : viewMode === "grid" ? (
          /* ================= TAMPILAN GRID KARTU NASKAH (BENTO) ================= */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((b) => (
              <article
                key={b.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-4 motion-safe:transition-all motion-safe:duration-150 hover:border-border hover:bg-card hover:shadow-xs dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
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
                      {b.origin === "ingest" && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Ingest
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
                      <StatusIcon status={b.status} data-icon="inline-start" aria-hidden="true" />
                      {STATUS_LABELS[b.status]}
                    </Badge>
                  </div>

                  {/* Judul Paket */}
                  <Link
                    href={`/bundles/${b.id}`}
                    className="font-semibold text-sm leading-snug group-hover:text-brand motion-safe:transition-colors line-clamp-2"
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

                  {/* Statistik pengayaan (MAT-127): rerata kesulitan & cakupan topik */}
                  <BundleEnrichmentSummary
                    enrichment={b.enrichment}
                    compact
                    className="border-t border-border/30 pt-2"
                  />
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
                      size="icon-sm"
                      aria-label={`Cetak ${b.title}`}
                      render={<Link href={`/bundles/${b.id}/print`} />}
                      nativeButton={false}
                      className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
                    >
                      <Printer className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Duplikat ${b.title}`}
                      onClick={() => duplicateBundle(b.id, b.title)}
                      className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Arsipkan ${b.title}`}
                      onClick={() => setConfirm(b)}
                      className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
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
                  <TableHead className="hidden sm:table-cell">Asal</TableHead>
                  <TableHead className="hidden sm:table-cell">Tahun</TableHead>
                  <TableHead className="text-right">Soal</TableHead>
                  <TableHead className="hidden md:table-cell text-right">
                    Rerata Kesulitan
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Cakupan Topik</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Durasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((b) => (
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
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                      {b.origin === "ingest" ? "Ingest" : "Manual"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">
                      {b.year ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono font-medium">
                      {b.itemCount}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      {b.enrichment && b.enrichment.questionCount > 0 ? (
                        <DifficultyAverageChip avg={b.enrichment.avgDifficulty} />
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {b.enrichment && b.enrichment.questionCount > 0 ? (
                        <TopicCoverageChip
                          topicCount={b.enrichment.topicCount}
                          coverage={b.enrichment.topicCoverage}
                        />
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums font-mono">
                      {b.durationMinutes ? `${b.durationMinutes} mnt` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-normal", statusBadgeClass(b.status))}
                      >
                        <StatusIcon status={b.status} data-icon="inline-start" aria-hidden="true" />
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
                          className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
                        >
                          <Printer className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Duplikat ${b.title}`}
                          className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
                          onClick={() => duplicateBundle(b.id, b.title)}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Arsipkan ${b.title}`}
                          className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
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

        {/* PAGINASI TERPADU (Model Workbench) */}
        {!isPending && !isError && (
          <ListWorkbenchPagination
            page={page}
            pageSize={pageSize}
            total={total}
            itemLabel="paket"
            onPageChange={(newPage) => setParam("page", newPage === 0 ? null : String(newPage))}
            onPageSizeChange={(newSize) => setParam("limit", newSize === 20 ? null : String(newSize))}
            className="rounded-xl border border-border/70"
          />
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
                archive.mutate(
                  { id: confirm.id, version: confirm.version },
                  {
                  onSuccess: () => {
                    setConfirm(null);
                    toast.success("Paket diarsipkan.");
                  },
                  onError: (e) => {
                    const message = (e as Error).message;
                    setFormErr(message);
                    toast.error("Gagal mengarsipkan paket", { description: message });
                  },
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
