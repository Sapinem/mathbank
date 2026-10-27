/**
 * Predikat versi untuk `WHERE` (ADR-0030).
 *
 * KENAPA di L5, bukan di service: bentuknya menyentuh tipe kolom Drizzle, dan
 * aturannya sama untuk semua tabel berversi — menyalinnya ke 14 service berarti
 * 14 peluang salah tulis.
 *
 * Pemakaian:
 *   const rows = await tx.update(questions)
 *     .set(patch)
 *     .where(versionPredicate(questions, id, expectedVersion))
 *     .returning({ version: questions.version });
 *   if (rows.length === 0) throw new PreconditionFailedError();
 *
 * Baris kosong berarti SALAH SATU: baris hilang, atau versinya sudah bergeser.
 * Karena pemanggil sudah memastikan baris ada sebelum transaksi, artinya versi
 * bergeser — yaitu tepatnya yang ingin ditolak.
 */
import { and, eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** Kolom minimum yang harus dimiliki tabel berversi. */
export interface VersionedTable {
  id?: AnyPgColumn;
  version: AnyPgColumn;
}

/** `key = ?` saja bila `expected === "*"`, selain itu `key = ? AND version = ?`. */
export function versionPredicate(
  table: VersionedTable,
  id: string,
  expected: number | "*",
  keyCol?: AnyPgColumn,
): SQL {
  const col = keyCol ?? table.id;
  if (!col) throw new Error("Kolom kunci tidak ditemukan pada tabel.");
  const byId = eq(col, id);
  if (expected === "*") return byId;
  return and(byId, eq(table.version, expected))!;
}
