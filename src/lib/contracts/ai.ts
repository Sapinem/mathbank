import { z } from "zod";

/** Kunci pengaturan AI (M10) — disimpan di `app_settings`. */
export const AI_KEYS = [
  "ai.enabled",
  "ai.base_url",
  "ai.api_key",
  "ai.model",
  "ai.max_tokens",
  "ai.timeout_ms",
] as const;
export type AiKey = (typeof AI_KEYS)[number];

/** Kunci yang nilainya rahasia (terenkripsi at-rest). */
export const AI_SECRET_KEYS: readonly string[] = ["ai.api_key"];

/** Pengaturan AI dari SI-KLIEN (nilai key boleh "***" = tak berubah). */
export const aiSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().trim().max(500).optional(),
  apiKey: z.string().max(500).optional(),
  model: z.string().trim().max(200).optional(),
  maxTokens: z.number().int().min(1).max(32000).optional(),
  timeoutMs: z.number().int().min(1000).max(300000).optional(),
});
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;

/** Field enrichment yang didukung (metadata D3 + pedagogi MAT-41). */
export const enrichFieldSchema = z.enum([
  "topics",
  "difficulty",
  "cognitiveLevel",
  "tags",
  "distractorRationale",
  "rubric",
]);

/** Enrich 1 soal. */
export const aiEnrichSchema = z.object({
  questionId: z.string().min(1),
  /** Kunci yang boleh diusulkan (default: semua yang didukung). */
  fields: z.array(enrichFieldSchema).optional(),
});
export type AiEnrichInput = z.infer<typeof aiEnrichSchema>;

/** Enrich: satu soal ATAU batch (union). */
export const aiEnrichBodySchema = z.union([
  z.object({
    questionId: z.string().min(1),
    fields: z.array(enrichFieldSchema).optional(),
  }),
  z.object({
    questionIds: z.array(z.string().min(1)).min(1).max(200),
    fields: z.array(enrichFieldSchema).optional(),
  }),
]);
export type AiEnrichBody = z.infer<typeof aiEnrichBodySchema>;

/** Batch enrichment. */
export const aiEnrichBatchSchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1).max(200),
  fields: z.array(enrichFieldSchema).optional(),
});
export type AiEnrichBatchInput = z.infer<typeof aiEnrichBatchSchema>;

/** Embed 1 soal (atau beberapa). */
export const aiEmbedSchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1).max(100),
});
export type AiEmbedInput = z.infer<typeof aiEmbedSchema>;

/** Usulan enrichment (belum diterapkan ke soal). */
export interface EnrichmentProposal {
  topics: string[];
  /** 1–5 (smallint), sesuai `difficulty_levels.value`. */
  difficulty: 1 | 2 | 3 | 4 | 5 | null;
  /** Enum Bloom (sesuai `cognitive_level`). */
  cognitiveLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create" | null;
  tags: string[];
  notes?: string;
}
