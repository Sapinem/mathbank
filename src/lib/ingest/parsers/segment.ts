/**
 * Segmentasi artikel → soal (M9) — fungsi murni.
 *
 * Titik masuk tunggal untuk lapisan "tahu soal": pilih adapter berdasar sumber
 * lalu jalankan. Bila sumber tak dikenal → kembalikan hasil kosong + catatan
 * (artikel dilewati, bukan error).
 */
import { pickAdapter, KNOWN_SOURCES } from "./adapters";
import type { ArticleMeta, SegmentResult } from "./types";

/**
 * Segmentasi satu artikel HTML menjadi soal-soal.
 *
 * @param rawHtml HTML mentah artikel (dari korpus).
 * @param meta    metadata artikel (source/url/title).
 */
export function segmentArticle(rawHtml: string, meta: ArticleMeta): SegmentResult {
  if (!rawHtml || rawHtml.trim().length === 0) {
    return { items: [], skipped: 0, warnings: ["HTML kosong"] };
  }

  const adapter = pickAdapter(meta, rawHtml);
  if (!adapter) {
    return {
      items: [],
      skipped: 0,
      warnings: [
        `Sumber tak dikenal: "${meta.source}" (dikenal: ${KNOWN_SOURCES.join(", ")}) — artikel dilewati`,
      ],
    };
  }

  return adapter(rawHtml, meta);
}
