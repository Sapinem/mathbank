/**
 * Commit hasil segmentasi → soal draft (M9-3).
 *
 * Aturan (keputusan user 2026-09-30):
 *   - **SEMUA hasil = `draft`** (walau kunci jelas).
 *   - **Jangan menebak kunci** — kunci kosong + flag lebih baik.
 *   - `sourceId` di-resolve dari `sourceOrigin` (dibuat bila belum ada, kind=website).
 *   - Idempoten: soal dengan `itemHash` sama tak dibuat ulang (via `existingHashes`).
 *
 * Menggunakan `createQuestion` (L5) agar seluruh invarian & audit tetap berlaku.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema/source";
import { questions } from "@/lib/db/schema/question";
import { createQuestion } from "@/lib/services/question-service";
import { slugify } from "@/lib/taxonomy/tree";
import { ConflictError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { itemHash } from "./hash";
import type { ParsedItem } from "./parsers/types";

/** Hasil commit satu artikel. */
export interface CommitResult {
  created: number;
  skipped: number;
  failed: number;
  questionIds: string[];
  errors: string[];
}

/** Opsi commit. */
export interface CommitOptions {
  /** Sumber (nama, mis. "mathcyber") → di-resolve/buat ke tabel `sources`. */
  sourceOrigin: string;
  sourceUrl?: string | null;
  /** Grade wajib; default "umum" bila kosong. */
  grade?: string | null;
  topicId?: string | null;
  /** Hash soal yang sudah ada (idempotensi lintas-batch). */
  existingHashes?: Set<string>;
}

/** Kelas default & peta tipe → difficulty/cognitive (dapat ditelaah nanti). */
const DEFAULT_DIFFICULTY = 3;
const DEFAULT_COGNITIVE = "understand" as const;

/**
 * Resolve `sourceId` untuk `sourceOrigin` (kind=website). Buat bila belum ada.
 * Tak memakai `createSource` karena butuh izin `reference:manage` (mesin tak punya)
 * — di sini cukup idempoten & aman untuk pipeline.
 */
export async function resolveSourceId(sourceOrigin: string, sourceUrl?: string | null): Promise<string> {
  const slug = slugify(sourceOrigin, 255);
  const [existing] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, slug)).limit(1);
  if (existing) return existing.id;

  try {
    const [row] = await db
      .insert(sources)
      .values({ kind: "website", label: sourceOrigin, slug, url: sourceUrl ?? null })
      .returning({ id: sources.id });
    return row!.id;
  } catch {
    // Balapan: baris dibuat proses lain → ambil ulang.
    const [again] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, slug)).limit(1);
    if (again) return again.id;
    throw new ConflictError("Gagal membuat/mengambil sumber ingest.");
  }
}

/** Ambil himpunan hash soal yang sudah ada untuk satu sumber (untuk dedup). */
export async function existingItemHashes(sourceId: string): Promise<Set<string>> {
  const rows = await db
    .select({ c: questions.contentMarkdown })
    .from(questions)
    .where(eq(questions.sourceId, sourceId));
  const set = new Set<string>();
  for (const r of rows) set.add(itemHash(sourceId, r.c));
  return set;
}

/**
 * Commit daftar `ParsedItem` (dari satu artikel) → soal draft.
 * Mengembalikan hitungan + id soal yang dibuat.
 */
export async function commitItems(
  items: ParsedItem[],
  actor: Actor,
  opts: CommitOptions,
): Promise<CommitResult> {
  const sourceId = await resolveSourceId(opts.sourceOrigin, opts.sourceUrl);
  const hashes = opts.existingHashes ?? (await existingItemHashes(sourceId));
  const grade = (opts.grade && opts.grade.trim()) || "umum";

  const result: CommitResult = { created: 0, skipped: 0, failed: 0, questionIds: [], errors: [] };

  for (const it of items) {
    const h = itemHash(sourceId, it.stem);

    // Idempotensi: soal sama sudah ada → lewati.
    if (hashes.has(h)) {
      result.skipped++;
      continue;
    }

    // Aturan mutu: stem kosong → lewati (jangan simpan sampah).
    if (!it.stem || it.stem.trim().length === 0) {
      result.skipped++;
      continue;
    }

    try {
      const q = await createQuestion(
        {
          questionType: it.type,
          difficulty: DEFAULT_DIFFICULTY,
          cognitiveLevel: DEFAULT_COGNITIVE,
          grade,
          contentMarkdown: it.stem,
          dataPayload: it.dataPayload ?? {},
          answerKey: {
            ...(it.correct.length ? { correct: it.correct } : {}),
            ...(it.explanation ? { explanation: it.explanation } : {}),
          },
          status: "draft", // keputusan: SEMUA draft
          childOrder: 0,
          sourceId,
          options: it.options.map((o, i) => ({
            label: o.label,
            contentMarkdown: o.text,
            isCorrect: o.isCorrect,
            orderIndex: i,
          })),
          topicIds: opts.topicId ? [opts.topicId] : [],
          tagIds: [],
        },
        actor,
      );
      result.created++;
      result.questionIds.push(q.id);
      hashes.add(h);
    } catch (e) {
      result.failed++;
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return result;
}
