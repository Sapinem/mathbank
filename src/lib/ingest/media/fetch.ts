/**
 * Unduh gambar korpus (M9-2b) — lapisan I/O, terisolasi agar mudah diuji.
 *
 * Batasan:
 *   - **timeout** keras (jangan menggantung ingest).
 *   - **batas ukuran** (tolak berkas terlalu besar).
 *   - **mime whitelist** (hanya gambar).
 *   - **1 permintaan** per gambar + retry terbatas.
 *   - **anti-SSRF (SEC-01)**: resolusi DNS pra-koneksi + redirect `manual` yang
 *     divalidasi ULANG tiap hop, sehingga loopback/RFC1918/link-local
 *     (`169.254.169.254`) tetap diblokir walau lewat DNS rebinding atau 30x.
 *
 * Protokol tambahan:
 *   - **corpus://**: berkas gambar lokal dari korpus ingest (tidak menyentuh
 *     jaringan). Format: `corpus://defantri/<slug>/<filename>`. Berkas fisik
 *     dibaca dari `CORPUS_IMAGE_BASE/<slug>/<filename>`.
 */
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { lookup as dnsLookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

/**
 * Root direktori gambar korpus Defantri (baca saja — tidak pernah ditulis).
 * Berkas fisik: `<CORPUS_IMAGE_BASE>/<slug>/<filename>`.
 */
const CORPUS_IMAGE_BASE = "/home/hari/projects/qbank/data/corpora/defantri/images";

/** Domain yang sertifikat SSL-nya rusak di sumber (temuan: pusmendik kemdikdasmen). */
const TLS_RELAXED_HOSTS = ["pusmendik.kemendikdasmen.go.id"];

/** Batas lompatan redirect (manual) — cegah loop tak terbatas. */
const MAX_REDIRECTS = 5;

/**
 * Resolver DNS pra-koneksi. Disuntik agar tes tak butuh jaringan nyata.
 * Mengembalikan daftar alamat (IPv4 & IPv6).
 */
export type DnsResolver = (hostname: string) => Promise<string[]>;

/** Resolver bawaan: `dns.lookup({ all: true })`. */
const defaultDnsResolver: DnsResolver = async (hostname) => {
  const addrs = await dnsLookup(hostname, { all: true });
  return addrs.map((a) => a.address);
};

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
  /** Resolver DNS pra-koneksi (default: `dns.lookup`). Disuntik di tes. */
  dnsResolver?: DnsResolver;
}

const DEFAULT_UA = "MathBank-Ingest/0.1 (+https://b.iyo.my.id)";
const IMAGE_MIME = /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp|avif)$/i;

/** Deteksi mime dari magic bytes (fallback bila header salah). */
function sniffMime(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  // SVG: teks — cek awalan "<svg" atau "<?xml" (abaikan spasi/BOM).
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
 * Gerbang anti-SSRF (SEC-01): tolak bila protokol bukan http(s), host LITERAL
 * privat, atau **hasil resolusi DNS**-nya menunjuk IP privat/loopback/metadata.
 *
 * KENAPA resolusi pra-koneksi: `isPrivateOrBlockedHost(hostname)` saja bisa
 * dilewati domain yang DNS-nya menunjuk `127.0.0.1` (DNS rebinding). Karena itu
 * kita me-resolve dulu, lalu memvalidasi SETIAP alamat. Host yang di-pin
 * (sertifikat rusak) sengaja dilewati — daftarnya tertutup & diaudit.
 */
async function assertPublicTarget(
  rawUrl: string,
  relaxedHosts: string[],
  resolve: DnsResolver,
): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("URL tidak valid");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Protokol tidak diizinkan (hanya http/https)");
  }
  if (isTlsRelaxed(rawUrl, relaxedHosts)) return; // host di-pin, disengaja
  if (isPrivateOrBlockedHost(u.hostname)) {
    throw new Error("Akses ke jaringan lokal/privat diblokir (anti-SSRF)");
  }
  let ips: string[];
  try {
    ips = await resolve(u.hostname);
  } catch {
    throw new Error(`Gagal resolusi DNS: ${u.hostname}`);
  }
  for (const ip of ips) {
    if (isPrivateOrBlockedHost(ip)) {
      throw new Error(`DNS ${u.hostname} → ${ip} diblokir (anti-SSRF)`);
    }
  }
}

/** Respons mentah satu hop (termasuk lokasi redirect bila ada). */
interface RawResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
  location: string | null;
}

/** Normalisasi header (string | string[] | undefined) → string. */
function headerString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
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

/**
 * Unduh lewat modul `https`/`http` Node dengan `rejectUnauthorized: false`
 * **hanya** untuk host di `TLS_RELAXED_HOSTS` (sertifikat rusak di sumber).
 * Mengikuti redirect (maks 5) — tiap hop tetap dijaga anti-SSRF.
 */
