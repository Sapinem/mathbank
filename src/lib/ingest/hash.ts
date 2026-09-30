/**
 * Idempotensi ingest (M9-3) — fungsi murni.
 *
 * Dua tingkat:
 *   - `articleHash(rawContent)` — deteksi artikel yang sama (jangan proses ulang).
 *   - `itemHash(source, stem)`  — deteksi soal yang sama (jangan buat ulang).
 */
import { createHash } from "node:crypto";

/** SHA-256 heksadesimal dari string (dinormalisasi spasi tepi). */
export function sha256(s: string): string {
  return createHash("sha256").update(s.trim(), "utf8").digest("hex");
}

/** Hash artikel: identitas isi mentah. */
export function articleHash(rawContent: string): string {
  return sha256(rawContent);
}

/**
 * Hash soal: sumber + teks soal (spasi dinormalisasi agar tahan perbedaan kecil).
 */
export function itemHash(source: string, stem: string): string {
  return sha256(`${source}\u0000${stem.replace(/\s+/g, " ").trim()}`);
}
