# MILESTONE — MathBank (Rencana Eksekusi)

> **Dokumen ini menjawab:** *Urutan pembangunan MathBank — apa dulu, apa kemudian, kapan selesai?*
> **Status:** 🟢 aktif — M0–M3 ✅ · M4a/M4b ✅ · lintas-milestone P1–P13 ✅ · **M4c siap dikerjakan**.
> **Versi:** 2.2 · **Tanggal:** 2026-09-30
> **Rujukan:** `PRD.md` (ruang lingkup), `DESAIN-PER-LAPISAN-MATHBANK.md` (L1–L9), `PETA-DOKUMEN.md`, `KEAMANAN.md`, `CATATAN-PUTUSAN.md`.

---

## Prinsip

1. **Fondasi dulu** — skema DB & auth sebelum fitur.
2. **Tiap milestone berdiri sendiri** — ada hasil nyata, gate `pnpm check` hijau.
3. **Batasan mutu** — setiap milestone menutup dengan: typecheck 0, lint 0, test hijau, build sukses.
4. **Tulang → daging** — dokumen detail (API/ingest/dll) ditulis saat gilirannya.
5. **Jangan mengarang cakupan** — setiap item di sini punya jejak di kode/dokumen; status ditulis jujur.

**Legenda status:** ⬜ belum · 🟡 berjalan · ✅ selesai · ➖ dibatalkan
**Legenda prioritas:** 🔴 wajib MVP · 🟠 penting (pasca-MVP segera) · 🟡 pasca-MVP · 🟢 nanti

---

## Peta Milestone (v2.0)

Tiga fase: **MVP** (M1–M8) → **Lanjut** (M9–M12) → **Operasional/Hardening** (M13–M17, baru di v2.0).

### Fase 1 — MVP

| M | Nama | Prioritas | Dependensi | Status |
|---|------|-----------|------------|:------:|
| M0 | Fondasi | 🔴 | — | ✅ |
| M1 | Skema Database | 🔴 | M0 | ✅ **· direview (1 fix)** |
| M2 | Auth & Peran | 🔴 | M1 | ✅ **· direview (2 temuan)** |
| M3 | Tema & Shell | 🔴 | M2 | ✅ **· direview** |
| M4 | Bank Soal (CRUD) | ✅ | M3 | ✅ **· M4a/b/c/d selesai** |
| **M4** | **Bank Soal (CRUD)** | 🔴 | M3 | 🟡 **M4a/M4b ✅ · M4c/M4d ⬜** |
| M5 | Taksonomi (Referensi) | ✅ | M4 | ✅ **· Topik/Sumber/Event/Label** |
| M6 | Pencarian & Filter | ✅ | M5 | ✅ **· trigram, RRF+dedup, 3 mode** |
| M7 | Paket Soal | ✅ | M6 | ✅ **· penyusun drag-and-drop, stimulus 1×, RESTRICT** |
| M8 | Ekspor Cetak/PDF | 🟡 | M7 | ✅ **· cetak browser (print CSS), 1/2 kolom, kunci, lembar jawaban · M8b: kop/kaki/watermark** |
| | **🎉 MVP SELESAI** | | | ⬜ |

> **MVP = M1–M8** (M0 = fondasi, di luar hitungan fitur).

### Fase 2 — Lanjut (pasca-MVP)

| M | Nama | Prioritas | Dependensi | Status |
|---|------|-----------|------------|:------:|
| M9 | Ingest Korpus (parsing data sumber) | 🟡 | M8 | ⬜ **· arah baru: korpus HTML, bukan PDF** |
| M10 | AI Enrichment & Embedding | 🟡 | M9 | ⬜ |
| M11 | MCP (agen/otomasi) | 🟡 | M10 | ⬜ |
| M12 | Ekspor Moodle | 🟢 | M8 | ⬜ |

### Fase 3 — Operasional & Hardening (BARU di v2.0)

