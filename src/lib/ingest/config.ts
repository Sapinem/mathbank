/**
 * Konfigurasi ingest (M9-3).
 */
import { join, isAbsolute } from "node:path";

/** Root penyimpanan media (dari `MEDIA_STORAGE_PATH`, default `./storage/media`). */
export function mediaStorageRoot(): string {
  const p = process.env.MEDIA_STORAGE_PATH?.trim();
  if (!p) return join(process.cwd(), "storage", "media");
  return isAbsolute(p) ? p : join(process.cwd(), p);
}
