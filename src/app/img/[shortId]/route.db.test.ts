import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tes route penyaji `/img/[shortId]` (G4.2).
 *
 * Memverifikasi: Tri-Facet fallback, header keamanan (SVG CSP + nosniff),
 * 404 untuk short_id tak dikenal/malah bentuk, dan TOLAK path traversal.
 *
 * Route diuji lewat pemanggilan handler langsung (jalur nyata), bukan service.
 */
const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

// Storage diarahkan ke direktori sementara SEBELUM modul route dimuat.
const tmpRoot = await mkdtemp(join(tmpdir(), "mb-serve-"));
process.env.MEDIA_STORAGE_PATH = tmpRoot;

const sql = postgres(url, { max: 4 });
const { GET } = await import("@/app/img/[shortId]/route");

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
const SVG_BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');

async function put(rel: string, bytes: Uint8Array) {
  const { dirname } = await import("node:path");
  const abs = join(tmpRoot, rel);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  return abs;
}

async function mkAsset(opts: {
  shortId: string;
  raster?: string;
  svg?: string;
  mime?: string;
  hash: string | null;
}) {
  const [row] = await sql`
    INSERT INTO media_assets (short_id, title, original_image_path, svg_path, mime_type, file_size, content_hash, source_origin)
    VALUES (${opts.shortId}, ${"uji-serve-" + opts.shortId}, ${opts.raster ?? null}, ${opts.svg ?? null},
            ${opts.mime ?? "image/png"}, 100, ${opts.hash}, 'web_ingest')
    RETURNING id
  `;
  return row!.id as string;
}

function req(shortId: string, headers?: Record<string, string>) {
  return new Request(`http://localhost:1234/img/${shortId}`, { headers });
}

async function call(shortId: string, headers?: Record<string, string>) {
  return GET(req(shortId, headers), { params: Promise.resolve({ shortId }) });
}

beforeEach(async () => {
  await sql`DELETE FROM media_assets WHERE title LIKE 'uji-serve-%'`;
});

afterAll(async () => {
  await sql`DELETE FROM media_assets WHERE title LIKE 'uji-serve-%'`;
  await sql.end();
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("GET /img/[shortId]", () => {
  it("menyajikan berkas raster dengan header benar", async () => {
    const rel = "aa/aaaa.png";
    await put(rel, PNG_BYTES);
    await mkAsset({ shortId: "SERVE001", raster: rel, hash: "servehash-1" });

    const res = await call("SERVE001");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toContain("max-age");
  });

  it("SVG diprioritaskan (Tri-Facet) + CSP ketat", async () => {
    const rasterRel = "bb/bbbb.png";
    const svgRel = "bb/bbbb.svg";
    await put(rasterRel, PNG_BYTES);
    await put(svgRel, SVG_BYTES);
    await mkAsset({
      shortId: "SERVE002", raster: rasterRel, svg: svgRel,
      mime: "image/svg+xml", hash: "servehash-2",
    });

    const res = await call("SERVE002");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
  });

  it("fallback ke raster bila berkas SVG hilang", async () => {
    const rasterRel = "cc/cccc.png";
    await put(rasterRel, PNG_BYTES);
    await mkAsset({
      shortId: "SERVE003", raster: rasterRel, svg: "cc/hilang.svg",
      mime: "image/svg+xml", hash: "servehash-3",
    });

    const res = await call("SERVE003");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml"); // mime aset
  });

  it("404 untuk short_id tak dikenal", async () => {
    const res = await call("NOTFOUND");
    expect(res.status).toBe(404);
  });

  it("404 untuk bentuk short_id tak sah (tanpa sentuh DB)", async () => {
    for (const bad of ["abc", "a7Kx9m-2", "aaaaaaaaaaa"]) {
      const res = await call(bad);
      expect(res.status).toBe(404);
    }
  });

  it("404 bila berkas tak ada di storage", async () => {
    await mkAsset({ shortId: "SERVE004", raster: "dd/hilang.png", hash: "servehash-4" });
    const res = await call("SERVE004");
    expect(res.status).toBe(404);
  });

  it("MENOLAK path traversal (keluar dari root storage)", async () => {
    // Path menunjuk keluar root — harus ditolak, bukan disajikan.
    await mkAsset({ shortId: "SERVE005", raster: "../../etc/passwd", hash: "servehash-5" });
    const res = await call("SERVE005");
    expect(res.status).toBe(404);
  });

  it("menolak path absolut (bukan relatif)", async () => {
    await mkAsset({ shortId: "SERVE006", raster: "/etc/passwd", hash: "servehash-6" });
    const res = await call("SERVE006");
    expect(res.status).toBe(404);
  });

  it("ACT-17: mengembalikan ETag dan merespons 304 jika If-None-Match cocok", async () => {
    const rel = "ee/eeee.png";
    await put(rel, PNG_BYTES);
    await mkAsset({ shortId: "SERVE007", raster: rel, hash: "servehash-7" });

    // Request 1: tanpa If-None-Match -> 200 + ETag
    const res1 = await call("SERVE007");
    expect(res1.status).toBe(200);
    const etag = res1.headers.get("etag");
    expect(etag).toBe('"servehash-7"');

    // Request 2: dengan If-None-Match cocok -> 304 Not Modified
    const res2 = await call("SERVE007", { "if-none-match": etag! });
    expect(res2.status).toBe(304);
    expect(res2.headers.get("etag")).toBe(etag);
  });

  it("ACT-17: mengembalikan 200 jika If-None-Match berbeda", async () => {
    const rel = "ff/ffff.png";
    await put(rel, PNG_BYTES);
    await mkAsset({ shortId: "SERVE008", raster: rel, hash: "servehash-8" });

    const res = await call("SERVE008", { "if-none-match": '"beda-hash"' });
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"servehash-8"');
  });

  it("ACT-17: TANPA content_hash tidak memasang ETag (jangan pakai shortId sebagai pengganti)", async () => {
    const rel = "gg/gggg.png";
    await put(rel, PNG_BYTES);
    await mkAsset({ shortId: "SERVE009", raster: rel, hash: null });

    const res = await call("SERVE009");
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBeNull();

    // Regresi lama: ETag jatuh ke shortId → klien yang mengirim balik nilai itu
    // menerima 304 padahal berkas bisa sudah diganti. Tanpa hash, wajib 200.
    const res2 = await call("SERVE009", { "if-none-match": '"SERVE009"' });
    expect(res2.status).toBe(200);
  });

  it("ACT-17: berkas hilang + If-None-Match cocok tetap 404 (bukan 304)", async () => {
    // Baris aset ada & hash cocok, tetapi berkasnya tidak ada di storage.
    await mkAsset({ shortId: "SERVE010", raster: "hh/hilang.png", hash: "servehash-10" });

    const res = await call("SERVE010", { "if-none-match": '"servehash-10"' });
    expect(res.status).toBe(404);
  });
});
