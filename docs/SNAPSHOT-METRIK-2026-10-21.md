# Snapshot Metrik DB — 2026-10-21 (Terverifikasi Langsung)

> **Status:** Kanonikal Hidup (*Living Document*) — angka acuan resmi untuk `AGENTS.md` §8, `README.md` §Metrik Database, dan `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` (yang snapshot-nya 2026-10-19 dan kini sebagian usang).
> **Penanggung jawab:** Tariq (Data Ingestion & Corpus Pipeline) — MAT-116 / Sprint 0.
> **Prinsip:** angka di dokumen ini **hanya sah bila bisa direproduksi**. Setiap baris punya query asalnya (§2).

---

## 1. Ringkasan

| Aspek | Nilai (2026-10-21) |
|---|---|
| Skema | **26 tabel** · **24 trigger** · 3 CHECK · **86 index** (1 HNSW) |
| Soal | **11.889** — 100% `draft`, 0 `ready`, 22 soft-deleted, 11.108 (93,4%) ber-`answer_key`, 3.034 (25,5%) `is_flagged` |
| Bundle | **579** (577 aktif, 2 arsip) · 12.344 `bundle_items` · rata-rata 21,4 butir/paket |
| Topik | **174** · **8.468 soal terpetakan** (14.442 tautan `question_topics` — 71,2%) |
| Media | **2.617** aset · **1.639 tautan** `question_media` menjangkau **1.506 soal** (12,7%) |
| Tag | **17** · 35.598 tautan `question_tags` (11.866 soal) |
| Provenance | **5 sumber** · **11 event** · 2.281 soal ber-`event_id` (19,2%) |
| Vektor | **11.867 embedding** (99,8%) · `vector(1024)` · HNSW terisi |

Verifikasi invarian skema: `pnpm db:verify` → **hijau** pada DB utama **dan** DB uji
(`tables 26 / triggers 24 / checkConstraints 3 / hnswIndexes 1 / PK uuidv7()`).

---

## 2. Query sumber (reproduksi)

```bash
cd /home/hari/projects/mathbank && set -a && . ./.env && set +a

# 1. invarian skema (utama + uji)
pnpm db:verify
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:verify

# 2. tabel & trigger
psql "$DATABASE_URL" -c "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"   # 26
psql "$DATABASE_URL" -c "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal;"  # 24
psql "$DATABASE_URL" -c "select count(*) from pg_indexes where schemaname='public';"                                                 # 86

# 3. volume entitas
psql "$DATABASE_URL" -c "select (select count(*) from questions) q, (select count(*) from bundles) b, (select count(*) from topics) t, (select count(*) from media_assets) m, (select count(*) from tags) tg, (select count(*) from sources) s, (select count(*) from events) e;"

# 4. kualitas & kelengkapan soal
psql "$DATABASE_URL" -c "
select
 (select count(*) from questions where status='draft')                                   q_draft,
 (select count(*) from questions where status<>'draft')                                 q_non_draft,
 (select count(*) from questions where deleted_at is not null)                          q_deleted,
 (select count(*) from questions where answer_key <> '{}'::jsonb)                       q_with_key,
 (select count(*) from questions where is_flagged)                                      q_flagged,
 (select count(*) from questions where event_id is not null)                            q_with_event,
 (select count(*) from questions where embedding is not null)                           q_with_emb;"

# 5. keterhubungan (relasi)
psql "$DATABASE_URL" -c "
select
 (select count(*) from question_topics)                                  topic_links,
 (select count(distinct question_id) from question_topics)               q_with_topic,
 (select count(*) from question_media)                                   media_links,
 (select count(distinct question_id) from question_media)                q_with_media,
 (select count(*) from question_tags)                                    tag_links,
 (select count(distinct question_id) from question_tags)                 q_with_tag,
 (select count(*) from bundle_items)                                     bundle_items,
 (select round(avg(c),1) from (select count(*) c from bundle_items group by bundle_id) x) avg_items;"
```

**Catatan jebakan:** `information_schema.triggers` menghitung **per event** (trigger dengan 2 event
terhitung 2×) → menghasilkan **29**, bukan 24. Selalu pakai `pg_trigger … where not tgisinternal`
untuk angka trigger.

---

## 3. Delta vs snapshot audit 2026-10-19

