import { z } from "zod";
import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import { topics, questionTopics } from "@/lib/db/schema/taxonomy";
import { sources } from "@/lib/db/schema/source";
import { bundles } from "@/lib/db/schema/bundle";
import { wrapRoute } from "@/lib/api/route-wrapper";

const emptyQuerySchema = z.object({}).optional();

/**
 * GET /api/stats — ringkasan dasbor (RENCANA-UI §3.1 "dasbor ramai").
 * Dihitung langsung dari DB (bukan data contoh).
 */
export const GET = wrapRoute({
  rateLimit: true,
  authz: { kind: "route", permission: "question:view" },
  query: emptyQuerySchema,
  handler: async () => {
    const [
      [questionStats],
      [bundleCount],
      [sourceCount],
      byDifficulty,
      byGrade,
      topTopics,
      recent,
    ] = await Promise.all([
      db
        .select({
          total: count(),
          ready: sql<number>`count(*) FILTER (WHERE ${questions.status} = 'ready')::int`,
          review: sql<number>`count(*) FILTER (WHERE ${questions.status} = 'review')::int`,
          flagged: sql<number>`count(*) FILTER (WHERE ${questions.isFlagged} = true)::int`,
        })
        .from(questions)
        .where(isNull(questions.deletedAt)),
      db.select({ n: count() }).from(bundles).where(isNull(bundles.deletedAt)),
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
        total: questionStats.total,
        ready: questionStats.ready,
        review: questionStats.review,
        flagged: questionStats.flagged,
        bundles: bundleCount.n,
        sources: sourceCount.n,
      },
      byDifficulty,
      byGrade,
      topTopics,
      recent,
    };
  },
});