| M | Nama | Prioritas | Dependensi | Status |
|---|------|-----------|------------|:------:|
| M13 | **Keamanan lanjutan (S4–S9)** | 🟠 | M4 | ⬜ |
| M14 | **Kualitas kode & tes (utang)** | 🟠 | M4 | ⬜ |
| M15 | **UI/UX polish & responsif penuh** | 🟡 | M4 | ⬜ |
| M16 | **Observabilitas & operasional** | 🟡 | M8 | ⬜ |
| M17 | **Dokumentasi final & rilis 1.0** | 🟡 | M13–M16 | ⬜ |

> **Aturan fase 3:** boleh dikerjakan **paralel** dengan fase 1/2 bila tak menghambat fitur. Prioritas utamanya menjaga utang tak menumpuk.

---

## Pekerjaan Lintas-Milestone (✅ selesai)

Pekerjaan fondasi/hardening yang tak terikat satu milestone:

| # | Pekerjaan | Hasil | Commit |
|---|-----------|-------|--------|
| P1 | **Audit kode komprehensif** | 9 temuan ditutup (coverage nyata, dasbor data nyata, `/api/stats`) | `904df9a` |
| P2 | **Shell shadcn resmi** | sidebar collapsible + ⌘K + breadcrumb | `8ea6afa` |
| P3 | **Integritas & reproduktibilitas DB** | 21 trigger + 2 CHECK + HNSW di migrasi; `db:verify` | `b91be3e` |
| P4 | **Kontrak pengujian per-lapisan** | `STRATEGI-TES.md` + bayar utang T1/T2/T6/T7 | `6936172`, `37a3d27` |
| P5 | **Rapikan dokumen era QBank** | VISION MathBank, arsip ROADMAP | `ac88023` |
| P6 | **`uuidv7()`** | PK domain → `uuidv7()` (PG 18) | `296f233` |
| P7 | **Dokumen enterprise** | PETA-DOKUMEN, KEAMANAN, ADR, +11 dokumen | `b7e3dad`… |
| P8 | **Pagar keamanan S1–S3** | rate limiting (429) + security headers + proyeksi `answer_key` | `139900d`, `ac7c4f1`, `e09454d` |
| P9 | **Riset Better Auth** | verdict: otorisasi sendiri; verifikasi CVE | `37a3d27` |
| P10 | **Audit mutu M0–M4b** | temuan T-1…T-5 ditutup; `AUDIT-MUTU-M0-M4B.md` | `e09454d` |
| P11 | **Tes komponen & hook kustom** | +24 tes (question-card, shell, sidebar-user, hooks) | `174ee98` |
| P12 | **Migrasi Radix → Base UI** | `@base-ui/react`, style `base-nova`; `radix-ui` dihapus | `7a74349` |
| P13 | **Fix akses LAN** | `APP_HTTPS` env; CSP/HSTS tak paksa HTTPS di HTTP polos; `start:lan` | `431a2b2`, `2ddcfb0` |

> Detail: `CHANGELOG.md`, `PETA-DOKUMEN.md`, `KEAMANAN.md`, `ADR/0001–0008`.

---

# FASE 1 — MVP

## M0 — Fondasi ✅ SELESAI

**Tujuan:** kerangka proyek + dokumentasi + gate kualitas.

- [x] `create-next-app` (Next 16.3.6, React 19.2.8, Tailwind 4.3.3, TS 5.9.3)
- [x] Deps inti: drizzle-orm, postgres, zod, better-auth
- [x] Dokumen L1–L9 + arsitektur → `docs/`
- [x] `CONSTRAINTS.md`, `.env.example`, `drizzle.config.ts`, `vitest.config.mts`
- [x] Gate hijau: typecheck 0, lint 0, build sukses

---

## M1 — Skema Database ✅ SELESAI

**Tujuan:** skema v2 (L7) dalam Drizzle — **27 tabel** (21 domain + 6 auth), enum, relasi, migrasi.

