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
NODE_ENV=production
```
Opsional (per fitur): `BGE_M3_SERVICE_URL`, `MEDIA_STORAGE_PATH`, `TIKZ_TMP_ROOT`.

> **Keamanan:** `BETTER_AUTH_SECRET` dan `DATABASE_URL` = rahasia (lihat `KEAMANAN.md` §Manajemen Rahasia). Jangan commit; pakai secret manager.

---

## 5. Langkah Rilis (rencana)

```bash
# 1. Bangun
pnpm install --frozen-lockfile
pnpm check                 # gate: typecheck+lint+coverage+build

# 2. Siapkan DB (sekali, DB kosong)
psql ... -c "CREATE EXTENSION IF NOT EXISTS vector; ...pg_trgm...; ...pgcrypto;"
pnpm db:migrate            # skema penuh dari file (+ safety SQL)
pnpm db:verify             # pastikan 27 tabel, 2 CHECK, 1 HNSW, 25 trigger
pnpm seed:taxonomy         # grade/difficulty/cognitive

# 3. Jalankan
pnpm build && pnpm start
```

**Rollback:** simpan versi `.env` + **backup DB sebelum migrasi**; rollback aplikasi = deploy commit sebelumnya; rollback DB = pulihkan backup (lihat `BACKUP-RECOVERY.md`).

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
- [ ] HTTPS + security headers (utang **S2**, `KEAMANAN.md`)
- [ ] Rate limiting (utang **S1**)
- [ ] Backup terjadwal + **uji restore** (`BACKUP-RECOVERY.md`)
- [ ] Observabilitas: logging + health check (`OBSERVABILITAS.md`)
- [ ] `db:verify` hijau di DB produksi

---

## 8. Rujukan

- Gate mutu: `CONSTRAINTS.md`, `STRATEGI-TES.md`
- Keamanan: `KEAMANAN.md`
- DB: `SKEMA-DB-DETAIL.md`, `ADR-0007`
