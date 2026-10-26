import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { createEvent } from "@/lib/services/taxonomy-service";
import { listEvents } from "@/lib/services/taxonomy-service";

const eventSchema = z.object({
  name: z.string().trim().min(1).max(150),
  shortname: z.string().trim().min(1).max(50),
  category: z.string().trim().min(1).max(50),
  subtests: z.array(z.string().max(100)).max(50).optional(),
  aliases: z.array(z.string().max(100)).max(50).optional(),
});

const emptyQuerySchema = z.object({}).optional();

/** GET /api/events — daftar event (dengan subtes & aliases). */
export const GET = wrapRoute({
  rateLimit: true,
  authz: { kind: "route", permission: "question:view" },
  query: emptyQuerySchema,
  handler: async () => listEvents(),
});

/** POST /api/events — buat event. */
export const POST = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  authz: { kind: "route", permission: "reference:manage" },
  body: eventSchema,
  handler: async ({ body, actor }) => createEvent(body, actor),
});
