/**
 * Pembacaan paket soal (L5) — pecahan `bundle-service.ts` (SRP).
 *
 * Tanggung jawab tunggal: BACA paket & item (+ hitung jumlah).
 * Mutasi ada di `bundle-write.ts`; pengelolaan item ada di `bundle-items.ts`.
 *
 * Invarian penting (dipegang bersama modul saudara):
 *  - Soal yang dipakai paket **tak bisa dihapus** (RESTRICT).
 *  - `answerKey`/`isCorrect`/`distractorRationale` hanya muncul bila aktor
 *    berwenang (`canSeeAnswerKey`) — proyeksi aman (S3).
 *
 * ⚠️ JANGAN impor file ini dari komponen klien (menarik `@/lib/db`).
 */
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { questions } from "@/lib/db/schema/question";
import { questionTopics } from "@/lib/db/schema/taxonomy";
import {
  questionColumns,
  projectOptions,
  projectAnswerKey,
  projectDataPayload,
  canSeeAnswerKey,
} from "@/lib/db/projections/question";
import { assertBundleRead, bundleColumns } from "./bundle-shared";
import type {
  BundleRow,
  BundleCore,
  BundleListResult,
  BundleItemWithQuestion,
  BundleValidation,
  BundleItemRow,
} from "./bundle-shared";
import type { Actor } from "@/lib/auth/actor";
import type { PublicQuestion } from "./question-service";
import type { AnswerKey } from "@/lib/contracts/question";

/**
 * Lampirkan itemCount ke baris paket.
 *
 * CATATAN: sengaja TIDAK memakai subquery `sql` di dalam `.select()` — Drizzle
 * men-correlate alias tabel luar dengan cara yang (di driver ini) menghasilkan 0.
 * Grup-hit terpisah: andal & jelas.
 */
