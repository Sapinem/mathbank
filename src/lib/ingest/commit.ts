/**
 * Commit hasil segmentasi → soal draft (M9-3).
 *
 * Aturan (keputusan user 2026-09-30):
 *   - **SEMUA hasil = `draft`** (walau kunci jelas).
 *   - **Jangan menebak kunci** — kunci kosong + flag lebih baik.
 *   - `sourceId` di-resolve dari `sourceOrigin` (dibuat bila belum ada, kind=website).
 *   - Idempoten (ADR-0012): soal dengan **konten sama** (`contentHash` stem+opsi,
 *     LINTAS-SUMBER) TIDAK dibuat ulang — cukup tambahkan provenance `question_sources`.
 *
 * Menggunakan `createQuestion` (L5) agar seluruh invarian & audit tetap berlaku.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema/source";
import { questions } from "@/lib/db/schema/question";
import { createQuestion } from "@/lib/services/question-service";
import {
  addQuestionSource,
  findQuestionByContentHash,
} from "@/lib/services/question-source-service";
import { slugify } from "@/lib/taxonomy/tree";
import { ConflictError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { contentHash, itemHash } from "./hash";
import type { ParsedItem } from "./parsers/types";

/** Hasil commit satu artikel. */
export interface CommitResult {
  created: number;
  /** Soal identik (konten sama, exact) → provenance ditambahkan, soal TIDAK dibuat ulang. */
  linked: number;
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
  /** Judul artikel (provenance butir, ADR-0012) — dari antrean ingest. */
  articleTitle?: string | null;
  /** Waktu akses/pengambilan artikel (provenance butir). */
  accessedAt?: Date | null;
  /** Grade wajib; default "umum" bila kosong. */
  grade?: string | null;
  topicId?: string | null;
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

/**
 * Himpunan hash soal lama (`itemHash`, source+stem) — DIPERTAHANKAN untuk
 * kompatibilitas tes lama. ⚠️ Bukan lagi dasar dedup (lihat `contentHash`).
 */
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
 *
 * Dedup berbasis `contentHash(stem, opsi)` **tanpa sumber** (ADR-0012):
 *   - soal ada (konten sama) → **tambahkan provenance**, jangan buat soal baru;
 *   - soal baru → buat soal + provenance.
 */
export async function commitItems(
  items: ParsedItem[],
  actor: Actor,
  opts: CommitOptions,
): Promise<CommitResult> {
  const sourceId = await resolveSourceId(opts.sourceOrigin, opts.sourceUrl);
  const grade = (opts.grade && opts.grade.trim()) || "umum";

  const result: CommitResult = {
    created: 0,
    linked: 0,
    skipped: 0,
    failed: 0,
    questionIds: [],
    errors: [],
  };

  for (const it of items) {
    // Aturan mutu: stem kosong → lewati (jangan simpan sampah).
    if (!it.stem || it.stem.trim().length === 0) {
      result.skipped++;
      continue;
    }

    const hash = contentHash(it.stem, it.options.map((o) => o.text));

    try {
      // 1) Sudah ada soal dengan konten sama? → cukup tambahkan provenance.
      const existing = await findQuestionByContentHash(hash);
      if (existing) {
        await addQuestionSource({
          questionId: existing.id,
          sourceId,
          sourceType: "website",
          title: opts.articleTitle ?? null,
          url: opts.sourceUrl ?? null,
          accessedAt: opts.accessedAt ?? null,
          grade,
        });
        result.linked++;
        result.questionIds.push(existing.id);
        continue;
      }

      // 2) Belum ada → buat soal baru.
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
      // Provenance butir (judul artikel, URL, waktu akses).
      await addQuestionSource({
        questionId: q.id,
        sourceId,
        sourceType: "website",
        title: opts.articleTitle ?? null,
        url: opts.sourceUrl ?? null,
        accessedAt: opts.accessedAt ?? null,
        grade,
      });
      result.created++;
      result.questionIds.push(q.id);
    } catch (e) {
      result.failed++;
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return result;
}
