import { and, eq, isNull, sql, desc, asc, inArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  questions,
  questionOptions,
  type Question,
  type QuestionOption,
} from "@/lib/db/schema/question";
import { embedText } from "@/lib/embedding/bge-m3";
import type { Actor } from "@/lib/auth/actor";
import { solutions } from "@/lib/db/schema/solution";
import { questionTopics, topics } from "@/lib/db/schema/taxonomy";
import { questionMedia, mediaAssets } from "@/lib/db/schema/media";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { sources } from "@/lib/db/schema/source";
import {
  questionColumns,
  optionColumns,
  canSeeAnswerKey,
} from "@/lib/db/projections/question";
import type { ListQuestionsQuery, AnswerKey } from "@/lib/contracts/question";

/**
 * Baca soal (M14 — pecahan `question-service.ts`).
 *
 * Fungsi baca murni + proyeksi aman (S3): `answerKey` hanya bila viewer berwenang,
 * `embedding*`/`aiTagged*` selalu dibuang pada jalur publik.
 */

/** Bentuk ringkas solusi/pembahasan untuk respons API. */
export interface QuestionSolutionView {
  id: string;
  solutionType: "conceptual" | "quick_tip" | "video" | "alternative";
  title: string;
  contentMarkdown: string;
  isPrimary: boolean;
  authorType: "teacher" | "student" | "system" | "ai" | "imported";
  createdAt: Date;
}

/**
 * Bentuk soal untuk RESPONS API.
 *
 * `answerKey` hanya ada bila viewer berwenang (lihat `canSeeAnswerKey`);
 * field internal (`embedding*`, `aiTagged*`) **selalu** dibuang (S3).
 */
export type PublicQuestion = Omit<
  Question,
  | "embedding"
  | "embeddingContentHash"
  | "embeddingModelName"
  | "aiTagged"
  | "aiTaggedAt"
  | "answerKey"
  | "contentHash"
> & {
  options: QuestionOption[];
  answerKey?: AnswerKey;
  /** Asal-usul (ADR-0014): naskah/bundle yang memuat butir ini (bisa >1). */
  bundles?: QuestionBundleView[];
  /** Pembahasan terstruktur (bisa >1 cara/metode). */
  solutions?: QuestionSolutionView[];
  /**
   * Wacana stimulus induk (soal `stimulus`), bila butir ini adalah soal anak.
   * Menyertakan `contentMarkdown` agar UI dapat merender konteks utuh (audit §3.9).
   */
  parent?: { id: string; contentMarkdown: string } | null;
  /** ID topik taksonomi yang ditautkan (untuk pemilih topik di editor). */
  topicIds?: string[];
  /** Topik terisi (nama + hierarki) — untuk tag topik di halaman detail. */
  topics?: QuestionTopicView[];
  /** Aset media yang ditautkan lewat `question_media` (Sprint 1 · ACT-08). */
  media?: QuestionMediaView[];
};

/**
 * Topik yang menempel pada satu soal (proyeksi baca).
 * `level` 1=Kategori, 2=Topik, 3=SubTopik — UI memakainya untuk urutan/hierarki.
 */
export interface QuestionTopicView {
  id: string;
  name: string;
  slug: string;
  level: number;
  isPrimary: boolean;
}

/**
 * Media yang menempel pada satu soal lewat `question_media` (Sprint 1 · ACT-08).
 * `shortId` adalah kunci penyajian `/img/{shortId}` — bukan path storage.
 */
export interface QuestionMediaView {
  id: string;
  shortId: string;
  role: string;
  orderIndex: number;
  altText: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
}

/** Bentuk ringkas asal-usul butir — kini lewat BUNDLE (ADR-0014). */
export interface QuestionBundleView {
  /** ID bundle (naskah) — dulu `question_sources.id`. */
  id: string;
  title: string;
  bundleType: string;
  /** URL artikel/naskah spesifik (mis. artikel defantri). */
  url: string | null;
  year: number | null;
  grade: string | null;
  sourceId: string | null;
  /** Label sumber (mis. "mathcyber") — dulu per-butir, kini dari bundle. */
  sourceLabel: string | null;
  sourceKind: string | null;
  /** Nomor butir di dalam naskah (`bundle_items.item_number`). */
  itemNumber: string | null;
  status: string;
}

/** Soal internal (untuk logika service: FSM, izin) — punya `answerKey`. */
export interface QuestionInternal extends Question {
  options: QuestionOption[];
}

/**
 * Ambil satu soal + opsi untuk RESPONS API (proyeksi aman, S3).
 * `answerKey` hanya disertakan bila `viewer` berwenang.
 */
