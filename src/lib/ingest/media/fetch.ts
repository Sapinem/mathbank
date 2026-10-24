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
import { join, extname, resolve, sep } from "node:path";

/**
 * Root direktori korpus gambar (baca saja — tidak pernah ditulis).
 *
 * ⚠️ Dulu HARD-CODED ke `defantri` saja, sehingga sumber lain (mis.
 * `pusmendik_dayaserap`) gagal resolve. Sekarang **generik per-sumber**:
 * `corpus://<sumber>/<…sisa>` → `<CORPORA_BASE>/<sumber>/images/<…sisa>`.
 *
 * Dua tata letak didukung (keduanya terjadi nyata):
 *   - `corpus://defantri/<slug>/<file>`            → `<…>/defantri/images/<slug>/<file>`
 *   - `corpus://pusmendik_dayaserap/<file>`        → `<…>/pusmendik_dayaserap/images/<file>`
 */
/**
 * Root direktori korpus gambar (baca saja — tidak pernah ditulis).
 * Dapat dikonfigurasi melalui environment variable `CORPORA_BASE` atau `CORPUS_IMAGE_BASE`.
 */
export function getCorporaBase(): string {
  return (
    process.env.CORPORA_BASE?.trim() ||
    process.env.CORPUS_IMAGE_BASE?.trim() ||
    "/home/hari/projects/qbank/data/corpora"
  );
}

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
  const cleanHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (cleanHost === "localhost" || cleanHost === "0.0.0.0" || cleanHost === "0") return true;

  // IPv6 check
  if (
    cleanHost === "::" ||
    cleanHost === "::1" ||
    cleanHost === "0:0:0:0:0:0:0:0" ||
    cleanHost === "0:0:0:0:0:0:0:1" ||
    cleanHost.startsWith("fe80:") ||
    cleanHost.startsWith("fc") ||
    cleanHost.startsWith("fd")
  ) {
    return true;
  }

  // IPv4-mapped IPv6 check (::ffff:127.0.0.1, ::ffff:7f00:1 dll)
  if (cleanHost.includes("::ffff:")) {
    const mapped = cleanHost.replace(/^::ffff:/i, "");
    if (isPrivateOrBlockedHost(mapped)) return true;
    const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hexMatch) {
      const p1 = parseInt(hexMatch[1]!, 16);
      const p2 = parseInt(hexMatch[2]!, 16);
      const ip = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`;
      if (isPrivateOrBlockedHost(ip)) return true;
    }
  }

  // IPv4 check
  const ipv4 = cleanHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    const c = Number(ipv4[3]);
    const d = Number(ipv4[4]);
    if (a > 255 || b > 255 || c > 255 || d > 255) return true; // octet di luar jangkauan
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local AWS metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT / cloud metadata
    if (a >= 224) return true; // multicast / reserved
  }

  return false;
}

/** Alias untuk isPrivateOrBlockedHost (Pilar 2). */
export const isBlockedIp = isPrivateOrBlockedHost;

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
  if (isTlsRelaxed(rawUrl, relaxedHosts)) return; // host di-pin (misal pusmendik atau test mock server)
  if (isPrivateOrBlockedHost(u.hostname)) {
    throw new Error("Akses ke jaringan lokal/privat diblokir / terblokir (anti-SSRF)");
  }
  let ips: string[];
  try {
    ips = await resolve(u.hostname);
  } catch {
    throw new Error(`Gagal resolusi DNS: ${u.hostname}`);
  }
  for (const ip of ips) {
    if (isPrivateOrBlockedHost(ip)) {
      throw new Error(`DNS ${u.hostname} → ${ip} diblokir / terblokir (anti-SSRF)`);
    }
  }
}

/** Validasi URL sebelum fetch (anti-SSRF): hanya http/https, resolve DNS, tolak IP terblokir/privat. */
export async function validateMediaUrl(
  urlStr: string,
  opts?: { tlsRelaxedHosts?: string[]; dnsResolver?: DnsResolver }
): Promise<void> {
  const relaxed = opts?.tlsRelaxedHosts ?? TLS_RELAXED_HOSTS;
  const resolver = opts?.dnsResolver ?? defaultDnsResolver;
  await assertPublicTarget(urlStr, relaxed, resolver);
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

function concat(chunks: (Uint8Array | Uint8Array<ArrayBufferLike>)[]): Uint8Array<ArrayBuffer> {
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
  maxBytes: number,
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
        res.on("error", (err) => {
          req.destroy();
          reject(err);
        });
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
          if (!isTlsRelaxed(next, relaxedHosts)) {
            reject(new Error(`Redirect ke host non-relaxed (${new URL(next).hostname}) tidak diizinkan di jalur TLS relaxed`));
            return;
          }
          resolve(downloadRelaxed(next, timeoutMs, maxBytes, userAgent, relaxedHosts, redirects - 1));
          return;
        }
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        res.on("data", (c: Buffer) => {
          totalBytes += c.length;
          if (totalBytes > maxBytes) {
            req.destroy(new Error(`terlalu besar: ukuran stream melebihi batas (${maxBytes} B)`));
            return;
          }
          chunks.push(new Uint8Array(c));
        });
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
  maxBytes: number,
  userAgent: string,
  relaxedHosts: string[],
  resolve: DnsResolver,
): Promise<RawResponse> {
  // Validasi anti-SSRF SEBELUM menyentuh jaringan.
  await assertPublicTarget(url, relaxedHosts, resolve);

  if (isTlsRelaxed(url, relaxedHosts)) {
    return downloadRelaxed(url, timeoutMs, maxBytes, userAgent, relaxedHosts);
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

    let body = new Uint8Array(0);
    if (res.ok) {
      const contentLength = res.headers.get("content-length");
      if (contentLength && Number(contentLength) > maxBytes) {
        if (res.body) await res.body.cancel().catch(() => {});
        throw new Error(`terlalu besar: ukuran stream melebihi batas (${maxBytes} B)`);
      }

      if (res.body) {
        const reader = res.body.getReader();
        const chunks: (Uint8Array | Uint8Array<ArrayBufferLike>)[] = [];
        let totalBytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.byteLength;
              if (totalBytes > maxBytes) {
                await reader.cancel().catch(() => {});
                throw new Error(`terlalu besar: ukuran stream melebihi batas (${maxBytes} B)`);
              }
              chunks.push(value);
            }
          }
          body = concat(chunks);
        } catch (err) {
          await reader.cancel().catch(() => {});
          throw err;
        }
      } else {
        body = new Uint8Array(await res.arrayBuffer());
      }
    } else if (res.body) {
      // Bebaskan socket/stream pada status non-2xx
      await res.body.cancel().catch(() => {});
    }

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
  maxBytes: number,
  userAgent: string,
  relaxedHosts: string[],
  resolve: DnsResolver,
): Promise<RawResponse> {
  let current = startUrl;
  const deadline = Date.now() + timeoutMs;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const remainingTime = Math.max(1000, deadline - Date.now());
    if (Date.now() >= deadline) {
      throw new Error("timeout");
    }
    const r = await fetchHop(current, remainingTime, maxBytes, userAgent, relaxedHosts, resolve);
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
  if (parts.some((p) => p === ".." || p === "." || !safe.test(p))) {
    return { ok: false, error: `corpus:// path mengandung karakter tidak aman: ${url}` };
  }
  // Resolusi path: segmen pertama = nama SUMBER korpus, sisanya relatif
  // terhadap `<sumber>/images/`.
  //   corpus://defantri/<slug>/<file>       → corpora/defantri/images/<slug>/<file>
  //   corpus://pusmendik_dayaserap/<file>   → corpora/pusmendik_dayaserap/images/<file>
  const [sumber, ...sisa] = parts;
  const baseDir = resolve(join(getCorporaBase(), sumber!, "images"));
  const absPath = resolve(join(baseDir, ...sisa));
  if (absPath !== baseDir && !absPath.startsWith(baseDir + sep)) {
    return { ok: false, error: `corpus:// path traversal ditolak: ${url}` };
  }

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
    if (attempt > 0) {
      const baseDelay = Math.min(500 * Math.pow(2, attempt - 1), 3000);
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, baseDelay + jitter));
    }
    try {
      const { status, contentType, body: buf } = await fetchFollowingRedirects(
        url,
        timeoutMs,
        maxBytes,
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
      if (
        /anti-SSRF|diblokir|terblokir|Protokol tidak diizinkan|URL tidak valid|melebihi batas|Redirect tak sah/i.test(
          lastErr,
        )
      ) {
        break;
      }
    }
  }
  return { ok: false, error: lastErr };
}

/** Alias fetchMedia untuk fetchImage (Pilar 2). */
export const fetchMedia = fetchImage;
export type FetchMediaOpts = FetchOptions;
export type FetchMediaResult = FetchResult;
