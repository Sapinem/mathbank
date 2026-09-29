import { asc } from "drizzle-orm";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { db } from "@/lib/db";
import { topics } from "@/lib/db/schema/taxonomy";

/** GET /api/topics — daftar topik (untuk filter & editor). */
export const GET = wrapRoute({
  permission: "question:view",
  handler: async () => {
    return db
      .select({
        id: topics.id,
        name: topics.name,
        slug: topics.slug,
        parentId: topics.parentId,
        level: topics.level,
      })
      .from(topics)
      .orderBy(asc(topics.level), asc(topics.sortOrder), asc(topics.name));
  },
});
