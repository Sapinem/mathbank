# Sinkronisasi Metrik DB & Dokumentasi Arsitektur (MAT-116)

> **Status:** ⏳ Menunggu persetujuan — usulan penggantian §8 `AGENTS.md` + §9 baru
> **Penulis:** Tariq (Data Ingestion & Corpus Pipeline)
> **Tanggal:** 19 Oktober 2026
> **Isu:** MAT-116 · Sprint 0
> **Cakupan:** `AGENTS.md`, `README.md`, `docs/`

---

## 1. Ringkasan

Dokumentasi `AGENTS.md` §8 dan `README.md` memuat angka basi (28 tabel, 0 soal, 27 tabel, "5 events")
yang bertentangan dengan kondisi database produksi. Dokumen ini merekam **angka terverifikasi**,
metode verifikasi, dan **teks usulan** untuk `AGENTS.md` (berkas dilindungi gerbang persetujuan).

`README.md` **sudah diperbarui** pada run ini (lihat §5).

---

## 2. Metode Verifikasi (dijalankan 2026-10-19)

```bash
pnpm db:verify                     # → tables 26, triggers 24, CHECK 3, HNSW 1, 0 drift
psql "$DATABASE_URL" -At -c "select count(*) from questions"       # 11889
psql "$DATABASE_URL" -At -c "select count(*) from bundles"         # 579
psql "$DATABASE_URL" -At -c "select count(*) from topics"          # 174
psql "$DATABASE_URL" -At -c "select count(*) from media_assets"    # 2617
psql "$DATABASE_URL" -At -c "select count(*) from sources"         # 5
psql "$DATABASE_URL" -At -c "select count(*) from events"          # 11
psql "$DATABASE_URL" -At -c "select count(*) from questions where embedding is not null"  # 0
psql "$DATABASE_URL" -At -c "select count(*) from pg_indexes where schemaname='public'"   # 87
curl -s localhost:3005/health      # {"status":"ok","model":"BAAI/bge-m3","dim":1024}
```

Angka turunan (status, kunci, soft-delete, media/topik kosong, distribusi sumber) diambil dari
`docs/audit/AUDIT-DATA-SNAPSHOT-2026-10-19.csv` dan `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` §1.

**Catatan koreksi:** audit Pilar 6 menulis "5 events"; hitungan langsung tabel `events` = **11 baris**
(konsisten dengan audit konsistensi 2026-10-18 yang juga mencatat 5→11 event). Angka **11** dipakai.

---

## 3. Usulan Teks `AGENTS.md` (pengganti §8, tambah §9)

Berkas `AGENTS.md` dilindungi gerbang persetujuan; penulisan ditolak pada run ini. Teks di bawah
adalah isi yang diminta untuk diterapkan apa adanya.

````markdown
## 8. Kondisi proyek saat ini (perbarui bila berubah)

**Snapshot terverifikasi 2026-10-19.** Sumber angka: `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` +
`docs/audit/AUDIT-DATA-SNAPSHOT-2026-10-19.csv`; dicek ulang langsung lewat `pnpm db:verify` dan
`psql`. **Jangan menulis angka dari ingatan** — hitung ulang, lalu perbarui tabel ini.

| Aspek | Nilai aktual |
|---|---|
| Skema | **26 tabel** · **24 trigger** · 3 CHECK · **87 index** (1 HNSW) · `db:verify` hijau (DB utama & DB uji) |
| Soal | **11.889** — 100% `draft`, 0 `ready`, 22 soft-deleted; `answer_key` non-kosong 11.108 (93,4%) |
| Bundle | **579** (577 aktif, 2 arsip) · rata-rata 21,4 soal/paket · 0 item menggantung |
| Topik | **174** (6 root / 33 L2 / 135 L3) — **0 terpetakan**: `question_topics` kosong |
| Media | **2.617** aset — **0 tertaut** (`question_media` kosong), 1.520 dirujuk `{{img:}}` di konten |
| Provenance | **5 sumber** · **11 event** · 2.283 soal ber-`event_id` (19,2%) |
| Vektor | **0 embedding** (`vector(1024)`, index HNSW kosong) |

- ADR berlaku: **0009** (bundle satu tabel), **0010** (event), **0011** (stimulus), **0014** (sumber menempel bundle), **0015** (gabung books/institutions), **0016** (`collections`), **0019** (isolasi vektor), **0020** (event vs provenance), **0021** (print config), **0022** (`wrapRoute`, larangan Server Actions). Total 22 ADR di `docs/ADR/`.
- **Utang terbuka:** backfill embedding · pemetaan topik · relasi media · parser kunci dua bahasa · `warnings`→`isFlagged` tak tersambung · UI koleksi · pengaman `scripts/ingest-corpus.ts`

## 9. Arsitektur 6 lapisan & layanan embedding

### 9.1 Dua penomoran, satu kode

- **Dokumen desain** `docs/DESAIN-PER-LAPISAN-MATHBANK.md` memakai penomoran produk **L1–L9** (peran → antarmuka → state → API → data → engine → …). Itu acuan *ranah*.
- **Tinjauan implementasi V2** (`docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` §3.1) memakai **6 lapisan teknis**. Saat menulis kode/audit, pakai tabel ini:

