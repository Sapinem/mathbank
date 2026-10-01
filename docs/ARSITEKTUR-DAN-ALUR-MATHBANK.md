# ARSITEKTUR-DAN-ALUR-MATHBANK.md — Arsitektur Sistem, Alur Data & Penggunaan DB

> **Status:** ✅ **AKTUAL** — disusun 2026-10-01 dari **sumber primer**
> (kode `src/`, migrasi `drizzle/`, live DB), **bukan** dari dokumen rencana.
> Bila dokumen rencana berbeda dengan berkas ini, **berkas ini yang benar**
> (karena diverifikasi ke kode).
> **Kaitan:** `docs/AUDIT-DB-2026-10-01.md`, `docs/DESAIN-PER-LAPISAN-MATHBANK.md`
> (rencana awal — sebagian sudah tidak akurat), `CONSTRAINTS.md`

---

## 1. Ringkasan Sistem

**MathBank** = bank soal **matematika** (Next.js 16 · React 19 · PostgreSQL 18).
Satu institusi, skala kecil (<100 pengguna). Perannya:

1. **Menyimpan** soal matematika (11 tipe, rumus KaTeX, media).
2. **Mencari** dengan filter + pencarian semantik.
3. **Menyusun** paket soal.
4. **Menerbitkan** lewat cetak/PDF & ekspor Moodle.

**Model data inti (1 kalimat):** *satu butir soal* terhubung ke *taksonomi*
(topik/kelas/kesulitan/kognitif), ke *sumber* (provenance, many-to-many),
ke *pembahasan* (many), dan ke *paket* (many).

---

## 2. Arsitektur Berlapis (L1–L9)

Direktori kode mengikuti 9 lapisan. **Aturan tegas:** lapisan atas boleh
memanggil bawah, **tidak sebaliknya**.

```
L9  Layanan luar + MCP      src/lib/mcp/, src/app/api/v1/ingest/, src/lib/ai/
L8  Database (PostgreSQL)   src/lib/db/ (koneksi), drizzle/ (migrasi)
L7  Akses data              src/lib/db/schema/ (Drizzle), src/lib/db/projections/
L6  Modul / engine MURNI    src/lib/fsm/, math/, search/, export/, contracts/
L5  Layanan (domain logic)  src/lib/services/
L4  API (route handlers)    src/app/api/**/route.ts + src/lib/api/
L3  State / klien           src/lib/hooks/ (React Query)
L2  Antarmuka               src/app/(app)/**, src/components/
L1  Pengguna & peran         src/lib/auth/
```

### L1 — Pengguna & Peran ✅
- **5 peran:** `admin`, `teacher`, `reviewer`, `agent`, `machine`.
- **Multi-role** (`user_roles` tabel) — izin = **union terkuat** (`yes` > `own` > `no`).
- **Satu tempat izin:** `src/lib/auth/permissions.ts` (matriks peran × aksi).
- **`own`** = hanya sumber daya miliknya (`ownerId === actor.id`).
- **Gate:** `can()` / `assertCan()` (`guards.ts`) — fungsi murni, tak sentuh DB.
- **Resolusi aktor** (`resolve.ts`), 3 jalur: session cookie (Better Auth),
  API key (agen), dev-bypass (**mati paksa di produksi** — pagar keras).

> ⚠️ **Cacat diketahui (belum diperbaiki):** `bundle:manage` = `yes` untuk
> teacher/reviewer + `listBundles` tanpa filter pemilik → **guru bisa menyentuh
> bundle guru lain**. Lihat `AUDIT-DB-2026-10-01.md` §4.

### L2 — Antarmuka ✅
Halaman aktif (`src/app/(app)/`):

| Halaman | Rute | Fungsi |
|---|---|---|
| Dasbor | `/` | Ringkasan (stats) |
| Bank Soal | `/questions` | Daftar + filter; 3 mode (list/grid/masonry) |
| Detail Soal | `/questions/[id]` | Lihat 2 kolom + sumber |
| Sunting Soal | `/questions/[id]/edit` | Editor (G8) |
| Soal Baru | `/questions/new` | Editor |
| Telaah | `/review` | Kurasi (approve/tolak) |
| Paket Soal | `/bundles` (+`[id]`, `/edit`, `/print`) | Susun & cetak |
| Referensi | `/references/{topics,sources,events,labels}` | Taksonomi |
| Studio | `/studio/tikz` | TikZ → SVG |
| Sistem | `/system/{ingest,settings}` | Ingest & pengaturan |
| Aset | `/assets` | Galeri media |

