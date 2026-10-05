/**
 * Bersihkan data uji ingest (sekali pakai).
 *
 * Menghapus soal + naskah + antrean + media hasil uji coba ingest.
 * Urutan WAJIB: `bundle_items` (RESTRICT) → `bundles` → `questions`.
 *
 * Jalankan: pnpm tsx --env-file=.env scripts/dev/clean-ingest-test.ts
 */
async function cleanIngestTest() {
  const { db } = await import("../../src/lib/db");
  const { questions } = await import("../../src/lib/db/schema/question");
  const { bundles, bundleItems } = await import("../../src/lib/db/schema/bundle");
  const { ingestQueue } = await import("../../src/lib/db/schema/system");
  const { mediaAssets } = await import("../../src/lib/db/schema/media");
  const { deleteAsset } = await import("../../src/lib/services/media-service");
  const { sql } = await import("drizzle-orm");

  const before = await db.select({ n: sql<number>`count(*)::int` }).from(questions);
  console.log(`Soal sebelum: ${before[0]?.n ?? 0}`);

  // 1. Isi paket (RESTRICT ke questions). MAT-39: koleksi dihapus, hanya bundle_items.
  await db.delete(bundleItems);
  // 2. Paket/naskah.
  await db.delete(bundles);
  // 3. Soal (CASCADE menghabiskan options/solutions/topics/tags/media).
  await db.delete(questions);
  // 4. Antrean ingest.
  await db.delete(ingestQueue);

  // 5. Media — lewat service agar berkas fisiknya ikut terhapus.
  const assets = await db
    .select({ shortId: mediaAssets.shortId, title: mediaAssets.title })
    .from(mediaAssets);
  let removed = 0;
  for (const a of assets) {
    const r = await deleteAsset(a.shortId);
    if (r && "filesRemoved" in r) removed++;
  }
  console.log(`Media dihapus: ${removed}/${assets.length}`);

  const after = await db.select({ n: sql<number>`count(*)::int` }).from(questions);
  const b = await db.select({ n: sql<number>`count(*)::int` }).from(bundles);
  const m = await db.select({ n: sql<number>`count(*)::int` }).from(mediaAssets);
  console.log(
    `\nSesudah — soal: ${after[0]?.n ?? 0} · naskah: ${b[0]?.n ?? 0} · media: ${m[0]?.n ?? 0}`,
  );
  console.log("Sisa tabel lain (sumber/event/topik) DIPERTAHANKAN.");
  process.exit(0);
}
cleanIngestTest();