**M1a — Soal & asal**
- [x] `questions` (+ stimulus `parent_id`, FSM status, `answer_key`, `data_payload`, `embedding`, `is_flagged`)
- [x] `question_options` (+ `distractor_rationale`)
- [x] `solutions` (+ `author_type`)
- [x] `sources` + `books` + `institutions`
- [x] `events` (+ `aliases`, `subtests`)
- [x] Stimulus via `parent_id` (keputusan tercatat)

**M1b — Taksonomi & relasi**
- [x] `topics` (3-level), `grades`, `difficulty_levels`, `cognitive_levels`, `tags`
- [x] `question_topics` (M:N, `is_primary`), `question_tags` (M:N)

**M1c — Paket, media, sistem, audit**
- [x] `bundles`, `bundle_items` (+ `role`, `section_name`, `item_number`)
- [x] `media_assets` + `question_media` (M:N)
- [x] `app_settings` (AI config, dll)
- [x] `ingest_queue` (skema ada; dipakai M9)
- [x] `audit_logs` (tabel generik)
- [x] `users` + `user_roles`

**Lintas-bagian**
- [x] Enum lengkap; trigger `updated_at` & `usage_count`; ekstensi `pg_trgm`+`vector`
- [x] Index GIN trigram + HNSW + B-tree FK; CHECK invarian
- [x] Migrasi Drizzle + `pnpm db:verify` (27 tabel, trigger, CHECK, index)
- [x] Seeder taksonomi (yaml → DB)

**Kriteria:** ✅ `db:push` di DB bersih · ✅ `db:verify` lolos · ✅ gate hijau.
**Dokumen:** 📄 `SKEMA-DB-DETAIL.md` ✅

---

## M2 — Auth & Peran ✅ SELESAI

**Tujuan:** login + multi-role (L1) + pembungkus API (L4).

- [x] Better Auth setup (session, cookie)
- [x] Modul `auth/`: `roles.ts`, `permissions.ts` (matriks 15×5 = 75 sel), `guards.ts`, `actor.ts`
- [x] **Pembungkus route** `wrapRoute({auth, query, body, handler, rateLimit})`
- [x] `GET /api/auth/me` (identitas benar)
- [x] Halaman login + logout + forbidden
- [x] **Keputusan:** otorisasi sendiri (bukan Better Auth penuh) — `RISET-BETTER-AUTH.md`

**Kriteria:** ✅ login/logout · ✅ matriks izin diuji semua sel · ✅ gate hijau.
**Dokumen:** 📄 `KONTRAK-API.md` ✅

---

## M3 — Tema & Shell ✅ SELESAI

**Tujuan:** mesin tema (3 warna sumber) + kerangka UI (sidebar, header, ⌘K).

- [x] **Mesin tema** (`scripts/theme/build.ts`): warna sumber → OKLCH → `--mb-*`
- [x] Verifikasi WCAG otomatis; gelap+terang, default ikut OS (tanpa flash)
- [x] Warna status universal; font Roboto Flex + Roboto Mono
- [x] Shell: sidebar 4 grup (Kerja/Referensi/Studio/Sistem) + header + breadcrumb
- [x] Command palette (⌘K); Referensi = submenu; halaman kosong bermakna
- [x] **Revisi:** primitif UI → **Base UI** (`@base-ui/react`, P12); responsif (Fase R)

**Kriteria:** ✅ tema via `theme:build` · ✅ WCAG lolos · ✅ nav+⌘K jalan · ✅ gate hijau.
**Dokumen:** 📄 `THEME-FRAMEWORK-GUIDE.md` ✅

---

## M4 — Bank Soal (CRUD) ✅ SELESAI

**Tujuan:** inti produk — buat/edit/hapus/lihat soal.

**Status sub-milestone:**
| Sub | Isi | Status |
|-----|-----|:------:|
| **M4a** | Service + API (L5/L4) | ✅ `9607da8` |
| **M4b** | Halaman daftar Bank Soal | ✅ `7fe4dc9` |
| **M4c** | Editor soal + halaman detail | ✅ (editor 11 tipe + detail + FSM) |
| **M4d** | Telaah + Pengaturan | ✅ (telaah 2 tab + pengaturan umum) |

