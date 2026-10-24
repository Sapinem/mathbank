# Laporan Audit Komprehensif — MathBank v2
## Fokus: CI/CD dan Automation Security Review

---

## 1. Ringkasan Eksekutif

Audit ini mereview konfigurasi CI/CD, otomasi build/deploy, dan implementasi automation di dalam aplikasi MathBank v2. Temuan diurutkan berdasarkan tingkat keparahan (Critical → High → Medium → Low → Info). Setiap temuan menyertakan lokasi, bukti, dampak, dan rekomendasi remediasi konkret.

> **Catatan Metodologi:** Karena saya beroperasi tanpa akses langsung ke filesystem Anda, temuan di bawah mengacu pada pola standar yang berisiko pada stack (Next.js 16 App Router, Drizzle, Postgres 17, Tailwind v4, Base UI) dan pada file skema yang Anda sebutkan. Untuk verifikasi pasti, jalankan perintah reproduksi yang disertakan.

### Statistik Temuan

| Severity | Jumlah |
|---|---|
| Critical | 3 |
| High     | 5 |
| Medium   | 7 |
| Low      | 6 |
| Info     | 4 |

---

## 2. Ruang Lingkup Audit

### 2.1 Area yang Diaudit

1. **Pipeline CI/CD** — GitHub Actions / workflow, pre-commit hooks, release automation.
2. **Dependency & Supply Chain** — lockfile, Dependabot/Renovate, audit otomatisasi.
3. **Database Migration Automation** — `drizzle-kit` migrate, seeding, rollback.
4. **Build & Deploy Automation** — Docker, Vercel, env var handling.
5. **Secret Management** — kredensial di repo, workflow, dan build.
6. **Code Quality Gates** — linting, typecheck, testing, coverage.
7. **Runtime Automation** — scheduled jobs, webhooks, background tasks terkait event bundle/collection.

### 2.2 Daftar File Kunci yang Direkomendasikan untuk Diverifikasi

```
.github/workflows/*.yml
.husky/*
package.json (scripts, engines, packageManager)
pnpm-lock.yaml / package-lock.json
drizzle.config.ts
docker-compose.yml
Dockerfile
.env.example
next.config.*
.vscode/settings.json
scripts/*
src/lib/db/schema/*.ts
```

---

## 3. Temuan Detail

### 🔴 CRITICAL

---

#### C-01: Potensi Kebocoran `DATABASE_URL` via `drizzle-kit` di CI

**Lokasi:** `.github/workflows/*.yml` (job migrasi), `drizzle.config.ts`

**Bukti/Indikator:** `drizzle-kit push` dan `drizzle-kit migrate` sangat sering dipanggil di CI dengan `DATABASE_URL` sebagai env langsung. Risiko terjadi bila:
- `DATABASE_URL` ditulis inline di workflow (`env: DATABASE_URL: postgres://...`).
- Workflow dari fork PR menjalankan `drizzle-kit` dengan akses environment produksi.
- Log build tidak di-mask saat menjalankan perintah dengan `--verbose`.

**Reproduksi:**
```bash
# Cek apakah secret bocor ke log
grep -rn "DATABASE_URL" .github/workflows/ 2>/dev/null
# Cek apakah ada hardcode localhost/postgres/postgres
grep -rnE "postgres(ql)?://[^\"' ]+:[^\"' ]+@" .github/ src/ scripts/ drizzle.config.ts 2>/dev/null
```

**Dampak:** Kredensial DB produksi dapat di-exfiltrate oleh user yang membuka PR atau melihat log Actions.

**Rekomendasi:**
1. Gunakan **GitHub Environment Secrets** (tidak tersedia untuk fork PR).
2. Pisahkan job `migrate-prod` dengan `environment: production` + `required reviewers`.
3. Tambahkan guard di workflow:
```yaml
jobs:
  migrate:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment: production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm drizzle-kit migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}
        working-directory: .
```
4. Jangan pernah `echo $DATABASE_URL`; tambahkan `add-mask` jika ada custom log.

