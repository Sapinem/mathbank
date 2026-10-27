/**
 * **ACT-03 (P0) C — pemeliharaan state rate limit & idempotensi.**
 *
 * Store `rateLimit` dan `idempotency` menyimpan entri ber-TTL (bucket token,
 * respons idempotensi) yang **tidak** hilang dengan sendirinya. Tanpa
 * pembersihan berkala: `MemoryStore` membocorkan memori proses, dan
 * `PgRateLimitStore`/`PgIdempotencyStore` (ADR-0029) menumpuk baris mati.
 * Prune kini menjalankan DELETE di DB, karena itu **di-await**.
 *
 * Modul ini menjadwalkan `prune()` pada interval tetap, sekali per proses.
 * Dipanggil dari `src/instrumentation.ts` (hook `register()` Next.js).
 *
 * Prinsip (Release It!): pemeliharaan bersifat **best-effort & tidak pernah
 * melempar** — kegagalan prune tak boleh menjatuhkan server atau request.
 */

/** Interval default: 60 detik (cukup rapat, biaya O(n) kecil). */
export const PRUNE_INTERVAL_MS = 60_000;

interface MaintenanceState {
  timer: ReturnType<typeof setInterval> | null;
  runs: number;
  lastRunAt: number;
  lastError: string | null;
}

function state(): MaintenanceState {
  const g = globalThis as unknown as { __mbTelemetryMaintenance?: MaintenanceState };
  if (!g.__mbTelemetryMaintenance) {
    g.__mbTelemetryMaintenance = { timer: null, runs: 0, lastRunAt: 0, lastError: null };
  }
  return g.__mbTelemetryMaintenance;
}

/** Jalankan satu siklus prune (dipisah agar bisa diuji tanpa timer). */
export async function runPruneOnce(now: number = Date.now()): Promise<void> {
  const s = state();
  try {
    const { getStore } = await import("@/lib/api/rate-limit");
    const { getIdempotencyStore } = await import("@/lib/api/idempotency");
    // Store bersama (ADR-0029) melakukan DELETE di PostgreSQL → harus di-await,
    // jika tidak kegagalannya jadi unhandled rejection di luar try/catch ini.
    await getStore().prune?.(now);
    await getIdempotencyStore().prune?.(now);
    try {
      const { imageRateLimiter } = await import("@/app/img/[shortId]/route");
      imageRateLimiter.prune(now);
    } catch {
      // route belum diimpor atau berjalan di lingkungan tanpa route
    }
    s.runs += 1;
    s.lastRunAt = now;
    s.lastError = null;
  } catch (err) {
    // Best-effort: catat sekali, jangan pernah melempar ke pemanggil.
    s.lastError = err instanceof Error ? err.message : String(err);
  }
}

/**
 * Mulai penjadwalan prune. Idempoten — panggilan berulang (hot reload dev,
 * beberapa worker) tidak membuat timer ganda.
 */
export function startTelemetryMaintenance(
  intervalMs: number = PRUNE_INTERVAL_MS,
): void {
  const s = state();
  if (s.timer) return;
  const timer = setInterval(() => {
    void runPruneOnce();
  }, intervalMs);
  // Jangan tahan proses tetap hidup hanya karena timer pemeliharaan.
  timer.unref?.();
  s.timer = timer;
}

/** Hentikan penjadwalan (untuk uji / shutdown rapi). */
export function stopTelemetryMaintenance(): void {
  const s = state();
  if (s.timer) {
    clearInterval(s.timer);
    s.timer = null;
  }
}

/** Status pemeliharaan (untuk uji & diagnosa). */
export function maintenanceStatus(): MaintenanceState {
  const s = state();
  return { ...s };
}