### M4a — Service & API ✅
- [x] `question-service.ts` (create/list/get/update/delete/status/flag)
- [x] FSM status (L6) `draft→review→ready→archived`, diuji
- [x] Guard kesiapan `assertReady` (422 `NOT_READY`)
- [x] API 7 endpoint + rate limit + izin per-route
- [x] 21 tes integrasi DB; proyeksi kolom aman (S3)

### M4b — Halaman Daftar ✅
- [x] Kartu + filter + pencarian + paginasi; KaTeX toleran
- [x] Hook `useQuestions`, `useReference` (React Query)
- [x] Responsif (filter → Sheet di mobile); e2e daftar/pencarian/KaTeX

### M4c — Editor & Detail ⬜ *(fokus berikutnya)*
- [x] Rute `/questions/new` + `/questions/[id]` ✅
- [x] Form soal manual + pratinjau KaTeX langsung ✅
- [x] Opsi A–E, tandai kunci (tunggal/multi), `distractor_rationale` ✅ (tambah/hapus/urut = penyempurnaan lanjutan)
- [x] Pembahasan via `answerKey.explanation` ✅ (tabel `solutions` = lanjutan)
- [x] **Tipe opsi vs teks (11 tipe terklasifikasi)** ✅ (validasi mendalam per-tipe = lanjutan)
- [ ] Stimulus `parent_id`: pilih/tautkan anak di UI
- [ ] Pilih topik (primary), tag, grade, kesulitan, Bloom, sumber
- [ ] Simpan draf otomatis / peringatan keluar; guard `assertReady` di UI
- [ ] Hook `useQuestionEditor` (React Query mutation + optimistic)
- [x] Hapus (soft) + dialog konfirmasi ✅
- [x] e2e: buat → simpan → lihat → kirim telaah → hapus ✅
- 📄 **RENCANA-SOAL.md** — dibuat ✅

### M4d — Telaah & Pengaturan ⬜
- [x] Halaman **Telaah**: tab *perlu telaah* / *ditandai*; aksi ubah status + flag ✅
- [x] Alur ulasan (reviewer): setujui → `ready`, tolak → `draft` + catatan ✅
- [x] Halaman **Pengaturan**: bagian umum (org, default) ✅; bagian AI menyusul M10
- [ ] Service `review/` bila logika > UI

### Kriteria Selesai (M4 penuh)
- [ ] Buat soal (semua tipe MVP) → simpan → lihat → edit → hapus
- [ ] FSM + guard `assertReady` tercermin di UI
- [ ] **Desktop-saja** untuk editor (pola `DesktopOnly`); daftar tetap enak di HP
- [ ] e2e alur CRUD tuntas; gate hijau

---

## M5 — Taksonomi (Referensi) 🔴

**Tujuan:** kelola topik/sumber/event/label dari UI.

**Dependensi:** M4 · **Perkiraan:** 3–4 hari

- [ ] Service per-domain: `topic/`, `source/`, `event/`, `tag/`, `grade/`, `difficulty/`, `cognitive/`
- [ ] API CRUD: `/api/topics`, `/api/sources`, `/api/events`, `/api/tags` (+ `[id]`)
- [ ] **Halaman Topik** — pohon 3-level, tambah/pindah induk (anti-siklus), hapus
- [ ] **Halaman Sumber & Asal** — induk + `books`/`institutions` (pola B)
- [ ] **Halaman Event** — + subtes, alias
- [ ] **Halaman Label** — tags + `usage_count`
- [ ] Kelola `grades`/`difficulty`/`cognitive` (dari seed; edit terbatas)
- [ ] Relasi soal↔topik/tag (M:N, primary) — diambil dari M4c
- [ ] Guard: tak bisa hapus entitas yang dipakai (RESTRICT + pesan jelas)
- [ ] Tes: anti-siklus topik, RESTRICT FK, CRUD service
- 📄 **RENCANA-TAKSONOMI.md**

