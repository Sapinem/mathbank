import { inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { questionTopics, topics } from "@/lib/db/schema/taxonomy";
import { listBundleItems, getBundle } from "@/lib/services/bundle-service";
import { assertCan } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { canSeeAnswerKey } from "@/lib/db/projections/question";
import { buildGitsyncZip, type GitsyncQuestion, type GitsyncResult } from "@/lib/export/gitsync";
import type { QuestionType } from "@/lib/export/moodle-map";

/**
 * Susun ekspor GitSync dari sebuah PAKET soal (M12).
 *
 * Alur: ambil paket + itemnya → ambil jalur topik tiap soal → rakit soal siap
 * ekspor → `buildGitsyncZip`.
 *
 * **Izin**: `bundle:manage` (baca paket). Kunci jawaban hanya bila aktor
 * berwenang (`canSeeAnswerKey`); tanpa kunci, mutichoice tak bisa diekspor (D4).
 */

/** Ambil jalur topik (nama) untuk sekumpulan soal, urut induk→anak. */
async function topicPathsFor(questionIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (questionIds.length === 0) return map;

  const rows = await db
    .select({
      questionId: questionTopics.questionId,
      topicId: topics.id,
      name: topics.name,
      parentId: topics.parentId,
    })
    .from(questionTopics)
    .innerJoin(topics, eq(topics.id, questionTopics.topicId))
    .where(inArray(questionTopics.questionId, questionIds));

  // Semua topik (untuk resolusi induk).
  const all = await db.select({ id: topics.id, name: topics.name, parentId: topics.parentId }).from(topics);
  const byId = new Map(all.map((t) => [t.id, t]));

  // Pilih topik (primer/pertama) per soal, lalu telusuri ke akar.
  const primaryTopic = new Map<string, string>();
  for (const r of rows) {
    if (!primaryTopic.has(r.questionId)) primaryTopic.set(r.questionId, r.topicId);
  }
  for (const [qid, tid] of primaryTopic) {
    const path: string[] = [];
    let cur = byId.get(tid);
    let guard = 0;
    while (cur && guard++ < 20) {
      path.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    map.set(qid, path);
  }
  return map;
}

export interface MoodleExportSummary {
  ok: boolean;
  bundleTitle: string;
  exported: number;
  skipped: { name: string; type: string; reason: string }[];
  withoutAnswerKey: string[];
}

/** Bangun ZIP GitSync untuk paket. Kembalikan ringkasan + buffer. */
export async function exportBundleToGitsync(
  bundleId: string,
  actor: Actor,
): Promise<{ summary: MoodleExportSummary; result: GitsyncResult }> {
  assertCan(actor, "bundle:manage");
  const bundle = await getBundle(bundleId);
  if (!bundle) throw new Error("Paket tidak ditemukan.");

  const items = await listBundleItems(bundleId, actor);
  const canSeeKey = canSeeAnswerKey(actor);

  // Stimulus: peta id soal → teks (untuk INLINE ke anak).
  const stimulusText = new Map<string, string>();
  for (const it of items) {
    if (it.item.role === "stimulus") stimulusText.set(it.question.id, it.question.contentMarkdown);
  }
  // Peta anak → induk (parentId soal) untuk inline stimulus.
  const childParent = new Map<string, string>();
  for (const it of items) {
    if (it.item.role !== "stimulus" && it.question.parentId) {
      childParent.set(it.question.id, it.question.parentId);
    }
  }

  const soalItems = items.filter((it) => it.item.role !== "stimulus");
  const topicPaths = await topicPathsFor(soalItems.map((it) => it.question.id));

  const gq: GitsyncQuestion[] = soalItems.map((it) => {
    const key = it.question.answerKey as { correct?: string[]; text?: string; explanation?: string } | undefined;
    // **Sumber kebenaran = `answerKey.correct`** (label). `options.isCorrect`
    // TIDAK dipercaya: data nyata bisa tak sinkron (kunci ada, isCorrect kosong).
    const correct = new Set(canSeeKey ? (key?.correct ?? []) : []);
    const parentId = childParent.get(it.question.id);
    return {
      type: it.question.questionType as QuestionType,
      content: it.question.contentMarkdown,
      stimulusContent: parentId ? stimulusText.get(parentId) ?? null : null,
      options: it.question.options.map((o) => ({
        label: o.label,
        content: o.contentMarkdown,
        isCorrect: canSeeKey && correct.has(o.label),
      })),
      answerText: canSeeKey ? (key?.text ?? null) : null,
      explanation: canSeeKey ? (key?.explanation ?? null) : null,
      name: it.question.contentMarkdown.slice(0, 60),
      itemNumber: it.item.itemNumber,
      topicPath: topicPaths.get(it.question.id) ?? [],
    };
  });

  const result = buildGitsyncZip(gq);
  const summary: MoodleExportSummary = {
    ok: result.ok,
    bundleTitle: bundle.title,
    exported: result.exported,
    skipped: result.skipped.map((s) => ({ name: s.name, type: s.type, reason: s.reason })),
    withoutAnswerKey: result.withoutAnswerKey,
  };
  return { summary, result };
}
