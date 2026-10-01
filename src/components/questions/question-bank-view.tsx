"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search, SlidersHorizontal, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QuestionCard } from "@/components/questions/question-card";
import {
  ViewModeToggle,
  modeClass,
  type ViewMode,
} from "@/components/questions/view-mode-toggle";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { useQuestions } from "@/lib/hooks/use-questions";
import { useTopics, useSources, useGrades } from "@/lib/hooks/use-reference";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/display/labels";
import { cn } from "@/lib/utils";
import type { ListQuestionsQuery } from "@/lib/contracts/question";

const PAGE_SIZE = 20;

/** Baca daftar nilai dari URL (tunggal maupun banyak, dukung CSV). */
function readList(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);
}

/** Halaman Bank Soal — daftar, filter (multi-select), pencarian (G1). */
export function QuestionBankView() {
  const router = useRouter();
  const params = useSearchParams();

  // Filter dari URL (bookmarkable). Multi-nilai via getAll.
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const mode = (params.get("mode") as ViewMode) ?? "list";

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

  /** Tambah/hapus satu nilai pada param multi-nilai (checkbox di panel). */
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

  const activeCount =
    questionType.length +
    grade.length +
    difficulty.length +
    topicId.length +
    (status ? 1 : 0) +
    (sourceId ? 1 : 0);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  /** Isi panel filter — dipakai di desktop (aside) & mobile (Sheet). */
  const filterContent = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Filter</span>
        {activeCount > 0 && (
          <Button
            variant="link"
            size="xs"
            className="text-brand"
            onClick={() => {
              router.replace("/questions");
              setFiltersOpen(false);
            }}
          >
            <X data-icon="inline-start" /> Reset ({activeCount})
          </Button>
        )}
      </div>

      <FilterGroup title="Status">
        <ToggleRow
          label="Semua"
          checked={!status}
          onChange={() => setParam("status", null)}
        />
        {Object.entries(STATUS_LABELS).map(([v, l]) => (
          <ToggleRow
            key={v}
            label={l}
            checked={status === v}
            onChange={() => setParam("status", status === v ? null : v)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Tipe Soal">
        {Object.entries(TYPE_LABELS).map(([v, l]) => (
          <ToggleRow
            key={v}
            label={l}
            checked={questionType.includes(v as never)}
            onChange={() => toggleValue("questionType", v)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Jenjang">
        {(grades ?? []).map((g) => (
          <ToggleRow
            key={g.id}
            label={g.label}
            checked={grade.includes(g.id)}
            onChange={() => toggleValue("grade", g.id)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Kesulitan">
        {[1, 2, 3, 4, 5].map((n) => (
          <ToggleRow
            key={n}
            label={`Level ${n}`}
            checked={difficulty.includes(n)}
            onChange={() => toggleValue("difficulty", String(n))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Topik">
        <TopicPicker
          topics={topics ?? []}
          selected={topicId}
          onToggle={(id) => toggleValue("topicId", id)}
        />
      </FilterGroup>

      <FilterGroup title="Sumber">
        <ToggleRow
          label="Semua"
          checked={!sourceId}
          onChange={() => setParam("sourceId", null)}
        />
        {(sources ?? []).map((s) => (
          <ToggleRow
            key={s.id}
            label={s.label}
            checked={sourceId === s.id}
            onChange={() => setParam("sourceId", sourceId === s.id ? null : s.id)}
          />
        ))}
      </FilterGroup>
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
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setFiltersOpen(true)}
            className="relative lg:hidden"
            aria-label="Buka filter"
          >
            <SlidersHorizontal />
            {activeCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-brand text-[10px] font-medium text-brand-fg">
                {activeCount}
              </span>
            )}
          </Button>

          <form onSubmit={submitSearch} className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari soal…"
              aria-label="Cari soal"
              className="pl-8 text-base sm:text-sm"
            />
          </form>

          <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
            {total} soal
          </span>

          <ViewModeToggle value={mode} onChange={(m) => setParam("mode", m)} />
          <Button render={<Link href="/questions/new" />} nativeButton={false} size="sm" className="shrink-0">
            <Plus data-icon="inline-start" />
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
                <Button render={<Link href="/questions/new" />} nativeButton={false} size="sm" className="mt-2">
                  <Plus data-icon="inline-start" /> Buat Soal
                </Button>
              }
            />
          ) : (
            <div className={modeClass(mode)}>
              {data.items.map((q) => (
                <QuestionCard key={q.id} question={q} href={`/questions/${q.id}`} />
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

/** Grup filter dengan judul kecil. */
function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

/** Baris pilihan (checkbox) di panel filter — tanpa pill di area konten. */
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-[var(--mb-brand)]"
      />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

/** Pemilih topik dengan pencarian mikro (hindari gulir panjang). */
function TopicPicker({
  topics,
  selected,
  onToggle,
}: {
  topics: { id: string; name: string; parentId: string | null; level: number }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [term, setTerm] = useState("");
  const needle = term.trim().toLowerCase();
  const filtered = needle
    ? topics.filter((t) => t.name.toLowerCase().includes(needle))
    : topics;

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Cari topik…"
          aria-label="Cari topik"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="max-h-52 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">Tak ada topik.</p>
        ) : (
          filtered.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onToggle(t.id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted/60",
                  on && "text-brand",
                )}
                style={{ paddingInlineStart: `${(t.level - 1) * 12 + 8}px` }}
              >
                <span
                  className={cn(
                    "grid size-3.5 shrink-0 place-items-center rounded border",
                    on ? "border-brand bg-brand text-brand-fg" : "border-border",
                  )}
                >
                  {on && <Check className="size-2.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 truncate">{t.name}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
