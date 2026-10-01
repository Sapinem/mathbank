"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Trash2, ImageOff, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import {
  useMediaPage,
  useOrphanAssets,
  useDeleteMedia,
  type MediaListItem,
} from "@/lib/hooks/use-media";
import { MEDIA_ORIGIN_LABELS } from "@/lib/display/labels";
import { formatBytes } from "@/lib/display/format";

/**
 * Halaman Galeri Aset `/assets` (G4.6).
 *
 * State ada di URL (bookmarkable) — mengikuti pola `question-bank-view`:
 * `?q=` pencarian · `?origin=` filter asal · `?page=` halaman · `?hygiene=1` panel orphan.
 */
const PAGE_SIZE = 24;

export function AssetGalleryView() {
  const router = useRouter();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const origin = params.get("origin") ?? undefined;
  const page = Math.max(0, Number(params.get("page") ?? "0") || 0);
  const hygieneOpen = params.get("hygiene") === "1";

  const [search, setSearch] = useState(q);

  const list = useMediaPage({ q: q || undefined, origin, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const orphans = useOrphanAssets(hygieneOpen);

  /** Tulis satu perubahan ke URL tanpa kehilangan parameter lain. */
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    // Filter baru selalu kembali ke halaman pertama.
    if (key !== "page") next.delete("page");
    router.push(`/assets?${next.toString()}`);
  }

  const total = list.data?.total ?? 0;
  const items = list.data?.data ?? [];
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Galeri Aset"
        description="Semua gambar yang tersimpan: dicari, diperiksa, dan dirapikan."
      />

      {/* Baris kendali: pencarian, filter asal, panel hygiene. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", search.trim() || null);
          }}
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul gambar…"
            aria-label="Cari aset"
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              aria-label="Bersihkan pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearch("");
                setParam("q", null);
              }}
            >
              <X className="size-4" />
            </button>
          )}
        </form>

        <Select
          value={origin ?? "all"}
          onValueChange={(v) => setParam("origin", v === "all" ? null : v)}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter asal aset">
            <SelectValue placeholder="Semua asal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua asal</SelectItem>
            {Object.entries(MEDIA_ORIGIN_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant={hygieneOpen ? "default" : "outline"}
          onClick={() => setParam("hygiene", hygieneOpen ? null : "1")}
        >
          <ShieldAlert className="size-4" />
          Rapikan
        </Button>
      </div>

      {hygieneOpen && <HygienePanel orphans={orphans} />}

      {/* Isi galeri. */}
      {list.isLoading ? (
        <LoadingState label="Memuat galeri…" />
      ) : list.isError ? (
        <ErrorState
          title="Gagal memuat galeri"
          description="Periksa koneksi lalu coba lagi."
          action={
            <Button variant="outline" size="sm" onClick={() => void list.refetch()}>
              Coba lagi
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={q || origin ? "Tidak ada aset yang cocok" : "Galeri masih kosong"}
          description={
            q || origin
              ? "Coba ubah kata kunci atau filter asal."
              : "Aset muncul di sini setelah Anda mengunggah gambar dari editor soal atau ingest."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <AssetCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Paginasi. */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Menampilkan {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setParam("page", String(page - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setParam("page", String(page + 1))}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Satu ubin aset — gambar + judul + asal. */
function AssetCard({ item }: { item: MediaListItem }) {
  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-border p-2">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- media dari storage lokal, bukan CDN. */}
        <img
          src={`/img/${item.shortId}`}
          alt={item.altText ?? item.title}
          loading="lazy"
          className="size-full object-contain"
        />
      </div>
      <figcaption className="flex flex-col gap-1">
        <span className="line-clamp-1 text-sm font-medium" title={item.title}>
          {item.title}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">
            {MEDIA_ORIGIN_LABELS[item.sourceOrigin] ?? item.sourceOrigin}
          </Badge>
          {item.fileSize != null && <span>{formatBytes(item.fileSize)}</span>}
        </span>
        <code className="font-mono text-[10px] text-muted-foreground">
          {"{{img:" + item.shortId + "}}"}
        </code>
      </figcaption>
    </figure>
  );
}

/**
 * Panel hygiene: daftar aset yang TIDAK dipakai soal mana pun.
 *
 * **Melaporkan dulu, menghapus hanya bila ditekan.** Tidak ada penghapusan otomatis —
 * aset "orphan" bisa jadi memang baru diunggah dan belum sempat dipakai.
 */
function HygienePanel({
  orphans,
}: {
  orphans: ReturnType<typeof useOrphanAssets>;
}) {
  const del = useDeleteMedia();
  const [error, setError] = useState<string | null>(null);

  if (orphans.isLoading) return <LoadingState label="Memeriksa aset tak terpakai…" />;
  if (orphans.isError) {
    return (
      <ErrorState
        title="Gagal memeriksa aset"
        action={
          <Button variant="outline" size="sm" onClick={() => void orphans.refetch()}>
            Coba lagi
          </Button>
        }
      />
    );
  }

  const data = orphans.data?.data ?? [];

  return (
    <section
      aria-label="Aset tak terpakai"
      className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Aset tak terpakai</h2>
        <p className="text-xs text-muted-foreground">
          {orphans.data?.total ?? 0} aset · {formatBytes(orphans.data?.totalBytes ?? 0)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Aset ini belum dirujuk soal mana pun. Menghapus akan membuang barisnya <em>dan</em> berkas
        gambarnya dari penyimpanan — pastikan benar-benar tidak dibutuhkan.
      </p>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {data.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Bersih — tidak ada aset yang menganggur.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {data.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-2">
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                <ImageOff className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-1 text-sm">{o.title}</span>
                <code className="font-mono text-[10px] text-muted-foreground">
                  {o.shortId}
                  {o.fileSize != null && ` · ${formatBytes(o.fileSize)}`}
                </code>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={del.isPending}
                onClick={() => {
                  setError(null);
                  del.mutate(o.shortId, {
                    onError: (e) =>
                      setError(e instanceof Error ? e.message : "Gagal menghapus aset."),
                  });
                }}
              >
                {del.isPending && del.variables === o.shortId ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
