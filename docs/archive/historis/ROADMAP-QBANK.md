# ROADMAP QBank v1.0.0

> 📦 **ARSIP — era QBank. Bukan dokumen aktif.**
> Rencana eksekusi MathBank ada di **`docs/MILESTONE.md`**. QBank **dipensiunkan** (ADR-0001).
> Disimpan sebagai referensi historis saja.

> **Dokumen ini menjawab:** *Dalam urutan apa kita mengeksekusi, dan sejauh mana sudah jalan?*
> **Fondasi:** `VISION.md` (tujuan) · `PRD-SYSTEM-ARCHITECTURE.md` (arsitektur)
> **Basis verifikasi:** commit `bc135ac` (2026-09-29), dikonfirmasi terhadap kode & DB nyata.
>
> **Legenda status:**
> - ✅ **SELESAI** — terverifikasi ada di kode/DB
> - 🟡 **PARSIAL** — sebagian terimplementasi
> - ⬜ **BELUM** — direncanakan, belum dikerjakan

---

## 0. Ringkasan Progres

| Track | Total item | ✅ Selesai | 🟡 Parsial | ⬜ Belum |
|-------|-----------|-----------|-----------|---------|
| **Backend Modernization** (P0–P6) | 27 | 18 | 3 | 6 |
| **UI Remake** (T0–T9) | 13 | 3 | 2 | 8 |
| **Total** | 40 | **21** | **5** | **14** |

**Bacaan cepat:** Backend/arsitektur sebagian besar **sudah dieksekusi** (P3 penuh, P0 & P2 tuntas). Yang tersisa mayoritas **UI remake** + **polish platform**.

---

## Track A — Backend Modernization (7 Fase)

### Phase 0 — Foundation ✅ SELESAI (3/3)

| Item | Status | Bukti |
|------|--------|-------|
| CONSTRAINTS.md (floor rules + threshold) | ✅ | File ada |
| development.md (setup guide) | ✅ | `docs/development.md` ada |
| Production secret guard (`BETTER_AUTH_SECRET`) | ✅ | Guard ada di kode |

### Phase 1 — DB Safety ✅ SELESAI (3/3)

| Item | Status | Bukti |
|------|--------|-------|
| `cognitiveLevelEnum` pgEnum | ✅ | Ada di schema |
| Trigger `set_updated_at()` | ✅ | **13 trigger** terpasang (migrasi `0001_db_safety.sql`), teruji fungsional |
| CHECK `difficulty BETWEEN 1 AND 5` | ✅ | Constraint `question_items_difficulty_check` terpasang & teruji |

> ✅ Dituntaskan 2026-09-29: PLAN.md menandai selesai, tapi verifikasi DB menunjukkan trigger & CHECK belum ter-apply. Migrasi `0001_db_safety.sql` dibuat & diterapkan (prod + test), diverifikasi fungsional.

### Phase 2 — Security & Auth ✅ SELESAI (2/2)

| Item | Status | Bukti |
|------|--------|-------|
| Zero `\|\| 'system'` fallback | ✅ | grep = 0 hasil |
| `requireAuthSession()` / guards | ✅ | `src/lib/auth-guards.ts` ada |

### Phase 3 — Architecture ✅ SELESAI (6/6)

| Item | Status | Bukti |
|------|--------|-------|
| Split QuestionService → modul | ✅ | `src/lib/services/question/` |
| FSM Engine (11 actions, guards) | ✅ | `src/lib/fsm/question-fsm.ts` |
| 5 payload formats (11 tipe → 5) | ✅ | `src/lib/validations/payload-formats.ts` |
| Backup streaming overhaul | ✅ | Service streaming ada |
| Structured JSON logger | ✅ | `src/lib/telemetry/logger.ts` |
| IdempotencyManager | ✅ | Ada di kode |
| Embedding inline (drop `question_embeddings`) | ✅ | Kolom `embedding` di `question_items` |

### Phase 4 — Search & Performance 🟡 PARSIAL (3/4)

| Item | Status | Bukti |
|------|--------|-------|
| RRF scoring (k=60) | ✅ | `src/lib/search/rrf.ts` |
| Search latency metrics (p50/p95/p99) | ✅ | `src/lib/search/metrics.ts` |
| Bundle analyzer (`<85KB` gzip) | ✅ | `@next/bundle-analyzer` di deps |
| Dedup thresholds (0.98/0.85) | ⬜ | Belum ada konstanta formal |

### Phase 5 — UI & UX 🟡 PARSIAL (1/6)

| Item | Status | Bukti |
|------|--------|-------|
| Print CSS / A4 preview | ✅ | `@media print` + `break-inside` ada |
| OKLCH 3-line theme system | ⬜ | **0 `oklch()` di kode** |
| Keyboard shortcuts (`useKeyboardShortcuts`) | ⬜ | Hook belum ada |
| Error boundaries per-section | ⬜ | Global saja |
| PWA setup | ⬜ | `public/manifest.json` tidak ada |
| Soft delete + Recycle Bin | 🟡 | Soft-delete ada; Recycle Bin UI belum |

### Phase 6 — Platform 🟡 PARSIAL (1/4)

