#!/usr/bin/env tsx
/**
 * Verifikasi LIVE route penyaji `/img/{shortId}` (G4.2).
 *
 * Menulis aset nyata → memanggil HTTP server yang hidup → memeriksa status,
 * header keamanan, dan isi byte → membersihkan dirinya sendiri.
 *
 * Pemakaian:  pnpm media:verify-img          (server harus hidup di :1234)
 *
 * KENAPA perlu, padahal sudah ada tes DB: tes memanggil HANDLER route langsung,
 * sedangkan di sini permintaan benar-benar lewat jaringan seperti browser. Route
 * bisa lolos tes handler sambil belum ada di build aktif — inilah yang menangkapnya.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib (jalankan lewat `pnpm tsx` agar .env termuat)");

const BASE = process.env.BASE_URL ?? "http://localhost:1234";
const root = process.env.MEDIA_STORAGE_PATH ?? join(process.cwd(), "storage", "media");
const sql = postgres(url, { max: 1 });

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7]);
const hash = createHash("sha256").update(PNG).digest("hex");
const rel = join(hash.slice(0, 2), `${hash}.png`);
const SHORT = "LIVETEST";

let gagal = 0;
function cek(label: string, benar: boolean) {
  if (!benar) gagal++;
  console.log(`  ${benar ? "✓" : "✗"} ${label}`);
}

async function main() {
  const abs = join(root, rel);
  await mkdir(join(root, hash.slice(0, 2)), { recursive: true });
  await writeFile(abs, PNG);

  await sql`DELETE FROM media_assets WHERE short_id = ${SHORT} OR content_hash = ${hash}`;
  await sql`
    INSERT INTO media_assets (short_id, title, original_image_path, mime_type, file_size, content_hash, source_origin)
    VALUES (${SHORT}, 'uji-live', ${rel}, 'image/png', ${PNG.length}, ${hash}, 'web_ingest')
  `;
  console.log(`Aset uji terdaftar: ${SHORT}\n`);

  const res = await fetch(`${BASE}/img/${SHORT}`);
  const body = new Uint8Array(await res.arrayBuffer());

  console.log("Penyajian aset nyata:");
  cek(`status 200 (dapat ${res.status})`, res.status === 200);
  cek(`content-type image/png (dapat ${res.headers.get("content-type")})`,
    res.headers.get("content-type") === "image/png");
  cek("header nosniff ada", res.headers.get("x-content-type-options") === "nosniff");
  cek("cache-control panjang", (res.headers.get("cache-control") ?? "").includes("max-age"));
  cek(`byte identik (${body.length} B)`,
    body.length === PNG.length && body.every((b, i) => b === PNG[i]));

  console.log("\nUji negatif:");
  const takAda = await fetch(`${BASE}/img/ZZZZZZZZ`);
  cek("short_id tak dikenal → 404", takAda.status === 404);
  const bentukSalah = await fetch(`${BASE}/img/abc`);
  cek("bentuk short_id salah → 404", bentukSalah.status === 404);
  const traversal = await fetch(`${BASE}/img/..%2F..%2Fetc%2Fpasswd`);
  cek("path traversal → 404", traversal.status === 404);

  // Bersihkan.
  await sql`DELETE FROM media_assets WHERE short_id = ${SHORT}`;
  await rm(abs, { force: true });

  console.log(`\n=== ${gagal === 0 ? "LULUS" : `GAGAL (${gagal} pemeriksaan)`} ===`);
  await sql.end();
  process.exit(gagal === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("GAGAL:", e);
  await sql.end();
  process.exit(1);
});
