import { integer, uuid } from "drizzle-orm/pg-core";
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

/**
 * Kolom nomor revisi untuk konkurensi optimistik (ADR-0030).
 *
 * KENAPA integer, bukan `updated_at`: timestamp beresolusi mikrodetik bisa
 * bernilai sama untuk dua UPDATE berurutan dalam satu transaksi, sehingga dua
 * klien yang menulis bersamaan sama-sama lolos. Integer monoton tidak ambigu.
 *
 * KENAPA dinaikkan trigger, bukan kode aplikasi: satu UPDATE yang lupa
 * menaikkan `version` membuat ETag basi selamanya, dan `If-Match` berubah dari
 * proteksi menjadi jebakan. Trigger menutup SEMUA penulis — service, skrip
 * seed, SQL manual.
 *
 * ⚠️ Jangan pernah mempercayai `version` dari klien. Trigger menimpa nilai apa
 * pun yang dikirim dengan `OLD.version + 1`.
 */
export function versionColumn() {
  return integer("version").default(1).notNull();
}
