"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaList, useUploadMedia } from "@/lib/hooks/use-media";

/**
 * Pemilih gambar untuk editor soal (G4.5).
 *
 * Guru mencari/memilih gambar dari galeri, atau mengunggah baru. Hasilnya
 * shortcode `{{img:<shortId>}}` yang disisipkan ke markdown soal.
 *
 * Semua unggahan lewat `/api/media/upload` → `mediaService`, sehingga gambar
 * guru ikut terdaftar (punya short_id) dan tidak menjadi orphan.
 */
export function AssetPickerModal({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Dipanggil dengan shortcode siap-sisip. */
  onPick: (shortcode: string) => void;
}) {
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMediaList(q, undefined, open);
  const upload = useUploadMedia();

  function handleUpload(file: File) {
    setError(null);
    upload.mutate(file, {
      onSuccess: (res) => {
        onPick(res.shortcode);
        onOpenChange(false);
      },
      onError: (e) => setError(e instanceof Error ? e.message : "Gagal mengunggah gambar."),
    });
  }

  const items = list.data?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pilih Gambar</DialogTitle>
          <DialogDescription>
            Cari dari galeri, atau unggah gambar baru. Gambar disisipkan ke soal
            sebagai shortcode.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari judul gambar…"
                aria-label="Cari gambar"
                className="pl-9"
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = ""; // agar berkas sama bisa diunggah ulang
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {upload.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Mengunggah…
                </>
              ) : (
                <>
                  <ImagePlus className="size-4" />
                  Unggah
                </>
              )}
            </Button>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <div className="max-h-[420px] overflow-y-auto">
            {list.isLoading ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))}
              </div>
            ) : list.isError ? (
              <p role="alert" className="py-10 text-center text-sm text-destructive">
                Gagal memuat galeri media.
              </p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {q
                  ? "Tidak ada gambar yang cocok."
                  : "Galeri masih kosong — unggah gambar pertama."}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onPick(`{{img:${m.shortId}}}`);
                      onOpenChange(false);
                    }}
                    className="group flex min-h-11 flex-col gap-1.5 rounded-md border border-border p-1.5 text-left transition-colors hover:border-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    title={m.title}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- media dari storage lokal, bukan CDN. */}
                    <img
                      src={`/img/${m.shortId}`}
                      alt={m.title}
                      loading="lazy"
                      className="aspect-square w-full rounded object-contain"
                    />
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {m.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!list.isLoading && items.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Menampilkan {items.length} dari {list.data?.total ?? items.length} gambar.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
