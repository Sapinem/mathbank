import { and, eq, isNull, asc, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions, type Question } from "@/lib/db/schema/question";
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
import type { AnswerKey } from "@/lib/contracts/question";
export type { QuestionListStats } from "@/lib/contracts/question";
export { listQuestions } from "./question-list";

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
  /** Peran butir dalam naskah: scored question atau wacana/stimulus bersama. */
  role: "question" | "stimulus";
  /** Seksi naskah (mis. "Bagian A"). */
  sectionName: string | null;
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
        role: bundleItems.role,
        sectionName: bundleItems.sectionName,
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
