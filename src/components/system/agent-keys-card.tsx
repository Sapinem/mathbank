"use client";

import { useState } from "react";
import { KeyRound, Plus, Trash2, Loader2, Copy, Check, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import {
  useAgentKeys,
  useCreateAgentKey,
  useRevokeAgentKey,
  type AgentKeyInfo,
} from "@/lib/hooks/use-agent-keys";

/**
 * Kartu "Akses Agen" (M11-e) — kelola API key untuk agen MCP.
 *
 * Nilai kunci penuh ditampilkan **sekali** saat dibuat; setelah itu DB hanya
 * menyimpan hash. Kunci dapat dicabut kapan saja.
 */
export function AgentKeysCard() {
  const { data, isLoading, isError, error } = useAgentKeys();
  const create = useCreateAgentKey();
  const revoke = useRevokeAgentKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiresDays, setExpiresDays] = useState("90");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const items = data?.items ?? [];

  function submitCreate() {
    create.mutate(
      {
        name: name.trim() || undefined,
        expiresInDays: Number(expiresDays) || 0,
      },
      {
        onSuccess: (res) => {
          setNewKey(res.key);
          setName("");
          setExpiresDays("90");
        },
      },
    );
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard?.writeText(newKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Akses Agen (MCP)
        </CardTitle>
        <CardDescription>
          API key untuk agen AI (Claude, Cursor, dsb.) mengakses MathBank lewat MCP.
          Agen <strong>tidak pernah</strong> melihat kunci jawaban. Kunci hanya
          ditampilkan sekali saat dibuat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {isError && <ErrorState description={(error as Error)?.message} />}

        {!isLoading && !isError && (
          <>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada kunci. Buat satu untuk menghubungkan agen MCP.
              </p>
            ) : (
              <ul className="flex flex-col divide-y rounded-md border">
                {items.map((k) => (
                  <KeyRow
                    key={k.id}
                    k={k}
                    onRevoke={() => setRevokeId(k.id)}
                    revoking={revoke.isPending && revokeId === k.id}
                  />
                ))}
              </ul>
            )}
            <div>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus data-icon="inline-start" /> Buat kunci baru
              </Button>
            </div>
          </>
        )}
      </CardContent>

      {/* Dialog buat kunci */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setNewKey(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat API key agen</DialogTitle>
            <DialogDescription>
              Beri nama untuk membedakan agen. Atur masa berlaku (0 = tanpa kedaluwarsa).
            </DialogDescription>
          </DialogHeader>

          {newKey ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 rounded-md border border-brand/40 bg-brand/5 p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand" />
                <p>
                  Salin kunci ini <strong>sekarang</strong>. Setelah dialog ditutup,
                  nilainya tak bisa dilihat lagi.
                </p>
              </div>
              <div className="flex gap-2">
                <Input readOnly value={newKey} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyKey} aria-label="Salin">
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="key-name" className="text-sm font-medium">
                  Nama
                </label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Claude Desktop"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="key-exp" className="text-sm font-medium">
                  Berlaku (hari)
                </label>
                <Input
                  id="key-exp"
                  type="number"
                  min={0}
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                />
              </div>
              {create.isError && (
                <p className="text-sm text-destructive">{(create.error as Error)?.message}</p>
              )}
            </div>
          )}

          <DialogFooter>
            {newKey ? (
              <Button onClick={() => setCreateOpen(false)}>Selesai</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Batal
                </Button>
                <Button onClick={submitCreate} disabled={create.isPending}>
                  {create.isPending && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  Buat
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog cabut */}
      <Dialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cabut kunci ini?</DialogTitle>
            <DialogDescription>
              Agen yang memakai kunci ini akan langsung kehilangan akses. Tindakan
              ini tak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeId(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() =>
                revokeId &&
                revoke.mutate(revokeId, { onSuccess: () => setRevokeId(null) })
              }
            >
              {revoke.isPending && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Cabut
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function KeyRow({
  k,
  onRevoke,
  revoking,
}: {
  k: AgentKeyInfo;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const expired = k.expiresAt ? new Date(k.expiresAt) < new Date() : false;
  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{k.name || "Agen MCP"}</span>
          {expired ? (
            <Badge variant="destructive">kedaluwarsa</Badge>
          ) : (
            <Badge variant={k.enabled ? "secondary" : "outline"}>
              {k.enabled ? "aktif" : "nonaktif"}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {k.prefix ? `${k.prefix}…` : "•••"} · dibuat{" "}
          {k.createdAt ? new Date(k.createdAt).toLocaleDateString("id-ID") : "—"} · dipakai{" "}
          {k.requestCount ?? 0}×
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onRevoke} disabled={revoking} aria-label="Cabut">
        <Trash2 />
      </Button>
    </li>
  );
}
