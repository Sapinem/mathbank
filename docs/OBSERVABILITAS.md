# OBSERVABILITAS.md — Logging, Metrik & Kesehatan

> **Status:** ✅ **TERIMPLEMENTASI (M16, 2026-09-30).**
> `src/lib/telemetry/logger.ts` (log JSON + redaksi), `metrics.ts` (ring buffer
> in-memory), `/api/health` (liveness+readiness), `/api/ready`, `/api/metrics`.
> **Sifat:** dokumen hidup — perbarui saat fitur berubah.

---

## 1. Tiga Pilar

| Pilar | Pertanyaan | Kondisi kini |
|-------|-----------|--------------|
| **Logs** | Apa yang terjadi? | ✅ `log()` JSON-level (`src/lib/telemetry/logger.ts`) + redaksi rahasia |
| **Metrics** | Seberapa cepat/banyak? | ✅ ring buffer in-memory per route (`/api/metrics`) |
| **Traces** | Di mana lambat? | ❌ belum (single-node; p50/p95/max per route cukup) |

---

## 2. Logging

**Log terstruktur JSON** satu baris (bukan `console.log` bebas), field konsisten:

```json
{ "level": "error", "time": "2026-09-30T…", "route": "/api/questions",
  "requestId": "…", "actorId": "…", "code": "NOT_READY", "message": "…" }
```

**Aturan:**
- **Jangan pernah** log rahasia: `BETTER_AUTH_SECRET`, password, `answer_key`, API key
  — modul `logger.ts` **meredaksi** kunci sensitif otomatis (nilai → `[REDACTED]`).
- Setiap error API punya `code` (`KONTRAK-API.md`) → dipakai sebagai field `code`.
- Level: `debug` · `info` · `warn` · `error` (diatur env `LOG_LEVEL`; default `info`).
- warn/error → **stderr**; sisanya stdout (mudah difilter di journald).
- Saat tes, log **dibungkam** (kecuali `LOG_LEVEL` dipaksa) agar output tes bersih.
- Modul: `src/lib/telemetry/logger.ts`.

---

## 3. Health Check

| Endpoint | Fungsi | 200 | 503 |
|---|---|---|---|
| `GET /api/health` | liveness **+** readiness (DB + invarian) | sehat | DB turun / invarian hilang |
| `GET /api/health?probe=liveness` | liveness **murni** (tanpa DB) | proses hidup | — |
| `GET /api/ready` | readiness eksplisit (DB + invarian) | `status:"ready"` | `status:"not_ready"` |

Invarian yang diperiksa: 28 tabel, 2 CHECK, 1 HNSW, 26 trigger, PK `uuidv7()`.
Lihat `src/lib/db/invariants.ts` + `src/app/api/health/route.ts`.

---

## 4. Metrik

`GET /api/metrics` → JSON (count/error/p50/p95/max, per `METHOD route`), uptime,
total request. **In-memory ring buffer** (fixed-size, **nol dependency**) — cukup
untuk single-node; reset saat proses restart. Dilindungi `METRICS_TOKEN`
(bila kosong → nonaktif di produksi). Modul: `src/lib/telemetry/metrics.ts`.

---

## 5. Audit & Jejak

- Tabel **`audit_logs`** (skema v2) mencatat perubahan penting (siapa, apa, kapan) — **jejak aplikatif**, bukan pengganti log sistem.
- Log request API (route, requestId, actorId, status, durasi) via `route-wrapper.ts`.

---

## 6. Alerting (belum — usulan)

| Kondisi | Aksi |
|---------|------|
| `/api/health` readiness gagal | notifikasi (cron probe / uptime monitor) |
| Tingkat 5xx melonjak (dari `/api/metrics`) | notifikasi |
| Backup gagal (`BACKUP-RECOVERY.md`) | notifikasi |
| Disk/DB mendekati penuh | notifikasi |

> Belum diotomasi (single-node). Cukup probe eksternal → `/api/ready`.

---

## 7. Yang Belum Ada (utang)

- [ ] Alerting otomatis
- [ ] Tracing terdistribusi (tak perlu untuk single-node saat ini)
- [x] Log terstruktur (JSON) + level — **M16**
- [x] `/api/health` (liveness + readiness) + `/api/ready` — **M16**
- [x] Metrik per route (`/api/metrics`) — **M16**
- [x] Korelasi request (request-id) — **M16**

---

## 8. Rujukan

- Envelope & kode error: `KONTRAK-API.md`
- Operasi harian: `RUNBOOK.md`
- Deploy: `RENCANA-DEPLOY.md`
- Backup: `BACKUP-RECOVERY.md`
- Keamanan (jangan log rahasia): `KEAMANAN.md`
- Rencana M16: `RENCANA-OBSERVABILITAS-M16.md`
