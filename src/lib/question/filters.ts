/**
 * Eksekutor filter soal (L5) — pecahan dari `filters.ts` lama.
 *
 * Modul ini adalah **cangkang imperatif** (imperative shell): menangani I/O DB
 * (snapshot topik, `question_topics`, `question_tags`) lalu meneruskan hasilnya
 * ke pembangun MURNI (`filters-builder.ts`, L6) yang tak menyentuh DB.
 *
 * Pemisahan ini mengikuti pola *Functional Core, Imperative Shell* (Gary
 * Bernhardt): inti logika (builder) bisa diuji cepat tanpa DB; cangkang ini
 * tetap di L5 dan boleh menyentuh `@/lib/db`.
 *
 * `collectTopicDescendants` tetap diekspor di sini untuk kompatibilitas
 * pemanggil lama (mis. `question-service.db.test.ts`).
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { questionTags, topics } from "@/lib/db/schema/taxonomy";
import type { ListQuestionsQuery } from "@/lib/contracts/question";
import {
  collectDescendantsFrom,
  buildFilterFrom,
  type BuiltFilter,
  type TopicEdge,
} from "./filters-builder";

/**
 * Kumpulkan id topik + seluruh keturunannya (rekursif, BFS).
 *
 * Mengambil snapshot topik dari DB, lalu memanggil fungsi pure
 * `collectDescendantsFrom` untuk traversal.
 */
export async function collectTopicDescendants(
  rootId: string,
): Promise<string[]> {
  const all = await db
    .select({ id: topics.id, parentId: topics.parentId })
    .from(topics);
  return collectDescendantsFrom(all as TopicEdge[], rootId);
}

/**
 * Pastikan tag ada (dipakai sebagai penjaga otorisasi/filter).
 *
 * **PERF-01:** daftar id soal TIDAK lagi ditarik ke Node.js — filter tag
 * dieksekusi PostgreSQL lewat semi-join `EXISTS` (lihat `filters-builder.ts`).
 * Fungsi ini hanya memverifikasi tag ada; tak mengembalikan id soal.
 */
async function tagExists(tagId: string): Promise<boolean> {
  const rows = await db
    .select({ tagId: questionTags.tagId })
    .from(questionTags)
    .where(eq(questionTags.tagId, tagId))
    .limit(1);
  return rows.length > 0;
}

/** Re-export tipe & builder murni agar pemanggil lama tetap kompatibel. */
export type { BuiltFilter } from "./filters-builder";
export {
  collectDescendantsFrom,
  buildFilterFrom,
  type TopicEdge,
  type FilterResolution,
} from "./filters-builder";

/**
 * Bangun kondisi WHERE dari param. `byRelevance` true bila ada `q` (pencarian
 * teks) — pemanggil memakai similarity trigram untuk pengurutan.
 *
 * Fungsi ini adalah cangkang: ia memecah resolusi topik/tag (DB) dari
 * pembangunan kondisi (pure, di `filters-builder.ts`).
 *
 * **PERF-01:** hasil resolusi yang diteruskan ke builder hanya DAFTAR ID TOPIK
 * (biasanya kecil) — bukan ribuan id soal. Semi-join `EXISTS` di SQL yang
 * menyaring soal, sehingga tak ada tarikan UUID raksasa ke memori Node.js.
 */
export async function buildQuestionFilter(
  query: ListQuestionsQuery,
): Promise<BuiltFilter> {
  // ── Resolusi topik (DB) ──────────────────────────────────────
  let resolvedTopicIds: string[] | undefined;

  if (query.topicId?.length) {
    const allIds = new Set<string>();
    // Ambil snapshot SEKALI untuk seluruh root (hindari query per-root).
    const edges = (
      await db.select({ id: topics.id, parentId: topics.parentId }).from(topics)
    ) as TopicEdge[];
    for (const root of query.topicId) {
      const descendants = collectDescendantsFrom(edges, root);
      for (const d of descendants) allIds.add(d);
    }
    resolvedTopicIds = [...allIds];
  }

  // ── Resolusi tag (DB) ────────────────────────────────────────
  // PERF-01: cukup pastikan tag ada; penyaringan dilakukan lewat EXISTS.
  // Tag yang tak dikenal → hasil kosong (paritas dengan perilaku lama).
  let tagMissing = false;
  if (query.tagId) {
    tagMissing = !(await tagExists(query.tagId));
  }

  // ── Bangun kondisi (pure) ───────────────────────────────────
  const built = buildFilterFrom(query, { resolvedTopicIds });
  if (tagMissing) return { where: sql`false`, byRelevance: built.byRelevance };
  return built;
}