| Lapis | Isi | Modul acuan | Status 2026-10-19 |
|---|---|---|---|
| **L1 Auth/Role** | Better Auth, 4 peran, `can`/`assertCan`/`hasRole` | `src/lib/auth/` | ✅ siap |
| **L2 API** | `wrapRoute`, rate limit, Zod di boundary | `src/lib/api/`, `src/app/api/` | ⚠️ Zod baru 17/51 route |
| **L3 Service** | orkestrasi domain, transaksi | `src/lib/services/`, `src/lib/ingest/` | ⚠️ beberapa fungsi > 300 baris |
| **L4 Engine** | fungsi murni: KaTeX lint/repair, export, cetak | `src/lib/math/`, `src/lib/export/` | ✅ siap |
| **L5 Data Access** | Drizzle, 26 tabel, 87 index, HNSW | `src/lib/db/` | ✅ siap |
| **L6 Infra** | PG18 + pgvector, Docker Compose, Caddy, health/metrics | `docker-compose.yml`, `Caddyfile` | ✅ siap |

**Aturan:** logika murni **hanya** di L4; route **tidak** menyentuh Drizzle langsung (lewat L3/L5); jangan menambah lapisan baru tanpa ADR.

### 9.2 Layanan embedding (FastAPI BGE-M3, port `:3005`)

**Kontrak service (terverifikasi hidup 2026-10-19):**

```bash
curl -s localhost:3005/health
# {"status":"ok","model":"BAAI/bge-m3","dim":1024}
curl -s -X POST localhost:3005/v1/embeddings \
  -H 'Content-Type: application/json' -d '{"input":["$x^2+1$"]}'
```

- Model `BAAI/bge-m3`, **dimensi wajib 1024** (sesuai `vector(1024)`); OpenAPI di `/openapi.json`.
- Endpoint embedding: `POST /v1/embeddings` (gaya OpenAI), health: `GET /health`.

**Konvensi integrasi di aplikasi** (`src/lib/embedding/bge-m3.ts`):

- Base URL dari `BGE_M3_SERVICE_URL`, model dari `BGE_M3_MODEL`; **jangan hardcode port** di kode baru.
- Klien saat ini berbentuk **Ollama**: `POST {base}/api/embed` → `{embeddings: number[][]}`.
- ⚠️ **Gap terverifikasi:** `.env` masih menunjuk `http://localhost:11434` (Ollama **mati**), sedangkan service `:3005` memakai path `/v1/embeddings`. Backfill embedding **belum bisa jalan** sampai base URL/adaptor diselaraskan (domain Salman — jangan ubah kode di luar tugas dokumentasi).
- Aturan data: tolak vektor ≠ 1024 dim; batch + idempoten (skip berdasarkan hash konten); **backup dulu** (`pnpm backup:db`) sebelum backfill massal; jangan simpan vektor parsial.

**Referensi audit:** `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` (ringkasan: `docs/audit/EVALUASI-PAPERCLIP-V2-EXECUTIVE.md`, rencana aksi: `docs/audit/PAPERCLIP-V2-ACTION-PLAN.md`).
````

---

## 4. Tabel Drift yang Ditutup

| Lokasi | Klaim lama | Aktual | Status |
|---|---|---|---|
| `AGENTS.md` §8 | 28 tabel | 26 | ⏳ menunggu persetujuan |
| `AGENTS.md` §8 | 0 soal | 11.889 | ⏳ menunggu persetujuan |
| `AGENTS.md` §8 | 5 events / 6 sumber | 11 event / 5 sumber | ⏳ menunggu persetujuan |
| `README.md` | 27 tabel | 26 | ✅ diperbaiki |
| `README.md` | "9 lapisan" tanpa pemetaan | 9 desain → 6 teknis | ✅ diperbaiki |
| `README.md` | tanpa prasyarat embedding | `:3005` didokumentasikan | ✅ diperbaiki |
| `README.md` | tanpa `db:verify`/backup/restore | 3 perintah ditambahkan | ✅ diperbaiki |
| `docs/PETA-DOKUMEN.md` | 11.867 soal; audit V2 tak terdaftar | 11.889; 4 berkas audit terdaftar | ✅ diperbaiki |

---

## 5. Berkas yang Disentuh

- `README.md` — prasyarat, setup, perintah (`db:verify`, `backup:db`, `restore:check`), verifikasi skema, backup/restore, layanan embedding `:3005`, arsitektur 6 lapisan, metrik DB, roadmap V2 + kesiapan CI/CD, daftar dokumen.
- `docs/PETA-DOKUMEN.md` — registrasi 4 berkas audit V2 + koreksi angka.
- `docs/plans/2026-10-19-sinkronisasi-metrik-agents-readme.md` — dokumen ini.
- **Tidak ada** perubahan di `src/`, `scripts/`, `package.json`, atau konfigurasi CI (batas domain dipatuhi).

---

## 6. Catatan Verifikasi (CONSTRAINTS #44)

- `pnpm db:verify` dijalankan pada DB utama (`localhost:5433/mathbank`): **hijau**, 26 tabel / 24 trigger / 3 CHECK / 1 HNSW / 0 drift.
- Semua hitungan entitas berasal dari `psql` langsung, bukan salinan laporan; angka audit MAT-114 cocok kecuali `events` (5 → **11**, dikoreksi).
- `curl localhost:3005/health` → `200` `{"status":"ok","model":"BAAI/bge-m3","dim":1024}`; `curl localhost:11434/api/tags` → **gagal konek** (Ollama mati). Ini bukti untuk klaim "service `:3005` hidup, klien aplikasi belum menunjuk ke sana".
- Tidak ada klaim "selesai" untuk `AGENTS.md`: berkas dilindungi gerbang persetujuan, penulisan ditolak pada run ini.
