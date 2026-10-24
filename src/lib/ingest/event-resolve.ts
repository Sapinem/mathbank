/**
 * Resolve & tulis EVENT ke bundle + soal SETELAH commit.
 *
 * Diambil dari JUDUL paket (bukan stem soal — temuan korpus: stem nyaris tak
 * punya penanda event). Dipanggil otomatis oleh route commit, dan bisa juga
 * dijalankan manual untuk backfill data lama.
 *
 * Pemetaan: label hasil `detectEvent()` → baris `events` (nama/shortname/alias).
 *
 * ⚠️ Event BARU yang belum ada di katalog TIDAK dibuat otomatis — dilaporkan
 * lewat `findUnknownEvents()` agar pemilik memutuskan lebih dulu.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { events, bundles, bundleItems, questions } from "@/lib/db/schema";
import { detectEvent } from "./event-detect";

export interface EventResolveResult {
  bundlesTagged: number;
  questionsTagged: number;
  bundlesNoEvent: number;
}

/** Peta label(lowercase) → event id, dari nama + shortname + alias. */
export async function eventIndex(db: Database): Promise<Map<string, string>> {
  const rows = await db.select().from(events);
  const m = new Map<string, string>();
  for (const e of rows) {
    m.set(e.name.toLowerCase(), e.id);
    if (e.shortname) m.set(e.shortname.toLowerCase(), e.id);
    const aliases = Array.isArray(e.aliases) ? (e.aliases as string[]) : [];
    for (const a of aliases) m.set(String(a).toLowerCase(), e.id);
  }
  return m;
}

/** Cari event UTAMA untuk sebuah judul (label pertama yang dikenal katalog). */
export function mainEventFor(title: string, idx: Map<string, string>): string | null {
  for (const label of detectEvent(title).events) {
    const id = idx.get(label.toLowerCase());
    if (id) return id;
  }
  return null;
}

/**
 * Isi event untuk bundle tertentu (biasanya baru saja di-commit).
 * Idempoten: aman dijalankan berulang.
 */
export async function resolveEventsForBundles(
  db: Database,
  bundleIds: string[],
): Promise<EventResolveResult> {
  const res: EventResolveResult = { bundlesTagged: 0, questionsTagged: 0, bundlesNoEvent: 0 };
  if (bundleIds.length === 0) return res;

  const idx = await eventIndex(db);
  const rows = await db
    .select({ id: bundles.id, title: bundles.title })
    .from(bundles)
    .where(inArray(bundles.id, bundleIds));

  for (const b of rows) {
    const eventId = mainEventFor(b.title, idx);
    if (!eventId) {
      res.bundlesNoEvent++;
      continue;
    }

    const d = detectEvent(b.title);
    const subtest = d.subtests[0] ?? null;

    // Satu transaksi per bundle: penandaan bundle & soal tidak boleh terpisah.
    // ⚠️ HANYA menandai yang BELUM bertanda (`event_id IS NULL`). Menimpa
    // entri yang sudah ada berarti menghapus koreksi manual, dan menulis
    // `eventYear: null` menghapus tahun yang sudah benar saat judul tak
    // memuat tahun.
    const tagged = await db.transaction(async (tx) => {
      const bundleUpd = await tx
        .update(bundles)
        .set({ eventId, updatedAt: new Date() })
        .where(and(eq(bundles.id, b.id), isNull(bundles.eventId)))
        .returning({ id: bundles.id });
      const bundleUpdated = bundleUpd.length > 0;

      const qs = await tx
        .select({ qid: bundleItems.questionId })
        .from(bundleItems)
        .where(eq(bundleItems.bundleId, b.id));
      if (qs.length === 0) return { bundle: bundleUpdated, questions: 0 };

      const upd = await tx
        .update(questions)
        .set({
          eventId,
          // Hanya isi atribut yang benar-benar terdeteksi.
          ...(d.year !== null ? { eventYear: d.year } : {}),
          ...(subtest ? { eventSubtest: subtest } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(
              questions.id,
              qs.map((r) => r.qid),
            ),
            isNull(questions.eventId),
          ),
        )
        .returning({ id: questions.id });
      return { bundle: bundleUpdated, questions: upd.length };
    });

    if (tagged.bundle) res.bundlesTagged++;
    res.questionsTagged += tagged.questions;
  }
  return res;
}

/** Backfill SELURUH bundle (untuk data lama). */
export async function resolveEventsAll(db: Database): Promise<EventResolveResult> {
  const rows = await db.select({ id: bundles.id }).from(bundles);
  return resolveEventsForBundles(
    db,
    rows.map((r) => r.id),
  );
}

/**
 * Event yang TERDETEKSI dari judul bundle TAPI belum ada di katalog `events`.
 * Dipakai untuk MELAPORKAN (bukan membuat) event baru — pemilik memutuskan dulu.
 */
export async function findUnknownEvents(db: Database, bundleIds: string[]): Promise<string[]> {
  if (bundleIds.length === 0) return [];
  const idx = await eventIndex(db);
  const rows = await db
    .select({ title: bundles.title })
    .from(bundles)
    .where(inArray(bundles.id, bundleIds));

  const unknown = new Set<string>();
  for (const r of rows) {
    const d = detectEvent(r.title);
    for (const label of d.events) {
      if (!idx.has(label.toLowerCase())) unknown.add(label);
    }
  }
  return [...unknown];
}
