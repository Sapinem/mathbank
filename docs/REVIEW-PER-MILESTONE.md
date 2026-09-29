# REVIEW PER-MILESTONE — MathBank

> **Tujuan:** memverifikasi tiap milestone yang sudah ditandai ✅ **terhadap kenyataan**
> (DB nyata, kode, tes) — bukan sekadar percaya centang. Tiap temuan dicatat,
> diperbaiki, dan diverifikasi ulang.
>
> **Metode:** mulai dari M1, berurutan. Untuk tiap milestone: (1) verifikasi klaim
> terhadap artefak nyata, (2) uji perilaku (bukan hanya keberadaan), (3) catat
> temuan, (4) perbaiki bila gerbang bisa tetap hijau, (5) commit.
>
> **Legenda tingkat:** 🔴 kritis · 🟠 penting · 🟡 kecil

---

## M1 — Skema Database

**Direview:** 2026-09-30 · **Verdict:** ✅ **LULUS** (setelah 1 perbaikan 🔴)

### Verifikasi klaim (terhadap DB nyata `mathbank`)

| Klaim MILESTONE | Kenyataan | Verdict |
|-----------------|-----------|:-------:|
| 27 tabel (21 domain + 6 auth) | `pg_tables` = **27** | ✅ |
| Enum lengkap | `pg_type` = **14** enum (question_type = 11 tipe) | ✅ |
| Index (GIN trigram, HNSW, B-tree) | **81** index; HNSW `idx_questions_embedding_hnsw` ada | ✅ |
| FK | **23** | ✅ |
| CHECK invarian | **2**: `chk_questions_difficulty` (1–5), `chk_topics_level` (1–3) | ✅ |
| Trigger `updated_at` + `usage_count` + custom | **25** trigger | ✅ |
| `uuidv7()` PK | default `questions.id` = `uuidv7()` | ✅ |
| Ekstensi `pg_trgm` + `vector` | keduanya ada (vector **owner `postgres`**) | ✅ |
| `pnpm db:verify` hijau | ✓ 27 tabel, 2 CHECK, 1 HNSW, 25 trigger, uuidv7 | ✅ |
| Seeder taksonomi | ada (10 topik, 14 soal di DB dev) | ✅ |

### Uji perilaku invarian (dijalankan langsung ke DB)

| Invarian | Uji | Hasil |
|----------|-----|:-----:|
| difficulty 1–5 | `INSERT … difficulty=9` | ✅ ditolak (`chk_questions_difficulty`) |
| topics.level 1–3 | `INSERT … level=4` | ✅ ditolak (`chk_topics_level`) |
| stimulus depth ≤ 1 | induk → anak → **cucu** | ✅ ditolak (`kedalaman stimulus maksimal 1 level`) |
| anti-siklus topik | A→B, lalu `A.parent=B` | ✅ ditolak (`siklus taksonomi`) |
| RESTRICT FK | hapus stimulus yang punya anak | ✅ ditolak (RESTRICT) |
| `usage_count` trigger | taut/lepas `question_tags` | ✅ 0 → 1 → 0 |

**Semua invarian benar-benar menegakkan** — bukan hanya "ada di skema".

### Temuan

#### 🔴 T-M1-1 — Migrasi dari nol RUSAK (ekstensi tak dimuat)

**Gejala:** `pnpm db:migrate` di DB **kosong** menghasilkan **0 tabel**, tanpa error jelas.

**Akar:** `drizzle/0000_*.sql` mendefinisikan `embedding vector(1024)` dan
`USING gin (content_markdown gin_trgm_ops)`, tetapi **tidak ada `CREATE EXTENSION`**
di file migrasi mana pun. Di DB bersih:
```
ERROR: type "vector" does not exist  (0000:108)
 → CREATE TABLE questions GAGAL
 → semua index pada questions GAGAL (relation does not exist)
```

**Dampak:** klaim `CONSTRAINTS.md` *"`db:migrate` harus mereproduksi skema penuh dari
file"* **TIDAK terpenuhi**. DB dev/produksi sekarang dibangun via `db:push` + backfill
manual — **tak bisa** dibangun ulang dari file di lingkungan bersih (mis. CI, deploy baru).

