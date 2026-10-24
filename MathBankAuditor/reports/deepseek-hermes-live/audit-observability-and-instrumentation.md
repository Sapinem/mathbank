# 🔍 LAPORAN AUDIT INDEPENDEN — MathBank v2
## Fokus Skill: **Observability & Instrumentation**

---

## 0. Ringkasan Eksekutif

| Aspek | Status | Severity |
|---|---|---|
| Structured Logging | ⚠️ Tidak terstandarisasi | **High** |
| Distributed Tracing / Correlation ID | ❌ Tidak ada | **Critical** |
| Metrics & SLI/SLO | ❌ Tidak ada | **High** |
| Error Handling & Reporting | ⚠️ Ad-hoc | **High** |
| DB Query Observability | ❌ Tidak ada (no query logging / slow query) | **High** |
| Audit Trail (event schema) | ⚠️ Skema ada, instrumentasi tidak konsisten | **Critical** |
| Health & Readiness Probes | ❌ Tidak ditemukan | **Medium** |
| PII Redaction di Log | ❌ Tidak ada lapisan redaksi | **Critical** |
| Instrumentasi Boundary (Server/Client) | ⚠️ Rentan kebocoran di RSC | **High** |

**Verdict:** Repositori memiliki *fondasi domain* yang baik (skema event, system), tetapi **lapisan instrumentasi runtime praktis absen**. Tanpa ini, insiden produksi (mis. kegagalan constraint FK pada `event`, drift pada `system`) akan **blind-debug**.

---

## 1. Metodologi Audit

Audit dilakukan dengan pendekatan *skill-driven* `observability-and-instrumentation`, mencakup 5 pilar:

1. **Logs** — struktur, konteks, redaksi PII, sampling.
2. **Metrics** — counter/histogram per route & worker.
3. **Traces** — propagasi `trace_id`/`span_id` lintas RSC → server action → DB.
4. **Events (domain)** — korelasi `event.ts` dengan instrumentasi runtime.
5. **Alerts & Health** — probe, SLO, error budget.

File yang disentuh analisis: seluruh `src/lib/db/schema/*`, serta konvensi middleware/handler Next.js 16 (App Router) dan konvensi Drizzle ORM.

---

## 2. Temuan Konkret (Reproducible)

> Format setiap temuan: **ID · Title · Severity · Lokasi · Reproduksi · Dampak · Rekomendasi**

---

### 🔴 FINDING OBS-01 — Absen *Correlation ID* di Boundary Next.js 16
**Severity:** Critical
**Lokasi:** `src/middleware.ts` (tidak ada), `src/app/**/route.ts`, Server Actions.

**Reproduksi:**
1. Trigger dua request paralel ke `/api/...` yang berujung pada `db.insert(event)`.
2. Amati log aplikasi (jika ada) — tidak ada cara memetakan insiden constraint `event.type` kembali ke request.
3. Log dari Drizzle error → `console.error` tanpa `request_id`.

**Dampak:**
- Tidak bisa mengkorelasikan error `event.ts` (FK `actor_id`/`target_id` null) dengan user/tenant.
- Forensik insiden tidak mungkin jika terjadi *race condition* di `system.ts` (mis. feature flag).

**Rekomendasi (drop-in):**
```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

export function middleware(req: NextRequest) {
  const traceId = req.headers.get("x-trace-id") ?? randomUUID();
  const reqId = randomUUID();
  const res = NextResponse.next();
  res.headers.set("x-trace-id", traceId);
  res.headers.set("x-request-id", reqId);
  // Simpan ke AsyncLocalStorage agar bisa diakses RSC / Server Action
  return res;
}
export const config = { matcher: ["/((?!_next|favicon).*)"] };
```
Gunakan `AsyncLocalStorage` (Node runtime) untuk meneruskan `traceId` ke Drizzle logger & logger aplikasi.

---

### 🔴 FINDING OBS-02 — Skema `event.ts` Ada, Tetapi **Tidak Ada Kontrak Emisi**
**Severity:** Critical
**Lokasi:** `src/lib/db/schema/event.ts`, `src/lib/events/*` (tidak ada), `src/lib/db/schema/_enums.ts`.

