/**
 * Pembersihan & hygiene aset media (L5) — pecahan `media-service.ts`.
 *
 * Menjaga invarian: aset yang MASIH dipakai soal (`question_media`, ON DELETE
 * RESTRICT) tak boleh hilang; berkas fisik dihapus setelah baris DB.
 *
 * ⚠️ JANGAN impor dari komponen klien (menarik `@/lib/db`).
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAssets, questionMedia } from "@/lib/db/schema/media";
import { removeStoredFile } from "@/lib/ingest/media/store";
import { mediaStorageRoot } from "@/lib/ingest/config";

/** Cari aset lewat short_id — dipakai penyaji `/img/{shortId}`. */
export async function findAssetByShortId(shortId: string) {
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.shortId, shortId))
    .limit(1);
  return rows[0] ?? null;
}

/** Apakah aset dipakai soal mana pun? (dasar keputusan hapus) */
export async function isAssetInUse(mediaId: string): Promise<boolean> {
  const rows = await db
    .select({ id: questionMedia.id })
    .from(questionMedia)
    .where(and(eq(questionMedia.mediaId, mediaId)))
    .limit(1);
  return rows.length > 0;
}

/** Aset milik satu soal (untuk UI/hygiene). */
export async function listQuestionMedia(questionId: string) {
  return db
    .select({
      id: questionMedia.id,
      mediaId: questionMedia.mediaId,
      role: questionMedia.role,
      orderIndex: questionMedia.orderIndex,
      shortId: mediaAssets.shortId,
      title: mediaAssets.title,
      altText: mediaAssets.altText,
    })
    .from(questionMedia)
    .innerJoin(mediaAssets, eq(questionMedia.mediaId, mediaAssets.id))
    .where(eq(questionMedia.questionId, questionId))
    .orderBy(questionMedia.orderIndex);
}

/**
 * Buang tautan media dari soal, lalu hapus asetnya BILA sudah tak dipakai
 * soal lain. Aman: aset yang masih dipakai soal lain tetap hidup.
 *
 * Mengembalikan jumlah aset yang benar-benar dihapus.
 */
export async function detachAndCleanup(questionId: string, mediaIds: string[]): Promise<number> {
  let removed = 0;
  for (const mediaId of mediaIds) {
    await db
      .delete(questionMedia)
      .where(and(eq(questionMedia.questionId, questionId), eq(questionMedia.mediaId, mediaId)));

    if (!(await isAssetInUse(mediaId))) {
      await db.delete(mediaAssets).where(eq(mediaAssets.id, mediaId));
      removed++;
    }
  }
  return removed;
}

/** Aset tanpa rujukan soal mana pun — bahan laporan hygiene (G4.6). */
export async function findOrphanAssets() {
  const rows = await db
    .select({
      id: mediaAssets.id,
      shortId: mediaAssets.shortId,
      title: mediaAssets.title,
      originalImagePath: mediaAssets.originalImagePath,
      svgPath: mediaAssets.svgPath,
      fileSize: mediaAssets.fileSize,
      createdAt: mediaAssets.createdAt,
    })
    .from(mediaAssets)
    .leftJoin(questionMedia, eq(questionMedia.mediaId, mediaAssets.id))
    .where(isNull(questionMedia.id));

  const totalBytes = rows.reduce((sum, r) => sum + (r.fileSize ?? 0), 0);
  return { data: rows, total: rows.length, totalBytes };
}

/**
 * Hapus aset **beserta berkas fisiknya** (G4.6 hygiene).
 *
 * Penjagaan penting: aset yang MASIH dipakai soal (`question_media`) **TIDAK boleh**
 * dihapus — FK-nya ON DELETE RESTRICT akan melempar galat DB mentah, jadi kita
 * periksa lebih dulu dan kembalikan `inUse` agar route bisa menjawab 409 dengan jelas.
 *
 * Urutan: hapus baris DB → baru hapus berkas. Kalau berkas hilang, barisnya tetap
 * terhapus (tidak ada rujukan menggantung); kalau DB gagal, berkas tak tersentuh.
 */
export async function deleteAsset(
  shortId: string,
): Promise<{ shortId: string; filesRemoved: number } | { inUse: true } | null> {
  const asset = await findAssetByShortId(shortId);
  if (!asset) return null;

  if (await isAssetInUse(asset.id)) return { inUse: true };

  await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));

  // Berkas fisik: best-effort. Barisnya sudah hilang, jadi kegagalan I/O di sini
  // tidak membuat data menggantung — hanya menyisakan berkas yatim di disk.
  const candidates = [asset.originalImagePath, asset.svgPath, asset.thumbnailPath].filter(
    (p): p is string => Boolean(p),
  );
  let filesRemoved = 0;
  const root = mediaStorageRoot();
  for (const rel of new Set(candidates)) {
    try {
      await removeStoredFile(root, rel);
      filesRemoved++;
    } catch {
      // berkas sudah tidak ada, atau path tak sah — keduanya bukan alasan gagal
    }
  }

  return { shortId, filesRemoved };
}
