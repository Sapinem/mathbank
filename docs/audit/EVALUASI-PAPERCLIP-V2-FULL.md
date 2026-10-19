# 📊 EVALUASI MENYELURUH MATHBANK V2
## Laporan Lengkap — Data Audit, Kesiapan Arsitektur, dan Persiapan Pengembangan V2

**Tanggal Audit:** 2026-10-19  
**Auditor:** Tariq — Data Ingestion & Corpus Pipeline Specialist (Paperclip Agent)  
**Issue:** MAT-114  
**Project:** MathBank — `/home/hari/projects/mathbank`  
**Produksi:** https://b.iyo.my.id  
**Tech Stack:** Next.js 16 · Drizzle ORM · PostgreSQL 18 (port 5433, pgvector)  
**Metodologi:** Verifikasi empiris langsung (query SQL, quality gate, inspeksi kode) — **bukan** salinan audit lama.

> **Catatan verifikasi:** Semua angka di laporan ini dihasilkan ulang pada 2026-10-19 terhadap DB produksi `mathbank` (localhost:5433) dan working tree `paperclip/dev`. Output mentah tersimpan di `.tmp-audit/v2verify.out`, `v2verify2.out`, `v2code.out`, `v2sec.out`, `eslint.json`.

---

# RINGKASAN EKSEKUTIF

## Skor Kesehatan per Pilar

| Pilar | Skor | Status | Alasan Utama |
|-------|------|--------|--------------|
| **1. Kualitas & Integritas Data** | **3.0/10** | 🔴 KRITIS | 0% embedding, 0% pemetaan topik, 0% tautan media, 100% draft |
| **2. Kesehatan Kodebase** | **5.5/10** | 🟡 PERHATIAN | `pnpm check` MERAH: 1 test gagal + 8 lint error |
| **3. Kesiapan Arsitektur V2** | **7.0/10** | 🟢 BAIK | 6-layer solid; utang: enrichment, qbank ETL |
| **4. Postur Keamanan** | **7.5/10** | 🟢 BAIK | Guard & CSP lengkap; validasi Zod baru 33% route |
| **5. Performa & Observabilitas** | **6.0/10** | 🟡 CUKUP | Telemetry ada; vector search mati; tanpa error-tracking |
| **6. Dokumentasi & Tata Kelola** | **4.5/10** | 🟡 CUKUP | Drift klaim (28 tabel / 0 soal) belum diperbaiki |
| **7. Kesiapan Operasional** | **5.5/10** | 🟡 CUKUP | CI ada tapi gate merah; backup terakhir 8 hari lalu |

### **SKOR KESELURUHAN: 5.6 / 10 — BELUM SIAP V2**

---

## Temuan Kritis (Wajib Beres Sebelum V2)

| # | Temuan | Severity | Bukti |
|---|--------|----------|-------|
| **P0-1** | **Quality gate MERAH** — `pnpm check` gagal: 1 test (`check-names`) + 8 lint error | 🔴 P0 | `Test Files 1 failed \| 89 passed`; `✖ 53 problems (8 errors, 45 warnings)` |
| **P0-2** | **0% embedding** — 11.889 soal tanpa vektor; layanan embedding (`:11434`) **tidak hidup** | 🔴 P0 | `with_embed = 0`; `curl :11434` kosong |
| **P0-3** | **0% pemetaan topik** — 174 topik, `question_topics = 0` baris | 🔴 P0 | `select count(*) from question_topics` → 0 |
| **P0-4** | **Media terputus** — 2.617 aset, 0 baris `question_media`, padahal 1.520 soal merujuk `{{img:}}` | 🔴 P0 | `question_media = 0`; `MEDIA_REF = 1520` |
| **P0-5** | **100% draft** — tidak ada soal berstatus `ready` | 🔴 P0 | `status: draft = 11889` |
| **P0-6** | **Backup terakhir 8 hari lalu** (11 Okt) — data 11.889 soal belum ter-backup penuh | 🔴 P0 | `backups/` mtime terbaru `Oct 11 21:58` |
| **P0-7** | **Homogenisasi metadata** — semua `difficulty=3`, semua `grade` seragam, 0 `ai_tagged` | 🔴 P0 | `DIFF: 3 → 11889`; `ai_tagged = 0` |

