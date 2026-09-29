import { count, desc, eq, isNull, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import { topics, questionTopics } from "@/lib/db/schema/taxonomy";
import { sources } from "@/lib/db/schema/source";
import { bundles } from "@/lib/db/schema/bundle";
import { wrapRoute } from "@/lib/api/route-wrapper";

/**
 * GET /api/stats — ringkasan dasbor (RENCANA-UI §3.1 "dasbor ramai").
 * Dihitung langsung dari DB (bukan data contoh).
 */
export const GET = wrapRoute({
  permission: "question:view",
  handler: async () => {
    const [
      [total],
      [ready],
      [review],
      [flagged],
      [bundleCount],
      [sourceCount],
      byDifficulty,
      byGrade,
      topTopics,
      recent,
    ] = await Promise.all([
      db.select({ n: count() }).from(questions).where(isNull(questions.deletedAt)),
      db
        .select({ n: count() })
        .from(questions)
        .where(and(isNull(questions.deletedAt), eq(questions.status, "ready"))),
      db
        .select({ n: count() })
        .from(questions)
        .where(and(isNull(questions.deletedAt), eq(questions.status, "review"))),
      db.select({ n: count() }).from(questions).where(eq(questions.isFlagged, true)),
      db.select({ n: count() }).from(bundles),
      db.select({ n: count() }).from(sources),
      db
        .select({ key: questions.difficulty, n: count() })
        .from(questions)
        .where(isNull(questions.deletedAt))
        .groupBy(questions.difficulty),
      db
        .select({ key: questions.grade, n: count() })
        .from(questions)
        .where(isNull(questions.deletedAt))
        .groupBy(questions.grade),
      db
        .select({ id: topics.id, name: topics.name, n: count(questionTopics.questionId) })
        .from(topics)
        .leftJoin(questionTopics, eq(questionTopics.topicId, topics.id))
        .groupBy(topics.id, topics.name)
        .orderBy(desc(count(questionTopics.questionId)))
        .limit(5),
      db
        .select({
          id: questions.id,
          content: sql<string>`left(${questions.contentMarkdown}, 120)`,
          status: questions.status,
          createdAt: questions.createdAt,
        })
        .from(questions)
        .where(isNull(questions.deletedAt))
        .orderBy(desc(questions.createdAt))
        .limit(5),
    ]);

    return {
      stats: {
        total: total.n,
        ready: ready.n,
        review: review.n,
        flagged: flagged.n,
        bundles: bundleCount.n,
        sources: sourceCount.n,
      },
      byDifficulty: byDifficulty.map((r) => ({ key: r.key, n: r.n })),
      byGrade: byGrade.map((r) => ({ key: r.key, n: r.n })),
      topTopics: topTopics.map((r) => ({ id: r.id, name: r.name, n: r.n })),
      recent: recent.map((r) => ({
        id: r.id,
        content: r.content,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  },
});
