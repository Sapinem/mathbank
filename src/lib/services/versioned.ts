/**
 * Bantuan untuk mutasi ber-versi (ADR-0030).
 *
 * KENAPA perlu: `UPDATE/DELETE … WHERE id = ? AND version = ?` yang mengenai 0
 * baris punya DUA arti — baris hilang (404) atau versi bergeser (412). Keduanya
 * tidak bisa dibedakan dari `rowCount`. Pemeriksaan lanjutan hanya dijalankan
 * pada jalur gagal, jadi jalur sukses tetap satu query.
 */
import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { PreconditionFailedError } from "@/lib/api/version";
import { NotFoundError } from "@/lib/auth/guards";

/** Tabel yang punya kolom `id` & `version`. */
export type VersionedPgTable = PgTable & { id: AnyPgColumn; version: AnyPgColumn };

/**
 * Lempar galat yang tepat setelah UPDATE/DELETE mengenai 0 baris.
 *
 * Selalu melempar — tipe `never` supaya pemanggil bisa `return` langsung dan
 * TypeScript tahu barisnya tak ada.
 */
export async function throwVersionedWriteMiss(
  table: VersionedPgTable,
  id: string,
  expected: number | "*" | undefined,
  notFoundMessage: string,
): Promise<never> {
  if (expected !== undefined) {
    const [row] = await db
      .select({ version: table.version })
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    if (row) {
      throw new PreconditionFailedError(undefined, (row as { version: number }).version);
    }
  }
  throw new NotFoundError(notFoundMessage);
}
