/**
 * Service Enrichment (M10-d) — orkestrasi AI tagging + embedding.
 *
 * **Prinsip (terkunci):**
 *  - AI hanya **mengusulkan**; hasil diterapkan ke field soal + status → `review`.
 *  - `answer_key` TIDAK pernah disentuh AI.
 *  - Semua panggilan lewat `ai/client.ts` (satu gerbang).
 *  - Bila AI gagal → soal tetap utuh (error dilaporkan, bukan crash).
 *
 * Pemicu (D4): **manual** (1 soal) + **batch** (banyak soal).
 */
import { eq, inArray, and, isNull, sql } from "drizzle-orm";
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
import { embedText, embeddingModel } from "@/lib/embedding/bge-m3";
import { sha256 } from "@/lib/ingest/hash";
import { findNearDuplicates } from "@/lib/ingest/dedup";
import { recordAudit } from "@/lib/services/audit";
import type { EnrichmentProposal } from "@/lib/contracts/ai";
import { transition } from "@/lib/fsm/question-fsm";

export interface EnrichOutcome {
  questionId: string;
  ok: boolean;
  proposal?: EnrichmentProposal;
  error?: string;
  /** Status soal sesudah (review bila sukses dari draft). */
  status?: string;
  /**
   * Laporan kontrak pedagogi (MAT-41): galat KaTeX, rationale pengecoh yang
   * belum lengkap, dan rubrik esai yang belum sah. `ok` kontrak = semua bersih.
   */
  pedagogy?: {
    ok: boolean;
    katexIssues: number;
    rationaleIssues: number;
    rubricIssues: number;
    /** Jumlah opsi pengecoh yang rationale-nya diterapkan dari usulan AI. */
    rationaleApplied: number;
    /** True bila rubrik diterapkan dari usulan AI. */
    rubricApplied: boolean;
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
 * Slug sederhana. **CORR-02:** batas **100** char karena `tags.slug` adalah
 * `varchar(100)` (topics 255, tapi ambil batas terketat agar satu fungsi aman).
 * `normalize("NFKD")` bisa MEMPERPANJANG string (ligatur `ﬃ`→`ffi`), jadi potong
 * SETELAH normalisasi & buang `-` ekor sesudah potong — bukan sebelum.
 */
function slugify(s: string, maxLength = 100): string {
  const base = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return base || "untitled";
}

/** Cari/buat topik berdasarkan nama (case-insensitive), dalam transaksi. */
async function findOrCreateTopicTx(tx: Tx, name: string): Promise<string> {
  const slug = slugify(name);
  // **CORR-03:** cocokkan nama ATAU slug. Tabrakan bisa pada `uq_topics_slug`
  // (dua nama berbeda → slug sama), bukan hanya pada nama.
  const [existing] = await tx
    .select({ id: topics.id })
    .from(topics)
    .where(sql`lower(${topics.name}) = lower(${name}) OR ${topics.slug} = ${slug}`)
    .limit(1);
  if (existing) return existing.id;
  const [row] = await tx
    .insert(topics)
    .values({ name, slug, level: 1 })
    .onConflictDoNothing()
    .returning({ id: topics.id });
  if (row) return row.id;
  const [again] = await tx
    .select({ id: topics.id })
    .from(topics)
    .where(sql`lower(${topics.name}) = lower(${name}) OR ${topics.slug} = ${slug}`)
    .limit(1);
  // Tanpa non-null assertion: lebih baik galat jelas daripada `TypeError`.
  if (!again) throw new Error(`Gagal membuat/menemukan topik: ${name}`);
  return again.id;
}

/** Cari/buat tag berdasarkan nama, dalam transaksi. */
async function findOrCreateTagTx(tx: Tx, name: string): Promise<string> {
  const slug = slugify(name);
  // **CORR-03:** fallback kueri OR (nama ATAU slug) — tabrakan unik `tags` bisa
  // pada `uq_tags_name` maupun `uq_tags_slug`.
  const [existing] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${name}) OR ${tags.slug} = ${slug}`)
    .limit(1);
  if (existing) return existing.id;
  const [row] = await tx
    .insert(tags)
    .values({ name, slug })
    .onConflictDoNothing()
    .returning({ id: tags.id });
  if (row) return row.id;
  const [again] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${name}) OR ${tags.slug} = ${slug}`)
    .limit(1);
  // Tanpa non-null assertion: cegah runtime `TypeError` bila benar-benar gagal.
  if (!again) throw new Error(`Gagal membuat/menemukan tag: ${name}`);
  return again.id;
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

/**
 * Hitung + simpan embedding untuk soal (bila konten berubah).
 * `force` = embed ulang walau hash sama.
 */
export async function embedQuestions(
  questionIds: string[],
  actor: Actor,
  opts: { force?: boolean } = {},
): Promise<{
  results: Array<{ questionId: string; ok: boolean; skipped?: boolean; error?: string }>;
  ok: number;
  /** Berapa soal ditandai mirip (near-dedup) selama embedding (ADR-0012). */
  nearFlagged: number;
}> {
  // Izin dicek **per-soal** (termasuk aturan `own`).
  const rows = await db
    .select({
      id: questions.id,
      contentMarkdown: questions.contentMarkdown,
      embeddingContentHash: questions.embeddingContentHash,
      authorId: questions.authorId,
      isFlagged: questions.isFlagged,
    })
    .from(questions)
    .where(and(inArray(questions.id, questionIds), isNull(questions.deletedAt)));

  const results: Array<{ questionId: string; ok: boolean; skipped?: boolean; error?: string }> = [];
  const model = embeddingModel();
  let nearFlagged = 0;

  for (const q of rows) {
    // Izin per-soal (own untuk teacher/reviewer).
    try {
      assertCan(actor, "question:edit", { ownerId: q.authorId });
    } catch (e) {
      results.push({ questionId: q.id, ok: false, error: e instanceof Error ? e.message : "ditolak" });
      continue;
    }
    const contentHash = sha256(q.contentMarkdown);
    if (!opts.force && q.embeddingContentHash === contentHash) {
      results.push({ questionId: q.id, ok: true, skipped: true });
      continue;
    }
    const r = await embedText(q.contentMarkdown);
    if (!r.ok || !r.vector) {
      results.push({ questionId: q.id, ok: false, error: r.error });
      continue;
    }
    await db
      .update(questions)
      .set({
        embedding: r.vector,
        embeddingContentHash: contentHash,
        embeddingModelName: model,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, q.id));

    // Dedup NEAR (ADR-0012, #42/#43): setelah embedding tersedia, tandai bila
    // ada soal sangat mirip DENGAN penalaran sama. Soal TETAP (bukan auto-gabung)
    // — hanya `is_flagged` + catatan, untuk ditinjau manusia.
    // (Tulis langsung: izin `question:edit` sudah dicek di atas; jangan panggil
    //  service yang mengecek izin lain seperti `question:flag`.)
    if (!q.isFlagged) {
      try {
        const near = await findNearDuplicates(q.id);
        const dup = near.find((n) => n.isDuplicate);
        if (dup) {
          await db
            .update(questions)
            .set({
              isFlagged: true,
              flagNotes: `Mirip soal ${dup.id} (kemiripan ${dup.score.toFixed(2)}, penalaran sama).`,
            })
            .where(eq(questions.id, q.id));
          nearFlagged++;
        }
      } catch {
        /* near-dedup gagal tak boleh menggagalkan embedding */
      }
    }

    results.push({ questionId: q.id, ok: true });
  }

  const found = new Set(rows.map((r) => r.id));
  for (const id of questionIds) {
    if (!found.has(id)) results.push({ questionId: id, ok: false, error: "tidak ditemukan" });
  }

  const ok = results.filter((r) => r.ok && !r.skipped).length;
  if (ok > 0) {
    await recordAudit({
      actor,
      entityType: "question",
      entityId: questionIds[0]!,
      action: "update",
      changeSummary: `Embedding ${ok} soal (${model})${nearFlagged ? `, ${nearFlagged} ditandai mirip` : ""}`,
      diffPayload: { source: "ai_embedding", count: ok, model, nearFlagged },
    });
  }
  return { results, ok, nearFlagged };
}
