# Inventaris QBank → Cetak Biru MathBank

> **Tujuan:** Daftar lengkap "apa yang harus ada di MathBank" — termasuk hal-hal **implisit tersebar** yang mudah hilang kalau mulai dari nol tanpa inventaris.
> **Tanggal:** 2026-09-29.
> **Status:** untuk eksekusi pembuatan MathBank.

---

## 0. Keputusan Proyek

| Aspek | Keputusan |
|-------|-----------|
| **Lokasi** | `~/projects/mathbank` (repo Git baru) |
| **Teknologi** | **Sama** — Next.js + Postgres + Drizzle + TypeScript |
| **Data lama** | **Dibawa nanti** (ada rencana impor dari QBank; sekarang mulai kosong) |
| **Hubungan** | MathBank **menggantikan** QBank (QBank pensiun) |
| **Arsitektur data** | Pakai `docs/ARSITEKTUR-DATA-FINAL.md` (v2) — sudah matang |
| **Desain UI** | Pakai arah Linear/Vercel + kerangka tema (sudah dirancang) |

---

## 1. Konfigurasi Akar (salin)

| File | Isi | Catatan |
|------|-----|---------|
| `package.json` | Deps + skrip | Perlu ditinjau ulang |
| `next.config.ts` | Config Next.js | Cek `serverExternalPackages`, dll |
| `tsconfig.json` | TS config (path alias `@/*`) | Salin |
| `vitest.config.ts` | Config tes | Salin |
| `postcss.config.mjs` | Tailwind v4 | Salin |
| `drizzle.config.ts` | Config Drizzle Kit | Sesuaikan |
| `pnpm-workspace.yaml` | Workspace | Cek perlu/tidak |

---

## 2. Dependensi Kunci (dari QBank)

```
@base-ui/react, @better-auth/api-key, @better-auth/drizzle-adapter,
@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities,
@modelcontextprotocol/sdk, @modelcontextprotocol/server,
@tanstack/react-query, @types/crypto-js, adm-zip, better-auth,
class-variance-authority, clsx, crypto-js, diff, dotenv,
drizzle-orm, image-size, isomorphic-dompurify, katex, lucide-react,
mammoth, mcp-handler, mime-types, next, pdf-parse, pg, postgres,
react, react-dom, sonner, tailwind-merge, yaml, zod
```

---

## 3. Variabel Lingkungan (ENV)

| Variabel | Untuk |
|----------|-------|
| `DATABASE_URL` | Koneksi Postgres |
| `DB_MAX_CONNECTIONS` | Pool koneksi |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Better Auth |
| `MEDIA_STORAGE_PATH` | Penyimpanan aset |
| `LOG_LEVEL` | Telemetry |
| `BGE_M3_SERVICE_URL` | Layanan embedding |
| `OPENAI_API_KEY` / `OPENROUTER_API_KEY` | LLM (ingest, enrichment) |
| `TIKZ_TMP_ROOT` | Kompilasi TikZ temp |
| `QBANK_ALLOW_DEV_PASSWORD` / `QBANK_BOOTSTRAP_PASSWORD` | Bootstrap admin |
| `ALLOW_TEST_AUTH_BYPASS` | Tes (TEST env saja) |

---

## 4. ⚠️ HAL IMPLISIT TERSEBAR (WAJIB DIINVENTARIS)

**Ini bagian paling penting** — hal yang membuat sistem jalan tapi tak tertulis di fitur.

### 4.1 Keamanan LaTeX
- `openin_any='p'` — **mitigasi LFI yang sengaja** (jangan diubah jadi 'a'!)
- Temp dir → `/tmp` (perbaikan bug)
- Lokasi: `src/lib/services/asset-service.ts` (spawn latex)

### 4.2 Embedding
- Model **BGE-M3**, URL `http://127.0.0.1:3005/v1/embeddings`
- **Dimensi WAJIB 1024** (validasi zod `.length(1024)` — kalau salah, mati)
- Threshold dedup: **0.98** (master) / **0.85** (near)
- Lokasi: `src/lib/services/embedding-provider/bge-m3-provider.ts`, `src/lib/search/dedup.ts`

### 4.3 Database Safety
- Fungsi `set_updated_at()` + **13 trigger** `trg_<tabel>_updated_at`
- CHECK difficulty 1–5
- Lokasi: `drizzle/0001_db_safety.sql`

### 4.4 Otorisasi (2 lapisan)
- `src/lib/auth-guards.ts` — guard umum
- `src/lib/question-permissions.ts` — izin spesifik soal
- Dipakai di **42 file** — perlu disatukan/diformalkan di MathBank

### 4.5 MCP (kebijakan tulis)
- 5 tool: `create_question`, `bulk_create_questions`, `search_existing_questions`, `search_asset_gallery`, `register_diagram_asset`
- **Batas:** agen boleh tulis soal/aset; **TIDAK** bundle/status/hapus
- Near-duplicate → `is_flagged`, tak langsung simpan
- Lokasi: `src/mcp-server/`

