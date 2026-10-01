#!/usr/bin/env tsx
/**
 * Verifikasi LIVE hygiene media (G4.6): aset orphan → laporan → hapus → hilang
 * dari disk DAN DB. Membersihkan dirinya sendiri.
 *
 * Pemakaian:  pnpm media:verify-hygiene
 *
 * Melewati HTTP (endpoint butuh sesi guru) — yang diuji adalah SERVICE, yang
 * memuat seluruh logika penjagaan: menolak hapus aset yang masih dipakai soal.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib");

const root = process.env.MEDIA_STORAGE_PATH ?? join(process.cwd(), "storage", "media");
const sql = postgres(url, { max: 1 });

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 42, 42, 42, 42]);
const hash = createHash("sha256").update(PNG).digest("hex");
const rel = join(hash.slice(0, 2), `${hash}.png`);
const SHORT = "HYGLIVE1";

async function main() {
  const { findOrphanAssets, deleteAsset } = await import(
    "../src/lib/services/media-service"
  );

  // Bersihkan sisa.
  await sql`DELETE FROM media_assets WHERE short_id = ${SHORT} OR content_hash = ${hash}`;

  // 1. Siapkan berkas + baris.
  const abs = join(root, rel);
  await mkdir(join(root, hash.slice(0, 2)), { recursive: true });
  await writeFile(abs, PNG);
  await sql`
    INSERT INTO media_assets (short_id, title, original_image_path, mime_type, file_size, content_hash, source_origin)
    VALUES (${SHORT}, 'uji-orphan-live', ${rel}, 'image/png', ${PNG.length}, ${hash}, 'manual_upload')
  `;
  console.log("1. Aset dibuat :", SHORT);

  // 2. Harus muncul sebagai orphan.
  const rep = await findOrphanAssets();
  const found = rep.data.some((o) => o.shortId === SHORT);
  console.log("2. Terdeteksi orphan :", found, `(total ${rep.total} aset, ${rep.totalBytes} B)`);
  if (!found) throw new Error("GAGAL: aset tidak terdeteksi sebagai orphan");

  // 3. Berkas ada sebelum hapus.
  await stat(abs);
  console.log("3. Berkas ada sebelum hapus : ya");

  // 4. Hapus.
  const res = await deleteAsset(SHORT);
  console.log("4. Hasil hapus :", JSON.stringify(res));

  // 5. Verifikasi hilang dari DB.
  const after = await sql`SELECT 1 FROM media_assets WHERE short_id = ${SHORT}`;
  console.log("5. Baris DB tersisa :", after.length, "(harus 0)");

  // 6. Verifikasi hilang dari disk.
  let stillThere = false;
  try {
    await stat(abs);
    stillThere = true;
  } catch {
    stillThere = false;
  }
  console.log("6. Berkas masih ada :", stillThere, "(harus false)");

  const ok = found && after.length === 0 && !stillThere;
  console.log("\n=== HASIL:", ok ? "LULUS" : "GAGAL", "===");
  await sql.end();
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => {
  console.error("GAGAL:", e);
  await sql.end();
  process.exit(1);
});
