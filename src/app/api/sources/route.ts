import { asc } from "drizzle-orm";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema/source";

/** GET /api/sources — daftar sumber. */
export const GET = wrapRoute({
  permission: "question:view",
  handler: async () => {
    return db
      .select({
        id: sources.id,
        kind: sources.kind,
        label: sources.label,
        slug: sources.slug,
      })
      .from(sources)
      .orderBy(asc(sources.label));
  },
});
