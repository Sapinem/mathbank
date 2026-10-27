"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, X, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
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
  const [jumpInput, setJumpInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);
  const mode = (params.get("mode") as ViewMode) ?? "list";

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
  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const target = Number(jumpInput.trim());
    if (!Number.isNaN(target) && target >= 1 && target <= totalPages) {
      setParam("page", String(target - 1));
      setJumpInput("");
    }
  }

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
        <div className="sticky bottom-3 z-10 mx-3 mb-3 rounded-lg border border-border bg-popover shadow-lg sm:mx-4">
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

      {/* 5. Paginasi — Model Terpadu (IBM Carbon / Linear Workbench Model) */}
      {totalPages > 1 && (
        <nav
          aria-label="Navigasi halaman"
          className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-background/80 px-3 py-2 text-xs sm:px-4 backdrop-blur-xs"
        >
          {/* Sisi Kiri: Pilihan Jumlah Baris & Jangkauan Data */}
          <div className="flex items-center gap-3">
            {/* Pilihan jumlah baris */}
            <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
              <span>Baris:</span>
              <div className="flex items-center rounded-md border border-border bg-muted/20 p-0.5">
                {[20, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handlePageSizeChange(size)}
                    aria-label={`Tampilkan ${size} soal per halaman`}
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-mono font-medium transition-colors pointer-coarse:min-h-[44px]",
                      pageSize === size
                        ? "bg-background font-bold text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Jangkauan Data */}
            <span className="text-muted-foreground font-mono">
              <span className="hidden sm:inline">Menampilkan </span>
              <strong className="font-semibold text-foreground">{from}–{to}</strong> dari{" "}
              <strong className="font-semibold text-foreground">{total.toLocaleString("id-ID")}</strong>
              <span className="hidden sm:inline"> soal</span>
            </span>
          </div>

          {/* Sisi Kanan: Lompat Cepat & Kontrol Navigasi Halaman */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Input Lompat Cepat */}
            <form onSubmit={handleJump} className="hidden lg:flex items-center gap-1.5 mr-1">
              <span className="text-muted-foreground">Lompat:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder={String(page + 1)}
                aria-label="Lompat ke nomor halaman"
                className="h-7 w-12 rounded-md border border-border bg-background px-1.5 text-center font-mono text-xs text-foreground focus-visible:border-brand focus-visible:outline-none"
              />
            </form>

            {/* Tombol Halaman Pertama (|<) */}
            <Button
              variant="outline"
              size="icon"
              disabled={page === 0}
              onClick={() => setParam("page", "0")}
              aria-label="Halaman pertama"
              className="relative hidden sm:inline-flex h-8 w-8 after:absolute after:-inset-1.5 after:content-['']"
            >
              <ChevronsLeft className="size-3.5" />
            </Button>

            {/* Tombol Sebelumnya */}
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setParam("page", String(page - 1))}
              className="relative h-8 gap-1 px-2.5 after:absolute after:-inset-1.5 after:content-['']"
            >
              <ChevronLeft className="size-3.5" />
              Sebelumnya
            </Button>

            {/* Nomor Halaman */}
            <span className="px-1 text-muted-foreground font-mono whitespace-nowrap">
              Hal. {page + 1}/{totalPages}
            </span>

            {/* Tombol Berikutnya */}
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setParam("page", String(page + 1))}
              className="relative h-8 gap-1 px-2.5 after:absolute after:-inset-1.5 after:content-['']"
            >
              Berikutnya
              <ChevronRight className="size-3.5" />
            </Button>

            {/* Tombol Halaman Terakhir (>|) */}
            <Button
              variant="outline"
              size="icon"
              disabled={page + 1 >= totalPages}
              onClick={() => setParam("page", String(totalPages - 1))}
              aria-label="Halaman terakhir"
              className="relative hidden sm:inline-flex h-8 w-8 after:absolute after:-inset-1.5 after:content-['']"
            >
              <ChevronsRight className="size-3.5" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
