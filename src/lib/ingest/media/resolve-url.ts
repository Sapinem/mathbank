/**
 * Absolutisasi URL gambar (M9-2b) — fungsi murni.
 *
 * Pemilihan kandidat URL mentah (srcset > lazy > src) sudah dilakukan
 * `clean.ts:bestImageSrc`. Di sini hanya **absolutisasi** terhadap URL artikel.
 */

/** Absolutkan URL relatif terhadap `baseUrl`; kembalikan `undefined` bila gagal. */
export function absolutize(url: string, baseUrl?: string): string | undefined {
  const u = url.trim();
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("data:")) return u; // data-URI (biarkan)
  if (u.startsWith("corpus://")) return u; // korpus lokal (biarkan)
  if (!baseUrl) return undefined;
  try {
    return new URL(u, baseUrl).toString();
  } catch {
    return undefined;
  }
}
