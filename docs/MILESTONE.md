# MILESTONE — MathBank (Rencana Eksekusi)

> **Dokumen ini menjawab:** *Urutan pembangunan MathBank — apa dulu, apa kemudian, kapan selesai?*
> **Status:** 📝 Draft v1 — menunggu ratifikasi.
> **Versi:** 1.0 · **Tanggal:** 2026-09-29
> **Rujukan:** `PRD.md` (ruang lingkup), `DESAIN-PER-LAPISAN-MATHBANK.md` (L1–L9).

---

## Prinsip

1. **Fondasi dulu** — skema DB & auth sebelum fitur.
2. **Tiap milestone berdiri sendiri** — ada hasil nyata, gate `pnpm check` hijau.
3. **Batasan mutu** — setiap milestone menutup dengan: typecheck 0, lint 0, test hijau, build sukses.
4. **Tulang → daging** — dokumen detail (API/ingest/dll) ditulis saat gilirannya.

**Legenda status:** ⬜ belum · 🟡 berjalan · ✅ selesai
**Legenda prioritas:** 🔴 wajib MVP · 🟡 penting · 🟢 nanti

---

## Peta Milestone

| M | Nama | Prioritas | Dependensi | Perkiraan | Status |
|---|------|-----------|------------|-----------|:------:|
| M0 | Fondasi | 🔴 | — | ✅ selesai | ✅ |
| M1 | Skema Database | 🔴 | M0 | 2–3 hari | ✅ |
| M2 | Auth & Peran | 🔴 | M1 | 2–3 hari | ✅ |
| M3 | Tema & Shell | 🔴 | M2 | 3–4 hari | ✅ |
| M4 | Bank Soal (CRUD) | 🔴 | M3 | 5–7 hari | 🟡 (M4a/M4b ✅, M4c/M4d ⬜) |
| M5 | Taksonomi | 🔴 | M4 | 2–3 hari | ⬜ |
| M6 | Pencarian | 🔴 | M5 | 3–4 hari | ⬜ |
| M7 | Paket Soal | 🔴 | M6 | 4–5 hari | ⬜ |
| M8 | Ekspor Cetak/PDF | 🔴 | M7 | 2–3 hari | ⬜ |
| — | **MVP SELESAI** | — | — | — | ⬜ |
| M9 | Ingest PDF | 🟡 | M8 | 5–7 hari | ⬜ |
| M10 | AI Enrichment | 🟡 | M9 | 4–5 hari | ⬜ |
| M11 | MCP | 🟡 | M10 | 3–4 hari | ⬜ |
| M12 | Ekspor Moodle | 🟢 | M8 | 2–3 hari | ⬜ |

> **Status per 2026-09-29:** M0–M3 ✅ selesai (lihat `CHANGELOG.md` 0.1.0–0.4.0),
> M4a (service+API) & M4b (halaman daftar) ✅, plus **Fase R (responsif)** & **audit mutu**.
> Sisa M4: M4c (editor+detail) & M4d (telaah+pengaturan).

**MVP = M1–M8.** Perkiraan total MVP: **~23–32 hari kerja** (asumsi kerja fokus).

---

# FASE MVP

## M0 — Fondasi ✅ SELESAI

**Tujuan:** kerangka proyek + dokumentasi + gate kualitas.

### Task
- [x] `create-next-app` (Next 16.3.6, React 19.2.8, Tailwind 4.3.3, TS 5.9.3)
- [x] Deps inti: drizzle-orm, postgres, zod, better-auth
- [x] Dev deps: drizzle-kit, vitest, testing-library, dotenv, tsx
- [x] Dokumen L1–L9 + arsitektur → `docs/`
- [x] `CONSTRAINTS.md`, `.env.example`, `drizzle.config.ts`, `vitest.config.mts`
- [x] Struktur folder (lib/{db,services,auth,ai,embedding,storage,latex,ingest,fsm,search,math,telemetry}, mcp/)
- [x] Gate hijau: typecheck 0, lint 0, test 1/1, build sukses

