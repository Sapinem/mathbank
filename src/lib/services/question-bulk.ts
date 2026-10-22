import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import { auditLogs } from "@/lib/db/schema/system";
import { authorTypeOf, type Actor } from "@/lib/auth/actor";
import { assertCan, ConflictError, NotFoundError } from "@/lib/auth/guards";
import {
  transition,
  assertReady,
  type QuestionStatus,
} from "@/lib/fsm/question-fsm";
import { assertReleaseContract } from "./question-release";

/**
 * Aksi massal (kurasi) — G3.1, **dioptimasi ACT-05**.
 *
 * **Prinsip (hindari tambal-sulam):** bulk tetap menegakkan aturan yang sama
 * dengan jalur satuan — FSM (L6), izin per-tujuan (L1), kesiapan `ready`, dan
 * penjagaan balapan (CONSTRAINT #36). Yang berubah HANYA cara eksekusinya:
 * dulu `for (id of ids) await changeQuestionStatus(...)` = N×(baca + tulis +
 * audit + baca proyeksi) ≈ 9 query/soal → **1.800 query** untuk 200 soal.
 *
 * Sekarang:
 *   1. satu SELECT semua baris yang dibutuhkan (status, tipe, answer_key, author),
 *   2. validasi FSM/izin/kesiapan **di memori** per butir (tanpa I/O),
 *   3. satu UPDATE set-based dengan CAS per baris (`UPDATE … FROM (VALUES …)`),
 *   4. satu INSERT audit batch.
 *
 * Total ≤ 3 query DB, dalam SATU transaksi (atomic + satu roundtrip pool).
 *
 * Hasilnya tetap **per-butir** ("partial success"): butir yang tak lolos
 * izin/FSM/balapan masuk `failed`, bukan menggagalkan seluruh batch.
 */

export type BulkAction =
  | "set_ready"
  | "archive"
  | "reject_to_draft"
  | "flag"
  | "unflag";

export const BULK_ACTIONS: readonly BulkAction[] = [
  "set_ready",
  "archive",
  "reject_to_draft",
  "flag",
  "unflag",
] as const;

/** Peta aksi → status tujuan FSM (untuk aksi status). */
const STATUS_TARGET: Partial<Record<BulkAction, QuestionStatus>> = {
  set_ready: "ready",
  archive: "archived",
  reject_to_draft: "draft",
};

export interface BulkResult {
  ok: string[];
  failed: { id: string; error: string }[];
  /** Jumlah query DB yang dieksekusi (bukti DoD ACT-05: ≤ 3). */
  dbQueries?: number;
  /** Durasi eksekusi (ms) — bukti DoD (< 300 ms untuk 200 soal). */
  durationMs?: number;
}

/** Batas aman jumlah id per permintaan (cegah penyalahgunaan). */
export const BULK_MAX_IDS = 200;

/** Baris minimal yang dibutuhkan untuk memvalidasi satu butir. */
interface CandidateRow {
  id: string;
  status: string;
  questionType: string;
  dataPayload: Record<string, unknown> | null;
  answerKey: Record<string, unknown> | null;
  authorId: string | null;
}

/**
 * Ambil pesan galat yang bisa dibaca operator.
 *
 * KENAPA tidak `err instanceof Error` saja: `QuestionPayloadValidationError`
 * mewarisi `ZodError` (zod v4) yang **tidak lolos** `instanceof Error` pada
 * beberapa jalur modul. Akibatnya penolakan gerbang pedagogis diringkas jadi
 * "Gagal diproses." dan operator kehilangan alasan konkretnya (opsi mana yang
 * kurang rationale, field mana yang kosong). Kontrak galat harus menyampaikan
 * sebab, bukan menelannya.
 */
function errMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Gagal diproses.";
}

/** Nilai `changeSummary` audit untuk aksi status. */
function statusSummary(from: string, to: QuestionStatus): string {
  return `Status ${from} → ${to}`;
}

