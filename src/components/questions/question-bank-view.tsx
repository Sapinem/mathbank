"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  X,
  Layers,
  CheckCircle2,
  FilePenLine,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ListWorkbenchPagination } from "@/components/ui/list-workbench-pagination";
import { QuestionCard } from "@/components/questions/question-card";
import { modeClass, type ViewMode } from "@/components/questions/view-mode-toggle";
import { QuestionFilterDrawer } from "@/components/questions/question-filter-drawer";
import { QuestionFilterBar } from "@/components/questions/question-filter-bar";
import { ErrorState, EmptyState } from "@/components/ui/states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuestions, useBulkQuestionAction, type BulkAction } from "@/lib/hooks/use-questions";
import { useTopics, useSources, useGrades, useTags } from "@/lib/hooks/use-reference";
import type { ListQuestionsQuery } from "@/lib/contracts/question";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 20;

/** Baca daftar nilai dari URL (tunggal maupun banyak, dukung CSV). */
function readList(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);
}

/**
 * MAJ — Skeleton loader daftar soal (menekan CLS).
 *
 * Tinggi tiap baris disamakan dengan `QuestionCard` mode list (`h-11`) agar
 * transisi skeleton → konten nyata tidak menggeser tata letak (zero layout
 * shift). Untuk mode grid/masonry dipakai kartu setinggi `min-h-[300px]`.
 */
