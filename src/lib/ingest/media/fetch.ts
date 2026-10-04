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
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

/** Domain yang sertifikat SSL-nya rusak di sumber (temuan: pusmendik kemdikdasmen). */
const TLS_RELAXED_HOSTS = ["pusmendik.kemendikdasmen.go.id"];

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
  /** Host yang TLS-nya dilonggarkan (default: `TLS_RELAXED_HOSTS`). */
  tlsRelaxedHosts?: string[];
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

/** Apakah host ini masuk daftar TLS yang dilonggarkan? */
function isTlsRelaxed(url: string, hosts: string[]): boolean {
  try {
    return hosts.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Pengecekan IP & Host privat/loopback/metadata (mitigasi SSRF).
 * Memblokir loopback, RFC 1918, link-local, dan localhost.
 */
export function isPrivateOrBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (host === "localhost" || host === "0.0.0.0") return true;

  // IPv4 regex check
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local AWS metadata)
    if (a === 0) return true;
  }

  // IPv6 check
  if (host === "::1" || host === "[::1]") return true;
  if (host.startsWith("fe80:") || host.startsWith("[fe80:")) return true;
  if (
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("[fc") ||
    host.startsWith("[fd")
  ) {
    return true;
  }

  return false;
}

/**
 * Unduh lewat modul `https`/`http` Node dengan `rejectUnauthorized: false`
 * **hanya** untuk host di `TLS_RELAXED_HOSTS` (sertifikat rusak di sumber).
 * Mengikuti redirect (maks 5).
 */
function downloadRelaxed(
  url: string,
  timeoutMs: number,
  userAgent: string,
  redirects = 5,
): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "http:" ? httpRequest : httpsRequest;
    const req = mod(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: u.pathname + u.search,
        method: "GET",
        headers: { "User-Agent": userAgent, Accept: "image/*,*/*;q=0.8" },
        // Hanya longgarkan untuk host yang dikenal (pin domain).
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        const code = res.statusCode ?? 0;
        // Redirect.
        if (code >= 300 && code < 400 && res.headers.location && redirects > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(downloadRelaxed(next, timeoutMs, userAgent, redirects - 1));
          return;
        }
        const chunks: Uint8Array[] = [];
        res.on("data", (c: Buffer) => chunks.push(new Uint8Array(c)));
        res.on("end", () =>
          resolve({
            status: code,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: concat(chunks),
          }),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** Unduh satu gambar. */
export async function fetchImage(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, error: "URL tidak valid" };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { ok: false, error: "Protokol tidak diizinkan (hanya http/https)" };
  }

  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const retries = opts.retries ?? 2;
  const userAgent = opts.userAgent ?? DEFAULT_UA;
  const relaxedHosts = opts.tlsRelaxedHosts ?? TLS_RELAXED_HOSTS;

  if (isPrivateOrBlockedHost(parsedUrl.hostname) && !isTlsRelaxed(url, relaxedHosts)) {
    return { ok: false, error: "Akses ke jaringan lokal/privat diblokir (anti-SSRF)" };
  }

  let lastErr = "gagal";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let status: number;
      let contentType: string;
      let buf: Uint8Array;

      if (isTlsRelaxed(url, relaxedHosts)) {
        const r = await downloadRelaxed(url, timeoutMs, userAgent);
        status = r.status;
        const ct = r.headers["content-type"];
        contentType = Array.isArray(ct) ? (ct[0] ?? "") : (ct ?? "");
        buf = r.body;
      } else {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetch(url, {
            signal: ctrl.signal,
            redirect: "follow",
            headers: { "User-Agent": userAgent, Accept: "image/*,*/*;q=0.8" },
          });
          status = res.status;
          contentType = res.headers.get("content-type") ?? "";
          buf = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array();
        } finally {
          clearTimeout(timer);
        }
      }

      if (status < 200 || status >= 300) {
        lastErr = `HTTP ${status}`;
        // 4xx: jangan retry (kecuali 429).
        if (status >= 400 && status < 500 && status !== 429) break;
        continue;
      }

      if (buf.length > maxBytes) return { ok: false, error: `terlalu besar (${buf.length} B)` };

      const mime = IMAGE_MIME.test(contentType) ? contentType.split(";")[0]!.toLowerCase() : sniffMime(buf);
      if (!mime || !IMAGE_MIME.test(mime)) {
        return { ok: false, error: `bukan gambar (${contentType || "?"})` };
      }

      return { ok: true, bytes: buf, contentType: mime, contentHash: hashBytes(buf) };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, error: lastErr };
}
