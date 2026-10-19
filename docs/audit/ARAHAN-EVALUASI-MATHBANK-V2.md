# 📋 ARAHAN EVALUASI MENYELEURUH MATHBANK V2
## Untuk Paperclip — Data Audit & Persiapan Pengembangan

### 🎯 TUJUAN UTAMA
Melakukan evaluasi holistik project MathBank (`/home/hari/projects/mathbank`) dengan fokus pada **data audit menyeluruh** untuk mempersiapkan fondasi pengembangan **MathBank v2**. Evaluasi harus menghasilkan rekomendasi actionable yang prioritasnya jelas.

---

## 📁 CONTEXT: PROJECT YANG DIEVALUASI

**Lokasi:** `/home/hari/projects/mathbank`  
**Status Saat Ini:** ~85% complete, production di `https://b.iyo.my.id`  
**Tech Stack:** Next.js 16 + Drizzle ORM + PostgreSQL 18 (port 5433)  
**Data Aktual:** 
- 11,860 soal matematika (5 sumber: defantri 5,831, mathcyber 3,455, m4thlab 2,707, pusmendik_tka 203, pusmendik_dayaserap 110)
- 579 bundles (paket soal)
- 174 topik dalam taksonomi hierarkis  
**Kualitas Kode:** 960 unit tests (91.8% coverage), 248 DB integration tests, 0 TypeScript error, 0 lint error  
**Dokumen:** 172 file `.md` (termasuk 22 ADR), 46 constraint mekanis di `CONSTRAINTS.md`

---

## 🔍 LINGKUP EVALUASI (7 PILLAR)

### **PILLAR 1: DATA QUALITY & INTEGRITY AUDIT** ⭐⭐⭐ (PRIORITAS TINGGI)

#### 1.1 Data Soal (Questions)
- [ ] **Volume & Distribusi**: Analisis distribusi 11,860 soal per:
  - Sumber data (source_id breakdown)
  - Status (draft/ready/archived)
  - Tingkat kesulitan (difficulty level)
  - Jenis soal (question_type): pilihan ganda, uraian, benar/salah, dll.
  - Topik/mata pelajaran (taxonomy coverage)
  
