"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Archive, ArrowUpRight, Library } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
} from "@/lib/hooks/use-collections";
import { useSources, useEvents } from "@/lib/hooks/use-taxonomy-refs";
import type { CollectionRow } from "@/lib/services/collection-service";

export function CollectionListView() {
  const { data, isPending, isError, error } = useCollections();
  const create = useCreateCollection();
  const del = useDeleteCollection();
  const { data: sources } = useSources();
  const { data: events } = useEvents();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [eventId, setEventId] = useState("");
  const [year, setYear] = useState("");
  const [grade, setGrade] = useState("");
  const [description, setDescription] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<CollectionRow | null>(null);

  function openCreate() {
    setTitle("");
    setSourceId("");
    setEventId("");
    setYear("");
    setGrade("");
    setDescription("");
    setFormErr(null);
    setOpen(true);
  }

  function submit() {
    setFormErr(null);
    create.mutate(
      {
        title: title.trim(),
        sourceId: sourceId || null,
        eventId: eventId || null,
        year: year.trim() ? Number(year) : null,
        grade: grade.trim() || null,
        description: description.trim() || null,
      },
      {
        onSuccess: () => setOpen(false),
        onError: (e) => setFormErr((e as Error).message),
      },
    );
  }

  const valid = title.trim().length > 0;

  return (
    <>
      <PageHeader
        title="Koleksi"
        description="Arsip soal publik — kumpulan soal dari satu sumber, tanpa pemilik personal."
        actions={
          <Button onClick={openCreate} className="min-h-11">
            <Plus className="size-4" />
            Koleksi Baru
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <Card className="rounded-xl border border-border/80 bg-card/50">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Library className="size-4 text-primary" />
              Koleksi (arsip publik)
            </CardTitle>
            <CardDescription className="text-xs">
              Berbeda dari Paket Soal: koleksi bersifat <strong>publik</strong> —
              semua guru boleh melihat &amp; mengelola. Paket Soal milik pribadi
              pembuatnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isPending && <LoadingState />}
            {isError && (
              <div className="p-4">
                <ErrorState
                  title="Gagal memuat koleksi"
                  description={(error as Error).message}
                />
              </div>
            )}
            {data && data.length === 0 && (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <Library className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Belum ada koleksi. Buat koleksi untuk mengarsipkan soal dari
                  satu sumber.
                </p>
                <Button onClick={openCreate} variant="outline" className="min-h-11">
                  <Plus className="size-4" />
                  Buat Koleksi Pertama
                </Button>
              </div>
            )}
            {data && data.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Judul</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="text-right">Soal</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="w-[100px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/collections/${c.id}`}
                          className="font-medium hover:underline"
                        >
                          {c.title}
                        </Link>
                        {c.year && (
                          <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                            {c.year}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.sourceLabel ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.eventName ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.itemCount}
                      </TableCell>
                      <TableCell>
                        {c.grade ? (
                          <Badge variant="secondary">{c.grade}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/collections/${c.id}`}
                            aria-label={`Buka ${c.title}`}
                            className="inline-flex size-11 items-center justify-center rounded-md hover:bg-accent"
                          >
                            <ArrowUpRight className="size-4" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            aria-label={`Hapus ${c.title}`}
                            onClick={() => setConfirm(c)}
                          >
                            <Archive className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog buat koleksi */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Koleksi Baru</DialogTitle>
            <DialogDescription>
              Arsip soal dari satu sumber. Sumber &amp; event bersifat opsional.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="col-title" className="text-sm font-medium">
                Judul
              </label>
              <Input
                id="col-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="mis. Arsip Persamaan Kuadrat — MathCyber"
              />
            </div>

            <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="col-source" className="text-sm font-medium">
                  Sumber <span className="text-muted-foreground">(opsional)</span>
                </label>
                <select
                  id="col-source"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="h-11 rounded-md border border-input bg-background px-3 text-base"
                >
                  <option value="">— Tanpa sumber —</option>
                  {(sources ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="col-event" className="text-sm font-medium">
                  Event <span className="text-muted-foreground">(opsional)</span>
                </label>
                <select
                  id="col-event"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="h-11 rounded-md border border-input bg-background px-3 text-base"
                >
                  <option value="">— Tanpa event —</option>
                  {(events ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="col-year" className="text-sm font-medium">
                  Tahun <span className="text-muted-foreground">(opsional)</span>
                </label>
                <Input
                  id="col-year"
                  type="number"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="mis. 2024"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="col-grade" className="text-sm font-medium">
                  Kelas <span className="text-muted-foreground">(opsional)</span>
                </label>
                <Input
                  id="col-grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="mis. 11"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="col-desc" className="text-sm font-medium">
                Keterangan <span className="text-muted-foreground">(opsional)</span>
              </label>
              <Textarea
                id="col-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Catatan tentang arsip ini…"
              />
            </div>

            {formErr && <p className="text-destructive text-sm">{formErr}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="min-h-11">
              Batal
            </Button>
            <Button
              onClick={submit}
              disabled={!valid || create.isPending}
              className="min-h-11"
            >
              {create.isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus koleksi ini?</DialogTitle>
            <DialogDescription>
              &ldquo;{confirm?.title}&rdquo; akan dihapus.{" "}
              <strong>Soalnya TIDAK terhapus</strong> — hanya arsipnya yang
              hilang.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} className="min-h-11">
              Batal
            </Button>
            <Button
              variant="destructive"
              className="min-h-11"
              disabled={del.isPending}
              onClick={() => {
                if (!confirm) return;
                del.mutate(confirm.id, { onSuccess: () => setConfirm(null) });
              }}
            >
              {del.isPending ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
