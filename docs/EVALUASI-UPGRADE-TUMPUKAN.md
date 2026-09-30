# EVALUASI — Aksi Upgrade Tumpukan (P1/P2/P3)

> **Tanggal:** 2026-09-30 · **Metode:** data nyata (`node_modules`, `npm view`, waktu
> eksekusi terukur) + riset sumber primer (blog TS 7 GA, catatan kompatibilitas Next).
> **Konteks:** menindaklanjuti `docs/REVIEW-TUMPUKAN-TEKNOLOGI.md` §4 (P1–P3).
> **Sifat:** **evaluasi** — rekomendasi, bukan eksekusi (CONSTRAINTS #2).

---

## 0. Data Dasar (terukur, 2026-09-30)

| Paket | Terpasang | Terbaru | Jarak |
|---|---|---|---|
| `next` | 16.3.6 | **16.3.7** | patch |
| `eslint-config-next` | 16.3.6 | 16.3.7 | patch |
| `react` / `react-dom` | 19.2.8 | **19.3.0** | minor |
| `typescript` | **5.9.3** | **7.0.2** | **2 mayor** |
| `eslint` | 9.39.5 | **10.11.0** | **mayor** |

**Ukuran proyek:** **18.465 LOC** (kecil–menengah). **Baseline waktu terukur:**
`tsc --noEmit` = **3,5 dtk** · `eslint .` = **8,0 dtk** · `vitest run` = **10,2 dtk**.

**Fakta kunci toolchain:** `eslint-config-next@16.3.6` menarik
**`typescript-eslint@^8.46`** → memakai **TS JS API** (bukan hanya `tsc`).

---

## 1. P1 — Bump patch/minor (`next` 16.3.7, `react` 19.3.0, `eslint-config-next` 16.3.7)

### Fakta
- Semua **patch/minor**, di **garis mayor yang sama** (16.x / 19.x).
- Next 16.3.7 & eslint-config-next 16.3.7 = patch rilis; `peerDependencies.react` Next = `^18.2.0 || ^19.0.0` → React 19.3.0 **cocok**.
- Tidak menyentuh konfigurasi (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`).

### Tradeoff

| | Melakukan | Tidak melakukan |
|---|---|---|
| **Manfaat** | Patch bug/keamanan Next; React 19.3.0 perbaikan minor; tetap "hijau" di review | Nol risiko sekarang |
| **Risiko** | Sangat rendah — tetapi **setiap bump bisa memunculkan perubahan perilaku** (Next patch kadang mengubah default) | Perlahan tertinggal patch; akumulasi nanti lebih berisiko |
| **Biaya** | ~5 mnt (bump + gate penuh + build + smoke) | 0 |
| **Reversibilitas** | Mudah (revert `package.json`/lock) | — |

**Rekomendasi: ✅ LAKUKAN** — murah, aman, dan **memang praktik terbaik** menjaga patch terbaru. Wajib lewat gate penuh (tsc/lint/test/build/smoke) sebagai jaring.

**✅ SUDAH DIKERJAKAN (2026-09-30, branch `chore/bump-p1-patch`):** `next` 16.3.7 ·
`react`/`react-dom` 19.3.0 · `eslint-config-next` 16.3.7. **Gate penuh HIJAU:** tsc 0,
lint 0, 274 unit, 90 DB, build 0 (30/30), health 200, smoke ✅.

---

## 2. P2 — TypeScript 5 → 7 (Project Corsa, native Go)

### Fakta (sumber primer)
- **TS 7.0 GA** 8 Jul 2026; compiler **di-port ke Go**, ~**10x lebih cepat**; **type system TIDAK berubah**.
- **Dua batasan besar:**
  1. **Tanpa public compiler API** (7.0). API baru (berbeda) menyusul di **7.1**.
  2. **Tanpa `--watch`** di 7.0 (menyusul 7.1).
- **Ekosistem yang butuh API TIDAK bisa pakai TS 7:** Vue/Volar, Svelte, Astro, MDX, Angular, **`ts-node`/`ts-jest`/`ts-morph`**.
- **Next.js:** "bekerja untuk build, tetapi **integrasi native penuh menyusul**" — Next **memakai `typescript` sebagai library** (`next/dist/lib/typescript/*`: `getTypeScriptConfiguration`, `loadTsConfig`, diagnostic formatter), jadi **TS 7 tidak otomatis mempercepat pipeline Next** dan **berisiko** pada jalur itu.

### Kenapa keuntungannya KECIL di MathBank
Speedup 10x itu untuk **1,5 juta baris** (VS Code 125,7s→10,6s). MathBank **18k LOC** →
`tsc --noEmit` **sudah 3,5 dtk**. Win realistis: **mungkin ~3 dtk** — **tak signifikan**,
sementara **`eslint-config-next` → `typescript-eslint@8`** (butuh API) **berisiko rusak**.

### Tradeoff

| | Naik ke TS 7 (langsung) | Tetap TS 5.9 + uji di branch |
|---|---|---|
| **Manfaat** | `tsc` sedikit lebih cepat (kecil di repo ini); masa depan | Nol gangguan; semua tool aman |
| **Risiko** | **Menengah–Tinggi**: `typescript-eslint` (lint bisa mati), editor LS, Next TS plugin; `--watch` hilang | Tertinggal; belum siap saat ekosistem pindah |
| **Biaya** | Bump + **uji lint** + verifikasi editor + kemungkinan tunggu 7.1 | Selangkah demi selangkah (5→6→7) di branch |
| **Reversibilitas** | Sedang (bisa balik, tapi lint rusak = hambatan) | Tinggi |

**Rekomendasi: ⛔ TUNDA.** Bukan karena "menyerah", tetapi karena **rasio manfaat/risiko
Buruk** di sini: untung kecepatan **kecil** (repo kecil), risiko **lint/editor/Next** nyata,
dan **7.1** akan menutup celah API (yang membuka `typescript-eslint`). **Jalan yang benar
saat siap:** TS **6.x dulu** (jembatan deprekasi → hard error di 7), di **branch terpisah**,
setelah **7.1** (API+watch) & `typescript-eslint` mengumumkan dukungan TS 7.

---

## 3. P3 — ESLint 9 → 10

### Fakta
- **Mayor** (9→10). Proyek pakai **flat config** (`eslint.config.mjs`) — arah yang benar untuk ESLint 10.
- Terikat `eslint-config-next@16.3.7` (yang menarik `typescript-eslint@8`).
- `eslint .` **8,0 dtk** — memakan waktu gate; tak ada keluhan perilaku.

### Tradeoff

| | Naik 10 | Tetap 9 |
|---|---|---|
| **Manfaat** | Utang terbayar; fitur/aturan baru | Stabil; ekosistem plugin sudah matang untuk 9 |
| **Risiko** | **Menengah**: plugin/`@typescript-eslint` harus mendukung ESLint 10; perubahan aturan bisa memunculkan error baru | Tertinggal (mayor) |
| **Biaya** | Bump + perbaiki kemungkinan lint error | 0 |
| **Reversibilitas** | Sedang | — |

**Rekomendasi: 🟡 TUNDA (ikuti ekosistem).** ESLint **10 masih sangat baru**; `typescript-eslint@8`
& `eslint-config-next` belum tentu resmi mendukungnya. **Tunggu** sampai `eslint-config-next`
mengumumkan dukungan ESLint 10 (kemungkinan di rilis 16.x berikutnya), lalu bump **bersamaan**.

---

## 4. P2b — `@tanstack/react-table` v8 vs v9 (sebelum M4)

### Fakta
- Paket **belum dipasang** (CONSTRAINTS #5 dipatuhi). **M4 sudah lewat** tanpa react-table.
- Ekosistem kini di **v9**; v8 terakhir 8.21.3. Rencana dokumen menulis "react-table" **tanpa versi**.

### Tradeoff
Tak ada biaya/risiko sekarang (belum dipakai). **Keputusan sebaiknya ditunda ke saat M8/M9
(daftar/tabel cetak)** — pilih **v9** (garis utama) saat itu, verifikasi kompatibilitas React 19.

**Rekomendasi: ⏸️ PUTUSKAN SAAT DIBUTUHKAN** (sekarang tak ada pemicu).

---

## 5. Ringkasan Rekomendasi

| Prio | Aksi | Verdict | Alasan inti |
|---|---|---|---|
| **P1** | Bump `next`/`react`/`eslint-config-next` patch/minor | ✅ **SELESAI** (2026-09-30) | Murah, aman, praktik terbaik |
| **P2** | TypeScript 5 → 7 | ⛔ **TUNDA** | Untung kecil (repo kecil), risiko lint/editor/Next; tunggu 7.1 |
| **P3** | ESLint 9 → 10 | 🟡 **TUNDA** | Tunggu `eslint-config-next` dukung ESLint 10 |
| **P2b** | react-table v8/v9 | ⏸️ **NANTI** | Belum dipakai; pilih **v9** saat M8/M9 |

**Prinsip:** "ikuti praktik terbaik" **bukan** "selalu versi terbaru". Praktik terbaik =
naik bila **manfaat > risiko** untuk **konteks repo ini**, dengan **jaring gate penuh**.
Di repo 18k LOC, TS 7 = **optimasi yang tidak menyelesaikan masalah yang kita punya**.

---

## 6. Fakta tambahan yang ditemukan saat evaluasi

- **CONSTRAINTS #6 (larangan `useMemo`/`useCallback`) MENYEBUT alasan "React Compiler",
  padahal React Compiler TIDAK terpasang/tidak aktif** (`reactCompiler` tak ada di
  `next.config.ts`; paket `react-compiler` tak ada). Aturan **dipatuhi** (0 pemakaian nyata),
  tetapi **alasannya kini tidak akurat**. → Perlu dikoreksi (dua opsi: aktifkan React
  Compiler, atau ubah alasan #6 menjadi gaya/konsistensi).

*Lihat juga: `docs/REVIEW-TUMPUKAN-TEKNOLOGI.md`, `CONSTRAINTS.md`, `docs/TUMPUKAN-TEKNOLOGI.md`.*
