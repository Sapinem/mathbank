# Desain Per-Lapisan MathBank

> **Tujuan:** Mendesain MathBank lapisan demi lapisan (dari nol, kanvas bersih).
> **Status:** L1 ✅ terkunci · lain menyusul.
> **Tanggal:** 2026-09-29.

---

# 🔵 L1 — PENGGUNA & PERAN ✅ TERKUNCI

## Prinsip

1. **Satu modul otorisasi** (`auth/`) — tak tersebar seperti QBank.
2. **Peran formal** (enum) — bukan string bebas.
3. **Multi-role** — 1 akun boleh punya banyak peran.
4. **Non-manusia punya peran juga** — `agent` & `machine`, bukan "tanpa role".

## Peran (Roles)

| Peran | Jenis | Cara masuk | Inti |
|-------|-------|-----------|------|
| `admin` | Manusia | Session | Akses penuh |
| `teacher` | Manusia | Session | Buat/edit soal; tambah topik |
| `reviewer` | Manusia | Session | Setujui soal → `ready` |
| `agent` | Non-manusia | API key / MCP | Agen AI (on-demand) |
| `machine` | Non-manusia | Machine auth | Ingest batch |

## Multi-role (Keputusan)

- Model: **B1 — tabel `user_roles`** (relasi, bukan array).
- **Role utama** (untuk tampilan) terpisah dari **kumpulan role** (untuk izin).
- **Izin = gabungan (union)** semua role; yang paling luas menang.
- Contoh: `teacher` + `reviewer` = bisa ngajar **dan** meninjau.

## Skala
- **<100 user** → multi-role aman; tak perlu RBAC granular.

## Matriks Izin Final

> ⚠️ **Sumber kebenaran = `src/lib/auth/permissions.ts`** (15 permission × 5 peran = 75 sel).
> Tabel di bawah adalah **ringkasan**; bila berbeda, kode yang menang. (Review M2,
> 2026-09-30 — tabel ini sebelumnya menyimpang di beberapa sel.)

| Aksi | admin | teacher | reviewer | agent | machine |
|------|:---:|:---:|:---:|:---:|:---:|
| Lihat soal | ✅ | ✅ | ✅ | ✅ | ❌ |
| Buat soal | ✅ | ✅ | ✅ | ✅ | ✅ *(ingest → draft)* |
| Edit soal **sendiri** | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit soal **orang lain** | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set status `ready` | ✅ | ❌ | ✅ | ❌ | ❌ |
| Archive | ✅ | ❌ | ❌ | ❌ | ❌ |
| Flag (perlu perhatian) | ✅ | own | ✅ | ✅ | ❌ |
| Hapus soal **sendiri** | ✅ | ✅ | ✅ | ❌ | ❌ |
| Hapus soal **orang lain** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Hard-delete** soal sendiri | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Kelola taksonomi** | ✅ | own | own | own | ✅ |
| Kelola sumber/event | ✅ | own | own | own | ❌ |
| Kelola paket soal | ✅ | ✅ | ✅ | ❌ | ❌ |
| Kelola aset media | ✅ | ✅ | ✅ | ✅ | ❌ |
| Kelola pengaturan | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kelola pengguna | ✅ | ❌ | ❌ | ❌ | ❌ |
| Enrichment soal | ✅ | ✅ | ✅ | ✅* | ✅ |
| Kirim ingest (batch) | ✅ | — | — | — | ✅ *(endpoint `/api/ingest/*`, M9)* |

> `own` = teacher/reviewer/agent hanya untuk sumber daya **miliknya** (`authorId === actor.id`).
> `*` **Izin enrichment agen** = keputusan pemilik produk (agen AI boleh enrichment terbatas).
> **Keputusan pemilik produk (review M2, 2026-09-30):** `teacher` & `reviewer` **boleh**
> memicu enrichment manual (lihat §Enrichment 3 jalur: jalur "Manual").
> **Ingest batch** belum jadi permission tersendiri (diimplementasi di M9).

## Enrichment — 3 jalur

