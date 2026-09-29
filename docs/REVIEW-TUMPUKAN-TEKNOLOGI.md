# REVIEW TUMPUKAN TEKNOLOGI — MathBank vs Versi Terbaru

> **Tanggal review:** 2026-09-29
> **Metode:** Context7 MCP (`@upstash/context7-mcp` v4.1.1, via stdio) untuk dokumentasi versi-spesifik + npm registry (`npm view … dist-tags.latest`) untuk nomor versi rilis + pembacaan langsung `package.json`, `node_modules/`, `pnpm-lock.yaml`, `docs/TUMPUKAN-TEKNOLOGI.md`, `AGENTS.md`, `CONSTRAINTS.md`, `README.md`, `CHANGELOG.md`, `docs/AUDIT-KODE.md`.
> **Sumber dokumen yang dibaca (bukan ringkasan):** `README.md`, `AGENTS.md`, `CONSTRAINTS.md`, `CHANGELOG.md`, `docs/TUMPUKAN-TEKNOLOGI.md`, `docs/AUDIT-KODE.md`, `package.json`, `next.config.ts`.

---

## 0. Ringkasan Eksekutif

Tumpukan MathBank **sehat dan hampir seluruhnya mutakhir** untuk garis mayor yang dipilih. Dari ~35 paket yang diperiksa, **hanya 1 lompatan mayor yang belum diambil (TypeScript 5 → 7)** dan **beberapa patch/minor tertinggal 1 langkah** (Next, React, ESLint). Tidak ada paket yang *ditinggalkan* atau *EOL*.

| Kategori | Jumlah |
|---|---|
| ✅ Sudah di versi terbaru (persis) | 24 |
| 🟡 Minor/patch di belakang 1 langkah | 5 |
| 🟠 Lompatan mayor ditunda (sadar/keputusan) | 4 |
| 🔴 Perlu perhatian / inkonsistensi dokumentasi | 2 |

**Tiga temuan terpenting:**
1. **TypeScript 7.0.2 sudah rilis** (port native Go "Corsa") — proyek masih memaku `^5` (5.9.3). Ini lompatan besar dengan perubahan perilaku compiler nyata. Lihat **§4**.
2. **Inkonsistensi dokumentasi vs kode**: `AGENTS.md` menyebut "Base UI headless primitives", tetapi `package.json` memasang **`radix-ui@1.6.7`** (bukan `@base-ui/react`). Lihat **§5**.
3. **Rencana `@tanstack/react-table` tanpa versi** — ekosistem kini di **v9.2.4** (bukan v8). Perlu diputuskan saat M4 tiba. Lihat **§3**.

---

## 1. Metodologi & Sumber Data

Tiga kolom data disandingkan untuk tiap paket:

- **Dipakai (declared)** — rentang di `package.json`.
- **Terpasang (installed)** — versi nyata di `node_modules/` (hasil resolusi lockfile).
- **Terbaru (latest)** — `dist-tags.latest` dari npm registry, per 2026-09-29.

Dokumentasi Context7 dipakai untuk memverifikasi **perubahan perilaku lintas versi** (breaking changes, API baru), bukan untuk nomor versi (Context7 menyajikan docs, bukan dist-tags).

**Catatan keterbatasan Context7:** yang tersedia sebagai tools adalah `resolve-library-id` dan `query-docs`. Context7 menyajikan dokumentasi **versi-spesifik**, dan pada beberapa library (mis. `better-auth`) docs-nya mendahului rilis stabil (menyebut 1.7.5/workspace sementara npm latest = 1.7.6). Nomor versi final di laporan ini karena itu **diverifikasi ulang via npm registry**, bukan diambil mentah dari Context7.

---

## 2. Tabel Perbandingan Lengkap (Fondasi & Data)

### 2.1 Fondasi

