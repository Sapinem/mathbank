"use client";

import { useState } from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTopicList } from "@/lib/hooks/use-taxonomy";
import type { TopicNode } from "@/lib/taxonomy/tree";

/**
 * Pemilih topik (multi-pilih) untuk EDITOR SOAL.
 *
 * Membangun ulang hierarki 3 level dari daftar datar `/api/topics`
 * (Kategori › Topik › SubTopik) — karena 174 topik terlalu banyak untuk
 * ditampilkan rata. Induk yang punya anak menjadi **judul grup**, bukan
 * pilihan; yang dapat dipilih adalah **daun** (level terdalam).
 *
 * Aturan proyek yang dipatuhi:
 *  - `flex flex-col gap-*`, TANPA `space-y-*` (CONSTRAINTS #7).
 *  - Touch target ≥ 44px di mobile (#11); tak mengandalkan `hover:` saja.
 *  - Tanpa `useMemo`/`useCallback` (#6) — komputasi langsung saat render.
 */
export function TopicPicker({
  value,
  onChange,
  disabled = false,
}: {
  /** ID topik terpilih (daun). */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const { data: topics, isLoading } = useTopicList();

  const all: TopicNode[] = topics ?? [];
  const byId = new Map(all.map((t) => [t.id, t]));

  /** Anak langsung dari sebuah id. */
  function childrenOf(parentId: string | null): TopicNode[] {
    return all
      .filter((t) => (t.parentId ?? null) === parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }

  /** Apakah node punya anak (= judul grup, bukan pilihan). */
  function isGroup(id: string): boolean {
    return all.some((t) => t.parentId === id);
  }

  /** Jalur nama lengkap (untuk label pencarian & chip). */
  function pathOf(id: string): string {
    const names: string[] = [];
    let cur = byId.get(id);
    let guard = 0;
    while (cur && guard++ < 10) {
      names.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return names.join(" › ");
  }

  const needle = search.trim().toLowerCase();
  const matching = needle
    ? all.filter((t) => t.name.toLowerCase().includes(needle))
    : [];

  function toggle(id: string) {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  /** Satu baris pilihan (daun). */
  function LeafRow({ node }: { node: TopicNode }) {
    const checked = value.includes(node.id);
    const path = pathOf(node.id);
    return (
      <button
        type="button"
        onClick={() => toggle(node.id)}
        disabled={disabled}
        aria-pressed={checked}
        // Nama pendek untuk pembaca layar & pencarian tes; jalur lengkap di `title`.
        aria-label={node.name}
        title={path}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-50",
          checked
            ? "bg-brand/15 font-medium text-brand"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted/50",
        )}
      >
        <span className="truncate">{node.name}</span>
        {checked && <Check className="size-3.5 shrink-0 text-brand" />}
      </button>
    );
  }

  /** Grup + daun-daunnya (rekursif, maks 3 level). */
  function Group({ node, depth }: { node: TopicNode; depth: number }) {
    const kids = childrenOf(node.id);
    return (
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "px-2.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
            depth > 1 && "normal-case tracking-normal",
          )}
        >
          {node.name}
        </span>
        {kids.map((k) => (isGroup(k.id) ? <Group key={k.id} node={k} depth={depth + 1} /> : <LeafRow key={k.id} node={k} />))}
      </div>
    );
  }

  const roots = childrenOf(null);
  const leafRoots = roots.filter((r) => !isGroup(r.id));
  const groupRoots = roots.filter((r) => isGroup(r.id));

  return (
    <div className="flex flex-col gap-2">
      {/* Terpilih */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-48 truncate">{pathOf(id) || id}</span>
              <button
                type="button"
                onClick={() => toggle(id)}
                disabled={disabled}
                aria-label={`Hapus ${pathOf(id)}`}
                className="grid size-4 place-items-center rounded-full hover:bg-muted-foreground/20 disabled:opacity-50"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Pencarian */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari topik…"
          disabled={disabled}
          className="h-9 pl-8 text-base"
          aria-label="Cari topik"
        />
      </div>

      {/* Hasil */}
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-md border border-border/60 p-1">
        {isLoading ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">Memuat topik…</p>
        ) : needle ? (
          matching.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Topik tidak ditemukan.</p>
          ) : (
            matching.map((t) =>
              isGroup(t.id) ? (
                // Grup yang cocok: tampilkan daun-daunnya agar bisa dipilih.
                <Group key={t.id} node={t} depth={1} />
              ) : (
                <div key={t.id} className="flex flex-col">
                  <span className="truncate px-2.5 pt-1 text-[10px] text-muted-foreground">
                    {pathOf(t.id).split(" › ").slice(0, -1).join(" › ")}
                  </span>
                  <LeafRow node={t} />
                </div>
              ),
            )
          )
        ) : all.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Belum ada topik. Tambahkan di Referensi › Topik.
          </p>
        ) : (
          <>
            {groupRoots.map((g) => (
              <Group key={g.id} node={g} depth={1} />
            ))}
            {leafRoots.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className="px-2.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Lainnya
                </span>
                {leafRoots.map((r) => (
                  <LeafRow key={r.id} node={r} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
