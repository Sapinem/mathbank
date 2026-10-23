/**
 * Pemilih adapter per-sumber (M9).
 *
 * Dua jenis:
 *   - **HTML** (`ArticleAdapter`): mathcyber, m4thlab, defantri, pusmendik_tka
 *   - **JSON** (`JsonAdapter`): pusmendik_dayaserap
 *
 * Prioritas: `meta.source` eksplisit → deteksi dari isi HTML → `null` (dilewati).
 *
 * ⚠️ SATU descriptor per sumber: adapter dan pola deteksinya berdampingan.
 * Sebelumnya ada dua struktur paralel (map adapter + daftar detektor) yang
 * di-key oleh string yang sama — menambah sumber berarti menyunting dua tempat,
 * dan lupa mendaftarkan detektor tidak memunculkan galat apa pun (sumber hanya
 * hidup bila `meta.source` dikirim eksplisit). `detect: null` kini wajib
 * ditulis eksplisit, sehingga keputusan itu terlihat saat menambah adapter.
 */
import { mathcyberAdapter } from "./mathcyber";
import { m4thlabAdapter } from "./m4thlab";
import { defantriAdapter } from "./defantri";
import { pusmendikTkaAdapter } from "./pusmendik-tka";
import { pusmendikDayaserapAdapter } from "./pusmendik-dayaserap";
import type { ArticleAdapter, ArticleMeta, JsonAdapter } from "../types";

/** Sumber HTML: adapter + pola deteksi (`null` = hanya lewat `meta.source`). */
export interface HtmlSource {
  source: string;
  adapter: ArticleAdapter;
  detect: RegExp | null;
}

/** Sumber JSON: selalu lewat `meta.source` (data terstruktur, tanpa tebak HTML). */
export interface JsonSource {
  source: string;
  adapter: JsonAdapter;
}

/**
 * Urutan array = urutan DETEKSI. Yang polanya lebih spesifik didahulukan;
 * `mathcyber` paling longgar (`Soal Nomor N`), jadi diletakkan terakhir.
 */
export const HTML_SOURCES: readonly HtmlSource[] = [
  { source: "m4thlab", adapter: m4thlabAdapter, detect: /<div class="contoh-soal"/i },
  { source: "defantri", adapter: defantriAdapter, detect: /<input\b[^>]*type="radio"[^>]*name="q\d+"/i },
  { source: "pusmendik_tka", adapter: pusmendikTkaAdapter, detect: /<input\b[^>]*\bname="pilihan\d+"/i },
  { source: "mathcyber", adapter: mathcyberAdapter, detect: /(?:Soal Nomor|Problem Number)\s*\d+/i },
];

/** Sumber JSON yang dikenal. */
export const JSON_SOURCES: readonly JsonSource[] = [
  { source: "pusmendik_dayaserap", adapter: pusmendikDayaserapAdapter },
];

/** Adapter HTML per nama sumber (diturunkan dari `HTML_SOURCES`). */
export const HTML_ADAPTERS: Record<string, ArticleAdapter> = Object.fromEntries(
  HTML_SOURCES.map((s) => [s.source, s.adapter]),
);

/** Adapter JSON per nama sumber (diturunkan dari `JSON_SOURCES`). */
export const JSON_ADAPTERS: Record<string, JsonAdapter> = Object.fromEntries(
  JSON_SOURCES.map((s) => [s.source, s.adapter]),
);

/** Ambil adapter HTML untuk `meta`; `null` bila tak ada yang cocok. */
export function pickHtmlAdapter(meta: ArticleMeta, rawHtml: string): ArticleAdapter | null {
  const explicit = meta.source ? HTML_ADAPTERS[meta.source] : undefined;
  if (explicit) return explicit;

  for (const s of HTML_SOURCES) {
    if (s.detect && s.detect.test(rawHtml)) return s.adapter;
  }
  return null;
}

/** Ambil adapter JSON untuk `meta`; `null` bila tak ada. */
export function pickJsonAdapter(meta: ArticleMeta): JsonAdapter | null {
  return JSON_ADAPTERS[meta.source] ?? null;
}

/** Daftar sumber yang punya adapter (HTML + JSON). */
export const KNOWN_SOURCES = [...HTML_SOURCES.map((s) => s.source), ...JSON_SOURCES.map((s) => s.source)];
