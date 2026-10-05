/**
 * Enrichment satu soal (M10-d) — pecahan `enrichment-service.ts`.
 *
 * **Prinsip (terkunci):**
 *  - AI hanya **mengusulkan**; hasil diterapkan ke field soal + status → `review`.
 *  - `answer_key` TIDAK pernah disentuh AI (rubrik boleh ditambahkan, kunci tetap).
 *  - Semua panggilan lewat `ai/client.ts` (satu gerbang).
 *  - Bila AI gagal → soal tetap utuh (error dilaporkan, bukan crash).
 */
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions, questionOptions } from "@/lib/db/schema/question";
import { questionTopics, questionTags, topics, tags } from "@/lib/db/schema/taxonomy";
import type { Actor } from "@/lib/auth/actor";
import { assertCan, NotFoundError } from "@/lib/auth/guards";
import { chatJson } from "@/lib/ai/client";
import { getAiConfig, isAiReady } from "@/lib/ai/config";
import {
  buildSystemPrompt,
  buildUserPrompt,
  normalizeProposal,
  evaluatePedagogyContract,
  ALL_FIELDS,
  type EnrichField,
} from "@/lib/ai/enrich";
import { recordAudit } from "../audit";
import { transition } from "@/lib/fsm/question-fsm";
import type { EnrichOutcome } from "./shared";
import { findOrCreateTopicTx, findOrCreateTagTx } from "./taxonomy-tx";

/** Baca daftar topik aktif (nama) untuk dikirim ke prompt. */
async function listTopicNames(): Promise<string[]> {
  const rows = await db.select({ name: topics.name }).from(topics).where(eq(topics.isActive, true));
  return rows.map((r) => r.name);
}

/** Baca daftar tag (nama) yang sudah ada. */
async function listTagNames(): Promise<string[]> {
  const rows = await db.select({ name: tags.name }).from(tags).limit(500);
  return rows.map((r) => r.name);
}

/**
 * Enrich SATU soal: minta usulan AI → terapkan ke field + status → `review`.
 * Idempoten: menerapkan topik/tag yang sama tak menggandakan.
 */
