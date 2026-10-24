# Laporan Audit Komprehensif — `nextjs16-skills`

**Target proyek:** MathBank v2 (`/home/hari/projects/mathbank`)
**Skill acuan:** `nextjs16-skills` (`~/.agents/skills/nextjs16-skills/SKILL.md`)
**Tanggal audit:** 17 Oktober 2026
**Metode:** Analisis statis kode sumber + eksekusi gerbang mutu nyata (`typecheck`, `lint`, `lint:names`, `test`, `build`)
**Versi terpasang:** Next.js `16.3.8` · React `19.3.0` · Node `v24.19.0` · pnpm `11.22.0`

---

## 1. Ringkasan Eksekutif

MathBank v2 **sudah dimigrasikan dengan benar** ke mayoritas perubahan breaking Next.js 16: `middleware.ts` → `proxy.ts`, ESLint flat config, Turbopack sebagai bundler default, dan **Async Request APIs** (params/searchParams/cookies/headers) di seluruh halaman maupun route handler. Build produksi **lolos** (exit 0).

Namun audit menemukan **satu cacat kelas bug yang nyata** (keliru `await` pada objek yang sudah di-resolve), **dua gerbang mutu yang gagal** (`pnpm lint` dan `pnpm test`), serta beberapa celah konsistensi tipe yang tidak tertangkap oleh `tsc` maupun ESLint.

