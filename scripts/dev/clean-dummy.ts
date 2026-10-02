/**
 * Bersih-bersih data dummy (sekali pakai).
 *
 * 1. Media tak terpakai (di DB, tak dipakai soal) — hapus via service resmi
 *    supaya berkas fisiknya IKUT terhapus (bukan cuma baris DB).
 * 2. Berkas yatim (di disk, tak ada di DB) — hapus berkasnya saja.
 * 3. Tag sampah (nama hasil parsing rusak) & antrean sisa.
 *
 * Jalankan: pnpm tsx --env-file=.env scripts/dev/clean-dummy.ts
 * Impor dinamis: `@/lib/db` membaca DATABASE_URL saat modul dimuat.
 */
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
const MEDIA_ROOT = "storage/media";

async function cleanDummy() {
  const { db } = await import("../../src/lib/db");
  const { mediaAssets } = await import("../../src/lib/db/schema/media");
  const { tags } = await import("../../src/lib/db/schema/taxonomy");
  const { ingestQueue } = await import("../../src/lib/db/schema/system");
  const { deleteAsset } = await import("../../src/lib/services/media-service");
  const { eq, sql } = await import("drizzle-orm");

  // ── 1. MEDIA tak terpakai (di DB) ──────────────────────────────
  const rows = await db
    .select({ id: mediaAssets.id, shortId: mediaAssets.shortId, title: mediaAssets.title })
    .from(mediaAssets);
  console.log(`Media di DB: ${rows.length}`);
  let del = 0;
  for (const m of rows) {
    try {
      // `deleteAsset` menegakkan izin di route; sebagai skrip admin kita panggil
      // langsung. Ia juga menghapus berkas fisiknya (filesRemoved).
      const r = await deleteAsset(m.shortId);
      if (r && "inUse" in r) {
        console.log(`  = dipakai soal, dilewati: ${m.title}`);
        continue;
      }
      del++;
      const n = r && "filesRemoved" in r ? r.filesRemoved : 0;
      console.log(`  - dihapus (DB + ${n} berkas): ${m.title} [${m.shortId}]`);
    } catch (e) {
      console.log(`  ! gagal ${m.shortId}: ${(e as Error).message}`);
    }
  }
  console.log(`Media terhapus: ${del}/${rows.length}`);

  // ── 2. BERKAS YATIM (di disk, tak di DB) ───────────────────────
  // Kumpulkan path yang MASIH terdaftar di DB (setelah penghapusan di atas).
  const still = await db
    .select({ p: mediaAssets.originalImagePath, s: mediaAssets.svgPath })
    .from(mediaAssets);
  const known = new Set<string>();
  for (const r of still) {
    if (r.p) known.add(join(MEDIA_ROOT, r.p));
    if (r.s) known.add(join(MEDIA_ROOT, r.s));
  }

  const orphans: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (!known.has(full)) orphans.push(full);
    }
  }
  await walk(MEDIA_ROOT);

  console.log(`\nBerkas yatim: ${orphans.length}`);
  let bytes = 0;
  for (const p of orphans) {
    const s = await stat(p);
    bytes += s.size;
    await unlink(p);
    console.log(`  - berkas dihapus: ${p} (${s.size} B)`);
  }
  console.log(`Total dibebaskan: ${(bytes / 1024).toFixed(1)} KB`);

  // ── 3. TAG SAMPAH & ANTREAN SISA ───────────────────────────────
  const tagDel = await db
    .delete(tags)
    .where(sql`${tags.usageCount} = 0 AND length(${tags.name}) > 30`)
    .returning({ name: tags.name });
  console.log(`\nTag sampah dihapus: ${tagDel.length}`);
  for (const t of tagDel) console.log(`  - ${t.name.slice(0, 40)}…`);

  const iqDel = await db
    .delete(ingestQueue)
    .where(eq(ingestQueue.status, "completed"))
    .returning({ title: ingestQueue.title });
  console.log(`Antrean selesai dihapus: ${iqDel.length}`);
  for (const q of iqDel) console.log(`  - ${q.title.slice(0, 50)}`);

  process.exit(0);
}
cleanDummy();
