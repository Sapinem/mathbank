/**
 * Service paket soal (L5) — M7.
 *
 * Menyusun naskah dari bank soal: metadata paket + item (soal) berurutan.
 *
 * Invarian penting:
 *  - Soal yang dipakai paket **tak bisa dihapus** (RESTRICT — dicek di sini
 *    dan di `question-service.deleteQuestion`).
 *  - **Stimulus tampil 1×**: baris `role='stimulus'` disimpan sekali; soal anak
 *    (parent_id → stimulus) ditampilkan di bawahnya.
 *  - Paket di-soft-delete (`deleted_at`); slug boleh dipakai ulang setelahnya.
 *
 * ⚠️ JANGAN impor file ini dari komponen klien (menarik `@/lib/db`).
 */
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { questions, questionOptions } from "@/lib/db/schema/question";
import { questionColumns, optionColumns, canSeeAnswerKey } from "@/lib/db/projections/question";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { slugify } from "@/lib/taxonomy/tree";
import { recordAudit } from "./audit";

export type BundleType = "source" | "exam" | "exercise";
export type BundleItemRole = "question" | "stimulus";

export interface BundleRow {
  id: string;
  title: string;
  slug: string;
  bundleType: BundleType;
  sourceId: string | null;
  eventId: string | null;
  year: number | null;
  grade: string | null;
  durationMinutes: number | null;
  instructions: string | null;
  status: "draft" | "review" | "ready" | "archived";
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BundleItemRow {
  id: string;
  bundleId: string;
  questionId: string;
  role: BundleItemRole;
  orderIndex: number;
  sectionName: string | null;
  itemNumber: string | null;
  notes: string | null;
}

type BundleCore = Omit<BundleRow, "itemCount">;

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

export interface CreateBundleInput {
  title: string;
  bundleType: BundleType;
  sourceId?: string | null;
  eventId?: string | null;
  year?: number | null;
  grade?: string | null;
  durationMinutes?: number;
  instructions?: string | null;
}

export interface UpdateBundleInput {
  title?: string;
  bundleType?: BundleType;
  sourceId?: string | null;
  eventId?: string | null;
  year?: number | null;
  grade?: string | null;
  durationMinutes?: number;
  instructions?: string | null;
  status?: "draft" | "review" | "ready" | "archived";
}

/** Buat slug unik di antara paket aktif (tambah akhiran -2, -3, …). */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || "paket";
  let candidate = root;
  let n = 1;
  // Cari yang belum dipakai paket AKTIF.
  for (;;) {
    const rows = await db
      .select({ id: bundles.id })
      .from(bundles)
      .where(
        and(
          eq(bundles.slug, candidate),
          isNull(bundles.deletedAt),
          exceptId ? sql`${bundles.id} <> ${exceptId}` : undefined,
        ),
      )
      .limit(1);
    if (rows.length === 0) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/**
 * Proyeksi kolom paket (tanpa itemCount) — dipakai `listBundles` & `getBundle`.
 * Mencegah duplikasi & konsisten dengan aturan #34 (selalu proyeksi eksplisit).
 */
function bundleColumns() {
  return {
    id: bundles.id,
    title: bundles.title,
    slug: bundles.slug,
    bundleType: bundles.bundleType,
    sourceId: bundles.sourceId,
    eventId: bundles.eventId,
    year: bundles.year,
    grade: bundles.grade,
    durationMinutes: bundles.durationMinutes,
    instructions: bundles.instructions,
    status: bundles.status,
    createdAt: bundles.createdAt,
    updatedAt: bundles.updatedAt,
  };
}

/** Daftar paket aktif (belum diarsip) + jumlah soal. */
export async function listBundles(actor: Actor): Promise<BundleRow[]> {
  assertCan(actor, "question:view");
  const rows = await db
    .select(bundleColumns())
    .from(bundles)
    .where(isNull(bundles.deletedAt))
    .orderBy(desc(bundles.updatedAt));
  return attachCounts(rows);
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

/** Buat paket baru (status draft). */
export async function createBundle(
  input: CreateBundleInput,
  actor: Actor,
): Promise<BundleRow> {
  assertCan(actor, "bundle:manage");
  const slug = await uniqueSlug(input.title);
  const [row] = await db
    .insert(bundles)
    .values({
      title: input.title,
      slug,
      bundleType: input.bundleType,
      sourceId: input.sourceId ?? null,
      eventId: input.eventId ?? null,
      year: input.year ?? null,
      grade: input.grade ?? null,
      durationMinutes: input.durationMinutes ?? 90,
      instructions: input.instructions ?? null,
      createdById: actor.id,
    })
    .returning({ id: bundles.id });
  await recordAudit({
    entityType: "bundle",
    entityId: row!.id,
    action: "create",
    actor,
    changeSummary: `Paket dibuat: ${input.title}`,
  });
  return (await getBundle(row!.id))!;
}

/** Perbarui metadata paket. */
export async function updateBundle(
  id: string,
  patch: UpdateBundleInput,
  actor: Actor,
): Promise<BundleRow> {
  assertCan(actor, "bundle:manage");
  const existing = await getBundle(id);
  if (!existing) throw new NotFoundError("Paket tidak ditemukan.");

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) {
    set.title = patch.title;
    set.slug = await uniqueSlug(patch.title, id);
  }
  if (patch.bundleType !== undefined) set.bundleType = patch.bundleType;
  if (patch.sourceId !== undefined) set.sourceId = patch.sourceId;
  if (patch.eventId !== undefined) set.eventId = patch.eventId;
  if (patch.year !== undefined) set.year = patch.year;
  if (patch.grade !== undefined) set.grade = patch.grade;
  if (patch.durationMinutes !== undefined)
    set.durationMinutes = patch.durationMinutes;
  if (patch.instructions !== undefined) set.instructions = patch.instructions;
  if (patch.status !== undefined) set.status = patch.status;

  await db.update(bundles).set(set).where(eq(bundles.id, id));
  await recordAudit({
    entityType: "bundle",
    entityId: id,
    action: "update",
    actor,
    changeSummary: "Paket diperbarui",
  });
  return (await getBundle(id))!;
}

/** Arsip paket (soft-delete). */
export async function archiveBundle(id: string, actor: Actor): Promise<void> {
  assertCan(actor, "bundle:manage");
  const existing = await getBundle(id);
  if (!existing) throw new NotFoundError("Paket tidak ditemukan.");
  await db
    .update(bundles)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(bundles.id, id));
  await recordAudit({
    entityType: "bundle",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Paket diarsipkan (soft-delete)",
  });
}

/**
 * Daftar item paket (berurutan), dengan soal ter-proyeksi.
 *
 * **NEW4:** `actor` diteruskan agar `answerKey` hanya muncul bila viewer berwenang
 * (`canSeeAnswerKey`) — konsisten dengan aturan S3 di `question-service`.
 */
export async function listBundleItems(id: string, actor?: Actor) {
  const withAnswerKey = actor ? canSeeAnswerKey(actor) : false;
  const rows = await db
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
    .orderBy(asc(bundleItems.orderIndex));

  // Lampirkan opsi (M8: naskah cetak butuh pilihan jawaban). Batch agar tak N+1.
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.question.id);
  const opts = await db
    .select(optionColumns({ withAnswerKey }))
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, ids))
    .orderBy(asc(questionOptions.orderIndex));
  const byQuestion = new Map<string, typeof opts>();
  for (const o of opts) {
    const arr = byQuestion.get(o.questionId) ?? [];
    arr.push(o);
    byQuestion.set(o.questionId, arr);
  }
  return rows.map((r) => ({
    ...r,
    question: { ...r.question, options: byQuestion.get(r.question.id) ?? [] },
  }));
}