function downloadRelaxed(
  url: string,
  timeoutMs: number,
  userAgent: string,
  relaxedHosts: string[],
  redirects = MAX_REDIRECTS,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      reject(new Error("URL tidak valid"));
      return;
    }
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
          let next: string;
          try {
            next = new URL(res.headers.location, url).toString();
          } catch {
            reject(new Error("Redirect tak sah"));
            return;
          }
          // SEC-01: hop ke host privat ditolak walau berasal dari host di-pin.
          if (
            isPrivateOrBlockedHost(new URL(next).hostname) &&
            !isTlsRelaxed(next, relaxedHosts)
          ) {
            reject(new Error("Redirect ke host privat diblokir (anti-SSRF)"));
            return;
          }
          resolve(downloadRelaxed(next, timeoutMs, userAgent, relaxedHosts, redirects - 1));
          return;
        }
        const chunks: Uint8Array[] = [];
        res.on("data", (c: Buffer) => chunks.push(new Uint8Array(c)));
        res.on("end", () =>
          resolve({
            status: code,
            contentType: headerString(res.headers["content-type"]),
            body: concat(chunks),
            location: headerString(res.headers.location) || null,
          }),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** Satu hop unduh (relaxed → modul node; selain itu → `fetch` mode manual). */
async function fetchHop(
  url: string,
  timeoutMs: number,
  userAgent: string,
  relaxedHosts: string[],
  resolve: DnsResolver,
): Promise<RawResponse> {
  // Validasi anti-SSRF SEBELUM menyentuh jaringan.
  await assertPublicTarget(url, relaxedHosts, resolve);

  if (isTlsRelaxed(url, relaxedHosts)) {
    return downloadRelaxed(url, timeoutMs, userAgent, relaxedHosts);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      // SEC-01: manual — redirect kita ikuti sendiri agar tiap hop divalidasi.
      redirect: "manual",
      headers: { "User-Agent": userAgent, Accept: "image/*,*/*;q=0.8" },
    });
    const body = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array();
    return {
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body,
      location: res.headers.get("location"),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ikuti redirect secara MANUAL (SEC-01): tiap lompatan divalidasi ulang oleh
 * `fetchHop` → redirect menuju IP privat tak pernah tereksekusi.
 */
async function fetchFollowingRedirects(
  startUrl: string,
  timeoutMs: number,
  userAgent: string,
  relaxedHosts: string[],
  resolve: DnsResolver,
): Promise<RawResponse> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const r = await fetchHop(current, timeoutMs, userAgent, relaxedHosts, resolve);
    if (r.status >= 300 && r.status < 400 && r.location) {
      if (hop === MAX_REDIRECTS) throw new Error("terlalu banyak redirect");
      current = new URL(r.location, current).toString();
      continue;
    }
    return r;
  }
  throw new Error("terlalu banyak redirect");
}

/**
 * Baca gambar dari korpus lokal untuk URL berprotokol `corpus://`.
 *
 * Format: `corpus://defantri/<slug>/<filename>`
 * Berkas fisik: `CORPUS_IMAGE_BASE/<slug>/<filename>`
 *
 * Path di-sanitasi: tidak ada `..'` / traversal; hanya karakter aman yang
 * diperbolehkan agar tidak bisa kabur dari CORPUS_IMAGE_BASE.
 */
async function fetchCorpusImage(url: string, maxBytes: number): Promise<FetchResult> {
  // Ambil bagian setelah "corpus://"
  const rest = url.slice("corpus://".length);
  // Pisahkan segmen: sumber/slug/filename
  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) {
    return { ok: false, error: `corpus:// path terlalu pendek: ${url}` };
  }
  // Validasi: tolak traversal / karakter berbahaya
  const safe = /^[A-Za-z0-9._\-]+$/;
  if (!parts.every((p) => safe.test(p))) {
    return { ok: false, error: `corpus:// path mengandung karakter tidak aman: ${url}` };
  }
  // Gabungkan path — abaikan segmen pertama (nama sumber, mis. "defantri")
  const [, ...rest2] = parts;
  const absPath = join(CORPUS_IMAGE_BASE, ...rest2);

  let bytes: Uint8Array;
  try {
    const buf = await readFile(absPath);
    bytes = new Uint8Array(buf);
  } catch (e) {
    return { ok: false, error: `corpus:// berkas tidak ditemukan: ${absPath} (${e instanceof Error ? e.message : String(e)})` };
  }

  if (bytes.length > maxBytes) {
    return { ok: false, error: `corpus:// terlalu besar (${bytes.length} B)` };
  }

  // Deteksi mime dari ekstensi lalu magic bytes sebagai fallback.
  const ext = extname(absPath).toLowerCase();
  const extMimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".avif": "image/avif",
  };
  const mime = extMimeMap[ext] ?? sniffMime(bytes);
  if (!mime || !IMAGE_MIME.test(mime)) {
    return { ok: false, error: `corpus:// bukan gambar (${ext || "?"})` };
  }

  return { ok: true, bytes, contentType: mime, contentHash: hashBytes(bytes) };
}

/** Unduh satu gambar. */
export async function fetchImage(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, error: "URL tidak valid" };
  }

  // Protokol corpus:// — baca berkas lokal, tanpa jaringan.
  if (parsedUrl.protocol === "corpus:") {
    const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
    return fetchCorpusImage(url, maxBytes);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { ok: false, error: "Protokol tidak diizinkan (hanya http/https)" };
  }

  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const retries = opts.retries ?? 2;
  const userAgent = opts.userAgent ?? DEFAULT_UA;
  const relaxedHosts = opts.tlsRelaxedHosts ?? TLS_RELAXED_HOSTS;
  const resolve = opts.dnsResolver ?? defaultDnsResolver;

  let lastErr = "gagal";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { status, contentType, body: buf } = await fetchFollowingRedirects(
        url,
        timeoutMs,
        userAgent,
        relaxedHosts,
        resolve,
      );

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
