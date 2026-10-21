"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Merge, Tag as TagIcon } from "lucide-react";
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
import {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useMergeTags,
} from "@/lib/hooks/use-taxonomy-refs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TagRow } from "@/lib/services/taxonomy-service";

/**
 * Meteran pemakaian label (MAT-131B).
 *
 * Angka teks adalah sumber informasi; bar hanya bobot visual relatif terhadap
 * label paling banyak dipakai (`aria-hidden`). Label tanpa pemakaian tampil
 * sebagai em-dash + teks pembaca layar, bukan angka 0 yang bersuara ganda.
 */
function UsageMeter({ count, max }: { count: number; max: number }) {
  if (count === 0) {
    return (
      <span className="text-muted-foreground/60 text-xs">
        <span aria-hidden>—</span>
        <span className="sr-only">Belum dipakai</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:block sm:w-24"
      >
        <span
          className="block h-full rounded-full bg-brand/70 motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${Math.round((count / max) * 100)}%` }}
        />
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {count}
        <span className="hidden sm:inline"> soal</span>
      </span>
    </span>
  );
}

/** Tiga aksi baris — dipakai bersama oleh kartu mobile & tabel desktop. */
function RowActions({
  tag,
  canMerge,
  onEdit,
  onMerge,
  onDelete,
}: {
  tag: TagRow;
  canMerge: boolean;
  onEdit: (tag: TagRow) => void;
  onMerge: (tag: TagRow) => void;
  onDelete: (tag: TagRow) => void;
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Sunting ${tag.name}`}
        onClick={() => onEdit(tag)}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Gabungkan ${tag.name}`}
        disabled={!canMerge}
        onClick={() => onMerge(tag)}
      >
        <Merge />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Hapus ${tag.name}`}
        onClick={() => onDelete(tag)}
      >
        <Trash2 />
      </Button>
    </>
  );
}

export function LabelsView() {
  const { data, isPending, isError, error } = useTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const del = useDeleteTag();
  const merge = useMergeTags();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<TagRow | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [merging, setMerging] = useState<TagRow | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>("");

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
  function openMerge(t: TagRow) {
    setMerging(t);
    setMergeTarget("");
    setFormErr(null);
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
  const canMerge = (data?.length ?? 0) >= 2;
  /**
   * MAT-131B: bobot visual "Pemakaian" — skala relatif terhadap label terpakai
   * terbanyak. Bar murni dekoratif (`aria-hidden`); angka teks yang jadi
   * sumber informasi bagi pembaca layar.
   */
  const maxUsage = Math.max(1, ...(data ?? []).map((t) => t.usageCount));

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
            <>
              {/* <640px: kartu ringkas — nama utuh, metrik & aksi di baris kedua. */}
              <ul className="flex flex-col divide-y divide-border/60 sm:hidden">
                {data.map((t) => (
                  <li key={t.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <TagIcon
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate font-medium" title={t.name}>
                        {t.name}
                      </span>
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <UsageMeter count={t.usageCount} max={maxUsage} />
                      <div className="flex items-center">
                        <RowActions
                          tag={t}
                          canMerge={canMerge}
                          onEdit={openEdit}
                          onMerge={openMerge}
                          onDelete={setConfirm}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* ≥640px: tabel penuh — fokus Nama, Pemakaian, Aksi (tanpa slug). */}
              <div className="hidden sm:block">
                <Table>
                  <TableCaption>
                    Daftar label soal beserta jumlah pemakaiannya.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[45%]">Label</TableHead>
                      <TableHead>Pemakaian</TableHead>
                      <TableHead className="w-28 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="w-full max-w-0 font-medium">
                          <span className="flex min-w-0 items-center gap-2">
                            <TagIcon
                              aria-hidden
                              className="size-3.5 shrink-0 text-muted-foreground"
                            />
                            <span className="truncate" title={t.name}>
                              {t.name}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <UsageMeter count={t.usageCount} max={maxUsage} />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <RowActions
                            tag={t}
                            canMerge={canMerge}
                            onEdit={openEdit}
                            onMerge={openMerge}
                            onDelete={setConfirm}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
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

      <Dialog open={merging !== null} onOpenChange={(o) => !o && setMerging(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gabungkan label</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Semua soal berlabel &ldquo;{merging?.name}&rdquo; akan dipindah ke label
            tujuan, lalu label ini dihapus. Tindakan ini tak dapat dibatalkan.
          </p>
          <div className="flex flex-col gap-2">
            <label htmlFor="merge-target" className="text-sm font-medium">
              Gabungkan ke
            </label>
            <Select value={mergeTarget} onValueChange={(v) => v && setMergeTarget(v)}>
              <SelectTrigger id="merge-target" className="w-full" aria-label="Label tujuan">
                <SelectValue placeholder="Pilih label tujuan…" />
              </SelectTrigger>
              <SelectContent>
                {(data ?? [])
                  .filter((t) => t.id !== merging?.id)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.usageCount})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {formErr && <p className="text-destructive text-sm">{formErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMerging(null)}>Batal</Button>
            <Button
              disabled={merge.isPending || !mergeTarget}
              onClick={() => {
                if (!merging || !mergeTarget) return;
                setFormErr(null);
                merge.mutate(
                  { sourceId: merging.id, targetId: mergeTarget },
                  {
                    onSuccess: () => setMerging(null),
                    onError: (e) => setFormErr((e as Error).message),
                  },
                );
              }}
            >
              {merge.isPending ? "Menggabungkan…" : "Gabungkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
