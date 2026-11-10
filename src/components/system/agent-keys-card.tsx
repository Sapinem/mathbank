"use client";

import { useState } from "react";
import { KeyRound, Plus, Trash2, Loader2, Copy, Check, TriangleAlert, FileCode } from "lucide-react";
import { toast } from "sonner";
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
  type ApiKeyPreset,
} from "@/lib/hooks/use-agent-keys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [preset, setPreset] = useState<ApiKeyPreset>("read_only_guest");
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const items = data?.items ?? [];

  function submitCreate() {
    create.mutate(
      {
        name: name.trim() || undefined,
        expiresInDays: Number(expiresDays) || 0,
        preset,
      },
      {
        onSuccess: (res) => {
          setNewKey(res.key);
          setName("");
          setExpiresDays("90");
          setPreset("read_only_guest");
          toast.success("API key berhasil dibuat.");
        },
        onError: (e) => {
          toast.error("Gagal membuat kunci", { description: (e as Error).message });
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
          <KeyRound className="size-4" /> Manajemen API Key & Akses Agen
        </CardTitle>
        <CardDescription>
          Kelola API key untuk integrasi REST API pihak ketiga, pembaca tamu, dan agen AI (MCP).
          Kunci hanya ditampilkan sekali saat dibuat dan disimpan dalam bentuk hash.
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
                Belum ada API key. Buat satu untuk akses agen MCP atau integrasi pihak ketiga.
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
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus data-icon="inline-start" /> Buat kunci baru
              </Button>
              <a
                href="/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                <FileCode className="size-3.5" /> Spesifikasi OpenAPI (/openapi.json)
              </a>
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
            <DialogTitle>Buat API key baru</DialogTitle>
            <DialogDescription>
              Tentukan tipe akses, nama, dan masa berlaku kunci API (0 = tanpa kedaluwarsa).
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
                <label htmlFor="key-preset" className="text-sm font-medium">
                  Tipe Akses (Preset)
                </label>
                <Select
                  value={preset}
                  onValueChange={(v) => v && setPreset(v as ApiKeyPreset)}
                >
                  <SelectTrigger id="key-preset" className="w-full" aria-label="Tipe akses preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read_only_guest">
                      Read-Only Tamu (Publik / Siswa)
                    </SelectItem>
                    <SelectItem value="read_only_full">
                      Read-Only Pendidik (LMS / Auditor)
                    </SelectItem>
                    <SelectItem value="agent_full">
                      Agen MCP (Full Access)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {preset === "read_only_guest" &&
                    "Akses baca katalog soal & paket. Kunci jawaban dan pembahasan disembunyikan otomatis."}
                  {preset === "read_only_full" &&
                    "Akses baca katalog soal & paket lengkap, termasuk kunci jawaban dan pembahasan."}
                  {preset === "agent_full" &&
                    "Akses agen AI MCP untuk menyusun, mengedit, dan menjalankan pengayaan soal."}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="key-name" className="text-sm font-medium">
                  Nama
                </label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    preset === "read_only_guest"
                      ? "mis. Aplikasi Tamu / Siswa"
                      : preset === "read_only_full"
                        ? "mis. Integrasi Moodle LMS"
                        : "mis. Claude Desktop"
                  }
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
              Klien atau agen yang memakai kunci ini akan langsung kehilangan akses. Tindakan
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
              onClick={() => {
                if (!revokeId) return;
                const targetKey = items.find((k) => k.id === revokeId);
                revoke.mutate(
                  { id: revokeId, version: targetKey?.version },
                  {
                    onSuccess: () => {
                      setRevokeId(null);
                      toast.success("API key berhasil dicabut.");
                    },
                    onError: (e) =>
                      toast.error("Gagal mencabut API key", {
                        description: (e as Error).message,
                      }),
                  },
                );
              }}
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

function PresetBadge({ preset }: { preset?: ApiKeyPreset }) {
  switch (preset) {
    case "read_only_guest":
      return <Badge variant="secondary">Tamu (Read-Only)</Badge>;
    case "read_only_full":
      return (
        <Badge
          variant="outline"
          className="border-blue-500/40 text-blue-600 dark:text-blue-400"
        >
          Pendidik (Read-Only)
        </Badge>
      );
    case "agent_full":
    default:
      return <Badge variant="default">Agen MCP</Badge>;
  }
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{k.name || "API Key"}</span>
          <PresetBadge preset={k.preset} />
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
