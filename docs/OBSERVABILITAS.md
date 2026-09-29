# OBSERVABILITAS.md — Logging, Metrik & Kesehatan

> **Status:** 📝 rencana (belum ada infrastruktur observabilitas per 2026-09-29).
> **Sifat:** dokumen hidup — perbarui saat fitur nyata dibuat.
> **Prinsip:** **"install saat perlu"** — mulai dari log terstruktur + health check saat mendekati produksi.

---

## 1. Tiga Pilar

| Pilar | Pertanyaan | Kondisi kini |
|-------|-----------|--------------|
| **Logs** | Apa yang terjadi? | `console.error` di `route-wrapper.ts` (minimal) |
| **Metrics** | Seberapa cepat/banyak? | ❌ belum ada |
| **Traces** | Di mana lambat? | ❌ belum ada |

---

## 2. Logging (rencana)

**Target:** log **terstruktur JSON** (bukan `console.log` bebas) dengan field konsisten:

```json
{ "level": "error", "time": "...", "route": "/api/questions",
  "actorId": "...", "code": "NOT_READY", "message": "..." }
```

**Aturan:**
- **Jangan pernah** log rahasia: `BETTER_AUTH_SECRET`, password, `answer_key`, API key.
- Setiap error API sudah punya `code` (lihat `KONTRAK-API.md`) → pakai itu sebagai field.
- Level: `debug` · `info` · `warn` · `error`.
- Modul rencana: `src/lib/telemetry/` (saat ini kosong — diisi saat M9+).

---

## 3. Health Check (rencana, prioritas)

Endpoint `/api/health` (belum ada) yang memeriksa:
- **liveness** — proses hidup (selalu 200).
- **readiness** — DB bisa dijangkau (`SELECT 1`) + `db:verify` cepat.

```json
{ "status": "ok", "db": "ok", "version": "<git-sha>" }
```

Berguna untuk load balancer & monitoring.

---

## 4. Metrik (rencana)

| Metrik | Kenapa |
|--------|--------|
| Latensi per route (p50/p95) | deteksi lambat |
| Tingkat error per kode | pantau 4xx/5xx |
| Koneksi pool DB | cegah kehabisan |
| Ukuran tabel `questions` | pertumbuhan data |

Perkakas: Prometheus + Grafana, atau layanan terkelola. **Belum diputuskan.**

---

## 5. Audit & Jejak (sudah ada sebagian)

- Tabel **`audit_logs`** (skema v2) mencatat perubahan penting (siapa, apa, kapan) — **jejak aplikatif**, bukan pengganti log sistem.

---

## 6. Alerting (rencana)

| Kondisi | Aksi |
|---------|------|
| `/api/health` readiness gagal | notifikasi |
| Tingkat 5xx melonjak | notifikasi |
| Backup gagal (`BACKUP-RECOVERY.md`) | notifikasi |
| Disk/DB mendekati penuh | notifikasi |

---

## 7. Yang Belum Ada (utang)

- [ ] Log terstruktur (JSON) + level
- [ ] `/api/health` (liveness + readiness)
- [ ] Metrik + dashboard
- [ ] Alerting
- [ ] Korelasi request (request-id)

---

## 8. Rujukan

- Envelope & kode error: `KONTRAK-API.md`
- Deploy: `RENCANA-DEPLOY.md`
- Backup: `BACKUP-RECOVERY.md`
- Keamanan (jangan log rahasia): `KEAMANAN.md`
