/**
 * Ingest satu artikel dari berkas HTML — enqueue → process → laporan.
 *
 * Jalur yang dipakai PERSIS sama dengan ingest produksi:
 *   enqueue() → markProcessing() → processQueueItem() → commitItems()
 * jadi hasilnya mewakili perilaku nyata, bukan simulasi.
 *
 * Pemakaian:
 *   pnpm tsx scripts/dev/ingest-article.ts <berkas.html> <sumber> "<judul>" [url]
 */
import { readFile } from "node:fs/promises";
import { config } from "dotenv";

config({ path: ".env" });

async function main() {
  const [file, source, title, url] = process.argv.slice(2);
  if (!file || !source || !title) {
    console.error(
      'Pemakaian: pnpm tsx scripts/dev/ingest-article.ts <berkas.html> <mathcyber|defantri> "<judul>" [url]',
    );
    process.exit(1);
  }

  const rawContent = await readFile(file, "utf8");

  const { enqueue, getQueueItem } = await import("../../src/lib/ingest/queue");
  const { processQueueItem } = await import("../../src/lib/ingest/service");
  const { mediaStorageRoot } = await import("../../src/lib/ingest/config");
  const { db } = await import("../../src/lib/db");
  const { authUser, userRoles } = await import("../../src/lib/db/schema/auth");
  const { eq } = await import("drizzle-orm");

  // Aktor: user dengan peran yang boleh mengimpor (jejak audit siapa mengimpor).
  const [admin] = await db
    .select({
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
    })
    .from(authUser)
    .limit(1);
  if (!admin) throw new Error("Tidak ada user di DB — jalankan `pnpm seed:users` dulu.");

  const roles = (
    await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, admin.id))
  ).map((r) => r.role);

  const actor = {
    id: admin.id,
    name: admin.name ?? admin.email,
    roles: roles.length ? roles : ["admin"],
    via: "system",
  } as never;

  console.log(`Artikel : ${title}`);
  console.log(`Sumber  : ${source}`);
  console.log(`Berkas  : ${file} (${(rawContent.length / 1024).toFixed(0)} KB)`);
  console.log(`Aktor   : ${admin.email} [${roles.join(",") || "admin"}]\n`);

  const q = await enqueue({
    title,
    sourceOrigin: source,
    sourceUrl: url ?? null,
    rawContent,
    rawFormat: "html",
    targetGrade: "11",
  });
  console.log(`1. Antrean       : ${q.id} (${q.status}${q.deduped ? ", sudah ada" : ""})`);

  const item = await getQueueItem(q.id);
  if (!item) throw new Error("Item antrean hilang setelah enqueue");

  // CATATAN: processQueueItem() memanggil markProcessing() sendiri sebagai
  // penjagaan balapan. Jangan klaim lebih dulu — kalau diklaim di sini,
  // guard-nya akan menolak dan hasilnya "sudah diproses".
  const res = await processQueueItem(item, { actor, mediaRoot: mediaStorageRoot() });

  console.log(`2. Status        : ${res.status}`);
  console.log(`3. Soal dibuat   : ${res.created}`);
  console.log(`4. Dilewati      : ${res.skipped}`);
  console.log(`5. Media OK/gagal: ${res.mediaOk}/${res.mediaFailed}`);
  if (res.error) console.log(`   galat: ${res.error}`);

  console.log(`\n=== ${res.created > 0 ? "BERHASIL" : "TIDAK ADA SOAL MASUK"} ===`);
  process.exit(res.created > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