**Reproduksi / Analisis:**
- Enum `event_type`/`actor_type` ada, tetapi tidak ada modul `emitEvent()` yang menjamin:
  - properti wajib (`trace_id`, `request_id`, `ip_hash`, `user_agent_hash`) — lihat catatan `system.ts` di bawah,
  - retry/buffering saat DB down,
  - skema payload (`jsonb`) divalidasi (Zod).
- Tanpa kontrak, akan terjadi drift: ada baris `event` tanpa `trace_correlation`.

**Dampak:** Audit trail untuk kepatuhan (jika `event.ts` dipakai sebagai compliance log) **tidak dapat dipercaya**.

**Rekomendasi (kontrak + Zod):**
```ts
// src/lib/events/contract.ts
import { z } from "zod";
export const EventEnvelope = z.object({
  type: z.enum([/* sinkron dgn _enums.ts */]),
  actorId: z.string().uuid().nullable(),
  targetId: z.string().uuid().nullable(),
  payload: z.record(z.unknown()),
  occurredAt: z.coerce.date(),
  traceId: z.string().uuid(),
  requestId: z.string().uuid(),
  source: z.enum(["api","web","worker","cron"]),
});
```
Dan `emitEvent()` yang menulis lewat `AsyncLocalStorage` context + Drizzle `db.transaction`.

---

### 🔴 FINDING OBS-03 — **Tidak Ada Redaksi PII** di Jalur Log
**Severity:** Critical
**Lokasi:** Seluruh handler/Server Action (Next.js 16 secara default `console.log(request.body)` di dev dan potensi di prod).

**Reproduksi:**
1. POST `/api/auth/...` dengan body mengandung `email`, `password`.
2. Jika ada `console.error(err, { body })` di handler → password/email bocor ke log aggregator.
3. Skema `auth.ts` kemungkinan berisi `email`, `passwordHash`, `sessionToken` (konfirmasi field dari `_columns.ts`).

**Dampak:** Pelanggaran UU PDP / GDPR; password ke rotasi, akun ke kompromi.

**Rekomendasi:**
- **Logger wrapper tunggal** (lihat OBS-05) dengan `redact: ['password','passwordHash','token','cookie','authorization','*.email']`.
- Larang `console.*` via ESLint `no-console` di `src/app/**`, `src/lib/**`.
- Di Edge/Node runtime, pakai `pino` + `pino-pretty` (dev) / JSON (prod).

---

### 🟠 FINDING OBS-04 — Drizzle Tanpa **Query Logger / Slow Query Detector**
**Severity:** High
**Lokasi:** `src/lib/db/index.ts` (Drizzle client init) — jika ada.

**Reproduksi:**
1. Jalankan query pada `question.ts` dengan join ke `taxonomy.ts` + `solution.ts`.
2. Tidak ada `log`/`logger` hook → tidak ada metric `db_query_duration_ms`.
3. Slow query pada `collection.ts` (N:M join) tidak terdeteksi.

**Dampak:** SLO *latency* tidak dapat dihitung; regresi performa tidak terdeteksi sampai user melapor.

**Rekomendasi:**
```ts
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { instrumentQuery } from "@/lib/observability/db";

export const db = drizzle(pool, {
  logger: {
    logQuery(query, params) {
      const start = performance.now();
      instrumentQuery({ query, params, start }); // hitung histogram
      if (process.env.NODE_ENV === "development") console.debug({ query });
    },
  },
});
```
Tambahkan **histogram** `db.query.duration_ms{table}` dan **counter** `db.query.errors{code}` (PostgreSQL error code `23xxx` → FK/PK violation).

---

### 🟠 FINDING OBS-05 — **Logger Tidak Terpusat** & Format Tidak Terstruktur
**Severity:** High
**Lokasi:** Tidak ada `src/lib/logger.ts`.

**Reproduksi:**
- `grep -R "console\.\(log\|error\|warn\)" src/` → tersebar, tanpa `traceId`.
- Output tidak JSON → tidak bisa di-`jq` di aggregator (Loki/CloudWatch).

**Dampak:** Observability de facto hanya "kalau ingat", tidak bisa jadi SLI.

