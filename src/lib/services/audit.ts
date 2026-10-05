import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema/system";
import type { Actor } from "@/lib/auth/actor";
import { authorTypeOf } from "@/lib/auth/actor";

/** Jenis aksi audit (sinkron enum DB). */
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "restore"
  | "view"
  | "export";

/** Jenis entitas audit (sinkron enum DB). */
export type AuditEntity =
  | "question"
  | "bundle"
  | "topic"
  | "source"
  | "event"
  | "user"
  | "setting"
  | "media"
  | "tag";

/**
 * Catat audit (L5) — SATU tabel generik (T8).
 * Aktor → actorType/actorId; ringkasan + diff opsional.
 */
export async function recordAudit(params: {
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  actor: Actor;
  changeSummary?: string;
  diffPayload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogs).values({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    actorType: authorTypeOf(params.actor),
    actorId: params.actor.id,
    changeSummary: params.changeSummary,
    diffPayload: params.diffPayload,
  });
}

/**
 * Catat audit AKSES BACA data sensitif (M13 S7) — mis. melihat kunci jawaban
 * atau mengekspor paket. **Tidak melempar** bila gagal: pencatatan tak boleh
 * menggagalkan permintaan baca. Pemanggil tetap dapat `await` bila ingin pasti.
 *
 * Hanya untuk jalur SENSITIF — jangan panggil di setiap GET (bising).
 */
export async function recordViewAudit(params: {
  entityType: AuditEntity;
  entityId: string;
  action: "view" | "export";
  actor: Actor;
  changeSummary?: string;
}): Promise<void> {
  try {
    await recordAudit({
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actor: params.actor,
      changeSummary: params.changeSummary,
    });
  } catch {
    // Abaikan — audit baca bersifat best-effort, tak boleh memutus permintaan.
  }
}