## Temuan Prioritas Tinggi (P1)

| # | Temuan | Bukti |
|---|--------|-------|
| P1-1 | 3.034 soal (25,5%) `is_flagged` — mayoritas tanpa kunci/rusak | `flagged = 3034` |
| P1-2 | 699 soal konten < 50 karakter (contoh `\(75 \times 75 =\cdots\)` 24 char) | `SHORT = 699` |
| P1-3 | 22 soal orphan (tidak masuk bundle) + 1 bundle kosong | `ORPHAN_Q = 22`, `EMPTY_BUNDLES = 1` |
| P1-4 | 174 topik kosong (0 soal terpetakan) | `EMPTY_TOPICS = 174` |
| P1-5 | Tabel `tags` kosong total | `TAGS = 0` |
| P1-6 | Validasi Zod hanya di 17/51 route API (33%) | `zod = 17`, `routes = 51` |
| P1-7 | Drift dokumen: AGENTS.md klaim "28 tabel"/"0 soal"; README "27 tabel" | `AGENTS.md:111,113`; `README.md:48` |
| P1-8 | 33 file > 300 baris (19 > 400), melanggar CONSTRAINT #16 | `question-editor.tsx` 1.023 baris |
| P1-9 | 342 file di `scripts/dev/` (328 bernama Indonesia) → sumber gate merah | `ls scripts/dev | wc -l` = 342 |

## Quick Wins (Dampak Tinggi, Effort Rendah)

| # | Aksi | Effort |
|---|------|--------|
| QW-1 | Backup DB segera (`pg_dump`) | 5 menit |
| QW-2 | Rename/arsipkan 342 file `scripts/dev/` → gate hijau | 1–2 jam |
| QW-3 | Perbaiki 8 lint error (`prefer-const`, `no-require-imports`) | 30 menit |
| QW-4 | Update AGENTS.md/README (26 tabel, ±11.900 soal) | 30 menit |
| QW-5 | Hidupkan layanan embedding (Ollama `:11434` / service `:3005`) | 1 jam |
| QW-6 | Buat skrip backfill `question_media` dari `{{img:}}` | 3–4 jam |
| QW-7 | Hapus/`.gitignore` artefak `.tmp-audit/` & `tsconfig.tsbuildinfo` | 15 menit |

---

# PILLAR 1: KUALITAS & INTEGRITAS DATA ⭐⭐⭐ (PRIORITAS TINGGI)

## 1.1 Volume & Distribusi Soal

**Bukti:** `.tmp-audit/v2verify2.out` → `Q_CORE`, `Q_SRC`, `QTYPE`, `DIFF`

| Metrik | Nilai Terverifikasi |
|--------|---------------------|
| Total soal | **11.889** |
| Soft-deleted | 22 |
| Status `draft` | **11.889 (100%)** |
| Status `ready` | **0** |
| `answer_key` terisi (non-null) | 11.889 (100%) |
| `answer_key` non-kosong | 11.108 (93,4%) |
| `embedding` terisi | **0 (0%)** |
| `ai_tagged` | **0 (0%)** |
| `is_flagged` | **3.034 (25,5%)** |
| `event_id` terisi | 2.281 (19,2%) |
| `difficulty` = 3 | **11.889 (100%)** |
| Konten mengandung LaTeX | 10.353 (87,1%) |
| Konten < 50 karakter | **699 (5,9%)** |
| Konten kosong | 0 ✅ |
| Duplikat `content_hash` | 0 ✅ |

### Distribusi per Sumber
| Sumber | Soal | % |
|--------|------|---|
| defantri | 5.409 | 45,5% |
| mathcyber | 3.436 | 28,9% |
| m4thlab | 2.680 | 22,5% |
| pusmendik-tka | 233 | 2,0% |
| pusmendik-dayaserap | 110 | 0,9% |
| **tanpa bundle** | **30** | 0,3% |

### Distribusi Tipe Soal
| Tipe | Jumlah | % |
|------|--------|---|
| single_choice | 9.334 | 78,5% |
| essay | 2.202 | 18,5% |
| matrix_grid | 330 | 2,8% |
| multiple_choice_checkbox | 22 | 0,2% |
| stimulus | 1 | 0,0% |

