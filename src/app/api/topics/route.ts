import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { createTopic, listTopics } from "@/lib/services/topic-service";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** GET /api/topics — daftar topik (untuk filter & editor). */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async () => listTopics(),
});

/** POST /api/topics — buat topik (butuh `taxonomy:manage`). */
export const POST = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "taxonomy:manage",
  body: createSchema,
  handler: async ({ body, actor }) => createTopic(body, actor),
});
