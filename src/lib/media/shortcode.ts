/**
 * Shortcode media `{{img:<shortId>}}` — fungsi murni (L6).
 *
 * KENAPA shortcode, bukan path storage di markdown:
 *   Path mengikat isi soal pada SUSUNAN PENYIMPANAN. Begitu berkas dipindah,
 *   diganti, atau sharding diubah, ribuan baris markdown harus ditulis ulang.
 *   Dengan shortcode, soal hanya menyimpan 8 karakter; DB yang tahu berkas mana
 *   yang dimaksud. Ganti skema penyimpanan = ubah resolver, markdown tetap utuh.
 *
 * BENTUK KANONIK (satu-satunya):
 *   {{img:a7Kx9mP2}}
 *
 * Panjang 16 karakter, dibandingkan ~78 karakter path hash sebelumnya.
 */
import { isValidShortId } from "./short-id";

/** Pola shortcode — longgar terhadap spasi agar teks hasil salin-tempel tetap dikenali. */
const SHORTCODE_RE = /\{\{\s*img\s*:\s*([0-9A-Za-z]{8})\s*\}\}/g;

/** Bangun shortcode kanonik dari sebuah short_id. */
export function mediaShortcode(shortId: string): string {
  if (!isValidShortId(shortId)) {
    throw new Error(`short_id tidak sah: "${shortId}" (harus 8 karakter base62)`);
  }
  return `{{img:${shortId}}}`;
}

/** Apakah teks memuat minimal satu shortcode media? */
export function hasImageShortcode(text: string): boolean {
  SHORTCODE_RE.lastIndex = 0;
  return SHORTCODE_RE.test(text);
}

/** Semua short_id yang dirujuk di teks (urut kemunculan, tanpa duplikat). */
export function extractShortIds(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  SHORTCODE_RE.lastIndex = 0;
  for (const m of text.matchAll(SHORTCODE_RE)) {
    const id = m[1]!;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Normalisasi seluruh bentuk sah → bentuk kanonik.
 *
 * Berguna saat teks datang dari sumber luar (salin-tempel, AI) yang mungkin
 * menulis spasi: `{{ img : a7Kx9mP2 }}` → `{{img:a7Kx9mP2}}`.
 */
export function normalizeShortcodes(text: string): string {
  return text.replace(SHORTCODE_RE, (_, id: string) => `{{img:${id}}}`);
}

/** URL penyajian berkas untuk sebuah short_id (`/img/{shortId}`). */
export function mediaUrl(shortId: string): string {
  return `/img/${shortId}`;
}

/** Ganti semua shortcode dengan bentuk teks cadangan (mis. saat ekspor tanpa gambar). */
export function stripShortcodes(text: string, replacement = ""): string {
  return text.replace(SHORTCODE_RE, replacement);
}