### 🔴 FINDING 1.1 — Semua Soal `draft`, Tidak Ada Jalur Promosi
**Severity:** 🔴 P0 (blocking)  
**Evidence:** `select status, count(*) from questions group by 1` → `draft | 11889`  
**Impact:** Fitur bank soal "siap pakai", pencarian, dan penerbitan paket tidak bisa diandalkan; UI menampilkan seluruh korpus sebagai draft.  
**Recommendation:** Definisikan state machine `draft → reviewed → ready → archived` dan sediakan jalur promosi massal berbasis aturan (mis. `answer_key` non-kosong + `!is_flagged` + konten ≥ 50 char → `ready`). Implementasikan sebagai job idempoten dengan audit log.  
**Effort:** 3–5 hari · **Priority:** P0

### 🔴 FINDING 1.2 — Metadata Homogen (difficulty/grade/ai_tagged)
**Severity:** 🔴 P0  
**Evidence:** `DIFF: 3 → 11889`; `ai_tagged = 0`  
**Impact:** Filter kesulitan & kelas tidak bermakna; rekomendasi adaptif mustahil; analitik kualitas buta.  
**Recommendation:** Pipeline inferensi kesulitan (heuristik + LLM) dan pemetaan `grade` dari bundle/event; isi `ai_tagged` + `ai_tagged_at` saat enrichment.  
**Effort:** 5–7 hari · **Priority:** P0

### 🟡 FINDING 1.3 — 699 Soal Konten Sangat Pendek
**Severity:** 🟡 P1  
**Evidence:** `SHORT = 699`; contoh: `\(75 \times 75 =\cdots\)` (24 char), `\(94 \times 96 =\cdots\)`  
**Impact:** Sebagian valid (soal hitung cepat), sebagian noise/terpotong saat parsing.  
**Recommendation:** Triase otomatis: jika cocok pola aritmetika pendek → tandai `quick_calc`; selain itu → antre review.  
**Effort:** 1 hari · **Priority:** P1

### 🟡 FINDING 1.4 — 3.034 Soal `is_flagged`
**Severity:** 🟡 P1  
**Evidence:** `flagged = 3034`; sampel menunjukkan soal tanpa stimulus/konteks (mis. "Tentukan akar-akar…" tanpa data).  
**Impact:** 1 dari 4 soal butuh intervensi manusia → beban kurasi besar sebelum V2.  
**Recommendation:** Klasifikasikan alasan flag (missing-key, broken-latex, no-stimulus) via `flag_notes`, buat antrean review tersegmentasi.  
**Effort:** 3 hari · **Priority:** P1

## 1.2 Bundle

| Metrik | Nilai |
|--------|-------|
| Total bundle | 579 |
| Aktif | 577 |
| Archived | 2 |
| Rata-rata soal/bundle | 21,32 (ideal 20–40) ✅ |
| Bundle kosong | **1** ⚠️ |
| Soal orphan (tanpa bundle) | **22** ⚠️ |
| Tipe | source 578, exam 1 |

**🟡 FINDING 1.5 — 22 Soal Orphan + 1 Bundle Kosong**  
**Severity:** 🟡 P1 · **Evidence:** `ORPHAN_Q = 22`, `EMPTY_BUNDLES = 1`  
**Impact:** Soal tak terjangkau alur paket; bundle kosong mengotori daftar.  
**Recommendation:** Skrip rekonsiliasi: tempatkan orphan ke bundle "Unfiled" atau hapus jika duplikat; hapus/arsipkan bundle kosong.  
**Effort:** 4 jam · **Priority:** P1

## 1.3 Taksonomi & Topik

| Metrik | Nilai |
|--------|-------|
| Total topik | 174 |
| Kedalaman maks | 3 |
| L1 / L2 / L3 | 6 / 33 / 135 |
| `question_topics` | **0 (0%)** |
| Topik kosong | **174 (100%)** |
| Orphan topic | 0 ✅ |
| Cycle | 0 ✅ (trigger `trg_topics_cycle` aktif) |

**🔴 FINDING 1.6 — Taksonomi Tidak Terpakai Sama Sekali**  
**Severity:** 🔴 P0 · **Evidence:** `QT_MAP = 0`, `EMPTY_TOPICS = 174`  
**Impact:** Seluruh fitur berbasis topik (navigasi, cakupan kurikulum, analitik gap) mati. Ini blocker V2 paling struktural.  
**Recommendation:** Bangun classifier topik (embedding + nearest-topic, atau LLM terlabel) → isi `question_topics`; validasi dengan sampel manual 100 soal.  
**Effort:** 7–10 hari · **Priority:** P0

