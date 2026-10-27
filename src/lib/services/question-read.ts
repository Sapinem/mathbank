import { and, eq, isNull, sql, desc, asc, inArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions, questionEmbeddings, type Question } from "@/lib/db/schema/question";
import { embedText } from "@/lib/embedding/bge-m3";
import type { Actor } from "@/lib/auth/actor";
import { solutions } from "@/lib/db/schema/solution";
import { questionTopics, topics } from "@/lib/db/schema/taxonomy";
import { questionMedia, mediaAssets } from "@/lib/db/schema/media";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { sources } from "@/lib/db/schema/source";
import {
  questionColumns,
  projectOptions,
  projectAnswerKey,
  projectDataPayload,
  canSeeAnswerKey,
  type QuestionOptionView,
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
  | "aiTagged"
  | "aiTaggedAt"
  | "answerKey"
  | "contentHash"
> & {
  options: QuestionOptionView[];
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
  options: QuestionOptionView[];
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

  // MAT-146 — opsi dari `data_payload.options` (zero join, tanpa query kedua).
  const options = projectOptions(
    { id: row.id, dataPayload: row.dataPayload, answerKey: "answerKey" in row ? row.answerKey : undefined },
    { withAnswerKey, createdAt: row.createdAt, updatedAt: row.updatedAt },
  );

  // ADR-0014: sumber TIDAK lagi per-butir — ia menempel pada BUNDLE.
  // Jadi "asal soal" = daftar naskah yang memuatnya (via bundle_items).
  //
  // Kueri sekunder dijalankan paralel (Promise.all) agar detail soal tidak
  // melakukan 5 roundtrip sekuensial ke DB.
  const [originBundles, parent, topicRows, mediaRows, rawSolutions] = await Promise.all([
    db
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
      .orderBy(asc(bundles.createdAt)),

    row.parentId ? getParentStimulus(row.parentId) : Promise.resolve(null),

    db
      .select({
        id: topics.id,
        name: topics.name,
        level: topics.level,
        isPrimary: questionTopics.isPrimary,
      })
      .from(questionTopics)
      .innerJoin(topics, eq(questionTopics.topicId, topics.id))
      .where(eq(questionTopics.questionId, id))
      .orderBy(asc(topics.level), asc(topics.name)),

    db
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
      .orderBy(asc(questionMedia.orderIndex), asc(mediaAssets.shortId)),

    withAnswerKey
      ? db
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
          .orderBy(desc(solutions.isPrimary), asc(solutions.createdAt))
      : Promise.resolve([]),
  ]);

  // Taksonomi: id topik terpilih (untuk pemilih topik di editor) + detail
  // topik (nama/slug/level) untuk tag topik di halaman detail (ACT-09).
  const topicIds = topicRows.map((t) => t.id);
  const topicViews: QuestionTopicView[] = topicRows.map((t) => ({
    id: t.id,
    name: t.name,
    level: Number(t.level),
    isPrimary: t.isPrimary,
  }));

  // Media tertaut (ACT-08). Urut peran lalu order_index agar galeri stabil.
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

  // MAT-146 — `answer_key` diproyeksikan sekali: bentuk kanonik + alias legacy
  // (`explanation`), sehingga fallback solusi virtual & properti kembalian selaras.
  const projectedAnswerKey = withAnswerKey
    ? (projectAnswerKey("answerKey" in row ? row.answerKey : undefined) as AnswerKey)
    : undefined;

  // Ambil daftar solusi bila viewer berwenang melihat kunci/pembahasan
  let solutionList: QuestionSolutionView[] = [];
  if (withAnswerKey) {
    solutionList = rawSolutions as QuestionSolutionView[];

    // Fallback: Jika tabel solutions kosong tapi answerKey.explanation ada, buat solusi virtual
    if (solutionList.length === 0 && projectedAnswerKey?.explanation) {
      solutionList = [
        {
          id: `virtual-${row.id}`,
          solutionType: "conceptual",
          title: "Pembahasan Utuh",
          contentMarkdown: projectedAnswerKey.explanation,
          isPrimary: true,
          authorType: "teacher",
          createdAt: row.createdAt,
        },
      ];
    }
  }

  return {
    ...row,
    dataPayload: projectDataPayload(row.dataPayload, { withAnswerKey }),
    // Kunci jawaban: bentuk kanonik + alias legacy (S3 — hanya bila berwenang).
    ...(projectedAnswerKey ? { answerKey: projectedAnswerKey } : {}),
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

  // MAT-146 — opsi dari JSONB; kunci internal dibutuhkan (FSM/izin/enrichment).
  const options = projectOptions(
    { id: row.id, dataPayload: row.dataPayload, answerKey: row.answerKey },
    { withAnswerKey: true, createdAt: row.createdAt, updatedAt: row.updatedAt },
  );

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
    const emb = await embedText(query.q.trim(), { timeoutMs: 3000 });
    if (emb.ok && emb.vector) {
      const literal = `[${emb.vector.join(",")}]`;
      // ADR-0019: vektor pindah ke tabel `question_embeddings` (Pilar 1 v2.0).
      // Hanya soal yang sudah punya embedding.
      semanticWhere = sql`${questionEmbeddings.embedding} IS NOT NULL`;
      orderBy = [asc(sql`${questionEmbeddings.embedding} <=> ${literal}::vector`)];
    }
  }

  const combined = semanticWhere
    ? finalWhere
      ? and(finalWhere, semanticWhere)
      : semanticWhere
    : finalWhere;

  // ADR-0019: mode semantik memerlukan LEFT JOIN ke `question_embeddings`.
  // Join ditambahkan HANYA bila semanticWhere aktif agar query non-semantik
  // tetap ringan (zero join ke tabel vektor).
  const baseQuery = semanticWhere
    ? db
        .select(questionColumns({ withAnswerKey: viewer ? canSeeAnswerKey(viewer) : false }))
        .from(questions)
        .leftJoin(questionEmbeddings, eq(questions.id, questionEmbeddings.questionId))
    : db
        .select(questionColumns({ withAnswerKey: viewer ? canSeeAnswerKey(viewer) : false }))
        .from(questions);

  const countQuery = semanticWhere
    ? db
        .select({ count: sql<number>`count(*)::int` })
        .from(questions)
        .leftJoin(questionEmbeddings, eq(questions.id, questionEmbeddings.questionId))
    : db
        .select({ count: sql<number>`count(*)::int` })
        .from(questions);

  const [{ count }] = await countQuery.where(combined);

  // Urutkan: semantik (bila aktif) > relevansi trigram > terbaru dulu.
  const finalOrder: SQL[] =
    orderBy ??
    (byRelevance && query.q
      ? [
          desc(sql`similarity(${questions.contentMarkdown}, ${query.q.trim()})`),
          desc(questions.createdAt),
        ]
      : [desc(questions.createdAt)]);

  const rows = await baseQuery
    .where(combined)
    .orderBy(...finalOrder)
    .limit(query.limit)
    .offset(query.offset);

  const items = await attachOptions(rows, viewer ? canSeeAnswerKey(viewer) : false);
  return { items, total: count };
}

/**
 * Lampirkan opsi ke banyak soal (MAT-146 — zero join: opsi sudah ikut di baris
 * `data_payload`, jadi tidak ada query opsi sama sekali).
 */
async function attachOptions(
  rows: Omit<PublicQuestion, "options">[],
  withAnswerKey: boolean,
): Promise<PublicQuestion[]> {
  if (rows.length === 0) return [];

  // Lampirkan wacana stimulus induk (hindari N+1): 1 query untuk semua parentId.
  const parentIds = [
    ...new Set(rows.map((r) => r.parentId).filter((v): v is string => !!v)),
  ];
  const questionIds = rows.map((r) => r.id);

  const [parents, qTopics] = await Promise.all([
    parentIds.length > 0
      ? db
          .select({ id: questions.id, contentMarkdown: questions.contentMarkdown })
          .from(questions)
          .where(inArray(questions.id, parentIds))
      : Promise.resolve([]),
    questionIds.length > 0
      ? db
          .select({
            questionId: questionTopics.questionId,
            id: topics.id,
            name: topics.name,
            level: topics.level,
            isPrimary: questionTopics.isPrimary,
          })
          .from(questionTopics)
          .innerJoin(topics, eq(questionTopics.topicId, topics.id))
          .where(inArray(questionTopics.questionId, questionIds))
      : Promise.resolve([]),
  ]);

  const parentMap = new Map<string, { id: string; contentMarkdown: string }>();
  for (const p of parents) parentMap.set(p.id, p);

  const topicMap = new Map<string, QuestionTopicView[]>();
  for (const qt of qTopics) {
    const list = topicMap.get(qt.questionId) ?? [];
    list.push({
      id: qt.id,
      name: qt.name,
      level: Number(qt.level),
      isPrimary: qt.isPrimary,
    });
    topicMap.set(qt.questionId, list);
  }

  return rows.map((r) => {
    const answerKey = "answerKey" in r ? (r as { answerKey?: unknown }).answerKey : undefined;
    return {
      ...r,
      dataPayload: projectDataPayload(r.dataPayload, { withAnswerKey }),
      ...(answerKey !== undefined
        ? { answerKey: projectAnswerKey(answerKey) as AnswerKey }
        : {}),
      options: projectOptions(
        { id: r.id, dataPayload: r.dataPayload, answerKey },
        { withAnswerKey, createdAt: r.createdAt, updatedAt: r.updatedAt },
      ),
      parent: r.parentId ? (parentMap.get(r.parentId) ?? null) : null,
      topics: topicMap.get(r.id) ?? [],
    } as PublicQuestion;
  });
}