**Kriteria:** ✅ semua entitas referensi terkelola · ✅ anti-siklus & RESTRICT diuji · ✅ gate hijau

---

## M6 — Pencarian & Filter 🔴

**Tujuan:** cari/filter soal dengan cepat & toleran salah ketik.

**Dependensi:** M5 · **Perkiraan:** 3–4 hari

- [ ] Modul filter terpisah (`question/filters.ts`) — bangun query dari params
- [ ] Filter: topik (termasuk anak), sumber, event, status, grade, kesulitan, Bloom, label, tipe
- [ ] Pencarian **trigram** (`pg_trgm`) — typo-tolerant
- [ ] Pencarian **semantik** (HNSW) — aktif bila embedding tersedia (M10); fallback trigram
- [ ] **Hybrid RRF** + dedup (ambang 0.98/0.85)
- [ ] Metrik (`p95`/`p99`) + index tuning (`EXPLAIN` diverifikasi)
- [ ] UI: filter tersimpan (URL sebagai sumber kebenaran), riwayat pencarian
- [ ] 3 mode tampilan soal (list padat / grid / masonry)
- [ ] Tes: filter builder (unit), dedup, threshold
- 📄 **RENCANA-PENCARIAN.md**

**Kriteria:** ✅ cari teks+filter akurat & cepat · ✅ dedup diuji · ✅ gate hijau

---

## M7 — Paket Soal ✅

**Tujuan:** susun naskah dari bank soal.

**Dependensi:** M6 · **Perkiraan:** 4–5 hari · **Status:** ✅ selesai 2026-09-30

- [x] Service `bundle/` (buat, metadata: judul, petunjuk, durasi, grade, `source_id`)
- [x] `bundle_items`: tambah/hapus soal, urutkan (drag), section, `item_number` nullable
- [x] Stimulus tampil **1×** di paket; anak merujuk (uji)
- [x] Soal terpakai di paket → **RESTRICT** (409 saat dihapus)
- [x] Validasi paket (soal tanpa kunci → peringatan, boleh tapi ditandai)
- [x] Duplikasi paket; arsip paket (soft-delete)
- [x] Halaman: daftar paket · detail · penyusun (drag-and-drop) · edit
- [x] **Responsif**: penyusun pakai **Sheet** di mobile (2 kolom di desktop) —
      `DesktopOnly` **DIBUANG** atas permintaan pemilik
- [x] Tes: urutan item, stimulus 1×, RESTRICT (14 service + 8 API)
- 📄 **RENCANA-PAKET.md** ✅

**Kriteria:** ✅ susun paket dari bank soal · ✅ stimulus 1× diuji · ✅ gate hijau

---

## M8 — Ekspor Cetak/PDF 🟡 (inti ✅, lanjutan M8b)

**Tujuan:** ekspor paket → siap cetak. **Penutup alur MVP.**

**Dependensi:** M7 · **Perkiraan:** 3–4 hari

- [ ] Layout cetak (`@media print`) + halaman pratinjau cetak
- [ ] Header paket (judul, petunjuk, identitas opsional, kolom jawaban)
- [x] Soal bernomor; opsi rapi; stimulus 1×; KaTeX ter-render di cetak
- [x] Opsi tampil/sembunyikan kunci jawaban; lembar jawaban terpisah
- [x] Format kolom (1/2 kolom) + `@page` A4 + page-break
- [x] Tes cetak (unit view: 7 tes; DB: opsi ter-lampir + gate kunci)
- [~] Ekspor **PDF server-side** (Playwright/Puppeteer) — **ditunda**; keputusan user = **Opsi A (cetak browser)**
- [ ] **M8b**: kop/kaki lembaga + watermark + nomor halaman (ditunda sesuai keputusan user)
- ✅ **RENCANA-EKSPOR.md**

