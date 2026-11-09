# Rencana Upgrade Dependensi MathBank ke Versi Terbaru

**Tanggal:** 2026-11-09 18:31 WIB
**Revisi:** 2026-11-09 (pasca-review internal — 16 koreksi diterapkan; lihat §13)
**Status:** 📋 RENCANA — belum ada perubahan diterapkan
**Branch kerja yang disarankan:** `chore/deps-upgrade-2026-11`
**Basis bukti:** `pnpm outdated --format json`, `pnpm audit --json`, metadata + tarball registry npm (snapshot 2026-11-09), inspeksi kode repositori ini.

---

## 1. Ringkasan eksekutif

| Ukuran | Nilai |
|---|---|
| Dependensi langsung | 49 (22 prod + 27 dev) |
| Tertinggal | 20 (11 patch, 7 minor, 2 major) |
| Sudah terbaru | 29 |
| Advisory terbuka | 8 (1 high, 4 moderate, 3 low) |
| Otomasi pembaru | tidak ada (Dependabot/Renovate belum dikonfigurasi) |

Dua major yang tertinggal — `postgres` 3 → 4 dan `jsdom` 30 → 31 — **tidak boleh** digabung dengan gelombang lain. Sisanya patch/minor dan dapat dikelompokkan per domain dengan gerbang uji masing-masing.

**Koreksi atas laporan audit sebelumnya:** klaim bahwa `better-auth@1.7.18` menghapus rantai `vite` adalah **salah**. `vitest` adalah *optional peer* `better-auth` (bukan dependency), dan pnpm mengaitkannya karena `vitest` ada di devDependencies. Rantai `better-auth → vitest → vite` tetap ada setelah upgrade; satu-satunya perbaikan adalah menaikkan `vite` ke `>=8.3.3`.

---

## 2. Baseline terukur

```
Node        v24.19.0
pnpm        11.22.0   (cocok dengan packageManager)
lockfile    9.0
Next        16.4.3    React 19.3.1
```

| Kelompok | Terpasang | Target | Jenis |
|---|---|---|---|
| next, eslint-config-next, @next/eslint-plugin-next | 16.4.3 | 16.4.5 | patch (pinned exact) |
| better-auth, @better-auth/api-key, @better-auth/drizzle-adapter | 1.7.14 | 1.7.18 | patch |
| tailwindcss, @tailwindcss/postcss | 4.3.3 | 4.3.5 | patch |
| @types/node | 26.6.5 | 26.6.6 | patch |
| @dnd-kit/react | 0.5.1 | 0.5.3 | patch |
| cn | 0.5.0 | 0.5.2 | patch |
| @tanstack/react-query | 5.105.0 | 5.107.1 | minor |
| vitest, @vitest/coverage-v8 | 5.0.5 | 5.1.0 | minor |
| @vitejs/plugin-react | 6.1.2 | 6.2.1 | minor |
| eslint | 10.13.0 | 10.14.0 | minor |
| @playwright/test | 1.64.1 | 1.65.0 | minor |
| lucide-react | 1.62.0 | 1.70.0 | minor |
| **postgres** | 3.4.9 | **4.1.0** | **major** |
| **jsdom** | 30.1.3 | **31.0.0** | **major** |

Catatan mekanisme: lockfile memaku versi **terendah** yang memenuhi range (`^1.7.14` → `1.7.14`). Karena itu `pnpm install` tidak akan pernah menaikkan versi; pembaruan harus eksplisit.

---

## 3. Advisory keamanan

| Paket | Terpasang | Perbaikan | Severity | Jalur |
|---|---|---|---|---|
| vite | 8.3.1 | >= 8.3.3 | **1 high**, 3 moderate, 2 low | `vitest → vite` (peer), `@vitejs/plugin-react → vite` |
| minimatch | 10.2.6 | >= 11.0.1 | moderate | `eslint → @eslint/config-array → minimatch ^10.2.4` |
| deepmerge | 4.3.1 | >= 4.3.2 (**belum terbit**) | low | `shadcn → @shadcn/registry → deepmerge ^4.3.1` |

`vite` dapat ditutup lewat override di `pnpm-workspace.yaml` (transitif/peer). `deepmerge` **belum bisa** ditutup: versi patchnya belum terbit. `minimatch` **tidak** dapat ditutup dalam range `^10`; perlu override major atau menunggu upstream.