| Jalur | Pelaku | Pemicu |
|-------|--------|--------|
| **Worker internal** | Proses latar belakang | Otomatis saat soal masuk |
| **Agen AI (MCP)** | `agent` | On-demand (nanti) — **perlu izin khusus** |
| **Manual** | `teacher`/admin | Edit langsung di UI |

> Worker **bukan aktor** (tak ada login) — proses sistem.

## Agen AI vs Mesin Ingest (pembedaan resmi)

| | **`agent`** | **`machine`** |
|---|---|---|
| Pemicu | Manusia/AI minta (on-demand) | Sistem otomatis (batch) |
| Bentuk | Per-perintah | Pipeline (extract→parse→validate→commit) |
| Masukan | Teks/permintaan | File/dokumen massal |
| Analogi | **Barista** (1 pesan → 1 kopi) | **Pabrik** (bahan → 1000 kopi) |
| Batas | Buat soal/aset; **tak** bundle/hapus/kelola | Hanya endpoint `/api/ingest/*` |

## Struktur Modul (usulan)

```
src/lib/auth/
  roles.ts         — daftar peran (enum) + tipe
  permissions.ts   — matriks izin (peran × aksi)
  actor.ts         — identitas (session/apikey/machine) → Actor
  guards.ts        — helper: requireRole, requirePermission, canEdit...
```

## Skema DB terkait (usulan)

```sql
-- role tersimpan di tabel relasi (multi-role)
CREATE TABLE user_roles (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role    varchar(20) NOT NULL,   -- 'admin'|'teacher'|'reviewer'
  PRIMARY KEY (user_id, role)
);
-- "role utama" untuk tampilan (denormalisasi ringan)
-- bisa: kolom user.primary_role, atau aturan prioritas
```

> Catatan: detail tabel final disatukan saat **L7 — Akses Data**.

## Yang Dibawa dari QBank (referensi)
- `PRIVILEGED_STATUSES = {ready, archived}` — konsep "status terkunci"
- Aturan: guru hanya edit soal **miliknya** & **non-privileged**
- Pola: `assertCanEditQuestion`, `assertStatusPermission`

---

# 🔵 L2 — ANTARMUKA ✅ TERKUNCI

## Struktur Menu (sidebar, 3 grup)

```
KERJA
  Dasbor
  Bank Soal            (dulu "Eksplorer Soal")
  Telaah               (dulu "Antrean Review" + badge)
  Paket Soal

REFERENSI  ▼           ← GRUP BERJUDUL + BISA DILIPAT (cara C)
    Topik              → /references/topics · /topics/[id]
    Sumber & Asal      → /references/sources
    Event              → /references/events
    Label              → /references/labels
    Galeri Aset        → /assets

SISTEM
  Ingest & Integrasi   (disembunyikan sampai M9)
  TikZ Studio          (disembunyikan — ditunda, butuh compiler TeX)
  Pengaturan
```

> **Revisi 2026-10-01:** grup **STUDIO dihapus**. Isinya hanya dua halaman, dan satu
> di antaranya (TikZ Studio) ditunda. Galeri Aset pindah ke grup Referensi dengan URL
> tingkat atas `/assets` (bukan `/studio/assets`). Alasan: prefix `/studio/*` yang hanya
> menyisakan satu stub bukan lagi pengelompokan nyata.

## Keputusan L2

| # | Keputusan |
|---|-----------|
| 1 | **3 grup sidebar**: Kerja · Referensi · Sistem (semula 4 — "Studio" dihapus 2026-10-01) |
| 2 | **Referensi = grup berjudul + bisa dilipat** (cara C); status lipat **diingat** (localStorage) |
| 3 | **Semua halaman Referensi punya halaman turunan** (`/[id]`) |
| 4 | **Event punya halaman** (`/event`, `/event/[id]`) — QBank hanya punya API |
| 5 | **Ingest** pindah ke grup **Sistem** (bukan menu utama) |
| 6 | **Studio & Sistem dipisah** (QBank menggabungnya) |
| 7 | **Menu SAMA** untuk semua peran (beda peran → beda **aksi**, bukan menu) |
| 8 | **Badge "Telaah"** hanya untuk peran relevan (reviewer/admin) — *usulan* |