| Metrik | 2026-10-19 (audit V2) | 2026-10-21 | Perubahan |
|---|---|---|---|
| Index | 87 | **86** | −1 (index usang ter-drop) |
| Embedding | 0 | **11.867** | ✅ backfill dijalankan (99,8%) |
| `question_topics` | 0 (kosong) | **14.442** (8.468 soal) | ✅ pemetaan topik jalan (71,2%) |
| `question_media` | 0 (kosong) | **1.639** (1.506 soal) | ✅ relasi media jalan (12,7%) |
| `question_tags` | 0 | **35.598** (11.866 soal) | ✅ tagging jalan |
| Soal ber-`event_id` | 2.283 | **2.281** | −2 (pembersihan provenance) |
| Soal / bundle / topik / media | 11.889 / 579 / 174 / 2.617 | sama | stabil |
| Backup | stagnan 8 hari | **cron harian 02:00 + drill 2026-10-20** | ✅ terjadwal |

**Konsekuensi:** klaim "blocker V2" pada audit Pilar 1 (embedding 0%, topik 0%, media 0%) **sudah
tidak berlaku**. Yang tersisa adalah **kelengkapan**, bukan ketiadaan: 3.421 soal belum bertopik,
10.383 soal belum bermedia.

---

## 4. Drift dokumentasi yang ditutup oleh snapshot ini

| Berkas | Klaim lama | Fakta 2026-10-21 | Status |
|---|---|---|---|
| `AGENTS.md` §8 | 28 tabel | 26 tabel | ⏳ **tertahan gerbang berkas terlindungi** — patch siap: `docs/plans/mat-116-agents-md-8-9.patch` |
| `AGENTS.md` §8 | 0 soal | 11.889 soal | ⏳ sama (patch) |
| `AGENTS.md` §8 | 5 events / 6 sumber | 11 event / 5 sumber | ⏳ sama (patch) |
| `AGENTS.md` §8 | ADR hanya 0009–0016 | berlaku sampai 0022 | ⏳ sama (patch) |
| `AGENTS.md` §8 | utang: UI koleksi, `warnings`→`isFlagged`, `curriculum.yaml` di luar repo | ketiganya **sudah selesai** | ⏳ sama (patch) |
| `README.md` | index 87 | 86 | ✅ diperbaiki |
| `README.md` | embedding 0 | 11.867 (99,8%) | ✅ diperbaiki |
| `README.md` | topik 0 terpetakan | 8.468 (71,2%) | ✅ diperbaiki |
| `README.md` | media 0 tertaut | 1.639 tautan / 1.506 soal | ✅ diperbaiki |
| `README.md` | backup manual (11 Okt) | cron 02:00 + drill 20 Okt | ✅ diperbaiki |
| `README.md` | 182 dokumen `docs/` | 200 berkas `.md` | ✅ diperbaiki |

---

## 5. Cara menerapkan patch `AGENTS.md`

`AGENTS.md` termasuk **berkas instruksi terlindungi** — penulisan langsung ditolak oleh gerbang
runtime (butuh persetujuan pemilik). Patch di `docs/plans/mat-116-agents-md-8-9.patch` sudah lolos
`git apply --check` terhadap `AGENTS.md` versi sekarang:

```bash
cd /home/hari/projects/mathbank
git apply --check docs/plans/mat-116-agents-md-8-9.patch   # harus tanpa keluaran
git apply docs/plans/mat-116-agents-md-8-9.patch
```

Isi patch: §8 (tabel metrik 2026-10-21 + ADR 0009–0022 + utang terbuka) dan §9 baru
(6 lapisan teknis + kontrak layanan embedding BGE-M3 `:3005`).

---

## 6. Catatan Verifikasi

- **Waktu eksekusi:** 2026-10-21, agen Tariq (run Paperclip), repo `/home/hari/projects/mathbank` branch `paperclip/dev`.
- **Metode:** `pnpm db:verify` (DB utama **dan** DB uji) + 5 kelompok query `psql` di §2. Semua angka di §1 berasal dari keluaran query tersebut, bukan dari dokumen lain.
- **Bukti mentah:** keluaran query `db:verify` = `tables 26 / triggers 24 / checkConstraints 3 / hnswIndexes 1 / PK uuidv7()` → "Skema OK — tak ada drift" pada kedua DB.
- **Yang TIDAK diverifikasi:** `pnpm test` dan `pnpm lint` penuh tidak dijalankan ulang (durasi > batas heartbeat; working tree berisi perubahan agen lain). `pnpm typecheck` dijalankan → **exit 0**. Health layanan embedding `:3005` **timeout** saat pemeriksaan (service mati) — dicatat sebagai utang, bukan sebagai klaim sehat.
- **Batasan domain:** dokumen ini hanya menyentuh berkas markdown. Tidak ada perubahan `src/`, `scripts/`, skema DB, atau CI.
- **Sifat klaim:** angka = potret satu titik waktu. Bila diragukan, jalankan ulang §2 sebelum mengutip.