---

## 4. Analisis major: `postgres` 3.4.9 → 4.1.0

Sumber: README v4 bagian *Upgrading from v3* (tarball registry) + inspeksi repo.

### 4.1 Permukaan risiko di repo ini

| Perubahan v4 | Dampak di MathBank | Status |
|---|---|---|
| Tipe parameter ditentukan server; `Date`/`boolean`/`Buffer`/`bigint` tidak lagi dipetakan klien | Semua 58 kolom timestamp memakai `withTimezone: true` (timestamptz); tidak ada kolom `date`, `time`, atau `timestamp without time zone` | ✅ risiko utama netral |
| `sql.array()` dihapus | 4 pemanggilan | ⚠️ **wajib diubah** |
| Transaksi lebih ketat (`UNSAFE_TRANSACTION`, `TRANSACTION_ROLLED_BACK`) | Transaksi memakai `db.transaction` Drizzle → `sql.begin` (bukan `BEGIN` mentah) | ⚠️ perlu uji DB penuh |
| Paket ESM murni | Tidak ada `require("postgres")`; Next/tsx sudah ESM | ✅ |
| `infinity` timestamp menjadi `±Infinity` | Tidak ada kolom infinity yang diandalkan | ✅ |
| Domain dibaca sebagai tipe dasar | Tidak ada domain di skema | ✅ |
| Tipe `Sql<TTypes = {}>` punya default | Anotasi `postgres.Sql` di dua skrip tetap valid | ✅ |

### 4.2 Titik kode yang harus diubah sebelum bump

| Berkas | Baris | Tindakan |
|---|---|---|
| `src/lib/services/question-bulk.db.test.ts` | 210 | `${sql.array(ids)}::uuid[]` → `${ids}::uuid[]` |
| `scripts/dev/check-image-question.ts` | 30 | `${sql.array(unik)}` → `${unik}::text[]` (sesuaikan tipe kolom) |
| `scripts/dev/delete-error-rows.ts` | 62 | idem untuk `qIds` (`::uuid[]`) |
| `scripts/dev/delete-error-rows.ts` | 63 | idem untuk `sIds` (`::uuid[]`) |

**Penting:** `typecheck` **tidak** akan menangkap pelanggaran ini. Tipe v4 masih menyediakan stub `array(value, type?): never` dengan tanda `@deprecated`, jadi kode lolos kompilasi tetapi gagal saat dijalankan dengan `ARRAY_REMOVED`. Keempat titik harus diperbaiki lewat pencarian kode, bukan menunggu error kompilasi.

### 4.3 Risiko utama yang belum terbukti aman

`drizzle-orm@0.45.4` mendeklarasikan peer `postgres: >=3`, tetapi **belum ada bukti** bahwa kombinasi `drizzle-orm 0.45.4 + postgres 4` diuji. Ini adalah satu-satunya titik yang bisa menggagalkan gelombang ini secara luas. Mitigasi:

1. Jalankan **seluruh** 23 berkas `*.db.test.ts`, bukan subset.
2. `pnpm db:verify` di DB utama dan DB uji.
3. Siapkan jalan mundur cepat: tambahkan `infer: true` pada `postgres()` di `src/lib/db/index.ts:22` (mengembalikan perilaku tipe parameter v3) bila muncul error tipe parameter yang tak terduga.
4. Bila Drizzle gagal total, tunda gelombang ini dan buka isu upstream; jangan memaksa.

---

## 5. Analisis major: `jsdom` 30.1.3 → 31.0.0

