"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "@/lib/hooks/use-taxonomy-refs";
import type { EventRow } from "@/lib/services/taxonomy-service";

/** Pisah teks koma menjadi daftar bersih. */
function csv(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EventsView() {
  const { data, isPending, isError, error } = useEvents();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const del = useDeleteEvent();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [name, setName] = useState("");
  const [shortname, setShortname] = useState("");
  const [category, setCategory] = useState("");
  const [subtests, setSubtests] = useState("");
  const [aliases, setAliases] = useState("");
  const [confirm, setConfirm] = useState<EventRow | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setShortname("");
    setCategory("");
    setSubtests("");
    setAliases("");
    setFormErr(null);
    setOpen(true);
  }
  function openEdit(e: EventRow) {
    setEditing(e);
    setName(e.name);
    setShortname(e.shortname);
    setCategory(e.category);
    setSubtests(e.subtests.join(", "));
    setAliases(e.aliases.join(", "));
    setFormErr(null);
    setOpen(true);
  }

  function submit() {
    setFormErr(null);
    const payload = {
      name: name.trim(),
      shortname: shortname.trim(),
      category: category.trim(),
      subtests: csv(subtests),
      aliases: csv(aliases),
    };
    const opts = {
      onSuccess: () => {
        setOpen(false);
        toast.success(editing ? "Perubahan event disimpan." : "Event baru dibuat.");
      },
      onError: (e: unknown) => {
        const msg = (e as Error).message;
        setFormErr(msg);
        toast.error("Gagal menyimpan event", { description: msg });
      },
    };
    if (editing) update.mutate({ id: editing.id, version: editing.version, ...payload }, opts);
    else create.mutate(payload, opts);
  }

  const busy = create.isPending || update.isPending;
  const valid = name.trim() && shortname.trim() && category.trim();

  return (
    <>
      <PageHeader
        title="Event"
        description="UTBK, OSN, ujian sekolah, dan subtesnya."
        actions={
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" /> Event Baru
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Daftar Event</CardTitle>
          <CardDescription>{data ? `${data.length} event` : "Memuat…"}</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <LoadingState label="Memuat event…" />
          ) : isError ? (
            <ErrorState title="Gagal memuat event" description={(error as Error).message} />
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada event.</p>
          ) : (
            <Table>
              <TableCaption>Daftar event/ujian (nama, kategori, cakupan).</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Subtes</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.shortname}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{e.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {e.subtests.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          e.subtests.map((s) => (
                            <Badge key={s} variant="outline">
                              {s}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Sunting ${e.name}`}
                        onClick={() => openEdit(e)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Hapus ${e.name}`}
                        onClick={() => setConfirm(e)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sunting Event" : "Event Baru"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="ev-name" className="text-sm font-medium">Nama</label>
              <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. UTBK SNBT" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ev-short" className="text-sm font-medium">Kode singkat</label>
              <Input id="ev-short" value={shortname} onChange={(e) => setShortname(e.target.value)} placeholder="mis. UTBK" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ev-cat" className="text-sm font-medium">Kategori</label>
              <Input id="ev-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="mis. utbk" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ev-sub" className="text-sm font-medium">Subtes (pisah koma)</label>
              <Input id="ev-sub" value={subtests} onChange={(e) => setSubtests(e.target.value)} placeholder="PU, PPU, PBM" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ev-ali" className="text-sm font-medium">Alias (pisah koma)</label>
              <Input id="ev-ali" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="SNBT, UTBK 2024" />
            </div>
            {formErr && <p className="text-destructive text-sm">{formErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={busy || !valid}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus event?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            &ldquo;{confirm?.name}&rdquo; akan dihapus permanen. Ditolak bila masih
            dipakai soal.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Batal</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm) return;
                del.mutate(
                  { id: confirm.id, version: confirm.version },
                  {
                    onSuccess: () => {
                      setConfirm(null);
                      toast.success("Event dihapus.");
                    },
                    onError: (e) =>
                      toast.error("Gagal menghapus event", { description: (e as Error).message }),
                  },
                );
              }}
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
