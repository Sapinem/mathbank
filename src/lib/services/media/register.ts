/**
 * Pendaftaran & penautan aset media (L5) — pecahan `media-service.ts`.
 *
 * Tanggung jawab: menulis baris `media_assets` (dedup hash + `short_id`) &
 * menautkannya ke soal (`question_media`). Menjaga invarian:
 *  - `short_id` unik (dijaga DB lewat `uq_media_short_id`).
 *  - Dedup `content_hash` (`uq_media_content_hash`): berkas identik tak pernah
 *    menghasilkan dua baris.
 *
 * ⚠️ JANGAN impor dari komponen klien (menarik `@/lib/db`).
 */
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { mediaAssets, questionMedia } from "@/lib/db/schema/media";
import { generateUniqueShortId } from "@/lib/media/short-id";
import { mediaShortcode } from "@/lib/media/shortcode";
import { storeImage } from "@/lib/ingest/media/store";
import type {
  AssetHandle,
  MediaOrigin,
  MediaRole,
  RegisterMediaInput,
  RegisterMediaResult,
  StoreAndRegisterInput,
  UploadMediaResult,
} from "./shared";

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