| Gerbang | Perintah | Hasil |
|---|---|---|
| Typecheck | `tsc --noEmit` | ✅ 0 error |
| Lint | `eslint` | ❌ **7 error, 42 warning** |
| Lint nama (CONSTRAINTS #28b) | `scripts/check-names.mjs` | ❌ **exit 1** (51 pelanggaran) |
| Unit test | `vitest run` | ❌ **1 gagal** / 966 lulus |
| Build | `next build` (Turbopack) | ✅ exit 0 |

> **Catatan penting:** `pnpm check` (gerbang exit resmi per CONSTRAINTS.md #1–#4) **akan gagal** saat ini karena lint, lint:names, dan test tidak hijau. Ini bertentangan dengan klaim "exit gate: `pnpm check` harus exit 0".

**Skor kepatuhan Next.js 16: 8,5 / 10.** Semua perubahan *breaking* Next 16 yang berisiko tinggi (menyebabkan runtime error/500) **sudah tertangani**. Sisa temuan berada di level integritas kode dan gerbang mutu, bukan inkompatibilitas framework.

---

## 2. Matriks Kepatuhan terhadap `nextjs16-skills`

| Item skill | Status | Bukti / Catatan |
|---|---|---|
| **Async Request APIs** (`await params`, `searchParams`, `cookies()`, `headers()`, `draftMode()`) | ✅ Patuh | `(app)/collections/[id]/page.tsx:9` → `params: Promise<{id}>` + `await params`. Semua route handler memakai wrapper yang meng-*await* params (`route-wrapper.ts:333`). Tidak ada akses sinkron yang tersisa. |
| **`PageProps` / `LayoutProps` typegen** | ⚠️ Sebagian | `LayoutProps<"/">` dipakai (`app/layout.tsx:38`, `(app)/layout.tsx:19`). Halaman dinamis masih memakai tipe manual `Promise<{id}>` — sah, tetapi `next typegen` belum dimanfaatkan menyeluruh. |
| **`middleware.ts` → `proxy.ts`** | ✅ Patuh | Hanya ada `src/proxy.ts`. Build mencetak `ƒ Proxy (Middleware)`. Tidak ada `middleware.ts` sisa. |
| **`proxy` hanya di runtime Node.js** | ✅ Patuh | `proxy.ts` tidak menyetel `runtime` (default nodejs) dan tidak memakai API Edge. |
| **Turbopack default** | ✅ Patuh | `next build` sukses tanpa `--webpack`, tidak ada `webpack` kustom di `next.config.ts`. |
| **Config `experimental.turbopack` → `turbopack`** | ✅ Patuh | Tidak ada blok `experimental` di `next.config.ts`. |
| **ESLint flat config** | ✅ Patuh | `eslint.config.mjs` memakai `defineConfig` + `eslint-config-next/core-web-vitals`. |
| **`next lint` dihapus** | ✅ Patuh | `package.json` memakai `"lint": "eslint"`. |
| **`serverRuntimeConfig` / `publicRuntimeConfig`** | ✅ Patuh | Tidak ditemukan (memakai ENV). |
| **`experimental.ppr` / `experimental_ppr` rute** | ✅ Patuh | Tidak ada. |
| **`unstable_rootParams`, `next/legacy/image`, `images.domains`** | ✅ Patuh | Tidak ditemukan. |
| **`revalidateTag(tag)` argumen tunggal (deprecated)** | ✅ N/A | `revalidateTag` tidak dipakai. |
| **Cache Components (`"use cache"`) / `cacheLife` / `cacheTag`** | ⚠️ Tidak dipakai | Arsitektur memilih `force-dynamic` + fetch klien (TanStack Query). Sah, tetapi tidak memanfaatkan model caching baru v16 — lihat §5. |
| **`next/image` (default baru)** | ⚠️ Tidak dipakai | `math-content.tsx:427` sengaja `<img>` (media lokal) dengan `eslint-disable` beralasan. Tidak melanggar, tetapi kehilangan optimasi. |
| **Scroll behavior override dihapus** | ✅ Aman | `globals.css:159` menyetel `scroll-behavior: auto !important` — tidak bergantung pada override lama Next. |
| **Persyaratan Node.js ≥ 20.9** | ⚠️ Longgar | `package.json` `engines.node: ">=20"` — perlu diperketat ke `>=20.9` (lihat L-06). |
| **`typedRoutes` (disarankan, bukan wajib)** | ⚠️ Tidak aktif | Tidak diaktifkan; relatif aman karena `useParams<{id}>` bertipe eksplisit. |

---

## 3. Temuan Bug & Celah (prioritas menurun)

### 🔴 K-01 — `await params` pada objek yang sudah di-resolve (kelas bug, 5 lokasi)

`wrapRoute` **sudah** meng-*await* params di `route-wrapper.ts:333` sebelum memanggil handler:

```ts
const params = (await args?.params) ?? {};   // params = objek biasa
const data = await opts.handler({ actor, query, body, req, params });
```

Namun beberapa handler masih menulis `(await params).id`:

| Berkas | Baris |
|---|---|
| `src/app/api/events/[id]/route.ts` | 18, 26 |
| `src/app/api/sources/[id]/route.ts` | 22, 30 |
| `src/app/api/tags/[id]/route.ts` | 12, 20 |
| `src/app/api/system/agent-keys/[id]/route.ts` | 12 |

**Dampak:** Secara runtime **tidak crash** (`await` pada non-Promise mengembalikan nilai apa adanya — sudah diuji), sehingga bug ini **lolos senyap**. Tetapi:
1. **Menyesatkan tipe** — `RouteContext.params` dideklarasikan `Record<string, string>`, bukan `Promise`. Kode ini berasumsi sebaliknya dan **menyembunyikan kontrak sebenarnya** dari `wrapRoute`.
2. **Jebakan refactor** — bila kelak `wrapRoute` berhenti men-*await* params, 5 route ini akan rusak tanpa peringatan.
3. **Inkonsistensi** dengan 40+ route lain yang memakai `params.id` langsung.

**Bukti:** `tsc --noEmit` **tidak menandai** ini (exit 0) — `await` pada non-thenable sah di TypeScript.

**Perbaikan:**
```ts
// src/app/api/tags/[id]/route.ts:12
handler: async ({ body, actor, params }) => updateTag(params.id, body, actor),
```
Ulangi pola untuk 4 berkas lain. Tambahan pengerasan: ubah `RouteContext.params` menjadi `Readonly<Record<string,string>>` atau tambahkan lint rule `no-floating`-style kustom agar `await params` di handler route ditolak.

---

### 🟠 K-02 — `params.itemId` tidak ada di tipe `RouteContext`

`src/app/api/bundles/[id]/items/[itemId]/route.ts:9`:
```ts
await removeItem(params.id, params.itemId, actor);
```

`params` bertipe `Record<string, string>`, jadi `itemId` **typecheck hanya karena** index signature. Tidak ada jaminan `itemId` benar-benar ada — bila Next mengubah bentuk `NextRouteArgs` untuk rute bertingkat, error baru muncul di runtime. **Rekomendasi:** buat `wrapRoute` generik atas nama param (`wrapRoute<{id:string; itemId:string}>`) atau sediakan helper `getParam(params, "itemId")` yang melempar 400 bila kosong.

---

### 🟠 K-03 — Gerbang `pnpm lint` gagal (7 error, 42 warning)

Semua **7 error** berada di `scripts/dev/**` (bukan `src/`):

| Berkas | Aturan |
|---|---|
| `scripts/dev/audit-event-source.ts:45` | `prefer-const` |
| `scripts/dev/diagnosa-tka.ts:22` | `prefer-const` |
| `scripts/dev/hitung-db-benar.ts:23, 269` | `prefer-const` |
| `scripts/dev/test-one-dev.ts:44` | `prefer-const` |
| `scripts/dev/sync-done-list.ts:18` | `no-require-imports` |
| `scripts/dev/verify-saved.ts:22` | `no-require-imports` |

Beberapa di antaranya berasal dari berkas **untracked** (skrip kerja lokal) yang tetap ter-scan ESLint karena `globalIgnores` tidak mengecualikan `scripts/dev`.

**Dampak:** `pnpm lint` → exit 1 → CONSTRAINTS #2 ("Zero lint errors") **dilanggar** → `pnpm check` gagal.

**Perbaikan:** `git clean` skrip scratch, atau tambahkan `scripts/dev/**` ke `globalIgnores` bila memang bukan bagian kode produk — **tetapi** perlu keputusan eksplisit (skrip dev yang untracked sebaiknya tetap boleh gagal tanpa memblokir CI produksi, sedangkan skrip *tracked* wajib hijau).

---

### 🟠 K-04 — `pnpm test` gagal: tes `check-names` (CONSTRAINTS #28b)

`src/lib/telemetry/check-names.test.ts` menjalankan `scripts/check-names.mjs` terhadap repo dan mengharapkan output sukses. Saat ini **51 pelanggaran** nama berbahasa Indonesia — semuanya di `scripts/dev/` (mis. `cari-align-real.ts`, `bersihkan-paket-salah.ts`, `cari-bracket-awal.ts`).

**Temuan penting:** Dari 51 berkas tersebut, **0 berkas tracked**. Yang tracked (`git ls-files scripts/dev` = 9 berkas: `audit-katex.ts`, `clean-dummy.ts`, dll.) **semuanya bersih**. Artinya pelanggaran murni berasal dari kebocoran scratch lokal yang tidak di-.gitignore dan tetap menempel di working tree.

**Dampak:** Unit test 1/967 gagal → CONSTRAINTS #1/#3 (test hijau) tidak terpenuhi.

**Perbaikan:** Tambahkan pola skrip scratch ke `.gitignore` (mis. `/scripts/dev/cari-*`, `/scripts/dev/audit-*` sementara) atau bersihkan working tree; pertimbangkan agar `check-names.mjs` hanya memeriksa berkas **tracked** (`git ls-files`) sehingga skrip lokal tak memblokir gerbang.

---

### 🟡 K-05 — `proxy.ts` matcher mengecualikan static, tetapi tidak memisahkan header CSS media

`src/proxy.ts:46` — `matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]`. Proxy menjalankan `NextResponse.next({request:{headers}})` pada **semua** request dinamis, termasuk aset runtime `/img/[shortId]`. Ini benar tetapi menambah overhead per request media. Bukan bug v16; catat sebagai optimasi: kecualikan `/img/`, `/storage/`, dan ekstensi statis (`.*\\.(?:png|jpg|webp|woff2)$`) dari matcher.

---

### 🟡 K-06 — `engines.node` longgar (`>=20`) vs kebutuhan Next 16 (`>=20.9`)

`package.json:100` → `"node": ">=20"`. Next.js 16 mensyaratkan **Node.js 20.9+** (Node 18 tidak didukung, dan 20.0–20.8 melanggar batas API). Runtime lokal sudah `v24.19.0` sehingga tidak bermasalah, tetapi **host/deploy yang memakai Node 20.0–20.8 akan gagal tanpa peringatan yang jelas**.

**Perbaikan:** `"node": ">=20.9"`.

---

### 🟡 K-07 — Validasi `DEMO_LOGIN` / `AUTH_DEV_BYPASS` di `.env` lokal

`.env` (tidak ter-commit, benar secara `.gitignore`) berisi:
- `DEMO_LOGIN` bernilai 7 karakter (`enabled`)
- `AUTH_DEV_BYPASS` bernilai 4 karakter (`true`)

**Status keamanan: AMAN.** `AUTH_DEV_BYPASS` dipagari keras di `resolve.ts:92` — `if (process.env.NODE_ENV === "production") return null;` (pagar 1) dan penolakan `APP_ENV=production|staging` (pagar 2). Jadi meski `.env` terbawa ke produksi, bypass **mati total**.

**Risiko tersisa:** `DEMO_LOGIN=enabled` **tidak** dipagari oleh `NODE_ENV` untuk produksi — hanya oleh *default* (`demoLoginAllowed()` mengembalikan true bila `DEMO_LOGIN==="enabled"`, apa pun `NODE_ENV`). Artinya jika `.env` ini disalin ke server produksi, **login demo publik admin/guru/penelaah aktif**. Dokumentasi (`quick-login/route.ts:15-16`) sudah menyatakan ini keputusan sadar untuk server demo publik, tetapi tidak ada pengaman mekanis yang mencegahnya bocor ke produksi sungguhan.

**Rekomendasi:** tambah pagar ganda — mis. tolak `DEMO_LOGIN=enabled` bila `APP_ENV === "production" && DEMO_PUBLIC !== "true"`, dan tampilkan peringatan di log saat startup (`instrumentation.ts`). Sudah ada `smoke:prod` yang mendeteksinya (`scripts/smoke-prod.ts:75`), jadi jalankan sebagai bagian CI/CD.

---

## 4. Kepatuhan Pola Arsitektur

### 4.1 Batas Server/Client
- **75 komponen** ber-`"use client"`; **tidak ada** yang mengimpor `@/lib/db`, `@/lib/crypto`, atau `process.env` → batas server/client **bersih**.
- Tidak memakai `server-only` marker; aman karena tidak ada impor server-side di klien, tetapi menambahkan `import "server-only"` pada `src/lib/db/**` & `src/lib/crypto/**` akan memberi jaring pengaman kompilasi.
- `useSearchParams()` di 3 view dibungkus `<Suspense>` di halaman (`bundles/page.tsx`, `assets/page.tsx`, `questions/page.tsx`) → **tidak** memicu error build CSR bailout. Patuh.

### 4.2 Auth di Layout
`(app)/layout.tsx` melakukan `redirect("/login")` untuk sesi kosong, **dan** setiap endpoint API punya gate sendiri via `wrapRoute` (`resolveActor` → `assertCan`). Ini mengikuti prinsip "jangan andalkan layout untuk otorisasi". ✅

### 4.3 Endpoint Non-`wrapRoute`
`/api/health`, `/api/ready`, `/api/metrics`, `/api/mcp`, `/api/auth/[...all]`, dan `/api/bundles/[id]/export/moodle` berada di luar wrapper. Audit memeriksa:
- `/api/metrics` — token `METRICS_TOKEN` (perbandingan waktu-konstan); **nonaktif + 404 di produksi** bila token tak diset. ✅
- `/api/mcp` — wajib `x-api-key`/Bearer valid + rate-limit per aktor. ✅
- `/api/bundles/[id]/export/moodle` — memanggil `resolveActor` sendiri. ✅
- `/api/health` & `/api/ready` — publik sesuai desain, tidak membocorkan data (hanya nama objek skema). ✅

---

## 5. Peluang Pemanfaatan Fitur Next 16 (bukan cacat)

1. **Cache Components (`"use cache"`)** — seluruh aplikasi berjalan `force-dynamic` + fetch klien. Bila ada halaman baca-berat (bank soal, referensi) yang datanya jarang berubah, `"use cache"` + `cacheTag` dapat memotong latensi dan beban DB. Ini keputusan produk, bukan pelanggaran.
2. **`typedRoutes`** — mengaktifkan `typedRoutes: true` akan memvalidasi `router.push("/bundles/...")` saat kompilasi; cocok mengingat ada pemakaian `redirect(\`/bundles/${id}\`)`.
3. **`next typegen` untuk `RouteContext`** — alih-alih `Record<string,string>` manual, gunakan `RouteContext` hasil typegen agar param bertingkat (`itemId`) ikut tervalidasi (menutup K-02).
4. **`next/image`** — media `/img/[shortId]` saat ini `<img>`; beralih ke `next/image` dengan loader lokal + `images.localPatterns` akan memberi optimasi ukuran/format.

---

## 6. Rekomendasi Berurutan (actionable)

| # | Rekomendasi | Prioritas | Effort |
|---|---|---|---|
| 1 | Ganti semua `(await params).x` → `params.x` di 5 berkas (K-01) | 🔴 Tinggi | Kecil |
| 2 | Samakan kontrak param: `RouteContext.params` generik + dukung `itemId` (K-02) | 🟠 Sedang | Kecil |
| 3 | Bersihkan/tangguhkan skrip scratch `scripts/dev/**` dari lint (K-03) | 🟠 Sedang | Kecil |
| 4 | Buat `check-names.mjs` hanya memindai berkas *tracked* (git ls-files) (K-04) | 🟠 Sedang | Kecil |
| 5 | Perketat `engines.node` → `>=20.9` (K-06) | 🟡 Rendah | Sangat kecil |
| 6 | Tambah pagar produksi untuk `DEMO_LOGIN` (K-07) | 🟡 Rendah* | Kecil |
| 7 | Persempit matcher `proxy.ts` untuk aset media (K-05) | 🟢 Optimasi | Kecil |
| 8 | Evaluasi `"use cache"` untuk halaman baca & aktifkan `typedRoutes` | 🟢 Optimasi | Sedang |

\* Rendah di kode, **tinggi** dalam konsekuensi bila `.env` demo bocor ke produksi — mitigasi utamanya tetap proses deploy.

---

## 7. Kesimpulan

Codebase **patuh terhadap perubahan breaking Next.js 16** yang berdampak langsung ke runtime: tidak ada akses sinkron ke `params`/`cookies`/`headers`, migrasi `proxy.ts` selesai, Turbopack & flat ESLint terpasang, dan build produksi berhasil.

Namun **gerbang mutu `pnpm check` saat ini gagal** oleh tiga sebab terpisah (lint error di `scripts/dev`, tes `check-names`, dan 5 lokasi bug `await params` yang lolos tipe). Dua dari tiga kegagalan bersumber dari **“kebocoran” skrip kerja lokal yang tidak di-.gitignore** dan ikut ter-scan; sisanya adalah cacat kode nyata meski inert. Memperbaiki K-01 s/d K-04 (± 30–60 menit kerja) akan memulihkan kondisi `pnpm check` hijau dan menutup seluruh temuan level tinggi/menengah pada laporan ini.

---

### Lampiran — Perintah & Hasil Mentah

```
tsc --noEmit -p tsconfig.json          → exit 0
eslint                                 → exit 1 (7 errors, 42 warnings; semua di scripts/dev/)
node scripts/check-names.mjs           → exit 1 (51 pelanggaran; 0 di antaranya tracked)
vitest run                             → 1 failed | 966 passed (90 files)
next build (Turbopack, NEXT_DIST_DIR)  → exit 0 (ƒ Proxy (Middleware) terdeteksi)
node -e "(await {id:'x'}).id"          → 'x' (await pada objek biasa tidak crash)
```

*Laporan disusun dari eksekusi langsung terhadap pohon kode, bukan dari training data. Semua temuan menyertakan berkas & baris yang dapat diverifikasi.*