| Paket | Dipakai | Terpasang | Terbaru | Status |
|---|---|---|---|---|
| `next` | `16.3.6` (pin) | 16.3.6 | **16.3.7** | 🟡 patch |
| `react` / `react-dom` | `19.2.8` | 19.2.8 | **19.3.0** | 🟡 minor |
| `typescript` | `^5` | 5.9.3 | **7.0.2** | 🟠 **mayor (2 lompatan)** |
| `tailwindcss` / `@tailwindcss/postcss` | `^4` | 4.3.3 | 4.3.3 | ✅ |

### 2.2 Data & Auth

| Paket | Dipakai | Terpasang | Terbaru | Status |
|---|---|---|---|---|
| `drizzle-orm` | `^0.45.3` | 0.45.3 | 0.45.3 | ✅ |
| `drizzle-kit` | `^0.31.11` | 0.31.11 | 0.31.11 | ✅ |
| `postgres` | `^3.4.9` | 3.4.9 | 3.4.9 | ✅ |
| `better-auth` | `^1.7.6` | 1.7.6 | 1.7.6 | ✅ |
| `@better-auth/drizzle-adapter` | `^1.7.6` | 1.7.6 | 1.7.6 | ✅ |
| `@better-auth/api-key` | `^1.7.6` | 1.7.6 | 1.7.6 | ✅ |
| `zod` | `^4.6.5` | 4.6.5 | 4.6.5 | ✅ |
| `yaml` | `^2.9.1` | 2.9.1 | 2.9.1 | ✅ |

### 2.3 UI & Render

| Paket | Dipakai | Terpasang | Terbaru | Status |
|---|---|---|---|---|
| `katex` | `^0.18.9` | 0.18.9 | 0.18.9 | ✅ |
| `@tanstack/react-query` | `^5.104.0` | 5.104.0 | 5.104.0 | ✅ |
| `shadcn` (CLI) | `^4.21.0` | 4.21.0 | 4.21.0 | ✅ |
| `next-themes` | `^0.4.6` | 0.4.6 | 0.4.6 | ✅ |
| `sonner` | `^2.0.8` | 2.0.8 | 2.0.8 | ✅ |
| `cmdk` | `^1.1.1` | 1.1.1 | 1.1.1 | ✅ |
| `lucide-react` | `^1.48.0` | 1.48.0 | 1.48.0 | ✅ |
| `radix-ui` | `^1.6.7` | 1.6.7 | 1.6.7 | ✅ lihat §5 |
| `class-variance-authority` | `^0.7.1` | 0.7.1 | 0.7.1 | ✅ |
| `cn` | `^0.4.0` | 0.4.0 | 0.4.0 | ✅ |
| `tw-animate-css` | `^1.4.0` | 1.4.0 | 1.4.0 | ✅ |

### 2.4 Kualitas & Perkakas

| Paket | Dipakai | Terpasang | Terbaru | Status |
|---|---|---|---|---|
| `vitest` | `^5.0.2` | 5.0.2 | 5.0.2 | ✅ |
| `@vitest/coverage-v8` | `^5.0.2` | 5.0.2 | 5.0.2 | ✅ |
| `@testing-library/react` | `^16.3.3` | 16.3.3 | 16.3.3 | ✅ |
| `jsdom` | `^30.1.1` | 30.1.1 | 30.1.1 | ✅ |
| `@playwright/test` | `^1.63.0` | 1.63.0 | 1.63.0 | ✅ |
| `eslint` | `^9` | 9.39.5 | **10.11.0** | 🟠 mayor |
| `eslint-config-next` | `16.3.6` (pin) | 16.3.6 | **16.3.7** | 🟡 patch |
| `tsx` | `^4.23.15` | 4.23.15 | 4.23.15 | ✅ |
| `@types/katex` | `^0.16.8` | 0.16.8 | 0.16.8 | ✅ |

### 2.5 Paket Rencana (belum dipasang — dicek agar keputusan M4+ siap)