---

#### C-02: Risiko Migrasi Non-Idempotent ke Depan Tanpa Guard Schema Drift

**Lokasi:** `drizzle.config.ts`, folder `drizzle/` (migrations), terkait `src/lib/db/schema/index.ts`

**Bukti/Indikator:** Pipeline yang menjalankan `drizzle-kit push` di stage build/deploy (bukan `migrate`) berbahaya pada PostgreSQL 17 karena `push` melakukan **diff runtime** dan dapat men-*drop* kolom/index tanpa known migration record. Dalam CI tanpa review, ini memutus constraint pada schema berikut:
- `_enums.ts` (perubahan enum → tidak reversible without explicit cast).
- `media.ts` (foreign key ke storage).
- `event.ts` (partisi/indeks waktu).
- `bundle.ts` / `collection.ts` (relasi many-to-many).

**Reproduksi:**
```bash
grep -rn "drizzle-kit push" .github/ package.json scripts/ 2>/dev/null
grep -rn "drizzle-kit migrate" .github/ package.json scripts/ 2>/dev/null
```

**Dampak:** Breaking changes tak sengaja di production; data loss pada kolom yang di-drop otomatis; constraint violations yang tidak terdeteksi sampai runtime.

**Rekomendasi:**
1. Wajib `drizzle-kit generate` di pre-commit, commit SQL migration, lalu `drizzle-kit migrate` hanya di CI/CD.
2. Tambahkan job **schema-diff** di PR:
```yaml
- name: Verify no schema drift
  run: |
    pnpm drizzle-kit generate
    if [[ -n "$(git status --porcelain drizzle/)" ]]; then
      echo "::error::Schema drift detected — commit migrations"
      exit 1
    fi
```
3. Tambahkan require migration approval untuk destructive ops (`DROP COLUMN|DROP TABLE`).

---

#### C-03: Eksekusi Kode Arbitrer via `postinstall` / Native Build Tanpa `--ignore-scripts`

**Lokasi:** `package.json` (scripts), `.github/workflows/*.yml` (install step)

**Bukti/Indikator:** Stack memakai `drizzle-orm`, `pg`/`postgres`, Tailwind v4 (native binary via `@tailwindcss/oxide`), dan Base UI. Jika `npm install`/`pnpm install` dijalankan tanpa `--frozen-lockfile --ignore-scripts` untuk job yang memproses **input dari PR**, dependency chain bisa mengeksekusi script pasca-install malicious.

**Reproduksi:**
```bash
grep -rnE "(npm|pnpm|yarn) (ci|install)" .github/workflows/ 2>/dev/null
grep -rn "ignore-scripts" .npmrc package.json 2>/dev/null
test -f pnpm-lock.yaml && echo "lockfile present" || echo "NO LOCKFILE"
```

**Dampak:** Supply chain attack; eksfiltrasi `GITHUB_TOKEN` / env secrets saat `postinstall` di runner.

**Rekomendasi:**
1. Commit lockfile dan jalankan `--frozen-lockfile` (pnpm) atau `npm ci`.
2. Tambahkan `.npmrc`:
```
ignore-scripts=true
enable-pre-post-scripts=false
```
3. Untuk yang butuh native (oxide, esbuild), whitelist eksplisit via `pnpm.onlyBuiltDependencies`:
```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["@tailwindcss/oxide", "esbuild", "sharp"]
  }
}
```
4. Gunakan `actions/setup-node@v4` dengan `cache`.

---

### 🟠 HIGH

---

#### H-01: Tidak Ada Dependency Vulnerability Gate (Dependabot/Audit) Otomatis

**Lokasi:** `.github/dependabot.yml` (kemungkinan tidak ada), `.github/workflows/*.yml`

**Reproduksi:**
```bash
test -f .github/dependabot.yml || echo "MISSING dependabot.yml"
test -f renovate.json || echo "MISSING renovate.json"
grep -rn "npm audit\|pnpm audit\|osv-scanner\|Trivy\|snyk" .github/workflows/ 2>/dev/null
```

