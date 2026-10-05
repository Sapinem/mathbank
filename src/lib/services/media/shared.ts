/**
 * Tipe & proyeksi bersama media (L5) — pecahan `media-service.ts`.
 *
 * Berisi tipe publik + `GALLERY_COLUMNS` (proyeksi kolom eksplisit,
 * CONSTRAINTS #34). Tanpa I/O.
 *
 * ⚠️ JANGAN impor dari komponen klien (menarik `@/lib/db` lewat `mediaAssets`).
 */
import { mediaAssets } from "@/lib/db/schema/media";

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

/** Hasil unggah manual: aset + shortcode siap sisip. */
export interface UploadMediaResult extends RegisterMediaResult {
  /** `{{img:<shortId>}}` — siap ditempel ke markdown soal. */
  shortcode: string;
}

/** Kolom yang aman & berguna untuk daftar galeri. */
export const GALLERY_COLUMNS = {
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
