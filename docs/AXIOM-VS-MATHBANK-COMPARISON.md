# Komparasi Arsitektur: Axiom vs MathBank

> **Catatan pengembangan MathBank v2.0**
> Dibuat: 2026-10-16
> Tujuan: Dokumentasi perbandingan arsitektur kedua sistem sebagai basis keputusan evolusi MathBank.

---

## 1. Overview

| Aspek | **Axiom** | **MathBank** |
|-------|-----------|-------------|
| Tabel DB | 15 (8 domain + 5 auth + 2 join) | **26** (13 domain + 6 auth + 4 system + 3 join) |
| API Routes | ~18 endpoint groups | **~35+** endpoint groups |
| Tipe Soal | 7 | **11** |
| Roles | 1 (`admin`) | **5** (`admin`, `teacher`, `reviewer`, `agent`, `machine`) |
| Services | 8 service files | **12+ barrel services, 50+ files** |
| Pages | ~10 | **~18** |
| Tech Stack Core | Next.js 16 + Drizzle + PG18 + Better Auth | Sama + TanStack Query + Ollama AI + Docker |

Keduanya berbagi DNA yang sama — tech stack identik. MathBank merupakan **evolusi lanjutan dari Axiom**.

---

## 2. Database Schema

### 2.1 Tabel `questions`

| Kolom / Fitur | Axiom | MathBank | Pemenang |
|---|---|---|---|
| Tipe soal | 7 enum | **11 enum** (+ `stimulus`, `assertion_reason`, `combination_1234`, `quantitative_pq`, `data_sufficiency`, `matrix_grid`, `matching`, `essay`) | MathBank |
| Options storage | `jsonb` di kolom questions | **Tabel terpisah `question_options`** dengan `distractor_rationale` | MathBank ✅ |
| Stimulus hierarchy | Tidak ada `parent_id` | **`parent_id` + `child_order`** self-referential | MathBank ✅ |
| Embedding | Tidak ada | **`vector(1024)`** inline + provenance hash | MathBank ✅ |
| AI tracking | Tidak ada | **`ai_tagged`, `ai_tagged_at`, `ai_model_name`** | MathBank ✅ |
| Grade system | Tidak ada kolom grade | **`grade` varchar FK → grades reference table** | MathBank ✅ |
| Status FSM | 3 state: `draft→review→ready` | **4 state: `draft→review→ready→archived`** | MathBank ✅ |
| Author tracking | Tidak ada `author_id` | **`author_id` + `last_reviewed_at`** | MathBank ✅ |
| Content hash dedup | ✅ partial unique | ✅ partial unique | Seri |
| Indexing | Minimal | **12+ index** termasuk composite, GIN trigram, HNSW vector | MathBank ✅ |

### 2.2 Solutions

| Fitur | Axiom | MathBank |
|---|---|---|
| Tipe solusi | `varchar(30)` free-text | **4 enum**: `conceptual`, `quick_tip`, `video`, `alternative` |
| Ordering | `rank` (integer, partial unique) | `is_primary` boolean flag |
| Author tracking | Tidak ada | **`author_type`** (teacher/agent/machine/system), `author_id`, `ai_model_name`, `verified_by_id` |

MathBank memiliki provenance solusi yang jauh lebih kaya — tahu siapa buat, AI atau manusia, dan siapa verifikasi.

### 2.3 Taxonomy & Reference

| Tabel | Axiom | MathBank |
|---|---|---|
| `topics` | `name`, `parent_id`, `sort_order` | + **`slug`**, **`level` (CHECK 1–3)**, **`usage_count`**, **`is_active`** |
| `grades` | ❌ Tidak ada | ✅ Dedicated table (`id`, `label`, `level_group`, `curriculum_phase`) |
| `difficulty_levels` | Hanya CHECK 1–5 | ✅ **Reference table** dengan label deskriptif |
| `cognitive_levels` | Enum C1–C6 | ✅ **Reference table** dengan deskripsi lengkap |
| `events` | `subtests` as `text[]` | `subtests` as **`jsonb`** + **`color_token`** untuk design system |

### 2.4 Bundles

| Fitur | Axiom | MathBank |
|---|---|---|
| Item table | `bundle_questions` (composite PK) | **`bundle_items`** (uuid PK sendiri) — lebih fleksibel |
| Bundle type | Tidak ada enum | **`bundle_type`** (`source`/`exam`) + **`origin`** (`ingest`/`manual`) |
| Event linking | Tidak ada | ✅ `event_id` FK pada bundle |
| Duration | Tidak ada | ✅ `duration_minutes` |
| Instructions | Tidak ada | ✅ `instructions` text |
| Print config | `print_config` jsonb di bundle | Belum ada di schema |
| Slug | Tidak ada | ✅ `slug` unique partial index |

