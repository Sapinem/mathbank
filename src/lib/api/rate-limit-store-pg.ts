/**
 * Store rate limit berbasis PostgreSQL (ADR-0029) — state BERSAMA lintas instance.
 *
 * KENAPA: `MemoryStore` menghitung per proses. Dua replika = dua kuota, dan
 * restart mengosongkan bucket. Di sini bucket hidup di tabel dan dihitung
 * **atomik dalam satu pernyataan**: baris yang bentrok dikunci oleh UPSERT,
 * jadi dua permintaan paralel tidak bisa sama-sama mendapat token terakhir.
 *
 * **Fail-open**: bila DB bermasalah, permintaan DIIZINKAN dan kegagalan dicatat.
 * Rate limit adalah pagar tambahan, bukan pagar keamanan — menolak semua
 * permintaan saat DB goyang justru mematikan layanan lebih parah daripada
 * membiarkannya tanpa batas sementara.
 */
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { log } from "@/lib/telemetry/logger";
import type { RateLimitResult, RateLimitStore } from "./rate-limit";

/** TTL bucket menganggur: 1 jam (sama dengan `MemoryStore.prune`). */
const IDLE_MS = 3_600_000;

/** Normalisasi hasil `db.execute` (postgres-js mengembalikan array-like). */
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

export class PgRateLimitStore implements RateLimitStore {
  constructor(private readonly db: Database) {}

  async take(
    key: string,
    opts: { capacity: number; refillPerSec: number; now: number },
  ): Promise<RateLimitResult> {
    const { capacity, refillPerSec, now } = opts;
    // postgres.js tak menerima objek Date di parameter bertipe timestamptz → ISO + cast.
    const at = new Date(now).toISOString();
    try {
      // Satu pernyataan: isi ulang dihitung dari `updated_at` baris yang
      // sedang dikunci UPSERT, lalu token dipotong BILA cukup.
      const taken = rowsOf(
        await this.db.execute(sql`
          INSERT INTO rate_limit_buckets AS b (key, tokens, updated_at)
          VALUES (${key}, ${capacity - 1}, ${at}::timestamptz)
          ON CONFLICT (key) DO UPDATE SET
            tokens = LEAST(
              ${capacity},
              b.tokens + GREATEST(0, EXTRACT(EPOCH FROM (${at}::timestamptz - b.updated_at))) * ${refillPerSec}
            ) - 1,
            updated_at = ${at}::timestamptz
          WHERE LEAST(
              ${capacity},
              b.tokens + GREATEST(0, EXTRACT(EPOCH FROM (${at}::timestamptz - b.updated_at))) * ${refillPerSec}
            ) >= 1
          RETURNING tokens
        `),
      );
      if (taken.length > 0) {
        const tokens = Number(taken[0].tokens ?? 0);
        return { allowed: true, remaining: Math.max(0, Math.floor(tokens)), retryAfterMs: 0 };
      }

      // Ditolak: hitung sisa token untuk `Retry-After` yang masuk akal.
      const current = rowsOf(
        await this.db.execute(sql`
          SELECT LEAST(
              ${capacity},
              tokens + GREATEST(0, EXTRACT(EPOCH FROM (${at}::timestamptz - updated_at))) * ${refillPerSec}
            ) AS tokens
          FROM rate_limit_buckets WHERE key = ${key}
        `),
      );
      const refilled = Number(current[0]?.tokens ?? 0);
      const deficit = Math.max(0, 1 - refilled);
      const retryAfterMs = Math.max(1, Math.ceil((deficit / refillPerSec) * 1000));
      return { allowed: false, remaining: 0, retryAfterMs };
    } catch (err) {
      // Fail-open (keputusan pemilik produk): jangan jatuhkan layanan.
      log.error({
        msg: "rate_limit_store_failed",
        code: "RATE_LIMIT_STORE_DEGRADED",
        error: err instanceof Error ? err.message : String(err),
      });
      return { allowed: true, remaining: 0, retryAfterMs: 0 };
    }
  }

  async prune(now: number): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM rate_limit_buckets WHERE updated_at < ${new Date(now - IDLE_MS).toISOString()}::timestamptz
    `);
  }
}
