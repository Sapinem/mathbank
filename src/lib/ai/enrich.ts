/**
 * Enrichment soal (M10-d) — prompt + parse usulan AI.
 *
 * **Prinsip (terkunci):** AI hanya **mengusulkan**. Hasil TIDAK ditulis langsung
 * ke soal; disimpan sebagai usulan dan status soal → `review`. `answer_key`
 * TIDAK PERNAH disentuh.
 *
 * Cakupan yang diusulkan (keputusan D3): **topik · kesulitan · kognitif · tags**.
 */
import type { EnrichmentProposal } from "@/lib/contracts/ai";

/** Topik yang tersedia (dikirim ke prompt agar AI memilih dari daftar). */
export interface EnrichContext {
  /** Daftar topik yang ADA di sistem (nama). */
  topics: string[];
  /** Daftar tag yang ADA (nama) — opsional. */
  tags?: string[];
}

/** Field yang diminta (D3). */
export type EnrichField = "topics" | "difficulty" | "cognitiveLevel" | "tags";

const DIFFICULTY = ["easy", "medium", "hard"] as const;
const COGNITIVE = ["C1", "C2", "C3", "C4", "C5", "C6"] as const;

/** Prompt sistem (Indonesia — tugas klasifikasi, keluaran JSON ketat). */
export function buildSystemPrompt(): string {
  return [
    "Kamu asisten kurasi bank soal matematika untuk sekolah Indonesia.",
    "Tugasmu MENGUSULKAN metadata untuk satu soal. Kamu TIDAK menentukan jawaban.",
    "Keluarkan JSON valid saja, tanpa penjelasan tambahan.",
  ].join(" ");
}

/** Prompt pengguna: soal + daftar pilihan. */
export function buildUserPrompt(params: {
  content: string;
  ctx: EnrichContext;
  fields: EnrichField[];
}): string {
  const { content, ctx, fields } = params;
  const lines: string[] = [];
  lines.push("SOAL (markdown, boleh memuat LaTeX $...$):");
  lines.push("```");
  lines.push(content.slice(0, 6000));
  lines.push("```");
  lines.push("");
  lines.push("Usulkan metadata berikut, keluarkan HANYA objek JSON dengan kunci:");
  const keys: string[] = [];
  if (fields.includes("topics")) {
    keys.push('"topics" (array nama topik, dipilih HANYA dari daftar di bawah)');
  }
  if (fields.includes("difficulty")) keys.push('"difficulty" (satu dari: easy|medium|hard)');
  if (fields.includes("cognitiveLevel")) keys.push('"cognitiveLevel" (satu dari: C1|C2|C3|C4|C5|C6)');
  if (fields.includes("tags")) keys.push('"tags" (array kata kunci singkat, huruf kecil)');
  keys.push('"notes" (alasan singkat, bahasa Indonesia)');
  for (const k of keys) lines.push(`- ${k}`);

  if (fields.includes("topics") && ctx.topics.length) {
    lines.push("");
    lines.push("DAFTAR TOPIK YANG TERSEDIA:");
    for (const t of ctx.topics.slice(0, 300)) lines.push(`- ${t}`);
  }
  if (fields.includes("tags") && ctx.tags?.length) {
    lines.push("");
    lines.push("TAG YANG SUDAH ADA (boleh dipakai ulang, boleh usul baru):");
    lines.push(ctx.tags.slice(0, 200).join(", "));
  }
  return lines.join("\n");
}

/** Normalisasi + validasi usulan mentah dari AI. */
export function normalizeProposal(
  raw: unknown,
  fields: EnrichField[],
  allowedTopics: string[],
): EnrichmentProposal {
  const o = (raw ?? {}) as Record<string, unknown>;
  const topicSet = new Map(allowedTopics.map((t) => [t.toLowerCase(), t]));

  const topics = fields.includes("topics")
    ? toStringArray(o.topics)
        .map((t) => topicSet.get(t.toLowerCase()) ?? t)
        .slice(0, 8)
    : [];

  const difficulty = fields.includes("difficulty") && isOneOf(o.difficulty, DIFFICULTY) ? (o.difficulty as EnrichmentProposal["difficulty"]) : null;

  const cognitiveLevel =
    fields.includes("cognitiveLevel") && isOneOf(o.cognitiveLevel, COGNITIVE)
      ? (o.cognitiveLevel as EnrichmentProposal["cognitiveLevel"])
      : null;

  const tags = fields.includes("tags") ? toStringArray(o.tags).map((s) => s.toLowerCase()).slice(0, 10) : [];

  const notes = typeof o.notes === "string" ? o.notes.slice(0, 500) : undefined;
  return { topics, difficulty, cognitiveLevel, tags, notes };
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

function isOneOf<T extends readonly string[]>(v: unknown, list: T): v is T[number] {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

/** Semua field yang didukung (default bila klien tak menentukan). */
export const ALL_FIELDS: EnrichField[] = ["topics", "difficulty", "cognitiveLevel", "tags"];
