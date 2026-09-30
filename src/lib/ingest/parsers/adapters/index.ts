/**
 * Pemilih adapter per-sumber (M9).
 *
 * Prioritas:
 *   1. `meta.source` eksplisit (mathcyber | m4thlab | defantri | pusmendik_*)
 *   2. deteksi dari penanda HTML (bila sumber tak dikenal)
 *   3. `null` → artikel dilewati (dilaporkan "sumber tak dikenal")
 */
import { mathcyberAdapter } from "./mathcyber";
import { m4thlabAdapter } from "./m4thlab";
import { defantriAdapter } from "./defantri";
import type { ArticleAdapter, ArticleMeta } from "../types";

/** Peta nama sumber → adapter. */
const BY_SOURCE: Record<string, ArticleAdapter> = {
  mathcyber: mathcyberAdapter,
  m4thlab: m4thlabAdapter,
  defantri: defantriAdapter,
};

/** Penanda untuk deteksi otomatis dari HTML. */
const DETECTORS: { source: string; test: RegExp }[] = [
  { source: "m4thlab", test: /<div class="contoh-soal"/i },
  { source: "defantri", test: /<input\b[^>]*type="radio"[^>]*name="q\d+"/i },
  { source: "mathcyber", test: /(?:Soal Nomor|Problem Number)\s*\d+/i },
];

/** Ambil adapter untuk `meta`; `null` bila tak ada yang cocok. */
export function pickAdapter(meta: ArticleMeta, rawHtml: string): ArticleAdapter | null {
  const explicit = meta.source && BY_SOURCE[meta.source];
  if (explicit) return explicit;

  for (const d of DETECTORS) {
    if (d.test.test(rawHtml)) return BY_SOURCE[d.source] ?? null;
  }
  return null;
}

/** Daftar sumber yang punya adapter. */
export const KNOWN_SOURCES = Object.keys(BY_SOURCE);
