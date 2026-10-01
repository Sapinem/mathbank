"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers, Trash2, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  useCollection,
  useRemoveCollectionItem,
  useAddCollectionItem,
} from "@/lib/hooks/use-collections";
import { useQuestions } from "@/lib/hooks/use-questions";

/**
 * Detail koleksi (ADR-0016) — isi arsip + tambah/keluarkan soal.
 *
 * Koleksi **publik**: tak ada pembatasan pemilik, semua guru boleh mengubah.
 */
export function CollectionDetailView({ id }: { id: string }) {
  const { data, isPending, isError, error } = useCollection(id);
  const removeItem = useRemoveCollectionItem(id);
  const addItem = useAddCollectionItem(id);

  const [q, setQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  /** Cari soal untuk dimasukkan (hanya saat pemilih dibuka). */
  const search = useQuestions(
    pickerOpen && q.trim() ? { q: q.trim(), limit: 12 } : { limit: 12 },
  );

  if (isPending) return <LoadingState />;
  if (isError)
    return (
      <ErrorState
        title="Gagal memuat koleksi"
        description={(error as Error).message}
      />
    );
  if (!data) return null;

  const existing = new Set(data.questionIds);

  return (
    <>
      <PageHeader
        title={data.title}
        description="Arsip soal publik."
        actions={
          <Link
            href="/collections"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
            Kembali
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {/* Metadata */}
        <Card className="rounded-xl border border-border/80 bg-card/50">
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Soal
              </p>
              <p className="font-mono text-lg">{data.itemCount}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Sumber
              </p>
              <p className="text-sm">{data.sourceLabel ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Event
              </p>
              <p className="text-sm">{data.eventName ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Tahun / Kelas
              </p>
              <p className="text-sm">
                {data.year ?? "—"} / {data.grade ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {data.description && (
          <Card className="rounded-xl border border-border/80">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              {data.description}
            </CardContent>
          </Card>
        )}

        {/* Isi arsip */}
        <Card className="rounded-xl border border-border/80 bg-card/50">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  Isi Arsip
                </CardTitle>
                <CardDescription className="text-xs">
                  {data.itemCount} soal dalam koleksi ini.
                </CardDescription>
              </div>
              <Button
                onClick={() => setPickerOpen((v) => !v)}
                className="min-h-11"
              >
                {pickerOpen ? "Tutup Pencarian" : "Tambah Soal"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-4">
            {/* Pemilih soal */}
            {pickerOpen && (
              <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari soal…"
                    className="pl-9"
                    aria-label="Cari soal untuk ditambahkan"
                  />
                </div>

                {search.isPending && (
                  <p className="text-xs text-muted-foreground">Memuat…</p>
                )}
                {search.data && search.data.items.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tak ada soal yang cocok.
                  </p>
                )}
                <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                  {(search.data?.items ?? []).map((question) => {
                    const already = existing.has(question.id);
                    return (
                      <div
                        key={question.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-border/40 p-2"
                      >
                        <p className="line-clamp-2 flex-1 text-xs">
                          {question.contentMarkdown.slice(0, 160)}
                        </p>
                        <Button
                          size="sm"
                          variant={already ? "outline" : "default"}
                          className="min-h-11 shrink-0"
                          disabled={already || addItem.isPending}
                          onClick={() => addItem.mutate(question.id)}
                        >
                          {already ? "Sudah ada" : "Tambah"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daftar soal */}
            {data.questionIds.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Arsip ini masih kosong. Tambahkan soal lewat pencarian di atas.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {data.questionIds.map((questionId, i) => (
                  <li
                    key={questionId}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <Link
                        href={`/questions/${questionId}`}
                        className="truncate font-mono text-xs text-muted-foreground hover:text-foreground"
                      >
                        {questionId.slice(0, 8)}…
                      </Link>
                      {existing.has(questionId) && (
                        <Badge variant="secondary" className="text-[10px]">
                          terarsip
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      aria-label={`Keluarkan soal ${i + 1} dari koleksi`}
                      disabled={removeItem.isPending}
                      onClick={() => removeItem.mutate(questionId)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
