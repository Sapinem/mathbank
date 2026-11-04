"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MathContent } from "@/components/math/math-content";
import { useQuestions } from "@/lib/hooks/use-questions";
import { useTopics } from "@/lib/hooks/use-reference";
import { TYPE_LABELS } from "@/lib/display/labels";
import type { QuestionType } from "@/lib/contracts/question";
import { cn } from "@/lib/utils";

export interface BundleQuestionPickerProps {
  usedIds: Set<string>;
  onAddQuestion: (input: { questionId: string; role?: "question" | "stimulus" }) => void;
  isAdding?: boolean;
}

export function BundleQuestionPicker({
  usedIds,
  onAddQuestion,
  isAdding = false,
}: BundleQuestionPickerProps) {
  const [q, setQ] = useState("");
  const [topicId, setTopicId] = useState<string>("all");
  const [questionType, setQuestionType] = useState<string>("all");
  const [pickerPage, setPickerPage] = useState<number>(0);

  const PICKER_PAGE_SIZE = 15;
  const { data: topics = [] } = useTopics();

  const { data: results, isPending: searchPending } = useQuestions({
    q: q.trim() || undefined,
    topicId: topicId !== "all" ? [topicId] : undefined,
    questionType: questionType !== "all" ? [questionType as QuestionType] : undefined,
    limit: PICKER_PAGE_SIZE,
    offset: pickerPage * PICKER_PAGE_SIZE,
  });

  const totalQuestions = results?.total ?? 0;
  const totalPickerPages = Math.ceil(totalQuestions / PICKER_PAGE_SIZE);
  const safePickerPage = Math.min(
    Math.max(0, pickerPage),
    Math.max(0, totalPickerPages - 1),
  );

  return (
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
                  disabled={sudah || isAdding}
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  onClick={() =>
                    onAddQuestion({ questionId: item.id })
                  }
                  title={sudah ? "Sudah ada di paket" : "Tambahkan ke paket"}
                  aria-label={
                    sudah
                      ? "Soal sudah ada di paket"
                      : `Tambahkan soal ${item.id} ke paket`
                  }
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">
                    {sudah ? "Sudah ada" : "Tambah"}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Paginasi Pencarian Soal */}
      {totalPickerPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/70 pt-2 text-xs">
          <Button
            variant="ghost"
            size="sm"
            disabled={safePickerPage === 0 || searchPending}
            onClick={() => setPickerPage((p) => Math.max(0, p - 1))}
            className="min-h-[44px] gap-1 px-2 text-xs"
            aria-label="Halaman pencarian sebelumnya"
          >
            <ChevronLeft className="size-3.5" /> Sebelumnya
          </Button>
          <span className="text-muted-foreground">
            {safePickerPage + 1} dari {totalPickerPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={safePickerPage + 1 >= totalPickerPages || searchPending}
            onClick={() =>
              setPickerPage((p) => Math.min(totalPickerPages - 1, p + 1))
            }
            className="min-h-[44px] gap-1 px-2 text-xs"
            aria-label="Halaman pencarian berikutnya"
          >
            Berikutnya <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