### 4.6 Ekspor Moodle (format khusus)
- `@@PLUGINFILE@@` — placeholder file Moodle
- Macro kustom (`expandCustomMacros`)
- GitSync struktur repo
- Lokasi: `src/lib/services/moodle/` (gitsync, markdown, quiz-package-generator, shared, xml-generator)

### 4.7 Pencarian (3 mode)
- **Trigram** (`pg_trgm` GIN) — fuzzy
- **Vector** (cosine, HNSW) — semantik
- **Hybrid** (RRF, k=60) — gabungan
- Metrics: p95/p99, alert >500ms
- Lokasi: `src/lib/search/{dedup,rrf,metrics}.ts`

### 4.8 FSM Soal
- Transisi status: draft ↔ review ↔ ready, FLAG/UNFLAG
- Lokasi: `src/lib/fsm/question-fsm.ts`

### 4.9 Test Infra
- Global `beforeAll` di `src/test/setup.ts` — seed actor idempoten (TEST env)
- `src/test/test-actors.ts`
- **156 file tes**

### 4.10 Ingest Pipeline
- Parser: `corpus-parser.ts`, `document-processor/parsers/`
- Validator: distribusi kesulitan & Bloom
- Queue, commit, idempotency, worker AI
- `is_flagged` otomatis (7 skenario)

---

## 5. Folder yang Disalin Selektif (Kode Bagus)

| Folder | File | Aksi |
|--------|------|------|
| `src/lib/search/` | 3 | **Salin** (dedup, rrf, metrics) |
| `src/lib/services/moodle/` | 5 | **Salin** (ekspor Moodle) |
| `src/mcp-server/` | 3 | **Salin + rapikan** |
| `src/lib/fsm/` | 1 | **Salin** |
| `src/lib/telemetry/` | 1 | **Salin** |
| `config/curriculum.yaml` | 1 | **Salin** (jadi seed taksonomi) |
| `src/modules/document-processor/` | — | **Salin** (parser) |

---

## 6. Yang DIBUANG (tak disalin)

- **Skema data lama** → ganti arsitektur v2 (`ARSITEKTUR-DATA-FINAL.md`)
- **`question_sources`** (16.913 teks bebas) → `source_id`+`event_id`
- **File akar kotor**: `fix-*.ts`, `test-*.ts`, `patch_*.js`, `crawl*.log`, `*.sql` backup
- **`sources`/`schools`/`exam_events`/`categories`/`question_embeddings`** lama
- **Dokumen lama** (sudah diarsipkan di QBank)

---

## 7. Yang DIPERTAHANKAN dari QBank (aset pengetahuan — bukan kode)

- ✅ `ARSITEKTUR-DATA-FINAL.md` — cetak biru data
- ✅ `ARSITEKTUR-SISTEM-FULL.md` — peta 9 lapisan
- ✅ `CATATAN-INTERVIEW-ARSITEKTUR.md` — 36 keputusan
- ✅ `DESIGN-THEME-FRAMEWORK.md` + `THEME-FRAMEWORK-GUIDE.md` — tema
- ✅ `VISION.md` (sudah disesuaikan untuk MathBank)
- 📦 `ROADMAP-QBANK.md` & `RENCANA-MIGRASI-DATA.md` → **arsip** (QBank; migrasi DIBATALKAN)

---

## 8. Urutan Pembangunan MathBank

```
LANGKAH 0  Buat repo + Next.js + konfigurasi (salin §1-3)
LANGKAH 1  Pasang dependensi (§2)
LANGKAH 2  Bangun lapisan data v2 (ARSITEKTUR-DATA-FINAL.md)
LANGKAH 3  Seed taksonomi (dari curriculum.yaml)
LANGKAH 4  Dasar: auth, telemetry, test infra
LANGKAH 5  Salin selective: search, fsm, moodle, parser, MCP
LANGKAH 6  Services domain (question, source, event, bundle...)
LANGKAH 7  API layer
LANGKAH 8  UI (Linear/Vercel — pakai tema yang sudah dirancang)
LANGKAH 9  Ingest pipeline
LANGKAH 10 (DIBATALKAN) Impor data dari QBank — tak ada migrasi data (ADR-0001)
```

---

## 9. Yang Perlu Diputuskan Sebelum Mulai

1. **Nama paket/DB** — `mathbank`? nama DB `mathbank`?
2. **Skema DB v2** — pakai persis `ARSITEKTUR-DATA-FINAL.md`, atau ada revisi?
3. **Otorisasi** — saat salin, **satukan** 2 guard jadi 1 sistem peran formal? (kesempatan bersih)
4. **Tailwind/tema** — pakai kerangka tema generatif yang sudah dibuat, atau mulai baru?
5. **MCP & Moodle** — salin apa adanya, atau tulis ulang bersih?

---

*Dokumen ini cetak biru pembuatan MathBank. Setiap hal implisit (§4) WAJIB dibaca
sebelum menulis kode, agar bug lama tidak terulang.*
