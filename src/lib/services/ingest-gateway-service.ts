import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema/source";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import type { Actor } from "@/lib/auth/actor";
import { ConflictError } from "@/lib/auth/guards";
import { validateKatexContract } from "@/lib/ai/enrich";
import { createQuestion } from "@/lib/services/question-service";
import { contentHash } from "@/lib/ingest/hash";
import { findQuestionByContentHash } from "@/lib/ingest/dedup";
import type {
  CanonicalCommitFailure,
  CanonicalIngestBatchInput,
  CanonicalIngestReport,
  CanonicalQuestionItem,
} from "@/lib/contracts/ingest-canonical";
import type { AnswerKey } from "@/lib/contracts/question";

/**
 * Ekstrak seluruh teks yang mengandung atau mungkin mengandung KaTeX
 * dari satu butir soal kanonik untuk validasi sintaks mendalam.
 */
function extractKatexTexts(
  item: CanonicalQuestionItem,
): { location: string; text: string }[] {
  const list: { location: string; text: string }[] = [];

  if (item.stem) {
    list.push({ location: "stem", text: item.stem });
  }

  const dp = item.dataPayload as Record<string, unknown> | undefined;
  if (dp && typeof dp === "object") {
    if (Array.isArray(dp.options)) {
      dp.options.forEach((opt, idx) => {
        if (
          opt &&
          typeof opt === "object" &&
          typeof opt.contentMarkdown === "string"
        ) {
          list.push({
            location: `opsi ${opt.id ?? idx + 1}`,
            text: opt.contentMarkdown,
          });
        }
      });
    }
    if (Array.isArray(dp.rows)) {
      dp.rows.forEach((r, idx) => {
        if (r && typeof r === "object") {
          const t =
            typeof r.text === "string"
              ? r.text
              : typeof r.contentMarkdown === "string"
                ? r.contentMarkdown
                : "";
          if (t) list.push({ location: `baris ${idx + 1}`, text: t });
        }
      });
    }
    if (Array.isArray(dp.statements)) {
      dp.statements.forEach((s, idx) => {
        if (s && typeof s === "object") {
          const t =
            typeof s.text === "string"
              ? s.text
              : typeof s.contentMarkdown === "string"
                ? s.contentMarkdown
                : "";
          if (t) list.push({ location: `pernyataan ${idx + 1}`, text: t });
        }
      });
    }
    if (Array.isArray(dp.premises)) {
      dp.premises.forEach((p, idx) => {
        if (
          p &&
          typeof p === "object" &&
          typeof p.contentMarkdown === "string"
        ) {
          list.push({ location: `premis ${idx + 1}`, text: p.contentMarkdown });
        }
      });
    }
    if (Array.isArray(dp.responses)) {
      dp.responses.forEach((res, idx) => {
        if (
          res &&
          typeof res === "object" &&
          typeof res.contentMarkdown === "string"
        ) {
          list.push({
            location: `respons ${idx + 1}`,
            text: res.contentMarkdown,
          });
        }
      });
    }
  }

  const ak = item.answerKey as Record<string, unknown> | undefined;
  if (
    ak &&
    typeof ak === "object" &&
    typeof ak.explanationMarkdown === "string"
  ) {
    list.push({
      location: "pembahasan (answerKey)",
      text: ak.explanationMarkdown,
    });
  }

  if (item.explanation) {
    list.push({ location: "pembahasan (explanation)", text: item.explanation });
  }

  return list;
}

/**
 * Ekstrak array string teks opsi untuk keperluan kalkulasi `contentHash`.
 */
function extractOptionTexts(item: CanonicalQuestionItem): string[] {
  const dp = item.dataPayload as Record<string, unknown> | undefined;
  if (!dp || typeof dp !== "object") return [];

  if (Array.isArray(dp.options)) {
    return dp.options
      .map((opt) =>
        opt && typeof opt === "object" && typeof opt.contentMarkdown === "string"
          ? opt.contentMarkdown
          : "",
      )
      .filter((s) => s.length > 0);
  }

  return [];
}

/**
 * Evaluasi standar mutu satu butir soal kanonik in-memory (Pilar 2 / CONSTRAINTS #29).
 * Memeriksa kelengkapan stem dan sintaks KaTeX berpasangan.
 */
export function evaluateCanonicalItemQuality(
  item: CanonicalQuestionItem,
): { ok: boolean; reason?: string } {
  if (!item.stem || !item.stem.trim()) {
    return { ok: false, reason: "Stem/teks soal tidak boleh kosong" };
  }

  const katexEntries = extractKatexTexts(item);
  for (const entry of katexEntries) {
    const check = validateKatexContract(entry.text);
    if (!check.ok) {
      const issues = check.issues.map((i) => i.message).join("; ");
      return {
        ok: false,
        reason: `Validasi KaTeX gagal pada ${entry.location}: ${issues}`,
      };
    }
  }

  return { ok: true };
}

/**
 * Resolve atau buat sumber (sources) secara idempoten.
 */