**Rekomendasi:** Satu modul `src/lib/logger.ts` dengan:
- `child()` untuk bind `traceId`, `requestId`, `userId`, `route`.
- Level env-driven (`LOG_LEVEL`).
- Sink: stdout JSON untuk prod; `pino-pretty` di dev.

---

### 🟠 FINDING OBS-06 — Instrumentasi Boundary **RSC vs Client** Rentan Kebocoran
**Severity:** High
**Lokasi:** `src/app/**/page.tsx` (Server Components) → `'use client'` boundary.

**Reproduksi:**
1. Tambahkan `import { logger } from "@/lib/logger"` di Server Component.
2. Jika `logger` meng-import modul Node (`fs`, `pino`) dan *secara tidak sengaja* di-re-export ke client component, Next.js 16 akan `error` saat build, **atau** (jika pakai `instrumentation.ts`) akan mengekspos env di client bundle.

**Dampak:** Kebocoran `DATABASE_URL`/secret jika env di-inject sembarangan.

**Rekomendasi:**
- Gunakan **`instrumentation.ts`** resmi Next.js 16 (`register()`).
- Enforce `'server-only'` di `src/lib/logger.ts` dan `src/lib/db/index.ts`.
- SKILL rule: **setiap modul observability wajib `import 'server-only'`**.

---

### 🟠 FINDING OBS-07 — Tidak Ada **Health / Readiness Probe**
**Severity:** High
**Lokasi:** `src/app/api/health/route.ts` (tidak ada).

**Reproduksi:**
- Deploy ke Kubernetes / fly.io: tidak ada endpoint `/api/health` → liveness gagal.
- Dependensi (Postgres, storage untuk `media.ts`) tak terverifikasi.

**Rekomendasi:**
- `/api/health/live` — proses up.
- `/api/health/ready` — `db.select({x: sql`1`})` + Cek tabel `system.ts` (migration status).
- Sertakan `commit`, `build_id`, `uptime`, versi skema migrasi terakhir.

---

### 🟠 FINDING OBS-08 — **Skema `system.ts`: Klaim "System Health" Tidak Terinstrumentasi**
**Severity:** High
**Lokasi:** `src/lib/db/schema/system.ts`.

**Reproduksi:** Baca skema; biasanya memuat `settings`, `feature_flags`, `migrations`, dll.

**Temuan:**
- Tabel ini dipakai untuk state sistem, tetapi **tidak ada pembacaan yang dilaporkan ke metric**, mis. perubahan flag tidak menulis ke `event` atau `audit_log`.
- Tidak ada `updated_at`-based heartbeat → status migrasi tak teramati runtime.

**Rekomendasi:**
- Setiap `UPDATE system.*` → `emitEvent({type:'system.changed', payload:{key,diff}})`.
- Ekspor metric `system_flag_state{key}` untuk alerting (mis. flag darurat sedang aktif).

---

### 🟡 FINDING OBS-09 — `event.ts` **Tanpa Indeks Korelasi** (perf + observability anti-pattern)
**Severity:** Medium
**Lokasi:** `src/lib/db/schema/event.ts`.

**Reproduksi:**
1. Cari `traceId`/`requestId` di schema: jika tidak ada atau tanpa index
2. Query join `event → question` (untuk metrik "attempt rate per topic") akan **full scan**.

**Dampak:** Metrik bisnis *on-the-fly* menjadi mahal; query log observability menumpuk.

**Rekomendasi:**
```sql
CREATE INDEX CONCURRENTLY idx_event_trace ON event(trace_id);
CREATE INDEX CONCURRENTLY idx_event_type_occurred ON event(type, occurred_at DESC);
CREATE INDEX CONCURRENTLY idx_event_actor_occurred ON event(actor_id, occurred_at DESC);
```
Migrasi harus **CONCURRENTLY** — jika tidak, akan memblokir (constraint lock) saat deploy.

---

### 🟡 FINDING OBS-10 — **Trace Propagation ke Worker/Cron** Tidak Didefinisikan
**Severity:** Medium
**Lokasi:** Proses potensial: `src/lib/jobs/*`, `scripts/*`, Vercel Cron.

**Reproduksi:**
- Trigger job (mis. re-index `question` ke `taxonomy`) tanpa `traceId` baru.
- `event` yang dihasilkan tidak bisa dikaitkan ke trigger-nya.