### L3 — State / Klien ✅
- **Tanpa Redux/Zustand.** Semua data server lewat **React Query** (`src/lib/hooks/`).
- Hook pola: satu hook per resource (`use-questions`, `use-bundles`, `use-media`, …).
- **Dilarang `useMemo`/`useCallback`** (konvensi proyek — CONSTRAINTS #6),
  kecuali `components/ui/**` (vendor shadcn).
- State UI lokal: `useState` (filter, dialog) + `localStorage` (autosave editor).

### L4 — API (Route Handlers) ✅
- **Semua route dibungkus `wrapRoute`** (`src/lib/api/route-wrapper.ts`).
- Alur baku satu request:

```
Request → wrapRoute
  ├─ 1. resolveActor(headers)      → Actor | null   (L1)
  ├─ 2. assertCan(actor, perm)     → 403 bila tak boleh (L1)
  ├─ 3. rateLimit (token bucket)   → 429 bila lewat   (CONSTRAINTS #33)
  ├─ 4. handler()                  → memanggil SERVICE (L5)
  ├─ 5. validasi Zod (boundary)    → 400              (#22)
  └─ 6. format respons tunggal
```

- **Format respons TUNGGAL:** sukses `{ data }`, gagal `{ error: { code, message } }`.
- **Rate limit wajib** di endpoint mutasi & daftar (#33).

### L5 — Layanan (Domain Logic) ✅
`src/lib/services/` — **16 modul**, fungsi biasa (bukan class), maks ~300 baris/file.

| Service | Tanggung jawab |
|---|---|
| `question-read` / `question-write` | Baca/tulis soal (proyeksi eksplisit) |
| `question-service` / `question-status` / `question-bulk` | Orkestrasi, transisi status, batch |
| `bundle-service` | Paket soal (compose, item, reorder, validate, duplicate) |
| `question-source-service` | Provenance per-butir (ADR-0012) |
| `taxonomy-service` / `topic-service` | Taksonomi (topik, sumber, event, label) |
| `media-service` | Galeri media |
| `moodle-export-service` | Ekspor Moodle XML (+GitSync) |
| `enrichment-service` | AI tagging/embedding (M10) |
| `audit` | Jejak audit (append-only) |
| `settings-service` / `ai-settings-service` / `agent-key-service` | Konfigurasi |

**Aturan L5:** tanpa repo layer, tanpa `SELECT *`, inisiatif transaksi di sini.

### L6 — Modul / Engine MURNI ✅
**Tanpa DB, tanpa network.** Dapat diuji sepenuhnya tanpa infra.

| Modul | Isi |
|---|---|
| `fsm/question-fsm` | Mesin status soal (draft→review→ready→archived) |
| `math/katex-lint` | Linter rumus pra-simpan |
| `search/*` | Trigram, RRF fusion, dedup dua-tingkat |
| `export/*` | Moodle XML, GitSync, LaTeX→Moodle |
| `contracts/*` | Skema Zod (bentuk input/output) |
| `display/labels` | Label Indonesia (nama teknis tetap Inggris) |

### L7 — Akses Data ✅
- **Drizzle ORM**, skema di `src/lib/db/schema/` (10 modul).
- **Nama tabel & kolom: `snake_case`** (#30).
- **Proyeksi eksplisit WAJIB** (#34): `questionColumns()`/`optionColumns()` —
  jangan `.select()` tanpa kolom (membocorkan `answer_key`, `embedding*`).
- **Kunci jawaban** hanya untuk viewer berwenang (`canSeeAnswerKey`).

### L8 — Database ✅
PostgreSQL 18, port 5433, ekstensi `vector` + `pg_trgm`.
**29 tabel · 26 trigger · 3 CHECK · 1 index HNSW** (terverifikasi `pnpm db:verify`).
**Wajib direproduksi dari file** (#24) & **tak boleh drift** (#25).

### L9 — Layanan Luar + MCP ✅
- **AI/9router** — konfigurasi di `app_settings` (**bukan hard-code**, #18).
- **Embedding** bge-m3 (dim 1024) → HNSW.
- **Ingest** — `/api/v1/ingest/{upload,queue,commit}` (jalur mesin, Bearer token).
- **MCP** — `/api/mcp` untuk agen (tool: question/search/asset/enrich).
- **Moodle GitSync** — tulis XML ke folder Git.

---

## 3. Alur Data (contoh nyata, dari kode)

### 3.1 Guru menyimpan soal
```
UI (question-editor)
 → POST /api/questions                    [L4]
     resolveActor → assertCan(question:create) → rateLimit → Zod
 → createQuestion(input, actor)           [L5 question-write]
     db.transaction:
       INSERT questions        (+ contentHash, status=draft)
       INSERT question_options
       INSERT solutions        (pembahasan multi, ADR-0012/0013)
       INSERT question_topics / question_tags
 → INSERT audit_logs (action:"create")    [L5 audit]
 → { data: { id } }
```

### 3.2 Ingest artikel (jalur mesin)
```
upload → ingest_queue (status=queued)      [L8]
 → markProcessing → processQueueItem()     [L5 ingest/service]
     parser adapter (mathcyber|defantri)   [L6 parsers]
     ekstrak soal + media (applyMedia)     [L5 media]
 → commitItems()
     dedup EXACT via content_hash (unik partial)
     INSERT questions + question_sources   (provenance per-butir)
 → enrichment → embedding → HNSW           [L9 AI]
```

### 3.3 Mencari soal
```
GET /api/questions?q=…&mode=text|semantic  [L4]
 → searchQuestions()                        [L5]
     mode=text     → trigram (pg_trgm, GIN)
     mode=semantic → embedding `<=>`, HNSW
     fusion (RRF) + dedup dua-tingkat       [L6 search/fusion]
 → proyeksi questionColumns()               [L7]  ← kunci disembunyikan bila tak berwenang
```

### 3.4 Menyusun & mencetak paket
```
POST /api/bundles/{id}/items   → addItem()          [L5 bundle-service]
GET  /api/bundles/{id}         → listBundleItems()  (opsi + kunci bila berwenang)
/print                         → cetak browser (print CSS)
/export/moodle                 → moodle-export-service → XML + GitSync
```

---

## 4. Penggunaan Database

### 4.1 Peta tabel (29) — dari mana & untuk apa

| Kelompok | Tabel | Peruntukan |
|---|---|---|
| **Inti soal** | `questions`, `question_options`, `solutions` | Butir, opsi, pembahasan (many-solution) |
| **Provenance** | `question_sources`, `sources`, `books`, `institutions`, `events` | Asal-butir (many-to-many), master sumber, detail buku/sekolah, jenis ujian |
| **Taksonomi** | `topics`, `question_topics`, `tags`, `question_tags`, `grades`, `difficulty_levels`, `cognitive_levels` | Materi, label, jenjang, kesulitan 1–5, kognitif L1–L3 |
| **Paket** | `bundles`, `bundle_items` | Naskah/paket soal |
| **Media** | `media_assets`, `question_media` | Galeri gambar/TikZ/SVG, relasi ke soal |
| **Auth** | `user`, `session`, `account`, `verification`, `user_roles`, `apikey` | Better Auth + multi-role + API key agen |
| **Sistem** | `app_settings`, `audit_logs`, `ingest_queue`, `rate_limit` | Konfigurasi, jejak audit (immutable), antrean ingest, limiter |

Detail lengkap (asal migrasi, jumlah baris, pemakaian): `AUDIT-DB-2026-10-01.md`.

### 4.2 Relasi inti

```
                    ┌──────────────┐
                    │   sources    │ (master: buku/web/sekolah/lomba)
                    └──────┬───────┘
             ┌─────────────┼──────────────┬──────────────┐
             ▼             ▼              ▼              ▼
        ┌────────┐   ┌──────────┐  ┌────────────┐  ┌──────────────┐
        │ books  │   │institutions│ │questions   │  │question_sources│
        └────────┘   └──────────┘  │ .source_id │  │ (per-butir,    │
                                    └─────┬──────┘  │  many-to-many) │
                                          │         └───────────────┘
                                          │              ▲
        ┌─────────┐   ┌──────────────┐    │              │
        │ topics  │◄──┤question_topics├────┤              │
        └─────────┘   └──────────────┘    │              │
        ┌─────────┐   ┌──────────────┐    │              │
        │  tags   │◄──┤question_tags ├────┤              │
        └─────────┘   └──────────────┘    │              │
                                          ▼              │
                                   ┌─────────────┐       │
                                   │  questions  │◄──────┘
                                   └──────┬──────┘
              ┌──────────────┬────────────┼────────────┬──────────────┐
              ▼              ▼            ▼            ▼              ▼
     ┌────────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐
     │question_options│ │solutions │ │question_ │ │bundle_items│ │questions│
     │                │ │ (many)   │ │  media   │ │            │ │.parent_id│
     └────────────────┘ └──────────┘ └──────────┘ └─────┬──────┘ │(stimulus)│
                                                         ▼        └─────────┘
                                                    ┌─────────┐
                                                    │ bundles │
                                                    └─────────┘
```

**Kunci relasi:**
- `questions.parent_id` → **stimulus** (wacana bersama, maks 1 level — trigger).
- `question_sources` = **provenance per-butir, many-to-many** (1 soal : N sumber).
- `content_hash` = **anti-duplikat** lintas sumber (unik partial, `deleted_at IS NULL`).
- `bundle_items.question_id` → **RESTRICT** (soal terkunci paket — cegah hapus; #46).

### 4.3 Invarian yang ditegakkan DB

| Invarian | Cara ditegakkan |
|---|---|
| Stimulus maks 1 level | Trigger `trg_questions_stimulus_depth` |
| Topik tak boleh siklus | Trigger `trg_topics_cycle` |
| `usage_count` topik/tag akurat | Trigger `recount_*_usage` |
| `updated_at` otomatis | 22 trigger (daftar eksplisit di `db_safety.sql`) |
| `audit_logs` append-only | Trigger `reject_audit_mutation` |
| Kesulitan 1–5, level topik | CHECK `chk_questions_difficulty`, `chk_topics_level` |
| Pencarian vektor | Index HNSW (cosine, m=16, ef=64) |
| Slug unik antar-aktif | Unique partial (`deleted_at IS NULL`) |

### 4.4 Aturan penggunaan DB (WAJIB)

1. **Reproduktif dari file** — `pnpm db:migrate` di DB kosong = skema penuh (#24).
   *Diverifikasi 2026-10-01: 29 tabel, 26 trigger, hijau.*
2. **`pnpm db:verify` hijau** — gagal = drift (#25).
3. **Migrasi tulis-tangan** → `drizzle/manual/` + `pnpm db:safety`, **jangan** campur
   alur drizzle-kit (#26).
4. **Proyeksi eksplisit** di jalur baca API (#34) — cegah bocornya `answer_key`.
5. **Invarian lunak di service**, bukan CHECK keras (#27) — mis. `ready` butuh kunci.
6. **RESTRICT hanya hitung induk AKTIF** (#46) — cegah entitas terarsip menyandera anak.
7. **⚠️ Sebelum menambah tabel: buktikan informasinya belum ada** (pelajaran ADR-0013
   yang dibatalkan — `collections` ternyata menduplikasi `question_sources`).

---

## 5. Kondisi & Utang Teknis (per 2026-10-01)

| Prioritas | Utang | Bukti |
|---|---|---|
| 🔴 | **Izin owner bundle tak ditegakkan** — guru bisa sentuh bundle guru lain | `bundle:manage`=yes; `listBundles` tanpa filter (#35) |
| 🟠 | **5 tabel tanpa data** (pemisahan terbengkalai) | `events`, `books`, `institutions`, `question_media`, `question_tags` |
| 🟠 | **Koleksi vs Latihan belum dipisah di UI** (Opsi 2) | Sidebar cuma "Paket Soal" |
| 🟡 | **`year` di 4 tempat** — perlu konsolidasi | `question_sources`, `books`, `bundles`, `questions.event_year` |
| 🟡 | **Keputusan di luar repo** | Spec 2 Sep di `/home/hari/docs/`, catatan di Mnemosyne |
| 📌 | **Aturan baru: audit-dulu sebelum tambah tabel** | ADR-0013 dibatalkan |

---

## §Catatan Verifikasi

- **Verifikator:** agen (atas perintah pemilik produk).
- **Metode:** pembacaan langsung kode `src/` (lapisan, service, route, hook,
  wrapper), migrasi `drizzle/`, dan kueri live DB. **Bukan** dari `docs/DESAIN-*`
  yang berisi usulan lama.
- **Terverifikasi benar:**
  - 9 lapisan cocok dengan struktur direktori nyata.
  - 16 service, 48 route, 13 hook, 18 halaman (dihitung dari filesystem).
  - Alur `wrapRoute` (resolveActor → assertCan → rateLimit → handler) cocok
    baris 276–291 `route-wrapper.ts`.
  - DB: 29 tabel / 26 trigger / 3 CHECK / 1 HNSW — `pnpm db:verify` hijau.
  - `pnpm db:migrate` di DB kosong → skema penuh (uji nyata, DB sementara).
- **Koreksi terhadap dokumen lama:** `DESAIN-PER-LAPISAN-MATHBANK.md` ditulis
  saat perencanaan; angka & bentuk di sana (mis. jumlah tabel, `collections`)
  **sudah tidak akurat**. Berkas ini menggantikannya sebagai rujukan arsitektur.
