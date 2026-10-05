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
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { questionTopics, questionTags, topics } from "@/lib/db/schema/taxonomy";
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

/** Ambil id soal yang terkait sekumpulan topik (M:N). */
async function questionIdsForTopics(topicIds: string[]): Promise<string[]> {
  if (topicIds.length === 0) return [];
  const rows = await db
    .select({ id: questionTopics.questionId })
    .from(questionTopics)
    .where(inArray(questionTopics.topicId, topicIds));
  return [...new Set(rows.map((r) => r.id))];
}

async function questionIdsForTag(tagId: string): Promise<string[]> {
  const rows = await db
    .select({ id: questionTags.questionId })
    .from(questionTags)
    .where(eq(questionTags.tagId, tagId));
  return [...new Set(rows.map((r) => r.id))];
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
 */
export async function buildQuestionFilter(
  query: ListQuestionsQuery,
): Promise<BuiltFilter> {
  // ── Resolusi topik (DB) ──────────────────────────────────────
  let resolvedTopicIds: string[] | undefined;
  let questionIdsForTopicsResolved: string[] | undefined;

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
    questionIdsForTopicsResolved = await questionIdsForTopics(resolvedTopicIds);
  }

  // ── Resolusi tag (DB) ────────────────────────────────────────
  let questionIdsForTagResolved: string[] | undefined;
  if (query.tagId) {
    questionIdsForTagResolved = await questionIdsForTag(query.tagId);
  }

  // ── Bangun kondisi (pure) ───────────────────────────────────
  return buildFilterFrom(query, {
    resolvedTopicIds,
    questionIdsForTopics: questionIdsForTopicsResolved,
    questionIdsForTag: questionIdsForTagResolved,
  });
}
