import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { checkDbInvariants } from "./invariants";

/**
 * Tes INTEGRASI invarian skema — DB uji nyata.
 *
 * Yang dibuktikan di sini dan TIDAK bisa dibuktikan tes unit: query
 * `information_schema`/pg_catalog benar-benar mengembalikan bentuk yang
 * diharapkan, dan tabel sisa migrasi (`*_backup`) TIDAK ikut dihitung sebagai
 * tabel skema. Sebelum perbaikan, tabel sisa menjadi kelonggaran yang menutupi
 * hilangnya satu tabel sungguhan.
 */
const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 2 });

const PROBE = "zz_probe_invarian_backup";

beforeAll(async () => {
  await sql`DROP TABLE IF EXISTS ${sql(PROBE)}`;
});

afterAll(async () => {
  await sql`DROP TABLE IF EXISTS ${sql(PROBE)}`;
  await sql.end();
});

describe("checkDbInvariants terhadap DB nyata", () => {
  it("skema termigrasi dinyatakan sehat", async () => {
    const r = await checkDbInvariants();
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.forbiddenTablesPresent).toEqual([]);
    expect(r.pkUsesUuidv7).toBe(true);
  });

  it("tabel sisa migrasi dilaporkan, dan TIDAK menambah hitungan tabel", async () => {
    await sql`DROP TABLE IF EXISTS ${sql(PROBE)}`;
    const before = await checkDbInvariants();

    await sql`CREATE TABLE ${sql(PROBE)} (id int)`;

    const after = await checkDbInvariants();
    expect(after.forbiddenTablesPresent).toContain(PROBE);
    expect(after.ok).toBe(false);
    expect(after.counts.tables).toBe(before.counts.tables);
  });
});
