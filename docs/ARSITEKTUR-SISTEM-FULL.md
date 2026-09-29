# Arsitektur Sistem QBank — Menyeluruh (Full Stack)

> ⚠️ **SEBAGIAN QBank-era.** Dokumen ini memetakan sistem **QBank** (23 file schema, 5 tool MCP, dst.).
> Untuk MathBank, arsitektur aktif ada di **`DESAIN-PER-LAPISAN-MATHBANK.md`** + **`ARSITEKTUR-DATA-FINAL.md`**.
> Berguna sebagai **referensi/inventaris** apa yang harus ada di MathBank — bukan cetak biru langsung.

> **Status:** DRAFT untuk review pemilik produk.
> **Melengkapi:** `ARSITEKTUR-DATA-FINAL.md` (yang hanya lapisan data).
> **Tanggal:** 2026-09-29.
> **Metode:** Inventaris nyata dari kode; bukan asumsi.

---

## 0. Ringkasan

Dokumen ini memetakan **seluruh lapisan sistem**, bukan hanya DB:

```
┌──────────────────────────────────────────────────────────────┐
│ L1  PENGGUNA         Guru · Admin · Agen AI (MCP) · Mesin     │
├──────────────────────────────────────────────────────────────┤
│ L2  ANTARMUKA        Next.js App Router (halaman + komponen)  │
├──────────────────────────────────────────────────────────────┤
│ L3  STATE/CLIENT     React Query (server) · Context (tema)    │
├──────────────────────────────────────────────────────────────┤
│ L4  API (HTTP)       /api/* Route Handlers + /api/v1 (mesin)  │
├──────────────────────────────────────────────────────────────┤
│ L5  LAYANAN          services/* (domain logic)                │
├──────────────────────────────────────────────────────────────┤
│ L6  MODUL/KOMPONEN   document-processor · ingest · moodle     │
├──────────────────────────────────────────────────────────────┤
│ L7  AKSES DATA       Drizzle ORM + schema                     │
├──────────────────────────────────────────────────────────────┤
│ L8  DATA (Postgres)  tabel + index + FTS + vektor             │
├──────────────────────────────────────────────────────────────┤
│ L9  LAYANAN LUAR     Embedding (BGE-M3) · AI · LaTeX · TikZ   │
└──────────────────────────────────────────────────────────────┘
```

---

## L1 — Aktor / Pengguna

| Aktor | Akses | Cara masuk |
|-------|-------|-----------|
| **Guru/Editor** | Buat/edit soal, susun naskah, kurasi | UI (login Better Auth) |
| **Admin** | Semua + kelola taksonomi, hard-delete, pengaturan, backup/restore | UI |
| **Agen AI (MCP)** | Baca + tulis soal/aset (terbatas) | API key / MCP |
| **Mesin (ingest)** | Kirim naskah/aset untuk diproses | API `/api/v1/ingest` + machine-auth |

> **Temuan:** sudah ada `src/lib/auth-guards.ts` & `src/lib/question-permissions.ts` — otorisasi tak sepenuhnya seragam; perlu inventaris peran formal (Fase lanjut).

---

## L2 — Antarmuka (Next.js App Router)

**Struktur halaman** (`src/app/`):

| Grup | Halaman |
|------|---------|
| **Kerja** | Dasbor, Eksplorer Soal, Antrean Review, Paket Soal |
| **Referensi** | Sumber, Event, Kategori, Label, Sekolah (sebagian jadi tab) |
| **Studio** | Galeri Aset, TikZ Studio |
| **Sistem** | Ingest & Integrasi, Pengaturan |
| **Auth** | Login |

**Komponen** (`src/components/`): `ui/` (Button, Badge, Modal...), `layout/` (Sidebar, CommandPalette), `explorer/`, `review/`, `editor/`, `exams/`, `tikz/`, `questions/`.

> **Catatan:** UI redesign (Linear/Vercel) sedang **menggantung** di branch
> `redesign/ui-linear` — Fase A & B selesai, C/D ditunda.

---

## L3 — State & Klien

| Lapisan | Isi | File |
|---------|-----|------|
| **Server state** | React Query (`@tanstack/react-query`) | `src/providers/QueryProvider.tsx` |
| **Client state** | React Context (tema) | `src/context/ThemeContext.tsx` |
| **Hooks** | `useQuestionEditor`, `useReviewQueue`, `useSemanticSearch`, `useQuestionExplorer` | `src/hooks/` |
| **URL state** | Filter tersimpan di query string | `src/lib/url-state.ts` |

---

## L4 — API (HTTP Route Handlers)

**Dua wajah API:**