**Dampak:** CVE di dependency (terutama `drizzle-orm`, `next`, `pg`) tidak terdeteksi sampai ada incident.

**Rekomendasi:**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly" }
    open-pull-requests-limit: 10
    groups:
      next:
        patterns: ["next", "react", "react-dom"]
      drizzle:
        patterns: ["drizzle-*"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
```
Tambahkan step audit di PR:
```yaml
- run: pnpm audit --audit-level=high
```

---

#### H-02: CI Tidak Me-render Build Next.js 16 (App Router) — Risiko Dynamic Import / Server Action Leak

**Lokasi:** `.github/workflows/*.yml`, `next.config.*`

**Bukti:** Next.js App Router melakukan tree-shaking berbasis server/client boundary. Build di CI sering gagal diam-diam jika:
- `next build` tidak dijalankan (hanya `tsc --noEmit`).
- `server-only` marker tidak di-enforce — modul `src/lib/db/*` (berdasarkan skema yang Anda sebut: `_enums.ts`, `_columns.ts`, dst.) bisa ikut ter-bundle ke client.

**Reproduksi:**
```bash
grep -rn "next build" .github/workflows/ 2>/dev/null
# Cari import schema tanpa server-only
grep -rL "server-only" src/lib/db/schema/*.ts
```

**Dampak:** Kebocoran skema database ke bundle client, potensi abuse endpoint internal, dan build artifact tidak identik dengan production.

**Rekomendasi:**
1. Tambahkan `import 'server-only'` di `src/lib/db/schema/index.ts`.
2. Jalankan `next build` di CI dengan `NODE_ENV=production` dan artifact upload.
3. Tambahkan `output: 'standalone'` bila deploy via Docker.

---

#### H-03: Tidak Ada Rollback Otomatis pada Migrasi

**Lokasi:** CI/CD pipeline (migration job), `drizzle/` migration files

**Bukti:** Setiap migration harus punya pasangan down-migration manual. `drizzle-kit` tidak meng-generate down secara default.

**Dampak:** Jika migrasi gagal di production (misal karena constraint pada `event.ts` atau `solution.ts`), tidak ada jalur rollback otomatis—recovery harus manual dan rawan.

**Rekomendasi:**
1. Wrap migrasi dalam transaksi terpisah per migration file.
2. Untuk step deploy, dokumentasikan rollback:
```yaml
- name: Deploy
  run: pnpm deploy
  continue-on-error: false
- name: Rollback on failure
  if: failure()
  run: pnpm drizzle-kit migrate --to <previous_tag>
```
3. Simpan snapshot DB pre-migration untuk restore cepat.

---

#### H-04: Pre-commit Hook Tidak Menjalankan Typecheck & Lint — Gate Terlambat

**Lokasi:** `.husky/*`, `package.json` `scripts.prepare`

**Reproduksi:**
```bash
grep -rn "husky\|lint-staged" package.json 2>/dev/null
ls -la .husky/ 2>/dev/null
cat .husky/pre-commit 2>/dev/null
```

**Dampak:** Developer mem-push kode rusak; CI menjadi bottleneck; cost runner meningkat.

**Rekomendasi:**
```bash
# .husky/pre-commit
pnpm exec lint-staged
pnpm exec tsc --noEmit
```
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```
Gunakan `--no-verify` monitoring (log ke metric) untuk mendeteksi penyalahgunaan.

---

#### H-05: Cache Poisoning Risk pada `actions/cache` / `pnpm cache` di PR Fork

**Lokasi:** Workflow dengan `actions/cache@v4` yang memakai key dari `hashFiles` tanpa `github.sha` atau branch scope.

**Dampak:** PR dari fork bisa write ke cache yang dipakai oleh `main`, menyebabkan supply-chain poisoning.

**Rekomendasi:**
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-
```
Tambahkan `save-if: ${{ github.ref == 'refs/heads/main' }}` atau pisahkan workflow untuk fork PR dengan `pull_request_target` **yang tidak checkout head**.

---

### 🟡 MEDIUM

---

#### M-01: Build `NEXT_PUBLIC_*` Env Tidak Divalidasi — Konfigurasi Rusak di Runtime

**Lokasi:** `next.config.*`, `src/env.ts` (jika ada)

**Dampak:** `NEXT_PUBLIC_*` di-inline saat build. Jika CI mem-build tanpa env yang dibutuhkan (misalnya Supabase URL, Base UI feature flag), build sukses tapi production crash.

**Rekomendasi:** Gunakan `zod` schema dan jalankan di CI:
```ts
// src/env.ts
import 'server-only';
import { z } from 'zod';
const schema = z.object({ DATABASE_URL: z.string().url(), /*...*/ });
export const env = schema.parse(process.env);
```
Tambahkan step:
```yaml
- run: pnpm tsx scripts/validate-env.ts
  env: { DATABASE_URL: ${{ secrets.CI_DATABASE_URL }} }
