# Audit — M16 Observabilitas & Operasional

> **Milestone:** M16 · **Tanggal:** 2026-09-30 · **Status:** ✅ selesai
> **Rujukan:** `docs/RENCANA-OBSERVABILITAS-M16.md`, `docs/MILESTONE.md` §M16,
> `docs/OBSERVABILITAS.md`, `docs/RUNBOOK.md`, `docs/MIGRASI-ZERO-DOWNTIME.md`

---

## 1. Ruang Lingkup

Menutup utang observabilitas & operasional fase 3 (T1–T8): logging terstruktur,
telemetri, health/readiness, backup + uji restore, CI, Docker (opsi), prosedur
migrasi zero-downtime, dan runbook operasional.

## 2. Yang Dibangun

| # | Item | Artefak |
|---|------|---------|
| T1 | Logger terstruktur | `src/lib/telemetry/logger.ts` (+test) |
| T2 | Telemetri ring buffer | `src/lib/telemetry/metrics.ts` (+test) |
| T3 | Health/readiness | `src/app/api/health/route.ts`, `ready/route.ts`, `metrics/route.ts`, `src/lib/api/route-wrapper.ts` |
| T4 | Backup + uji restore | `scripts/backup-db.mjs`, `scripts/restore-check.mjs` |
| T5 | CI | `.github/workflows/ci.yml` |
| T6 | Docker (opsi) | `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.env.docker.example`, `.dockerignore` |
| T7 | Migrasi zero-downtime | `docs/MIGRASI-ZERO-DOWNTIME.md` |
| T8 | Runbook | `docs/RUNBOOK.md` |

**Pendukung:** penjaga penamaan `scripts/check-names.mjs` (`pnpm lint:names`),
kalibrasi pemindai rahasia + tes regresi, `next.config.ts` (standalone kondisional),
`package.json` (`engines`).

## 3. Keputusan Terkunci

- **D1** Kerjakan semua T1–T8.
- **D2** Telemetri = ring buffer in-memory (nol dependency), ekspos `/api/metrics`.
- **D3** Docker + compose + CI GitHub Actions.
- **D4** **Produksi tetap systemd** (`mathbank.service`, port 1234); **Docker = opsi
  alternatif** (ditegaskan pemilik produk 2026-09-30).

## 4. § Catatan Verifikasi

Setiap klaim diverifikasi ke **jalur nyata** (tidak cukup "sekadar ada"):

1. **Uji restore nyata** ✅ — `pnpm backup:db` menghasilkan arsip (116 KB), lalu
   `pnpm restore:check` memulihkan ke DB sementara dan menjalankan `db:verify`:
   **28 tabel, 2 CHECK, 1 HNSW, 26 trigger, PK `uuidv7()`** — hijau. DB sementara
   dibersihkan otomatis.
2. **Docker terbukti end-to-end** ✅ — `docker build` sukses; container dijalankan
   bersama PostgreSQL `pgvector:pg18`; setelah migrasi, `/api/health` → **200**
   (`invariants.ok:true`), `/api/ready` → **200** (`status:"ready"`), `/login` → **200**.
   Sebelum migrasi, invarian **terdeteksi hilang** (guard bekerja, bukan no-op).
3. **Gate mutu** ✅ — `pnpm check`: **531 unit pass**, coverage 92.74/83.95/91.58/94.84,
   tsc 0, lint 0, build OK; `lint:names` hijau; secret-scan bersih (**493 berkas**).
4. **Pemindai rahasia tetap menangkap rahasia NYATA** ✅ — diuji dengan password
   acak (`Xk9mP2vQ8nL4wR7t`), kunci `sk-or-v1-…`, dan penugasan acak → **terdeteksi**;
   placeholder CI/dummy/template → **diabaikan** (tes regresi `secret-scan.test.ts`, 4 lulus).
5. **Penamaan** ✅ — `scripts/check-names.mjs` memverifikasi semua nama file/folder/route
   berbahasa INGGRIS; dijalankan di `pnpm check`.
6. **Produksi tidak terganggu** ✅ — `NEXT_OUTPUT_STANDALONE` tidak diset di produksi →
   build biasa; service aktif, `/api/health` 200 setelah tiap perubahan.

**Keterbatasan (jujur):**
- CI (`.github/workflows/ci.yml`) **belum pernah dijalankan di GitHub** (repo tanpa
  remote). Validitas YAML & langkah dipastikan lewat perintah yang sama dijalankan
  lokal; runner GitHub perlu diuji saat repo di-push.
- Docker **bukan** jalur produksi — hanya diuji sekali secara lokal; belum dipakai
  operasional harian.
- Alerting otomatis & tracing terdistribusi **belum** dibuat (dicatat sebagai utang
  di `OBSERVABILITAS.md` §6/§7).

## 5. Utang Tersisa

- Alerting otomatis (probe eksternal → `/api/ready`).
- Uji CI di GitHub saat repo punya remote.
- (M13) S4 verifikasi email, Redis, 2FA; (M9) halaman Ingest UI.

## 6. Rujukan Commit

- `b1dea3c` — logger terstruktur + telemetri + readiness probe.
- `160a78a` — penamaan wajib INGGRIS (CONSTRAINTS #28b) + `check-names`.
- `56a6f94` — CI + Docker + migrasi zero-downtime + runbook + kalibrasi scanner.