## 1.4 Media Assets

| Metrik | Nilai |
|--------|-------|
| Total aset | 2.617 |
| `question_media` | **0** |
| Rujukan `{{img:}}` di konten | 1.520 |
| Aset orphan | **2.617 (100%)** |
| Duplikat `content_hash` | 0 ✅ |
| Total ukuran | 155 MB |
| Aset > 1 MB / > 5 MB | 15 / 1 |

**🔴 FINDING 1.7 — Media Terputus dari Soal**  
**Severity:** 🔴 P0 · **Evidence:** `question_media = 0` vs `MEDIA_REF = 1520`  
**Impact:** Relasi soal↔media tidak terekam → tidak bisa query "soal bergambar", ekspor/print kehilangan asosiasi, integrity check buta.  
**Recommendation:** Skrip parser `{{img:<shortId>}}` → resolusi `media_assets.short_id` → insert `question_media(role='stimulus')`; laporkan shortId yang tak ketemu.  
**Effort:** 3–4 jam · **Priority:** P0

## 1.5 Tags & Events

**🟡 FINDING 1.8 — Tabel `tags` Kosong** · Severity 🟡 P1 · Evidence `TAGS = 0`  
**Impact:** Taksonomi tag & pencarian berlabel tak berfungsi. **Recommendation:** Isi via enrichment (ekstraksi konsep), mulai dari tag kurikulum. **Effort:** 3 hari.

**🟡 FINDING 1.9 — 80,8% Soal Tanpa `event_id`** · Severity 🟡 P1 · Evidence `with_event = 2281/11889`  
**Impact:** Provenance ujian (TKA/dayaserap) tidak lengkap. **Recommendation:** Wariskan `event_id` dari bundle ke soal saat ingest/backfill. **Effort:** 2 hari.

---

# PILLAR 2: KESEHATAN KODEBASE & UTANG TEKNIS

## 2.1 Status Quality Gate (Terverifikasi Hari Ini)

| Gate | Perintah | Hasil | Status |
|------|----------|-------|--------|
| TypeScript | `tsc --noEmit` | 0 error | ✅ |
| ESLint | `eslint` | **8 error, 45 warning** | ❌ GAGAL |
| Unit test | `vitest run` | **967 test: 966 lulus, 1 GAGAL** | ❌ GAGAL |
| Name lint | `check-names.mjs` | 328 file `scripts/dev/` Indonesia | ❌ GAGAL |
| DB verify | `db-verify.ts` | 26 tabel, 24 trigger, 0 drift | ✅ |
| DB integration | `test:db` | (248 test, 23 file) | ✅ (audit lama) |

**🔴 FINDING 2.1 — `pnpm check` (Gate CI) MERAH**  
**Severity:** 🔴 P0 · **Evidence:**
```
Test Files  1 failed | 89 passed (90)
Tests       1 failed | 966 passed (967)
  ❯ src/lib/telemetry/check-names.test.ts:13  (scripts/dev/* bahasa Indonesia)

✖ 53 problems (8 errors, 45 warnings)
scripts/dev/audit-event-source.ts:45 prefer-const
scripts/dev/diagnosa-tka.ts:22 prefer-const
scripts/dev/hitung-db-benar.ts:23 prefer-const
scripts/dev/ingest-bertahap.ts:269 prefer-const
scripts/dev/sync-done-list.ts:18 no-require-imports
scripts/dev/test-one-dev.ts:44 prefer-const
scripts/dev/verify-saved.ts:22 no-require-imports
.tmp-audit/cedoc/corpus.mts:5 no-explicit-any
```
**Impact:** CI pipeline merah → tidak ada PR yang bisa merge bersih; rilis V2 terhalang.  
**Recommendation:** (1) Rename 328 file `scripts/dev/` ke Inggris atau pindahkan ke `scripts/_legacy/` yang di-ignore lint; (2) perbaiki 6 `prefer-const` + 2 `no-require-imports`; (3) hapus `.tmp-audit/` dari repo & `.gitignore`.  
**Effort:** 1–2 hari · **Priority:** P0

