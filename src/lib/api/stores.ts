/**
 * Bootstrap store bersama (ADR-0029).
 *
 * Dipanggil `src/instrumentation.ts` sekali saat server menyala — **bukan** saat
 * modul route diimpor. Dengan begitu:
 *  - unit test (tanpa DB) tetap memakai `MemoryStore` yang deterministik;
 *  - dev tanpa `DATABASE_URL` tetap jalan;
 *  - build (`NEXT_PHASE=phase-production-build`) tidak membuka koneksi.
 */
import { db } from "@/lib/db";
import { setIdempotencyStore } from "./idempotency";
import { PgIdempotencyStore } from "./idempotency-store-pg";
import { setStore } from "./rate-limit";
import { PgRateLimitStore } from "./rate-limit-store-pg";

let installed = false;

/** Pasang store PostgreSQL untuk rate limit & idempotensi (idempoten). */
export function installSharedStores(): void {
  if (installed) return;
  setStore(new PgRateLimitStore(db));
  setIdempotencyStore(new PgIdempotencyStore(db));
  installed = true;
}
