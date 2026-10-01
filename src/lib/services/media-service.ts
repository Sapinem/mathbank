/**
 * Pendaftaran aset media yang sudah tersimpan di disk (L5 — service biasa).
 *
 * KENAPA service terpisah:
 * `src/lib/ingest/media/store.ts` hanya menulis BERKAS ke disk. Tanpa langkah
 * ini, berkas itu tak punya baris `media_assets` dan tak punya relasi ke soal
 * (`question_media`) → gambar tak bisa dikelola, tak bisa disajikan lewat
 * `/img/{shortId}`, dan tak bisa dibersihkan saat orphan.
 *
 * ATURAN (tidak ada jalur pintas):
 *  - `short_id` dibuat di sini (kandidat dari `media/short-id.ts`, keunikan
 *    ditegakkan DB lewat `uq_media_short_id`).
 *  - Dedup berbasis `content_hash` (`uq_media_content_hash`): berkas identik
 *    tidak pernah menghasilkan dua baris — yang kedua memakai baris pertama.
 *  - `media_id` di `question_media` memakai ON DELETE RESTRICT → aset yang
 *    masih dipakai soal tak bisa hilang diam-diam.
 */
import { and, eq, isNull, ilike, desc, count } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { mediaAssets, questionMedia } from "@/lib/db/schema/media";
import { generateUniqueShortId } from "@/lib/media/short-id";
import { mediaShortcode } from "@/lib/media/shortcode";
import { storeImage, removeStoredFile } from "@/lib/ingest/media/store";
import { mediaStorageRoot } from "@/lib/ingest/config";

/** Peran gambar — cerminan `mediaRoleEnum` (lihat src/lib/db/schema/_enums.ts). */
export type MediaRole = "content" | "option" | "solution" | "thumbnail";

/** Asal aset — cerminan `mediaOriginEnum`. */
export type MediaOrigin =
  | "manual_upload"
  | "pdf_crop"
  | "ai_generated_tikz"
  | "ai_generated_svg"
  | "web_scrape"
  | "web_ingest"
  | "tex_import";

/** Satu berkas yang akan didaftarkan. */
export interface RegisterMediaInput {
  /** Path relatif di dalam root media (mis. `a7/a7Kx…png`). */
  relativePath: string;
  contentHash: string;
  mimeType: string;
  fileSize: number;
  /** Peran gambar ini di soal. */
  role: MediaRole;
  /** Urutan kemunculan (0-based). */
  orderIndex: number;
  /** Teks alt dari markdown, bila ada. */
  altText?: string | null;
  /** Asal aset — cerminan `mediaOriginEnum`. Default `web_ingest` (jalur ingest). */
  sourceOrigin?: MediaOrigin;
}

/** Hasil pendaftaran. */
export interface RegisterMediaResult {
  id: string;
  shortId: string;
  /** true bila baris `media_assets` sudah ada sebelumnya (dedup hash). */
  reused: boolean;
}

/** Bentuk baris aset yang dipakai pemanggil. */
export interface AssetHandle {
  id: string;
  shortId: string;
}

/** Apakah short_id sudah dipakai? (predikat untuk generator) */
async function shortIdTaken(candidate: string): Promise<boolean> {
  const rows = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(eq(mediaAssets.shortId, candidate))
    .limit(1);
  return rows.length > 0;
}

/**
 * Daftarkan SATU berkas media (idempotent per `contentHash`).
 *
 * Berkas dengan hash sama → memakai baris yang sudah ada; `mimeType`, path, dan
 * metadata lain TIDAK ditimpa (baris pertama adalah sumber kebenaran berkas).
 */