async function attachCounts(rows: BundleCore[]): Promise<BundleRow[]> {
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      bundleId: bundleItems.bundleId,
      c: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(bundleItems)
    .where(
      inArray(
        bundleItems.bundleId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(bundleItems.bundleId);
  const map = new Map(counts.map((c) => [c.bundleId, Number(c.c)]));
  return rows.map((r) => ({ ...r, itemCount: map.get(r.id) ?? 0 }));
}

/**
 * Lampirkan statistik pengayaan per paket (MAT-127): jumlah butir hidup,
 * rerata kesulitan, dan cakupan topik.
 *
 * Dua query agregat untuk SELURUH halaman (bukan per baris) — tetap satu
 * request HTTP dari klien. `COUNT(DISTINCT …)` dipakai karena join
 * `question_topics` menggandakan baris per topik; tanpa DISTINCT rerata
 * kesulitan akan berbobot jumlah topik.
 */
async function attachEnrichment(rows: BundleRow[]): Promise<BundleRow[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);

  const [diffRows, topicRows] = await Promise.all([
    db
      .select({
        bundleId: bundleItems.bundleId,
        questionCount: sql<number>`COUNT(DISTINCT ${questions.id})`.mapWith(Number),
        avgDifficulty: sql<number>`COALESCE(AVG(${questions.difficulty}), 0)`.mapWith(Number),
      })
      .from(bundleItems)
      .innerJoin(questions, eq(questions.id, bundleItems.questionId))
      .where(and(inArray(bundleItems.bundleId, ids), isNull(questions.deletedAt)))
      .groupBy(bundleItems.bundleId),
    db
      .select({
        bundleId: bundleItems.bundleId,
        topicCount: sql<number>`COUNT(DISTINCT ${questionTopics.topicId})`.mapWith(Number),
        tagged: sql<number>`COUNT(DISTINCT ${questions.id})`.mapWith(Number),
      })
      .from(bundleItems)
      .innerJoin(questions, eq(questions.id, bundleItems.questionId))
      .innerJoin(questionTopics, eq(questionTopics.questionId, questions.id))
      .where(and(inArray(bundleItems.bundleId, ids), isNull(questions.deletedAt)))
      .groupBy(bundleItems.bundleId),
  ]);

  const diffMap = new Map(diffRows.map((d) => [d.bundleId, d]));
  const topicMap = new Map(topicRows.map((t) => [t.bundleId, t]));

  return rows.map((r) => {
    const d = diffMap.get(r.id);
    const t = topicMap.get(r.id);
    const questionCount = Number(d?.questionCount ?? 0);
    const taggedQuestionCount = Number(t?.tagged ?? 0);
    return {
      ...r,
      enrichment: {
        questionCount,
        avgDifficulty: Math.round(Number(d?.avgDifficulty ?? 0) * 10) / 10,
        topicCount: Number(t?.topicCount ?? 0),
        taggedQuestionCount,
        topicCoverage:
          questionCount > 0
            ? Math.round((taggedQuestionCount / questionCount) * 100) / 100
            : 0,
      },
    };
  });
}

/**
 * Daftar paket aktif (belum diarsip) + jumlah soal.
 *
 * ⚠️ Sengaja TIDAK menyaring per-pemilik: guru **boleh melihat** latihan guru
 * lain (keputusan pemilik produk). Yang dibatasi adalah **mutasi**, ditegakkan
 * `assertBundleWrite` per-paket.
 *
 * MAT-39: dukung filter opsional `bundleType` & `origin`.
 * **PERF-05:** dukung paginasi `limit` (default 20) & `offset` agar `GET
 * /api/bundles` tak menarik seluruh paket sekaligus.
 *
 * **API-05:** kembalikan amplop ter-paginasi `{ items, total, limit, offset }`
 * (selaras `/api/questions`) — `total` = jumlah SELURUH paket cocok filter,
 * bukan sekadar panjang halaman. Sebelumnya fungsi ini mengembalikan array
 * telanjang sehingga klien tak bisa tahu ada berapa halaman lagi.
 */
export async function listBundles(
  actor: Actor,
  filter?: {
    bundleType?: "source" | "exam";
    origin?: "ingest" | "manual";
    /** ACT-04: filter status server-side. `active` = semua yang belum diarsip. */
    status?: "active" | "draft" | "review" | "ready" | "archived";
    /** ACT-04: pencarian judul/tahun server-side (ILIKE). */
    q?: string;
    limit?: number;
    offset?: number;
  },
): Promise<BundleListResult> {
  assertBundleRead(actor);
  const conds = [isNull(bundles.deletedAt)];
  if (filter?.bundleType) conds.push(eq(bundles.bundleType, filter.bundleType));
  if (filter?.origin) conds.push(eq(bundles.origin, filter.origin));
  if (filter?.status && filter.status !== "active") {
    conds.push(eq(bundles.status, filter.status));
  }
  const q = filter?.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    // Judul ATAU tahun (dijadikan teks) — meniru pencarian sisi klien lama.
    conds.push(
      or(
        ilike(bundles.title, pattern),
        sql`CAST(${bundles.year} AS TEXT) ILIKE ${pattern}`,
      )!,
    );
  }
  const where = and(...conds);
  const limit = filter?.limit ?? 20;
  const offset = filter?.offset ?? 0;

  // Empat kueri paralel, SATU request HTTP dari klien:
  //  1) total baris cocok, 2) halaman ini, 3) agregat per jenis, 4) total butir.
  const [[{ total }], rows, typeRows, [itemAgg]] = await Promise.all([
    db
      .select({ total: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(bundles)
      .where(where),
    db
      .select(bundleColumns())
      .from(bundles)
      .where(where)
      .orderBy(desc(bundles.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({
        bundleType: bundles.bundleType,
        c: sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(bundles)
      .where(where)
      .groupBy(bundles.bundleType),
    db
      .select({ totalItems: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(bundleItems)
      .innerJoin(bundles, eq(bundles.id, bundleItems.bundleId))
      .where(where),
  ]);

  const byType = { exam: 0, source: 0 };
  for (const r of typeRows) byType[r.bundleType] = Number(r.c);

  return {
    items: await attachEnrichment(await attachCounts(rows)),
    total,
    limit,
    offset,
    stats: { byType, totalItems: Number(itemAgg?.totalItems ?? 0) },
  };
}

/** Ambil satu paket (tanpa item) atau null. */
export async function getBundle(id: string): Promise<BundleRow | null> {
  const [row] = await db
    .select(bundleColumns())
    .from(bundles)
    .where(and(eq(bundles.id, id), isNull(bundles.deletedAt)))
    .limit(1);
  if (!row) return null;
  const [withCount] = await attachCounts([row]);
  return withCount!;
}

/**
 * Daftar item paket (berurutan), dengan soal ter-proyeksi.
 *
 * **NEW4:** `actor` diteruskan agar `answerKey` hanya muncul bila viewer berwenang
 * (`canSeeAnswerKey`) — konsisten dengan aturan S3 di `question-service`.
 */
export async function listBundleItems(
  id: string,
  actor?: Actor,
): Promise<BundleItemWithQuestion[]> {
  const withAnswerKey = actor ? canSeeAnswerKey(actor) : false;
  // Proyeksi bersyarat (kunci hanya bila berwenang) membuat Drizzle menyimpulkan
  // tipe GABUNGAN yang tak bisa disatukan TS. Kita normalkan sekali di batas baca.
  const rows = (await db
    .select({
      item: {
        id: bundleItems.id,
        bundleId: bundleItems.bundleId,
        questionId: bundleItems.questionId,
        role: bundleItems.role,
        orderIndex: bundleItems.orderIndex,
        sectionName: bundleItems.sectionName,
        itemNumber: bundleItems.itemNumber,
        notes: bundleItems.notes,
      },
      question: questionColumns({ withAnswerKey }),
    })
    .from(bundleItems)
    .innerJoin(questions, eq(questions.id, bundleItems.questionId))
    .where(eq(bundleItems.bundleId, id))
    .orderBy(asc(bundleItems.orderIndex))) as unknown as Array<{
    item: BundleItemRow;
    question: Omit<PublicQuestion, "options" | "answerKey"> & {
      answerKey?: AnswerKey;
    };
  }>;

  // MAT-146 — opsi & kunci dibaca langsung dari `data_payload` / `answer_key`
  // (zero join, tanpa query kedua). Naskah cetak tetap dapat pilihan jawaban.
  if (rows.length === 0) return [];
  return rows.map((r) => ({
    ...r,
    question: {
      ...r.question,
      dataPayload: projectDataPayload(r.question.dataPayload, { withAnswerKey }),
      ...(r.question.answerKey !== undefined
        ? { answerKey: projectAnswerKey(r.question.answerKey) as AnswerKey }
        : {}),
      options: projectOptions(
        {
          id: r.question.id,
          dataPayload: r.question.dataPayload,
          answerKey: r.question.answerKey,
        },
        { withAnswerKey, createdAt: r.question.createdAt, updatedAt: r.question.updatedAt },
      ),
    },
  }));
}

/**
 * Validasi paket: kelengkapan soal & kunci. Peringatan ≠ error.
 */
export async function validateBundle(
  id: string,
): Promise<BundleValidation> {
  const items = await db
    .select({
      questionId: bundleItems.questionId,
      itemNumber: bundleItems.itemNumber,
      deletedAt: questions.deletedAt,
      answerKey: questions.answerKey,
    })
    .from(bundleItems)
    .innerJoin(questions, eq(questions.id, bundleItems.questionId))
    .where(eq(bundleItems.bundleId, id));

  const withoutAnswerKey: BundleValidation["withoutAnswerKey"] = [];
  const missingQuestions: string[] = [];
  for (const it of items) {
    if (it.deletedAt) {
      missingQuestions.push(it.questionId);
      continue;
    }
    // `answer_key` kosong = tak punya kunci (`{}` bukan null).
    const key = it.answerKey as Record<string, unknown> | null | undefined;
    const takPunyaKunci =
      key === null ||
      key === undefined ||
      (typeof key === "object" && Object.keys(key).length === 0);
    if (takPunyaKunci) {
      withoutAnswerKey.push({
        questionId: it.questionId,
        itemNumber: it.itemNumber,
      });
    }
  }
  return {
    itemCount: items.length,
    withoutAnswerKey,
    missingQuestions,
    valid: missingQuestions.length === 0,
  };
}

/** Apakah sebuah soal dipakai di paket AKTIF mana pun? (untuk RESTRICT hapus soal) */
export async function isQuestionUsedInBundles(
  questionId: string,
): Promise<boolean> {
  // T-M7-3: hanya paket AKTIF yang memblokir — paket terarsip tak boleh
  // menyandera soal (jika tidak, soal mustahil dihapus setelah paket diarsip).
  const [row] = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .innerJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .where(
      and(eq(bundleItems.questionId, questionId), isNull(bundles.deletedAt)),
    )
    .limit(1);
  return Boolean(row);
}

/** ID paket AKTIF yang memakai sekumpulan soal. */
export async function bundlesUsingQuestions(
  questionIds: string[],
): Promise<string[]> {
  if (questionIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ bundleId: bundleItems.bundleId })
    .from(bundleItems)
    .innerJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .where(
      and(
        inArray(bundleItems.questionId, questionIds),
        isNull(bundles.deletedAt),
      ),
    );
  return rows.map((r) => r.bundleId);
}