export async function resolveSourceId(
  sourceName: string,
  sourceUrl?: string | null,
): Promise<string> {
  const [existing] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.label, sourceName))
    .limit(1);
  if (existing) return existing.id;

  try {
    const [row] = await db
      .insert(sources)
      .values({ kind: "website", label: sourceName, url: sourceUrl ?? null })
      .returning({ id: sources.id });
    return row!.id;
  } catch {
    const [again] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.label, sourceName))
      .limit(1);
    if (again) return again.id;
    throw new ConflictError("Gagal membuat/mengambil sumber ingest.");
  }
}

/**
 * Resolve atau buat bundel naskah soal (bundles) secara idempoten (ADR-0014).
 */
export async function resolveBundleId(input: {
  sourceId: string;
  title: string;
  url?: string | null;
  grade?: string | null;
  subject?: string | null;
  eventId?: string | null;
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
      bundleType: "source",
      origin: "ingest",
      sourceId: input.sourceId,
      url: input.url ?? null,
      grade: input.grade ?? null,
      eventId: input.eventId ?? null,
      status: "draft",
    })
    .returning({ id: bundles.id });
  return row!.id;
}

/**
 * Tautkan soal ke bundle secara idempoten.
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
 * Service Gateway Ingest Kanonik (U2).
 *
 * Menerima payload batch soal kanonik, mengevaluasi standar mutu in-memory,
 * menolak butir cacat ke dalam laporan, dan menyimpan butir valid ke database
 * dengan deduplikasi hash & pencatatan provenance.
 */
export async function ingestCanonicalBatch(
  input: CanonicalIngestBatchInput,
  actor: Actor,
): Promise<CanonicalIngestReport> {
  const failures: CanonicalCommitFailure[] = [];
  const validItemsWithIndex: { item: CanonicalQuestionItem; index: number }[] =
    [];

  // 1) Evaluasi mutu in-memory per-butir
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i]!;
    const itemIndex = it.ref?.index !== undefined ? it.ref.index : i;
    const quality = evaluateCanonicalItemQuality(it);

    if (!quality.ok) {
      failures.push({
        index: itemIndex,
        stemPreview: it.stem.trim().slice(0, 80),
        reason: quality.reason ?? "Gagal evaluasi standar mutu",
      });
    } else {
      validItemsWithIndex.push({ item: it, index: itemIndex });
    }
  }

  // 2) Resolve source & bundle
  const sourceId = await resolveSourceId(
    input.source.name,
    input.source.url ?? null,
  );
  const bundleId = await resolveBundleId({
    sourceId,
    title: input.bundle.title,
    url: input.bundle.url ?? null,
    grade: input.bundle.grade ?? null,
    subject: input.bundle.subject ?? null,
    eventId: input.bundle.eventId ?? null,
  });

  let created = 0;
  let linked = 0;
  const questionIds: string[] = [];
  const idByRefIndex = new Map<number, string>();

  // 3) Persistensi butir valid
  for (const { item: it, index: itemIndex } of validItemsWithIndex) {
    const optTexts = extractOptionTexts(it);
    const hash = contentHash(it.stem, optTexts);

    try {
      // Cek apakah soal identik sudah ada (deduplikasi konten ADR-0012)
      const existing = await findQuestionByContentHash(hash);
      if (existing) {
        await linkQuestionToBundle(bundleId, existing.id, String(itemIndex));
        idByRefIndex.set(itemIndex, existing.id);
        linked++;
        questionIds.push(existing.id);
        continue;
      }

      // Butir baru: simpan ke database dengan status 'draft'
      const parentId =
        it.parentRefIndex != null
          ? idByRefIndex.get(it.parentRefIndex)
          : undefined;

      const q = await createQuestion(
        {
          questionType: it.type,
          difficulty: it.difficulty ?? 3,
          cognitiveLevel: it.cognitiveLevel ?? "apply",
          grade: input.bundle.grade ?? null,
          contentMarkdown: it.stem,
          options: [],
          dataPayload: it.dataPayload,
          answerKey: it.answerKey as AnswerKey,
          status: "draft",
          childOrder: it.childOrder ?? 0,
          ...(parentId ? { parentId } : {}),
          topicIds: [],
          solutions: it.explanation
            ? [
                {
                  solutionType: "conceptual" as const,
                  title: "Pembahasan Konseptual",
                  contentMarkdown: it.explanation,
                  isPrimary: true,
                },
              ]
            : [],
          tagIds: [],
          isFlagged: (it.warnings?.length ?? 0) > 0,
          flagNotes:
            it.warnings && it.warnings.length > 0
              ? it.warnings.join("; ")
              : null,
        },
        actor,
      );

      await linkQuestionToBundle(bundleId, q.id, String(itemIndex));
      idByRefIndex.set(itemIndex, q.id);
      created++;
      questionIds.push(q.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({
        index: itemIndex,
        stemPreview: it.stem.trim().slice(0, 80),
        reason: msg,
      });
    }
  }

  return {
    bundleId,
    totalReceived: input.items.length,
    created,
    linked,
    rejectedCount: failures.length,
    failures,
    questionIds,
  };
}
