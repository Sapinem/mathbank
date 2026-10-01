/**
 * Dedup dua-tingkat (ADR-0012, CONSTRAINTS #42/#43).
 *
 * Tingkat:
 *   1. **Exact** — `contentHash` sama → auto-gabung. Dilakukan di jalur
 *      **ingest** (`commit.ts`), murah (hash, tanpa vektor).
 *   2. **Near** — kemiripan 0.85 ≤ s < 0.98 → JANGAN auto-gabung; hanya DITANDAI
 *      (flag) bila penalaran sama. Dilakukan di jalur **enrichment** (setelah
 *      embedding dihitung) — BUKAN saat ingest, agar ingest tetap cepat.
 *
 * Memakai utilitas yang SUDAH ADA (`DEDUP_EXACT`/`DEDUP_NEAR` dari
 * `search/fusion.ts`) → sekaligus konsumen produksi `fusion.ts` (menutup #43).
 */
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import {
  DEDUP_EXACT,
  DEDUP_NEAR,
  classifyDuplicate,
} from "@/lib/search/fusion";

export interface NearDuplicateHit {
  id: string;
  /** Jarak kosinus (0 = identik). */
  distance: number;
  /** Kemiripan = 1 - distance. */
  score: number;
  /** Zona near + penalaran sama (=kandidat duplikat, perlu tinjauan). */
  isDuplicate: boolean;
}

/**
 * Cari soal "mirip" (near) untuk satu soal memakai **embedding** (HNSW, `<=>`).
 *
 * Dipanggil di jalur **enrichment** (embedding sudah/akan tersedia). Soal tanpa
 * embedding → hasil kosong (near-vektor dilewati; exact tetap jalan di ingest).
 */
export async function findNearDuplicates(
  questionId: string,
  opts: { exact?: number; near?: number; limit?: number } = {},
): Promise<NearDuplicateHit[]> {
  const exact = opts.exact ?? DEDUP_EXACT;
  const near = opts.near ?? DEDUP_NEAR;
  const limit = opts.limit ?? 20;

  // Ambil vektor + grade + kunci soal sumber.
  const [src] = await db
    .select({
      id: questions.id,
      grade: questions.grade,
      embedding: questions.embedding,
      answerKey: questions.answerKey,
    })
    .from(questions)
    .where(and(eq(questions.id, questionId), isNull(questions.deletedAt)))
    .limit(1);
  if (!src || !src.embedding) return [];

  const literal = `[${src.embedding.join(",")}]`;
  const srcCorrect = (src.answerKey as { correct?: unknown } | null)?.correct;

  // Kandidat: jarak kosinus terkecil (HNSW), soal lain, grade sama, punya embedding.
  const rows = await db
    .select({
      id: questions.id,
      answerKey: questions.answerKey,
      distance: sql<number>`(${questions.embedding} <=> ${literal}::vector)`,
    })
    .from(questions)
    .where(
      and(
        isNull(questions.deletedAt),
        ne(questions.id, questionId),
        eq(questions.grade, src.grade),
        sql`${questions.embedding} IS NOT NULL`,
      ),
    )
    .orderBy(sql`${questions.embedding} <=> ${literal}::vector`)
    .limit(limit);

  const hits: NearDuplicateHit[] = [];
  for (const r of rows) {
    const distance = Number(r.distance);
    const score = 1 - distance;
    const otherReasoning = (r.answerKey as { correct?: unknown } | null)?.correct;
    const verdict = classifyDuplicate(score, srcCorrect, otherReasoning, { exact, near });
    // Duplikat = zona near + penalaran sama (exact ditangani contentHash di ingest).
    if (verdict === "near-duplicate") {
      hits.push({ id: r.id, distance, score, isDuplicate: true });
    } else if (verdict === "near-distinct") {
      // Mirip tapi penalaran beda → BUKAN duplikat (pertahankan keduanya, #42).
      hits.push({ id: r.id, distance, score, isDuplicate: false });
    }
  }
  return hits;
}