| Item | Status | Bukti |
|------|--------|-------|
| MCP server enhancement | ✅ | `scripts/mcp-server-stdio.ts` |
| Sources umbrella table | ✅ | `schema/sources.ts` (+ sudah dipakai) |
| Dashboard analytics | ⬜ | Belum ada |
| OpenAPI documentation | ⬜ | Tidak ada `openapi`/`swagger` |
| E2E Playwright | ⬜ | `playwright.config.ts` tidak ada |

---

## Track B — UI Remake (10 Tahap)

| Tahap | Item | Status | Bukti |
|-------|------|--------|-------|
| T0 | Ratifikasi keputusan desain | ✅ | `DESIGN.md` + artefak agy |
| T1 | Fondasi tipografi (Roboto Flex + JetBrains Mono) | 🟡 | Roboto Flex ✅ di `layout.tsx`; verifikasi mono pending |
| T2 | App shell (sidebar 5 domain + header breadcrumb) | ⬜ | Sidebar masih "Studio & Sistem", bukan 5 domain |
| T3 | **Backend Source→Bundle→Item** | ✅ | `question_bundles`+`bundle_items` (D1/D2 selesai) |
| T4 | Explorer 3 mode (list/grid/masonry) | 🟡 | `QuestionMasonryView.tsx` ada; integrasi & reading-order belum |
| T5 | Halaman Paket & Naskah (`/packages`) | 🟡 | `/packages` ada + `/packages/[id]/edit` (commit 7a3dadf) |
| T6 | Editor Soal split-screen | ⬜ | Layout 50:50 + live preview belum |
| T7 | Review Queue 3-panel + Mode Triage | 🟡 | Queue ada; triage + `useKeyboardReview` belum |
| T8 | Halaman Sumber Asal (`/sources`) | 🟡 | `/sources` + SourceModal/EventModal ada |
| T9 | Polish & micro-interactions | ⬜ | Command palette ada; cheatsheet/skeleton contextual belum |

---

## Urutan Eksekusi Berikutnya (Usulan)

Berdasarkan dependensi & dampak:

### 🔴 Prioritas 1 — Tutup utang gate kualitas
1. ✅ **Test diperbarui** (kategori A+B, 2026-09-29): seed actor di setup test
   + perbaikan bug LaTeX temp-dir + 9 test usang disinkronkan ke UI terkini.
   ⏸️ **Ditunda (arahan user)**: `ai-tagger-worker` & `enrich-corpus-drafts`
   (flaky, bergantung LLM/ingest) → akan dibahas khusus bersama fitur ingest.
2. ✅ **Phase 1 tuntas**: trigger `set_updated_at` (13 trigger) + CHECK difficulty
   ter-apply via `drizzle/0001_db_safety.sql` di prod + test, terverifikasi fungsional.

### 🟠 Prioritas 2 — UI Remake inti (Visibilitas)
3. **T2**: Sidebar 5 domain kerja (bukan accordion)
4. **T4**: Integrasi 3 mode eksplorasi (list/grid/masonry yang sudah setengah jadi)
5. **T1**: OKLCH multi-tema (fondasi visual)

### 🟡 Prioritas 3 — Kapabilitas Platform
6. **T6**: Editor split-screen
7. **T9**: Polish (keyboard shortcuts, PWA, error boundaries)
8. **P6**: OpenAPI + E2E + dashboard

Sesuai preferensi Anda (transkrip #1141): **"satu persatu aja"** — evaluasi bertahap per tahap sebelum eksekusi.

---

## Changelog Mapping

| Fase | Version | Deliverable Utama | Status |
|------|---------|-------------------|--------|
| Phase 0 | v0.9.1 | Contracts + docs | ✅ |
| Phase 1 | v0.9.2 | DB safety | 🟡 |
| Phase 2 | v0.9.3 | Auth hardening | ✅ |
| Phase 3 | v0.9.4 | Architecture refactor | ✅ |
| Phase 4 | v0.9.5 | Search + performance | 🟡 |
| Phase 5 | v0.9.6 | UI/UX polish | 🟡 |
| Phase 6 | v1.0.0 | Full platform release | 🟡 |

**Versi saat ini:** `0.9.0` (`package.json`)

---

## Exit Gate v1.0.0

Sebelum tag v1.0.0, semua harus pass:

```bash
pnpm exec tsc --noEmit          # 0 errors
pnpm run lint                   # 0 warnings, 0 errors
pnpm test                       # All pass, ≥85% coverage
pnpm run build                  # <85KB gzipped first load
grep -rn '@ts-ignore' src/      # 0 results
grep -rn 'eslint-disable' src/  # 0 results
grep -rn "|| 'system'" src/     # 0 results
grep -rn 'test.skip' src/ tests/ # 0 results
```

---

## Rujukan

- **Visi:** `VISION.md`
- **Arsitektur:** `PRD-SYSTEM-ARCHITECTURE.md`
- **Rencana asli:** `docs/_reconcile/brain-artifacts/qbank-v1-modernization-plan.md`, `qbank-ui-remake-plan.md`, `PLAN.md`

---

*Semua status di atas diverifikasi terhadap kode/DB pada commit `bc135ac`. Bila kode bergerak, dokumen ini perlu disinkronkan ulang.*
