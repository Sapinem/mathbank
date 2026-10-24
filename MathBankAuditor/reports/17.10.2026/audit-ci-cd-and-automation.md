# Laporan Audit CI/CD & Automasi: MathBank v2.0
**Target File:** [`MathBankAuditor/reports/17.10.2026/audit-ci-cd-and-automation.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-ci-cd-and-automation.md)  
**Tanggal Pelaksanaan:** 17 Oktober 2026  
**Auditor Persona:** Senior DevOps & Quality Assurance Engineer (`ci-cd-and-automation`)  
**Scope Audit:** Pipeline Gates (`pnpm check`), GitHub Actions Workflows ([`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml)), PostgreSQL Service Containerization & Invariant Migrations, Pre-commit Hooks & Secret Scanning, Deployment Automation ([`scripts/deploy.sh`](file:///home/hari/projects/mathbank/scripts/deploy.sh)), Dockerfile Multi-stage & Compose Architecture, Monitoring / Smoke Testing ([`scripts/smoke-prod.ts`](file:///home/hari/projects/mathbank/scripts/smoke-prod.ts)), serta Dependabot & Advisory Monitoring.

---

## 1. Ringkasan Eksekutif & Verdict

**Verdict:** 🛑 **REQUEST CHANGES**

MathBank v2.0 memiliki fondasi automasi mutu lokal yang sangat solid: exit gate `pnpm check` menggabungkan verifikasi kontras WCAG 2.2 AA (`theme:check`), penjaga penamaan berkas/rute bahasa Inggris (`lint:names`), zero type errors (`tsc`), ESLint 10 dengan compatibility shim, ambang cakupan logika murni $\ge 90\%$, dan verifikasi invarian skema database zero-drift (`db:verify`). Skrip penerapan zero-downtime atomic deployment ([`scripts/deploy.sh`](file:///home/hari/projects/mathbank/scripts/deploy.sh)) juga berhasil mengeliminasi jendela galat 500 saat `next build`.

Namun, audit menemukan **2 masalah kritis (CRITICAL)** yang saat ini **mematahkan eksekusi CI pipeline di GitHub Actions** dan **menggagalkan penerapan produksi via Docker**:
1. Pipeline GitHub Actions [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml) mendefinisikan database yang salah (`mathbank` vs `mathbank_test`), sehingga migrasi gagal `database "mathbank" does not exist`, dan tes integrasi database dijalankan pada skema kosong.
2. Image Docker standalone produksi ([`Dockerfile`](file:///home/hari/projects/mathbank/Dockerfile)) dan [`docker-compose.yml`](file:///home/hari/projects/mathbank/docker-compose.yml) sama sekali tidak memiliki langkah eksekusi migrasi skema dan penerapan invarian PostgreSQL (`db:safety`), sehingga aplikasi Docker langsung crash saat pertama kali dijalankan.

### Matriks Keparahan Temuan

| Tingkat Keparahan | Jumlah | Status & Tindakan |
|---|:---:|---|
| **Critical** | **2** | Memblokir CI/CD Pipeline & Deployment Container (Wajib segera diperbaiki) |
| **Required** | **5** | Wajib diselesaikan sebelum rilis produksi MathBank v2.0 |
| **Optional / Medium** | **3** | Optimalisasi ketahanan operasional & observabilitas |
| **Nit** | **1** | Konsistensi versi runtime & dokumentasi |

---

## 2. Pipa Gerbang Mutu (Quality Gate Pipeline)

Evaluasi kepatuhan alur kerja otomatis terhadap standar *Quality Gate Pipeline* (`ci-cd-and-automation`):

```
Pull Request / Push ke main
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       STATUS KEPATUHAN GERBANG MUTU                     │
├──────────────────────┬─────────────────────────────┬────────────────────┤
│ Gerbang Automasi     │ Mekanisme / Skrip           │ Status Kepatuhan   │
├──────────────────────┼─────────────────────────────┼────────────────────┤
│ 1. Git Hook Secrets  │ scripts/secret-scan.mjs     │ ⚠️ Hanya lokal     │
│ 2. Name Compliance   │ scripts/check-names.mjs     │ ✅ Patuh (#28b)    │
│ 3. WCAG Theme Check  │ scripts/theme/check.ts      │ ✅ 34/34 AA Lulus  │
│ 4. Type Checking     │ tsc --noEmit                │ ✅ 0 Error (#1)    │
│ 5. Linting           │ eslint (ESLint 10 Shim)     │ ✅ 0 Error (#2)    │
│ 6. Pure Unit Test    │ vitest (Coverage ≥90%)      │ ✅ Patuh (#3)      │
│ 7. Build             │ next build                  │ ✅ Sukses (#4)     │
│ 8. DB Schema Safety  │ db:ensure-ext + db:safety   │ ❌ Rusak di CI     │
│ 9. Schema Invariants │ scripts/db-verify.ts        │ ❌ Rusak di CI     │
│ 10. DB Integration   │ scripts/test-db.ts (21 tes) │ ❌ Terlewati di CI │
│ 11. Security Audit   │ pnpm audit / advisory scan  │ ❌ Absen di CI     │
│ 12. End-to-End Test  │ Playwright (e2e-manual)     │ ❌ Absen di CI     │
│ 13. Zero-Downtime CD │ scripts/deploy.sh           │ ⚠️ Manual SSH      │
└──────────────────────┴─────────────────────────────┴────────────────────┘
```

---

## 3. Rincian Temuan Audit

---

### 🔴 [CRITICAL] CI-01: Inkonsistensi Nama Basis Data pada Container PostgreSQL Mematahkan Pipeline CI

- **Area:** CI Workflow Execution & Database Reproducibility
- **Lokasi:** [`.github/workflows/ci.yml:25-48, 66-86`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml#L25-L48) dan [`scripts/test-db.ts:30-36`](file:///home/hari/projects/mathbank/scripts/test-db.ts#L30-L36)
- **Pelanggaran Batasan:** [`CONSTRAINTS.md #24`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L50) (DB harus bisa direproduksi dari file kosong), [`CONSTRAINTS.md #25`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L51) (`pnpm db:verify` wajib hijau), dan [`AGENTS.md §3`](file:///home/hari/projects/mathbank/AGENTS.md#L71) (Prosedur migrasi DB utama & DB uji).
- **Deskripsi Masalah:**
  Pada [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml), service container PostgreSQL diinisialisasi dengan:
  ```yaml
  services:
    postgres:
      image: pgvector/pgvector:pg18
      env:
        POSTGRES_USER: mathbank
        POSTGRES_PASSWORD: mathbank_ci
        POSTGRES_DB: mathbank_test
  ```
  Image resmi PostgreSQL **hanya membuat satu basis data awal** sesuai `POSTGRES_DB`, yaitu `mathbank_test`. Basis data `mathbank` **tidak pernah dibuat**.
  
  Selanjutnya, variabel lingkungan didefinisikan:
  ```yaml
  env:
    DATABASE_URL: postgresql://mathbank:mathbank_ci@localhost:5432/mathbank
    TEST_DATABASE_URL: postgresql://mathbank:mathbank_ci@localhost:5432/mathbank_test
  ```
  Pada langkah 66-75:
  ```yaml
  - name: Ekstensi DB (pgvector, pg_trgm, pgcrypto)
    run: |
      PGPASSWORD=mathbank_ci psql -h localhost -U mathbank -d mathbank_test \
        -c "CREATE EXTENSION IF NOT EXISTS vector;" ...

  - name: Migrasi skema (DB uji)
    run: pnpm db:migrate
  ```
  Skrip `pnpm db:migrate` ([`package.json:19`](file:///home/hari/projects/mathbank/package.json#L19)) memanggil `scripts/db-ensure-extensions.ts`, `drizzle-kit migrate`, dan `scripts/db-apply-safety.ts`. Ketiganya membaca `process.env.DATABASE_URL` yang menunjuk ke `.../mathbank`.
- **Dampak (Direct Impact):**
  1. Eksekusi `pnpm db:migrate` seketika gagal dengan galat PostgreSQL: `FATAL: database "mathbank" does not exist`. Pipeline CI mati total pada tahap awal.
  2. Bahkan jika basis data `mathbank` dibuat manual, perintah `pnpm db:migrate` hanya memigrasi `DATABASE_URL` (`mathbank`), sedangkan `TEST_DATABASE_URL` (`mathbank_test`) **tetap kosong melompong** (0 tabel).
  3. Ketika langkah `Tes integrasi DB` ([`ci.yml:85`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml#L85)) mengeksekusi `pnpm test:db`, [`scripts/test-db.ts`](file:///home/hari/projects/mathbank/scripts/test-db.ts) mengarahkan Vitest ke `TEST_DATABASE_URL` (`mathbank_test`). Karena DB uji belum dimigrasi, seluruh 21 pengujian integrasi database gagal.
- **Rekomendasi Perbaikan:**
  Perbaiki [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml) agar:
  1. Membuat basis data `mathbank` secara eksplisit melalui `psql`.
  2. Memasang ekstensi pada kedua basis data (`mathbank` dan `mathbank_test`).
  3. Menjalankan migrasi Drizzle dan `db:safety` pada KEDUA basis data sesuai amanat [`AGENTS.md §3`](file:///home/hari/projects/mathbank/AGENTS.md#L71).
  4. Menjalankan `db:verify` pada kedua basis data.

  ```yaml
  # Perbaikan pada .github/workflows/ci.yml
  - name: Inisialisasi DB & Ekstensi (mathbank & mathbank_test)
    run: |
      PGPASSWORD=mathbank_ci psql -h localhost -U mathbank -d postgres \
        -c "CREATE DATABASE mathbank OWNER mathbank;"
      for db in mathbank mathbank_test; do
        PGPASSWORD=mathbank_ci psql -h localhost -U mathbank -d "$db" \
          -c "CREATE EXTENSION IF NOT EXISTS vector;" \
          -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" \
          -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
      done

  - name: Migrasi Skema (DB Utama & DB Uji)
    run: |
      pnpm db:migrate
      DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate

  - name: Verifikasi Skema Zero-Drift (Keduanya)
    run: |
      pnpm db:verify
      DATABASE_URL="$TEST_DATABASE_URL" pnpm db:verify
      pnpm exec drizzle-kit check
  ```

---

### 🔴 [CRITICAL] CI-02: Image Produksi Standalone Docker Kehilangan Mekanisme Migrasi Skema & Ekstensi

- **Area:** Containerization & Production Deployment Automation
- **Lokasi:** [`Dockerfile:49-64`](file:///home/hari/projects/mathbank/Dockerfile#L49-L64), [`docker-compose.yml:27-52`](file:///home/hari/projects/mathbank/docker-compose.yml#L27-L52), dan [`docs/RUNBOOK.md:172-184`](file:///home/hari/projects/mathbank/docs/RUNBOOK.md#L172-L184)
- **Pelanggaran Batasan:** [`CONSTRAINTS.md #24`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L50) (DB reproduktibilitas).
- **Deskripsi Masalah:**
  Pada [`Dockerfile`](file:///home/hari/projects/mathbank/Dockerfile), tahap `runner` menggunakan output Next.js standalone:
  ```dockerfile
  COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
  COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
  COPY --from=builder --chown=nextjs:nodejs /app/public ./public
  CMD ["node", "server.js"]
  ```
  Folder `drizzle/`, skrip migrasi `scripts/db-*.ts`, paket `drizzle-kit`, dan `tsx` **tidak dimasukkan ke image akhir** (karena merupakan devDependencies dan dipangkas oleh standalone bundler).
  
  Pada [`docker-compose.yml`](file:///home/hari/projects/mathbank/docker-compose.yml), layanan `app` langsung dijalankan setelah container `db` berstatus sehat:
  ```yaml
  app:
    depends_on:
      db:
        condition: service_healthy
  ```
  Berdasarkan panduan operasional di [`docs/RUNBOOK.md §10`](file:///home/hari/projects/mathbank/docs/RUNBOOK.md#L172):
  `cp .env.docker.example .env.docker && docker compose up -d --build`
  Ketika perintah ini dijalankan pada server baru, basis data PostgreSQL di volume `db_data` dalam keadaan bersih/kosong. Tidak ada perintah migrasi yang dieksekusi. Aplikasi `app` langsung menyala dan mengalami crash fatal karena tabel `questions`, `user`, dan ekstensi `vector` belum ada.
- **Dampak (Direct Impact):**
  Penyebaran (*deployment*) berbasis Docker gagal total saat cold-start. Operator tidak dapat menjalankan migrasi dari dalam container `app` karena ketiadaan file SQL manual dan compiler TypeScript.
- **Rekomendasi Perbaikan:**
  Sediakan *init migration container* atau skrip entrypoint pada `docker-compose.yml` yang menjalankan migrasi sebelum `server.js` menerima koneksi:
  ```yaml
  # Tambahkan migration service pada docker-compose.yml
  db-migrate:
    build:
      context: .
      target: builder
    command: sh -c "pnpm db:migrate"
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-mathbank}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-mathbank}
    restart: "no"

  app:
    depends_on:
      db-migrate:
        condition: service_completed_successfully
  ```

---

### 🟠 [REQUIRED] CI-03: Kredensial & Kunci Enkripsi Ter-Hardcode pada Berkas Workflow GitHub Actions

- **Area:** CI Secrets & Credential Management
- **Lokasi:** [`.github/workflows/ci.yml:44-45`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml#L44-L45)
- **Pelanggaran Batasan:** [`CONSTRAINTS.md #21`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L44) ("Rahasia tidak di kode — lewat ENV / app_settings terenkripsi") dan panduan skill `ci-cd-and-automation` ("Even for CI-only test databases, use GitHub Secrets... Secrets stored in code or CI config files is a Red Flag").
- **Deskripsi Masalah:**
  Pada [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml#L44-L45), konfigurasi rahasia dideklarasikan secara eksplisit dalam teks polos:
  ```yaml
  BETTER_AUTH_SECRET: ci-secret-00000000000000000000000000000000
  SETTINGS_ENC_KEY: "0000000000000000000000000000000000000000000000000000000000000000"
  ```
  `SETTINGS_ENC_KEY` adalah kunci simetris 256-bit (64 karakter hex) yang digunakan modul [`src/lib/crypto/secrets.ts`](file:///home/hari/projects/mathbank/src/lib/crypto/secrets.ts) untuk mengenkripsi token API AI pihak ketiga. Menulis kunci literal berulang kali di repositori publik/timur membiasakan pengembang menyalin kunci tiruan ini ke berkas `.env` staging atau produksi.
- **Dampak (Potential Impact):**
  Kebocoran konfigurasi standar enkripsi, potensi penggunaan kunci lemah `0000...` di lingkungan pra-produksi, dan pelanggaran standar keamanan Git.
- **Rekomendasi Perbaikan:**
  Gunakan GitHub Secrets atau bangkitkan kunci acak ephemeral saat job CI dijalankan:
  ```yaml
  env:
    BETTER_AUTH_SECRET: ${{ secrets.CI_BETTER_AUTH_SECRET || 'ephemeral-ci-auth-secret-random-32ch' }}
    SETTINGS_ENC_KEY: ${{ secrets.CI_SETTINGS_ENC_KEY }}
  steps:
    - name: Generate Ephemeral CI Encryption Key if not set
      if: env.SETTINGS_ENC_KEY == ''
      run: echo "SETTINGS_ENC_KEY=$(openssl rand -hex 32)" >> $GITHUB_ENV
  ```

---

### 🟠 [REQUIRED] CI-04: Ketiadaan Pemindaian Rahasia (Secret Scan) dan Audit Kerentanan Dependensi di CI

- **Area:** Shift-Left Security Quality Gates
- **Lokasi:** [`.github/workflows/ci.yml:76-78`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml#L76-L78) dan [`package.json:33-36`](file:///home/hari/projects/mathbank/package.json#L33-L36)
- **Pelanggaran Batasan:** Prinsip *Shift-Left* pada skill `ci-cd-and-automation` ("Catch problems as early in the pipeline as possible").
- **Deskripsi Masalah:**
  MathBank telah memiliki skrip pemindai rahasia zero-dependency tingkat lanjut ([`scripts/secret-scan.mjs`](file:///home/hari/projects/mathbank/scripts/secret-scan.mjs)) dan pemantau advisory keamanan ([`scripts/security-advisories.ts`](file:///home/hari/projects/mathbank/scripts/security-advisories.ts)). Namun:
  1. Skrip pemindai rahasia saat ini hanya dipasang sebagai *pre-commit hook* lokal melalui [`scripts/install-hooks.mjs`](file:///home/hari/projects/mathbank/scripts/install-hooks.mjs). Pengembang dapat melewatinya dengan `git commit --no-verify`, melakukan commit dari antarmuka Web GitHub, atau jika hook gagal terpasang di GUI Git client.
  2. Perintah gerbang `pnpm check` ([`package.json:33`](file:///home/hari/projects/mathbank/package.json#L33)) dan alur [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml) **tidak pernah memanggil** `pnpm security:secrets` maupun `pnpm audit` / `pnpm security:advisories`.
- **Dampak (Potential Impact):**
  Kredensial atau token API nyata yang ter-commit secara tidak sengaja dapat lolos ke branch `main` tanpa tertahan oleh pipeline CI.
- **Rekomendasi Perbaikan:**
  Tambahkan langkah audit keamanan ke dalam [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml):
  ```yaml
  - name: Pemindaian Rahasia (Secret Scan)
    run: pnpm security:secrets

  - name: Audit Kerentanan Dependensi
    run: pnpm security:advisories --strict
  ```

---

### 🟠 [REQUIRED] CI-05: Struktur Job Monolitik Menggagalkan Paralelisasi dan Perlambatan Siklus Umpan Balik (Feedback Loop)

- **Area:** CI Performance & Pipeline Optimization
- **Lokasi:** [`.github/workflows/ci.yml:21-86`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml#L21-L86)
- **Pelanggaran Batasan:** Panduan skill `ci-cd-and-automation` §CI Optimization ("Run jobs in parallel: Split lint, typecheck, test, build into separate parallel jobs").
- **Deskripsi Masalah:**
  Seluruh alur pengujian diletakkan dalam satu job tunggal bernama `quality`:
  `setup pnpm` $\rightarrow$ `setup node` $\rightarrow$ `pnpm install` $\rightarrow$ `psql extension` $\rightarrow$ `db:migrate` $\rightarrow$ `pnpm check` (`theme:check` $\rightarrow$ `lint:names` $\rightarrow$ `typecheck` $\rightarrow$ `lint` $\rightarrow$ `test:coverage` $\rightarrow$ `build`) $\rightarrow$ `db:verify` $\rightarrow$ `test:db`.
  
  Jika terjadi galat penamaan rute sederhana (pelanggaran CONSTRAINT #28b) atau salah ketik TypeScript, pengembang harus menunggu container PostgreSQL diunduh, ekstensi dibuat, dan migrasi dijalankan sebelum mengetahui letak kesalahan. Sebaliknya, pemeriksaan statis yang tidak membutuhkan PostgreSQL terpaksa tertunda.
- **Dampak (Potential Impact):**
  Waktu tunggu PR menjadi lambat (3–5 menit), konsumsi runner GitHub Actions terbuang sia-sia untuk build yang gagal di tahap linting awal.
- **Rekomendasi Perbaikan:**
  Pecah pipeline menjadi 3 job paralel:
  1. `static-analysis`: Menjalankan `lint:names`, `theme:check`, `typecheck`, `lint`, dan `security:secrets` (tanpa service container DB, durasi <60 detik).
  2. `unit-tests`: Menjalankan Vitest unit logic murni + ambang coverage (tanpa service DB).
  3. `db-integration-and-build`: Membuka container PostgreSQL, menjalankan migrasi, `db:verify`, `test:db`, dan `pnpm build`.

---

### 🟠 [REQUIRED] CI-06: Ketiadaan Pengujian End-to-End (E2E) dan Smoke Automated pada Pipeline CI

- **Area:** Automated Verification & E2E Testing
- **Lokasi:** [`playwright.config.ts:11-20`](file:///home/hari/projects/mathbank/playwright.config.ts#L11-L20) dan [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml)
- **Pelanggaran Batasan:** [`CONSTRAINTS.md #10`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L27) (UI wajib benar di desktop, tablet, dan mobile) dan [`CONSTRAINTS.md #37`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L67) (Tes wajib menyentuh jalur nyata).
- **Deskripsi Masalah:**
  Paket `@playwright/test: ^1.63.0` telah terpasang dan dikonfigurasi untuk desktop (1280×800) dan mobile (Pixel 5). Namun, pengujian E2E dipindahkan ke `e2e-manual/` dan secara eksplisit dikeluarkan dari gate otomatis dengan catatan: *"TIDAK masuk gerbang pnpm check (rapuh di dev)"*.
  
  Akibatnya, di CI tidak ada satu pun pengujian peramban yang dijalankan. Regresi antarmuka kritis—seperti kerusakan rendering tabel markdown KaTeX, terputusnya navigasi mobile, atau kegagalan proteksi dialog modal—dapat lolos ke rilis utama tanpa terdeteksi secara otomatis.
- **Dampak (Potential Impact):**
  Kualitas responsif mobile dan alur kerja navigasi visual pengguna tidak terlindungi oleh jaring pengaman automasi CI.
- **Rekomendasi Perbaikan:**
  1. Buat subset pengujian *E2E smoke* berbobot ringan di folder `e2e/smoke/` yang hanya menguji *critical user journeys* (akses halaman publik, autentikasi demo, rendering matematika dasar, responsivitas navigasi).
  2. Tambahkan job `e2e` pada [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml) yang dijalankan khusus pada event push/PR ke `main`.

---

### 🟠 [REQUIRED] CI-07: Tidak Adanya Automasi Pembaruan Dependensi (Dependabot / Renovate)

- **Area:** Automation Beyond CI / Supply Chain Hygiene
- **Lokasi:** Direktori `.github/` (ketiadaan `.github/dependabot.yml`) dan [`package.json:45-97`](file:///home/hari/projects/mathbank/package.json#L45-L97)
- **Pelanggaran Batasan:** Panduan skill `ci-cd-and-automation` §Automation Beyond CI ("Dependabot / Renovate").
- **Deskripsi Masalah:**
  Repositori tidak memiliki konfigurasi `.github/dependabot.yml`. Seluruh pembaruan pustaka (seperti pembaruan kritis `better-auth`, `drizzle-orm`, `next`, `react`, dan `zod`) saat ini dilakukan secara manual. Berdasarkan riwayat Git (`git log`), pembaruan dependensi dilakukan secara *bulk* dalam satu commit besar (misal: MAT-48 "bump typescript, katex, eslint"), yang meningkatkan risiko regresi tersembunyi.
- **Dampak (Potential Impact):**
  Pembaruan patch keamanan upstream berisiko terlewat, dan keterlambatan deteksi CVE pada dependensi pihak ketiga.
- **Rekomendasi Perbaikan:**
  Tambahkan berkas konfigurasi [`.github/dependabot.yml`](file:///home/hari/projects/mathbank/.github/dependabot.yml):
  ```yaml
  version: 2
  updates:
    - package-ecosystem: "npm"
      directory: "/"
      schedule:
        interval: "weekly"
      open-pull-requests-limit: 5
      ignore:
        # Menjaga dependensi yang diatur khusus oleh Next 16 / React 19
        - dependency-name: "react"
          versions: [">=20.0.0"]
  ```

---

### 🟡 [OPTIONAL] CI-08: Probe Kesiapan pada Skrip Penerapan Produksi (`scripts/deploy.sh`) Mengabaikan Kesiapan Basis Data

- **Area:** Deployment Automation & Health Verification
- **Lokasi:** [`scripts/deploy.sh:46-57`](file:///home/hari/projects/mathbank/scripts/deploy.sh#L46-L57) dan [`src/app/api/ready/route.ts:16-52`](file:///home/hari/projects/mathbank/src/app/api/ready/route.ts#L16-L52)
- **Deskripsi Masalah:**
  Pada [`scripts/deploy.sh`](file:///home/hari/projects/mathbank/scripts/deploy.sh), alur verifikasi kesehatan rilis baru berbunyi:
  ```bash
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1234/ || echo "000")
    if [ "$code" = "307" ] || [ "$code" = "200" ]; then
      echo "==> Layak jalan (HTTP $code) setelah ${i} detik"
      rm -rf "$OLD"
      echo "==> DEPLOY BERHASIL"
      exit 0
    fi
    sleep 1
  done
  ```
  Permintaan ke `http://localhost:1234/` ditangani oleh middleware/guard aplikasi yang langsung merespons dengan **HTTP 307 Temporary Redirect** ke `/login` tanpa melakukan kueri ke basis data PostgreSQL.
  
  Jika database PostgreSQL sedang down, port koneksi tertutup, atau migrasi tabel gagal, `GET /` **tetap menghasilkan kode HTTP 307**. Akibatnya, `deploy.sh` mengira rilis baru berjalan sukses, menghapus backup rilis lama (`rm -rf "$OLD"`), padahal aplikasi sebenarnya dalam keadaan rusak (500/503 saat login atau membaca data).
- **Rekomendasi Perbaikan:**
  Ubah target probe kesiapan pada `deploy.sh` ke endpoint eksplisit [`/api/ready`](file:///home/hari/projects/mathbank/src/app/api/ready/route.ts) yang memeriksa kesehatan koneksi DB dan integritas 24 trigger/2 check constraints:
  ```bash
  # Perbaikan pada scripts/deploy.sh
  ready_status=$(curl -s http://localhost:1234/api/ready | jq -r '.data.status' 2>/dev/null || echo "down")
  if [ "$ready_status" = "ready" ]; then
    echo "==> Layak jalan (API Ready: OK) setelah ${i} detik"
    rm -rf "$OLD"
    echo "==> DEPLOY BERHASIL"
    exit 0
  fi
  ```

---

### 🟡 [OPTIONAL] CI-09: Skrip Pengujian Asap Produksi (`scripts/smoke-prod.ts`) Tidak Menguji Endpoint `/api/ready`

- **Area:** Observability & Post-Deployment Smoke Verification
- **Lokasi:** [`scripts/smoke-prod.ts:53-73`](file:///home/hari/projects/mathbank/scripts/smoke-prod.ts#L53-L73)
- **Deskripsi Masalah:**
  [`scripts/smoke-prod.ts`](file:///home/hari/projects/mathbank/scripts/smoke-prod.ts) dirancang untuk memverifikasi domain produksi hidup pasca-deploy tanpa menyentuh data mutasi. Skrip ini menguji `/login`, `/`, `/questions`, `/api/dev/demo-status`, pagar `/api/dev/quick-login`, dan header CSP.
  
  Namun, skrip ini **tidak memvalidasi** respons dari [`/api/health`](file:///home/hari/projects/mathbank/src/app/api/health/route.ts) maupun [`/api/ready`](file:///home/hari/projects/mathbank/src/app/api/ready/route.ts). Mengingat kedua endpoint ini bersifat publik dan khusus disediakan untuk pemantauan ketersediaan, ketidakhadiran pengujian ini melewatkan verifikasi otomatis status invarian database di produksi.
- **Rekomendasi Perbaikan:**
  Lengkapi `scripts/smoke-prod.ts` dengan pemeriksaan endpoint `/api/ready`:
  ```typescript
  // Tambahan pada scripts/smoke-prod.ts
  try {
    const res = await fetch(`${BASE}/api/ready`);
    const json = await res.json();
    catat(
      "GET /api/ready → status 'ready'",
      res.status === 200 && json.data?.status === "ready",
      `status=${res.status} db=${json.data?.db} invariants=${json.data?.invariants?.ok}`,
    );
  } catch (e) {
    catat("GET /api/ready", false, `error: ${(e as Error).message}`);
  }
  ```

---

### 🟡 [OPTIONAL] CI-10: Ketiadaan Trap Handler Pembersihan Direktori `.next.new` pada Kegagalan Build di `deploy.sh`

- **Area:** Build Resilience & Workspace Hygiene
- **Lokasi:** [`scripts/deploy.sh:22-30`](file:///home/hari/projects/mathbank/scripts/deploy.sh#L22-L30)
- **Deskripsi Masalah:**
  Jika proses `NEXT_DIST_DIR=.next.new pnpm build` dihentikan paksa oleh pengguna via `SIGINT` (Ctrl+C) atau terbunuh oleh sistem (OOM Killer), direktori parsial `.next.new` akan tertinggal di root proyek. Karena ESLint dan Next.js file-watcher membaca pola `.next*`, sampah direktori ini dapat memicu peringatan build atau kebocoran disk jika siklus deploy sering terinterupsi.
- **Rekomendasi Perbaikan:**
  Pasang `trap` cleanup di awal skrip shell:
  ```bash
  trap 'rm -rf "$NEW"' ERR INT TERM
  ```

---

### ⚪ [NIT] CI-11: Desinkronisasi Deklarasi Versi Mesin Node.js

- **Area:** Runtime Version Consistency
- **Lokasi:** [`package.json:100`](file:///home/hari/projects/mathbank/package.json#L100) vs [`Dockerfile:11`](file:///home/hari/projects/mathbank/Dockerfile#L11) vs [`.github/workflows/ci.yml:60`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml#L60)
- **Deskripsi Masalah:**
  [`package.json`](file:///home/hari/projects/mathbank/package.json) mendefinisikan `"node": ">=20"`, sedangkan lingkungan containerisasi ([`Dockerfile`](file:///home/hari/projects/mathbank/Dockerfile)) dan CI ([`ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml)) secara spesifik mengunci Node versi 24 (`node:24-slim` dan `node-version: 24`). Beberapa skrip utilitas modern di `scripts/dev/` menggunakan fitur-fitur Node 22/24.
- **Rekomendasi Perbaikan:**
  Selaraskan `package.json` menjadi `"node": ">=22"` atau `"node": ">=24"` untuk menjamin keselarasan runtime lokal dan produksi.

---

## 4. Observasi Praktik Baik (*What's Done Well*)

Audit mencatat 6 keunggulan arsitektural automasi yang telah diimplementasikan dengan sangat baik pada MathBank v2.0:

1. **Atomic Zero-Downtime Deployment (`scripts/deploy.sh`):**  
   Penggunaan variabel lingkungan `NEXT_DIST_DIR=.next.new` untuk membangun artefak produksi di luar direktori aktif `.next`, diikuti pertukaran atomik direktori (`mv .next .next.old && mv .next.new .next`), secara tuntas melenyapkan masalah klasik Next.js 500 error (`Cannot find module .next/server/middleware-manifest.json`) saat proses build berjalan.
2. **Skrip Pemindai Rahasia Mandiri Tanpa Dependensi (`scripts/secret-scan.mjs`):**  
   Implementasi pemindai regex berbasis Node.js standar mampu mendeteksi kunci privat PEM, token GitHub/Slack/AWS, JWT, format URI database berkredensial, dan payload terenkripsi AES-GCM tanpa memerlukan binary eksternal seperti Gitleaks atau TruffleHog.
3. **Pemasangan Git Hooks Otomatis Idempoten (`scripts/install-hooks.mjs`):**  
   Melalui siklus `pnpm prepare`, skrip pre-commit hook otomatis terpasang pada direktori `.git/hooks/` setiap kali `pnpm install` dijalankan oleh pengembang, tanpa menimpa konfigurasi hook asing yang sudah ada sebelumnya.
4. **Validasi Invarian Skema Zero-Drift Terpadu (`scripts/db-verify.ts`):**  
   Pemeriksaan ketat terhadap 26 tabel, 2 check constraints, 1 indeks HNSW pgvector, dan 24 trigger (termasuk trigger kekebalan audit log `trg_audit_logs_immutable`) menjamin tidak ada skema bayangan yang tertinggal di basis data lokal tanpa terdokumentasi di migrasi resmi.
5. **Manajemen Konkurensi Pipeline Hemat Sumber Daya:**  
   Penerapan `concurrency: group: ci-${{ github.ref }}, cancel-in-progress: true` pada [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml#L16-L18) membatalkan build lama secara instan ketika ada commit baru yang didorong ke branch yang sama, menghemat kuota runner dan waktu tunggu tim.
6. **Uji Validasi Pemulihan Cadangan Mandiri (`scripts/restore-check.mjs`):**  
   Menegakkan prinsip baku *"backup yang belum diuji-restore = bukan backup"*, skrip ini memulihkan arsip dump terkompresi ke basis data sementara PostgreSQL, menjalankan `pnpm db:verify`, dan membersihkan kembali basis data uji secara otomatis.

---

## 5. Rencana Aksi Remediasi (Remediation Roadmap)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 AGENDA REMEDIASI CI/CD & AUTOMASI v2.0                  │
├─────────────────────────────────────────────────────────────────────────┤
│ PRIORITAS 1 — BLOCKER CI & CONTAINER (Segera Dikerjakan):               │
│   1. Perbaiki .github/workflows/ci.yml: inisialisasi basis data         │
│      'mathbank', jalankan migrasi & db:verify pada KEDUA database       │
│      (DATABASE_URL & TEST_DATABASE_URL).                                │
│   2. Sediakan layanan db-migrate pada docker-compose.yml agar           │
│      penerapan Docker tidak cold-crash pada DB kosong.                  │
├─────────────────────────────────────────────────────────────────────────┤
│ PRIORITAS 2 — HARDENING GERBANG MUTU & DEPENDENSI:                      │
│   3. Sisipkan pemanggilan 'pnpm security:secrets' dan audit CVE ke      │
│      dalam alur CI sebelum langkah pengujian.                           │
│   4. Pindahkan kredensial CI literal ke GitHub Action Secrets.          │
│   5. Konfigurasikan .github/dependabot.yml untuk ekosistem npm.         │
│   6. Pisahkan job 'quality' di ci.yml menjadi job paralel               │
│      (static-checks, unit-tests, db-integration).                       │
├─────────────────────────────────────────────────────────────────────────┤
│ PRIORITAS 3 — KETAHANAN OPERASIONAL & SMOKE TEST:                       │
│   7. Arahkan health-check pada scripts/deploy.sh ke /api/ready.         │
│   8. Lengkapi scripts/smoke-prod.ts dengan asersi /api/ready.           │
│   9. Buat suite E2E smoke headless Chromium di CI.                      │
│  10. Selaraskan deklarasi versi Node.js di package.json ke >=22.        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Catatan Verifikasi (*Verification Notes — Batasan Mutu CONSTRAINT #44*)

- **Verifikator:** Principal DevOps Engineer & QA Reviewer
- **Metode Pengujian & Analisis:**  
  *Static Analysis* berkas alur kerja CI ([`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml)), penelusuran rantai skrip basis data ([`scripts/test-db.ts`](file:///home/hari/projects/mathbank/scripts/test-db.ts), [`scripts/db-ensure-extensions.ts`](file:///home/hari/projects/mathbank/scripts/db-ensure-extensions.ts), [`scripts/db-verify.ts`](file:///home/hari/projects/mathbank/scripts/db-verify.ts)), inspeksi multi-stage container ([`Dockerfile`](file:///home/hari/projects/mathbank/Dockerfile), [`docker-compose.yml`](file:///home/hari/projects/mathbank/docker-compose.yml)), serta audit kesesuaian terhadap 46 batasan mutu mekanis ([`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md)).
- **Temuan yang Terverifikasi Benar (*Verified True*):**
  - ✅ Skrip gerbang mutu lokal `pnpm check` mengikat 6 lapis verifikasi (`theme:check`, `lint:names`, `typecheck`, `lint`, `test:coverage`, `build`).
  - ✅ Format respons probe kesiapan [`/api/ready`](file:///home/hari/projects/mathbank/src/app/api/ready/route.ts) mengembalikan status 200/503 berdasarkan keutuhan 26 tabel dan 24 trigger.
  - ✅ Invarian skema minimum pada [`scripts/db-verify.ts`](file:///home/hari/projects/mathbank/scripts/db-verify.ts) dan [`src/lib/db/invariants.ts`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts) telah selaras sempurna pada 26 tabel dan 24 trigger pasca-penghapusan tabel collections (MAT-39).
- **Cacat yang Terverifikasi Nyata (*Verified Defects*):**
  - ⚠️ Terverifikasi bahwa [`.github/workflows/ci.yml`](file:///home/hari/projects/mathbank/.github/workflows/ci.yml) pasti gagal mengeksekusi `pnpm db:migrate` karena container Postgres hanya membuat `mathbank_test`, sedangkan `db:migrate` mencoba menyambung ke `mathbank`.
  - ⚠️ Terverifikasi bahwa `TEST_DATABASE_URL` tidak pernah dimigrasi di CI, menyebabkan `pnpm test:db` gagal.
  - ⚠️ Terverifikasi bahwa `deploy.sh` menganggap HTTP 307 ke `/login` sebagai tanda sukses, tanpa memverifikasi kesiapan koneksi basis data.
  - ⚠️ Terverifikasi bahwa tidak ada pemindaian rahasia (`security:secrets`) dan pemindaian dependensi (`security:advisories`) di dalam CI workflow.

---
*Laporan audit terperinci ini telah diformat secara komprehensif untuk diarsipkan ke dalam [`MathBankAuditor/reports/17.10.2026/audit-ci-cd-and-automation.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-ci-cd-and-automation.md).*
