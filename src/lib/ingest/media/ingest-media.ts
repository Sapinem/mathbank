/**
 * Orkestrasi unduh gambar korpus (M9-2b).
 *
 * Alur: markdown soal (berisi `![alt](url)`) → untuk tiap URL: unduh → simpan →
 * ganti URL di markdown dengan **URL lokal** (`/media/...`). Yang gagal → **flag**
 * (soal tetap dibuat, gambar ditandai untuk telaah).
 *
 * Idempoten: URL yang sudah terunduh di sesi ini (atau hash sudah ada) tak diunduh ulang.
 */
import { fetchImage } from "./fetch";
import { storeImage } from "./store";
import { absolutize } from "./resolve-url";
import { bestImageSrc } from "../parsers/clean";

/** Satu gambar yang berhasil/tak berhasil diunduh. */
export interface MediaOutcome {
  sourceUrl: string;
  localUrl?: string;
  contentHash?: string;
  mimeType?: string;
  fileSize?: number;
  role: "content" | "option" | "solution";
  ok: boolean;
  error?: string;
}

/** Peta URL → hasil (cache dalam sesi). */
export type MediaCache = Map<string, MediaOutcome>;

/** Opsi orkestrasi. */
export interface IngestMediaOptions {
  rootDir: string;
  /** URL artikel (untuk absolutisasi src relatif). */
  articleUrl?: string;
  cache?: MediaCache;
  /** Jeda antar-unduhan (ms) — hormati sumber. */
  delayMs?: number;
  /** Kaitkan ke URL lokal ini (mis. `/media/`). */
  localPrefix?: string;
}

const IMG_MD = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Pola `<img …>` mentah (bila markdown belum diekstrak). */
const IMG_TAG = /<img\b[^>]*>/gi;

/**
 * Kumpulkan URL gambar dari teks (markdown `![]()` dan/atau tag `<img>` mentah).
 * @param text    teks (stem/opsi/pembahasan)
 * @param articleUrl URL artikel untuk absolutisasi
 * @param role    peran gambar
 */
export function collectUrls(
  text: string,
  articleUrl: string | undefined,
  role: MediaOutcome["role"],
): { url: string; role: MediaOutcome["role"] }[] {
  const out: { url: string; role: MediaOutcome["role"] }[] = [];
  for (const m of text.matchAll(IMG_MD)) {
    const u = m[2]!.trim();
    if (u) out.push({ url: u, role });
  }
  for (const m of text.matchAll(IMG_TAG)) {
    const raw = bestImageSrc(m[0]);
    const u = raw ? absolutize(raw, articleUrl) : undefined;
    if (u) out.push({ url: u, role });
  }
  return out;
}

/** Ganti semua kemunculan URL sumber dengan URL lokal di teks. */
export function replaceUrl(text: string, from: string, to: string): string {
  return text.split(from).join(to);
}

/**
 * Unduh & simpan semua gambar untuk SATU artikel.
 * Mengembalikan peta `sourceUrl → MediaOutcome` (gabungan dengan `cache`).
 */
export async function ingestArticleMedia(
  texts: { text: string; role: MediaOutcome["role"] }[],
  opts: IngestMediaOptions,
): Promise<MediaCache> {
  const cache = opts.cache ?? new Map<string, MediaOutcome>();
  const prefix = opts.localPrefix ?? "/media";
  const delay = opts.delayMs ?? 0;

  // Kumpulkan URL unik yang belum di-cache.
  const seen = new Set<string>();
  const queue: { url: string; role: MediaOutcome["role"] }[] = [];
  for (const t of texts) {
    for (const c of collectUrls(t.text, opts.articleUrl, t.role)) {
      if (cache.has(c.url) || seen.has(c.url)) continue;
      seen.add(c.url);
      queue.push(c);
    }
  }

  for (let i = 0; i < queue.length; i++) {
    const { url, role } = queue[i]!;
    const res = await fetchImage(url);
    if (res.ok && res.bytes && res.contentHash && res.contentType) {
      const stored = await storeImage(opts.rootDir, res.contentHash, res.contentType, res.bytes);
      cache.set(url, {
        sourceUrl: url,
        localUrl: `${prefix}/${stored.relativePath}`,
        contentHash: res.contentHash,
        mimeType: res.contentType,
        fileSize: res.bytes.length,
        role,
        ok: true,
      });
    } else {
      cache.set(url, { sourceUrl: url, role, ok: false, error: res.error });
    }
    if (delay > 0 && i < queue.length - 1) await new Promise((r) => setTimeout(r, delay));
  }

  return cache;
}

/**
 * Terapkan hasil ke teks: URL lokal untuk yang berhasil, **biarkan URL sumber**
 * untuk yang gagal (agar tetap terlihat & bisa ditelaah).
 */
export function applyMedia(text: string, cache: MediaCache): string {
  let out = text;
  for (const [src, res] of cache) {
    if (res.ok && res.localUrl) out = replaceUrl(out, src, res.localUrl);
  }
  return out;
}
