/**
 * Embedding soal + near-dedup (M10-d) — pecahan `enrichment-service.ts`.
 *
 * Menghitung & menyimpan embedding BGE-M3, lalu menandai soal yang sangat mirip
 * (ADR-0012, #42/#43) untuk ditinjau manusia — soal TETAP, bukan auto-gabung.
 */
import { eq, inArray, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import type { Actor } from "@/lib/auth/actor";
import { assertCan } from "@/lib/auth/guards";
import { embedText, embeddingModel } from "@/lib/embedding/bge-m3";
import { sha256 } from "@/lib/ingest/hash";
import { findNearDuplicates } from "@/lib/ingest/dedup";
import { recordAudit } from "../audit";

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