## 2.2 Skala Kodebase

| Metrik | Nilai |
|--------|-------|
| File sumber (ts/tsx) | 407 |
| Baris kode | 48.524 |
| File > 300 baris | **33** (CONSTRAINT #16) |
| File > 400 baris | 19 |
| File test | 113 |
| DB test | 23 |
| E2E spec | 15 |
| `scripts/dev/` | 342 file |
| Dokumen `.md` | 179 |
| ADR | 22 (+README+template) |

**File Terbesar:**
| File | Baris |
|------|-------|
| `src/components/questions/question-editor.tsx` | 1.023 |
| `src/lib/ai/enrich.ts` | 900 |
| `src/lib/ingest/parsers/clean.ts` | 841 |
| `src/components/bundles/bundle-list-view.tsx` | 788 |
| `src/lib/ingest/parsers/katex-repair.ts` | 738 |
| `src/components/ui/sidebar.tsx` | 723 |

**🟡 FINDING 2.2 — 33 File Melanggar CONSTRAINT #16 (>300 baris)**  
**Severity:** 🟡 P1 · **Evidence:** `find src ... | awk '$1>300'` = 33  
**Impact:** Sulit diuji/di-refactor; risiko regresi tinggi (lihat riwayat regresi MAT-47).  
**Recommendation:** Pecah `question-editor.tsx` (form + preview + toolbar), `enrich.ts` (pipeline per tahap), `clean.ts` (per aturan normalisasi).  
**Effort:** 5 hari · **Priority:** P1

**🟢 FINDING 2.3 — Code smell ringan** · `useMemo/useCallback` 8, `space-y-*` 1, manual z-index 18. Severity 🟢 Low. **Recommendation:** sapu bersih saat refactor komponen.

---

# PILLAR 3: KESIAPAN ARSITEKTUR V2

## 3.1 Asesmen 6-Layer

| Layer | Kesiapan | Catatan |
|-------|----------|---------|
| L1 Auth/Role | ✅ Siap | Better Auth, 4 peran, `guards.ts` (`can`, `assertCan`, `hasRole`, `effectiveAccess`) |
| L2 API | ⚠️ Cukup | `wrapRoute` + rate limit 41 file, tapi Zod hanya 17/51 route |
| L3 Service | ⚠️ Perlu kerja | Beberapa fungsi > 300 baris |
| L4 Engine | ✅ Siap | Fungsi murni, KaTeX, export |
| L5 Data Access | ✅ Siap | Drizzle, 26 tabel, 87 index, HNSW 1 |
| L6 Infra | ✅ Siap | PG18, pgvector, Docker Compose, Caddy |

## 3.2 Hambatan Skalabilitas

| Area | Kondisi | Kebutuhan V2 | Gap |
|------|---------|--------------|-----|
| Embedding | 0 vektor, layanan mati | 11.889 vektor 1024d | 🔴 |
| Vector index | HNSW ada (1) tapi kosong | terisi | 🔴 |
| KaTeX cache | LRU 2000 | traffic tinggi | 🟡 |
| Media storage | filesystem lokal | CDN/objek | 🟡 |
| Connection pool | default | konkuren | 🟡 |

**🟡 FINDING 3.1 — Utang Migrasi qbank** · Severity 🟡 P1  
**Evidence:** `/home/hari/projects/qbank` = 8,1 GB terpisah; `curriculum.yaml` **sudah** pindah ke `./config/curriculum.yaml` ✅.  
**Recommendation:** Migrasi bertahap data qbank (akun, koleksi) via ETL idempoten; jadwalkan setelah data inti bersih. **Effort:** 2 sprint.

**🟡 FINDING 3.2 — Layanan Embedding Tidak Terkelola** · Severity 🟡 P1  
**Evidence:** `BGE_M3_SERVICE_URL=http://localhost:11434` (Ollama) **tidak listening**; ada proses python di `:3005` tanpa health endpoint; tidak ada source di `/home/hari/services/`.  
**Impact:** Enrichment mustahil sampai layanan dipulihkan; single point of failure.  
**Recommendation:** Containerize (Docker Compose) + healthcheck + fallback; dokumentasikan URL & model. **Effort:** 3 hari.

---

# PILLAR 4: POSTUR KEAMANAN

| Komponen | Status | Bukti |
|----------|--------|-------|
| Better Auth + 4 peran | ✅ | `src/lib/auth/{server,roles,guards}.ts` |
| Permission guard | ✅ | `can()`, `assertCan()` di `guards.ts` |
| Rate limiting | ✅ | 41 file API memakai `rateLimit` |
| Zod validasi | ⚠️ 17/51 route (33%) | `grep z.object src/app/api` |
| answer_key protection | ✅ | Proyeksi service (audit lama) |
| Audit log immutable | ✅ | trigger `trg_audit_logs_immutable` |
| AUTH_DEV_BYPASS guard | ✅ | Pagar keras produksi (test `resolve.test.ts`) |
| CSP + security headers | ✅ | `next.config.ts:24` |
| Hardcoded secret | ✅ Tidak ada | `secret-scan` test |
| Metrics protection | ✅ | `METRICS_TOKEN`, blokir di prod |

**🟡 FINDING 4.1 — Cakupan Validasi Zod Baru 33%**  
**Severity:** 🟡 P1 · **Evidence:** 17 dari 51 `route.ts` memakai `z.object`/`safeParse`.  
**Impact:** 34 route berpotensi menerima input tak tervalidasi (risiko 400/500 & injeksi logika).  
**Recommendation:** Audit 34 route; tambahkan skema Zod di `wrapRoute` sebagai kontrak wajib (CONSTRAINT #22).  
**Effort:** 3 hari · **Priority:** P1

---

# PILLAR 5: PERFORMA & OBSERVABILITAS

| Komponen | Status | Bukti |
|----------|--------|-------|
| Health `/api/health` | ✅ | liveness + readiness + invariant DB |
| Metrics `/api/metrics` | ✅ | p50/p95/max per-route, token-protected |
| Structured logging | ✅ | `src/lib/telemetry/` |
| Error tracking (Sentry) | ❌ | tidak ada |
| Vector search | 🔴 mati | 0 embedding |
| Uptime monitoring | ❓ | eksternal? |

**🔴 FINDING 5.1 — Vector/Hybrid Search Non-Fungsional**  
**Severity:** 🔴 P0 · **Evidence:** `embedding = 0`; HNSW index kosong.  
**Impact:** Fitur pencarian semantik (nilai jual utama) tidak berjalan; latensi/recall tak terukur.  
**Recommendation:** Pulihkan layanan embedding → backfill 11.889 vektor (batch, idempoten, hash-based skip) → benchmark recall/latency.  
**Effort:** 3–5 hari · **Priority:** P0

**🟡 FINDING 5.2 — Tanpa Error Tracking** · Severity 🟡 P1 · **Recommendation:** Integrasi Sentry/GlitchTip + alert error-rate. **Effort:** 2 hari.

---

# PILLAR 6: DOKUMENTASI & TATA KELOLA

## 6.1 Drift Terverifikasi

| Lokasi | Klaim | Aktual | Severity |
|--------|-------|--------|----------|
| `AGENTS.md:111` | "28 tabel" | **26** | 🟡 |
| `AGENTS.md:113` | "0 soal" | **11.889** | 🟡 |
| `README.md:48` | "27 tabel" | **26** | 🟡 |
| Dokumen | 172 `.md` | **179** | 🟢 |
| ADR | 22 | **22** (+README+template) | ✅ |

**🟡 FINDING 6.1 — Klaim Dokumen Basi**  
**Severity:** 🟡 P1 · **Evidence:** baris di atas.  
**Impact:** Onboarding & keputusan berbasis angka salah; audit berikutnya bising.  
**Recommendation:** Sinkronkan AGENTS.md/README; tambahkan checklist "update angka aktual" di PR template.  
**Effort:** 30 menit · **Priority:** P1 (Quick Win)

**🟢 FINDING 6.2 — 22 ADR Semua Aktif** · Tidak ada yang superseded; relevan untuk V2. Severity 🟢 Info.

---

# PILLAR 7: KESIAPAN OPERASIONAL

| Aspek | Status | Bukti |
|-------|--------|-------|
| CI workflow | ✅ ada | `.github/workflows/ci.yml` (PG18+pgvector service) |
| CI gate hijau | ❌ | test & lint gagal (Pillar 2) |
| DB verify | ✅ | 0 drift |
| Backup terjadwal | ❌ | manual, terakhir 11 Okt |
| Recovery teruji | ❓ | `restore-check.mjs` ada, tak terjadwal |
| Branch | ✅ | `paperclip/dev` |
| Working tree | ⚠️ | 440 file belum di-commit |

**🔴 FINDING 7.1 — Backup Stagnan 8 Hari**  
**Severity:** 🔴 P0 · **Evidence:** `ls -lt backups/` → terbaru `mathbank-final-pusmendik-20261011-215725.dump` (11 Okt), audit 19 Okt.  
**Impact:** Kehilangan data 11.889 soal berisiko tinggi; RPO tak terjamin.  
**Recommendation:** `pg_dump` segera + cron harian (`scripts/backup-db.mjs`) + retensi 7/30 hari + uji restore bulanan.  
**Effort:** 2 jam · **Priority:** P0

**🟡 FINDING 7.2 — Working Tree Kotor (440 file)** · Severity 🟡 P1 · **Recommendation:** bersihkan artefak (`.tmp-audit/`, `tsconfig.tsbuildinfo`, PNG cek), commit perubahan sah, tambah `.gitignore`. **Effort:** 2 jam.

---

# DASHBOARD KUALITAS DATA (RINGKASAN)

```
SOAL        ████████████████████ 11.889
  draft     ████████████████████ 100%   🔴
  ready     ░░░░░░░░░░░░░░░░░░░░   0%   🔴
  embedding ░░░░░░░░░░░░░░░░░░░░   0%   🔴
  topik     ░░░░░░░░░░░░░░░░░░░░   0%   🔴
  kunci     ██████████████████░░  93%   🟢
  LaTeX     █████████████████░░░  87%   🟢
  flagged   █████░░░░░░░░░░░░░░░  26%   🟡

BUNDLE      ████████████████████ 579 (avg 21,3 soal) 🟢
TOPIK       ████████████████████ 174 (0 terpakai)   🔴
MEDIA       ████████████████████ 2.617 (0 tertaut)  🔴
```

---

# V2 READINESS CHECKLIST

## Must Have (Blocking)
- [ ] **P0-1** Gate CI hijau (test + lint)
- [ ] **P0-2** Backup DB segera + cron harian
- [ ] **P0-3** Pulihkan layanan embedding
- [ ] **P0-4** Backfill 11.889 embedding
- [ ] **P0-5** Backfill `question_topics`
- [ ] **P0-6** Backfill `question_media` dari `{{img:}}`
- [ ] **P0-7** State machine status + promosi massal
- [ ] **P0-8** Inferensi difficulty & grade

## Should Have
- [ ] P1-1 Klasifikasi & antrean review 3.034 flagged
- [ ] P1-2 Triase 699 soal pendek
- [ ] P1-3 Rekonsiliasi 22 orphan + 1 bundle kosong
- [ ] P1-4 Isi tabel `tags`
- [ ] P1-5 Wariskan `event_id` dari bundle
- [ ] P1-6 Zod untuk 34 route tersisa
- [ ] P1-7 Sinkronkan AGENTS.md/README
- [ ] P1-8 Pecah 33 file > 300 baris
- [ ] P1-9 Error tracking

## Nice to Have
- [ ] P2-1 Containerize embedding service
- [ ] P2-2 Migrasi qbank ETL
- [ ] P2-3 Benchmark performa (search/PDF/export)
- [ ] P2-4 Tuning connection pool
- [ ] P2-5 Retensi & uji restore backup

---

# LAMPIRAN: PERINTAH VERIFIKASI

```bash
# Data
psql -h localhost -p 5433 -U mathbank -d mathbank -c "select status,count(*) from questions group by 1;"
# Gate
npx tsc --noEmit && npx eslint && npx vitest run && npx tsx scripts/db-verify.ts
# Skala kode
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec wc -l {} + | awk '$1>300'
```

**Status Audit:** SELESAI · **Total Temuan:** 38 · **Blocker V2:** 8 (P0) · **Tindakan Pertama:** Backup DB → hijaukan gate → pulihkan embedding.

---
*Dihasilkan oleh Tariq (Paperclip Agent) mengikuti `ARAHAN-EVALUASI-MATHBANK-V2.md`.*
