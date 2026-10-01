/**
 * Idempotensi ingest (M9-3) — fungsi murni.
 *
 * Dua tingkat:
 *   - `articleHash(rawContent)` — deteksi artikel yang sama (jangan proses ulang).
 *   - `contentHash(stem, options)` — deteksi SOAL yang sama (jangan buat ulang),
 *     berbasis KONTEN **tanpa `source`** (ADR-0012): soal identik dari sumber
 *     berbeda = SAMA (many-to-many via `question_sources`).
 */
import { createHash } from "node:crypto";

/** SHA-256 heksadesimal dari string (dinormalisasi spasi tepi). */
export function sha256(s: string): string {
  return createHash("sha256").update(s.trim(), "utf8").digest("hex");
}

/** Normalisasi teks: rapikan spasi (tahan perbedaan spasi/baris). */
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Hash artikel: identitas isi mentah. */
export function articleHash(rawContent: string): string {
  return sha256(rawContent);
}

/**
 * Hash soal: sumber + teks soal. ⚠️ DEPRECATED (ADR-0012) — memakai `source`
 * membuat soal identik dari sumber berbeda dianggap beda (memicu duplikat).
 * Gunakan `contentHash(stem, options)` untuk dedup lintas-sumber.
 */
export function itemHash(source: string, stem: string): string {
  return sha256(`${source}\u0000${stem.replace(/\s+/g, " ").trim()}`);
}

/**
 * Hash konten soal (ADR-0012): **stem + opsi**, TANPA sumber.
 *
 * - Opsi dibandingkan sebagai **himpunan teks** (label & urutan diabaikan →
 *   tahan opsi teracak), sesuai keputusan pemilik produk.
 * - Soal dengan stem + opsi sama (walau dari sumber berbeda) → hash sama.
 */
export function contentHash(stem: string, options: string[] = []): string {
  const normStem = normalizeText(stem);
  const normOpts = options
    .map(normalizeText)
    .filter((o) => o.length > 0)
    .sort();
  return sha256(`${normStem}\u0000${normOpts.join("\u0001")}`);
}
