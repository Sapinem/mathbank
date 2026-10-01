import { z } from "zod";

/** Skema boundary untuk media (dipakai route & MCP). */
export const mediaOriginSchema = z.enum([
  "manual_upload",
  "pdf_crop",
  "ai_generated_tikz",
  "ai_generated_svg",
  "web_scrape",
  "web_ingest",
  "tex_import",
]);

/** Daftar aset (query string). */
export const listMediaQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  origin: mediaOriginSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;

/** Ubah metadata aset. */
export const updateMediaSchema = z.object({
  title: z.string().trim().min(1).max(255),
  altText: z.string().trim().max(500).nullish(),
  caption: z.string().trim().max(1000).nullish(),
  description: z.string().trim().max(2000).nullish(),
});

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

/** Tautkan aset ke soal. */
export const attachMediaSchema = z.object({
  questionId: z.string().uuid(),
  shortIds: z.array(z.string().regex(/^[0-9A-Za-z]{8}$/)).min(1).max(20),
});

export type AttachMediaInput = z.infer<typeof attachMediaSchema>;
