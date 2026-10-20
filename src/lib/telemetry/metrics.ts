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

/**
 * **ACT-03 (P0):** batas jumlah label route yang disimpan.
 *
 * Tanpa batas, setiap ID dinamis (`/api/questions/<uuid>`) menjadi label baru →
 * map tumbuh tanpa henti (memory leak) dan `/api/metrics` jadi tak terbaca.
 * Normalisasi path + batas ini menjaga ukuran state tetap terbatas.
 */
export const MAX_ROUTES = 200;

/** Panjang maksimum label (jaga-jaga terhadap path aneh dari klien). */
const MAX_ROUTE_LABEL_LEN = 160;

interface RouteStat {
  count: number;
  errors: number; // status >= 500
  clientErrors: number; // status 400–499
  totalMs: number;
  maxMs: number;
  samples: Float64Array; // ring buffer latensi (ms)
  cursor: number;
  filled: number;
  lastSeen: number; // ms epoch — dasar eviksi LRU saat melewati MAX_ROUTES
}

interface MetricsState {
  routes: Map<string, RouteStat>;
  startedAt: number;
  evicted: number; // jumlah label yang dibuang karena batas (observabilitas)
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
    lastSeen: Date.now(),
  };
}

/** State global (tahan hot-reload dev). */
function state(): MetricsState {
  const g = globalThis as unknown as { __mbMetrics?: MetricsState };
  if (!g.__mbMetrics) {
    g.__mbMetrics = { routes: new Map(), startedAt: Date.now(), evicted: 0 };
  }
  return g.__mbMetrics;
}

// ── Normalisasi label rute (ACT-03 A) ────────────────────────────────────────
// Segmen dinamis diganti `:id` agar 100 request dengan UUID berbeda hanya
// menghasilkan SATU label. Aturan sengaja konservatif: hanya segmen yang
// benar-benar berbentuk identitas (UUID/ULID/numerik/hex/cuid/opaque token).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const CUID_RE = /^c[a-z0-9]{20,}$/i;
const HEX_RE = /^[0-9a-f]{16,}$/i;
const NUMERIC_RE = /^\d+$/;
/** Token opaque panjang (slug acak, base64url id) — wajib memuat digit. */
const OPAQUE_RE = /^[A-Za-z0-9_-]{24,}$/;

/** Apakah segmen path adalah identitas dinamis (bukan nama rute statis)? */
export function isDynamicSegment(segment: string): boolean {
  if (!segment) return false;
  if (UUID_RE.test(segment)) return true;
  if (ULID_RE.test(segment)) return true;
  if (CUID_RE.test(segment)) return true;
  if (HEX_RE.test(segment)) return true;
  if (NUMERIC_RE.test(segment)) return true;
  if (OPAQUE_RE.test(segment) && /\d/.test(segment)) return true;
  return false;
}

/**
 * Normalisasi path rute → label metrik stabil.
 *
 * `/api/questions/3f2b…-…/status` → `/api/questions/:id/status`
 * `/api/bundles/42` → `/api/bundles/:id`
 * Trailing slash dibuang; query string tidak pernah ikut (pathname saja).
 */
export function normalizeRoutePath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? "";
  const segments = withoutQuery.split("/");
  const normalized = segments
    .map((seg) => (isDynamicSegment(seg) ? ":id" : seg))
    .join("/");
  const trimmed = normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
  return trimmed.slice(0, MAX_ROUTE_LABEL_LEN) || "/";
}

function key(method: string, route: string): string {
  return `${method.toUpperCase()} ${route}`;
}

/**
 * Buang label terbanyak-menganggur saat melewati MAX_ROUTES.
 * Urutan eviksi: hitungan terkecil dulu, lalu yang paling lama tak terlihat —
 * route sibuk (yang justru kita pantau) bertahan.
 */
function pruneRoutes(): void {
  const s = state();
  if (s.routes.size <= MAX_ROUTES) return;
  const excess = s.routes.size - MAX_ROUTES;
  const victims = [...s.routes.entries()]
    .sort((a, b) => a[1].count - b[1].count || a[1].lastSeen - b[1].lastSeen)
    .slice(0, excess);
  for (const [k] of victims) s.routes.delete(k);
  s.evicted += victims.length;
}

/** Catat satu permintaan selesai. */
export function recordRequest(
  method: string,
  route: string,
  status: number,
  durationMs: number,
): void {
  // Normalisasi di sini juga (bukan hanya di route-wrapper) agar pemanggil lain
  // tak bisa menciptakan label liar dan merusak batas MAX_ROUTES.
  const label = normalizeRoutePath(route);
  const k = key(method, label);
  const s = state().routes.get(k) ?? newStat();
  s.count += 1;
  s.totalMs += durationMs;
  s.lastSeen = Date.now();
  if (durationMs > s.maxMs) s.maxMs = durationMs;
  if (status >= 500) s.errors += 1;
  else if (status >= 400) s.clientErrors += 1;
  s.samples[s.cursor] = durationMs;
  s.cursor = (s.cursor + 1) % MAX_SAMPLES;
  if (s.filled < MAX_SAMPLES) s.filled += 1;
  state().routes.set(k, s);
  pruneRoutes();
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
  routeCount: number;
  evictedLabels: number;
  maxRoutes: number;
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
    routeCount: s.routes.size,
    evictedLabels: s.evicted,
    maxRoutes: MAX_ROUTES,
    routes,
  };
}

/** Reset state (untuk uji). */
export function resetMetrics(): void {
  state().routes.clear();
  state().startedAt = Date.now();
  state().evicted = 0;
}

/** Jumlah label aktif (untuk uji/pemantauan batas memori). */
export function routeCount(): number {
  return state().routes.size;
}