export async function enrichQuestion(
  questionId: string,
  actor: Actor,
  fields: EnrichField[] = ALL_FIELDS,
): Promise<EnrichOutcome> {
  const [q] = await db
    .select({
      id: questions.id,
      contentMarkdown: questions.contentMarkdown,
      questionType: questions.questionType,
      answerKey: questions.answerKey,
      status: questions.status,
      authorId: questions.authorId,
    })
    .from(questions)
    .where(and(eq(questions.id, questionId), isNull(questions.deletedAt)))
    .limit(1);
  if (!q) throw new NotFoundError("Soal tidak ditemukan.");

  // Izin per-soal DULU (fail-closed): jangan lakukan kerja AI sebelum lolos izin.
  // `own` untuk teacher/reviewer/agent (ownerId); admin = yes.
  assertCan(actor, "question:edit", { ownerId: q.authorId });

  const cfg = await getAiConfig();
  if (!isAiReady(cfg)) {
    return { questionId, ok: false, error: "AI belum siap (cek Pengaturan → AI)." };
  }

  // Opsi soal (untuk rationale pengecoh) — hanya opsi salah yang diusulkan.
  const optionRows = await db
    .select({
      label: questionOptions.label,
      contentMarkdown: questionOptions.contentMarkdown,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questionOptions)
    .where(eq(questionOptions.questionId, questionId))
    .orderBy(questionOptions.orderIndex);

  const [topicNames, tagNames] = await Promise.all([listTopicNames(), listTagNames()]);
  const prompt = buildUserPrompt({
    content: q.contentMarkdown,
    ctx: { topics: topicNames, tags: tagNames },
    fields,
    options: optionRows,
  });

  const ai = await chatJson<unknown>(cfg, [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: prompt },
  ]);
  if (!ai.ok) return { questionId, ok: false, error: ai.error };

  const proposal = normalizeProposal(ai.data, fields, topicNames);

  const newStatus = q.status === "draft" ? transition("draft", "review") : q.status;

  // Terapkan rationale hanya ke opsi SALAH (label A–E). Kunci tak disentuh.
  const incorrect = optionRows.filter((o) => !o.isCorrect);
  const rationaleByLabel = new Map<string, string>();
  for (const o of incorrect) {
    const text = proposal.distractorRationale[o.label.toUpperCase()];
    if (text) rationaleByLabel.set(o.label.toUpperCase(), text);
  }
  const rubricApplied = proposal.rubric !== null && fields.includes("rubric");

  await db.transaction(async (tx) => {
    const set: Record<string, unknown> = {
      aiTagged: true,
      aiTaggedAt: new Date(),
      updatedAt: new Date(),
    };
    if (proposal.difficulty !== null) set.difficulty = proposal.difficulty;
    if (proposal.cognitiveLevel !== null) set.cognitiveLevel = proposal.cognitiveLevel;
    if (q.status === "draft") set.status = newStatus;
    if (rubricApplied) {
      const key = (q.answerKey ?? {}) as Record<string, unknown>;
      set.answerKey = { ...key, rubric: proposal.rubric };
    }
    await tx.update(questions).set(set).where(eq(questions.id, questionId));

    for (const [label, rationale] of rationaleByLabel) {
      await tx
        .update(questionOptions)
        .set({ distractorRationale: rationale, updatedAt: new Date() })
        .where(and(eq(questionOptions.questionId, questionId), eq(questionOptions.label, label)));
    }

    if (proposal.topics.length) {
      for (const name of proposal.topics) {
        const topicId = await findOrCreateTopicTx(tx, name);
        await tx.insert(questionTopics).values({ questionId, topicId }).onConflictDoNothing();
      }
    }
    if (proposal.tags.length) {
      for (const name of proposal.tags) {
        const tagId = await findOrCreateTagTx(tx, name);
        await tx.insert(questionTags).values({ questionId, tagId }).onConflictDoNothing();
      }
    }
  });

  // Evaluasi kontrak pedagogi pasca-terap: KaTeX murni, rationale lengkap, rubrik.
  const mergedOptions = optionRows.map((o) => ({
    label: o.label,
    isCorrect: o.isCorrect,
    contentMarkdown: o.contentMarkdown,
    distractorRationale: rationaleByLabel.get(o.label.toUpperCase()) ?? null,
  }));
  const report = evaluatePedagogyContract({
    contentMarkdown: q.contentMarkdown,
    questionType: q.questionType,
    options: mergedOptions,
    answerKey: { rubric: rubricApplied ? proposal.rubric : null },
  });

  await recordAudit({
    actor,
    entityType: "question",
    entityId: questionId,
    action: "update",
    changeSummary: `Enrichment AI (${fields.join(", ")})`,
    diffPayload: {
      source: "ai_enrichment",
      fields,
      proposal,
      statusFrom: q.status,
      statusTo: newStatus,
      pedagogy: report,
    },
  });

  return {
    questionId,
    ok: true,
    proposal,
    status: newStatus,
    pedagogy: {
      ok: report.ok,
      katexIssues: report.katex.length,
      rationaleIssues: report.rationale.length,
      rubricIssues: report.rubric.length,
      rationaleApplied: rationaleByLabel.size,
      rubricApplied,
    },
  };
}

/** Batch: enrich banyak soal, kembalikan ringkasan. */
export async function enrichQuestions(
  questionIds: string[],
  actor: Actor,
  fields: EnrichField[] = ALL_FIELDS,
): Promise<{ results: EnrichOutcome[]; ok: number; failed: number }> {
  // Izin dicek **per-soal** di `enrichQuestion` (termasuk aturan `own`).
  const results: EnrichOutcome[] = [];
  for (const id of questionIds) {
    try {
      results.push(await enrichQuestion(id, actor, fields));
    } catch (e) {
      results.push({ questionId: id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const ok = results.filter((r) => r.ok).length;
  return { results, ok, failed: results.length - ok };
}