### 2.5 Media

| Fitur | Axiom | MathBank |
|---|---|---|
| Table name | `media` | `media_assets` |
| Parent lineage | Tidak ada | ✅ `parent_asset_id` FK |
| Source origin | `source_origin` text biasa | **7-enum** (`manual_upload`, `pdf_crop`, `ai_generated_tikz`, `ai_generated_svg`, `web_scrape`, `web_ingest`, `tex_import`) |
| Question join | Tidak ada (shortcode only) | ✅ **`question_media`** M:N dengan `role` enum |
| Original vs processed | `storage_path` + `svg_path` | **`original_image_path`** + `svg_path` (lebih eksplisit) |

### 2.6 Tabel Eksklusif MathBank

| Tabel | Fungsi |
|---|---|
| `grades` | Jenjang pendidikan Indonesia (SD/SMP/SMA) |
| `difficulty_levels` | Reference table tingkat kesulitan |
| `cognitive_levels` | Reference table taksonomi Bloom |
| `user_roles` | M:N multi-role per user |
| `question_media` | M:N soal ↔ media asset dengan role |
| `app_settings` | KV config store (termasuk AI settings, encrypted secrets) |
| `audit_logs` | Audit trail generik |
| `ingest_queue` | Pipeline ingestion queue |
| `rate_limit` | Persistent rate-limit counters |

---

## 3. Business Logic

### 3.1 Service Architecture

Axiom menggunakan **monolithic single-file services** (300–1256 LOC per file), MathBank menggunakan **SRP barrel split** (read/write/status/bulk per concern).

| Aspek | Axiom | MathBank |
|---|---|---|
| Split strategy | Single file per domain | **Barrel + SRP split** per concern |
| Table writer rule | ✅ Enforced by `check-arch.mjs` | Implicit convention |
| Layer enforcement | ✅ **Automated L1–L5 gate** | Manual discipline |
| Boundary entities | ✅ `toXxxEntity()` mappers | ✅ Projection functions (S3) |

### 3.2 Kapabilitas Eksklusif MathBank

| Fitur | Detail |
|---|---|
| AI Enrichment | 900-line enrichment engine — auto-tag topic, difficulty, cognitive level via Haladyna 31 pedagogical rules |
| Vector Embedding | BGE-M3 via Ollama, 1024-dim, inline di tabel questions |
| Hybrid Search (RRF) | Reciprocal Rank Fusion: trigram + semantic vector, dedup via Jaccard similarity |
| Ingest Pipeline | Queue-based: artikel → segmentasi → download media → register assets → create draft questions |
| Batch Operations | Bulk delete, archive, flag soal |
| Moodle Export | XML builder, LaTeX normalization untuk Moodle format |
| Audit Logging | Entity + action + diff payload audit trail |
| App Settings Store | KV config dengan secret encryption |
| Review Queue | Dedicated page untuk review workflow |
| TikZ Studio | In-app TikZ code editor/preview |
| Event Auto-Detection | Otomatis link soal ke event saat ingest |
| Metrics Endpoint | Prometheus-style `/api/metrics` |
| Readiness Probe | `/api/ready` untuk Docker/K8s |

### 3.3 Kapabilitas Eksklusif Axiom (Kandidat Port ke MathBank v2.0)

| Fitur | Detail | Prioritas Port |
|---|---|---|
| Print System | Full print engine: `print_config` jsonb, print templates, brand definitions, print sheet component, kop surat | **🔴 Tinggi** |
| Negative-Band Reorder | Two-phase reorder menggunakan negative temporary ranks untuk avoid collision | **🟡 Sedang** |
| Compare-and-Set FSM | `WHERE status = $current` optimistic concurrency — mencegah race condition | **🔴 Tinggi** |
| Deferrable Unique Constraints | `DEFERRABLE INITIALLY IMMEDIATE` di `bundle_questions.position` | **🟡 Sedang** |
| Solution Ranking | Explicit `rank` integer + `replaceAll` dengan `SELECT FOR UPDATE` locking | **🟢 Rendah** |
| Pre-paint Script | Zero-CLS inline script untuk theme/sidebar state sebelum first paint | **🟡 Sedang** |
| L1–L5 Automated Gate | `check-arch.mjs` — layer dependency enforcement sebagai CI gate | **🔴 Tinggi** |

---

## 4. Auth & Authorization

