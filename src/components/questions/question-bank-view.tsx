"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/questions/question-card";
import { modeClass, type ViewMode } from "@/components/questions/view-mode-toggle";
import { QuestionFilterDrawer } from "@/components/questions/question-filter-drawer";
import { QuestionFilterBar } from "@/components/questions/question-filter-bar";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuestions, useBulkQuestionAction, type BulkAction } from "@/lib/hooks/use-questions";
import { useTopics, useSources, useGrades } from "@/lib/hooks/use-reference";
import type { ListQuestionsQuery } from "@/lib/contracts/question";

const PAGE_SIZE = 20;

/** Baca daftar nilai dari URL (tunggal maupun banyak, dukung CSV). */
function readList(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);
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
  const status = (params.get("status") as ListQuestionsQuery["status"]) ?? undefined;
  const sourceId = params.get("sourceId") ?? undefined;
  const q = params.get("q") ?? undefined;
  const page = Number(params.get("page") ?? "0");

  const [search, setSearch] = useState(q ?? "");
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);
  const mode = (params.get("mode") as ViewMode) ?? "list";

  // Seleksi massal
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
    setBulkMsg(null);
  }

  function runBulk(action: BulkAction) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkMsg(null);
    bulk.mutate(
      { ids, action },
      {
        onSuccess: (res) => {
          setBulkMsg(
            `${res.ok.length} berhasil` +
              (res.failed.length ? `, ${res.failed.length} gagal` : "") +
              ".",
          );
          setSelected(new Set(res.failed.map((f) => f.id)));
        },
        onError: (e) => setBulkMsg((e as Error).message),
      },
    );
  }

  const query: Partial<ListQuestionsQuery> = {
    q,
    status,
    questionType,
    grade,
    difficulty,
    topicId,
    sourceId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading, isError, error } = useQuestions(query);
  const { data: topics } = useTopics();
  const { data: sources } = useSources();
  const { data: grades } = useGrades();

  /** Perbarui satu param tunggal (q, status, sourceId, mode, page). */
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

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filterValues = {
    topicId,
    grade,
    difficulty,
    questionType,
    status,
    sourceId,
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* 1. Horizontal Compound Filter Bar */}
      <QuestionFilterBar
        onOpenDrawer={() => setFiltersOpen(true)}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={submitSearch}
        filters={filterValues}
        topics={topics ?? []}
        grades={grades ?? []}
        sources={sources ?? []}
        onRemoveTopic={(id) => toggleValue("topicId", id)}
        onRemoveGrade={(id) => toggleValue("grade", id)}
        onRemoveDifficulty={(lvl) => toggleValue("difficulty", String(lvl))}
        onRemoveType={(t) => toggleValue("questionType", t)}
        onClearStatus={() => setParam("status", null)}
        onClearSource={() => setParam("sourceId", null)}
        onResetAll={() => router.replace("/questions")}
        totalFiltered={total}
        viewMode={mode}
        onViewModeChange={(m) => setParam("mode", m)}
      />

      {/* 2. Slide-Over Filter Drawer (Hanya Muncul Saat Dipencet) */}
      <QuestionFilterDrawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filterValues}
        topics={topics ?? []}
        grades={grades ?? []}
        sources={sources ?? []}
        onToggleTopic={(id) => toggleValue("topicId", id)}
        onToggleGrade={(id) => toggleValue("grade", id)}
        onToggleDifficulty={(lvl) => toggleValue("difficulty", String(lvl))}
        onToggleType={(t) => toggleValue("questionType", t)}
        onSelectStatus={(s) => setParam("status", s)}
        onSelectSource={(s) => setParam("sourceId", s)}
        onReset={() => {
          router.replace("/questions");
          setFiltersOpen(false);
        }}
        totalFiltered={total}
      />

      {/* 3. Daftar Kartu Soal (100% Lebar Penuh) */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState label="Memuat soal…" />
        ) : isError ? (
          <ErrorState title="Gagal memuat soal" description={error?.message} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="Tidak ada soal"
            description={
              topicId.length > 0 ||
              grade.length > 0 ||
              difficulty.length > 0 ||
              questionType.length > 0 ||
              status ||
              sourceId ||
              q
                ? "Tidak ada soal yang cocok dengan filter. Coba reset filter."
                : "Belum ada soal. Mulai dengan membuat soal pertama."
            }
            action={
              <Button
                render={<Link href="/questions/new" />}
                nativeButton={false}
                size="sm"
                className="mt-2"
              >
                <Plus data-icon="inline-start" /> Buat Soal
              </Button>
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
              />
            ))}
          </div>
        )}
      </div>

      {/* 4. Bar Seleksi Massal */}
      {selected.size > 0 && (
        <div className="sticky bottom-3 z-10 mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg sm:mx-4">
          <span className="text-sm font-medium">{selected.size} terpilih</span>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Button
            size="sm"
            disabled={bulk.isPending}
            onClick={() => runBulk("set_ready")}
          >
            Setujui
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bulk.isPending}
            onClick={() => runBulk("reject_to_draft")}
          >
            Tolak → Draf
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bulk.isPending}
            onClick={() => setConfirmArchiveOpen(true)}
          >
            Arsipkan
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bulk.isPending}
            onClick={() => runBulk("flag")}
          >
            Tandai
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bulk.isPending}
            onClick={() => runBulk("unflag")}
          >
            Lepas tanda
          </Button>
          {bulkMsg && (
            <span className="text-xs text-muted-foreground">{bulkMsg}</span>
          )}
          {bulk.isPending && (
            <span className="text-xs text-muted-foreground">Memproses…</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={clearSelection}
          >
            <X data-icon="inline-start" /> Batal
          </Button>
        </div>
      )}

      <Dialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arsipkan {selected.size} butir soal?</DialogTitle>
            <DialogDescription>
              Soal yang diarsipkan akan disembunyikan dari daftar utama dan hanya
              bisa dilihat kembali melalui filter status &ldquo;Arsip&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmArchiveOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={bulk.isPending}
              onClick={() => {
                setConfirmArchiveOpen(false);
                runBulk("archive");
              }}
            >
              Ya, Arsipkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Paginasi — Ringkas, tetap satu baris di mobile */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm sm:px-4">
          <span className="truncate text-muted-foreground">
            Hal. {page + 1}/{totalPages}
          </span>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setParam("page", String(page - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setParam("page", String(page + 1))}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