### Kriteria Selesai
- ✅ `pnpm check` exit 0
- ✅ Repo git dengan commit bersih

---

## M1 — Skema Database ✅ SELESAI

**Tujuan:** mewujudkan skema v2 (L7) dalam Drizzle — 27 tabel (21 domain + 6 auth), enum, relasi, migrasi.

**Dependensi:** M0
**Perkiraan:** 2–3 hari

### Scope
Pecah jadi 3 bagian agar terkelola:

**M1a — Tabel inti (soal & asal)**
- [ ] `questions` (soal, stimulus `parent_id`, tipe, status FSM, kunci jawaban, `data_payload`, `embedding` inline, `is_flagged`, `last_reviewed_at`)
- [ ] `question_options` (opsi jawaban, `distractor_rationale`)
- [ ] `solutions` (pembahasan, `author_type`)
- [ ] `sources` (induk; `kind`, `url`) + `books` + `institutions` (anak)
- [ ] `events` (UTBK/OSN/SBMPTN; `aliases`, `subtests`)
- [ ] `passages` (bacaan reusable — or `parent_id` stimulus? **keputusan: stimulus via parent_id**, passages untuk bacaan panjang bila perlu)

**M1b — Taksonomi & relasi**
- [ ] `topics` (3-level `parent_id`, `usage_count`)
- [ ] `grades`, `difficulty_levels`, `cognitive_levels` (dari yaml → DB)
- [ ] `tags` (`usage_count`)
- [ ] `question_topics` (M:N, 1 primary via `is_primary`)
- [ ] `question_tags` (M:N)

**M1c — Paket, media, sistem, audit**
- [ ] `bundles` (paket; `source_id`; `slug`; soft-delete)
- [ ] `bundle_items` (`role` enum, `section_name`, `item_number`)
- [ ] `media_assets` + `question_media` (M:N, `role` enum)
- [ ] `app_settings` (key-value; AI config, dll)
- [ ] `ingest_queue` (target_type) — *schema boleh ada, dipakai M9*
- [ ] `audit_logs` (**satu** tabel generik: `entity_type`, `entity_id`, `action`, `actor_id`, `diff`)
- [ ] `users` + `user_roles` (multi-role, L1) — *atau via Better Auth + tabel peran tambahan*

### Task lintas-bagian
- [ ] Enum: status soal, tipe soal, `role`, `bundle_type`, `author_type`, dll
- [ ] Trigger `updated_at` (1 fungsi, pasang ke semua tabel)
- [ ] Trigger `usage_count` (topics/tags `question_topics`/`question_tags`)
- [ ] Ekstensi: `pg_trgm`, `vector` (migrasi SQL)
- [ ] Index: GIN trigram (`questions`, `sources`, `topics`, `tags`), HNSW (`questions.embedding`), B-tree FK/filter
- [ ] Invarian CHECK (stimulus 1 level; `ready` wajib `answer_key`; dst)
- [ ] Migrasi Drizzle (`db:generate`)
- [x] **Skrip verifikasi skema** (pastikan 27 tabel, trigger, CHECK & index ada) — `pnpm db:verify`
- [ ] Seeder taksonomi (dari yaml → DB)

### Kriteria Selesai
- ✅ `pnpm db:push` sukses di DB bersih
- ✅ Skema cocok dengan `SKEMA-DB-DETAIL.md` (menyusul)
- ✅ Skrip verifikasi skema lolos
- ✅ Gate hijau

### Dokumen pendukung yang perlu ditulis
- 📄 **SKEMA-DB-DETAIL.md** — bentuk final tiap tabel (DDL + relasi + enum)

---

## M2 — Auth & Peran ✅ SELESAI

**Tujuan:** login + multi-role + matriks izin (L1) + pembungkus API (L4).

**Dependensi:** M1
**Perkiraan:** 2–3 hari

