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
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema/source";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { questions } from "@/lib/db/schema/question";
import { createQuestion } from "@/lib/services/question-service";
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
  // ADR-0014: `questions.source_id` dibuang — asal soal dilacak lewat bundle.
  const rows = await db
    .select({ c: questions.contentMarkdown })
    .from(questions)
    .innerJoin(bundleItems, eq(bundleItems.questionId, questions.id))
    .innerJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .where(eq(bundles.sourceId, sourceId));
  const set = new Set<string>();
  for (const r of rows) set.add(itemHash(sourceId, r.c));
  return set;
}

/**
 * Cari soal dengan `content_hash` sama (dedup lintas-sumber, ADR-0012).
 *
 * Dulu tinggal di `question-source-service`; berkas itu dihapus oleh ADR-0014,
 * jadi fungsi ini pindah ke sini — dedup tetap berlaku, kini diwujudkan lewat
 * keanggotaan bundle alih-alih baris provenance.
 */
export async function findQuestionByContentHash(
  hash: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.contentHash, hash), isNull(questions.deletedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Cari/buat bundle untuk satu naskah (ADR-0014 #7).
 *
 * Kunci idempotensi: (sourceId, url) — satu artikel = satu bundle. Bila URL
 * kosong, jatuh ke (sourceId, title) supaya naskah tanpa URL tetap satu bundle.
 */
export async function resolveBundleId(input: {
  sourceId: string;
  title: string;
  url: string | null;
  grade: string;
}): Promise<string> {
  const where = input.url
    ? and(eq(bundles.sourceId, input.sourceId), eq(bundles.url, input.url))
    : and(eq(bundles.sourceId, input.sourceId), eq(bundles.title, input.title));

  const [existing] = await db
    .select({ id: bundles.id })
    .from(bundles)
    .where(and(where, isNull(bundles.deletedAt)))
    .limit(1);
  if (existing) return existing.id;

  const [row] = await db
    .insert(bundles)
    .values({
      title: input.title.slice(0, 255),
      // Slug wajib unik antar-bundle aktif (uq_bundles_slug_active). Judul
      // artikel bisa sama antar-naskah, jadi tambahkan penanda unik dari
      // URL-nya (atau judulnya bila tanpa URL) — bukan dari sourceId, karena
      // satu sumber bisa punya banyak artikel berjudul sama.
      slug: slugify(`${input.title}-${itemHash(input.url ?? input.title, "")}`, 255),
      bundleType: "source", // naskah dari sumber — bukan exam/exercise
      sourceId: input.sourceId,
      url: input.url,
      grade: input.grade,
      status: "draft",
    })
    .returning({ id: bundles.id });
  return row!.id;
}

/**
 * Masukkan soal ke bundle (ADR-0014: pengganti provenance per-butir).
 *
 * Idempoten — `bundle_items` punya UNIQUE (bundle_id, question_id), jadi
 * ingest ulang artikel yang sama tak menggandakan keanggotaan.
 */
export async function linkQuestionToBundle(
  bundleId: string,
  questionId: string,
  itemNumber?: string | null,
): Promise<void> {
  const [last] = await db
    .select({ max: sql<number>`COALESCE(MAX(${bundleItems.orderIndex}), 0)` })
    .from(bundleItems)
    .where(eq(bundleItems.bundleId, bundleId));

  await db
    .insert(bundleItems)
    .values({
      bundleId,
      questionId,
      orderIndex: Number(last?.max ?? 0) + 1,
      itemNumber: itemNumber ?? null,
    })
    .onConflictDoNothing();
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

  // ADR-0014 #7: ingest WAJIB membuat bundle — tak ada soal "nyasar" tanpa naskah.
  // Bundle = naskah/artikel utuh dari satu sumber; URL artikel hidup di sini
  // (`sources.url` = situsnya, `bundles.url` = artikelnya).
  const bundleId = await resolveBundleId({
    sourceId,
    title: opts.articleTitle ?? opts.sourceOrigin,
    url: opts.sourceUrl ?? null,
    grade,
  });

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
      // 1) Sudah ada soal dengan konten sama? → cukup masukkan ke bundle.
      //    (Dedup lintas-sumber tetap berlaku: soal yang sama muncul di
      //     beberapa naskah → satu soal, banyak keanggotaan bundle.)
      const existing = await findQuestionByContentHash(hash);
      if (existing) {
        await linkQuestionToBundle(bundleId, existing.id, String(it.ref.index));
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
      await linkQuestionToBundle(bundleId, q.id, String(it.ref.index));
      result.created++;
      result.questionIds.push(q.id);
    } catch (e) {
      result.failed++;
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return result;
}
