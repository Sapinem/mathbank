/**
 * Daftarkan berkas media yang sudah ada di storage TAPI belum tercatat di
 * `media_assets` — sisa dari celah ② (storeImage menulis disk tanpa INSERT).
 *
 * Jalur yang dipakai WAJIB sama dengan ingest & unggah: `registerMediaAsset()`.
 * Skrip ini tidak menulis INSERT sendiri — kalau service berubah, skrip ikut.
 *
 * Jalankan:  pnpm tsx scripts/register-orphan-files.ts          (kering: hanya lapor)
 *            pnpm tsx scripts/register-orphan-files.ts --apply  (benar-benar daftarkan)
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep, extname } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib (jalankan lewat pnpm tsx)");

const APPLY = process.argv.includes("--apply");
const root = process.env.MEDIA_STORAGE_PATH ?? join(process.cwd(), "storage", "media");

const sql = postgres(url, { max: 1 });

/** Ekstensi → mime. Hanya gambar yang didaftarkan. */
const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
};

/** Telusuri storage, kembalikan daftar berkas gambar (path relatif). */
async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (MIME_BY_EXT[extname(entry.name).toLowerCase()]) out.push(full);
  }
  return out;
}

/**
 * Berkas berukuran sangat kecil hampir pasti bukan gambar sungguhan
 * (mis. berkas uji 11 byte). Ambang 100 byte cukup longgar tapi menyaring sampah.
 */
const MIN_BYTES = 100;

async function registerOrphanFiles() {
  const files = await walk(root);
  console.log(`Menelusuri ${root}`);
  console.log(`Ditemukan ${files.length} berkas gambar\n`);

  const known = await sql`SELECT content_hash FROM media_assets`;
  const knownHashes = new Set(known.map((r) => r.content_hash as string));

  const todo: { rel: string; mime: string; size: number; hash: string }[] = [];
  const skipped: string[] = [];

  for (const abs of files) {
    const info = await stat(abs);
    if (info.size < MIN_BYTES) {
      skipped.push(`${relative(root, abs)} (${info.size} B — terlalu kecil)`);
      continue;
    }
    const bytes = await readFile(abs);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const rel = relative(root, abs).split(sep).join("/");
    const mime = MIME_BY_EXT[extname(abs).toLowerCase()]!;

    if (knownHashes.has(hash)) {
      skipped.push(`${rel} (sudah terdaftar)`);
      continue;
    }
    todo.push({ rel, mime, size: info.size, hash });
  }

  console.log(`Akan didaftarkan : ${todo.length}`);
  for (const t of todo) console.log(`  + ${t.rel}  ${t.mime}  ${t.size} B`);
  if (skipped.length) {
    console.log(`\nDilewati : ${skipped.length}`);
    for (const s of skipped) console.log(`  - ${s}`);
  }

  if (!APPLY) {
    console.log("\n(MODE KERING — tidak ada yang ditulis. Tambahkan --apply untuk eksekusi.)");
    await sql.end();
    return;
  }

  const { registerMediaAsset } = await import("../src/lib/services/media-service");
  let ok = 0;
  for (const t of todo) {
    const res = await registerMediaAsset({
      relativePath: t.rel,
      contentHash: t.hash,
      mimeType: t.mime,
      fileSize: t.size,
      role: "content",
      orderIndex: 0,
      altText: null,
      sourceOrigin: "manual_upload",
    });
    console.log(`  ✓ ${res.shortId}  {{img:${res.shortId}}}  ${t.rel}`);
    ok++;
  }

  console.log(`\nSelesai: ${ok} aset terdaftar.`);
  await sql.end();
}

registerOrphanFiles().catch(async (e) => {
  console.error("GAGAL:", e);
  await sql.end();
  process.exit(1);
});