| Aspek | Axiom | MathBank |
|---|---|---|
| Roles | 1 (`admin`) — session = authorization | **5** (`admin`, `teacher`, `reviewer`, `agent`, `machine`) |
| Multi-role | ❌ | ✅ `user_roles` M:N (union semantics) |
| Permission matrix | Tidak ada — admin-only | **16 permissions × 5 roles × 3 levels** (`yes`/`own`/`no`) |
| Own-resource guard | Tidak ada | ✅ `authorId === actor.id` check |
| Rate limiting | Better Auth plugin (1000/hour API key) | **Dual**: Better Auth DB-backed + app-level token bucket (120/min) + persistent `rate_limit` table |
| Password policy | ≥12 chars, letter+digit | Same + **`must_change_password`** forced redirect |
| Security headers | Minimal | **CSP** (static + per-route), **HSTS**, `X-Frame-Options: DENY` |
| Dev bypass | Tidak terlihat | **Triple-gated** (`NODE_ENV` AND `APP_ENV` AND `AUTH_DEV_BYPASS`) |
| API key scoping | Flat permission | ✅ **Scoped per resource+action** (narrowing only) |

---

## 5. Architecture Quality

| Dimensi | Axiom | MathBank |
|---|---|---|
| Layering | ✅ **L1–L5 dengan automated enforcement** | Convention-based, no automated gate |
| Concurrency safety | ✅ Compare-and-set FSM, `SELECT FOR UPDATE`, deferrable constraints | Standard transaction isolation |
| Service decomposition | Monolithic files, clear ownership | ✅ **SRP barrel split** — lebih maintainable |
| Scalability posture | Single admin, no multi-tenancy | ✅ Multi-role, multi-user, queue-based ingest |
| Testability | ✅ Vitest + fast-check (property testing) + Playwright | Vitest + Playwright |
| Operational readiness | Health endpoint only | ✅ Health + Ready + Metrics + Docker + Caddy |
| Documentation | DESIGN.md + ADRs | ✅ **30+ docs** |

---

## 6. Evaluasi Final

### Scoring Matrix (1–5)

| Kriteria | Bobot | Axiom | MathBank | Axiom Weighted | MathBank Weighted |
|---|---|---|---|---|---|
| Schema Completeness | 20% | 3 | 5 | 0.60 | 1.00 |
| Business Logic Depth | 20% | 3 | 5 | 0.60 | 1.00 |
| Auth & Security | 15% | 2 | 5 | 0.30 | 0.75 |
| Architecture Discipline | 15% | 5 | 4 | 0.75 | 0.60 |
| Operational Readiness | 10% | 2 | 5 | 0.20 | 0.50 |
| Code Maintainability | 10% | 4 | 4 | 0.40 | 0.40 |
| Extensibility | 10% | 3 | 5 | 0.30 | 0.50 |
| **TOTAL** | **100%** | | | **3.15** | **4.75** |

### Verdict

**MathBank menang telak (4.75 vs 3.15).**

Axiom unggul hanya di satu dimensi: **architecture discipline** — automated layer enforcement (`check-arch.mjs`) dan concurrency patterns (compare-and-set FSM, deferrable constraints, negative-band reorder).

MathBank unggul di semua dimensi lain: schema (26 vs 15 tabel), cakupan pedagogis (11 vs 7 tipe soal), multi-user RBAC (5 vs 1 role), AI pipeline, ingest pipeline, Moodle export, audit logging, dan operational maturity.

---

## 7. Rencana Aksi untuk MathBank v2.0

### 🔴 Prioritas Tinggi — Port dari Axiom

1. **Port `check-arch.mjs` layer enforcement** — automated CI gate untuk dependency direction L1→L5
2. **Port compare-and-set FSM** — tambahkan `WHERE status = $current` pada semua status transitions untuk mencegah race condition
3. **Port print system** — `print_config` jsonb, template engine, brand definitions, print sheet components

### 🟡 Prioritas Sedang

4. **Port deferrable unique constraints** — `DEFERRABLE INITIALLY IMMEDIATE` pada `bundle_items.order_index`
5. **Port negative-band reorder** — two-phase reorder untuk bundle items dan solutions
6. **Port pre-paint script** — zero-CLS theme/sidebar initialization

### 🟢 Nice-to-Have

7. **Adopsi property-based testing** — fast-check untuk domain contracts
8. **Evaluasi solution ranking** — explicit `rank` integer vs `is_primary` boolean (Axiom's approach lebih fleksibel untuk multiple ranked solutions)

### ❌ Tidak Perlu Di-Port

- Single-admin auth model (MathBank sudah lebih baik)
- `jsonb` options storage (MathBank's `question_options` table sudah lebih normalized)
- Axiom's simpler schema (MathBank sudah lebih lengkap)

### 📌 Kesimpulan

Axiom bisa di-sunset setelah fitur-fitur kunci (print system, architecture gate, concurrency patterns) berhasil di-port ke MathBank v2.0. Semua kapabilitas Axiom sudah merupakan subset dari MathBank.
