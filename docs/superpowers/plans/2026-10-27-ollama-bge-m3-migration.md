# Migrasi Layanan Embedding BGE-M3 ke Ollama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan Ollama (port `:11434`) sebagai backend embedding default untuk model BGE-M3 (1024 dimensi) di MathBank menggantikan FastAPI Python (:3005), memutus dependensi ke QBank dan meningkatkan kecepatan inferensi hingga 3× lipat.

**Architecture:** Memanfaatkan seam HTTP yang sudah ada pada `src/lib/embedding/bge-m3.ts` (kontrak OpenAI `/v1/embeddings` dan Ollama `/api/embed`). Mengubah nilai konstanta default URL ke `http://127.0.0.1:11434`, menambahkan probe ringan Ollama (`/api/version`) pada health check untuk menghindari cold-inference, dan memperbarui konfigurasi environment serta dokumentasi proyek.

**Tech Stack:** TypeScript, Node.js fetch, Ollama (`bge-m3:latest`), Vitest.

**Spec:** Spike perbandingan 2026-10-27 (Cosine similarity 99.9989%, inferensi ~1.1s vs ~3.5s).

## Global Constraints

- Vektor embedding wajib tepat 1024 dimensi (`EMBEDDING_DIM = 1024`).
- Bahasa kode & identifier teknis: INGGRIS (CONSTRAINTS #28b).
- Teks untuk pengguna & komentar UI: Indonesia.
- Jangan gunakan `useMemo`/`useCallback` (CONSTRAINTS #6).
- Validasi input Zod di semua boundary bila relevan (CONSTRAINTS #22).
- Zero type errors (`pnpm typecheck`) dan zero lint errors (`pnpm lint`).
- Seluruh tes unit wajib lulus (`pnpm test`).

## Review Focus

1. **Fallback kompatibilitas endpoint**: Base URL tanpa path `/v1` atau dengan `/v1` harus tetap menuju `/v1/embeddings` secara benar.
2. **Health check non-destructive**: Health check ke Ollama tidak boleh memicu inferensi model berat berulang kali jika service merespons endpoint ringan (`/api/version` atau `/health`).
3. **Penolakan dimensi ≠ 1024**: Respons vektor selain 1024 dimensi harus tetap ditolak (`ok: false`).
4. **Isolasi dependensi**: Skrip dan konfigurasi tidak boleh merujuk ke path atau port milik proyek QBank (AGENTS.md §1).
5. **Idempotensi & konsistensi**: Vektor yang dihasilkan Ollama harus kompatibel dengan 11.867 vektor yang sudah tersimpan di PostgreSQL.

---

### Task 1: Update Embedding Client & Unit Tests (`src/lib/embedding/bge-m3.ts`)

**Files:**
- Modify: `src/lib/embedding/bge-m3.ts`
- Test: `src/lib/embedding/bge-m3.test.ts`

**Interfaces:**
- Consumes: `EMBEDDING_DIM = 1024`, `DEFAULT_EMBEDDING_URL = "http://127.0.0.1:11434"`
- Produces: `embedTexts`, `embedText`, `embeddingHealth`, `embeddingBaseUrl`, `embeddingEndpoint`

- [ ] **Step 1: Write the failing unit tests for new Ollama defaults and Ollama health probe**

Update `src/lib/embedding/bge-m3.test.ts` to assert:
- `DEFAULT_EMBEDDING_URL` is `"http://127.0.0.1:11434"`.
- `embeddingBaseUrl({})` is `"http://127.0.0.1:11434"`.
- `embeddingHealth` succeeds quickly when `GET /api/version` returns status 200 without needing a full `embedText("ping")` fallback.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/embedding/bge-m3.test.ts`
Expected: FAIL due to expected URL `"http://127.0.0.1:11434"` vs current `"http://127.0.0.1:3005"`.

- [ ] **Step 3: Implement changes in `src/lib/embedding/bge-m3.ts`**

1. Set `DEFAULT_EMBEDDING_URL = "http://127.0.0.1:11434"`.
2. Update JSDoc header explaining Ollama as the primary source of truth while keeping FastAPI backwards compatibility.
3. In `embeddingHealth`:
   - Try `GET ${base}/health` (FastAPI). If 200, return ok.
   - If 404/405, try `GET ${base}/api/version` (Ollama probe). If 200, return ok with version detail.
   - If neither responds 200, fall back to functional probe `embedText("ping")`.

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `pnpm exec vitest run src/lib/embedding/bge-m3.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/embedding/bge-m3.ts src/lib/embedding/bge-m3.test.ts
git commit -m "feat(embedding): jadikan Ollama :11434 default backend BGE-M3 + probe health cepat"
```

---

### Task 2: Update Scripts & Environment Files

**Files:**
- Modify: `scripts/batch-embed-questions.ts`
- Modify: `.env`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `DEFAULT_EMBEDDING_URL` from `src/lib/embedding/bge-m3.ts`
- Produces: Updated environment variables `BGE_M3_SERVICE_URL=http://127.0.0.1:11434`

- [ ] **Step 1: Update `scripts/batch-embed-questions.ts`**

Import `DEFAULT_EMBEDDING_URL` from `../src/lib/embedding/bge-m3` and use it as fallback:
`const SERVICE = (process.env.BGE_M3_SERVICE_URL?.trim() || DEFAULT_EMBEDDING_URL).replace(/\/+$/, "");`

- [ ] **Step 2: Update `.env` and `.env.example`**

Update comments and values:
```env
# === Embedding (BGE-M3, Ollama lokal) ===
# Default: Ollama bge-m3 (dim 1024). FastAPI :3005 juga kompatibel:
BGE_M3_SERVICE_URL=http://127.0.0.1:11434
BGE_M3_MODEL=bge-m3
BGE_M3_TIMEOUT_MS=120000
```

- [ ] **Step 3: Verify script runs against Ollama**

Run: `pnpm exec tsx scripts/batch-embed-questions.ts --help` or dry run check.
Expected: Exit 0.

- [ ] **Step 4: Commit changes**

```bash
git add scripts/batch-embed-questions.ts .env .env.example
git commit -m "chore(config): arahkan default BGE_M3_SERVICE_URL ke Ollama :11434"
```

---

### Task 3: Update Architectural Contracts & Documentation

**Files:**
- Modify: `AGENTS.md` (§9.2 Layanan embedding)
- Modify: `README.md` (§Layanan embedding)

**Interfaces:**
- Consumes: Ollama `:11434` specification and spike results.
- Produces: Accurate developer instructions for starting and managing Ollama.

- [ ] **Step 1: Update `AGENTS.md` §9.2**

Update §9.2 to document:
- Model `bge-m3` via Ollama (`http://127.0.0.1:11434`).
- Health check endpoints (`/api/version` atau `GET /` dan probe `/v1/embeddings`).
- How to ensure Ollama service is active: `systemctl status ollama` / `ollama serve`, `ollama list`.
- Note on historical FastAPI `:3005` compatibility.

- [ ] **Step 2: Update `README.md`**

Update references to embedding service setup to mention Ollama on port 11434.

- [ ] **Step 3: Commit documentation updates**

```bash
git add AGENTS.md README.md
git commit -m "docs: perbarui spesifikasi layanan embedding BGE-M3 ke Ollama di AGENTS.md dan README.md"
```

---

### Task 4: Quality Gate Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run typecheck and linting**

Run: `pnpm typecheck && pnpm lint && pnpm lint:names`
Expected: 0 errors, exit 0.

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Run live health and embedding test against running Ollama**

Run: `pnpm exec tsx -e 'import { embeddingHealth, embedText } from "./src/lib/embedding/bge-m3"; Promise.all([embeddingHealth(), embedText("test")]).then(console.log);'`
Expected: Health `{ ok: true }` and vector with length 1024.
