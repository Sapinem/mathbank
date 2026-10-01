/**
 * Provenance soal (ADR-0012) — `question_sources` (many-to-many).
 *
 * Soal boleh punya BANYAK sumber (mis. soal sama dari web + buku). Saat ingest
 * menemukan soal dengan konten sama (`contentHash`), JANGAN buat soal baru —
 * cukup tambahkan baris provenance di sini.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import {
  questionSources,
  type NewQuestionSource,
  type QuestionSource,
} from "@/lib/db/schema/question-source";

/** Cari soal AKTIF berdasarkan hash konten (global, lintas-sumber). */
export async function findQuestionByContentHash(
  hash: string,
): Promise<{ id: string } | null> {
  if (!hash) return null;
  const [row] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.contentHash, hash), isNull(questions.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Ambil daftar provenance sebuah soal (untuk "Riwayat"/asal-usul). */
export async function listQuestionSources(
  questionId: string,
): Promise<QuestionSource[]> {
  return db
    .select()
    .from(questionSources)
    .where(eq(questionSources.questionId, questionId))
    .orderBy(questionSources.createdAt);
}

/**
 * Tambahkan baris provenance ke soal. Idempoten: bila pasangan
 * (`questionId`, `sourceId`) sudah ada, kembalikan baris yang ada.
 * `sourceId = null` → selalu boleh >1 baris (mis. banyak URL).
 */
export async function addQuestionSource(
  input: NewQuestionSource,
): Promise<QuestionSource> {
  if (input.sourceId) {
    const [existing] = await db
      .select()
      .from(questionSources)
      .where(
        and(
          eq(questionSources.questionId, input.questionId),
          eq(questionSources.sourceId, input.sourceId),
        ),
      )
      .limit(1);
    if (existing) return existing;
  }

  try {
    const [row] = await db.insert(questionSources).values(input).returning();
    return row!;
  } catch {
    // Balapan: baris dibuat proses lain → ambil ulang (hanya bila sourceId).
    if (input.sourceId) {
      const [again] = await db
        .select()
        .from(questionSources)
        .where(
          and(
            eq(questionSources.questionId, input.questionId),
            eq(questionSources.sourceId, input.sourceId),
          ),
        )
        .limit(1);
      if (again) return again;
    }
    throw new Error("Gagal menambahkan provenance soal.");
  }
}