### 4.1 API internal (UI) — `/api/*`
| Grup | Endpoint |
|------|----------|
| Soal | `/api/questions`, `/api/questions/[id]`, `/api/questions/semantic` |
| Asal | `/api/sources`, `/api/events`, `/api/exam-events`, `/api/grades` |
| Katalog | `/api/categories`, `/api/tags` (+ `merge`, `clean-unused`) |
| Naskah | `/api/packages` |
| Aset | `/api/assets` (+ `compile-tikz`, `generate-ai`), `/api/media`, `/api/upload` |
| Ekspor | `/api/export`, `/api/export/moodle-xml` |
| Sistem | `/api/settings` (+ `api-keys`, `backup`, `restore`, `media-hygiene`), `/api/reference-data` |
| Auth | `/api/auth/[...all]`, `/api/auth/change-password`, `/api/auth/quick-signin` |
| MCP | `/api/mcp` |

### 4.2 API mesin (ingest) — `/api/v1/ingest/*`
| Endpoint | Fungsi |
|----------|--------|
| `/extract` | Ekstrak teks dari dokumen |
| `/questions` | Kirim soal hasil ekstraksi |
| `/assets` | Kirim aset |
| `/check-duplicate` | Cek duplikat sebelum simpan |
| `/tex` | Ingest sumber LaTeX |
| `/queue` | Antrean pemrosesan |
| — | `machine-auth.ts` — autentikasi mesin |

---

## L5 — Layanan Domain (`src/lib/services/`)

**24 modul layanan.** Dikelompokkan:

| Kelompok | Layanan |
|----------|---------|
| **Soal** | `question-service`, `solution-service`, `question-sanitizer-service` |
| **Asal-usul** | `source-service`, `event-service`, `exam-event-service`, `school-service` |
| **Katalog** | `category-service`, `tag-service`, `grade-service`, `reference-data-service` |
| **Naskah** | `bundle-service` |
| **Aset** | `asset-service`, `media-hygiene-service`, `image-to-text-service` |
| **Ingest** | `ingest/{queue,commit,validator}-service`, `ai-ingest-service`, `tex-parser/` |
| **AI** | `ai-tagger-service`, `ai-tagger-worker`, `embedding-service`, `embedding-provider/bge-m3-provider` |
| **Ekspor** | `moodle/*`, `moodle-gitsync-exporter` |
| **Sistem** | `settings-service`, `backup-service`, `backup-streaming`, `katex-linter-service` |

> **Pola:** Route handler (L4) **tipis** — logika ada di service (L5). Bagus, sudah terpisah.

---

## L6 — Modul & Engine

| Modul | Lokasi | Fungsi |
|-------|--------|--------|
| **Document Processor** | `src/modules/document-processor/parsers/` | Parser dokumen (PDF/teks) → soal |
| **Corpus Parser** | `src/lib/ingest/corpus-parser.ts` | Parsing naskah besar → soal |
| **FSM Soal** | `src/lib/fsm/question-fsm.ts` | State machine status soal (draft→review→ready) |
| **Idempotency** | `src/lib/idempotency.ts` | Cegah operasi ganda |
| **Search engine** | `src/lib/search/{dedup,rrf,metrics}.ts` | Dedup, hybrid RRF, metrik |
| **Matematika** | `src/lib/math/` | Utilitas matematika/LaTeX |
| **Sanitasi SVG** | `src/lib/sanitize-svg.ts` | Keamanan SVG |
| **Taxonomy utils** | `src/lib/taxonomy-utils.ts`, `curriculum.ts` | Taksonomi |
| **Telemetry** | `src/lib/telemetry/logger.ts` | Logging |

---

## L7 — Akses Data (Drizzle ORM)

**Schema** (`src/lib/db/schema/`): 23 file tabel. Setiap service memanggil Drizzle → Postgres.

- **Aturan tipe:** `tsc` 0 error adalah gate (CONSTRAINTS.md).
- **Larangan:** `useMemo`/`useCallback` dilarang (CONSTRAINTS.md:12).
- **Migrasi:** Drizzle Kit (`drizzle/`).

> **Perubahan besar:** arsitektur data v2 (`ARSITEKTUR-DATA-FINAL.md`) mengubah lapisan ini secara mendalam — 27 tabel (21 domain + 6 auth), `question_sources` dihapus, taksonomi → DB.

---

## L8 — Data (PostgreSQL)

| Kapabilitas | Teknologi | Status |
|-------------|-----------|--------|
| Relasional + FK | Postgres | ✅ |
| **Pencarian fuzzy** | `pg_trgm` (GIN) | ✅ |
| **Pencarian semantik** | `vector` + **HNSW** | ✅ |
| **Hybrid** | RRF (gabungan) | ✅ |
| Enum + CHECK | Postgres | ✅ |
| Trigger (audit/updated_at) | `drizzle/0001_db_safety.sql` (13 trigger) | ✅ |

