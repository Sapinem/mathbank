# MILESTONE — MathBank (Rencana Eksekusi)

> **Dokumen ini menjawab:** *Urutan pembangunan MathBank — apa dulu, apa kemudian, kapan selesai?*
> **Status:** 🟢 aktif — M0–M3 ✅ selesai; M4 berjalan (M4a/M4b ✅).
> **Versi:** 1.1 · **Tanggal:** 2026-09-29
> **Rujukan:** `PRD.md` (ruang lingkup), `DESAIN-PER-LAPISAN-MATHBANK.md` (L1–L9), `PETA-DOKUMEN.md`.

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

## Pekerjaan Lintas-Milestone (✅ selesai, di luar alur M)

Pekerjaan fondasi/hardening yang tak terikat satu milestone:

| # | Pekerjaan | Hasil | Commit |
|---|-----------|-------|--------|
| P1 | **Audit kode komprehensif** | 9 temuan ditutup (coverage nyata 98→99%, dasbor data nyata, `/api/stats`) | `904df9a` |
| P2 | **Shell shadcn resmi** | sidebar collapsible + ⌘K + breadcrumb (komponen resmi) | `8ea6afa` |
| P3 | **Integritas & reproduktibilitas DB** | 21 trigger + 2 CHECK + HNSW di file migrasi; `db:verify` | `b91be3e` |
| P4 | **Kontrak pengujian per-lapisan** | `STRATEGI-TES.md` + bayar utang T1/T2/T6/T7 | `6936172`, `37a3d27` |
| P5 | **Rapikan dokumen era QBank** | VISION MathBank, arsip ROADMAP, 18→27 | `ac88023` |
| P6 | **`uuidv7()`** | PK domain → `uuidv7()` (PG 18), migrasi + verifikasi | `296f233` |
| P7 | **PCI enterprise docs** | PETA-DOKUMEN, KEAMANAN, ADR (7), +11 dokumen enterprise | `b7e3dad`… |
| P8 | **Pagar keamanan (S1, S2)** | rate limiting (429) + security headers (CSP/HSTS) | `139900d`, `ac7c4f1` |
| P9 | **Riset Better Auth** | verdict: otorisasi sendiri; verifikasi CVE | `37a3d27` |

> Detail: `CHANGELOG.md`, `PETA-DOKUMEN.md`, `KEAMANAN.md`, `RISET-BETTER-AUTH.md`.

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
- [x] `questions` (soal, stimulus `parent_id`, tipe, status FSM, kunci jawaban, `data_payload`, `embedding` inline, `is_flagged`, `last_reviewed_at`)
- [x] `question_options` (opsi jawaban, `distractor_rationale`)
- [x] `solutions` (pembahasan, `author_type`)
- [x] `sources` (induk; `kind`, `url`) + `books` + `institutions` (anak)
- [x] `events` (UTBK/OSN/SBMPTN; `aliases`, `subtests`)
- [x] `passages` (bacaan reusable — or `parent_id` stimulus? **keputusan: stimulus via parent_id**, passages untuk bacaan panjang bila perlu)

**M1b — Taksonomi & relasi**
- [x] `topics` (3-level `parent_id`, `usage_count`)
- [x] `grades`, `difficulty_levels`, `cognitive_levels` (dari yaml → DB)
- [x] `tags` (`usage_count`)
- [x] `question_topics` (M:N, 1 primary via `is_primary`)
- [x] `question_tags` (M:N)

**M1c — Paket, media, sistem, audit**
- [x] `bundles` (paket; `source_id`; `slug`; soft-delete)
- [x] `bundle_items` (`role` enum, `section_name`, `item_number`)
- [x] `media_assets` + `question_media` (M:N, `role` enum)
- [x] `app_settings` (key-value; AI config, dll)
- [x] `ingest_queue` (target_type) — *schema boleh ada, dipakai M9*
- [x] `audit_logs` (**satu** tabel generik: `entity_type`, `entity_id`, `action`, `actor_id`, `diff`)
- [x] `users` + `user_roles` (multi-role, L1) — *atau via Better Auth + tabel peran tambahan*

### Task lintas-bagian
- [x] Enum: status soal, tipe soal, `role`, `bundle_type`, `author_type`, dll
- [x] Trigger `updated_at` (1 fungsi, pasang ke semua tabel)
- [x] Trigger `usage_count` (topics/tags `question_topics`/`question_tags`)
- [x] Ekstensi: `pg_trgm`, `vector` (migrasi SQL)
- [x] Index: GIN trigram (`questions`, `sources`, `topics`, `tags`), HNSW (`questions.embedding`), B-tree FK/filter
- [x] Invarian CHECK (stimulus 1 level; `ready` wajib `answer_key`; dst)
- [x] Migrasi Drizzle (`db:generate`)
- [x] **Skrip verifikasi skema** (pastikan 27 tabel, trigger, CHECK & index ada) — `pnpm db:verify`
- [x] Seeder taksonomi (dari yaml → DB)

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
- [x] Better Auth setup (session, cookie)
- [x] Tabel user & peran (multi-role; union izin)
- [x] Modul `auth/`: `roles.ts` (enum), `permissions.ts` (matriks peran×aksi), `guards.ts` (`requireRole`, `canEdit...`), `actor.ts` (session/apikey/machine)
- [x] Matriks izin L1 (admin/teacher/reviewer/agent/machine)
- [x] **Pembungkus route** (`withRoute({auth, query, body, handler})`) — single response format
- [x] Endpoint `GET /api/auth/me` (identitas benar — perbaikan dari QBank)
- [x] Halaman login + logout
- [x] Forbidden page

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
- [x] **Mesin tema** (`scripts/theme/build.ts`): warna sumber → OKLCH → token `--mb-<peran>`
- [x] Verifikasi WCAG (kontras) — otomatis
- [x] Mode gelap+terang, default **ikut OS** (tanpa flash)
- [x] Warna status **universal** (tak ikut brand); "Siap" = biru brand
- [x] Font: Roboto Flex + Roboto Mono
- [x] **Komponen dasar**: Button, Badge, Modal, ConfirmModal, State (empty/loading/error)
- [x] **Shell**: sidebar 4 grup (Kerja/Referensi/Studio/Sistem), header, breadcrumb
- [x] **Command palette** (⌘K) — `src/components/layout/command-palette.tsx`
- [x] Sidebar Referensi = submenu (Topik/Sumber/Event/Label)
- [x] Halaman kosong tiap rute (placeholder bermakna, bukan TODO)

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

