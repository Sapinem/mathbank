import { asc } from "drizzle-orm";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/event";

/** GET /api/events — daftar event. */
export const GET = wrapRoute({
  permission: "question:view",
  handler: async () => {
    return db
      .select({
        id: events.id,
        name: events.name,
        shortname: events.shortname,
        category: events.category,
      })
      .from(events)
      .orderBy(asc(events.name));
  },
});