export async function registerMediaAsset(
  input: RegisterMediaInput,
): Promise<RegisterMediaResult> {
  // 1) Dedup: hash sama → pakai baris lama, jangan buat duplikat.
  const existing = await db
    .select({ id: mediaAssets.id, shortId: mediaAssets.shortId })
    .from(mediaAssets)
    .where(eq(mediaAssets.contentHash, input.contentHash))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0]!;
    return { id: row.id, shortId: row.shortId, reused: true };
  }

  // 2) Baris baru — short_id dari generator, keunikan dijamin DB.
  const shortId = await generateUniqueShortId(shortIdTaken);

  const isSvg = input.mimeType === "image/svg+xml";
  const inserted = await db
    .insert(mediaAssets)
    .values({
      shortId,
      title: input.altText?.trim() || "Gambar Soal",
      altText: input.altText?.trim() || null,
      originalImagePath: isSvg ? null : input.relativePath,
      svgPath: isSvg ? input.relativePath : null,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      contentHash: input.contentHash,
      sourceOrigin: input.sourceOrigin ?? "web_ingest",
    })
    .returning({ id: mediaAssets.id, shortId: mediaAssets.shortId });

  // Balapan: dua proses bisa menyisipkan hash yang sama bersamaan. Kalah balapan
  // → ambil baris pemenang (UNIQUE yang menjamin, bukan asumsi).
  if (inserted.length === 0) {
    const winner = await db
      .select({ id: mediaAssets.id, shortId: mediaAssets.shortId })
      .from(mediaAssets)
      .where(eq(mediaAssets.contentHash, input.contentHash))
      .limit(1);
    if (winner.length > 0) {
      const row = winner[0]!;
      return { id: row.id, shortId: row.shortId, reused: true };
    }
    throw new Error(`Gagal mendaftarkan media (hash ${input.contentHash})`);
  }

  const row = inserted[0]!;
  return { id: row.id, shortId: row.shortId, reused: false };
}

/**
 * Kaitkan aset ke soal (`question_media`). Idempotent: kombinasi
 * (question, media, role, orderIndex) adalah UNIQUE → ganda diabaikan.
 */
export async function linkMediaToQuestion(
  questionId: string,
  mediaId: string,
  role: MediaRole,
  orderIndex: number,
): Promise<void> {
  await db
    .insert(questionMedia)
    .values({ questionId, mediaId, role, orderIndex })
    .onConflictDoNothing();
}

/**
 * Daftarkan + kaitkan dalam satu langkah (kasus paling umum saat ingest).
 */
