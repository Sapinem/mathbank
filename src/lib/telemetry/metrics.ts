/**
 * Telemetri ringan (M16) — metrik per-route in-memory.
 *
 * **Nol dependency.** Menyimpan sampel latensi & penghitung error per
 * `METHOD route` dalam ring buffer berukuran tetap, lalu menghitung
 * count / error / p50 / p95 / max saat diminta. Cocok untuk **single node**
 * (proses Next.js). Untuk multi-node, ganti dengan Prometheus (lihat
 * `docs/OBSERVABILITAS.md` §4).
 *
 * Disimpan di `globalThis` agar bertahan lintas hot-reload dev dan tak
 * ter-reset tiap modul di-reimport (penting di serverless/lambda-ish).
 */

const MAX_SAMPLES = 512;

interface RouteStat {
  count: number;
  errors: number; // status >= 500
  clientErrors: number; // status 400–499
  totalMs: number;
  maxMs: number;
  samples: Float64Array; // ring buffer latensi (ms)
  cursor: number;
  filled: number;
}

interface MetricsState {
  routes: Map<string, RouteStat>;
  startedAt: number;
}

function newStat(): RouteStat {
  return {
    count: 0,
    errors: 0,
    clientErrors: 0,
    totalMs: 0,
    maxMs: 0,
    samples: new Float64Array(MAX_SAMPLES),
    cursor: 0,
    filled: 0,
  };
}

/** State global (tahan hot-reload dev). */
function state(): MetricsState {
  const g = globalThis as unknown as { __mbMetrics?: MetricsState };
  if (!g.__mbMetrics) g.__mbMetrics = { routes: new Map(), startedAt: Date.now() };
  return g.__mbMetrics;
}

function key(method: string, route: string): string {
  return `${method.toUpperCase()} ${route}`;
}

/** Catat satu permintaan selesai. */
export function recordRequest(
  method: string,
  route: string,
  status: number,
  durationMs: number,
): void {
  const s = state().routes.get(key(method, route)) ?? newStat();
  s.count += 1;
  s.totalMs += durationMs;
  if (durationMs > s.maxMs) s.maxMs = durationMs;
  if (status >= 500) s.errors += 1;
  else if (status >= 400) s.clientErrors += 1;
  s.samples[s.cursor] = durationMs;
  s.cursor = (s.cursor + 1) % MAX_SAMPLES;
  if (s.filled < MAX_SAMPLES) s.filled += 1;
  state().routes.set(key(method, route), s);
}

/** Persentil dari sampel terisi (0–100). */
function percentile(s: RouteStat, p: number): number {
  if (s.filled === 0) return 0;
  const arr = Array.from(s.samples.slice(0, s.filled)).sort((a, b) => a - b);
  const idx = Math.min(arr.length - 1, Math.max(0, Math.ceil((p / 100) * arr.length) - 1));
  return Math.round(arr[idx] * 100) / 100;
}

export interface RouteMetrics {
  route: string;
  count: number;
  errors: number;
  clientErrors: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

/** Ringkasan semua route. */
export function snapshot(): {
  uptimeSec: number;
  totalRequests: number;
  totalErrors: number;
  routes: RouteMetrics[];
} {
  const s = state();
  let totalRequests = 0;
  let totalErrors = 0;
  const routes: RouteMetrics[] = [];
  for (const [route, st] of s.routes) {
    totalRequests += st.count;
    totalErrors += st.errors;
    routes.push({
      route,
      count: st.count,
      errors: st.errors,
      clientErrors: st.clientErrors,
      avgMs: st.count ? Math.round((st.totalMs / st.count) * 100) / 100 : 0,
      p50Ms: percentile(st, 50),
      p95Ms: percentile(st, 95),
      maxMs: Math.round(st.maxMs * 100) / 100,
    });
  }
  routes.sort((a, b) => b.count - a.count);
  return {
    uptimeSec: Math.round((Date.now() - s.startedAt) / 1000),
    totalRequests,
    totalErrors,
    routes,
  };
}

/** Reset state (untuk uji). */
export function resetMetrics(): void {
  state().routes.clear();
  state().startedAt = Date.now();
}
