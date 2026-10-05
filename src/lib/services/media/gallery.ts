/**
 * Galeri & metadata aset media (L5) — pecahan `media-service.ts`.
 *
 * Proyeksi kolom EKSPLISIT (CONSTRAINTS #34) — jangan `.select()` tanpa kolom.
 * Dipakai AssetPicker & halaman /assets.
 *
 * ⚠️ JANGAN impor dari komponen klien (menarik `@/lib/db`).
 */
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAssets, questionMedia } from "@/lib/db/schema/media";
import { GALLERY_COLUMNS, type MediaOrigin } from "./shared";
import { findAssetByShortId } from "./hygiene";

/** Daftar aset untuk galeri/picker, dengan pencarian judul & filter asal. */
export async function listMedia(opts: {
  q?: string | undefined;
  origin?: MediaOrigin | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}) {
  const filters = [];
  if (opts.q) filters.push(ilike(mediaAssets.title, `%${opts.q}%`));
  if (opts.origin) filters.push(eq(mediaAssets.sourceOrigin, opts.origin));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const rows = await db
    .select(GALLERY_COLUMNS)
    .from(mediaAssets)
    .where(where)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(opts.limit ?? 24)
    .offset(opts.offset ?? 0);

  const [countRow] = await db
    .select({ total: count() })
    .from(mediaAssets)
    .where(where);

  return { data: rows, total: Number(countRow?.total ?? 0) };
}

/** Detail satu aset + daftar soal yang memakainya (arah balik junction). */
export async function getMediaDetail(shortId: string) {
  const asset = await findAssetByShortId(shortId);
  if (!asset) return null;

  const usedBy = await db
    .select({
      questionId: questionMedia.questionId,
      role: questionMedia.role,
      orderIndex: questionMedia.orderIndex,
    })
    .from(questionMedia)
    .where(eq(questionMedia.mediaId, asset.id))
    .orderBy(questionMedia.questionId);

  return { asset, usedBy };
}

/** Ubah metadata aset (judul/alt/caption/deskripsi). */
export async function updateMediaMeta(
  shortId: string,
  input: { title: string; altText?: string | null; caption?: string | null; description?: string | null },
) {
  const [row] = await db
    .update(mediaAssets)
    .set({
      title: input.title,
      altText: input.altText ?? null,
      caption: input.caption ?? null,
      description: input.description ?? null,
    })
    .where(eq(mediaAssets.shortId, shortId))
    .returning({ id: mediaAssets.id, shortId: mediaAssets.shortId, title: mediaAssets.title });
  return row ?? null;
}
