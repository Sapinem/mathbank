/**
 * GET /img/[shortId] — penyaji berkas media.
 *
 * KENAPA route ini ada: markdown soal menyimpan shortcode `{{img:<shortId>}}`,
 * TIDAK menyimpan path berkas. Route ini yang menerjemahkan short_id → berkas
 * nyata di storage, sehingga berkas boleh dipindah/diganti tanpa menyentuh soal.
 *
 * KENAPA tidak lewat `wrapRoute`: pembungkus itu memformat semua hasil sebagai
 * JSON `{data}`. Route ini melayani BYTE gambar, jadi ia route handler biasa —
 * namun tetap memakai pagar yang sama (rate limit, format galat seragam).
 *
 * PUBLIK tanpa login: gambar dirender di halaman soal, ekspor cetak, dan
 * pratinjau. Yang dilayani HANYA berkas yang punya baris `media_assets` —
 * berkas asing di storage tidak pernah tersaji lewat jalur ini.
 */
import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { findAssetByShortId } from "@/lib/services/media-service";
import { mediaStorageRoot } from "@/lib/ingest/config";
import { isValidShortId } from "@/lib/media/short-id";
import { checkRateLimit, rateLimitKey, IMAGE_POLICY } from "@/lib/api/rate-limit";
import { log } from "@/lib/telemetry/logger";

/** Header khusus SVG — cegah skrip di dalamnya dieksekusi. */
const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline';";

/** Cache panjang: isi berkas ditentukan oleh hash, jadi aman di-cache lama. */
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

/** IP klien dari header proxy (pola sama dengan route-wrapper). */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

function errorJson(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await params;

  // 1) Rate limit (CONSTRAINTS #33) — route publik, key per IP.
  //    PERF-03: pakai IMAGE_POLICY (burst 300) agar memuat paket 40–50 soal
  //    (puluhan gambar sekaligus) tak memicu HTTP 429 palsu.
  const rl = checkRateLimit(rateLimitKey(null, clientIp(req), "media:serve"), IMAGE_POLICY);
  if (!rl.allowed) {
    return errorJson("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  }

  // 2) Bentuk short_id divalidasi SEBELUM menyentuh DB.
  if (!isValidShortId(shortId)) {
    return errorJson("NOT_FOUND", "Media tidak ditemukan.", 404);
  }

  try {
    const asset = await findAssetByShortId(shortId);
    if (!asset) return errorJson("NOT_FOUND", "Media tidak ditemukan.", 404);

    // ACT-17: Dukungan ETag / If-None-Match → 304 Not Modified
    const etag = `"${asset.contentHash || shortId}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "ETag": etag,
          "Cache-Control": CACHE_CONTROL,
        },
      });
    }

    // 3) Fallback Tri-Facet: SVG (vektor) → raster asli → thumbnail.
    const candidates: { path: string; mime: string }[] = [];
    if (asset.svgPath) candidates.push({ path: asset.svgPath, mime: "image/svg+xml" });
    if (asset.originalImagePath) {
      candidates.push({ path: asset.originalImagePath, mime: asset.mimeType ?? "image/png" });
    }
    if (asset.thumbnailPath) {
      candidates.push({ path: asset.thumbnailPath, mime: asset.mimeType ?? "image/png" });
    }

    const root = resolve(mediaStorageRoot());
    for (const c of candidates) {
      // 4) Anti path-traversal: berkas WAJIB berada di dalam root storage.
      const abs = resolve(join(root, c.path));
      if (abs !== root && !abs.startsWith(root + sep)) {
        log.warn({ msg: "media.path_traversal_blocked", shortId, path: c.path });
        continue;
      }

      try {
        const info = await stat(abs);
        if (!info.isFile()) continue;
        const bytes = await readFile(abs);

        const headers: Record<string, string> = {
          "Content-Type": c.mime,
          "Content-Length": String(bytes.length),
          "ETag": etag,
          "Cache-Control": CACHE_CONTROL,
          "X-Content-Type-Options": "nosniff",
        };
        // SVG = dokumen yang bisa memuat skrip → CSP ketat.
        if (c.mime === "image/svg+xml") headers["Content-Security-Policy"] = SVG_CSP;

        return new NextResponse(new Uint8Array(bytes), { headers });
      } catch {
        // Berkas hilang di disk → coba facet berikutnya.
        continue;
      }
    }

    log.warn({ msg: "media.file_missing", shortId });
    return errorJson("NOT_FOUND", "Berkas media tidak ada di storage.", 404);
  } catch (err) {
    log.error({ msg: "media.serve_failed", shortId, err: String(err) });
    return errorJson("INTERNAL", "Gagal menyajikan media.", 500);
  }
}
