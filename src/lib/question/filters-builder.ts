/**
 * Pembangun filter soal (L6) — MURNI, tanpa DB.
 *
 * Dipisah dari `filters.ts` (executor) agar logika filter bisa diuji cepat
 * tanpa database (CONSTRAINTS #15: L6 = fungsi murni).
 *
 * Tanggung jawab:
 *  - BFS pengumpulan keturunan topik dari snapshot datar (pure).
 *  - Bangun kondisi WHERE dari param query + hasil resolusi topik/tag.
 *
 * Tidak mengimpor `@/lib/db` — hanya `drizzle-orm` (SQL builder, murni) dan
 * tipe dari skema/kontrak.
 */
import { and, eq, isNull, inArray, sql, type SQL } from "drizzle-orm";
import { questions } from "@/lib/db/schema/question";
import type { ListQuestionsQuery } from "@/lib/contracts/question";

/** Bentuk ringkas node topik untuk perhitungan pure. */
export interface TopicEdge {
  id: string;
  parentId: string | null;
}

/**
 * Kumpulkan id topik + seluruh keturunannya (rekursif, BFS) dari snapshot datar.
 *
 * Pure: tidak menyentuh DB. Pemanggil menyediakan snapshot (`edges`).
 */
export function collectDescendantsFrom(
  edges: TopicEdge[],
  rootId: string,
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const t of edges) {
    if (t.parentId) {
      const arr = childrenOf.get(t.parentId) ?? [];
      arr.push(t.id);
      childrenOf.set(t.parentId, arr);
    }
  }
  const ids: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    ids.push(cur);
    for (const c of childrenOf.get(cur) ?? []) queue.push(c);
  }
  return ids;
}

/** Hasil: kondisi SQL + opsi pengurutan (relevansi bila ada pencarian). */
export interface BuiltFilter {
  where: SQL | undefined;
  /** Bila true, urutkan berdasar relevansi teks (bukan createdAt). */
  byRelevance: boolean;
}

/**
 * Param tambahan hasil resolusi DB (topik/tag → daftar id soal).
 * Pemanggil (executor) mengisi ini sebelum memanggil `buildFilterFrom`.
 */
export interface FilterResolution {
  /** Id seluruh topik + keturunan (gabungan bila multi-topik). */
  resolvedTopicIds?: string[];
  /** Id soal yang terkait topik di atas (dari `question_topics`). */
  questionIdsForTopics?: string[];
  /** Id soal yang terkait tag (dari `question_tags`). */
  questionIdsForTag?: string[];
}

/**
 * Bangun kondisi WHERE dari param + hasil resolusi topik/tag.
 *
 * Pure: tidak menyentuh DB. `resolution` diisi oleh executor (`filters.ts`).
 * `byRelevance` true bila ada `q` (pencarian teks, mode non-semantic) —
 * pemanggil memakai similarity trigram untuk pengurutan.
 */
export function buildFilterFrom(
  query: ListQuestionsQuery,
  resolution: FilterResolution = {},
): BuiltFilter {
  const conds: SQL[] = [];
  if (!query.includeDeleted) conds.push(isNull(questions.deletedAt));
  if (query.status) conds.push(eq(questions.status, query.status));
  if (query.questionType?.length)
    conds.push(inArray(questions.questionType, query.questionType));
  if (query.grade?.length) conds.push(inArray(questions.grade, query.grade));
  if (query.difficulty?.length)
    conds.push(inArray(questions.difficulty, query.difficulty));
  if (query.cognitiveLevel)
    conds.push(eq(questions.cognitiveLevel, query.cognitiveLevel));
  // ADR-0014: filter sumber kini berarti "soal yang ada di bundle bersumber X"
  // (subquery lewat bundle_items ⋈ bundles), bukan kolom questions.source_id.
  if (query.sourceId)
    conds.push(
      sql`EXISTS (
        SELECT 1 FROM bundle_items bi
        JOIN bundles b ON b.id = bi.bundle_id
        WHERE bi.question_id = ${questions.id}
          AND b.deleted_at IS NULL
          AND b.source_id = ${query.sourceId}
      )`,
    );
  if (query.eventId) conds.push(eq(questions.eventId, query.eventId));
  if (query.flagged !== undefined)
    conds.push(eq(questions.isFlagged, query.flagged));

  // Pencarian teks: trigram typo-tolerant (pg_trgm). `word_similarity` agar
  // kata sebagian tetap cocok; ambang 0.3 cukup longgar untuk typo ringan.
  // Pada mode **semantic**, filter trigram DINONAKTIFKAN (pencocokan lewat vektor).
  if (query.q && query.mode !== "semantic") {
    const term = query.q.trim();
    conds.push(
      sql`(${questions.contentMarkdown} % ${term} OR ${questions.contentMarkdown} ILIKE ${"%" + term + "%"})`,
    );
  }

  // Filter topik — pakai hasil resolusi dari executor.
  if (query.topicId?.length) {
    const ids = resolution.questionIdsForTopics;
    if (!ids || ids.length === 0)
      return { where: sql`false`, byRelevance: !!query.q };
    conds.push(inArray(questions.id, ids));
  }
  if (query.tagId) {
    const ids = resolution.questionIdsForTag;
    if (!ids || ids.length === 0)
      return { where: sql`false`, byRelevance: !!query.q };
    conds.push(inArray(questions.id, ids));
  }

  return {
    where: conds.length ? and(...conds) : undefined,
    byRelevance: !!query.q && query.mode !== "semantic",
  };
}
