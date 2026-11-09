/**
 * backfill-media-dimensions.ts
 *
 * Mengisi kolom `width` dan `height` pada tabel `media_assets` dengan membaca
 * berkas fisik di `storage/media/` menggunakan parser dimensi murni (L4).
 *
 * Idempoten: hanya baris yang `width IS NULL OR height IS NULL` yang diproses.
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/backfill-media-dimensions.ts          # dry-run
 *   pnpm tsx --env-file=.env scripts/backfill-media-dimensions.ts --apply  # terapkan ke DB
 */
import { config } from "dotenv";
import postgres from "postgres";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getImageDimensions } from "@/lib/media/dimensions";
import { mediaStorageRoot } from "@/lib/ingest/config";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib disetel.");

const APPLY = process.argv.includes("--apply");
const sql = postgres(url, { max: 4 });

interface MediaRow {
  id: string;
  short_id: string;
  original_image_path: string | null;
  svg_path: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
}

async function main() {
  console.log("=== Backfill Dimensi Media Assets (width & height) ===");
  console.log(`Mode: ${APPLY ? "APPLY (menulis ke database)" : "DRY-RUN (hanya pratinjau)"}\n`);

  const rows = await sql<MediaRow[]>`
    SELECT id, short_id, original_image_path, svg_path, mime_type, width, height
    FROM media_assets
    WHERE width IS NULL OR height IS NULL
    ORDER BY created_at ASC
  `;

  console.log(`Total baris perlu diproses: ${rows.length}`);
  if (rows.length === 0) {
    console.log("✓ Semua baris media_assets sudah memiliki dimensi. Selesai.");
    await sql.end();
    return;
  }

  const root = resolve(mediaStorageRoot());
  console.log(`Media storage root        : ${root}\n`);

  let parsedCount = 0;
  let missingFileCount = 0;
  let unparsedCount = 0;

  const updates: { id: string; width: number; height: number; shortId: string }[] = [];

  for (const row of rows) {
    const relPath = row.svg_path || row.original_image_path;
    if (!relPath) {
      missingFileCount++;
      continue;
    }

    const absPath = resolve(join(root, relPath));
    try {
      const fileStat = await stat(absPath);
      if (!fileStat.isFile()) {
        missingFileCount++;
        continue;
      }

      // Baca hingga 64 KB awal (cukup untuk header format apa pun)
      const buffer = await readFile(absPath);
      const dims = getImageDimensions(buffer);

      if (dims && dims.width > 0 && dims.height > 0) {
        parsedCount++;
        updates.push({
          id: row.id,
          width: dims.width,
          height: dims.height,
          shortId: row.short_id,
        });
      } else {
        unparsedCount++;
      }
    } catch {
      missingFileCount++;
    }
  }

  console.log(`Hasil pembacaan berkas fisik:`);
  console.log(`- Berhasil diekstrak dimensinya : ${parsedCount}`);
  console.log(`- Berkas tidak ditemukan/rusak   : ${missingFileCount}`);
  console.log(`- Format header tak terurai      : ${unparsedCount}`);

  if (!APPLY) {
    console.log(`\n(dry-run) ${updates.length} baris siap diperbarui.`);
    console.log("Jalankan dengan flag `--apply` untuk menyimpan perubahan ke database.");
    await sql.end();
    return;
  }

  console.log(`\nMenulis ${updates.length} pembaruan dimensi ke database...`);
  const BATCH_SIZE = 100;
  let updatedTotal = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    await sql.begin(async (tx) => {
      for (const item of chunk) {
        await tx`
          UPDATE media_assets
          SET width = ${item.width},
              height = ${item.height}
          WHERE id = ${item.id}
        `;
      }
    });
    updatedTotal += chunk.length;
    process.stdout.write(`\rProgres: ${updatedTotal} / ${updates.length} diperbarui...`);
  }

  console.log(`\n\n✓ Sukses! ${updatedTotal} baris media_assets berhasil diperbarui dengan dimensi.`);
  await sql.end();
}

main().catch(async (err) => {
  console.error("✗ Gagal:", err);
  await sql.end();
  process.exit(1);
});
