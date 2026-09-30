/**
 * Unduh gambar korpus (M9-2b) — lapisan I/O, terisolasi agar mudah diuji.
 *
 * Batasan:
 *   - **timeout** keras (jangan menggantung ingest).
 *   - **batas ukuran** (tolak berkas terlalu besar).
 *   - **mime whitelist** (hanya gambar).
 *   - **1 permintaan** per gambar + retry terbatas.
 */
import { createHash } from "node:crypto";

/** Hasil unduhan. */
export interface FetchResult {
  ok: boolean;
  bytes?: Uint8Array;
  contentType?: string;
  contentHash?: string;
  error?: string;
}

/** Opsi unduh. */
export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  retries?: number;
  /** Header User-Agent (hormati sumber). */
  userAgent?: string;
}

const DEFAULT_UA = "MathBank-Ingest/0.1 (+https://b.iyo.my.id)";
const IMAGE_MIME = /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp|avif)$/i;

/** Deteksi mime dari magic bytes (fallback bila header salah). */
function sniffMime(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  // SVG: teks — cek awalan "<svg" atau "<?" (abaikan spasi/BOM).
  const head = new TextDecoder().decode(bytes.slice(0, 256)).trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  return undefined;
}

/** SHA-256 heksadesimal dari byte. */
export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Unduh satu gambar. */
export async function fetchImage(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const retries = opts.retries ?? 2;
  const userAgent = opts.userAgent ?? DEFAULT_UA;

  let lastErr = "gagal";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { "User-Agent": userAgent, Accept: "image/*,*/*;q=0.8" },
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        // 4xx: jangan retry (kecuali 429).
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
        continue;
      }

      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > maxBytes) return { ok: false, error: `terlalu besar (${buf.length} B)` };

      const mime = IMAGE_MIME.test(res.headers.get("content-type") ?? "")
        ? (res.headers.get("content-type") ?? "").split(";")[0]!.toLowerCase()
        : sniffMime(buf);
      if (!mime || !IMAGE_MIME.test(mime)) {
        return { ok: false, error: `bukan gambar (${res.headers.get("content-type") ?? "?"})` };
      }

      return { ok: true, bytes: buf, contentType: mime, contentHash: hashBytes(buf) };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: lastErr };
}