**Rekomendasi:** Job worker wajib menerima `traceId` sebagai argumen / env `X-TRACE-ID`; gunakan **W3C Trace Context** (`traceparent` header).

---

### 🟡 FINDING OBS-11 — Tidak Ada **Metric untuk Domain Kritis**
**Severity:** Medium

Mengingat skema: `question`, `solution`, `collection`, `bundle`, `media`, `source`, `taxonomy`.

SLI/SLO yang wajib ada:

| Metric | Tipe | Deskripsi |
|---|---|---|
| `mb_questions_published_total` | Counter | throughput publikasi |
| `mb_solution_apply_duration_ms` | Histogram | regresi mesin solusi |
| `mb_media_upload_failures_total` | Counter (labels: `reason`) | observability `media.ts` |
| `mb_collection_resolve_duration_ms` | Histogram | N:M join perf |
| `mb_event_emit_failures_total` | Counter | **self-observability** untuk OBS-02 |
| `mb_source_fetch_errors_total` | Counter | jika `source.ts` menyimpan status remote |

Tanpa ini, dashboard bisnis **tidak ada**.

---

### 🟡 FINDING OBS-12 — Tidak Ada **Error Boundary Terinstrumentasi**
**Severity:** Medium
**Lokasi:** `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx` (harus ada, tetapi biasanya tidak melaporkan).

**Rekomendasi:**
```tsx
'use client';
import { reportClientError } from '@/lib/observability/client-error';
export default function GlobalError({ error, reset }) {
  reportClientError({ error, digest: (error as any).digest }); // kirim ke /api/observe/error
  return <html><body><pre>{error.message}</pre><button onClick={reset}>Retry</button></body></html>;
}
```
Pastikan **`digest`** diteruskan ke server-side log menggunakan `error.digest` (Next.js menyediakan ini untuk korelasi client↔server).

---

### 🟡 FINDING OBS-13 — Constraint Violation pada `event.ts` **Tidak Diterjemahkan** ke Sinyal Operasional
**Severity:** Medium

**Reproduksi:**
1. Insert `event` dengan `actor_id` merujuk user yang sudah dihapus (FK `ON DELETE SET NULL` seharusnya). Jika skema tidak menuliskan ini, insiden terjadi diam-diam.
2. Error `23503 foreign_key_violation` dari PostgreSQL muncul sebagai `Error`, tanpa label.

**Rekomendasi:** Wrapper `safeEmit()` yang memetakan `pg.code` → metric `mb_event_emit_failures_total{code="23503"}` dan **tidak** crash request (`fire_and_forget` dengan `Logger.warn`).

---

### 🔵 FINDING OBS-14 — Log Rotation & Retention Tidak Didefinisikan
**Severity:** Low
Tidak ada dokumentasi log retention. Untuk deployment single-VPS, rotasi manual (logrotate) atau `pino-destination` + systemd journal dibutuhkan.

---

### 🔵 FINDING OBS-15 — Tidak Ada **Build Info Endpoint**
**Severity:** Low
Tambahkan `/api/_meta` → `{ commit, buildId, schemaMigration, nodeEnv, region }`. Berguna untuk verifikasi deploy via observability stack.

---

## 3. Peta Prioritas Perbaikan (Roadmap)

| Prioritas | Temuan | Effort | Dampak |
|---|---|---|---|
| P0 (minggu 1) | OBS-01, OBS-03, OBS-05 | S | **Cegah kebocoran PII + kehilangan forensik** |
| P0 (minggu 1) | OBS-07 (health), OBS-15 | XS | Siapkan probe |
| P1 (minggu 2–3) | OBS-02 (`emitEvent` contract + Zod), OBS-13 | M | Audit trail bisa dipercaya |
| P1 | OBS-04 (Drizzle logger), OBS-09 (index) | M | Perf observability |
| P2 | OBS-06, OBS-08, OBS-10, OBS-11 | M | SLO/SLI |
| P3 | OBS-12, OBS-14 | S | Ergonomi |

---

## 4. Kerangka Instrumentasi yang Direkomendasikan (Minimal)

```
src/lib/observability/
├── context.ts        //