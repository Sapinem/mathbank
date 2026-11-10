"use client";

import { useState } from "react";
import { ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { buildTree, type TopicTree, type TopicNode } from "@/lib/taxonomy/tree";
import {
  useTopicList,
  useCreateTopic,
  useUpdateTopic,
  useDeleteTopic,
  type TopicInput,
} from "@/lib/hooks/use-taxonomy";

const LEVEL_LABELS = ["", "Kategori", "Topik", "SubTopik"];

/**
 * Halaman Topik (M5) — pohon 3-level + tambah/sunting/hapus.
 * Anti-siklus & RESTRICT ditegakkan server; pesan error ditampilkan apa adanya.
 */
export function TopicsView() {
  const { data, isLoading, isError, error } = useTopicList();
  const [dialog, setDialog] = useState<
    | { mode: "create"; parentId: string | null }
    | { mode: "edit"; topic: TopicNode }
    | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<TopicNode | null>(null);

  const del = useDeleteTopic();

  if (isLoading) return <LoadingState label="Memuat topik…" />;
  if (isError) return <ErrorState title="Gagal memuat topik" description={error?.message} />;

  const flat = data ?? [];
  const tree = buildTree(flat);

  return (
    <div className="flex flex-col gap-0">
      <PageHeader
        title="Topik"
        description="Kelola hierarki topik matematika (Kategori › Topik › SubTopik)."
        actions={
          <Button size="sm" onClick={() => setDialog({ mode: "create", parentId: null })}>
            <Plus data-icon="inline-start" /> Kategori Baru
          </Button>
        }
      />
      <div className="p-6">
        {tree.length === 0 ? (
          <EmptyState
            title="Belum ada topik"
            description="Mulai dengan membuat kategori pertama."
            action={
              <Button
                size="sm"
                className="mt-2"
                onClick={() => setDialog({ mode: "create", parentId: null })}
              >
                <Plus data-icon="inline-start" /> Kategori Baru
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="pt-4">
              <ul className="flex flex-col gap-1">
                {tree.map((node) => (
                  <TopicBranch
                    key={node.id}
                    node={node}
                    depth={0}
                    onAdd={(parentId) => setDialog({ mode: "create", parentId })}
                    onEdit={(topic) => setDialog({ mode: "edit", topic })}
                    onDelete={(topic) => setConfirmDelete(topic)}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {dialog && (
        <TopicDialog
          open
          onClose={() => setDialog(null)}
          mode={dialog.mode}
          parentId={dialog.mode === "create" ? dialog.parentId : null}
          topic={dialog.mode === "edit" ? dialog.topic : null}
          flat={flat}
        />
      )}

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus topik ini?</DialogTitle>
            <DialogDescription>
              &ldquo;{confirmDelete?.name}&rdquo; akan dihapus. Ditolak bila masih punya
              sub-topik atau dipakai soal.
            </DialogDescription>
          </DialogHeader>
          {del.error && (
            <p className="text-sm text-destructive">{del.error.message}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => {
                if (!confirmDelete) return;
                del.mutate(
                  { id: confirmDelete.id, version: confirmDelete.version },
                  {
                    onSuccess: () => {
                      setConfirmDelete(null);
                      toast.success("Topik dihapus.");
                    },
                    onError: (e) =>
                      toast.error("Gagal menghapus topik", { description: e.message }),
                  },
                );
              }}
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TopicBranch({
  node,
  depth,
  onAdd,
  onEdit,
  onDelete,
}: {
  node: TopicTree;
  depth: number;
  onAdd: (parentId: string) => void;
  onEdit: (topic: TopicNode) => void;
  onDelete: (topic: TopicNode) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className="group flex min-h-[44px] items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          type="button"
          aria-label={open ? "Tutup" : "Buka"}
          aria-expanded={hasChildren ? open : undefined}
          onClick={() => setOpen((v) => !v)}
          className="grid min-h-[44px] min-w-[44px] place-items-center text-muted-foreground"
        >
          {hasChildren ? (
            <ChevronRight
              className={
                open
                  ? "size-4 rotate-90 motion-safe:transition-transform"
                  : "size-4 motion-safe:transition-transform"
              }
            />
          ) : (
            <span className="size-4" />
          )}
        </button>

        <span className="text-sm font-medium">{node.name}</span>
        <Badge variant="outline" className="text-[10px]">
          {LEVEL_LABELS[node.level] ?? `L${node.level}`}
        </Badge>
        {node.usageCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {node.usageCount} soal
          </span>
        )}

        {/* MAJ — aksi selalu terlihat di perangkat sentuh; reveal-on-hover
            hanya pada pointer presisi (desktop) agar pohon topik tetap rapi.
            (CONSTRAINT #11: target sentuh ≥ 44px.) */}
        <span className="ml-auto flex items-center gap-1 opacity-100 pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100">
          {depth < 2 && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Tambah sub-topik di ${node.name}`}
              onClick={() => onAdd(node.id)}
              className="min-h-[44px] min-w-[44px]"
            >
              <Plus />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Sunting ${node.name}`}
            onClick={() => onEdit(node)}
            className="min-h-[44px] min-w-[44px]"
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Hapus ${node.name}`}
            onClick={() => onDelete(node)}
            className="min-h-[44px] min-w-[44px]"
          >
            <Trash2 />
          </Button>
        </span>
      </div>

      {open && hasChildren && (
        <ul className="flex flex-col gap-1">
          {node.children.map((child) => (
            <TopicBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function TopicDialog({
  open,
  onClose,
  mode,
  parentId,
  topic,
  flat,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  parentId: string | null;
  topic: TopicNode | null;
  flat: TopicNode[];
}) {
  const create = useCreateTopic();
  const update = useUpdateTopic();
  const [name, setName] = useState(topic?.name ?? "");
  const [parent, setParent] = useState<string | null>(
    mode === "edit" ? (topic?.parentId ?? null) : parentId,
  );

  const pending = create.isPending || update.isPending;
  const err = create.error ?? update.error;

  // Pilihan induk: hanya level 1–2 yang boleh jadi induk (agar anak ≤ level 3).
  const parentOptions = flat.filter((t) => t.level <= 2 && t.id !== topic?.id);

  function submit() {
    const input: TopicInput = {
      name: name.trim(),
      parentId: parent,
    };
    if (mode === "create") {
      create.mutate(input, {
        onSuccess: () => {
          toast.success("Topik baru dibuat.");
          onClose();
        },
        onError: (e) => toast.error("Gagal membuat topik", { description: e.message }),
      });
    } else if (topic) {
      update.mutate(
        { id: topic.id, input, version: topic.version },
        {
          onSuccess: () => {
            toast.success("Perubahan topik disimpan.");
            onClose();
          },
          onError: (e) => toast.error("Gagal menyimpan topik", { description: e.message }),
        },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? parent
                ? "Sub-topik Baru"
                : "Kategori Baru"
              : "Sunting Topik"}
          </DialogTitle>
          <DialogDescription>
            Level ditentukan otomatis dari induk (maksimum 3 level).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="topic-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Nama
            </label>
            <Input
              id="topic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Aljabar"
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Induk</span>
            <select
              value={parent ?? ""}
              onChange={(e) => setParent(e.target.value || null)}
              aria-label="Induk topik"
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="">— (tanpa induk / Kategori)</option>
              {parentOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {"  ".repeat(t.level - 1)}
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {err && <p className="text-sm text-destructive">{err.message}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {mode === "create" ? "Buat" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
