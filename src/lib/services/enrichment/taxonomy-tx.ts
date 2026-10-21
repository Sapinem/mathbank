/**
 * Operasi taksonomi dalam transaksi enrichment (L5) — pecahan
 * `enrichment-service.ts`.
 *
 * **MAT-131A (Tahap A):** identitas topik/tag = `id` (UUIDv7), bukan `slug`.
 * Lookup utama kini murni berbasis nama (`lower(name)`); `slug` hanya dipakai
 * sebagai **fallback legacy** untuk mencocokkan baris lama yang masih punya
 * slug. Baris baru ditulis **tanpa** slug (`NULL`), sehingga:
 *  - tidak ada lagi tabrakan `uq_topics_slug` / `uq_tags_slug` (PostgreSQL
 *    mengizinkan banyak NULL pada kolom ber-unique index), dan
 *  - tidak ada lagi kebutuhan memotong slug NFKD (CORR-02) — nama utuh
 *    disimpan apa adanya.
 * `onConflictDoNothing` tetap dipertahankan untuk `uq_tags_name` (nama unik
 * pada `tags`), dengan re-select setelah konflik.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { topics, tags } from "@/lib/db/schema/taxonomy";
import { slugify } from "./shared";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Cari topik: (1) nama case-insensitive, (2) fallback slug legacy.
 * Mengembalikan `undefined` bila tidak ada.
 */
async function findTopicTx(tx: Tx, name: string): Promise<string | undefined> {
  const [byName] = await tx
    .select({ id: topics.id })
    .from(topics)
    .where(sql`lower(${topics.name}) = lower(${name})`)
    .limit(1);
  if (byName) return byName.id;

  // Fallback legacy: baris lama mungkin bernama lain tapi slug-nya sama.
  // `slug IS NOT NULL` menjaga query tetap selektif setelah kolom nullable.
  const legacySlug = slugify(name);
  const [byLegacySlug] = await tx
    .select({ id: topics.id })
    .from(topics)
    .where(sql`${topics.slug} IS NOT NULL AND ${topics.slug} = ${legacySlug}`)
    .limit(1);
  return byLegacySlug?.id;
}

/** Cari/buat topik berdasarkan nama (case-insensitive), dalam transaksi. */
export async function findOrCreateTopicTx(tx: Tx, name: string): Promise<string> {
  const existing = await findTopicTx(tx, name);
  if (existing) return existing;

  // Tanpa `slug` → NULL (aman terhadap unique index & tanpa potong NFKD).
  const [row] = await tx
    .insert(topics)
    .values({ name, level: 1 })
    .onConflictDoNothing()
    .returning({ id: topics.id });
  if (row) return row.id;

  const again = await findTopicTx(tx, name);
  // Tanpa non-null assertion: lebih baik galat jelas daripada `TypeError`.
  if (!again) throw new Error(`Gagal membuat/menemukan topik: ${name}`);
  return again;
}

/**
 * Cari tag: (1) nama case-insensitive, (2) fallback slug legacy.
 * Mengembalikan `undefined` bila tidak ada.
 */
async function findTagTx(tx: Tx, name: string): Promise<string | undefined> {
  const [byName] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${name})`)
    .limit(1);
  if (byName) return byName.id;

  // Fallback legacy (lihat catatan pada `findTopicTx`).
  const legacySlug = slugify(name, 100);
  const [byLegacySlug] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(sql`${tags.slug} IS NOT NULL AND ${tags.slug} = ${legacySlug}`)
    .limit(1);
  return byLegacySlug?.id;
}

/** Cari/buat tag berdasarkan nama, dalam transaksi. */
export async function findOrCreateTagTx(tx: Tx, name: string): Promise<string> {
  const existing = await findTagTx(tx, name);
  if (existing) return existing;

  // Tanpa `slug` → NULL; benturan hanya mungkin pada `uq_tags_name` (ditangani
  // `onConflictDoNothing` + re-select di bawah).
  const [row] = await tx
    .insert(tags)
    .values({ name })
    .onConflictDoNothing()
    .returning({ id: tags.id });
  if (row) return row.id;

  const again = await findTagTx(tx, name);
  // Tanpa non-null assertion: cegah runtime `TypeError` bila benar-benar gagal.
  if (!again) throw new Error(`Gagal membuat/menemukan tag: ${name}`);
  return again;
}
