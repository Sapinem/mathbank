/**
 * Pemilih adapter per-sumber (M9).
 *
 * Dua jenis:
 *   - **HTML** (`ArticleAdapter`): mathcyber, m4thlab, defantri, pusmendik_tka
 *   - **JSON** (`JsonAdapter`): pusmendik_dayaserap
 *
 * Prioritas: `meta.source` eksplisit → deteksi dari isi HTML → `null` (dilewati).
 */
import { mathcyberAdapter } from "./mathcyber";
import { m4thlabAdapter } from "./m4thlab";
import { defantriAdapter } from "./defantri";
import { pusmendikTkaAdapter } from "./pusmendik-tka";
import { pusmendikDayaserapAdapter } from "./pusmendik-dayaserap";
import type { ArticleAdapter, ArticleMeta, JsonAdapter } from "../types";

/** Adapter HTML per sumber. */
export const HTML_ADAPTERS: Record<string, ArticleAdapter> = {
  mathcyber: mathcyberAdapter,
  m4thlab: m4thlabAdapter,
  defantri: defantriAdapter,
  pusmendik_tka: pusmendikTkaAdapter,
};

/** Adapter JSON per sumber. */
export const JSON_ADAPTERS: Record<string, JsonAdapter> = {
  pusmendik_dayaserap: pusmendikDayaserapAdapter,
};

/** Penanda HTML untuk deteksi otomatis. */
const DETECTORS: { source: string; test: RegExp }[] = [
  { source: "m4thlab", test: /<div class="contoh-soal"/i },
  { source: "defantri", test: /<input\b[^>]*type="radio"[^>]*name="q\d+"/i },
  { source: "pusmendik_tka", test: /<input\b[^>]*\bname="pilihan\d+"/i },
  { source: "mathcyber", test: /(?:Soal Nomor|Problem Number)\s*\d+/i },
];

/** Ambil adapter HTML untuk `meta`; `null` bila tak ada yang cocok. */
export function pickHtmlAdapter(meta: ArticleMeta, rawHtml: string): ArticleAdapter | null {
  const explicit = meta.source && HTML_ADAPTERS[meta.source];
  if (explicit) return explicit;

  for (const d of DETECTORS) {
    if (d.test.test(rawHtml)) return HTML_ADAPTERS[d.source] ?? null;
  }
  return null;
}

/** Ambil adapter JSON untuk `meta`; `null` bila tak ada. */
export function pickJsonAdapter(meta: ArticleMeta): JsonAdapter | null {
  return JSON_ADAPTERS[meta.source] ?? null;
}

/** Daftar sumber yang punya adapter (HTML + JSON). */
export const KNOWN_SOURCES = [...Object.keys(HTML_ADAPTERS), ...Object.keys(JSON_ADAPTERS)];