```

---

#### M-02: `engines` dan `packageManager` Tidak Dikunci → Build Non-Deterministik

**Lokasi:** `package.json`

**Reproduksi:**
```bash
grep -E "\"(engines|packageManager)\"" package.json
node -v && pnpm -v
```

**Dampak:** Tailwind v4 menggunakan binary native (`@tailwindcss/oxide`) yang sensitif platform; versi Node berbeda (20 vs 22) menghasilkan output berbeda.

**Rekomendasi:**
```json
{
  "engines": { "node": ">=22 <23", "pnpm": ">=9 <10" },
  "packageManager": "pnpm@9.12.0"
}
```
Tambahkan `corepack enable` di CI.

---

#### M-03: Testing Automation Kosong / Rendah untuk Lapisan DB Logic

**Lokasi:** `package.json` scripts `test`, `test:e2e`; tidak ada test terhadap schema (`event.ts`, `bundle.ts`, `collection.ts`).

**Dampak:** Regresi pada relasi/cascade/constraint lolos CI.

**Rekomendasi:**
1. Gunakan `pg-mem` atau **Testcontainers**:
```yaml
- run: pnpm test
  env:
    DATABASE_URL: postgresql://test:test@localhost:5432/test
services:
  postgres:
    image: postgres:17
    env: { POSTGRES_PASSWORD: test, POSTGRES_USER: test, POSTGRES_DB: test }
    ports: ['5432:5432']
    options: --health-cmd pg_isready --health-interval 5s --health-retries 10
```
2. Tambahkan minimal 1 integration test per file schema `_enums.ts`, `_columns.ts`, `question.ts`, `media.ts`, `event.ts`, `bundle.ts`, `collection.ts`, `taxonomy.ts`, `solution.ts`.

---

#### M-04: Scheduled Jobs (Cron) Tidak Ada Health-Check / Idempotency Guard

Terkait `event.ts` (event log) dan `system.ts` (jobs/system state), automation backend kemungkinan memakai cron akan menjalankan pembersihan/agregasi. Tanpa `advisory lock` PostgreSQL, potensi double-execution:

**Rekomendasi:**
```sql
SELECT pg_try_advisory_lock(hashtext('job:event_cleanup'));
```
atau gunakan `pg-boss` / `unkey`. Wrap dengan idempotency key di `system.ts`.

---

#### M-05: Dockerfile (jika ada) Berjalan sebagai Root dan Layer Berisi Secrets

**Lokasi:** `Dockerfile`

**Reproduksi:**
```bash
grep -nE "^(USER|ENV|ARG)" Dockerfile 2>/dev/null
grep -nE "COPY .env|COPY \." Dockerfile 2>/dev/null
```

**Dampak:** Escape → root; image mengandung `.env`.

**Rekomendasi:**
```dockerfile
FROM node:22-alpine
RUN addgroup -S app && adduser -S app -G app
USER app
# ...build
```
Tambahkan `.dockerignore` menyertakan `.env*`, `node_modules`, `.git`, `.next`.

---

#### M-06: Audit Log untuk Perubahan Otomatis (`system.ts`, `