| Paket | Status rilis terbaru | Catatan |
|---|---|---|
| `react-hook-form` | **7.89.0** | ✅ stabil; rencana M4 |
| `@hookform/resolvers` | **5.9.1** | ✅ resolusi Zod v4 butuh `@hookform/resolvers` ≥3.10 (kita jauh di atasnya) |
| `@tanstack/react-table` | **9.2.4** (v9); v8 terakhir 8.21.3 | 🟠 **v9 sudah jadi garis utama** — rencana dokumen tulis "react-table" tanpa versi |
| `nuqs` | **2.10.1** | ✅ rencana M5–M6 |
| `@modelcontextprotocol/sdk` | **1.31.0** | ✅ rencana M11 |

---

## 3. Analisis per Area

### 3.1 Next.js 16 — ✅ tepat, hanya patch

Terpasang 16.3.6, terbaru 16.3.7. Konfigurasi sudah sesuai arah Next 16.

**Verifikasi Context7 (upgrade guide v16):**
- **Turbopack kini default** untuk `next dev` dan `next build` — flag `--turbopack` tak lagi diperlukan. Proyek masih menulis `"dev": "next dev --turbopack"` di `package.json`; ini **tidak salah** (flag diabaikan/masih diterima) tetapi **redundan**. Boleh disederhanakan.
- **Async Request APIs = breaking change keras**: `cookies()`, `headers()`, `draftMode()`, `params`, `searchParams` **wajib di-await**. Proyek di M0–M3 belum menyentuh pola ini secara luas; saat M4 (bank soal) menambah route dinamis, aturan ini harus dipegang.
- `middleware` → **`proxy`** (konvensi baru). `AGENTS.md` sudah menyebut `proxy.ts` ✅.
- Cache Components (`cacheComponents`, `"use cache"`) — disebut di `AGENTS.md`; perlu flag di `next.config.ts` bila dipakai. `next.config.ts` saat ini **kosong** (tanpa flag).

**Aksi:** bump `next` & `eslint-config-next` → 16.3.7; pertimbangkan hapus `--turbopack`; tambahkan flag `cacheComponents` bila `"use cache"` memang akan dipakai.

### 3.2 React 19 — ✅ (19.2.8 → 19.3.0 minor)

React Compiler sudah aktif dan larangan `useMemo`/`useCallback` (`CONSTRAINTS #6`) **sejalan persis** dengan tujuan resmi React Compiler.

**Verifikasi Context7 (compiler DESIGN_GOALS):** tujuan eksplisit compiler adalah *menghapus* kebutuhan `useMemo`/`useCallback`/`React.memo`. Ada flag `enablePreserveExistingMemoizationGuarantees` untuk migrasi bertahap. **Rekomendasi:** naik ke 19.3.0 aman (minor), tak mengubah kontrak compiler.

### 3.3 TypeScript — 🟠 **temuan utama** (5.9.3 vs 7.0.2)

Ini kesenjangan terbesar. Versi terbaru TypeScript adalah **7.0.2** — port native Go (nama kode **"Corsa"**), menggantikan compiler JS lama ("Strada"/TS6).

**Perubahan perilaku nyata (dari Context7, `tsc/CHANGES.md`):**
- **Scanner**: offset UTF-8 byte, bukan UTF-16.
- **Checker**: `--skipLibCheck` kini **melaporkan semua deklarasi yang berkonflik** (dulu bisa diam). Template literal type pakai code point Unicode.
- **Declaration emit** ditulis ulang dari nol.
- **TS 6.0 mendeprekasi opsi** yang akan dihapus di 7.0: `baseUrl`, `moduleResolution: node10/classic`, `target: ES5`, `esModuleInterop: false`, `outFile`, `module: amd/umd/system`, `downlevelIteration`, dll.

**Risiko untuk MathBank:** `tsconfig.json` proyek memakai `"moduleResolution": "bundler"` dan target modern — **aman dari daftar deprekasi**, tetapi lompatan 5→7 tetap harus lewat gerbang `pnpm typecheck` (0 error) dan bisa memunculkan error baru dari aturan checker/skipLibCheck yang lebih ketat.

