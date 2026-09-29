import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { createEvent, listEvents } from "@/lib/services/taxonomy-service";

const eventSchema = z.object({
  name: z.string().trim().min(1).max(150),
  shortname: z.string().trim().min(1).max(50),
  category: z.string().trim().min(1).max(50),
  subtests: z.array(z.string().max(100)).max(50).optional(),
  aliases: z.array(z.string().max(100)).max(50).optional(),
});

/** GET /api/events — daftar event (dengan subtes & aliases). */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async () => listEvents(),
});

/** POST /api/events — buat event. */
export const POST = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "taxonomy:manage",
  body: eventSchema,
  handler: async ({ body, actor }) => createEvent(body, actor),
});