## Prinsip Visual (dari arah UI yang sudah diputuskan)

- **Gaya:** Linear/Vercel — padat, presisi, border tipis (hairline)
- **Tema:** kerangka generatif (3 warna sumber → seluruh UI)
- **Font:** Roboto Flex + Roboto Mono
- **Mode:** Gelap + Terang, **default ikut OS** (`prefers-color-scheme`)
- **Command palette (⌘K)** untuk navigasi cepat
- **Breadcrumb** konsisten di halaman dalam
- **Tombol "Buat Soal"** di header → **dihapus**

## Peta Halaman

```
Kerja:      / (Dasbor) · /questions · /review-queue · /packages
            /questions/new · /questions/[id] · /questions/[id]/edit
            /packages/new · /packages/[id] · /packages/[id]/edit
Referensi:  /topik · /topik/[id] · /sumber · /sumber/[id]
            /event · /event/[id] · /label · /label/[id]
Studio:     /assets · /tikz
Sistem:     /ingest · /settings
Auth:       /login · /change-password
```

## Yang Dibawa dari QBank (referensi)
- Struktur halaman (19 halaman) — dipetakan ulang ke 3 grup
- Komponen shell: Sidebar (shadcn resmi), Breadcrumb, CommandPalette, ThemeToggle
- Kerangka tema generatif (`scripts/theme/build.ts`) + token OKLCH (`--mb-*`)

---

# 🔵 L3 — STATE / KLIEN ✅ TERKUNCI

## Tiga Jenis State (sama seperti QBank, dirapikan)

| Jenis | Teknologi | Dipakai untuk |
|-------|-----------|--------------|
| **Server state** | React Query (`@tanstack/react-query`) | Data soal, sumber, aset, user |
| **Client state** | React Context | **Hanya tema** |
| **URL state** | Query string | Filter eksplorer, halaman (bisa di-bookmark) |

## Keputusan L3

| # | Keputusan |
|---|-----------|
| 1 | **Hook kecil & fokus** — 1 tanggung jawab, maks ~100 baris (bukan raksasa 381 baris) |
| 2 | **`staleTime` per-jenis** — bukan global seragam |
| 3 | **Patuhi larangan `useMemo`/`useCallback`** sejak awal (React Compiler) |
| 4 | **URL state** untuk filter eksplorer (bookmarkable) |
| 5 | **Context hanya tema** global; selebihnya React Query + URL |

## staleTime per-jenis (usulan)

```ts
const STALE = {
  taxonomy:    30 * 60_000,  // 30 mnt — topik/event jarang berubah
  questions:   30_000,       // 30 dtk
  reviewQueue: 10_000,       // 10 dtk — sering berubah
  user:        5 * 60_000,   // 5 mnt
}
```

## Struktur Hook (pola)

```
useQuestionList     — fetch + filter + paginasi
useQuestionDetail   — satu soal
useQuestionExport   — ekspor (moodle/dll)
useExplorerUI       — view mode, modal (client state)
useReviewQueue      — antrean telaah
useCurrentUser      — identitas (via /api/auth/me)
```

## Perbaikan dari QBank (hutang teknis yang TIDAK dibawa)

| Masalah QBank | MathBank |
|---------------|----------|
| `useMemo`/`useCallback` dipakai meski dilarang (7-8×) | ✅ Bersih sejak awal |
| Hook 381 baris (multi-tanggung jawab) | ✅ Dipecah |
| `staleTime` global seragam | ✅ Per-jenis |
| Identitas via `/api/auth/change-password` (aneh) | ✅ `/api/auth/me` |

---

# 🔵 L4 — API (Route Handlers) ✅ TERKUNCI

## Dua Wajah API (satu konvensi)

