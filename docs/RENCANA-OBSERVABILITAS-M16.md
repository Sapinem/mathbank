# RENCANA — Observabilitas & Operasional (M16)

> **Status:** ✅ **SELESAI** (M16, 2026-09-30) · **Milestone:** M16 · **Dependensi:** M8
> **Rujukan:** `docs/MILESTONE.md` §M16, `docs/OBSERVABILITAS.md`, `docs/BACKUP-RECOVERY.md`, `docs/RENCANA-DEPLOY.md`, `docs/RUNBOOK.md`

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
| RUNBOOK | ❌ belum ada (`PANDUAN-OPERASIONAL.md` = panduan PENGGUNA, milik M17) |

## 2. Yang dikerjakan (semua ✅)

| # | Item | Status | Hasil |
|---|------|:------:|-------|
| T1 | **Logger terstruktur** | ✅ | `src/lib/telemetry/logger.ts` — JSON line, level, redaksi rahasia, `requestId` |
| T2 | **Telemetri ringan** | ✅ | `src/lib/telemetry/metrics.ts` — ring buffer in-memory (count/error/p50/p95/max), ekspos `/api/metrics` |
| T3 | **Health liveness/readiness** | ✅ | `/api/health` (liveness+readiness, kontrak lama) + `?probe=liveness` + `/api/ready` |
| T4 | **Backup + uji restore** | ✅ | `scripts/backup-db.mjs` (pg_dump -Fc, retensi) + `scripts/restore-check.mjs` (uji restore → db:verify) |
| T5 | **CI** | ✅ | `.github/workflows/ci.yml` — PG pgvector service + `pnpm check` + `test:db` |
| T6 | **Dockerfile + compose** | ✅ | multi-stage standalone + compose (app + PG pgvector + Caddy TLS); **opsi, bukan produksi** |
| T7 | **Migrasi zero-downtime** | ✅ | `docs/MIGRASI-ZERO-DOWNTIME.md` — expand→migrate→contract, rollback, uji migrasi |
| T8 | **RUNBOOK.md** | ✅ | `docs/RUNBOOK.md` — operasi harian, deploy, insiden, backup, migrasi, Docker |

## 3. Keputusan terkunci (2026-09-30)

- **D1** Kerjakan **semua T1–T8**.
- **D2** Telemetri = **in-memory ring buffer** (nol dependency; single-node),
  diekspos via `/api/metrics` (JSON).
- **D3** **Docker + compose** (app + PG pgvector + Caddy TLS) + **CI** GitHub Actions.
- **D4** **Produksi tetap systemd** (`mathbank.service`, port 1234). **Docker = opsi
  alternatif** (host/VPS lain) — bukan pengganti produksi saat ini. (Ditegaskan pemilik produk 2026-09-30.)

> Prinsip: **"install saat perlu"** — hindari dependency/infra berat tanpa kebutuhan nyata.

## 4. Verifikasi (bukti nyata)

- `pnpm check` hijau (527 unit, coverage ≥ ambang, build OK).
- **Uji restore nyata**: `pnpm restore:check` → 28 tabel, 26 trigger, HNSW, uuidv7 ✓.
- **Docker build nyata**: image berhasil dibangun; container + PG pgvector dijalankan →
  `/api/health` 200 (`invariants.ok:true`), `/api/ready` 200 (`status:"ready"`), `/login` 200.
