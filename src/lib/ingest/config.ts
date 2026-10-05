/**
 * Konfigurasi ingest (M9-3).
 */
import { join, isAbsolute } from "node:path";

/** Root penyimpanan media (dari `MEDIA_STORAGE_PATH`, default `./storage/media`). */
export function mediaStorageRoot(): string {
  const p = process.env.MEDIA_STORAGE_PATH?.trim();
  if (!p) return join(process.cwd(), "storage", "media");
  // PERF-09: path storage runtime dinamis (di luar bundel). Anotasi
  // `turbopackIgnore` mencegah Turbopack men-trace seluruh proyek.
  return isAbsolute(p) ? p : join(/*turbopackIgnore: true*/ process.cwd(), p);
}
