# RENCANA — Observabilitas & Operasional (M16)

> **Status:** 🟡 dirancang · **Milestone:** M16 · **Dependensi:** M8 · **Tanggal:** 2026-09-30
> **Rujukan:** `docs/MILESTONE.md` §M16, `docs/OBSERVABILITAS.md`, `docs/BACKUP-RECOVERY.md`, `docs/RENCANA-DEPLOY.md`

---

## 1. Temuan Survei (2026-09-30)

| Item milestone | Kenyataan |
|---|---|
| Health-check `/api/health` | **SUDAH ADA** (`src/app/api/health/route.ts`) — DB + invarian skema, 200/503 |
| Korelasi request-id | **SEBAGIAN** — `route-wrapper.ts` sudah pasang `X-Request-ID` + log error `rid=` |
| Logging terstruktur | ❌ hanya `console.error` (1 tempat), tanpa level/field JSON |
| Telemetri | ❌ tidak ada (`src/lib/telemetry/` belum ada) |
| Backup otomatis | ❌ hanya dokumen (`BACKUP-RECOVERY.md`) |
| CI | ❌ tak ada `.github/workflows` |
| Dockerfile/compose | ❌ tak ada |
| Zero-downtime + rollback | ❌ dokumen saja |
| RUNBOOK / PANDUAN-OPERASIONAL | ❌ belum ada |

## 2. Yang dikerjakan

| # | Item | Rencana teknis |
|---|------|----------------|
| T1 | **Logger terstruktur** | `src/lib/telemetry/logger.ts` — JSON line, level, redaksi rahasia, `requestId`; ganti `console.error` di route-wrapper |
| T2 | **Telemetri ringan** | `src/lib/telemetry/metrics.ts` — hitung in-memory per-route: count, error, latensi p50/p95 (ring buffer); ekspos via `/api/health` / `/api/metrics` |
| T3 | **Health liveness/readiness** | Pisah `/api/health` (liveness, cepat) + `/api/ready` (readiness DB+invarian); pertahankan kontrak lama |
| T4 | **Backup otomatis + uji restore** | `scripts/backup-db.mjs` (pg_dump -Fc, retensi) + `scripts/restore-check.mjs` (restore ke DB uji → `db:verify`) |
| T5 | **CI** | `.github/workflows/ci.yml` — `pnpm check` + `test:db` (service PG) + lint/tsc |
| T6 | **Dockerfile + compose** | multi-stage Next standalone + compose (app + PG pgvector + Caddy/nginx TLS) |
| T7 | **Migrasi zero-downtime + rollback** | Dokumen prosedur + skrip cek kompatibilitas (expand-contract) |
| T8 | **RUNBOOK.md + PANDUAN-OPERASIONAL.md** | Dokumen operasional (deploy, backup/restore, insiden, alerting) |

## 3. Keputusan terkunci (2026-09-30)

- **D1** Kerjakan **semua T1–T8**.
- **D2** Telemetri = **in-memory ring buffer** (nol dependency; single-node),
  diekspos via `/api/metrics` (JSON).
- **D3** **Docker + compose** (app + PG pgvector + Caddy TLS) + **CI** GitHub Actions.

> Prinsip: **"install saat perlu"** — hindari dependency/infra berat tanpa kebutuhan nyata.
