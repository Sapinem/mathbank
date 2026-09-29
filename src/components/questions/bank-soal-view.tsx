"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
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
import { QuestionCard } from "@/components/questions/question-card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { useQuestions } from "@/lib/hooks/use-questions";
import { useTopics, useSources } from "@/lib/hooks/use-reference";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/display/labels";
import type { ListQuestionsQuery } from "@/lib/contracts/question";

const PAGE_SIZE = 20;

/** Halaman Bank Soal — daftar, filter, pencarian (RENCANA-UI §3.2, §4b). */
export function BankSoalView() {
  const router = useRouter();
  const params = useSearchParams();

  // Filter dari URL (bookmarkable)
  const filter: Partial<ListQuestionsQuery> = {
    q: params.get("q") ?? undefined,
    status: (params.get("status") as ListQuestionsQuery["status"]) ?? undefined,
    questionType: (params.get("questionType") as ListQuestionsQuery["questionType"]) ?? undefined,
    grade: params.get("grade") ?? undefined,
    difficulty: params.get("difficulty")
      ? Number(params.get("difficulty"))
      : undefined,
    topicId: params.get("topicId") ?? undefined,
    sourceId: params.get("sourceId") ?? undefined,
  };
  const page = Number(params.get("page") ?? "0");

  const [search, setSearch] = useState(params.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = { ...filter, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  const { data, isLoading, isError, error } = useQuestions(query);
  const { data: topics } = useTopics();
  const { data: sources } = useSources();

  /** Perbarui URL (sumber kebenaran filter). */
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`/bank-soal?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", search.trim() || null);
  }

  const activeCount = Object.values(filter).filter(Boolean).length;
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  /** Isi panel filter — dipakai di desktop (aside) & mobile (Sheet). */
  const filterContent = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Filter</span>
        {activeCount > 0 && (
          <button
            onClick={() => {
              router.replace("/bank-soal");
              setFiltersOpen(false);
            }}
            className="flex items-center gap-1 text-xs text-brand hover:underline"
          >
            <X className="size-3" /> Reset ({activeCount})
          </button>
        )}
      </div>
      <FilterSelect
        label="Status"
        value={filter.status}
        onChange={(v) => setParam("status", v)}
        options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ v, l }))}
      />
      <FilterSelect
        label="Tipe Soal"
        value={filter.questionType}
        onChange={(v) => setParam("questionType", v)}
        options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ v, l }))}
      />
      <FilterSelect
        label="Kesulitan"
        value={filter.difficulty ? String(filter.difficulty) : undefined}
        onChange={(v) => setParam("difficulty", v)}
        options={[1, 2, 3, 4, 5].map((n) => ({ v: String(n), l: `Level ${n}` }))}
      />
      <FilterSelect
        label="Topik"
        value={filter.topicId}
        onChange={(v) => setParam("topicId", v)}
        options={(topics ?? []).map((t) => ({ v: t.id, l: t.name }))}
      />
      <FilterSelect
        label="Sumber"
        value={filter.sourceId}
        onChange={(v) => setParam("sourceId", v)}
        options={(sources ?? []).map((s) => ({ v: s.id, l: s.label }))}
      />
    </>
  );

  return (
    <div className="flex h-full">
      {/* Filter sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border p-4 lg:block">
        {filterContent}
      </aside>

      {/* Filter sheet (mobile/tablet) */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto p-4">
          <SheetHeader className="mb-2 p-0">
            <SheetTitle className="text-base">Filter</SheetTitle>
          </SheetHeader>
          {filterContent}
          <Button className="mt-2 w-full" onClick={() => setFiltersOpen(false)}>
            Terapkan
          </Button>
        </SheetContent>
      </Sheet>

      {/* Konten */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
          <button
            onClick={() => setFiltersOpen(true)}
            className="relative rounded-md border border-border p-2 lg:hidden"
            aria-label="Buka filter"
          >
            <SlidersHorizontal className="size-4" />
            {activeCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-brand text-[10px] font-medium text-brand-fg">
                {activeCount}
              </span>
            )}
          </button>

          <form onSubmit={submitSearch} className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari soal…"
              className="pl-8 text-base sm:text-sm"
            />
          </form>

          <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
            {total} soal
          </span>
          <Button render={<Link href="/bank-soal/baru" />} nativeButton={false} size="sm" className="shrink-0">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Buat Soal</span>
          </Button>
        </div>

        {/* Daftar */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <LoadingState label="Memuat soal…" />
          ) : isError ? (
            <ErrorState title="Gagal memuat soal" description={error?.message} />
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title="Tidak ada soal"
              description={
                activeCount > 0
                  ? "Tidak ada soal yang cocok dengan filter. Coba reset filter."
                  : "Belum ada soal. Mulai dengan membuat soal pertama."
              }
              action={
                <Button render={<Link href="/bank-soal/baru" />} nativeButton={false} size="sm" className="mt-2">
                  <Plus className="size-4" /> Buat Soal
                </Button>
              }
            />
          ) : (
            <div>
              {data.items.map((q) => (
                <QuestionCard key={q.id} question={q} href={`/bank-soal/${q.id}`} />
              ))}
            </div>
          )}
        </div>

        {/* Paginasi — ringkas, tetap satu baris di mobile */}
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
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | null) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select
        value={value ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Semua" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
