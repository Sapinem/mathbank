# MathBank

Bank soal **matematika** — kurasi, susun, terbitkan.

Menggantikan QBank; dibangun dari kanvas bersih dengan arsitektur berlapis — **9 lapisan desain** (L1–L9, `docs/DESAIN-PER-LAPISAN-MATHBANK.md`) yang dipetakan ke **6 lapisan teknis** saat implementasi/audit (lihat [Arsitektur](#arsitektur-6-lapisan)).

---

## Tentang

MathBank membantu guru & tim kurikulum:

1. **Menyimpan** soal matematika lengkap (11 tipe, rumus KaTeX, media).
2. **Mencari** dengan filter kaya (topik, sumber, jenjang, kesulitan, level kognitif) + pencarian semantik.
3. **Menyusun** paket soal (ujian, latihan, sumber).
4. **Menerbitkan** lewat cetak/PDF.

Untuk satu institusi, skala kecil (<100 pengguna). Lihat `docs/PRD.md`.

---

## Tumpukan Teknologi

| Lapis | Teknologi |
|-------|-----------|
| Framework | Next.js 16 · React 19 · TypeScript 5.9 |
| Gaya | Tailwind v4 · shadcn/ui · mesin tema OKLCH |
| Data | PostgreSQL 18 · Drizzle ORM · pgvector |
| Auth | Better Auth (5 peran, multi-role) |
| Validasi | Zod |
| Mutu | Vitest · Testing Library · ESLint |

Detail & alasan: `docs/TUMPUKAN-TEKNOLOGI.md`.

---

## Memulai

### Prasyarat
- Node.js ≥ 20, pnpm
- PostgreSQL 18 (port `5433`), ekstensi `vector` + `pg_trgm`
- **Layanan embedding BGE-M3** (FastAPI) di `http://localhost:3005` — dibutuhkan untuk enrichment/pencarian semantik. Tanpa service ini aplikasi tetap jalan, tetapi embedding tidak bisa dibuat. Cek: `curl -s localhost:3005/health` → `{"status":"ok","model":"BAAI/bge-m3","dim":1024}`

### Pasang & jalankan

```bash
pnpm install
cp .env.example .env          # isi DATABASE_URL, BETTER_AUTH_SECRET, BGE_M3_SERVICE_URL, dst
pnpm db:migrate               # terapkan skema (26 tabel, 24 trigger)
pnpm db:verify                # pastikan tak ada drift skema
pnpm seed:taxonomy            # isi jenjang/kesulitan/level kognitif
pnpm theme:build              # bangun token tema
pnpm dev                      # http://localhost:3000
```

### Perintah lain

| Perintah | Fungsi |
|----------|--------|
| `pnpm typecheck` | tsc --noEmit (0 error) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (unit) |
| `pnpm test:db` | Vitest integrasi DB (pakai `TEST_DATABASE_URL`) |
| `pnpm test:watch` | Vitest mode pantau |
| `pnpm build` | Build produksi |
| `pnpm check` | **Semua gerbang mutu** sekaligus |
| `pnpm db:generate` | Hasilkan migrasi dari skema |
| `pnpm db:migrate` | Terapkan migrasi + `db:safety` |
| `pnpm db:verify` | Verifikasi invarian skema (jumlah tabel/trigger/index, CHECK, HNSW) |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm backup:db` | Dump database ke `backups/` (`scripts/backup-db.mjs`) |
| `pnpm restore:check` | Uji restore dari dump terakhir (`scripts/restore-check.mjs`) |
| `pnpm theme:build` | Bangun ulang token tema |
| `pnpm seed:taxonomy` | Seed taksonomi dari `config/curriculum.yaml` |

### Verifikasi skema

`pnpm db:verify` mencetak invarian dan gagal bila ada drift. Snapshot acuan (diverifikasi ulang 2026-10-21, DB utama & DB uji):

```text
✓ tables: 26   ✓ triggers: 24   ✓ checkConstraints: 3   ✓ hnswIndexes: 1
✓ PK default = uuidv7()   ✓ Skema OK — tak ada drift.
```

Jalankan juga di DB uji: `DATABASE_URL="$TEST_DATABASE_URL" pnpm db:verify`.

### Backup & restore

```bash
pnpm backup:db        # dump ke backups/ (ter-.gitignore) — WAJIB sebelum operasi merusak
pnpm restore:check    # restore dump terbaru ke DB sementara, lalu verifikasi
```

Backup manual **tidak cukup** untuk produksi: jadwalkan harian (cron) + retensi 7/30 hari + uji restore bulanan. Lihat `docs/RUNBOOK.md`.

### Layanan embedding (BGE-M3, port `:3005`)

| Item | Nilai |
|------|-------|
| Service | FastAPI, `http://localhost:3005` |
| Model | `BAAI/bge-m3` · dimensi **1024** (harus cocok `vector(1024)`) |
| Health | `GET /health` → `{"status":"ok","model":"BAAI/bge-m3","dim":1024}` |
| Embed | `POST /v1/embeddings` `{"input":["..."]}` (gaya OpenAI); OpenAPI di `/openapi.json` |
| Env aplikasi | `BGE_M3_SERVICE_URL` (default `http://127.0.0.1:3005`), `BGE_M3_MODEL` (default `bge-m3`), `BGE_M3_TIMEOUT_MS` (default `120000`) |

✅ **Klien aplikasi sudah selaras (MAT-115).** `src/lib/embedding/bge-m3.ts` memakai kontrak OpenAI-compatible `POST {base}/v1/embeddings` (`{model,input}` → `{data:[{embedding}]}`), tetap menerima balasan lama `{embeddings:[[…]]}`, dan memakai `GET /health`. `.env`/`.env.example` menunjuk `:3005`.

✅ **Backfill vektor selesai:** **11.867 dari 11.889 soal (99,8%)** punya embedding `vector(1024)` dan index HNSW terisi. Sisa 22 soal belum — jalankan `pnpm backup:db` lalu backfill ulang bila perlu.

⚠️ **Service `:3005` tidak selalu hidup.** Bila `curl -s localhost:3005/health` timeout, enrichment/pencarian semantik untuk soal **baru** akan gagal walau data lama sudah ter-embed. Nyalakan service sebelum ingest massal.

---

## Arsitektur 6 Lapisan

Dokumen desain memakai penomoran produk **L1–L9**; implementasi & audit V2 memakai **6 lapisan teknis** berikut.

| Lapis | Isi | Modul |
|-------|-----|-------|
| **L1 Auth/Role** | Better Auth, peran & izin (`can`, `assertCan`) | `src/lib/auth/` |
| **L2 API** | `wrapRoute`, rate limit, validasi Zod | `src/lib/api/`, `src/app/api/` |
| **L3 Service** | orkestrasi domain & transaksi | `src/lib/services/`, `src/lib/ingest/` |
| **L4 Engine** | fungsi murni: KaTeX lint/repair, export, cetak | `src/lib/math/`, `src/lib/export/` |
| **L5 Data Access** | Drizzle ORM, 26 tabel, 86 index, 1 HNSW | `src/lib/db/` |
| **L6 Infra** | PG18 + pgvector, Docker Compose, Caddy, health/metrics | `docker-compose.yml`, `Caddyfile` |

Aturan: logika murni hanya di L4; route tidak menyentuh Drizzle langsung; penambahan lapisan wajib lewat ADR. Detail: `docs/ARCHITECTURE.md`, `docs/DESAIN-PER-LAPISAN-MATHBANK.md`.

---

## Metrik Database (snapshot 2026-10-21, terverifikasi langsung dari DB)

| Entitas | Jumlah | Catatan |
|---------|--------|---------|
| Tabel / trigger / index | **26 / 24 / 86** | 1 index HNSW (`vector(1024)`), `db:verify` hijau di DB utama & DB uji |
| Soal | **11.889** | 100% `draft`, 22 soft-deleted, 93,4% (11.108) ber-`answer_key`, 3.034 (25,5%) `is_flagged` |
| Bundle | **579** | 100% `draft`, rata-rata 21,4 soal, 2 soft-deleted |
| Topik | **174** | **8.468 soal terpetakan** (14.442 tautan `question_topics` — 71,2%) |
| Media | **2.617** | **1.639 tautan** `question_media` menjangkau **1.506 soal** (12,7%) |
| Tag | **17** | 35.598 tautan `question_tags` (11.866 soal) |
| Sumber / event | **5 / 11** | provenance `event_id` pada 2.281 soal (19,2%) |
| Embedding | **11.867** (99,8%) | HNSW terisi — blocker V2 sudah lewat |

Angka di atas diambil `psql` + `pnpm db:verify` pada 2026-10-21 dan **menggantikan** snapshot 2026-10-19 di `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` (baris embedding, topik, media, dan jumlah index sudah berubah). Rincian & perintah verifikasi: `docs/SNAPSHOT-METRIK-2026-10-21.md`.

**Cara verifikasi ulang** (jangan percaya tabel ini tanpa cek):

```bash
pnpm db:verify
psql "$DATABASE_URL" -c "select count(*) from questions;"   # ulangi per baris tabel
```

---

## Roadmap V2 & Kesiapan CI/CD

**Roadmap ringkas** (detail: `docs/RENCANA-MATHBANK-V2.md`, `docs/audit/PAPERCLIP-V2-ACTION-PLAN.md`):

| Fase | Fokus | Status |
|------|-------|--------|
| 0 — Sprint 0 | Sinkronisasi metrik & dokumentasi; verifikasi skema | ✅ (dokumen ini + `docs/SNAPSHOT-METRIK-2026-10-21.md`) |
| 1 — Data hygiene | Backfill 11.889 embedding · pemetaan 174 topik · relasi 2.617 media | 🟡 embedding 99,8% ✅ · topik 71,2% · media 12,7% |
| 2 — Kualitas soal | `draft` → `ready`, kunci/pembahasan, AI tagging | ⬜ 0 dari 11.889 soal berstatus `ready` |
| 3 — Skala & operasi | Hot/cold storage, partial HNSW, media CDN, backup terjadwal | 🟡 backup terjadwal ✅, sisanya ⬜ |

**Kesiapan CI/CD:**

| Aspek | Status |
|-------|--------|
| Workflow CI | ✅ `.github/workflows/ci.yml` (PG18 + pgvector service) |
| `pnpm typecheck` | ✅ 0 error (diverifikasi 2026-10-21) |
| `pnpm test` / `pnpm lint` penuh | ❌ masih gagal per audit V2 (Pilar 2) — perlu verifikasi ulang pemilik CI (MAT-115) |
| `db:verify` | ✅ 0 drift — DB utama **dan** DB uji |
| Backup terjadwal | ✅ cron harian 02:00 (`scripts/backup-db.mjs`, retensi 7 dump harian + arsip mingguan 30 hari) |
| Uji restore | ✅ `restore:check` + drill terakhir 2026-10-20 (`backups/restore-drill-*.json`) |
| Cakupan Zod route API | ⚠️ 17/51 route |

---

## Struktur

```
src/
  app/
    (app)/            halaman ber-shell (dasbor, bank soal, dst)
    api/              route API
    layout.tsx        akar (tema, query, font)
    globals.css       impor token + Tailwind
  components/
    layout/           sidebar, header, shell, ⌘K
    providers/        tema, react-query
    ui/               shadcn + keadaan
  lib/
    api/              pembungkus route (L4)
    auth/             peran, izin, guard, actor
    db/               koneksi + skema (6 berkas)
scripts/
  theme/build.ts      mesin tema
  seed-taxonomy.ts    seeder
docs/                 200 dokumen (kanonikal, ADR, audit, rencana)
```

---

## Gerbang Mutu

Setiap perubahan wajib lolos:

```bash
pnpm check   # typecheck 0 + lint 0 + test + build
```

Aturan lengkap: `CONSTRAINTS.md`. Prinsip: `AGENTS.md`.

---

## Dokumentasi

Seluruh perencanaan ada di `docs/`. Mulai dari:

| Dokumen | Isi |
|---------|-----|
| `PRD.md` | Kebutuhan produk, MVP, alur kerja |
| `MILESTONE.md` | Rencana M0–M12, tugas per milestone |
| `ARCHITECTURE.md` | Arsitektur sistem & pemetaan 6 lapisan teknis |
| `DESAIN-PER-LAPISAN-MATHBANK.md` | Arsitektur desain 9 lapisan (L1–L9) |
| `SKEMA-DB-DETAIL.md` | Bentuk final skema database |
| `RENCANA-UI.md` | Struktur menu, halaman, keputusan UI |
| `TUMPUKAN-TEKNOLOGI.md` | Pilihan library & alasan |
| `RIWAYAT-KEPUTUSAN.md` | Kronologi keputusan + alasan |
| `audit/EVALUASI-PAPERCLIP-V2-FULL.md` | Audit 7 pilar V2 + metrik DB terverifikasi |
| `CHANGELOG.md` | Catatan perubahan tiap versi |

---

## Status

Lihat `CHANGELOG.md` untuk versi terbaru & `docs/MILESTONE.md` untuk peta jalan.

| Milestone | Status |
|-----------|--------|
| M0 Fondasi | ✅ |
| M1 Skema Database | ✅ |
| M2 Auth & Peran | ✅ |
| M3 Tema & Shell | ✅ |
| M4 Bank Soal | ⬜ |
| … | … |