export async function getQuestion(
  id: string,
  opts: { includeDeleted?: boolean; viewer?: Actor } = {},
): Promise<PublicQuestion | null> {
  const withAnswerKey = opts.viewer ? canSeeAnswerKey(opts.viewer) : false;

  const [row] = await db
    .select(questionColumns({ withAnswerKey }))
    .from(questions)
    .where(
      opts.includeDeleted
        ? eq(questions.id, id)
        : and(eq(questions.id, id), isNull(questions.deletedAt)),
    )
    .limit(1);
  if (!row) return null;

  const options = await db
    .select(optionColumns({ withAnswerKey }))
    .from(questionOptions)
    .where(eq(questionOptions.questionId, id))
    .orderBy(asc(questionOptions.orderIndex));

  // ADR-0014: sumber TIDAK lagi per-butir — ia menempel pada BUNDLE.
  // Jadi "asal soal" = daftar naskah yang memuatnya (via bundle_items).
  const originBundles = await db
    .select({
      id: bundles.id,
      title: bundles.title,
      bundleType: bundles.bundleType,
      url: bundles.url,
      year: bundles.year,
      grade: bundles.grade,
      sourceId: bundles.sourceId,
      sourceLabel: sources.label,
      sourceKind: sources.kind,
      itemNumber: bundleItems.itemNumber,
      status: bundles.status,
    })
    .from(bundleItems)
    .innerJoin(bundles, eq(bundleItems.bundleId, bundles.id))
    .leftJoin(sources, eq(bundles.sourceId, sources.id))
    .where(and(eq(bundleItems.questionId, id), isNull(bundles.deletedAt)))
    .orderBy(asc(bundles.createdAt));

  const parent = row.parentId ? await getParentStimulus(row.parentId) : null;

  // Taksonomi: id topik terpilih (untuk pemilih topik di editor) + detail
  // topik (nama/slug/level) untuk tag topik di halaman detail (ACT-09).
  const topicRows = await db
    .select({
      id: topics.id,
      name: topics.name,
      slug: topics.slug,
      level: topics.level,
      isPrimary: questionTopics.isPrimary,
    })
    .from(questionTopics)
    .innerJoin(topics, eq(questionTopics.topicId, topics.id))
    .where(eq(questionTopics.questionId, id))
    .orderBy(asc(topics.level), asc(topics.name));
  const topicIds = topicRows.map((t) => t.id);
  const topicViews: QuestionTopicView[] = topicRows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    level: Number(t.level),
    isPrimary: t.isPrimary,
  }));

  // Media tertaut (ACT-08). Urut peran lalu order_index agar galeri stabil.
  const mediaRows = await db
    .select({
      id: mediaAssets.id,
      shortId: mediaAssets.shortId,
      role: questionMedia.role,
      orderIndex: questionMedia.orderIndex,
      altText: mediaAssets.altText,
      caption: mediaAssets.caption,
      width: mediaAssets.width,
      height: mediaAssets.height,
      mimeType: mediaAssets.mimeType,
    })
    .from(questionMedia)
    .innerJoin(mediaAssets, eq(questionMedia.mediaId, mediaAssets.id))
    .where(eq(questionMedia.questionId, id))
    .orderBy(asc(questionMedia.orderIndex), asc(mediaAssets.shortId));
  const mediaViews: QuestionMediaView[] = mediaRows.map((m) => ({
    id: m.id,
    shortId: m.shortId,
    role: m.role,
    orderIndex: Number(m.orderIndex),
    altText: m.altText,
    caption: m.caption,
    width: m.width,
    height: m.height,
    mimeType: m.mimeType,
  }));

  // Ambil daftar solusi bila viewer berwenang melihat kunci/pembahasan
  let solutionList: QuestionSolutionView[] = [];
  if (withAnswerKey) {
    const rawSolutions = await db
      .select({
        id: solutions.id,
        solutionType: solutions.solutionType,
        title: solutions.title,
        contentMarkdown: solutions.contentMarkdown,
        isPrimary: solutions.isPrimary,
        authorType: solutions.authorType,
        createdAt: solutions.createdAt,
      })
      .from(solutions)
      .where(eq(solutions.questionId, id))
      .orderBy(desc(solutions.isPrimary), asc(solutions.createdAt));

    solutionList = rawSolutions as QuestionSolutionView[];
    const answerKey = "answerKey" in row ? (row.answerKey as AnswerKey | undefined) : undefined;

    // Fallback: Jika tabel solutions kosong tapi answerKey.explanation ada, buat solusi virtual
    if (solutionList.length === 0 && answerKey?.explanation) {
      solutionList = [
        {
          id: `virtual-${row.id}`,
          solutionType: "conceptual",
          title: "Pembahasan Utuh",
          contentMarkdown: answerKey.explanation,
          isPrimary: true,
          authorType: "teacher",
          createdAt: row.createdAt,
        },
      ];
    }
  }

  return {
    ...row,
    options,
    bundles: originBundles,
    solutions: solutionList,
    parent,
    topicIds,
    topics: topicViews,
    media: mediaViews,
  } as PublicQuestion;
}