function QuestionListSkeleton({ mode }: { mode: ViewMode }) {
  if (mode === "grid" || mode === "masonry") {
    return (
      <div className={modeClass(mode)} aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[300px] flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-4"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
            <div className="mt-auto flex flex-col gap-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      className="m-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card/40 sm:m-4"
      aria-hidden="true"
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex h-11 items-center gap-2.5 px-3">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-28 hidden sm:block" />
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8 hidden md:block" />
          <Skeleton className="h-4 w-10 hidden md:block" />
          <Skeleton className="size-2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Halaman Bank Soal — daftar, filter slide-over drawer, compound filter bar, 3 view modes (G1). */
export function QuestionBankView({
  defaultFiltersOpen = false,
}: {
  defaultFiltersOpen?: boolean;
} = {}) {
  const router = useRouter();
  const params = useSearchParams();

  // Filter dari URL (bookmarkable)
  const questionType = readList(params, "questionType") as NonNullable<
    ListQuestionsQuery["questionType"]
  >;
  const grade = readList(params, "grade");
  const difficulty = readList(params, "difficulty")
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  const topicId = readList(params, "topicId");
  const tagId = params.get("tagId") ?? undefined;
  const status = (params.get("status") as ListQuestionsQuery["status"]) ?? undefined;
  const cognitiveLevel = (params.get("cognitiveLevel") as ListQuestionsQuery["cognitiveLevel"]) ?? undefined;
  const sourceId = params.get("sourceId") ?? undefined;
  const flagged = params.get("flagged") === "true" ? true : undefined;
  const q = params.get("q") ?? undefined;
  const limitParam = Number(params.get("limit") ?? String(DEFAULT_PAGE_SIZE));
  const pageSize = [20, 50, 100].includes(limitParam) ? limitParam : DEFAULT_PAGE_SIZE;
  const page = Number(params.get("page") ?? "0");

  const [search, setSearch] = useState(q ?? "");
  const [prevQ, setPrevQ] = useState(q ?? "");
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);
  const mode = (params.get("mode") as ViewMode) ?? "list";

  // Sinkronisasi render-pass saat URL search param berubah secara eksternal (mis. tombol reset)
  if (prevQ !== (q ?? "")) {
    setPrevQ(q ?? "");
    setSearch(q ?? "");
  }

  // Debounce live search 300 ms ke URL
  useEffect(() => {
    const trimmed = search.trim();
    const currentQ = q ?? "";
    if (trimmed === currentQ) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      next.delete("page");
      router.replace(`/questions?${next.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [search, q, params, router]);

  // Seleksi massal
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionModeManual, setSelectionModeManual] = useState(false);
  const isSelectionMode = selectionModeManual || selected.size > 0;
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const bulk = useBulkQuestionAction();
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectionModeManual(false);
    setBulkMsg(null);
  }

  function runBulk(action: BulkAction, onComplete?: () => void) {
    const ids = [...selected];
    if (ids.length === 0) {
      onComplete?.();
      return;
    }
    setBulkMsg(null);
    bulk.mutate(
      { ids, action },
      {
        onSuccess: (res) => {
          const msg =
            `${res.ok.length} berhasil` +
            (res.failed.length ? `, ${res.failed.length} gagal` : "") +
            ".";
          setBulkMsg(msg);
          if (res.failed.length > 0) {
            toast.warning(msg);
          } else {
            toast.success(msg);
          }
          setSelected(new Set(res.failed.map((f) => f.id)));
          onComplete?.();
        },
        onError: (e) => {
          const message = (e as Error).message;
          setBulkMsg(message);
          toast.error("Aksi massal gagal", { description: message });
          onComplete?.();
        },
      },
    );
  }

  const query: Partial<ListQuestionsQuery> = {
    q,
    status,
    cognitiveLevel,
    questionType,
    grade,
    difficulty,
    topicId,
    tagId,
    sourceId,
    flagged,
    limit: pageSize,
    offset: page * pageSize,
  };

  const { data, isLoading, isError, error } = useQuestions(query);
  const { data: topics } = useTopics();
  const { data: tags } = useTags();
  const { data: sources } = useSources();
  const { data: grades } = useGrades();

  /** Perbarui satu param tunggal (q, status, sourceId, mode, page, limit). */
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`/questions?${next.toString()}`);
  }

  /** Perbarui banyak param sekaligus secara atomik (mencegah clobbering closure). */
  function setParams(entries: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
    }
    router.replace(`/questions${next.toString() ? `?${next.toString()}` : ""}`);
  }

  /** Tambah/hapus satu nilai pada param multi-nilai (checkbox/toggle di drawer). */
  function toggleValue(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const cur = new Set(readList(params, key));
    if (cur.has(value)) cur.delete(value);
    else cur.add(value);
    next.delete(key);
    for (const v of cur) next.append(key, v);
    next.delete("page");
    router.replace(`/questions?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", search.trim() || null);
  }

  /** Hapus pencarian dan langsung kirim pencarian kosong (kembali ke daftar penuh). */
  function clearSearch() {
    setSearch("");
    setParam("q", null);
  }

  /** Reset semua filter + pencarian — dipakai tombol reset di state kosong. */
  function resetAllFilters() {
    setSearch("");
    router.replace("/questions");
  }

  const total = data?.total ?? 0;
  const stats = data?.stats;

  function handlePageSizeChange(newSize: number) {
    setParam("limit", newSize === DEFAULT_PAGE_SIZE ? null : String(newSize));
  }

  /** Ada filter/pencarian aktif — menentukan deskripsi & tombol reset state kosong. */
  const hasActiveFilter =
    topicId.length > 0 ||
    Boolean(tagId) ||
    grade.length > 0 ||
    difficulty.length > 0 ||
    questionType.length > 0 ||
    Boolean(status) ||
    Boolean(sourceId) ||
    Boolean(flagged) ||
    Boolean(q);

  const filterValues = {
    topicId,
    tagId,
    grade,
    difficulty,
    cognitiveLevel: cognitiveLevel ? [cognitiveLevel] : [],
    questionType,
    status,
    sourceId,
    flagged,
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* 0. Judul halaman — satu-satunya h1 halaman ini (halaman daftar tidak
          memakai PageHeader sebelumnya; label "Bank Soal" hanya breadcrumb layout). */}
      <PageHeader
        title="Bank Soal"
        description="Cari, saring, dan kelola soal."
      />

      {/* 0.5. STATISTIK RINGKAS (ACT-04 & Omni-List Model) */}
      <div className="grid grid-cols-2 gap-3 px-3 pt-3 sm:grid-cols-4 sm:px-4">
        <button
          type="button"
          onClick={() => setParams({ status: null, flagged: null })}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3.5 shadow-2xs text-left transition-all hover:bg-card pointer-coarse:min-h-[44px]",
            !status && !flagged
              ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
              : "border-border/70 bg-card/60",
          )}
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Layers className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold tracking-tight tabular-nums font-mono">
              {stats?.total ?? total}
            </div>
            <div className="text-xs text-muted-foreground truncate">Total Soal</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setParam("status", status === "ready" ? null : "ready")}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3.5 shadow-2xs text-left transition-all hover:bg-card pointer-coarse:min-h-[44px]",
            status === "ready"
              ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
              : "border-border/70 bg-card/60",
          )}
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold tracking-tight tabular-nums font-mono">
              {stats?.ready ?? 0}
            </div>
            <div className="text-xs text-muted-foreground truncate">Siap Pakai</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setParam("status", status === "review" ? null : "review")}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3.5 shadow-2xs text-left transition-all hover:bg-card pointer-coarse:min-h-[44px]",
            status === "review"
              ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
              : "border-border/70 bg-card/60",
          )}
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <FilePenLine className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold tracking-tight tabular-nums font-mono">
              {stats?.review ?? 0}
            </div>
            <div className="text-xs text-muted-foreground truncate">Perlu Telaah</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setParam("flagged", flagged ? null : "true")}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3.5 shadow-2xs text-left transition-all hover:bg-card pointer-coarse:min-h-[44px]",
            flagged
              ? "border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/20"
              : "border-border/70 bg-card/60",
          )}
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Flag className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold tracking-tight tabular-nums font-mono">
              {stats?.flagged ?? 0}
            </div>
            <div className="text-xs text-muted-foreground truncate">Ditandai (Flag)</div>
          </div>
        </button>
      </div>

      {/* 1. Horizontal Compound Filter Bar */}
      <QuestionFilterBar
        onOpenDrawer={() => setFiltersOpen(true)}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={submitSearch}
        onClearSearch={clearSearch}
        filters={filterValues}
        topics={topics ?? []}
        tags={tags ?? []}
        grades={grades ?? []}
        sources={sources ?? []}
        onRemoveTopic={(id) => toggleValue("topicId", id)}
        onClearTag={() => setParam("tagId", null)}
        onRemoveGrade={(id) => toggleValue("grade", id)}
        onRemoveDifficulty={(lvl) => toggleValue("difficulty", String(lvl))}
        onRemoveCognitive={() => setParam("cognitiveLevel", null)}
        onRemoveType={(t) => toggleValue("questionType", t)}
        onClearStatus={() => setParam("status", null)}
        onClearFlagged={() => setParam("flagged", null)}
        onClearSource={() => setParam("sourceId", null)}
        onResetAll={() => router.replace("/questions")}
        totalFiltered={total}
        isLoading={isLoading}
        viewMode={mode}
        onViewModeChange={(m) => setParam("mode", m)}
      />

      {/* 2. Slide-Over Filter Drawer (Hanya Muncul Saat Dipencet) */}
      <QuestionFilterDrawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filterValues}
        topics={topics ?? []}
        tags={tags ?? []}
        grades={grades ?? []}
        sources={sources ?? []}
        onToggleTopic={(id) => toggleValue("topicId", id)}
        onSelectTag={(id) => setParam("tagId", id)}
        onToggleGrade={(id) => toggleValue("grade", id)}
        onToggleDifficulty={(lvl) => toggleValue("difficulty", String(lvl))}
        onToggleCognitive={(lvl) => setParam("cognitiveLevel", cognitiveLevel === lvl ? null : lvl)}
        onToggleType={(t) => toggleValue("questionType", t)}
        onSelectStatus={(s) => setParam("status", s)}
        onToggleFlagged={() => setParam("flagged", flagged ? null : "true")}
        onSelectSource={(s) => setParam("sourceId", s)}
        onReset={() => {
          router.replace("/questions");
          setFiltersOpen(false);
        }}
        totalFiltered={total}
        isLoading={isLoading}
      />

      {/* 3. Daftar Kartu Soal (100% Lebar Penuh) */}
      <div className={selected.size > 0 ? "flex-1 overflow-y-auto pb-28 sm:pb-4" : "flex-1 overflow-y-auto"}>
        {isLoading ? (
          <QuestionListSkeleton mode={mode} />
        ) : isError ? (
          <ErrorState title="Gagal memuat soal" description={error?.message} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="Tidak ada soal"
            description={
              hasActiveFilter
                ? "Tidak ada soal yang cocok dengan filter. Coba reset filter."
                : "Belum ada soal. Mulai dengan membuat soal pertama."
            }
            action={
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {hasActiveFilter && (
                  <Button variant="outline" size="sm" onClick={resetAllFilters}>
                    Reset filter
                  </Button>
                )}
                <Button
                  render={<Link href="/questions/new" />}
                  nativeButton={false}
                  size="sm"
                >
                  <Plus data-icon="inline-start" /> Buat Soal
                </Button>
              </div>
            }
          />
        ) : (
          <div className={modeClass(mode)}>
            {data.items.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                href={`/questions/${question.id}`}
                selected={selected.has(question.id)}
                onToggleSelect={toggleSelect}
                mode={mode}
                isSelectionMode={isSelectionMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* 4. Bar Seleksi Massal */}
      {selected.size > 0 && (
        <div className="sticky bottom-3 z-10 mx-3 mb-3 rounded-lg border border-border bg-popover shadow-lg sm:mx-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Baris atas: jumlah terpilih + tombol aksi utama */}
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="shrink-0 text-sm font-medium">{selected.size} terpilih</span>
            <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
            {/* Aksi — single row, overflow-x-auto di mobile agar tidak wrap */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              <Button
                size="sm"
                disabled={bulk.isPending}
                onClick={() => runBulk("set_ready")}
                className="shrink-0 min-h-[44px]"
              >
                Setujui
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulk.isPending}
                onClick={() => runBulk("reject_to_draft")}
                className="shrink-0 min-h-[44px]"
              >
                Tolak
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulk.isPending}
                onClick={() => setConfirmArchiveOpen(true)}
                className="shrink-0 min-h-[44px]"
              >
                Arsipkan
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulk.isPending}
                onClick={() => runBulk("flag")}
                className="shrink-0 min-h-[44px]"
              >
                Tandai
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulk.isPending}
                onClick={() => runBulk("unflag")}
                className="shrink-0 min-h-[44px] hidden sm:inline-flex"
              >
                Lepas tanda
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0 min-h-[44px] min-w-[44px]"
              aria-label="Batal pilih"
              onClick={clearSelection}
            >
              <X />
            </Button>
          </div>
          {/* Pesan status (hanya muncul bila ada teks) */}
          {(bulkMsg || bulk.isPending) && (
            <div className="border-t border-border/40 px-3 pb-2 pt-1 text-xs text-muted-foreground">
              {bulk.isPending ? "Memproses…" : bulkMsg}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={confirmArchiveOpen}
        onOpenChange={(open) => {
          if (!bulk.isPending) setConfirmArchiveOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arsipkan {selected.size} butir soal?</DialogTitle>
            <DialogDescription>
              Soal yang diarsipkan akan disembunyikan dari daftar utama dan hanya
              bisa dilihat kembali melalui filter status &ldquo;Arsip&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={bulk.isPending}
              onClick={() => setConfirmArchiveOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={bulk.isPending}
              onClick={() => runBulk("archive", () => setConfirmArchiveOpen(false))}
            >
              {bulk.isPending ? "Mengarsipkan…" : "Ya, Arsipkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Paginasi — Model Terpadu (Linear / IBM Carbon Workbench) */}
      <ListWorkbenchPagination
        page={page}
        pageSize={pageSize}
        total={total}
        itemLabel="soal"
        onPageChange={(newPage) => setParam("page", String(newPage))}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}
