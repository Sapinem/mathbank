/**
 * Simpan berkas gambar ke penyimpanan lokal (M9-2b) — lapisan I/O.
 *
 * Path: `{MEDIA_STORAGE_PATH}/{hash[0:2]}/{hash}{ext}`.
 *   - **Sharding** 2 huruf → hindari satu folder berisi puluhan ribu berkas.
 *   - Nama = **contentHash** → **dedup otomatis** (gambar sama = 1 berkas).
 *   - Tulis **atomik** (`.tmp` lalu rename).
 */
import { mkdir, writeFile, rename, access, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { constants } from "node:fs";

/** Ekstensi dari mime. */
export function extForMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "image/bmp":
      return ".bmp";
    case "image/avif":
      return ".avif";
    default:
      return ".bin";
  }
}

/** Path relatif sharded untuk sebuah hash+mime. */
export function relativePath(contentHash: string, mime: string): string {
  return join(contentHash.slice(0, 2), `${contentHash}${extForMime(mime)}`);
}

/** Apakah berkas sudah ada? */
async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Hasil simpan. */
export interface StoreResult {
  stored: boolean;
  relativePath: string;
  deduped: boolean;
}

/**
 * Simpan byte ke storage. Bila berkas dengan hash+mime yang sama sudah ada →
 * **tak ditulis ulang** (dedup).
 */
export async function storeImage(
  rootDir: string,
  contentHash: string,
  mime: string,
  bytes: Uint8Array,
): Promise<StoreResult> {
  const rel = relativePath(contentHash, mime);
  const abs = join(rootDir, rel);

  if (await exists(abs)) return { stored: true, relativePath: rel, deduped: true };

  await mkdir(join(rootDir, contentHash.slice(0, 2)), { recursive: true });
  const tmp = `${abs}.${process.pid}.tmp`;
  await writeFile(tmp, bytes);
  await rename(tmp, abs); // atomik
  return { stored: true, relativePath: rel, deduped: false };
}

/**
 * Hapus berkas tersimpan berdasarkan path relatifnya (G4.6 hygiene).
 *
 * **Anti path-traversal**: path WAJIB tetap di dalam `rootDir`. Tanpa penjagaan ini,
 * nilai `original_image_path` yang jahat (`../../etc/passwd`) akan menghapus berkas
 * di luar storage. Sama seperti penjagaan di route penyaji `/img`.
 *
 * Melempar bila berkas tidak ada — pemanggil yang memutuskan itu masalah atau bukan.
 */
export async function removeStoredFile(rootDir: string, relPath: string): Promise<void> {
  const root = resolve(rootDir);
  const abs = resolve(join(root, relPath));
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error(`Path di luar storage ditolak: ${relPath}`);
  }
  await rm(abs);
}