## M4 — Bank Soal (CRUD) 🟡 BERJALAN

**Tujuan:** inti produk — buat/edit/hapus/lihat soal.

**Dependensi:** M3 · **Perkiraan:** 5–7 hari

**Status sub-milestone:**
| Sub | Isi | Status |
|-----|-----|:------:|
| **M4a** | Service + API (L5/L4) | ✅ selesai (`9607da8`) |
| **M4b** | Halaman daftar Bank Soal | ✅ selesai (`7fe4dc9`) |
| **M4c** | Editor soal + halaman detail | ⬜ belum (rute `/bank-soal/baru`, `/bank-soal/[id]` = **404**) |
| **M4d** | Telaah + Pengaturan | ⬜ belum |

### Task M4a — Service & API ✅
- [x] Service `question-service.ts` (create/list/get/update/delete/status/flag)
- [x] FSM status (L6) — `draft→review→ready→archived`, diuji
- [x] CRUD soal + soft/hard delete (`own` untuk teacher)
- [x] Guard kesiapan `assertReady` (422 `NOT_READY` tanpa `answer_key`)
- [x] API 7 endpoint: `GET/POST /api/questions`, `[id]` GET/PATCH/DELETE, `[id]/status`, `[id]/flag`
- [x] Rate limiting + izin per-route (`wrapRoute`)
- [x] 21 tes integrasi DB (`question-service.db.test.ts`)
- [ ] Penyuntingan per-tipe (11 tipe) di UI → M4c
- [ ] Aturan stimulus `parent_id` penuh di UI → M4c
- [ ] Opsi + `distractor_rationale`, solusi/pembahasan → M4c

### Task M4b — Halaman Daftar ✅
- [x] Halaman Bank Soal (kartu + filter + pencarian + paginasi)
- [x] Render **KaTeX** toleran (kurung-siku & dolar)
- [x] Hook (L3): `useQuestions`, `useReference` (React Query)
- [x] Responsif (filter jadi Sheet di mobile)
- [x] e2e: daftar, pencarian, KaTeX, filter mobile

### Task M4c — Editor & Detail ⬜
- [ ] Halaman `/bank-soal/baru` + `/bank-soal/[id]` (kini **404**)
- [ ] Editor soal manual + pratinjau KaTeX
- [ ] Opsi jawaban + kunci + pembahasan
- [ ] Validasi per-tipe (11 tipe)
- [ ] Hook `useQuestionEditor`

### Task M4d — Telaah & Pengaturan ⬜
- [ ] Halaman Telaah (tab: perlu telaah / flagged)
- [ ] Halaman Pengaturan (umum; AI config menyusul M10)

### Kriteria Selesai (M4 penuh)
- [ ] Bisa buat soal (semua tipe MVP) → simpan → lihat → edit → hapus
- [x] FSM dites (semua transisi valid + ditolak)
- [x] KaTeX render benar
- [x] Gate hijau (berkelanjutan)

### Dokumen pendukung
- 📄 **RENCANA-SOAL.md** (tipe soal final, skema answer_key) — *belum ditulis*

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
- **M3 (tema)** — ✅ selesai: mesin tema + shell dibangun ulang dengan komponen **resmi shadcn**.

---

## Langkah Berikutnya

**Posisi:** M0–M3 ✅ · M4a/M4b ✅ · pekerjaan lintas-milestone P1–P9 ✅.

**Fokus berikutnya** — pilih satu:
1. **M4c — Editor soal + halaman detail** (fitur inti; rute `/bank-soal/baru` & `[id]` kini 404).
2. **Utang keamanan S3** — pemisahan output `answer_key` (🔴, tak boleh bocor ke soal publik).
3. **M5 — Taksonomi** (kelola Referensi), bila M4 dianggap cukup untuk menutup loop CRUD.

> Rencana lama ("M1 dimulai") sudah terlampaui — M1–M3 selesai.

---

## Riwayat Perubahan MILESTONE

| Versi | Tanggal | Perubahan |
|-------|---------|-----------|
| 1.1 | 2026-09-29 | Sinkronkan dengan kenyataan: M0–M3 ✅, M4 dipecah M4a–M4d (a/b ✅, c/d ⬜), tambah tabel **Pekerjaan Lintas-Milestone** (P1–P9), perbarui Langkah Berikutnya |
| 1.0 | 2026-09-29 | Draft awal |

---

*Milestone ini mengalir dari PRD. Urutan boleh berubah bila ada alasan kuat — catat perubahannya.*