**Rekomendasi:** **jangan lompat langsung**. (1) Naik ke **TS 5.9.x terakhir** dulu (sudah di sana). (2) Uji di **branch terpisah** dengan `pnpm check` penuh. (3) Baru naik ke 6.x → 7.x bertahap. Ini keputusan arsitektural — sesuai `AGENTS.md` "Zero Silent Assumptions", **ajukan ke user sebelum eksekusi**, jangan lompat diam-diam.

### 3.4 Tailwind v4 & shadcn — ✅ mutakhir

Tailwind 4.3.3 = terbaru. Konfigurasi CSS-first (`@theme`, `@import "tailwindcss"`) sudah dipakai (skrip tema OKLCH).

**Verifikasi Context7 (shadcn CLI):** penting — shadcn kini mendukung **dua basis primitif: Radix UI dan Base UI**. Migrasi `radix-lyra` → Base UI disebut di changelog. Ini mengait ke §5.

### 3.5 Drizzle, Better Auth, Zod, KaTeX, TanStack Query, Vitest — ✅ semua terbaru

- **Drizzle 0.45.3 / drizzle-kit 0.31.11** = terbaru. Pola `drizzle-kit generate` + `migrate` yang dipakai proyek sesuai docs Context7.
- **Better Auth 1.7.6** = terbaru (semua 3 paket). Docs Context7 mengonfirmasi plugin `admin` (custom roles) & `apiKey` — persis pola multi-peran `user_roles` MathBank. Docs menyebut 1.7.5, npm latest 1.7.6 (dokumen tertinggal sedikit; bukan masalah).
- **Zod 4.6.5** = terbaru. Breaking v3→v4 yang relevan: `message` → `error`; `Schema`/`ZodSchema`/`ZodTypeAny` deprekasi → pakai `z.ZodType`. **Cek kode MathBank** agar tak memakai alias lama.
- **KaTeX 0.18.9** = terbaru. Verifikasi keamanan dari Context7: opsi `trust` (handler fungsi) dan `strict` mengontrol perintah/protokol. **Selaras** dengan `CONSTRAINTS #20` (LaTeX `openin_any='p'`) — pastikan `trust` **tidak** dibuka untuk `\includegraphics`/protokol file.
- **TanStack Query 5.104.0** = terbaru; peer dep resmi `react: ^18 || ^19` (React 19 didukung penuh).
- **Vitest 5.0.2** = terbaru; provider coverage default `v8` (proyek pakai `@vitest/coverage-v8` ✅). Garis V4 = 4.1.11, jadi 5.x memang terdepan.

### 3.6 ESLint — 🟠 mayor (9 → 10)

Terpasang 9.39.5; terbaru **10.11.0**. `eslint-config-next` 16.3.6 → 16.3.7. Ini lompatan mayor; ESLint 10 bisa membawa perubahan aturan/plugin. **Aman ditunda**, tetapi catat sebagai utang: rencanakan bump bersama `eslint-config-next` saat stabil.

---

## 4. Prioritas Rekomendasi

| Prio | Aksi | Alasan | Risiko |
|---|---|---|---|
| **P1** | Bump `next` + `eslint-config-next` → 16.3.7 | patch aman, tetap di garis v16 | Rendah |
| **P1** | Bump `react`/`react-dom` → 19.3.0 | minor, compiler tak terpengaruh | Rendah |
| **P2** | **TypeScript 5 → 7** di branch terpisah, bertahap (5→6→7), lewat `pnpm check` | versi terbaru = TS7 native; perubahan checker nyata | **Menengah–Tinggi** — wajib checkpoint user |
| **P2** | Putuskan **react-table v8 vs v9** sebelum M4 | v9 = garis utama (9.2.4); rencana dokumen tanpa versi | Menengah (undecided) |
| ~~**P2**~~ | ~~Selesaikan Radix UI vs Base UI (§5)~~ → **✅ DONE** via [`ADR-0008`](ADR/0008-basis-ui-base-ui.md): `@base-ui/react` dipakai, `radix-ui` dihapus | — | — |
| **P3** | Bump `eslint` 9 → 10 | mayor, tak mendesak | Menengah |
| **P3** | Hapus `--turbopack` dari skrip `dev`; tambah flag `cacheComponents` bila `"use cache"` dipakai | Next 16 default Turbopack; cache components butuh flag | Rendah |
| **P3** | Audit kode Zod: pastikan tak pakai `message`/`ZodSchema` lama | migrasi Zod v4 | Rendah |

