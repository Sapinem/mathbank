/**
 * Orkestrasi unduh gambar korpus (M9-2b).
 *
 * Alur: markdown soal (berisi `![alt](url)`) → untuk tiap URL: unduh → simpan →
 * **daftarkan ke `media_assets`** (dapat `short_id`) → ganti URL di markdown
 * dengan **shortcode `{{img:<shortId>}}`**.
 *
 * KENAPA didaftarkan di sini (G4.1): `storeImage()` hanya menulis berkas ke
 * disk. Tanpa pendaftaran, berkas itu tak punya baris `media_assets` — tak bisa
 * dikelola, tak bisa disajikan, dan tak bisa dibersihkan saat jadi orphan.
 * Karena `short_id` lahir dari pendaftaran, langkah ini **prasyarat**, bukan
 * pelengkap: markdown memakai `short_id`, jadi ia harus ada sebelum penulisan.
 *
 * Yang gagal → **flag** (soal tetap dibuat, gambar ditandai untuk telaah).
 * Idempoten: URL yang sudah terunduh di sesi ini (atau hash sudah ada) tak
 * diunduh ulang.
 */
import { fetchImage } from "./fetch";
import { storeImage, relativePath } from "./store";
import { absolutize } from "./resolve-url";
import { bestImageSrc } from "../parsers/clean";
import { mediaShortcode } from "@/lib/media/shortcode";

/**
 * Pendaftar aset — DISUNTIKKAN pemanggil, bukan diimpor langsung.
 *
 * KENAPA callback (aturan #15): lapisan ini murni orkestrasi unduh+simpan.
 * Mengimpor `media-service` langsung akan menarik `db` ke sini sehingga
 * (a) lapisan L6 tak lagi murni, dan (b) tes unit butuh DATABASE_URL.
 * Pemanggil produksi (`ingest/service.ts`) menyuntikkan implementasi nyata.
 */
export type MediaRegistrar = (input: {
  relativePath: string;
  contentHash: string;
  mimeType: string;
  fileSize: number;
  role: "content" | "option" | "solution";
  orderIndex: number;
}) => Promise<{ shortId: string }>;

/** Satu gambar yang berhasil/tak berhasil diunduh. */
export interface MediaOutcome {
  sourceUrl: string;
  /** Shortcode `{{img:<shortId>}}` untuk disisipkan ke markdown (bila ok). */
  shortcode?: string;
  /** short_id aset terdaftar (bila ok). */
  shortId?: string;
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
  /**
   * Pendaftar aset (disuntikkan). Bila diisi, setiap gambar yang berhasil
   * diunduh didaftarkan → `short_id` lahir → markdown memakai shortcode.
   * Bila tidak, markdown tetap memakai URL sumber (mode uji murni).
   */
  register?: MediaRegistrar;
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
 * Unduh, simpan, lalu **daftarkan** semua gambar untuk SATU artikel.
 *
 * Mengembalikan peta `sourceUrl → MediaOutcome`. Untuk gambar yang berhasil,
 * `outcome.shortcode` berisi `{{img:<shortId>}}` yang siap disisipkan ke markdown.
 */
export async function ingestArticleMedia(
  texts: { text: string; role: MediaOutcome["role"] }[],
  opts: IngestMediaOptions,
): Promise<MediaCache> {
  const cache = opts.cache ?? new Map<string, MediaOutcome>();
  const registrar = opts.register;
  const delay = opts.delayMs ?? 0;

  // Kumpulkan URL unik yang belum di-cache.
  const seen = new Set<string>();
  const queue: { url: string; role: MediaOutcome["role"]; orderIndex: number }[] = [];
  let order = 0;
  for (const t of texts) {
    for (const c of collectUrls(t.text, opts.articleUrl, t.role)) {
      if (cache.has(c.url) || seen.has(c.url)) continue;
      seen.add(c.url);
      queue.push({ ...c, orderIndex: order++ });
    }
  }

  for (let i = 0; i < queue.length; i++) {
    const { url, role, orderIndex } = queue[i]!;
    const res = await fetchImage(url);
    if (res.ok && res.bytes && res.contentHash && res.contentType) {
      await storeImage(opts.rootDir, res.contentHash, res.contentType, res.bytes);

      // Pendaftaran → short_id lahir di sini. Tanpa ini markdown tak bisa
      // memakai shortcode, dan berkas jadi orphan di disk.
      let shortId: string | undefined;
      if (registrar) {
        const asset = await registrar({
          relativePath: relativePath(res.contentHash, res.contentType),
          contentHash: res.contentHash,
          mimeType: res.contentType,
          fileSize: res.bytes.length,
          role,
          orderIndex,
        });
        shortId = asset.shortId;
      }

      cache.set(url, {
        sourceUrl: url,
        ...(shortId ? { shortId, shortcode: mediaShortcode(shortId) } : {}),
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
 * Terapkan hasil ke teks.
 *
 * Yang **berhasil** → markdown `![alt](url)` diganti shortcode `{{img:<shortId>}}`
 * (alt dipertahankan sebagai judul aset). Yang **gagal** → URL sumber dibiarkan
 * apa adanya agar tetap terlihat & bisa ditelaah.
 */
export function applyMedia(text: string, cache: MediaCache): string {
  let out = text;
  for (const [src, res] of cache) {
    if (!res.ok || !res.shortcode || !res.shortId) continue;
    // Ganti `![alt](src)` → `{{img:id}}` sambil mempertahankan alt sebagai judul.
    out = out.replace(
      new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegExp(src)}(?:\\s+"[^"]*")?\\)`, "g"),
      (_full, alt: string) => (alt && alt.trim() ? `{{img:${res.shortId}}}` : res.shortcode!),
    );
    // Sisa kemunculan (mis. di dalam tag <img> yang telanjang) → shortcode.
    out = replaceUrl(out, src, res.shortcode);
  }
  return out;
}

/** Escape karakter regex agar URL (yang banyak berisi `.` `/` `?`) aman dipakai pola. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