| Wajah | Prefix | Auth | Untuk |
|-------|--------|------|-------|
| Internal (UI) | `/api/*` | Session | Guru, admin (UI) |
| Mesin (ingest) | `/api/ingest/*` | Machine | Pipeline batch |

## Keputusan L4

| # | Keputusan |
|---|-----------|
| 1 | **Pembungkus route (handler wrapper)** — hilangkan boilerplate auth/try-catch/Zod |
| 2 | **Format respons tunggal**: `{ data }` (sukses) · `{ error: { code, message } }` (gagal) |
| 3 | **Validasi Zod seragam** (query + body + respons) — bukan parse manual |
| 4 | **Otorisasi dari matriks L1** — wrapper ambil izin dari sana, bukan cek `role` tersebar |
| 5 | **Dua wajah, satu konvensi** — beda hanya `auth` (session vs machine) |

## Bentuk Route (pola baru)

```ts
export const GET = route({
  auth: 'teacher',              // peran minimum (dari matriks L1)
  query: QuestionFilterSchema,  // validasi Zod otomatis
  handler: async ({ actor, query }) => {
    return QuestionService.list(query, actor);
  },
});
```

**Pembungkus urus:** auth + validasi + try/catch + format respons → **~10 baris/route** (dari ~60).

## Format Respons

```ts
// Sukses
{ data: T }

// Error
{ error: { code: 'NOT_FOUND', message: '...' } }
```

## Perbaikan dari QBank (hutang teknis yang TIDAK dibawa)

| Masalah QBank | MathBank |
|---------------|----------|
| Boilerplate auth/try-catch di 39 route | ✅ Pembungkus |
| Respons error tak seragam | ✅ Format tunggal |
| Validasi manual (`parseQuestionType`) | ✅ Zod |
| Otorisasi tersebar di route | ✅ Matriks L1 terpusat |

---

# 🔵 L5 — LAYANAN (Domain Logic) ✅ TERKUNCI

## Pola & Aturan

| # | Keputusan |
|---|-----------|
| 1 | **Fungsi biasa** (bukan class static) — tak ada state, jadi class tak berguna |
| 2 | **Pecah service besar** — panduan maks ~300 baris; folder per-domain |
| 3 | **Filter builder = modul terpisah** (`question/filters.ts`) — mudah diuji |
| 4 | **Tanpa lapisan repository** — service langsung ke DB (Drizzle). Skala <100 user; repo = over-engineering |
| 5 | **Ganti `reference-data-service` generic** dengan service per-domain (eksplisit > pintar) |

## Struktur Layanan (usulan final)

```
src/lib/services/
  question/          create · query · lifecycle · media · filters
  source/            (buku, web, institusi)
  event/
  topic/             (3-level)
  grade/ · difficulty/ · cognitive/
  tag/
  bundle/
  solution/
  asset/
  ingest/            queue · commit · validator
  moodle/            (FASE BERIKUTNYA — bukan sekarang)
  settings/ · backup/
```

## Pola Kode

```ts
// bukan class static:
export async function createQuestion(input, actor) { ... }

// service pecah per tanggung jawab:
// question/create.ts   — create + update
// question/query.ts    — list + filter + count
// question/lifecycle.ts— status + delete + restore + purge
// question/media.ts    — sinkron media + source
// question/filters.ts  — buildFilterConditions
```

## Perbaikan dari QBank (hutang teknis yang TIDAK dibawa)

| Masalah QBank | MathBank |
|---------------|----------|
| `question-service` 1010 baris (God Object) | ✅ Dipecah, maks ~300 |
| `asset-service` 712 · `tag-service` 547 | ✅ Dipecah |
| `class static` tanpa state | ✅ Fungsi biasa |
| `buildFilterConditions` ~200 baris di dalam service | ✅ Modul terpisah |
| `reference-data-service` generic 467 baris | ✅ Per-domain |

---

# 🔵 L6 — MODUL / ENGINE ✅ TERKUNCI

## Aturan Tegas

> **L6 = FUNGSI MURNI** — tanpa DB, tanpa network. Yang butuh DB/network → naik ke L5.