export async function registerAndLink(
  questionId: string,
  input: RegisterMediaInput,
): Promise<AssetHandle> {
  const asset = await registerMediaAsset(input);
  await linkMediaToQuestion(questionId, asset.id, input.role, input.orderIndex);
  return { id: asset.id, shortId: asset.shortId };
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

/* ────────────────────────────────────────────────────────────────────────────
 * PINTU MASUK SERAGAM
 *
 * Setiap jalur yang MEMBAWA gambar wajib lewat sini — bukan hanya ingest.
 * Jalur yang tahu gambar apa yang masuk (ingest, editor, MCP) memanggil salah
 * satu fungsi di bawah; yang tidak boleh adalah menulis markdown berisi gambar
 * tanpa mendaftarkannya, karena hasilnya: berkas di disk tapi tak terdaftar —
 * tak tampil di galeri, tak bisa disajikan, dan akan dihapus orphan cleaner.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Data gambar untuk jalur yang sudah punya isi berkas (upload / editor / ingest). */
export interface StoreAndRegisterInput {
  /** Isi berkas apa adanya. */
  bytes: Uint8Array;
  mimeType: string;
  /** SHA-256 heksadesimal dari `bytes` (dihitung pemanggil bila sudah ada). */
  contentHash: string;
  /** Judul/alt yang terlihat pengguna. */
  title?: string | null;
  sourceOrigin?: MediaOrigin;
}

/**
 * Simpan berkas ke storage lalu daftarkan (jalur "saya sudah punya gambarnya").
 *
 * Dipakai ingest (setelah unduh), editor (setelah unggah), dan MCP.
 * `rootDir` disuntikkan agar lapisan pemanggil yang menentukan lokasi storage
 * (`mediaStorageRoot()`), bukan service ini.
 */
export async function storeAndRegister(
  rootDir: string,
  input: StoreAndRegisterInput,
): Promise<RegisterMediaResult> {
  const { relativePath } = await storeImage(rootDir, input.contentHash, input.mimeType, input.bytes);
  return registerMediaAsset({
    relativePath,
    contentHash: input.contentHash,
    mimeType: input.mimeType,
    fileSize: input.bytes.length,
    role: "content",
    orderIndex: 0,
    altText: input.title ?? null,
    sourceOrigin: input.sourceOrigin ?? "manual_upload",
  });
}

/** Hasil unggah manual: aset + shortcode siap sisip. */
export interface UploadMediaResult extends RegisterMediaResult {
  /** `{{img:<shortId>}}` — siap ditempel ke markdown soal. */
  shortcode: string;
}

/**
 * Unggah gambar manual (editor soal / galeri).
 *
 * Menghitung hash, menyimpan lewat storage yang sama dengan ingest (sharding +
 * dedup), lalu mendaftarkan → `short_id` + shortcode. Inilah pintu yang dipakai
 * UI agar gambar guru tidak menjadi orphan.
 */
export async function uploadMedia(
  rootDir: string,
  file: { bytes: Uint8Array; mimeType: string; fileName?: string },
  opts: { title?: string | null; sourceOrigin?: MediaOrigin } = {},
): Promise<UploadMediaResult> {
  const hash = createHash("sha256").update(file.bytes).digest("hex");
  const { relativePath } = await storeImage(rootDir, hash, file.mimeType, file.bytes);

  const asset = await registerMediaAsset({
    relativePath,
    contentHash: hash,
    mimeType: file.mimeType,
    fileSize: file.bytes.length,
    role: "content",
    orderIndex: 0,
    altText: opts.title ?? file.fileName ?? null,
    sourceOrigin: opts.sourceOrigin ?? "manual_upload",
  });

  return { ...asset, shortcode: mediaShortcode(asset.shortId) };
}

/**
 * Gambar yang belum terdaftar → daftarkan + tautkan ke soal.
 *
 * Untuk jalur yang menulis soal TANPA melalui ingest-media (editor langsung,
 * MCP, API). Menerima gambar yang SUDAH punya berkas di storage.
 */
export async function attachStoredMedia(
  questionId: string,
  items: Array<{ relativePath: string; contentHash: string; mimeType: string; fileSize: number }>,
  opts: { role?: MediaRole; sourceOrigin?: MediaOrigin } = {},
): Promise<AssetHandle[]> {
  const out: AssetHandle[] = [];
  for (let i = 0; i < items.length; i++) {
    const m = items[i]!;
    const asset = await registerMediaAsset({
      relativePath: m.relativePath,
      contentHash: m.contentHash,
      mimeType: m.mimeType,
      fileSize: m.fileSize,
      role: opts.role ?? "content",
      orderIndex: i,
      sourceOrigin: opts.sourceOrigin ?? "manual_upload",
    });
    await linkMediaToQuestion(questionId, asset.id, opts.role ?? "content", i);
    out.push({ id: asset.id, shortId: asset.shortId });
  }
  return out;
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

/* ────────────────────────────────────────────────────────────────────────────
 * GALERI (baca)
 *
 * Proyeksi kolom EKSPLISIT (CONSTRAINTS #34) — jangan `.select()` tanpa kolom.
 * Dipakai AssetPicker & halaman /assets.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Kolom yang aman & berguna untuk daftar galeri. */
const GALLERY_COLUMNS = {
  id: mediaAssets.id,
  shortId: mediaAssets.shortId,
  title: mediaAssets.title,
  altText: mediaAssets.altText,
  originalImagePath: mediaAssets.originalImagePath,
  svgPath: mediaAssets.svgPath,
  mimeType: mediaAssets.mimeType,
  fileSize: mediaAssets.fileSize,
  sourceOrigin: mediaAssets.sourceOrigin,
  createdAt: mediaAssets.createdAt,
} as const;

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
