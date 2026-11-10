import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import { assertCan, NotFoundError } from "@/lib/auth/guards";
import { versionPredicate } from "@/lib/db/optimistic";
import { assertVersionMatches } from "@/lib/api/version";
import { throwVersionedWriteMiss } from "./versioned";
import type { Actor } from "@/lib/auth/actor";
import { recordAudit } from "./audit";
import {
  getQuestion,
  getQuestionInternal,
  type PublicQuestion,
} from "./question-read";

/**
 * Tandai atau lepas tanda masalah kualitas pada soal (flag/unflag).
 * Pecahan dari question-write.ts (CONSTRAINT #16: maks ~300 baris/file).
 */
export async function setQuestionFlag(
  id: string,
  flagged: boolean,
  notes: string | null,
  actor: Actor,
  /** Versi yang diharapkan (ADR-0030); `undefined` = tanpa prakondisi. */
  expectedVersion?: number | "*",
): Promise<PublicQuestion> {
  const existing = await getQuestionInternal(id);
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");
  assertCan(actor, "question:flag", { ownerId: existing.authorId });
  if (expectedVersion !== undefined) {
    assertVersionMatches(existing.version, expectedVersion);
  }

  const flaggedRows = await db
    .update(questions)
    .set({ isFlagged: flagged, flagNotes: flagged ? notes : null })
    .where(versionPredicate(questions, id, expectedVersion ?? "*"))
    .returning({ id: questions.id });
  if (flaggedRows.length === 0) {
    return throwVersionedWriteMiss(
      questions,
      id,
      expectedVersion,
      "Soal tidak ditemukan.",
    );
  }

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "update",
    actor,
    changeSummary: flagged ? "Soal ditandai" : "Tanda dilepas",
  });

  const updated = await getQuestion(id, { viewer: actor });
  if (!updated) throw new NotFoundError();
  return updated;
}
