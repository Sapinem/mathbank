/**
 * Operasi taksonomi dalam transaksi enrichment (L5) — pecahan
 * `enrichment-service.ts`.
 *
 * Mencari/membuat topik & tag tanpa memicu galat unik. **CORR-03:** fallback
 * kueri OR (nama ATAU slug) + tanpa non-null assertion → galat jelas, bukan
 * runtime `TypeError`.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { topics, tags } from "@/lib/db/schema/taxonomy";
import { slugify } from "./shared";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Cari/buat topik berdasarkan nama (case-insensitive), dalam transaksi. */
export async function findOrCreateTopicTx(tx: Tx, name: string): Promise<string> {
  const slug = slugify(name);
  // **CORR-03:** cocokkan nama ATAU slug. Tabrakan bisa pada `uq_topics_slug`
  // (dua nama berbeda → slug sama), bukan hanya pada nama.
  const [existing] = await tx
    .select({ id: topics.id })
    .from(topics)
    .where(sql`lower(${topics.name}) = lower(${name}) OR ${topics.slug} = ${slug}`)
    .limit(1);
  if (existing) return existing.id;
  const [row] = await tx
    .insert(topics)
    .values({ name, slug, level: 1 })
    .onConflictDoNothing()
    .returning({ id: topics.id });
  if (row) return row.id;
  const [again] = await tx
    .select({ id: topics.id })
    .from(topics)
    .where(sql`lower(${topics.name}) = lower(${name}) OR ${topics.slug} = ${slug}`)
    .limit(1);
  // Tanpa non-null assertion: lebih baik galat jelas daripada `TypeError`.
  if (!again) throw new Error(`Gagal membuat/menemukan topik: ${name}`);
  return again.id;
}

/** Cari/buat tag berdasarkan nama, dalam transaksi. */
export async function findOrCreateTagTx(tx: Tx, name: string): Promise<string> {
  const slug = slugify(name);
  // **CORR-03:** fallback kueri OR (nama ATAU slug) — tabrakan unik `tags` bisa
  // pada `uq_tags_name` maupun `uq_tags_slug`.
  const [existing] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${name}) OR ${tags.slug} = ${slug}`)
    .limit(1);
  if (existing) return existing.id;
  const [row] = await tx
    .insert(tags)
    .values({ name, slug })
    .onConflictDoNothing()
    .returning({ id: tags.id });
  if (row) return row.id;
  const [again] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${name}) OR ${tags.slug} = ${slug}`)
    .limit(1);
  // Tanpa non-null assertion: cegah runtime `TypeError` bila benar-benar gagal.
  if (!again) throw new Error(`Gagal membuat/menemukan tag: ${name}`);
  return again.id;
}
