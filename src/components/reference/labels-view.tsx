"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from "@/lib/hooks/use-taxonomy-refs";
import type { TagRow } from "@/lib/services/taxonomy-service";

export function LabelsView() {
  const { data, isPending, isError, error } = useTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const del = useDeleteTag();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<TagRow | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setFormErr(null);
    setOpen(true);
  }
  function openEdit(t: TagRow) {
    setEditing(t);
    setName(t.name);
    setFormErr(null);
    setOpen(true);
  }

  function submit() {
    setFormErr(null);
    const opts = {
      onSuccess: () => setOpen(false),
      onError: (e: unknown) => setFormErr((e as Error).message),
    };
    if (editing) update.mutate({ id: editing.id, name: name.trim() }, opts);
    else create.mutate({ name: name.trim() }, opts);
  }

  const busy = create.isPending || update.isPending;

  return (
    <>
      <PageHeader
        title="Label"
        description="Label/tag fleksibel untuk lintas-topik."
        actions={
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" /> Label Baru
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Daftar Label</CardTitle>
          <CardDescription>{data ? `${data.length} label` : "Memuat…"}</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <LoadingState label="Memuat label…" />
          ) : isError ? (
            <ErrorState title="Gagal memuat label" description={(error as Error).message} />
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada label.</p>
          ) : (
            <Table>
              <TableCaption>Daftar label soal.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Dipakai</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t.slug}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.usageCount}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Sunting ${t.name}`}
                        onClick={() => openEdit(t)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Hapus ${t.name}`}
                        onClick={() => setConfirm(t)}
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
            <DialogTitle>{editing ? "Sunting Label" : "Label Baru"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="tag-name" className="text-sm font-medium">Nama label</label>
            <Input id="tag-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. HOTS" />
            {formErr && <p className="text-destructive text-sm">{formErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={busy || name.trim() === ""}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus label?</DialogTitle>
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
                del.mutate(confirm.id, {
                  onSuccess: () => setConfirm(null),
                  onError: (e) => setFormErr((e as Error).message),
                });
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
