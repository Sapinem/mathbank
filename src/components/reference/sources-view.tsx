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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import {
  useSources,
  useCreateSource,
  useUpdateSource,
  useDeleteSource,
} from "@/lib/hooks/use-taxonomy-refs";
import type { SourceRow, SourceKind } from "@/lib/services/taxonomy-service";

const KIND_LABELS: Record<SourceKind, string> = {
  book: "Buku",
  website: "Situs",
  school: "Sekolah",
  competition: "Kompetisi",
};

export function SourcesView() {
  const { data, isPending, isError, error } = useSources();
  const create = useCreateSource();
  const update = useUpdateSource();
  const del = useDeleteSource();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SourceRow | null>(null);
  const [kind, setKind] = useState<SourceKind>("book");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [confirm, setConfirm] = useState<SourceRow | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setKind("book");
    setLabel("");
    setUrl("");
    setFormErr(null);
    setOpen(true);
  }
  function openEdit(s: SourceRow) {
    setEditing(s);
    setKind(s.kind);
    setLabel(s.label);
    setUrl(s.url ?? "");
    setFormErr(null);
    setOpen(true);
  }

  function submit() {
    setFormErr(null);
    const payload = { kind, label: label.trim(), url: url.trim() || null };
    if (editing) {
      update.mutate(
        { id: editing.id, ...payload },
        { onSuccess: () => setOpen(false), onError: (e) => setFormErr((e as Error).message) },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => setOpen(false),
        onError: (e) => setFormErr((e as Error).message),
      });
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <>
      <PageHeader
        title="Sumber & Asal"
        description="Buku, situs, sekolah, dan institusi asal soal."
        actions={
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" /> Sumber Baru
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Daftar Sumber</CardTitle>
          <CardDescription>
            {data ? `${data.length} sumber` : "Memuat…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <LoadingState label="Memuat sumber…" />
          ) : isError ? (
            <ErrorState title="Gagal memuat sumber" description={(error as Error).message} />
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada sumber.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-right">Dipakai</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.label}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{KIND_LABELS[s.kind]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[16rem] truncate">
                      {s.url ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.usageCount}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Sunting ${s.label}`}
                        onClick={() => openEdit(s)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Hapus ${s.label}`}
                        onClick={() => setConfirm(s)}
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
            <DialogTitle>{editing ? "Sunting Sumber" : "Sumber Baru"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="src-kind" className="text-sm font-medium">Jenis</label>
              <Select value={kind} onValueChange={(v) => setKind(v as SourceKind)}>
                <SelectTrigger id="src-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.keys(KIND_LABELS) as SourceKind[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="src-label" className="text-sm font-medium">Label</label>
              <Input
                id="src-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="mis. Buku Matematika Kelas X"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="src-url" className="text-sm font-medium">URL (opsional)</label>
              <Input
                id="src-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            {formErr && <p className="text-destructive text-sm">{formErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={busy || label.trim() === ""}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus sumber?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            &ldquo;{confirm?.label}&rdquo; akan dihapus permanen. Ditolak bila sumber
            masih dipakai soal.
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