| # | Keputusan |
|---|-----------|
| 1 | **FSM DIPAKAI betulan** — semua transisi status via FSM (bukan manual seperti QBank) |
| 2 | **Tak ada kode mati** — kalau dibuat → dipakai & diuji. Kalau tidak → jangan dibuat |
| 3 | **Parser dipecah** jadi fungsi kecil teruji (paling rawan bug) |
| 4 | **Engine = fungsi murni** (input→output, tanpa DB) — mudah diuji |
| 5 | **`document-processor` dinamai jujur** → `ingest/extract.ts`; dikembangkan hanya saat perlu multi-format |

## Struktur L6 (final)

```
src/lib/
  ingest/
    parsers/          — unescape · clean · normalize · parseArticle (teruji)
    extract.ts        — ekstraksi teks (bukan "modul" besar)
  fsm/
    question-fsm.ts   — DIPAKAI untuk semua transisi status
  search/
    dedup.ts · rrf.ts · metrics.ts
  math/
    katex-config.ts · math-config.ts
  telemetry/
    logger.ts
  idempotency.ts
```

## Perbaikan dari QBank (hutang teknis yang TIDAK dibawa)

| Masalah QBank | MathBank |
|---------------|----------|
| `question-fsm.ts` 263 baris **KODE MATI** (0 pemakaian, 0 tes) | ✅ Dipakai betulan untuk semua transisi |
| Transisi status manual di `question-service` | ✅ Via FSM, tak bisa dilanggar |
| `corpus-parser` 641 baris monolitik | ✅ Dipecah, teruji |
| `document-processor` (nama besar, isi 45 baris) | ✅ Dinamai jujur |

## Batas L6
- **Tanpa DB** (tak impor Drizzle)
- **Tanpa network** (tak fetch)
- **Fungsi murni** — deterministik, mudah diuji

---

# 🔵 L7 — AKSES DATA ✅ TERKUNCI

> **Detail lengkap:** `docs/L7-TINJAUAN-KRITIS-DATA.md` (17 temuan + rekomendasi + skema final).
> **Basis:** `ARSITEKTUR-DATA-FINAL.md` (v2) — ditinjau ulang dengan kacamata kanvas bersih.

## Ringkasan Perbaikan v2 → L7

| # | Perubahan |
|---|-----------|
| T1 | Semua `role` → **enum** (bukan campur enum/varchar) |
| T2-T3 | **Timestamp seragam** (`created_at`/`updated_at` di semua tabel) |
| T4 | `author_type` **sinkron L1** (`teacher\|agent\|machine\|system`) |
| T5-T6 | **Skema `answer_key` & `data_payload` per-tipe** (11 tipe) |
| T7 | **Invarian stimulus** (bacaan≠anak, 1 level) + CHECK |
| T8 | **Slug partial-unique** (abaikan yang soft-deleted) |
| T9 | **Header naskah** (`academic_year`, `subject`, `compiled_by`) |
| T10 | **`asset_type`** enum di `media_assets` |
| T11 | **Panduan panjang varchar** tetap |
| T12 | `usage_count` via **trigger** |
| T15 | **`audit_logs` generik** (ganti 2 tabel audit) |
| T16 | **`ingest_queue` = antrean file** (bukan hasil) |

## Rekomendasi Teknis L7

| # | Hal | Keputusan |
|---|-----|-----------|
| 6.1 | File schema | **1 file per-domain** (~14 file, bukan 23) |
| 6.2 | Koneksi DB | **Pola sama** (postgres.js pool) |
| 6.3 | Migrasi | **Campuran** — Drizzle Kit + SQL tangan untuk yang krusial |
| 6.4 | Verifikasi skema | **Ya** — skrip cek (cegah drift) |
| 6.5 | Seed | **Migrasi terpisah** (taksonomi + event + admin bootstrap) |
| 6.6 | `owner_id` | **Di `questions` & `bundles`** |

## Struktur File Schema (6.1)

