"use client";

import { useState } from "react";
import { ImageOff, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEDIA_ROLE_LABELS } from "@/lib/display/labels";

/**
 * Penyaji media soal (Sprint 1 · MAT-127 / ACT-08).
 *
 * KENAPA short_id, bukan path: markdown soal menyimpan `{{img:<shortId>}}`,
 * dan route `/img/{shortId}` yang menerjemahkan ke berkas nyata. Komponen ini
 * memakai jalur yang SAMA agar gambar di galeri & di dalam naskah tak pernah
 * berbeda sumber.
 *
 * Tiga keadaan yang WAJIB ditangani (bukan ruang kosong tanpa penjelasan):
 *  1. ada media → `<img>` dengan rasio terjaga (`width`/`height` dari DB);
 *  2. media gagal dimuat → kotak "gagal dimuat" + shortId (guru bisa lapor);
 *  3. tak ada media → pemanggil menampilkan `QuestionMediaEmpty`.
 */

/** Bentuk minimal aset media yang dibutuhkan renderer (cocok `QuestionMediaView`). */
export interface QuestionImageAsset {
  shortId: string;
  altText?: string | null;
  caption?: string | null;
  role?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
}

/** Shortcode media di markdown — sinkron dengan `src/lib/media/shortcode.ts`. */
const IMG_SHORTCODE = /\{\{\s*img\s*:\s*([0-9A-Za-z]{8})\s*\}\}/g;

/**
 * Ambil seluruh shortId gambar dari sebuah markdown.
 * Dipakai untuk memberi tahu guru bahwa naskah memuat gambar walau
 * `question_media` belum terisi (kasus transisi ingest → enrichment).
 */
export function extractMediaShortIds(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const ids = new Set<string>();
  for (const m of markdown.matchAll(IMG_SHORTCODE)) {
    if (m[1]) ids.add(m[1]);
  }
  return [...ids];
}

/** Apakah markdown memuat sedikitnya satu shortcode gambar? */
export function hasInlineMedia(markdown: string | null | undefined): boolean {
  return extractMediaShortIds(markdown).length > 0;
}

/** Satu gambar soal + keterangan. */
export function QuestionImage({
  asset,
  className,
  imageClassName,
  showCaption = true,
  priority = false,
}: {
  asset: QuestionImageAsset;
  className?: string;
  imageClassName?: string;
  showCaption?: boolean;
  /** `true` untuk gambar utama di atas lipatan (hindari lazy-load). */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const alt =
    asset.altText?.trim() ||
    asset.caption?.trim() ||
    `Gambar soal ${asset.shortId}`;

  if (failed) {
    return (
      <figure
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center",
          className,
        )}
        role="img"
        aria-label={`Gambar ${asset.shortId} gagal dimuat`}
      >
        <ImageOff aria-hidden className="size-5 text-muted-foreground" />
        <figcaption className="text-xs text-muted-foreground">
          Gambar tidak dapat dimuat.
          <span className="ml-1 font-mono text-[11px] opacity-80">
            {asset.shortId}
          </span>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={cn("flex flex-col items-center gap-1.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- media storage lokal; next/image butuh loader khusus. */}
      <img
        src={`/img/${asset.shortId}`}
        alt={alt}
        width={asset.width ?? undefined}
        height={asset.height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className={cn(
          "h-auto max-h-[28rem] w-auto max-w-full rounded-lg border border-border/80 bg-background object-contain",
          imageClassName,
        )}
      />
      {showCaption && (asset.caption || asset.altText) && (
        <figcaption className="max-w-prose text-center text-xs leading-snug text-muted-foreground">
          {asset.caption ?? asset.altText}
        </figcaption>
      )}
    </figure>
  );
}

/** Keadaan "belum ada media" — eksplisit, bukan ruang kosong. */
export function QuestionMediaEmpty({
  hint,
  className,
}: {
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-center",
        className,
      )}
    >
      <Images aria-hidden className="size-5 text-muted-foreground/70" />
      <p className="max-w-sm text-xs leading-snug text-muted-foreground">
        {hint ?? "Belum ada gambar yang tertaut ke soal ini."}
      </p>
    </div>
  );
}

/**
 * Galeri media soal — mengelompokkan aset sesuai `role` (isi/opsi/pembahasan).
 * Dipakai di halaman detail & (nanti) layar kurasi Sprint 2.
 */
export function QuestionMediaGallery({
  media,
  emptyHint,
  className,
}: {
  media: QuestionImageAsset[];
  emptyHint?: string;
  className?: string;
}) {
  if (media.length === 0) return <QuestionMediaEmpty hint={emptyHint} />;

  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {media.map((asset, i) => (
        <li key={asset.shortId} className="flex flex-col gap-1">
          {asset.role && asset.role !== "content" && (
            <span className="w-fit rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {MEDIA_ROLE_LABELS[asset.role] ?? asset.role}
            </span>
          )}
          <QuestionImage asset={asset} priority={i === 0} />
        </li>
      ))}
    </ul>
  );
}
