# RENCANA-DEPLOY.md — Rencana Rilis & Deployment MathBank

> **Status:** 📝 rencana (belum ada infrastruktur deploy otomatis per 2026-09-29).
> **Sifat:** dokumen hidup — perbarui saat pipeline/lingkungan nyata dibuat.
> **Prinsip:** **"install saat perlu"** — CI/CD, Docker, dsb dibuat saat menyentuh produksi, bukan sekarang.

---

## 1. Ringkasan

MathBank = aplikasi **Next.js 16 (App Router)** + **PostgreSQL 18**. Deployment target: **VPS/self-hosted** (belum diputuskan final). Dokumen ini mencatat **kondisi saat ini**, **pilihan**, dan **langkah** menuju produksi.

**Kondisi saat ini (nyata):**
- ❌ Belum ada `Dockerfile`, `docker-compose.yml`, atau CI (`.github/workflows/`).
- ✅ Gate mutu lokal: `pnpm check` (typecheck → lint → coverage → build).
- ✅ Skrip DB: `db:migrate`, `db:verify`, `db:safety`, `seed:*`.
- ✅ `engines` Node **belum dipatok** (disarankan ditambah).

---

## 2. Lingkungan

| Lingkungan | DB | Tujuan |
|-----------|----|--------|
| **dev** (lokal) | `mathbank` @ `:5433` | pengembangan |
| **test** (lokal) | `mathbank_test` @ `:5433` | integrasi DB (`pnpm test:db`) |
| **staging** | (belum ada) | pra-produksi, uji rilis |
| **produksi** | (belum ada) | pengguna nyata |

> DB dev pakai **non-standar port 5433** (PG 17 QBank di 5432 tak boleh diganggu). Produksi bebas memilih.

---

## 3. Prasyarat Runtime (produksi)

| Komponen | Versi | Catatan |
|----------|-------|---------|
| **Node.js** | ≥ 20 (uji di 24) | **disarankan patok di `engines`** |
| **pnpm** | 11.x | lockfile `pnpm-lock.yaml` |
| **PostgreSQL** | **18** (wajib) | `uuidv7()` native + `pgvector 0.8.x` + `pg_trgm` |
| Ekstensi DB | `vector`, `pg_trgm`, `pgcrypto` | dibuat saat provisioning |
| (M9+) | BGE-M3 service | embedding, bila fitur AI aktif |
| (M9+) | LaTeX/TikZ | hanya bila ekspor PDF aktif |

---

## 4. Variabel Lingkungan (produksi)

Wajib:
```
DATABASE_URL=postgresql://...      # jangan pakai akun superuser; hak minimum
BETTER_AUTH_SECRET=<acak kuat>     # ≥ 32 byte, RAHASIA
BETTER_AUTH_URL=https://<domain>
AUTH_DEV_BYPASS=false              # WAJIB false
APP_HTTPS=true                     # WAJIB true bila di balik reverse-proxy TLS
NODE_ENV=production
```
Opsional (per fitur): `BGE_M3_SERVICE_URL`, `MEDIA_STORAGE_PATH`, `TIKZ_TMP_ROOT`.

> **Keamanan:** `BETTER_AUTH_SECRET` dan `DATABASE_URL` = rahasia (lihat `KEAMANAN.md` §Manajemen Rahasia). Jangan commit; pakai secret manager.

---

## 5. Langkah Rilis — **dua tahap** (least privilege)

Sesuai **S10** (`KEAMANAN.md`): role aplikasi produksi **bukan** superuser.
Migrasi dipisah: **admin** membuat privilese tinggi sekali, **app** menjalankan sisanya.

### Tahap 1 — Provisioning (ADMIN DB, sekali)
```bash
# Ekstensi butuh superuser → hanya admin.
psql "$ADMIN_DATABASE_URL" -v app_role=mathbank_app -f drizzle/manual/provision-prod.sql
# (skrip ini: CREATE EXTENSION vector/pg_trgm, buat role app NOSUPERUSER,
#  GRANT CRUD, audit_logs append-only)
```

### Tahap 2 — Migrasi & rilis (ROLE APP, berulang)
```bash
pnpm install --frozen-lockfile
pnpm check                 # gate: typecheck+lint+coverage+build

# Skema: TANPA ekstensi (sudah dibuat admin), pakai role app least-privilege.
pnpm db:migrate            # skema + safety SQL (trigger/CHECK/HNSW)
pnpm db:verify             # pastikan 27 tabel, 2 CHECK, 1 HNSW, 26 trigger
pnpm seed:taxonomy         # grade/difficulty/cognitive

pnpm build && pnpm start
```

> **Dev lokal** tetap memakai role superuser (agar `CREATE EXTENSION` mudah);
> least-privilege **hanya relevan untuk produksi**. Lihat `docs/RENCANA-ENTERPRISE.md` §E1.

**Rollback:** simpan versi `.env` + **backup DB sebelum migrasi**; rollback aplikasi = deploy commit sebelumnya; rollback DB = pulihkan backup (lihat `BACKUP-RECOVERY.md`).

---

## 5b. Guard Invarian & Health Check

- **Startup** (`src/instrumentation.ts`): saat server menyala, invarian DB
  diverifikasi (26 trigger, 2 CHECK, 1 HNSW, uuidv7). Hilang → **log ERROR**;
  dengan `STRICT_INVARIANTS=true` → **gagalkan startup** (CI/staging sensitif).
- **Runtime** (`GET /api/health`): lapor status + invarian; `200` sehat, `503` rusak.
  Pakai untuk probe uptime/monitoring.

---

## 6. CI/CD (rencana, belum ada)

Pipeline usulan (GitHub Actions atau serupa):

```yaml
# Ringkas — belum dibuat
jobs:
  check:   # tsc, lint, unit, integrasi DB (service postgres), build
  deploy:  # manual/tag → migrate → verify → restart
```

**Aturan:** migrasi DB **selalu** lewat `pnpm db:migrate` + `db:verify`; jangan `db:push` di produksi.

---

## 7. Checklist Pra-Produksi

- [ ] `engines` Node dipatok di `package.json`
- [ ] `Dockerfile` / mekanisme deploy dibuat
- [ ] CI menjalankan `pnpm check` + `pnpm test:db`
- [ ] `AUTH_DEV_BYPASS=false` di produksi (verifikasi)
- [ ] Rahasia di secret manager (bukan `.env` di repo)
- [x] ~~Security headers (utang **S2**)~~ **✅ selesai** (`next.config.ts`); sisa: HTTPS/TLS di reverse proxy
- [x] ~~Rate limiting (utang **S1**)~~ **✅ selesai**
- [x] ~~Health check invarian~~ **✅ selesai** (`/api/health` + `instrumentation.ts`)
- [ ] Role DB produksi = **least-privilege** (jalankan `drizzle/manual/provision-prod.sql` sebagai admin; S10)
- [ ] Backup terjadwal + **uji restore** (`BACKUP-RECOVERY.md`)
- [ ] Observabilitas: logging + health check (`OBSERVABILITAS.md`)
- [ ] `db:verify` hijau di DB produksi

---

## 8. Rujukan

- Gate mutu: `CONSTRAINTS.md`, `STRATEGI-TES.md`
- Keamanan: `KEAMANAN.md`
- DB: `SKEMA-DB-DETAIL.md`, `ADR-0007`