**Perbaikan:**
- **`drizzle/manual/00-extensions.sql`** (BARU) — `CREATE EXTENSION IF NOT EXISTS`
  untuk `pgcrypto`, `pg_trgm`, `vector` (idempotent). Dijalankan **sekali oleh superuser**
  (pgvector menuntut hak superuser — normal).
- **`scripts/db-ensure-extensions.ts`** (BARU) — pra-migrasi: deteksi ekstensi yang
  hilang; buat yang bisa; bila `vector` butuh superuser → **berhenti dengan pesan jelas**
  berisi perintah yang harus dijalankan (bukan gagal misterius di tengah migrasi).
- **`package.json`**: `db:migrate` = `db-ensure-extensions` → `drizzle-kit migrate` → `db:safety`.
  Rantai benar: ekstensi **sebelum** tabel, invarian **sesudah** tabel.

**Verifikasi:** pesan berhenti terbukti muncul (DB verify tanpa `vector` → panduan jelas).
Uji end-to-end penuh menunggu ekstensi dibuat oleh superuser (lihat "Tindakan diperlukan").

#### 🟡 T-M1-2 — MILESTONE mencantumkan `passages` `[x]` padahal tidak ada

**Kenyataan:** tidak ada tabel `passages` di DB/kode/dokumen.
**Penjelasan:** keputusan sadar — stimulus via `parent_id` (`SKEMA-DB-DETAIL.md:31`).
**Perbaikan:** MILESTONE v2.0 sudah menuliskan keputusan ini (bukan `passages`).

#### 🟠 T-M1-3 — `drizzle/manual/db_safety.sql` tidak otomatis di jalur `drizzle-kit migrate`

Invarian kritis (25 trigger, CHECK, HNSW) ada di file manual, dijalankan oleh
`pnpm db:safety` yang di-chain dari `pnpm db:migrate`. Siapa pun yang memanggil
`drizzle-kit migrate` **langsung** akan melewatkan invarian.
**Perbaikan:** didokumentasikan di `KEAMANAN.md`/`CONSTRAINTS.md` bahwa
**selalu pakai `pnpm db:migrate`**, bukan `drizzle-kit migrate` langsung. (Sudah
tercermin di dokumentasi `db-apply-safety.ts`.) → **disarankan** tambah catatan di
`SKEMA-DB-DETAIL.md` §"Cara membangun DB".

### Tindakan diperlukan (superuser, sekali per DB) — ✅ SUDAH DILAKUKAN

Role `mathbank` dijadikan **SUPERUSER** (Opsi cepat, dev lokal):

```bash
sudo -u postgres psql -p 5433 -c "ALTER USER mathbank SUPERUSER;"
```

Setelah itu `pnpm db:migrate` di DB kosong **berhasil**: ekstensi dibuat otomatis →
27 tabel → invarian. Verifikasi hasil:

| Metrik | DB asli | DB hasil migrasi (verify) | Cocok |
|--------|:-------:|:-------------------------:|:-----:|
| tabel | 27 | 27 | ✅ |
| enum | 14 | 14 | ✅ |
| index | 81 | 81 | ✅ |
| FK | 23 | 23 | ✅ |
| CHECK | 2 | 2 | ✅ |
| trigger | 29 | 29 | ✅ |
| HNSW | 1 | 1 | ✅ |
| PK default | `uuidv7()` | `uuidv7()` | ✅ |

Invarian diuji **di DB hasil migrasi** — difficulty 1–5 ✓, level topik 1–3 ✓,
stimulus depth ≤ 1 ✓.

> ⚠️ **Utang (catat di `KEAMANAN.md`):** di **produksi**, role aplikasi **TIDAK BOLEH
> superuser**. Ekstensi dibuat sekali oleh admin (lihat `drizzle/manual/00-extensions.sql`),
> lalu role app tetap least-privilege. Superuser di sini **hanya** kenyamanan dev lokal
> (PG listen localhost). → tambahkan sebagai item S10.

### Kesimpulan M1

Skema **sesuai dokumen & invarian nyata menegakkan** ✅. Cacat serius (migrasi tak
reproduktif) **ditemukan, diperbaiki, dan diverifikasi end-to-end** (skema hasil
migrasi **identik** dengan DB asli di 8 metrik). **M1: ✅ LULUS.**

---

## M2 — *menunggu review*

## M3 — *menunggu review*