/** Ambil wacana stimulus induk (id + contentMarkdown) bila ada. */
async function getParentStimulus(
  parentId: string,
): Promise<{ id: string; contentMarkdown: string } | null> {
  const [p] = await db
    .select({ id: questions.id, contentMarkdown: questions.contentMarkdown })
    .from(questions)
    .where(and(eq(questions.id, parentId), isNull(questions.deletedAt)))
    .limit(1);
  return p ?? null;
}

/**
 * Baca soal LENGKAP (internal) — untuk logika service yang butuh `answerKey`
 * (mis. `assertReady`) & field internal. **JANGAN** kirim hasil ini ke klien.
 */
export async function getQuestionInternal(
  id: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<QuestionInternal | null> {
  const [row] = await db
    .select()
    .from(questions)
    .where(
      opts.includeDeleted
        ? eq(questions.id, id)
        : and(eq(questions.id, id), isNull(questions.deletedAt)),
    )
    .limit(1);
  if (!row) return null;

  const options = await db
    .select()
    .from(questionOptions)
    .where(eq(questionOptions.questionId, id))
    .orderBy(asc(questionOptions.orderIndex));

  return { ...row, options };
}

/** Daftar soal dengan filter & paginasi (proyeksi aman, S3). */
export async function listQuestions(
  query: ListQuestionsQuery,
  viewer?: Actor,
): Promise<{ items: PublicQuestion[]; total: number }> {
  // Impor dinamis menghindari lingkaran modul: buildQuestionFilter memakai
  // tipe/utilitas yang sama tanpa saling mengimpor modul ini.
  const { buildQuestionFilter } = await import("@/lib/question/filters");
  const { where: finalWhere, byRelevance } = await buildQuestionFilter(query);

  // Mode semantik: urutkan berdasar jarak embedding (HNSW) bila query dapat
  // di-embed. Bila service embedding mati / tak ada hasil, JATUH ke trigram.
  let orderBy: SQL[] | undefined;
  let semanticWhere: SQL | undefined;
  if (query.mode === "semantic" && query.q) {
    const emb = await embedText(query.q.trim());
    if (emb.ok && emb.vector) {
      const literal = `[${emb.vector.join(",")}]`;
      // Hanya soal yang sudah punya embedding.
      semanticWhere = sql`${questions.embedding} IS NOT NULL`;
      orderBy = [asc(sql`${questions.embedding} <=> ${literal}::vector`)];
    }
  }

  const combined = semanticWhere
    ? finalWhere
      ? and(finalWhere, semanticWhere)
      : semanticWhere
    : finalWhere;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questions)
    .where(combined);

  // Urutkan: semantik (bila aktif) > relevansi trigram > terbaru dulu.
  const finalOrder: SQL[] =
    orderBy ??
    (byRelevance && query.q
      ? [
          desc(sql`similarity(${questions.contentMarkdown}, ${query.q.trim()})`),
          desc(questions.createdAt),
        ]
      : [desc(questions.createdAt)]);

  const rows = await db
    .select(questionColumns({ withAnswerKey: viewer ? canSeeAnswerKey(viewer) : false }))
    .from(questions)
    .where(combined)
    .orderBy(...finalOrder)
    .limit(query.limit)
    .offset(query.offset);

  const items = await attachOptions(rows, viewer ? canSeeAnswerKey(viewer) : false);
  return { items, total: count };
}

/** Lampirkan opsi ke banyak soal (hindari N+1). Proyeksi aman (S3). */
async function attachOptions(
  rows: Omit<PublicQuestion, "options">[],
  withAnswerKey: boolean,
): Promise<PublicQuestion[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const opts = await db
    .select(optionColumns({ withAnswerKey }))
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, ids))
    .orderBy(asc(questionOptions.orderIndex));
  const byQuestion = new Map<string, QuestionOption[]>();
  for (const o of opts) {
    const arr = byQuestion.get(o.questionId) ?? [];
    arr.push(o as QuestionOption);
    byQuestion.set(o.questionId, arr);
  }

  // Lampirkan wacana stimulus induk (hindari N+1): 1 query untuk semua parentId.
  const parentIds = [
    ...new Set(rows.map((r) => r.parentId).filter((v): v is string => !!v)),
  ];
  const parentMap = new Map<string, { id: string; contentMarkdown: string }>();
  if (parentIds.length > 0) {
    const parents = await db
      .select({ id: questions.id, contentMarkdown: questions.contentMarkdown })
      .from(questions)
      .where(inArray(questions.id, parentIds));
    for (const p of parents) parentMap.set(p.id, p);
  }

  return rows.map((r) => ({
    ...r,
    options: byQuestion.get(r.id) ?? [],
    parent: r.parentId ? (parentMap.get(r.parentId) ?? null) : null,
  }));
}