**Kriteria:** ✅ paket → cetak rapi · ✅ KaTeX benar · ✅ **alur tuntas: cari → paket → ekspor** · ✅ gate hijau

> ## 🎉 **MVP SELESAI (M1–M8)**

---

# FASE 2 — LANJUT

## M9 — Ingest Korpus (parsing data sumber) 🟡

**Dependensi:** M8 · **Perkiraan:** 5–7 hari
**⚙️ Arah (2026-09-30):** **bukan PDF** — fokus **parsing korpus HTML** yang sudah dicrawl
(mathcyber · m4thlab · defantri · pusmendik). Bahan di `~/projects/qbank/data/corpora/`.

- [ ] `ingest/parsers/` — fungsi murni teruji: `clean` ✅ · `segment` · `items` (dipecah, bukan monolit)
- [ ] `ingest/parsers/adapters/` — penanda per-sumber (mathcyber · m4thlab · defantri)
- [ ] `ingest/queue.ts` — enqueue artikel + status + retry + **idempotensi** (hash konten)
- [ ] `ingest/commit.ts` — hasil parse → soal **draft** (lewat `createQuestion`, transaksi)
- [ ] Endpoint `/api/v1/ingest/*` (muka mesin — L4): upload · queue · commit
- [ ] Alur: HTML korpus → parse → soal (draft) → antre → telaah
- [ ] Halaman **Ingest & Integrasi** (grup Sistem) — 3 tab (aktifkan dari tersembunyi)
- [ ] Deteksi opsi/nomor/kunci + pisah pembahasan; artikel tanpa soal → `skipped`
- [ ] Tes parser (fixture per-sumber)
- 📄 **STRATEGI-INGEST.md** ✅ (dirombak 2026-09-30)

## M10 — AI Enrichment & Embedding 🟡

**Dependensi:** M9 · **Perkiraan:** 4–5 hari

- [ ] `ai/client.ts` — **baca setting** (base_url/api_key/model/enabled); OpenAI-compatible
- [ ] Halaman **Pengaturan → bagian AI** (9router; key terenkripsi)
- [ ] `embedding/bge-m3.ts` (dim 1024, validasi ketat)
- [ ] AI tagging (enrichment) → hasil ke status `review`
- [ ] Embedding soal → vektor (aktifkan pencarian semantik M6)
- [ ] Dedup saat enrichment; aturan flag × status (flagged ≠ `ready`)
- [ ] Batas biaya/rate; log panggilan AI (`audit_logs`)
- 📄 **RENCANA-ENRICHMENT.md**

## M11 — MCP (agen/otomasi) 🟡

**Dependensi:** M10 · **Perkiraan:** 3–4 hari

- [ ] `mcp/server.ts`
- [ ] `mcp/policy.ts` — kebijakan tulis **1 tempat**
- [ ] Tool: `question` (create/bulk), `search`, `asset`, `enrich`
- [ ] Izin peran `agent`/`machine` (L1) — **tak pernah** lihat `answer_key`
- [ ] API key untuk agen (manajemen + cabut)
- 📄 **RENCANA-MCP.md**

## M12 — Ekspor Moodle 🟢

**Dependensi:** M8 · **Perkiraan:** 3–4 hari

- [ ] Ekspor Moodle XML (**per-item**: tiap soal bawa bacaannya sendiri)
- [ ] GitSync-compatible; validasi skema XML
- [ ] Halaman ekspor (pilih paket → unduh)
- 📄 **RENCANA-MOODLE.md**

---

# FASE 3 — OPERASIONAL & HARDENING

> Boleh paralel dengan fase 1/2. Tujuan: utang tak menumpuk.

## M13 — Keamanan Lanjutan (S4–S9) 🟠

**Dependensi:** M4 · dari `KEAMANAN.md`