export async function bulkQuestionAction(
  ids: string[],
  action: BulkAction,
  actor: Actor,
  notes?: string | null,
): Promise<BulkResult> {
  const startedAt = Date.now();
  const uniqueIds = [...new Set(ids)];
  const target = STATUS_TARGET[action];

  let dbQueries = 0;

  const result = await db.transaction(async (tx): Promise<BulkResult> => {
    const result: BulkResult = { ok: [], failed: [] };

    // ── 1 query: ambil semua baris yang diperlukan sekaligus ────────────────
    const rows = (await tx
      .select({
        id: questions.id,
        status: questions.status,
        questionType: questions.questionType,
        // MAT-150 — kontrak rilis massal butuh payload, bukan hanya answer_key.
        dataPayload: questions.dataPayload,
        answerKey: questions.answerKey,
        authorId: questions.authorId,
      })
      .from(questions)
      .where(inArray(questions.id, uniqueIds))) as CandidateRow[];
    dbQueries += 1;

    const byId = new Map(rows.map((r) => [r.id, r]));

    // ── Validasi di memori (tanpa I/O) — aturan identik jalur satuan ────────
    /** id → status asal, untuk UPDATE dengan CAS per baris. */
    const pending: { id: string; from: QuestionStatus }[] = [];
    /** audit yang akan di-insert batch. */
    const audits: { id: string; summary: string }[] = [];

    for (const id of uniqueIds) {
      const row = byId.get(id);
      if (!row) {
        result.failed.push({ id, error: new NotFoundError("Soal tidak ditemukan.").message });
        continue;
      }

      try {
        if (target) {
          const from = row.status as QuestionStatus;
          if (from === target) {
            // Sudah di status tujuan → idempoten: hitung sukses, tanpa tulis.
            result.ok.push(id);
            continue;
          }
          transition(from, target);
          if (target === "ready") {
            assertCan(actor, "question:setReady");
            assertReady({ questionType: row.questionType, answerKey: row.answerKey });
            // MAT-150 — gerbang pedagogis yang sama dengan jalur satuan;
            // tanpa ini aksi massal `set_ready` jadi jalan pintas rilis.
            assertReleaseContract({
              questionType: row.questionType,
              dataPayload: row.dataPayload,
              answerKey: row.answerKey,
            });
          } else if (target === "archived") {
            assertCan(actor, "question:archive");
          } else {
            assertCan(actor, "question:edit", { ownerId: row.authorId });
          }
          pending.push({ id, from });
          audits.push({ id, summary: statusSummary(from, target) });
        } else {
          // flag / unflag — izin tunggal (tanpa kepemilikan), sama seperti setQuestionFlag.
          assertCan(actor, "question:flag");
          pending.push({ id, from: row.status as QuestionStatus });
          audits.push({
            id,
            summary: action === "flag" ? "Soal ditandai" : "Tanda dilepas",
          });
        }
      } catch (err) {
        result.failed.push({ id, error: errMessage(err) });
      }
    }

    if (pending.length === 0) return result;

    // ── 1 query: UPDATE set-based dengan CAS per baris ──────────────────────
    let updatedIds: string[];
    if (target) {
      // `UPDATE … FROM (VALUES (id, from_status), …)` → satu pernyataan untuk
      // SEMUA status asal sekaligus, dan `q.status = v.from_status` menjaga
      // semantik compare-and-swap per baris (tidak ada update "buta").
      const values = sql.join(
        pending.map((p) => sql`(${p.id}::uuid, ${p.from}::question_status)`),
        sql`, `,
      );
      const updated = await tx.execute(sql`
        UPDATE questions AS q
           SET status = ${target}::question_status
               ${target === "ready" ? sql`, last_reviewed_at = now()` : sql``}
               ${notes !== undefined && notes !== null ? sql`, flag_notes = ${notes}` : sql``}
          FROM (VALUES ${values}) AS v(id, from_status)
         WHERE q.id = v.id
           AND q.status = v.from_status
        RETURNING q.id
      `);
      dbQueries += 1;
      updatedIds = rowsOf(updated).map((r) => String(r.id));
    } else {
      const flagged = action === "flag";
      const updated = await tx
        .update(questions)
        .set({ isFlagged: flagged, flagNotes: flagged ? (notes ?? null) : null })
        .where(inArray(questions.id, pending.map((p) => p.id)))
        .returning({ id: questions.id });
      dbQueries += 1;
      updatedIds = updated.map((r) => r.id);
    }

    // ── Bagi hasil: yang tak ter-RETURN berarti kalah balapan (CAS gagal) ────
    const updatedSet = new Set(updatedIds);
    for (const p of pending) {
      if (updatedSet.has(p.id)) {
        result.ok.push(p.id);
      } else {
        result.failed.push({
          id: p.id,
          error: new ConflictError(
            "Status soal sudah berubah oleh permintaan lain. Muat ulang lalu coba lagi.",
          ).message,
        });
      }
    }

    // ── 1 query: audit batch (hanya untuk yang benar-benar berubah) ──────────
    const auditRows = audits
      .filter((a) => updatedSet.has(a.id))
      .map((a) => ({
        entityType: "question" as const,
        entityId: a.id,
        action: (target ? "status_change" : "update") as "status_change" | "update",
        actorType: authorTypeOf(actor),
        actorId: actor.id,
        changeSummary: a.summary,
      }));
    if (auditRows.length > 0) {
      await tx.insert(auditLogs).values(auditRows);
      dbQueries += 1;
    }

    return result;
  });

  return {
    ...result,
    dbQueries,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Normalisasi hasil `tx.execute()` (postgres.js mengembalikan RowList mirip
 * array; beberapa driver membungkusnya di `.rows`). Hanya `id` yang dibaca.
 */
function rowsOf(res: unknown): Array<{ id: unknown }> {
  if (Array.isArray(res)) return res as Array<{ id: unknown }>;
  const maybe = (res as { rows?: unknown } | null)?.rows;
  return Array.isArray(maybe) ? (maybe as Array<{ id: unknown }>) : [];
}