/** Tambah soal ke paket (di akhir). Tolak duplikat. */
export async function addItem(
  bundleId: string,
  questionId: string,
  actor: Actor,
  opts: { role?: BundleItemRole; sectionName?: string | null } = {},
): Promise<BundleItemRow> {
  assertCan(actor, "bundle:manage");
  const bundle = await getBundle(bundleId);
  if (!bundle) throw new NotFoundError("Paket tidak ditemukan.");

  const [q] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, questionId), isNull(questions.deletedAt)))
    .limit(1);
  if (!q) throw new NotFoundError("Soal tidak ditemukan.");

  // Tolak duplikat (invarian UNIQUE(bundle_id, question_id)).
  const [dup] = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .where(
      and(
        eq(bundleItems.bundleId, bundleId),
        eq(bundleItems.questionId, questionId),
      ),
    )
    .limit(1);
  if (dup) throw new ConflictError("Soal sudah ada di paket ini.");

  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(order_index), 0)` })
    .from(bundleItems)
    .where(eq(bundleItems.bundleId, bundleId));

  const [row] = await db
    .insert(bundleItems)
    .values({
      bundleId,
      questionId,
      role: opts.role ?? "question",
      orderIndex: Number(max) + 1,
      sectionName: opts.sectionName ?? null,
    })
    .returning();
  await db
    .update(bundles)
    .set({ updatedAt: new Date() })
    .where(eq(bundles.id, bundleId));
  return row!;
}

/** Hapus item dari paket. */
export async function removeItem(
  bundleId: string,
  itemId: string,
  actor: Actor,
): Promise<void> {
  assertCan(actor, "bundle:manage");
  const [row] = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .where(and(eq(bundleItems.id, itemId), eq(bundleItems.bundleId, bundleId)))
    .limit(1);
  if (!row) throw new NotFoundError("Item paket tidak ditemukan.");
  await db.delete(bundleItems).where(eq(bundleItems.id, itemId));
  await db
    .update(bundles)
    .set({ updatedAt: new Date() })
    .where(eq(bundles.id, bundleId));
}

/** Susun ulang item sesuai daftar id (urutan baru). */
export async function reorderItems(
  bundleId: string,
  itemIds: string[],
  actor: Actor,
): Promise<void> {
  assertCan(actor, "bundle:manage");
  const existing = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .where(eq(bundleItems.bundleId, bundleId));
  const ids = new Set(existing.map((r) => r.id));
  if (itemIds.some((id) => !ids.has(id))) {
    throw new NotFoundError("Ada item yang bukan milik paket ini.");
  }
  // T-M7-2: WAJIB daftar LENGKAP — tolak subset/duplikat agar `order_index`
  // tidak bentrok (mis. [1,1,2,2]) & urutan tetap deterministik.
  const unique = new Set(itemIds);
  if (unique.size !== itemIds.length) {
    throw new ConflictError("Daftar urutan memuat id duplikat.");
  }
  if (itemIds.length !== existing.length) {
    throw new ConflictError(
      "Daftar urutan harus memuat SELURUH item paket (tidak boleh sebagian).",
    );
  }
  // Transaksi: perbarui seluruh urutan secara atomik (gagal parsial → rollback).
  await db.transaction(async (tx) => {
    for (let i = 0; i < itemIds.length; i++) {
      await tx
        .update(bundleItems)
        .set({ orderIndex: i + 1 })
        .where(eq(bundleItems.id, itemIds[i]!));
    }
    await tx
      .update(bundles)
      .set({ updatedAt: new Date() })
      .where(eq(bundles.id, bundleId));
  });
}

export interface BundleValidation {
  itemCount: number;
  /** Soal yang dipakai tapi belum punya kunci jawaban (peringatan, bukan error). */
  withoutAnswerKey: { questionId: string; itemNumber: string | null }[];
  /** Soal yang ter-soft-delete tapi masih ada di paket (harus dibersihkan). */
  missingQuestions: string[];
  valid: boolean;
}

/** Validasi paket: kelengkapan soal & kunci. Peringatan ≠ error. */
export async function validateBundle(id: string): Promise<BundleValidation> {
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

/** Duplikasi paket (metadata + item) dengan judul baru. */
export async function duplicateBundle(
  id: string,
  actor: Actor,
  newTitle?: string,
): Promise<BundleRow> {
  assertCan(actor, "bundle:manage");
  const src = await getBundle(id);
  if (!src) throw new NotFoundError("Paket tidak ditemukan.");
  const title = newTitle ?? `${src.title} (salinan)`;
  const copy = await createBundle(
    {
      title,
      bundleType: src.bundleType,
      sourceId: src.sourceId,
      eventId: src.eventId,
      year: src.year,
      grade: src.grade,
      durationMinutes: src.durationMinutes ?? 90,
      instructions: src.instructions,
    },
    actor,
  );
  const items = await db
    .select({
      questionId: bundleItems.questionId,
      role: bundleItems.role,
      orderIndex: bundleItems.orderIndex,
      sectionName: bundleItems.sectionName,
      itemNumber: bundleItems.itemNumber,
      notes: bundleItems.notes,
    })
    .from(bundleItems)
    .where(eq(bundleItems.bundleId, id))
    .orderBy(asc(bundleItems.orderIndex));

  if (items.length > 0) {
    await db.insert(bundleItems).values(
      items.map((it) => ({
        bundleId: copy.id,
        questionId: it.questionId,
        role: it.role,
        orderIndex: it.orderIndex,
        sectionName: it.sectionName,
        itemNumber: it.itemNumber,
        notes: it.notes,
      })),
    );
  }
  return (await getBundle(copy.id))!;
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