```
src/lib/db/schema/
  index.ts · enums.ts · question.ts · solution.ts · source.ts
  event.ts · topic.ts · taxonomy.ts · bundle.ts · media.ts
  audit.ts · ingest.ts · auth.ts · settings.ts
```

## Invarian Utama
- `difficulty` 1..5
- stimulus: bacaan tak jadi anak; anak bukan bacaan; **1 level**
- flagged tak boleh `ready`
- slug unik hanya untuk yang belum dihapus

---

# 🔵 L8 — DATABASE ✅ TERKUNCI

## Kapabilitas (PostgreSQL 18 — target)

> **Status pemasangan:** ⏸️ **DITUNDA** (diputuskan kemudian). Arsitektur mengasumsikan PG 18.

| # | Keputusan |
|---|-----------|
| 1 | **PG 18** (via repo PGDG), **berdampingan** — MathBank :5433, QBank tetap :5432 |
| 2 | **URL:** `postgresql://mathbank:***@localhost:5433/mathbank` |
| 3 | **UUID PK: `uuidv7()`** (berurutan waktu → index lebih rapi) |
| 4 | **Ekstensi:** `pg_trgm` + `vector` (cukup; tak pakai pgcrypto/unaccent) |
| 5 | **Backup:** manual + terjadwal |
| 6 | Embedding **inline** (`questions.embedding`), index **HNSW** |
| 7 | Trigger: `updated_at` + `usage_count` |

## Verifikasi Ketersediaan (sudah dicek ✅)

| Paket | Status | Versi |
|-------|--------|-------|
| `postgresql-18` | ✅ Ada di PGDG `trixie-pgdg` | 18.6 |
| `postgresql-18-pgvector` | ✅ Ada | **0.8.6** (lebih baru dari 0.8.0 QBank) |

## Panduan Pemasangan (untuk nanti)

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt update
sudo apt install -y postgresql-18 postgresql-18-pgvector
sudo sed -i 's/^port = .*/port = 5433/' /etc/postgresql/18/main/postgresql.conf
sudo pg_ctlcluster 18 main start
# buat DB mathbank + ekstensi pg_trgm & vector
```

## Penyesuaian DDL untuk PG 18

```sql
id uuid PRIMARY KEY DEFAULT uuidv7()   -- berurutan waktu (PG 18), index B-tree lebih rapi
```

| Aspek | PG 17 | **PG 18 (MathBank)** |
|-------|-------|---------------------|
| Versi | 17.11 | **18.6** |
| Port | 5432 | **5433** (berdampingan) |
| UUID | `gen_random_uuid()` | **`uuidv7()`** |
| pgvector | 0.8.0 | **0.8.6** |
| Skip scan / async I/O | ✗ | ✅ (gratis) |

## Ekstensi & Index

| Kapabilitas | Teknologi | Untuk |
|-------------|-----------|-------|
| Pencarian fuzzy | `pg_trgm` (GIN) | Typo-tolerant |
| Pencarian semantik | `vector` + HNSW | Cari soal mirip |
| Filter umum | B-tree | status, grade, FK |

## Perbaikan dari QBank
- Embedding **satu tempat** (QBank punya 2: inline + `question_embeddings`) ✅
- PG 18 + pgvector 0.8.6 (QBank: PG 17 + 0.8.0) ✅

---

# 🔵 L9 — LAYANAN LUAR + MCP ✅ TERKUNCI

## Layanan Eksternal

| Layanan | Integrasi | Konfigurasi |
|---------|-----------|-------------|
| **LLM** | HTTP (OpenAI-compatible) | **`app_settings`** (diatur via UI) |
| **Embedding (BGE-M3)** | HTTP, service lokal | ENV `BGE_M3_SERVICE_URL`, dim **1024** |
| **LaTeX/TikZ** | `spawn` subprocess | ENV `TIKZ_TMP_ROOT` |
| **Storage media** | Filesystem (abstraksi) | ENV `MEDIA_STORAGE_PATH` |
| **Moodle** | GitSync (file) | ⏭️ **FASE BERIKUTNYA** |

## Keputusan L9

| # | Keputusan |
|---|-----------|
| 1 | **MCP dibakukan** — `policy.ts` (kebijakan tulis 1 tempat) + tool **enrichment** (izin khusus dari L1) |
| 2 | **LLM = satu gerbang `ai/client.ts`** yang **BACA SETTING** (provider = konfigurasi, **bukan hard-code**) |
| 3 | **LaTeX — keamanan dibawa**: `openin_any='p'` (mitigasi LFI) + temp `/tmp` ⚠️ |
| 4 | **Embedding** — BGE-M3, dim **1024**, validasi ketat `.length(1024)` |
| 5 | **Storage — abstraksi tipis** (`storage/media.ts`) — filesystem sekarang, bisa pindah S3 |
| 6 | **Moodle — SKIP** (fase berikutnya) |

## AI = Konfigurasi, bukan Kode (keputusan kunci)

> Provider AI **TIDAK** di-hard-code. Disimpan di `app_settings`, diatur via **UI Pengaturan**.
> Kode hanya baca setting → panggil endpoint (asumsi **OpenAI-compatible**).

```
app_settings:
  ai.base_url    — endpoint (9router / OpenAI / apa saja, OpenAI-compatible)
  ai.api_key     — kunci (terenkripsi, tak di kode)
  ai.model       — model default
  ai.enabled     — on/off