| Aspek | Temuan |
|---|---|
| Engines | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`; lokal 24.19.0 ✅, CI `node-version: 24` ✅, `Dockerfile` `node:24-slim` perlu dipastikan ≥ 24.15 |
| Dependensi yang dibuang | `css-tree`, `@asamuzakjp/css-color`, `@asamuzakjp/dom-selector`, `@bramus/specificity`, `@csstools/css-syntax-patches-for-csstree` |
| Dependensi baru | `bcp-47`, `bcp-47-match`, `parse5-parser-stream` |
| Dampak di repo | jsdom dipakai sebagai environment **seluruh** unit test (`vitest.config.mts`), tetapi hanya 1 tes memakai `getComputedStyle` — `src/components/math/math-content-layout.test.tsx:51` (memeriksa `overflowX`) |

Perubahan mesin CSS/selector adalah risiko utama. Karena assertion CSS sangat sedikit, dampak nyata diperkirakan rendah, tetapi tetap harus diuji dengan suite penuh.

---

## 6. Gelombang eksekusi

Setiap gelombang = **satu commit** yang dapat direvert. Jangan menggabungkan gelombang.

### Gelombang 0 — Persiapan & baseline

```bash
git switch -c chore/deps-upgrade-2026-11
pnpm install --frozen-lockfile
pnpm check          # theme, names, authz, openapi, typecheck, lint, coverage, build
pnpm test:db
pnpm audit --json > /tmp/audit-before.json
```

**Gerbang:** baseline harus hijau sebelum menyentuh apa pun. Bila ada yang merah, perbaiki dulu — jangan menumpuk kegagalan.

**Catatan CI:** `.github/workflows/ci.yml` hanya berjalan untuk push/PR ke `main`. Branch `chore/deps-upgrade-2026-11` **tidak** akan diuji CI sampai PR dibuka, jadi gerbang lokal (§7) adalah satu-satunya pengaman selama pengerjaan.

### Gelombang 1 — Tutup advisory yang bisa ditutup (tanpa ubah `package.json`)

```bash
pnpm update vite deepmerge
pnpm why vite deepmerge          # pastikan hanya 8.3.3 / 4.3.2 yang tersisa
pnpm audit --audit-level=high    # gate: tidak boleh ada high
pnpm audit --json > /tmp/audit-after-wave1.json
pnpm test && pnpm build
```

**Target:** `vite >=8.3.3`; advisory high hilang.
**Sisa yang diharapkan:** `minimatch` (moderate, dev-only) dan `deepmerge` (low).

**Koreksi hasil eksekusi 2026-11-09:** `pnpm update vite deepmerge` adalah **no-op** — keduanya transitif/peer, bukan dependensi langsung. Override adalah jalur utama, bukan fallback. Selain itu `deepmerge@4.3.2` **belum terbit** (latest 4.3.1), jadi advisory low-nya belum bisa ditutup; jangan menambahkan override deepmerge — `pnpm install` akan gagal `ERR_PNPM_NO_MATCHING_VERSION`. Perlakukan seperti `braces`: catat sebagai utang yang menunggu rilis upstream.

Tambahkan entri berikut **ke blok `overrides` yang sudah ada** di `pnpm-workspace.yaml` (jangan membuat blok kedua — YAML invalid), lalu `pnpm install`:

```yaml
# di dalam blok overrides yang sudah ada
vite: "^8.3.3"
```

**Jangan memakai `--audit-level=moderate` sebagai gate** — `minimatch` dan `deepmerge` akan membuat perintah exit non-zero padahal keduanya sisa yang sudah diperkirakan. Gate memakai `high`; inventaris lengkap dibaca dari JSON.

### Gelombang 2 — Next 16.4.5 (tiga paket harus serempak)

```bash
pnpm add --save-exact next@16.4.5
pnpm add -D --save-exact eslint-config-next@16.4.5 @next/eslint-plugin-next@16.4.5
pnpm typecheck && pnpm lint && pnpm build
```

**Wajib `--save-exact`:** ketiga paket saat ini di-pin tanpa caret; `pnpm add` biasa akan menulis `^16.4.5` dan diam-diam mengubah kebijakan pin.
**Wajib `-D` untuk `eslint-config-next`:** default `pnpm add` adalah `--save-prod`; tanpa `-D` paket pindah ke `dependencies`.

**Gerbang tambahan:** baca `node_modules/next/dist/docs/` setelah bump (aturan `AGENTS.md`); smoke `pnpm dev` untuk `proxy.ts`, `"use cache"`, dan auth guard.
**Risiko:** patch Next dapat mengubah perilaku cache; build + smoke wajib.

### Gelombang 3 — better-auth 1.7.18 (tiga paket serempak)

```bash
pnpm add better-auth@1.7.18 @better-auth/api-key@1.7.18 @better-auth/drizzle-adapter@1.7.18
pnpm test && pnpm test:db && pnpm build
```

**Gerbang tambahan:** login manual, sesi, `rate_limit`, API key, dan `assertCan` (tes `*.authz.db.test.ts`).
**Risiko:** auth = boundary; patch pun tetap harus diuji end-to-end.

### Gelombang 4 — Toolchain lint & tes (pecah jadi 4 sub-langkah)

**4a. ESLint**
```bash
pnpm add -D eslint@10.14.0
pnpm lint
```

**4b. Vitest**
```bash
pnpm add -D vitest@5.1.0 @vitest/coverage-v8@5.1.0 @vitejs/plugin-react@6.2.1
pnpm test:coverage
```
Ambang coverage (90/80/88/92) **tidak boleh diturunkan**. Bila angka bergeser karena perubahan instrumentasi v8, perbaiki tes atau selidiki sumbernya.

**4c. jsdom 31 (major, terpisah)**
```bash
node -e "console.log(process.version)"   # harus >= 24.15
pnpm add -D jsdom@31.0.0
pnpm test
```

**4d. Playwright**
```bash
pnpm add -D @playwright/test@1.65.0
pnpm exec playwright install
pnpm e2e:manual   # bila lingkungan browser tersedia
```

### Gelombang 5 — UI & data (patch/minor)

```bash
pnpm add -D tailwindcss@4.3.5 @tailwindcss/postcss@4.3.5
pnpm add @tanstack/react-query@5.107.1 lucide-react@1.70.0 @dnd-kit/react@0.5.3 cn@0.5.2
pnpm add -D @types/node@26.6.6
pnpm theme:check && pnpm test && pnpm typecheck && pnpm build
```

**Wajib `-D` untuk Tailwind:** keduanya devDependencies; tanpa `-D` akan pindah ke `dependencies`.

**Catatan `lucide-react`:** 66 titik impor ikon; `pnpm typecheck` akan menangkap ikon yang dihapus/diganti nama.
**Catatan Tailwind:** `pnpm theme:build`/`theme:check` adalah gerbang khusus proyek ini; jalankan keduanya.

### Gelombang 6 — `postgres` 4.1.0 (major, commit & PR sendiri)

**6a. Prasyarat kode & data**
- Ubah 4 pemanggilan `sql.array()` (tabel §4.2). Cari dengan `grep -rn "sql.array(" src scripts`; jangan andalkan `typecheck`.
- Pastikan `postgres.Sql` di `scripts/backfill-answer-space.ts:36` dan `scripts/backfill-denormalize-grades.ts:39` masih lolos `typecheck`.
- Verifikasi **DB hidup**, bukan hanya skema Drizzle — repo ini punya riwayat drift skema:

```sql
select current_setting('TimeZone') as session_tz;

