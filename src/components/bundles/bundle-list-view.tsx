"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Copy, Archive, NotebookPen } from "lucide-react";
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
  useBundles,
  useCreateBundle,
  useArchiveBundle,
  useDuplicateBundle,
} from "@/lib/hooks/use-bundles";
import type { BundleRow, BundleType } from "@/lib/services/bundle-service";

const TYPE_LABELS: Record<BundleType, string> = {
  source: "Sumber",
  exam: "Ujian",
  exercise: "Latihan",
};

const STATUS_LABELS: Record<BundleRow["status"], string> = {
  draft: "Draf",
  review: "Telaah",
  ready: "Siap",
  archived: "Arsip",
};

export function BundleListView() {
  const { data, isPending, isError, error } = useBundles();
  const create = useCreateBundle();
  const archive = useArchiveBundle();
  const duplicate = useDuplicateBundle();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<BundleType>("exam");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<BundleRow | null>(null);

  function submit() {
    setFormErr(null);
    create.mutate(
      { title: title.trim(), bundleType: type },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
        },
        onError: (e) => setFormErr((e as Error).message),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Paket Soal"
        description="Susun naskah ujian, latihan, atau sumber dari bank soal."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" /> Paket Baru
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Daftar Paket</CardTitle>
          <CardDescription>{data ? `${data.length} paket` : "Memuat…"}</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <LoadingState label="Memuat paket…" />
          ) : isError ? (
            <ErrorState title="Gagal memuat paket" description={(error as Error).message} />
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada paket soal.</p>
          ) : (
            <Table>
              <TableCaption>Daftar paket soal.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Judul</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Tahun</TableHead>
                  <TableHead className="text-right">Soal</TableHead>
                  <TableHead className="text-right">Durasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      <Link href={`/bundles/${b.id}`} className="hover:underline">
                        {b.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{TYPE_LABELS[b.bundleType]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {b.year ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.itemCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.durationMinutes ? `${b.durationMinutes} mnt` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{STATUS_LABELS[b.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Duplikat ${b.title}`}
                        onClick={() => duplicate.mutate(b.id)}
                      >
                        <Copy />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Arsipkan ${b.title}`}
                        onClick={() => setConfirm(b)}
                      >
                        <Archive />
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
            <DialogTitle>Paket Baru</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="b-title" className="text-sm font-medium">Judul</label>
              <Input
                id="b-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="mis. UTS Matematika Kelas X Ganjil"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="b-type" className="text-sm font-medium">Jenis</label>
              <Select value={type} onValueChange={(v) => setType(v as BundleType)}>
                <SelectTrigger id="b-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.keys(TYPE_LABELS) as BundleType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {formErr && <p className="text-destructive text-sm">{formErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={create.isPending || title.trim() === ""}>
              <NotebookPen data-icon="inline-start" />
              {create.isPending ? "Membuat…" : "Buat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arsipkan paket?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            &ldquo;{confirm?.title}&rdquo; akan diarsipkan (bisa dipulihkan). Paket
            hilang dari daftar.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Batal</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm) return;
                archive.mutate(confirm.id, {
                  onSuccess: () => setConfirm(null),
                  onError: (e) => setFormErr((e as Error).message),
                });
              }}
            >
              Arsipkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