- [ ] **Data Quality Checks**:
  - Soal tanpa `answer_key` (harusnya draft)
  - Soal dengan KaTeX syntax error (gunakan `katex-lint.ts`)
  - Soal duplikat (cek `near/exact dedup` threshold di `fusion.ts`)
  - Soal dengan konten kosong atau terlalu pendek (< 50 karakter)
  - Soal dengan embedding NULL atau invalid (vektor BGE-M3 1024d)
  - Konsistensi format LaTeX: `\( \)` inline vs `\[ \]` display (CONSTRAINT #29)

- [ ] **Content Enrichment Gap**:
  - Persentase soal yang sudah `aiTagged` (AI-enriched)
  - Soal tanpa `reasoning` field
  - Soal tanpa tags/kategori
  - Soal tanpa stimulus (gambar/diagram) yang seharusnya ada

#### 1.2 Data Bundles (Paket Soal)
- [ ] **Bundle Health**:
  - 579 bundles: berapa yang aktif, berapa archived?
  - Rata-rata jumlah soal per bundle (ideal: 20-40 soal)
  - Bundle dengan 0 soal (empty bundles = data anomaly)
  - Bundle tanpa judul/deskripsi
  - Order index integrity (cek CONSTRAINT #45)

- [ ] **Bundle-Question Relationship**:
  - Apakah ada soal yang tidak masuk ke bundle manapun? (orphan questions)
  - Apakah ada bundle yang mereferensi soal yang sudah dihapus? (dangling references)
  - Cek `RESTRICT` delete logic (CONSTRAINT #46) - apakah archived bundles menyandera soal?

#### 1.3 Taxonomy & Topics
- [ ] **Hierarchy Integrity**:
  - 174 topik: depth distribution (berapa level max?)
  - Cycle detection (trigger `trg_topics_cycle`)
  - Orphan topics (tanpa parent tapi bukan root)
  - Topik tanpa soal sama sekali (empty topics)
  - Slug uniqueness & length (CONSTRAINT #40)

- [ ] **Curriculum Coverage**:
  - Mapping ke kurikulum nasional (ada di `qbank/config/curriculum.yaml` - utang teknis)
  - Gap analysis: topik mana yang belum punya soal cukup (>10 soal)?

#### 1.4 Media Assets
- [ ] **Asset Hygiene**:
  - Total media assets di `media_assets` table
  - Asset yang direferensi oleh soal vs orphan assets (tidak dipakai)
  - SHA-256 deduplication efficiency (berapa banyak duplicate files?)
  - Shortcode consistency: `{{img:<shortId>}}` di content vs actual media_records
  - Asset size distribution (berapa yang > 1MB? optimasi needed?)

---

### **PILLAR 2: CODEBASE HEALTH & TECHNICAL DEBT** ⭐⭐⭐

#### 2.1 Constraints Compliance (CONSTRAINTS.md - 46 rules)
- [ ] Jalankan `pnpm check` (tsc + lint + test) → hasilnya?
- [ ] Cek setiap constraint #1-46:
  - ✅ Fully compliant
  - ⚠️ Partially compliant (with exceptions)
  - ❌ Violation detected (with evidence)
- [ ] **Known Drifts dari audit lama**:
  - Table count: Docs claim 28/27, actual 26 (STALE-CLAIM)
  - Question count: Docs claim "0 soal", actual 11,860 (REVERSE-STALE-CLAIM)
  - Naming violation: 49 files di `scripts/dev/` bahasa Indonesia (CONSTRAINT #28b)

#### 2.2 Test Coverage Analysis
- [ ] **Unit Tests** (960 tests, 88 files):
  - Coverage per module: auth, ingest, math, export, search, dll.
  - Module dengan coverage < 85% (gap priority)
  - Tes yang mock DB vs tes yang hit DB nyala
  
- [ ] **DB Integration Tests** (248 tests, 23 files):
  - Schema migration test pass?
  - Trigger test coverage (24 triggers - semua teruji?)
  - Constraint test (CHECK constraints, invariants)
  
- [ ] **E2E Tests** (Playwright):
  - Ada berapa skenario e2e?
  - Critical path coverage: login → search → add to bundle → print PDF → export Moodle?

#### 2.3 Code Smells & Technical Debt
- [ ] File besar (>300 lines) yang melanggar CONSTRAINT #16
- [ ] Dead code (code yang tidak dipakai, CONSTRAINT #19)
- [ ] `useMemo`/`useCallback` usage (CONSTRAINT #6 - should be minimal)
- [ ] `space-y-*` usage (CONSTRAINT #7 - should use `gap-*`)
- [ ] Manual `z-index` (CONSTRAINT #8)
- [ ] Form tanpa `FieldGroup`+`Field` (CONSTRAINT #9)

---

### **PILLAR 3: ARCHITECTURE READINESS FOR V2** ⭐⭐

#### 3.1 Current Architecture Assessment
- [ ] Baca `docs/ARCHITECTURE.md` dan `docs/DESAIN-PER-LAPISAN-MATHBANK.md`
- [ ] Evaluasi 6-layer architecture (L1-L6):
  - L1 (Auth/Role): Siap untuk multi-tenancy?
  - L2 (API): Rate limiting konsisten? (CONSTRAINT #33)
  - L3 (Service): Function size < 300 lines? (CONSTRAINT #16)
  - L4 (Engine): Pure functions? No DB/network? (CONSTRAINT #15)
  - L5 (Data Access): Drizzle ORM pattern consistency
  - L6 (Infrastructure): PostgreSQL 18 features utilized?

#### 3.2 Scalability Bottlenecks
- [ ] **Database**:
  - Query performance: slow query log analysis?
  - Index utilization: apakah semua query pakai index efisien?
  - Connection pooling: siap untuk concurrent users?
  - Table partitioning needed untuk 11,860+ soal?
  
- [ ] **Application**:
  - KaTeX rendering cache (LRU 2000) - cukup untuk traffic tinggi?
  - Embedding service (BGE-M3 port 3005) - single point of failure?
  - File upload handling (media assets) - storage scaling?

#### 3.3 Technical Debt for V2
- [ ] **qbank ETL Migration**: 84 akun & 373 koleksi masih di port 5432
- [ ] **Curriculum YAML**: Masih di qbank, bukan di mathbank (utang)
- [ ] **Embedding Service**: Masih di `/home/hari/services/embedding-service/`, belum containerized
- [ ] **Dev Scripts**: 150+ untracked files di `scripts/dev/` - cleanup needed

---

### **PILLAR 4: SECURITY POSTURE AUDIT** ⭐⭐⭐

#### 4.1 Authentication & Authorization
- [ ] Better Auth configuration: session vs API key separation
- [ ] Role-based access control (admin/guru/penelaah/agen)
- [ ] Permission guards (`src/lib/auth/guards.ts`) - coverage lengkap?
- [ ] Route authorization bugs (seperti T-M4-3 yang sudah diperbaiki) - regression test?

#### 4.2 Input Validation & Sanitization
- [ ] Zod schema di semua API endpoints (CONSTRAINT #22)
- [ ] SQL injection prevention (Drizzle ORM parameterized queries)
- [ ] XSS prevention (KaTeX rendering - `openin_any='p'`, CONSTRAINT #20)
- [ ] SSRF mitigation (fetch.ts DNS check - sudah diperbaiki?)

#### 4.3 Data Protection
- [ ] `answer_key` exposure prevention (CONSTRAINT #34 - projection)
- [ ] `embedding*` columns hidden from API responses
- [ ] Audit log immutability (`trg_audit_logs_immutable`)
- [ ] Rate limiting di semua mutation endpoints (CONSTRAINT #33)

#### 4.4 Infrastructure Security
- [ ] Environment variables: tidak hardcoded (CONSTRAINT #21)
- [ ] `AUTH_DEV_BYPASS` mati di production (CONSTRAINT #23)
- [ ] CORS configuration
- [ ] CSP headers

---

### **PILLAR 5: PERFORMANCE & OBSERVABILITY** ⭐⭐

#### 5.1 Performance Metrics
- [ ] **Current Metrics** (from `src/lib/telemetry/`):
  - Request latency: p50/p95/max
  - Error rate
  - Throughput (requests/second)
  
- [ ] **Critical Paths**:
  - Search query latency (hybrid text + vector search)
  - KaTeX rendering time (per question)
  - Bundle PDF generation time (for large bundles 100+ soal)
  - Moodle XML export time

#### 5.2 Monitoring & Alerting
- [ ] Health check endpoint: `src/app/api/health/route.ts`
- [ ] Metrics endpoint: `src/app/api/metrics/route.ts`
- [ Logger implementation: structured logging?
- [ ] Error tracking (Sentry/dll)?
- [ ] Uptime monitoring?

#### 5.3 Caching Strategy
- [ ] Next.js cache (`"use cache"`, `revalidateTag`) - usage correct? (CONSTRAINT #41)
- [ ] KaTeX LRU cache hit rate?
- [ ] Database query caching?
- [ ] Static asset caching (media files)

---

### **PILLAR 6: DOCUMENTATION & GOVERNANCE** ⭐⭐

#### 6.1 Documentation Currency
- [ ] **AGENTS.md**: Update drift findings (table count, question count)
- [ ] **README.md**: Sync with actual status (27 tabel → 26)
- [ ] **CONSTRAINTS.md**: All 46 rules still relevant?
- [ ] **CHANGELOG.md**: Up to date with latest commits?

#### 6.2 ADR (Architecture Decision Records) Status
- [ ] Review all 22 ADRs in `docs/ADR/`:
  - Status: Active / Superseded / Deprecated?
  - Implementation verified?
  - Relevance for V2?
  
#### 6.3 Audit Documentation
- [ ] Existing audit: `.gemini/.../scratch/audit-mathbank.md`
- [ ] New audits in `docs/audit/`: semua punya §Catatan Verifikasi? (CONSTRAINT #44)
- [ ] Verification documents: `docs/VERIFIKASI-*.md`

---

### **PILLAR 7: OPERATIONAL READINESS** ⭐

#### 7.1 CI/CD Pipeline
- [ ] `.github/workflows/ci.yml`: Complete?
- [ ] Test coverage gate?
- [ ] DB migration automation?
- [ ] Deployment pipeline (production → https://b.iyo.my.id)?

#### 7.2 Backup & Recovery
- [ ] `docs/BACKUP-RECOVERY.md`: Procedure documented?
- [ ] PG backups scheduled? (pg_dump/wal-g)
- [ ] Media asset backups?
- [ ] Recovery tested? (RTO/RPO metrics)

#### 7.3 Development Workflow
- [ ] Git branch strategy: `paperclip/dev` saat ini
- [ ] Commit convention?
- [ ] PR review process?
- [ ] Local development setup (`pnpm dev`) reliable?

---

## 📊 OUTPUT YANG DIHARAPKAN

### Deliverable 1: Executive Summary (1-2 halaman)
- Overall health score (1-10) per pillar
- Critical findings (must-fix before V2)
- Quick wins (easy fixes, high impact)
- Technical debt backlog (prioritized)

### Deliverable 2: Detailed Findings Report
- **Format Markdown** dengan struktur:
  ```
  ## [PILAR].[SUBSECTION]: [JUDUL TEMUAN]
  
  **Severity:** 🟢 Low | 🟡 Medium | 🔴 High | ⚫ Critical  
  **Evidence:** [Path:line] atau query result  
  **Impact:** [Dampak bisnis/teknis]  
  **Recommendation:** [Action item spesifik]  
  **Effort:** [Story points / hours estimate]  
  **Priority:** [P0-P3]
  ```

### Deliverable 3: V2 Readiness Checklist
- Daftar checklist yang HARUS selesai sebelum mulai V2 development
- Dipisahkan menjadi:
  - **Must Have** (blocking issues)
  - **Should Have** (strongly recommended)
  - **Nice to Have** (improvements)

### Deliverable 4: Data Quality Dashboard (Mockup)
- Summary statistics (jumlah soal, bundle, topik, media)
- Quality metrics (% soal siap pakai, % coverage, dll.)
- Gap analysis (topik yang kurang soal, dll.)

### Deliverable 5: Action Plan for V2 Onboarding
- Step-by-step plan (sprint-ready) untuk:
  1. Cleanup technical debt (1 sprint)
  2. Data enrichment & curation (1-2 sprint)
  3. Security hardening (1 sprint)
  4. Performance optimization (1 sprint)
  5. Documentation sync (continuous)

---

## 🛠️ METODELOGI EVALUASI

### Tools & Commands yang Harus Dijalankan:

```bash
# 1. Quality Gates
cd /home/hari/projects/mathbank
pnpm check                    # tsc + lint + test
pnpm test:coverage           # coverage report
pnpm db:verify               # schema integrity

# 2. Data Queries (via psql atau script)
psql -h localhost -p 5433 -U hari -d mathbank
-- Query templates lihat di bawah

# 3. Code Analysis
pnpm lint:names              # CONSTRAINT #28b checker
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20  # large files

# 4. Security Scan
# Manual review of auth, validation, sanitization code

# 5. Performance Profiling
# Check telemetry metrics endpoint
```

### Template Query untuk Data Audit:

```sql
-- Question Distribution by Source
SELECT source_id, COUNT(*), 
       COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_count,
       COUNT(CASE WHEN answer_key IS NOT NULL THEN 1 END) as with_answer
FROM questions 
GROUP BY source_id ORDER BY COUNT(*) DESC;

-- Bundle Health
SELECT COUNT(*) as total_bundles,
       COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active,
       AVG(question_count) as avg_questions_per_bundle
FROM bundles;

-- Orphan Questions (not in any bundle)
SELECT COUNT(*) FROM questions q
WHERE NOT EXISTS (
  SELECT 1 FROM bundle_items bi WHERE bi.question_id = q.id
);

-- Media Orphans
SELECT COUNT(*) FROM media_assets m
WHERE NOT EXISTS (
  SELECT 1 FROM question_media qm WHERE qm.media_asset_id = m.id
);

-- Topic Hierarchy Depth
SELECT MAX(depth) FROM (WITH RECURSIVE topic_tree AS (
  SELECT id, parent_id, 1 as depth FROM topics WHERE parent_id IS NULL
  UNION ALL
  SELECT t.id, t.parent_id, tt.depth + 1 
  FROM topics t JOIN topic_tree tt ON t.parent_id = tt.id
) SELECT depth FROM topic_tree) depths;

-- Empty Topics (no questions)
SELECT COUNT(*) FROM topics t
WHERE NOT EXISTS (
  SELECT 1 FROM question_topics qt WHERE qt.topic_id = t.id
);

-- Questions without Embedding
SELECT COUNT(*) FROM questions WHERE embedding IS NULL;

-- AI Tagging Coverage
SELECT COUNT(*) as total,
       COUNT(CASE WHEN ai_tagged = true THEN 1 END) as ai_tagged,
       COUNT(CASE WHEN reasoning IS NOT NULL AND reasoning != '' THEN 1 END) as with_reasoning
FROM questions;
```

---

## ⏱️ TIME ESTIMATE

- **Pillar 1 (Data Quality)**: 2-3 jam (paling kritis)
- **Pillar 2 (Code Health)**: 2-3 jam
- **Pillar 3 (Architecture)**: 1-2 jam
- **Pillar 4 (Security)**: 1-2 jam
- **Pillar 5 (Performance)**: 1 jam
- **Pillar 6 (Documentation)**: 1 jam
- **Pillar 7 (Operations)**: 1 jam
- **Report Writing**: 2-3 jam

**Total Estimasi: 12-17 jam kerja**

---

## 🎯 SUCCESS CRITERIA

Evaluasi dianggap **BERHASIL** jika menghasilkan:

1. ✅ **Minimal 30 temuan** (mix of low/medium/high/critical severity)
2. ✅ **Prioritized action items** (dengan effort estimate)
3. ✅ **V2 blocking issues** clearly identified (max 5-10 critical)
4. ✅ **Data quality baseline** terukur (angka, bukan opini)
5. ✅ **Actionable recommendations** (bukan generic advice, tapi spesifik ke codebase MathBank)
6. ✅ **Stakeholder-ready report** (bisa langsung dipresentasikan ke decision maker)

---

## 📌 CATATAN PENTING

### Yang HARUS Dihindari:
- ❌ Jangan hanya menjiplak audit lama - lakukan verifikasi ulang
- ❌ Jangan klaim "tanpa masalah" tanpa bukti empiris (query, test, screenshot)
- ❌ Jangan buat rekomendasi generik ("tingkatkan testing") - harus spesifik ("tambahkan test untuk `fusion.ts` line 42-55, edge case: threshold exact > near")
- ❌ Jangan abaikan `scripts/dev/` - itu adalah technical debt nyata
- ❌ Jangan lupa bedakan MathBank vs QBank (AGENTS.md §1)

### Yang HARUS Dilakukan:
- ✅ Selalu sertakan **evidence** (file:path:line, query output, test result)
- ✅ Gunakan **bahasa Indonesia** untuk laporan (konvensi proyek, CONSTRAINT #28)
- ✅ **Cross-reference** dengan dokumen existing (ADR, CONSTRAINTS, audit lama)
- ✅ **Prioritaskan** berdasarkan dampak ke V2 development, bukan sekadar estetika kode
- ✅ **Propose solutions**, bukan hanya identify problems

---

## 🚀 NEXT STEPS (SETELAH EVALUASI SELESAI)

Setelah paperclip menyelesaikan evaluasi:

1. **Review Session**: Diskusi temuan kritis dengan stakeholder
2. **Sprint Planning**: Pilih action items untuk sprint cleanup pertama
3. **V2 Kickoff**: Gunakan baseline data untuk scope V2 features
4. **Baseline Lock**: Simpan hasil audit sebagai snapshot "pre-V2"

---

**Document Version:** 1.0  
**Created:** 2026-10-18  
**Author:** CodeBuddy (cbai/glm-5v-turbo)  
**Target Audience:** Paperclip (Evaluation Agent)  
**Project:** MathBank V2 Preparation  

---

## 💬 INSTRUKSI KE PAPERCLIP:

**Paperclip, silakan mulai evaluasi dengan urutan berikut:**

1. **Mulai dari Pillar 1 (Data Quality)** - ini yang paling kritis untuk V2
2. Jalankan semua query template di atas dan kumpulkan hasilnya
3. Dokumentasikan setiap temuan dengan format severity/evidence/impact/recommendation
4. Setelah Pillar 1 selesai, lanjutkan ke Pillar 2-7 secara berurutan
5. Di akhir, susun executive summary dan V2 readiness checklist
6. Output semua hasil dalam format markdown terstruktur

**Selamat bekerja! 🎯**