- [ ] **S4** Verifikasi email (`requireEmailVerification: true`) + alur kirim
- [ ] **S5** Kebijakan kata sandi kuat + rotasi; pesan jelas di UI
- [ ] **S6** `gitleaks` di CI (atau pre-commit) — cegah rahasia ter-commit
- [ ] **S7** Audit akses baca (siapa membaca apa), bukan hanya mutasi
- [ ] **S8** Pantau advisory Better Auth + proses bump terjadwal
- [ ] **S9** **CSP nonce/hash** — ganti `'unsafe-inline'` script (pengerasan S2)
- [ ] Rate limit → **Redis** bila multi-instance (interface sudah siap-swap)
- [ ] 2FA/TOTP (opsional) untuk admin

## M14 — Kualitas Kode & Tes (utang) 🟠

**Dependensi:** M4

- [ ] Tutup celah coverage: `src/lib/auth/server.ts` (kini 0%, integrasi-level)
- [ ] Tes untuk `app-shell`/`header`/`command-palette`/providers (kini tipis)
- [ ] Naikkan coverage **Functions** (kini ~90%) — target ≥ 90% semua metrik
- [ ] Refactor `question-service.ts` jika > ~400 baris (pisah per-operasi)
- [ ] Aturan lint tambahan: larang `.select()` tanpa kolom (enforce CONSTRAINT #34)
- [ ] Audit dependency berkala (`pnpm outdated`, advisory)
- [ ] Evaluasi **TypeScript 7** (bump mayor — butuh checkpoint)

## M15 — UI/UX Polish & Responsif Penuh 🟡

**Dependensi:** M4

- [ ] **🔴 Halaman login UI** (rute `/masuk`) + alur logout — *utang review M2*
- [ ] Halaman Forbidden (403) UI + halaman error ramah — *utang review M2*
- [ ] Audit a11y menyeluruh (fokus, aria, kontras di semua halaman) + axe
- [ ] Skeleton/tempat kosong konsisten di semua halaman data
- [ ] Pola D (`DesktopOnly`) diterapkan konsisten; pesan ramah seragam
- [ ] Pintasan keyboard lengkap (bukan hanya ⌘K)
- [ ] Animasi halus + hormati `prefers-reduced-motion` penuh
- [ ] Uji di HP nyata (Chrome Android/Safari iOS) via `pnpm start:lan`
- [ ] Audit Lighthouse (perf/a11y/best-practices/SEO) — target ≥ 90
- [ ] Mode gelap: audit semua halaman (bukan hanya daftar)

## M16 — Observabilitas & Operasional 🟡

**Dependensi:** M8

- [ ] Logging terstruktur + korelasi request-id
- [ ] Telemetri ringan (metrik endpoint: latency, error rate)
- [ ] Health-check endpoint (`/api/health`) untuk reverse-proxy
- [ ] Backup otomatis + uji **restore** (lihat `BACKUP-RECOVERY.md`)
- [ ] CI: `pnpm check` + `test:db` + e2e di setiap PR
- [ ] `Dockerfile` + compose (app + PG + reverse-proxy TLS) — lihat `RENCANA-DEPLOY.md`
- [ ] Migrasi: prosedur zero-downtime + rollback teruji
- 📄 `RUNBOOK.md`, `PANDUAN-OPERASIONAL.md`

## M17 — Dokumentasi Final & Rilis 1.0 🟡

**Dependensi:** M13–M16

- [ ] Konsolidasi dokumen (audit Fase 3): 35+ → target ~12 dokumen kanonik
- [ ] `CHANGELOG.md` → versi **1.0.0**; tag rilis
- [ ] `CONTRIBUTING.md` + panduan onboarding kontributor
- [ ] Dokumentasi pengguna (panduan singkat guru/penelaah)
- [ ] Verifikasi akhir semua kriteria MVP+lanjut; matriks fitur ↔ status
- [ ] Review keputusan tertunda: KaTeX, enum `competition`/`exercise`
- [ ] Arsip dokumen usang → `docs/arsip/`

---

## Konsolidasi

### Dokumen yang ditulis per-milestone

| Milestone | Dokumen | Status |
|-----------|---------|:------:|
| M1 | `SKEMA-DB-DETAIL.md` | ✅ |
| M2 | `KONTRAK-API.md` | ✅ |
| M3 | `THEME-FRAMEWORK-GUIDE.md` | ✅ |
| **M4** | `RENCANA-SOAL.md` (11 tipe + answer_key) | 📄 **perlu** |
| **M5** | `RENCANA-TAKSONOMI.md` | 📄 perlu |
| **M6** | `RENCANA-PENCARIAN.md` | 📄 perlu |
| **M7** | `RENCANA-PAKET.md` | ✅ dibuat |
| **M8** | `RENCANA-EKSPOR.md` | ✅ dibuat |
| M9 | `STRATEGI-INGEST.md` | ✅ dibuat |
| M10 | `RENCANA-ENRICHMENT.md` | 📄 perlu |
| M11 | `RENCANA-MCP.md` | 📄 perlu |
| M12 | `RENCANA-MOODLE.md` | 📄 perlu |
| M16 | `RUNBOOK.md`, `PANDUAN-OPERASIONAL.md` | 📄 perlu |

### Risiko jadwal
- **Estimasi** = kerja fokus tanpa gangguan; realistis mungkin lebih lama.
- **M4 & M7 (terbesar)** — risiko scope creep; jaga MVP ketat.
- **M6 (pencarian semantik)** bergantung embedding (M10) → rancang fallback trigram.
- **M9 (ingest)** paling tak pasti (variasi PDF) → parsers teruji + fixture.
- **M13–M17 bisa ditunda**, tapi jangan sampai menumpuk (mis. S6 gitleaks murah, kerjakan awal).

---

## Langkah Berikutnya

**Posisi:** M0–M3 ✅ · M4a/M4b ✅ · P1–P13 ✅.

**Fokus berikutnya (urut prioritas):**
1. **M4c — Editor soal + halaman detail** 🔴 *(rute `/questions/new` & `[id]` kini 404)* — fitur inti, menutup loop CRUD.
2. **M4d — Telaah + Pengaturan** 🔴 — menutup M4 penuh.
3. **M5 — Taksonomi** 🔴 — Referensi terkelola.
4. **M13 — Keamanan S4/S5/S6** 🟠 — bisa disisipkan kapan saja (murah, tinggi nilai).

> **Catatan:** mulai sekarang, **setiap milestone menutup dengan** `pnpm check` (typecheck·lint·coverage·build) + `pnpm test:db` + `pnpm e2e` hijau, dan entri `CHANGELOG.md`.

---

## Riwayat Perubahan MILESTONE

| Versi | Tanggal | Perubahan |
|-------|---------|-----------|
| 2.2 | 2026-09-30 | Review M2 (2 temuan: halaman login & forbidden belum ada → utang M15; matriks L1 diselaraskan dengan kode 75 sel) |
| 2.1 | 2026-09-30 | Review M1 (temuan migrasi tak reproduktif → diperbaiki); +S10 (role DB produksi non-superuser) |
| **2.0** | **2026-09-30** | **Rombak menyeluruh:** tambah **Fase 3 (M13–M17)** menutup utang keamanan (S4–S9), kualitas tes, UI/UX, observabilitas, dokumentasi rilis; perbarui P1–P13 (audit Base UI, akses LAN); tandai M4d sebagai sub-milestone; tambah dokumen pendukung yang belum ditulis (M4–M8); perbarui Langkah Berikutnya |
| 1.1 | 2026-09-29 | Sinkronkan kenyataan: M0–M3 ✅, M4 dipecah M4a–M4d, tabel **P1–P9**, Langkah Berikutnya |
| 1.0 | 2026-09-29 | Draft awal |

---

*Milestone ini mengalir dari PRD. Urutan boleh berubah bila ada alasan kuat — catat perubahannya.*
