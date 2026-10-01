# RUNBOOK.md — Operasi MathBank (M16)

> **Untuk siapa:** operator/administrator yang menjalankan MathBank.
> **Produksi saat ini:** **systemd user `mathbank.service`** (port **1234**),
> domain `https://b.iyo.my.id`. **Docker = opsi alternatif** (lihat §9).

---

## 1. Ringkasan cepat

| Hal | Nilai |
|---|---|
| Aplikasi | Next.js 16 (App Router), Node ≥ 20 |
| Database | PostgreSQL 18 + `pgvector`, `pg_trgm`, `pgcrypto` |
| Produksi | `systemctl --user` unit `mathbank.service`, port **1234** |
| Domain | `https://b.iyo.my.id` (reverse-proxy TLS) |
| Gate mutu | `pnpm check` (theme→penamaan→tsc→lint→coverage→build) + `pnpm test:db` |
| Health | `GET /api/health` (dengan DB) · `?probe=liveness` (tanpa DB) |
| Readiness | `GET /api/ready` (DB + invarian skema) |
| Metrik | `GET /api/metrics` (token `METRICS_TOKEN`; nonaktif di prod bila kosong) |

---

## 2. Perintah sehari-hari

```bash
# Status & kesehatan
systemctl --user status mathbank.service
curl -s localhost:1234/api/health | jq        # 200 = sehat, 503 = ada masalah
curl -s localhost:1234/api/ready  | jq        # readiness (DB + invarian)
journalctl --user -u mathbank.service -f      # log live (JSON terstruktur)

# Restart
systemctl --user restart mathbank.service
```

---

## 3. Deploy rilis baru (produksi systemd)

> **PENTING (pelajaran berulang):** JANGAN `pnpm build`/`pnpm check` **saat
> service jalan** — build menimpa `.next` → CSS/aset 500 → halaman tampil tanpa
> gaya. Urutan benar:

```bash
cd ~/projects/mathbank
systemctl --user stop mathbank.service        # 1. hentikan dulu
git pull                                       # 2. ambil kode baru
pnpm install --frozen-lockfile                 # 3. dependensi
pnpm db:migrate                                # 4. migrasi (lihat §5)
rm -rf .next && pnpm build                     # 5. build bersih
systemctl --user start mathbank.service        # 6. nyalakan
curl -s localhost:1234/api/health | jq         # 7. verifikasi 200
```

**Rollback cepat:** `git checkout <commit-sebelumnya>` → ulangi langkah 4–7
(migrasi DB bersifat *forward-only*; lihat §5 & `BACKUP-RECOVERY.md`).

---

## 4. Backup & restore

```bash
pnpm backup:db                 # → ./backups/mathbank_<stamp>.dump (retensi 7)
BACKUP_DIR=/var/backups/mathbank BACKUP_KEEP=14 pnpm backup:db
pnpm restore:check             # uji restore arsip TERBARU → verifikasi skema
pnpm restore:check backups/mathbank_2026-09-30-23-50-00.dump

# Terjadwal (cron harian 02:00):
# 0 2 * * * cd /home/hari/projects/mathbank && pnpm backup:db >> /var/log/mathbank-backup.log 2>&1
```

Prinsip: **backup yang belum diuji-restore = bukan backup.** `restore:check`
memulihkan ke DB sementara, menjalankan `db:verify`, lalu membersihkannya.

---

## 5. Migrasi skema (zero-downtime & rollback)

Lihat prosedur lengkap di **`docs/MIGRASI-ZERO-DOWNTIME.md`**. Ringkas:

- **Selalu** `pnpm db:migrate` + `pnpm db:verify`; **jangan** `db:push` di produksi.
- Pola **expand → migrate → contract** agar versi lama & baru bisa hidup bersama.
- **Backup dulu** sebelum migrasi (§4). Migrasi = forward-only; rollback = pulihkan backup.

---

## 6. Insiden: playbook cepat

| Gejala | Cek | Tindakan |
|---|---|---|
| Halaman tanpa gaya/CSS | `.next` korup | stop → `rm -rf .next` → build → start (§3) |
| `/api/health` 503 | `journalctl`, `db:verify` | DB mati/invarian hilang → cek PG, `pnpm db:verify` |
| `/api/ready` 503 | `db:verify` | pulihkan migrasi safety (`pnpm db:safety` atau `db:migrate`) |
| Login gagal massal | env `BETTER_AUTH_SECRET` | pastikan env service benar; restart |
| 5xx melonjak | `/api/metrics`, log JSON | lihat route p95/error; cek akar di `journalctl` |
| Disk penuh | `df -h`, ukuran `backups/` | rapikan arsip backup tua (`BACKUP_KEEP`) |

---

## 7. Log & metrik

- **Log**: JSON satu baris (level `debug|info|warn|error`), via stdout/stderr →
  `journalctl --user -u mathbank.service`. Redaksi rahasia otomatis.
  Nyalakan verbose: `LOG_LEVEL=debug` (env service), lalu restart.
- **Metrik**: `curl -H "Authorization: Bearer $METRICS_TOKEN" localhost:1234/api/metrics`
  → count/error/p50/p95/max per route (in-memory, single-node).

---

## 8. Kesehatan & startup

- Saat server menyala (`src/instrumentation.ts`): invarian DB diperiksa
  (trigger/CHECK/HNSW/uuidv7). Hilang → **log ERROR**; dengan
  `STRICT_INVARIANTS=true` → **startup digagalkan** (baik untuk staging).
- Probe liveness yang tak boleh menyentuh DB: `GET /api/health?probe=liveness`.

---

## 9. Docker (OPSI ALTERNATIF — bukan produksi saat ini)

> ⚠️ **Produksi berjalan lewat systemd (`mathbank.service`, port 1234), BUKAN
> Docker.** Berkas `Dockerfile`, `docker-compose.yml`, `Caddyfile` disediakan
> sebagai **opsi** untuk menjalankan MathBank di host/VPS lain dengan mudah.
> Jangan mengaktifkan Docker di host yang sama tanpa mematikan systemd (bentrok port).

```bash
cp .env.docker.example .env.docker   # isi nilai NYATA (jangan commit)
docker compose up -d --build         # app + PostgreSQL + Caddy (TLS otomatis)
docker compose logs -f app
docker compose down                  # hentikan
```

--- 

## 10. Rujukan

- Deploy & pra-produksi: `RENCANA-DEPLOY.md`
- Migrasi: `MIGRASI-ZERO-DOWNTIME.md`
- Backup: `BACKUP-RECOVERY.md`
- Observabilitas: `OBSERVABILITAS.md`
- Keamanan: `KEAMANAN.md`