---

## L9 — Layanan Luar / Ketergantungan

| Layanan | Dipakai untuk | Lokasi integrasi |
|---------|---------------|------------------|
| **Embedding (BGE-M3)** | Vektor semantik soal | `services/embedding-provider/bge-m3-provider.ts` |
| **AI (LLM)** | Ingest, AI Enrichment, generate aset | `ai-ingest-service`, `ai-tagger-*` |
| **LaTeX/TeX** | Parsing & kompilasi soal | `tex-parser/`, `asset-service` (spawn latex) |
| **KaTeX** | Validasi matematika | `katex-linter-service` |
| **TikZ** | Diagram | `asset-service`, `tikz/` komponen |
| **Moodle GitSync** | Ekspor ke Moodle | `services/moodle/` |
| **Better Auth** | Autentikasi | `lib/auth.ts` |

---

## MCP — Jalur Agen AI (layanan lintas lapisan)

**Server:** `src/mcp-server/` (index + tools). Endpoint: `/api/mcp`.

**Tool yang ada:**
| Tool | Aksi |
|------|------|
| `create_question` | Tulis 1 soal (dengan dedup check) |
| `bulk_create_questions` | Tulis massal (bikin stimulus otomatis untuk anak) |
| `search_existing_questions` | Baca/cari |
| `search_asset_gallery` | Baca aset |
| `register_diagram_asset` | Tulis aset |

> **Kebijakan tulis:** agen bisa tulis soal/aset; **tak bisa** bundle/status/hapus.
> Near-duplicate → `is_flagged`, bukan langsung simpan.

---

## Alur End-to-End (contoh: impor naskah → paket)

```
L1 Guru ──▶ L2 Ingest UI ──▶ L4 /api/v1/ingest/extract
                                   │
                                   ▼
                            L5 ai-ingest-service
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        document-processor   corpus-parser      embedding (BGE-M3)
        (L6 parser)          (L6 parser)        (L9)
              └────────────────────┼────────────────────┘
                                   ▼
                        L5 validator-service (quality gate)
                                   │
                                   ▼
                    L4 /check-duplicate ──▶ L6 search/dedup
                                   │
                                   ▼
                          L5 commit-service
                                   │
                                   ▼
                    L7 Drizzle ──▶ L8 Postgres
                       (bundles + questions + provenance)
                                   │
                                   ▼
                    L2 Eksplorer/Paket Soal ──▶ L4 /api/export/moodle-xml
                                                        │
                                                        ▼
                                                  L5 moodle/* ──▶ Moodle GitSync
```

---

## Kekuatan & Titik Lemah (temuan jujur)

### ✅ Kekuatan
- **Pemisahan lapisan jelas:** route tipis → service gemuk (bagus)
- **Engine pencarian matang:** trigram + vektor + hybrid RRF + metrik
- **Ingest canggih:** parser, validator, dedup, idempotency, worker AI
- **MCP** sudah ada (integrasi agen AI)
- **Ekspor Moodle** lengkap (GitSync)
- **Modular** (`src/modules/document-processor`)

### ⚠️ Titik lemah / perlu perhatian
1. **Skema data terbelah dua** (masalah yang memicu review ini) — v2 memperbaiki
2. **Otorisasi tak seragam** — ada `auth-guards` + `question-permissions`, perlu inventaris peran formal
3. **Banyak file akar proyek** (`fix-*.ts`, `test-*.ts`, `patch_*.js`) — kotor, perlu dibersihkan
4. **Dokumen banyak & saling tumpang-tindih** (20 file di `docs/`)
5. **`MIGRATION-v1.md` & `ADR-001`** ada — perlu dicek apakah masih selaras dgn v2
6. **Worker AI** (`ai-tagger-worker`) punya skenario "poison-pill" — perlu pemantauan

---

## Yang Belum Terpetakan (perlu diputuskan)

| Hal | Pertanyaan |
|-----|-----------|
| **Deployment** | Bagaimana di-host? Vercel? VPS? Docker? |
| **Multi-lingkungan** | Dev/staging/prod — bagaimana? |
| **Observabilitas** | Selain `logger.ts`, ada monitoring? |
| **CI/CD** | Ada pipeline? Gate apa? |
| **Backup terjadwal** | Manual atau otomatis? |
| **Skala** | Target berapa soal? berapa pengguna? |
| **Keamanan** | Rate limit, audit akses, dsb? |

---

*Dokumen ini memetakan seluruh lapisan sistem QBank berdasarkan inventaris kode nyata.
Melengkapi `ARSITEKTUR-DATA-FINAL.md` (lapisan data). Perlukan ratifikasi bagian mana
yang ingin diperdalam.*
