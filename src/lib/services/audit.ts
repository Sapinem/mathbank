import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema/system";
import type { Actor } from "@/lib/auth/actor";
import { authorTypeOf } from "@/lib/auth/actor";

/** Jenis aksi audit (sinkron enum DB). */
export type AuditAction = "create" | "update" | "delete" | "status_change" | "restore";

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