### Task
- [ ] Better Auth setup (session, cookie)
- [ ] Tabel user & peran (multi-role; union izin)
- [ ] Modul `auth/`: `roles.ts` (enum), `permissions.ts` (matriks peran×aksi), `guards.ts` (`requireRole`, `canEdit...`), `actor.ts` (session/apikey/machine)
- [ ] Matriks izin L1 (admin/teacher/reviewer/agent/machine)
- [ ] **Pembungkus route** (`withRoute({auth, query, body, handler})`) — single response format
- [ ] Endpoint `GET /api/auth/me` (identitas benar — perbaikan dari QBank)
- [ ] Halaman login + logout
- [ ] Forbidden page

### Kriteria Selesai
- ✅ Bisa login/logout
- ✅ Izin diuji (unit test matriks izin — semua sel)
- ✅ API wrapper dipakai minimal di 2 endpoint contoh
- ✅ Gate hijau

### Dokumen pendukung
- 📄 **KONTRAK-API.md** (versi awal — wrapper + format respons)

---

## M3 — Tema & Shell ✅ SELESAI

**Tujuan:** mesin tema (3 warna sumber) + kerangka UI (sidebar 4 grup, header, ⌘K).

**Dependensi:** M2
**Perkiraan:** 3–4 hari

### Task
- [ ] **Mesin tema** (dari QBank Fase A, disalin/disempurnakan): 3 warna sumber → OKLCH → token `--mb-<peran>`
- [ ] Verifikasi WCAG (kontras) — otomatis
- [ ] Mode gelap+terang, default **ikut OS** (tanpa flash)
- [ ] Warna status **universal** (tak ikut brand); "Siap" = biru brand
- [ ] Font: Roboto Flex + Roboto Mono
- [ ] **Komponen dasar** (dari QBank Fase B): Button, Badge, Modal, ConfirmModal, State (empty/loading/error)
- [ ] **Shell**: sidebar 4 grup (Kerja/Referensi/Studio/Sistem), header, breadcrumb
- [ ] **Command palette** (⌘K)
- [ ] Sidebar Referensi = **submenu lipat** (Topik/Sumber/Event/Label)
- [ ] Halaman kosong tiap rute (placeholder bermakna, bukan TODO)

### Kriteria Selesai
- ✅ Tema berganti dengan ubah 3 warna sumber → `pnpm theme:build`
- ✅ Kontras WCAG lolos
- ✅ Navigasi sidebar + ⌘K berjalan
- ✅ Tanpa pelanggaran `useMemo`/`useCallback`
- ✅ Gate hijau

### Dokumen pendukung
- 📄 **DESIGN.md** — arah visual final
- 📄 **RENCANA-UI.md** — Fase C/D

---

## M4 — Bank Soal (CRUD) 🔴

**Tujuan:** inti produk — buat/edit/hapus/lihat soal.

**Dependensi:** M3
**Perkiraan:** 5–7 hari

### Task
- [ ] Service `question/` (fungsi biasa): `create`, `query`, `lifecycle`, `media`, `filters`
- [ ] FSM status (L6) — transisi `draft→review→ready→archived` **via FSM**, diuji
- [ ] CRUD soal: buat, edit, hapus (soft + hard admin/own)
- [ ] Tipe soal (daftar final) + `answer_key` per-tipe + `data_payload` per-tipe
- [ ] Stimulus: `parent_id` (1 level), aturan (tak masuk paket langsung, RESTRICT hapus)
- [ ] Opsi jawaban + `distractor_rationale` (PG)
- [ ] Solusi/pembahasan
- [ ] **Editor soal** (manual, tanpa AI) + render **KaTeX** (`\(...\)`/`\[...\]`)
- [ ] Hook kecil (L3): `useQuestions`, `useQuestion`, `useQuestionEditor` (≈100 baris)
- [ ] Halaman: Bank Soal (daftar), detail, baru, edit