---

## 5. ✅ (SELESAI) Inkonsistensi Dokumentasi — Radix UI vs Base UI → **Base UI**

**Temuan:** `AGENTS.md` menyatakan arsitektur UI = **"Base UI headless primitives + shadcn/ui"**, tetapi `package.json` memasang **`radix-ui@1.6.7`** dan **tidak** memasang `@base-ui/react`. `TUMPUKAN-TEKNOLOGI.md` §M3 juga menulis paket `class-variance-authority`, `clsx`, `tailwind-merge` (buildup Radix/shadcn klasik).

Context7 mengonfirmasi **keduanya kini didukung shadcn** (varian `radix` dan `base-ui`; migrasi `radix-lyra`→Base UI terdokumentasi). Jadi ini **bukan** salah satu yang usang — ini **ambiguitas keputusan**.

**Dampak:** perbedaan arahan (dokumen bilang Base UI, kode pakai Radix) berpotensi membingungkan agent/contributor berikutnya dan menggandakan dependensi (Radix + Base UI bisa hidup berdampingan saat migrasi — Context7 menyarankan keduanya boleh koeksis). Bertentangan dengan `AGENTS.md` sendiri: *"Zero Silent Assumptions."*

**Aksi:** **ratifikasi satu basis.** Salah satu:
- (a) Tetapkan **Radix UI** sebagai basis (sesuai kode saat ini) → perbarui `AGENTS.md`.
- (b) Rencanakan **migrasi ke Base UI** → jadwalkan eksplisit + update dokumen.

**Jangan** dibiarkan sebagai ambiguitas diam.

---

## 6. Konfirmasi Keselarasan dengan Dokumen Proyek

| Prinsip dokumen | Status vs versi terbaru |
|---|---|
| `CONSTRAINTS #5` "install saat milestonenya tiba" | ✅ dipatuhi — paket M4+ (react-hook-form, react-table, nuqs, MCP SDK) **belum** dipasang |
| `CONSTRAINTS #6` larangan `useMemo`/`useCallback` | ✅ persis tujuan React Compiler resmi |
| `AGENTS.md` "Next 16 + Turbopack + proxy.ts + use cache" | ✅ arah benar; `proxy.ts` & Turbopack sesuai konvensi v16 |
| `AGENTS.md` "Base UI" | 🔴 **tidak cocok** dengan `radix-ui` terpasang (§5) |
| `TUMPUKAN-TEKNOLOGI.md` "🚫 openai SDK" | ✅ tetap benar — M10 panggil endpoint via `fetch` |
| `TUMPUKAN-TEKNOLOGI.md` "Better Auth sudah dipilih" | ✅ terbaru (1.7.6) & plugin sesuai kebutuhan multi-peran |

---

## 7. Penutup

Tumpukan MathBank **secara keseluruhan kompetitif dan hampir sepenuhnya di ujung terbaru**. Tidak ada dependency usang/EOL. Yang perlu perhatian hanyalah **(1) lompatan TS 7** (keputusan besar, butuh checkpoint), **(2) ambiguitas Radix vs Base UI**, dan **(3) beberapa bump patch/minor** yang mudah. Prinsip "pasang saat perlu" di `CONSTRAINTS #5` terbukti **dipatuhi** — tidak ada dependency bloat.

> **Status:** laporan ini **review**, bukan eksekusi upgrade. Sesuai `AGENTS.md` (Zero Silent Assumptions), bump mayor (TS 7, ESLint 10, react-table 9, Radix→Base UI) **wajib dikonfirmasi user lebih dulu**.

---

*Dihasilkan via Context7 MCP + verifikasi npm registry, 2026-09-29.*
