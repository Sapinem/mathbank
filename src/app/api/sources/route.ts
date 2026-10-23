import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { createSource } from "@/lib/services/taxonomy-service";
import { listSources } from "@/lib/services/taxonomy-service";

const sourceKind = z.enum(["book", "website", "school"]);

const createSchema = z.object({
  kind: sourceKind,
  label: z.string().trim().min(1).max(255),
  // Kolom khusus-jenis (ADR-0015) — biarkan nullish; service menyimpan null
  // untuk jenis yang tak relevan.
  url: z.string().url().max(2000).nullish(),
  publisher: z.string().trim().max(255).nullish(),
  author: z.string().trim().max(255).nullish(),
  bookYear: z.number().int().min(1900).max(2100).nullish(),
  city: z.string().trim().max(100).nullish(),
});

const emptyQuerySchema = z.object({}).optional();

/** GET /api/sources — daftar sumber (dengan usageCount). */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  query: emptyQuerySchema,
  handler: async () => listSources(),
});

/** POST /api/sources — buat sumber (butuh taxonomy:manage). */
export const POST = wrapRoute({
  rateLimit: true,
  permission: "reference:manage",
  body: createSchema,
  handler: async ({ body, actor }) => createSource(body, actor),
});