```

**Keuntungan:** ganti provider tanpa ubah kode; 9router = salah satu nilai; beda setting per-lingkungan.

## MCP — Kebijakan Tulis `policy.ts` (dari L1)

```
agent BOLEH:  buat soal · buat aset · cari · enrichment (izin khusus)
agent TIDAK:  bundle · hapus · ubah status · kelola taksonomi
```

## Struktur L9 (final)

```
src/
  mcp/
    server.ts        — setup server MCP
    policy.ts        — KEBIJAKAN TULIS agen (1 tempat)
    tools/
      question.ts · search.ts · asset.ts · enrich.ts
  lib/
    ai/
      client.ts      — satu gerbang LLM (BACA SETTING)
    embedding/
      bge-m3.ts      — dim 1024, validasi ketat
    storage/
      media.ts       — abstraksi simpan/ambil file
    latex/
      compile.ts     — spawn latex (openin_any='p', temp /tmp)
```

## ENV (infrastruktur)
```
BGE_M3_SERVICE_URL    — embedding (infrastruktur, bukan preferensi)
MEDIA_STORAGE_PATH    — media
TIKZ_TMP_ROOT         — latex temp
DATABASE_URL          — DB
BETTER_AUTH_SECRET / BETTER_AUTH_URL
```

## Perbaikan dari QBank
- MCP: kebijakan tulis **terpusat** (QBank tersebar) ✅
- LLM: provider **dari setting** (QBank hard-code OpenAI/OpenRouter) ✅
- Storage: **abstraksi** (QBank langsung filesystem) ✅
- LaTeX: keamanan **dibawa** (`openin_any='p'`) ✅

---

# ✅ SEMUA 9 LAPISAN SELESAI

| Lapisan | Status | Inti |
|---------|--------|------|
| L1 Pengguna & Peran | ✅ | Multi-role, 5 peran, matriks izin |
| L2 Antarmuka | ✅ | 3 grup, referensi submenu lipat |
| L3 State/Klien | ✅ | Hook kecil, staleTime per-jenis |
| L4 API | ✅ | Pembungkus route, respons tunggal |
| L5 Layanan | ✅ | Fungsi, pecah, tanpa repo |
| L6 Modul/Engine | ✅ | FSM dipakai, fungsi murni |
| L7 Akses Data | ✅ | Tinjauan kritis 17 temuan |
| L8 Database | ✅ | PG 18 target, uuidv7, pgvector |
| L9 Luar + MCP | ✅ | AI=konfigurasi, MCP policy |

**Berikutnya:** pembuatan MathBank (lihat `CETAK-BIRU-MATHBANK.md`).

---

*Dokumen ini diisi progresif seiring pembahasan per-lapisan.*