select table_schema, table_name, column_name, data_type
from information_schema.columns
where data_type in ('timestamp without time zone', 'date', 'time without time zone')
  and table_schema not in ('pg_catalog', 'information_schema');
```

Hasil kolom kedua harus kosong. Bila tidak kosong, tambahkan `infer: true` sebagai langkah transisi **atau** ubah kolom ke `timestamptz` sebelum bump.

**6b. Bump**
```bash
pnpm add postgres@4.1.0
pnpm typecheck
pnpm test:db
pnpm db:verify
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:verify
pnpm build
docker build -t mathbank:deps-upgrade .
```

**6c. Smoke tambahan**
- Ingest 1 artikel kecil lewat API (jalur tulis + transaksi).
- Ekspor Moodle XML 1 bundle.
- Cetak 1 bundle.
- Endpoint gambar `GET /img/[shortId]`.

**6d. Jalan mundur**
Bila ada regresi tipe parameter: set `infer: true` pada `src/lib/db/index.ts:22`, ulangi uji. **`infer: true` hanya untuk diagnosis — wajib dihapus sebelum merge.** Bila ternyata harus permanen, itu keputusan arsitektur dan butuh ADR. Bila Drizzle tidak kompatibel: revert gelombang, catat sebagai blocker upstream.

### Gelombang 7 — `minimatch` (keputusan, bukan keharusan)

Pilihan:
- **A (disarankan):** terima sebagai utang dev-only (DoS pada tooling lint), catat di `docs/KEAMANAN.md`, pantau upstream `@eslint/config-array`.
- **B:** override `minimatch: ^11.0.1` di `pnpm-workspace.yaml`, lalu `pnpm install && pnpm lint` penuh. Risiko: major untuk plugin ESLint.

Jangan lakukan B tanpa menjalankan seluruh lint pada semua berkas.

### Gelombang 8 — Higiene & dokumentasi

1. `docs/KEAMANAN.md` §S8: klaim "`pnpm audit` 0" sudah basi — perbarui dengan hasil akhir.
2. `pnpm-workspace.yaml` → `minimumReleaseAgeExclude`: entri `next@16.3.7`, `@next/*@16.3.7`, `better-auth*@1.7.14`, `lucide-react@1.62.0` menjadi basi. Ganti dengan versi baru. Tidak ada `minimumReleaseAge` eksplisit saat ini, tetapi `pnpm config get` yang kosong **bukan** jaminan — perlakukan allowlist ini sebagai aktif.
3. Jangan menyentuh `overrides.braces` + `patchedDependencies` (`GHSA-vfj7-8cjw-p6xm` belum ada rilis 3.0.4) dan `drizzle-kit>@esbuild-kit/esm-loader`.
4. `CHANGELOG.md`: tambahkan satu bagian naratif untuk upgrade ini. Repo memelihara changelog manual (47 bagian sebelumnya); upgrade dependensi besar tanpa catatan akan menghilangkan konteks keputusan.
5. `docs/PETA-DOKUMEN.md:4`: pastikan baris "Terakhir Diperbarui" mencerminkan tanggal penutupan upgrade. Baris ini sudah diperbarui ke 9 November 2026 saat revisi rencana; perbarui lagi bila penutupan terjadi di tanggal lain.
6. Usulan terpisah: konfigurasi Renovate/Dependabot dengan PR mingguan terkelompok (patch+minor) dan PR major terpisah. Tanpa ini, kondisi tertinggal akan berulang.
7. Usulan terpisah: tambahkan `pnpm audit --audit-level=high` ke CI.

---

## 7. Gerbang verifikasi standar (setiap gelombang)

```bash
pnpm theme:check && pnpm lint:names && pnpm lint:authz && pnpm openapi:check \
  && pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm build
pnpm test:db
pnpm db:verify
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:verify
pnpm exec drizzle-kit check
docker build -t mathbank:deps-upgrade .
```

`pnpm exec drizzle-kit check` dijalankan CI (`.github/workflows/ci.yml`) dan wajib ikut di lokal. Gelombang 6 wajib menjalankan **seluruh** daftar di atas; gelombang 1–5 memakai matriks §7a.

### 7a. Matriks verifikasi per gelombang

| Gelombang | Wajib |
|---|---|
| 1 | `pnpm why vite deepmerge`, `pnpm audit --audit-level=high`, `pnpm test`, `pnpm build` |
| 2 | `pnpm typecheck`, `pnpm lint`, `pnpm build`, smoke `pnpm dev` |
| 3 | `pnpm test`, `pnpm test:db`, `pnpm build`, login manual |
| 4a | `pnpm lint` |
| 4b | `pnpm test:coverage` |
| 4c | `pnpm test` |
| 4d | `pnpm e2e:manual` |
| 5 | `pnpm theme:check`, `pnpm test`, `pnpm typecheck`, `pnpm build` |
| 6 | seluruh §7 |
| 7 (bila override) | `pnpm lint` penuh |
| 8 | `pnpm audit` final |

---

## 8. Matriks risiko

| # | Risiko | Peluang | Dampak | Mitigasi |
|---|---|---|---|---|
| 1 | `drizzle-orm 0.45.4` × `postgres 4` tidak teruji | sedang | tinggi | suite DB penuh; `infer: true`; tunda bila gagal |
| 2 | jsdom 31 mengganti mesin CSS/selector | sedang | rendah–sedang | suite unit penuh; hanya 1 assertion CSS |
| 3 | Ambang coverage bergeser (vitest 5.1) | sedang | rendah | jangan turunkan ambang |
| 4 | Patch Next mengubah cache/`use cache` | rendah | sedang | build + smoke dev |
| 5 | Regresi auth (better-auth patch) | rendah | tinggi | tes auth + login manual |
| 6 | `minimumReleaseAgeExclude` basi; `pnpm update` menolak versi baru bila kebijakan aktif | tinggi | rendah | perbarui allowlist di gelombang 8; bila perlu set `minimumReleaseAge=0` sementara. `pnpm config get` yang kosong **bukan** jaminan kebijakan tidak aktif |
| 7 | `node:24-slim` < 24.15 untuk jsdom 31 | rendah | sedang | cek `node -v` di image; pin `node:24.15-slim` bila perlu |
| 8 | Override `minimatch` 11 memecah plugin lint | sedang | rendah | gelombang terpisah + lint penuh |
| 9 | `pnpm add` tanpa `-D` memindahkan devDependency ke `dependencies` | tinggi bila salah ketik | rendah | semua perintah memakai `-D` eksplisit; periksa `git diff package.json` setiap gelombang |

---

## 9. Rollback

Setiap gelombang satu commit:

```bash
git revert <sha-gelombang>
pnpm install --frozen-lockfile
```

Untuk kegagalan lockfile lokal: `git checkout -- package.json pnpm-lock.yaml pnpm-workspace.yaml && pnpm install --frozen-lockfile`.

Tidak ada perubahan skema, jadi **tidak ada migrasi DB** yang perlu dibalik pada gelombang mana pun. Tetap disarankan `pnpm backup:db` sebelum gelombang 6 bila akan menguji jalur tulis pada DB pengembangan.

---

## 10. Definition of done

- [ ] `pnpm outdated` kosong untuk dependensi langsung. Catatan: perintah ini **tidak** memeriksa paket alias (`typescript` → `@typescript/typescript6`, `@typescript/native` → `typescript`); keduanya sudah diverifikasi manual dan harus dicek ulang dengan `npm view`.
- [ ] `pnpm audit --audit-level=high` bersih; moderate tersisa hanya `minimatch` dengan keputusan tertulis.
- [ ] Audit akhir dijalankan setelah gelombang terakhir dan hasilnya identik dengan `/tmp/audit-after-wave1.json` kecuali `minimatch`.
- [ ] Seluruh gerbang §7 hijau di gelombang 6.
- [ ] `docker build` sukses dan healthcheck lolos.
- [ ] `docs/KEAMANAN.md` §S8, `pnpm-workspace.yaml`, `CHANGELOG.md`, dan baris "Terakhir Diperbarui" di `docs/PETA-DOKUMEN.md` diperbarui.
- [ ] Rencana ini ditandai selesai di `docs/PETA-DOKUMEN.md`.

---

## 11. Yang TIDAK boleh dilakukan

- `pnpm update --latest` sekali jalan untuk semua paket — akan mencampur dua major dengan 18 pembaruan lain.
- Menghapus override `braces` atau patch-nya.
- Menghapus override `drizzle-kit>@esbuild-kit/esm-loader`.
- `pnpm db:push`.
- Menggabungkan `postgres` 4 dengan gelombang lain.
- Menaikkan versi `next` tanpa menaikkan `eslint-config-next` dan `@next/eslint-plugin-next` bersamaan.
- `pnpm add` tanpa `-D` untuk paket dev, atau tanpa `--save-exact` untuk trio Next.
- Memakai `--audit-level=moderate` sebagai gate selama `minimatch` masih terbuka.

---

## 12. Batas verifikasi rencana ini

- Catatan rilis resmi (GitHub) **belum** diverifikasi; bukti berasal dari metadata registry, isi tarball `postgres@4.1.0`/`jsdom@31.0.0`, dan inspeksi kode repo.
- `pnpm audit` hanya mencakup advisory registry, bukan SCA menyeluruh.
- Belum ada perubahan yang diterapkan dan belum ada tes yang dijalankan untuk rencana ini.
- Kombinasi `drizzle-orm` × `postgres 4` adalah asumsi paling rapuh dan harus dibuktikan di gelombang 6, bukan diasumsikan aman.

---

## 13. Riwayat review

**2026-11-09 — review internal, 16 koreksi diterapkan.**

| Sev | Koreksi |
|---|---|
| P1 | `-D` eksplisit pada `pnpm add` untuk `eslint-config-next`, `tailwindcss`, `@tailwindcss/postcss` (default `pnpm add` = `--save-prod`) |
| P1 | `--save-exact` pada trio Next agar pin `16.4.5` tidak berubah menjadi `^16.4.5` |
| P1 | Gate audit memakai `--audit-level=high`, bukan `moderate`, agar `minimatch` tidak menghasilkan kegagalan palsu |
| P2 | Verifikasi kolom `date`/`time`/`timestamp without time zone` di **DB hidup**, bukan hanya skema Drizzle |
| P2 | `infer: true` ditandai hanya untuk diagnosis dan wajib dihapus sebelum merge |
| P2 | Catatan bahwa CI hanya berjalan untuk `main`; branch upgrade tidak diuji sampai PR |
| P3 | `pnpm exec drizzle-kit check` ditambahkan ke gerbang standar |
| P3 | `pnpm build` ditambahkan ke Gelombang 3; `pnpm test` ke Gelombang 5 |
| P3 | Matriks verifikasi per gelombang (§7a) ditambahkan |
| P3 | Klaim `minimumReleaseAgeExclude` "inert" dilunakkan + jalur penanganan bila `pnpm update` menolak |
| P3 | DoD mencatat bahwa `pnpm outdated` tidak memeriksa paket alias |
| P3 | Langkah `CHANGELOG.md` ditambahkan |
| P4 | Verifikasi `pnpm why vite deepmerge` setelah Gelombang 1 |
| P4 | Fallback `pnpm.overrides` bila `pnpm update` tidak menyentuh `vite` |
| P4 | Baris "Terakhir Diperbarui" `docs/PETA-DOKUMEN.md` diperbarui |
| P4 | Audit akhir ditambahkan ke DoD |

---

## 14. Catatan eksekusi

### Gelombang 0 — 2026-11-09

- Branch `chore/deps-upgrade-2026-11`, baseline pada HEAD `a2571c4`.
- Seluruh gerbang hijau: `theme:check` 34/34, `lint:names`, `lint:authz` (78 method/52 route), `typecheck`, `lint`, `test:coverage` (153 berkas/1576 tes; 90.42/82/91.82/92.92), `build`, `test:db` (29 berkas/341 tes), `db:verify` dua DB (28 tabel/34 trigger/1 HNSW).
- **Satu merah ditemukan dan diperbaiki:** `openapi:check` gagal karena tiga `enforcedIn` masih menunjuk `question-write.ts` setelah refactor `71f24ca`. Regenerasi menghasilkan diff 3 baris; `openapi:check` kini lolos.
- Build sempat gagal karena `Another next build process is already running` (proses agen lain). Diulang setelah proses selesai — lolos. Bukan masalah kode.
- Baseline audit tersimpan di `/tmp/audit-before.json`: 8 advisory (1 high, 5 moderate, 2 low).

### Gelombang 1 — 2026-11-09

- `pnpm update vite deepmerge` **no-op**: keduanya transitif/peer. Diperlukan override.
- `deepmerge@4.3.2` **tidak ada** di registry (latest 4.3.1) — override deepmerge dibatalkan; `pnpm install` gagal `ERR_PNPM_NO_MATCHING_VERSION`. Advisory low tetap terbuka.
- Override `vite: "^8.3.3"` ditambahkan ke `pnpm-workspace.yaml`; resolusi menjadi **vite 8.3.6** (8.3.7 tertahan kebijakan rilis).
- Hasil audit: **high 0**, sisa `minimatch` (moderate) + `deepmerge` (low) = 2 advisory.
- Gate: `pnpm test` 153/1576 lulus, `pnpm build` sukses, `pnpm install --frozen-lockfile` bersih.
- `package.json` tidak berubah; hanya `pnpm-lock.yaml` (+187/−92 baris) dan `pnpm-workspace.yaml`.
- **Observasi:** `pnpm peers check` melaporkan `eslint-plugin-import`/`jsx-a11y`/`react` masih membatasi peer ESLint `<=9`, sedangkan proyek memakai ESLint 10.13. Ini kondisi lama dan tidak menghalangi `pnpm lint`; perlu dipantau di Gelombang 4a.
- **Observasi:** pnpm 12.18.0 tersedia (terpasang 11.22.0) — upgrade toolchain major di luar rencana ini.