### Kriteria Selesai
- ✅ Bisa buat soal (semua tipe MVP) → simpan → lihat → edit → hapus
- ✅ FSM dites (semua transisi valid + ditolak)
- ✅ KaTeX render benar (tanpa `$`)
- ✅ Gate hijau

### Dokumen pendukung
- 📄 **RENCANA-SOAL.md** (tipe soal final, skema answer_key)

---

## M5 — Taksonomi 🔴

**Tujuan:** kelola topik/sumber/event/label (halaman Referensi).

**Dependensi:** M4
**Perkiraan:** 2–3 hari

### Task
- [ ] Service per-domain (L5): `topic/`, `source/`, `event/`, `grade/`, `difficulty/`, `cognitive/`, `tag/`
- [ ] CRUD topik 3-level (pindah induk — cegah siklus)
- [ ] CRUD sumber (pola B: induk + books/institutions)
- [ ] CRUD event + subtes
- [ ] CRUD label (tags)
- [ ] Halaman Referensi (submenu: Topik/Sumber/Event/Label)
- [ ] Halaman Pengaturan (bagian umum; AI config menyusul M10)
- [ ] Relasi soal↔topik/tag (M:N, primary)

### Kriteria Selesai
- ✅ Semua entitas referensi bisa dikelola user
- ✅ Topik 3-level + pindah induk (anti-siklus) diuji
- ✅ Gate hijau

---

## M6 — Pencarian 🔴

**Tujuan:** cari & filter soal.

**Dependensi:** M5
**Perkiraan:** 3–4 hari

### Task
- [ ] Filter builder (`question/filters.ts`, modul terpisah — L5)
- [ ] Filter: topik, sumber, event, status, grade, kesulitan, Bloom, label
- [ ] Pencarian teks **trigram** (`pg_trgm`) — typo-tolerant
- [ ] Pencarian **semantik** (vektor HNSW) — *bila embedding tersedia; else menyusul M10*
- [ ] **Hybrid RRF** (`search/rrf.ts`) + dedup (`search/dedup.ts`)
- [ ] Metrik (`search/metrics.ts`: p95/p99)
- [ ] UI pencarian + filter (Bank Soal)
- [ ] 3 mode tampilan soal (list padat / grid / masonry) — dari VISION

### Kriteria Selesai
- ✅ Cari soal (teks + filter) akurat & cepat
- ✅ Dedup 0.98/0.85 diuji
- ✅ Gate hijau

### Dokumen pendukung
- 📄 **RENCANA-PENCARIAN.md**

---

## M7 — Paket Soal 🔴

**Tujuan:** susun naskah dari bank soal.

**Dependensi:** M6
**Perkiraan:** 4–5 hari

### Task
- [ ] Service `bundle/` (fungsi biasa)
- [ ] Buat paket (`source_id`) + metadata (judul, petunjuk, durasi, grade)
- [ ] `bundle_items`: tambah soal, urutkan, section, `item_number` (nullable)
- [ ] Stimulus: tampil **1×** di paket (hemat); anak merujuk
- [ ] Hapus soal dari paket; soal terpakai → RESTRICT (tak bisa dihapus kalau dipakai)
- [ ] Validasi paket (soal wajib punya kunci? peringatan)
- [ ] Halaman paket: daftar, detail, susun, edit

### Kriteria Selesai
- ✅ Bisa susun paket dari bank soal
- ✅ Stimulus tampil 1× (diuji)
- ✅ Gate hijau

---

## M8 — Ekspor Cetak/PDF 🔴

**Tujuan:** ekspor paket → siap cetak. **Penutup alur MVP.**

**Dependensi:** M7
**Perkiraan:** 2–3 hari

### Task
- [ ] Layout cetak paket (`@media print` dulu)
- [ ] Header paket (judul, petunjuk, identitas bila perlu)
- [ ] Soal bernomor, opsi, stimulus 1×
- [ ] KaTeX ter-render di cetak
- [ ] Opsi: tampilkan/sembunyikan kunci jawaban
- [ ] (Bila perlu) ekspor PDF (server-side, mis. Puppeteer) — **menyusul bila cetak browser cukup**

