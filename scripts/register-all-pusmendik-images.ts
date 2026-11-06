/**
 * register-all-pusmendik-images.ts
 *
 * Registers all 509 image files from /home/hari/projects/qbank/data/corpora/pusmendik_tka/images/
 * into MathBank's official media storage (storage/media/) and `media_assets`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib");

const dir = "/home/hari/projects/qbank/data/corpora/pusmendik_tka/images";
const mediaRoot = process.env.MEDIA_STORAGE_PATH || join(process.cwd(), "storage", "media");

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

const sql = postgres(url, { max: 2 });

async function main() {
  console.log("=== Register All Pusmendik TKA Images ===");
  const files = readdirSync(dir);
  console.log(`Total files to process: ${files.length}`);

  const { storeAndRegister } = await import("../src/lib/services/media-service");

  let newCount = 0;
  let reusedCount = 0;

  for (const f of files) {
    const filePath = join(dir, f);
    const bytes = readFileSync(filePath);
    const ext = extname(f).toLowerCase();
    const mime = MIME_BY_EXT[ext] || "image/png";
    const hash = createHash("sha256").update(bytes).digest("hex");

    const res = await storeAndRegister(mediaRoot, {
      contentHash: hash,
      mimeType: mime,
      bytes: new Uint8Array(bytes),
      title: `Pusmendik TKA ${f}`,
      sourceOrigin: "web_ingest",
    });

    if (res.reused) reusedCount++;
    else newCount++;
  }

  console.log(`Selesai! Baru didaftarkan: ${newCount}, sudah ada (reused): ${reusedCount}`);
  await sql.end({ timeout: 1 });
  process.exit(0);
}

main().catch(async (e) => {
  console.error("GAGAL:", e);
  await sql.end();
  process.exit(1);
});
