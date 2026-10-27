/**
 * Store idempotensi berbasis PostgreSQL (ADR-0029) — klaim BERSAMA lintas instance.
 *
 * KENAPA: `MemoryStore` hanya melihat permintaan yang mendarat di proses yang
 * sama. Dengan dua replika, dua klik ganda bisa masuk ke dua proses berbeda dan
 * keduanya menjalankan handler. Di sini klaim dilakukan lewat
 * `INSERT … ON CONFLICT DO NOTHING`: hanya satu yang mendapat baris.
 *
 * **Fail-closed**: error DB dilempar ke pemanggil (route-wrapper → 503).
 * Melepas proteksi diam-diam berarti mutasi bisa berjalan dua kali.
 */
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import type { IdempotencyCheck, IdempotencyStore } from "./idempotency";

/** Normalisasi hasil `db.execute` (postgres-js mengembalikan array-like). */
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: Database) {}

  async claim(key: string, fingerprint: string, ttlMs: number): Promise<IdempotencyCheck> {
    // postgres.js tak menerima objek Date di parameter timestamptz → ISO + cast.
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

    // 1) Klaim baris baru — satu pemenang bila ada permintaan paralel.
    const inserted = rowsOf(
      await this.db.execute(sql`
        INSERT INTO idempotency_keys (key, fingerprint, in_flight, expires_at)
        VALUES (${key}, ${fingerprint}, true, ${expiresAt}::timestamptz)
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `),
    );
    if (inserted.length > 0) return { kind: "fresh" };

    // 2) Baris sudah ada — baca keadaannya.
    const current = rowsOf(
      await this.db.execute(sql`
        SELECT fingerprint, status, body, in_flight, (expires_at <= ${nowIso}::timestamptz) AS expired
        FROM idempotency_keys WHERE key = ${key}
      `),
    );
    const row = current[0];
    // Baris hilang di antara INSERT dan SELECT (mis. prune) → anggap baru.
    if (!row) return { kind: "fresh" };

    if (row.expired === true) {
      // Ambil alih HANYA bila masih kedaluwarsa — dua pengambil-alih bisa balapan.
      const takenOver = rowsOf(
        await this.db.execute(sql`
          UPDATE idempotency_keys
          SET fingerprint = ${fingerprint}, in_flight = true, status = NULL, body = NULL,
              expires_at = ${expiresAt}::timestamptz, created_at = now()
          WHERE key = ${key} AND expires_at <= ${nowIso}::timestamptz
          RETURNING key
        `),
      );
      return takenOver.length > 0 ? { kind: "fresh" } : { kind: "in-flight" };
    }

    if (row.in_flight === true) return { kind: "in-flight" };
    if (String(row.fingerprint) !== fingerprint) return { kind: "mismatch" };
    return { kind: "replay", status: Number(row.status ?? 0), body: row.body };
  }

  async remember(
    key: string,
    status: number,
    body: unknown,
    fingerprint: string,
    ttlMs: number,
  ): Promise<void> {
    await this.db.execute(sql`
      UPDATE idempotency_keys
      SET in_flight = false, status = ${status}, body = ${JSON.stringify(body ?? null)}::jsonb,
          fingerprint = ${fingerprint}, expires_at = ${new Date(Date.now() + ttlMs).toISOString()}::timestamptz
      WHERE key = ${key}
    `);
  }

  async forget(key: string): Promise<void> {
    await this.db.execute(sql`DELETE FROM idempotency_keys WHERE key = ${key}`);
  }

  async prune(now: number): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM idempotency_keys WHERE expires_at <= ${new Date(now).toISOString()}::timestamptz
    `);
  }
}