### Kriteria Selesai
- ✅ Paket → cetak/PDF rapi & siap print
- ✅ KaTeX benar
- ✅ **Alur tuntas: cari → paket → ekspor** ✅
- ✅ Gate hijau

> ## 🎉 MVP SELESAI (M1–M8)

---

# FASE LANJUT

## M9 — Ingest PDF 🟡 (fase 1.1)

**Dependensi:** M8 · **Perkiraan:** 5–7 hari

- [ ] Parser: `ingest/parsers/` (fungsi kecil teruji: unescape, clean, normalize)
- [ ] `ingest/extract.ts` (ekstraksi teks)
- [ ] `ingest_queue`: target_type, status, retry
- [ ] Endpoint `/api/v1/ingest/*` (muka mesin — L4)
- [ ] Alur: PDF → parse → soal (draft) → antre
- [ ] Halaman Ingest & Integrasi (grup Sistem)
- [ ] Idempotensi (dari cetak biru)
- 📄 **STRATEGI-INGEST.md**

## M10 — AI Enrichment 🟡 (fase 1.2)

**Dependensi:** M9 · **Perkiraan:** 4–5 hari

- [ ] `ai/client.ts` — **baca setting** (provider = konfigurasi; 9router di Pengaturan)
- [ ] Halaman Pengaturan → bagian AI (base_url, api_key terenkripsi, model, enabled)
- [ ] `embedding/bge-m3.ts` (dim 1024, validasi ketat)
- [ ] AI tagging (enrichment) → status `review`
- [ ] Embedding soal → vektor (untuk pencarian semantik M6)
- [ ] Dedup saat enrichment
- [ ] Aturan flag × status (flagged tak boleh `ready`)
- 📄 **RENCANA-ENRICHMENT.md**

## M11 — MCP 🟡 (fase 1.3)

**Dependensi:** M10 · **Perkiraan:** 3–4 hari

- [ ] `mcp/server.ts`
- [ ] `mcp/policy.ts` — kebijakan tulis **1 tempat**
- [ ] Tool: `question` (create/bulk), `search`, `asset`, `enrich`
- [ ] Izin peran `agent` (L1)
- [ ] API key untuk agen
- 📄 **RENCANA-MCP.md**

## M12 — Ekspor Moodle 🟢 (fase 1.4)

**Dependensi:** M8 · **Perkiraan:** 2–3 hari

- [ ] Ekspor Moodle XML (**per-item**: tiap soal bawa bacaannya sendiri)
- [ ] GitSync-compatible
- 📄 **RENCANA-EKSPOR.md**

---

## Konsolidasi

### Dokumen yang ditulis per-milestone
| Milestone | Dokumen |
|-----------|---------|
| M1 | SKEMA-DB-DETAIL.md |
| M2 | KONTRAK-API.md (awal) |
| M3 | DESIGN.md, RENCANA-UI.md |
| M4 | RENCANA-SOAL.md |
| M6 | RENCANA-PENCARIAN.md |
| M9 | STRATEGI-INGEST.md |
| M10 | RENCANA-ENRICHMENT.md |
| M11 | RENCANA-MCP.md |
| M12 | RENCANA-EKSPOR.md |

### Risiko jadwal
- **Estimasi** = kerja fokus tanpa gangguan; realistis, mungkin lebih lama.
- **M4 & M7 (paling besar)** — risiko scope creep; jaga MVP ketat.
- **M3 (tema)** — bergantung salinan Fase A/B QBank; bila tak cocok, tambah waktu.

---

## Langkah Berikutnya

**M1 — Skema Database** dimulai setelah dokumen ini diratifikasi.
Dokumen pertama yang ditulis: **`SKEMA-DB-DETAIL.md`** (bentuk final 27 tabel).

---

*Milestone ini mengalir dari PRD. Urutan boleh berubah bila ada alasan kuat — catat perubahannya.*
