import { uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Kolom PK `uuid` dengan default **`uuidv7()`** (PostgreSQL 18+).
 *
 * KENAPA uuidv7 (bukan UUIDv4 / `defaultRandom()`):
 * - UUIDv7 **berurutan waktu** → penyisipan B-tree lebih rapi-padat (better
 *   locality), insert lebih efisien seiring pertumbuhan data.
 * - Urutan kronologis terbaca dari ID.
 *
 * Lihat: `docs/SKEMA-DB-DETAIL.md` §Konvensi, `docs/ADR/0003-postgresql-18-uuidv7.md`.
 *
 * Keterikatan: butuh PostgreSQL 18+ (target kita: 18.6 @ :5433).
 */
export function uuidPk(name = "id") {
  return uuid(name)
    .primaryKey()
    .default(sql`uuidv7()`);
}
