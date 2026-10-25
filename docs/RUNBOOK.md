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
> service jalan** — `next build` **menghapus `.next`** lalu menulis ulang,
> sedangkan service menyajikan direktori yang sama → SELURUH situs balas **500**
> (`Cannot find module .next/server/middleware-manifest.json`), bukan sekadar
> kehilangan CSS.

### Cara disarankan — `scripts/deploy.sh` (tanpa downtime)

```bash
cd ~/projects/mathbank
git pull                        # 1. ambil kode baru
pnpm install --frozen-lockfile  # 2. dependensi
pnpm db:migrate                 # 3. migrasi (lihat §5)
./scripts/deploy.sh             # 4. build → tukar atomik → restart → cek sehat
```

`deploy.sh` membangun ke `.next.new` lebih dulu (situs **tetap sehat** memakai
`.next` lama sepanjang build), lalu menukar direktori secara atomik setelah build
SUKSES. Bila build gagal atau layanan tak sehat dalam 30 detik, ia **kembali ke
build lama sendiri** — jadi situs tidak pernah turun karena deploy gagal.

Bila perlu memeriksa status build: periksa `.next/BUILD_ID` langsung, jangan
`pgrep -f "next build"` — pola itu **cocok dengan shell wrapper-nya sendiri** dan
selalu melaporkan "masih jalan".

### Cara manual (ada downtime — hanya bila `deploy.sh` tak bisa dipakai)

```bash
systemctl --user stop mathbank.service        # 1. hentikan dulu
rm -rf .next && pnpm build                     # 2. build bersih
systemctl --user start mathbank.service        # 3. nyalakan
curl -s localhost:1234/api/health | jq         # 4. verifikasi 200
```

**Rollback cepat:** `git checkout <commit-sebelumnya>` → ulangi langkah 3–4
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

### 4b. Backup berkas media

DB saja **tidak cukup** setelah G4: gambar soal hidup sebagai berkas di
`storage/media/` (di luar `public/`), jadi dump DB tanpa berkas = soal kehilangan
gambarnya saat dipulihkan.

```bash
tar czf "backups/media_$(date +%Y-%m-%d-%H%M%S).tar.gz" -C . storage/media
```

Keduanya (`backups/*.dump` + `backups/*.tar.gz`) sudah di-`gitignore` — dump memuat
data nyata dan **tidak boleh** masuk git.

---

## 5. Verifikasi media (G4)

```bash
pnpm media:verify-img          # route penyaji /img/{shortId} (perlu server hidup)
pnpm media:verify-hygiene      # orphan → hapus → hilang dari DB + disk
pnpm media:register-orphans    # daftarkan berkas storage yang belum tercatat
                               #   (mode kering; tambah --apply untuk eksekusi)
```

Ketiganya **membersihkan dirinya sendiri** — aman dijalankan di mana saja.

`media:register-orphans` menutup celah ② bila sudah terlanjur ada berkas di storage
tanpa baris `media_assets` (mis. sisa `storeImage()` sebelum G4.1). Ia memakai
`registerMediaAsset()` — jalur yang sama dengan ingest & unggah — jadi `short_id`
dibangkitkan generator dan dedup lewat `content_hash` tetap berlaku.

---

## 6. Migrasi skema (zero-downtime & rollback)

Lihat prosedur lengkap di **`docs/MIGRASI-ZERO-DOWNTIME.md`**. Ringkas:

- **Selalu** `pnpm db:migrate` + `pnpm db:verify`; **jangan** `db:push` di produksi (skrip `db:push` kini diblokir di production/staging oleh `scripts/db-push-gate.mjs` dan dirantai gate → ekstensi → push → safety → verify; push tetap bukan migrasi — tangkap perubahannya dengan `pnpm db:generate`).
- Pola **expand → migrate → contract** agar versi lama & baru bisa hidup bersama.
- **Backup dulu** sebelum migrasi (§4). Migrasi = forward-only; rollback = pulihkan backup.

---

## 7. Insiden: playbook cepat

| Gejala | Cek | Tindakan |
|---|---|---|
| Halaman tanpa gaya/CSS | `.next` korup | stop → `rm -rf .next` → build → start (§3) |
| **SELURUH situs 500** (`Cannot find module .next/server/middleware-manifest.json`) | `.next` sedang dihapus/dibangun `next build`, ATAU build mati di tengah | tunggu build selesai (cek `.next/BUILD_ID`), lalu `systemctl --user restart mathbank.service`; ke depan pakai `./scripts/deploy.sh` (§3) |
| `/api/health` 503 | `journalctl`, `db:verify` | DB mati/invarian hilang → cek PG, `pnpm db:verify` |
| `/api/ready` 503 | `db:verify` | pulihkan migrasi safety (`pnpm db:safety` atau `db:migrate`) |
| Login gagal massal | env `BETTER_AUTH_SECRET` | pastikan env service benar; restart |
| 5xx melonjak | `/api/metrics`, log JSON | lihat route p95/error; cek akar di `journalctl` |
| Disk penuh | `df -h`, ukuran `backups/` | rapikan arsip backup tua (`BACKUP_KEEP`) |

---

## 8. Log & metrik

- **Log**: JSON satu baris (level `debug|info|warn|error`), via stdout/stderr →
  `journalctl --user -u mathbank.service`. Redaksi rahasia otomatis.
  Nyalakan verbose: `LOG_LEVEL=debug` (env service), lalu restart.
- **Metrik**: `curl -H "Authorization: Bearer $METRICS_TOKEN" localhost:1234/api/metrics`
  → count/error/p50/p95/max per route (in-memory, single-node).

---

## 9. Kesehatan & startup

- Saat server menyala (`src/instrumentation.ts`): invarian DB diperiksa
  (trigger/CHECK/HNSW/uuidv7). Hilang → **log ERROR**; dengan
  `STRICT_INVARIANTS=true` → **startup digagalkan** (baik untuk staging).
- Probe liveness yang tak boleh menyentuh DB: `GET /api/health?probe=liveness`.

---

## 10. Docker (OPSI ALTERNATIF — bukan produksi saat ini)

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

## 11. Rujukan

- Deploy & pra-produksi: `RENCANA-DEPLOY.md`
- Migrasi: `MIGRASI-ZERO-DOWNTIME.md`
- Backup: `BACKUP-RECOVERY.md`
- Observabilitas: `OBSERVABILITAS.md`
- Keamanan: `KEAMANAN.md`
