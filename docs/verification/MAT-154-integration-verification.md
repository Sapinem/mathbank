# MAT-154 — Verifikasi Integrasi MAT-148 (build, hidrasi, multi-viewport, 5 tipe)

**Verifier:** Hafiz (Performance & Integration Verifier)
**Tanggal:** 2026-10-23
**Target yang benar-benar diverifikasi:** `/home/hari/projects/mathbank`, branch `paperclip/dev`, HEAD `2dfa689` + working tree (24 file WIP), tempat MAT-148 mendarat (commit `d421921`).
**Catatan penting:** MAT-148 **tidak ada** di `/home/hari/projects/axiom` (tidak ada `src/components/question-editor.tsx`, tidak ada kolom `data_payload`). Verifikasi awal di `axiom` karena itu hanya menghasilkan baseline shell; semua angka MAT-148 di dokumen ini berasal dari `mathbank`.

## 1. Ringkasan verdict

| Domain | Hasil | Bukti |
| --- | --- | --- |
| Build aplikasi (`next build`) | **PASS untuk `src/`** — compiled + TypeScript selesai, 0 warning. Build **gagal** hanya karena 3 file `scripts/` (lihat D-2) | `/tmp/mb-build7.log` |
| Type safety `src/` | **PASS** — 0 error TS di `src/**` | `tsc --noEmit` (9 error, semuanya di `scripts/`) |
| Hidrasi | **PASS** — 12/12 sel (4 rute × 3 viewport): 0 `console.error`, 0 `pageerror`, 0 teks hydration-mismatch, React-owned node > 0 (tidak vacuous) | `perf-mat154-audit.mjs` |
| Multi-viewport | **PASS** — `scrollWidth - clientWidth = 0` di 360/768/1280 px pada `/questions`, `/questions/[id]`, `/questions/new`, `/questions/[id]/edit` | idem |
| CLS initial load | **PASS** — 0.0000 di 10/12 sel; 0.0087 di `desktop:new` & `desktop:edit` (jauh di bawah ambang 0.1) | idem |
| Touch target kontrol MAT-148 | **PASS** — 0 pelanggaran 44×44 pada panel tipe (kunci matriks, pasangan menjodohkan, tambah/hapus baris, variasi jawaban) | `perf-mat154-mb-editor.mjs` |
| Touch target kontrol metadata editor | **FAIL (D-1)** — 5–6 `SelectTrigger` (Tipe soal, Jenjang, Kesulitan, Level kognitif, Wacana stimulus, conceptual) 280×32 px di 360 px | idem |
| Switch 6 tipe jawaban | **PASS** — tanpa `pageerror` / `undefined is not iterable`; field tiap tipe muncul | idem |
| Smoke simpan draf 6 tipe | **PASS** — 6/6 `POST /api/questions` → **201**, tanpa 422; draf uji dihapus kembali | `perf-mat154-mb-save.mjs` |
| KaTeX overflow isolation | **PASS** — 17 node `.katex`, 0 keluar dari parent, 0 overflow dokumen di 3 viewport | `perf-mat154-katex.mjs` |
| Unit test MAT-148 | **PASS** — 14/14 (`question-editor.test.tsx`, `matrix-grid-view.test.tsx`) | `vitest run` |

## 2. Perintah & keluaran

### 2.1 Build (`mathbank`)
```
$ ./node_modules/.bin/next build
▲ Next.js 16.3.8 (Turbopack)
✓ Compiled successfully in 955ms
  Running TypeScript ...
  Finished TypeScript in 4.7s ...
Route (app)
├ ƒ /questions
├ ƒ /questions/[id]
├ ƒ /questions/[id]/edit
├ ƒ /questions/new
BUILD_EXIT=0
```
Dijalankan pada salinan kerja identik dengan `mathbank` (`.env`, `src/`, config, `node_modules` disalin) **tanpa tiga file `scripts/`** yang memang sudah merah (D-2). Di tree asli, `pnpm build` berhenti di fase TypeScript pada file-file itu — bukan pada `src/`.

### 2.2 Hidrasi + multi-viewport (`perf-mat154-audit.mjs`)
```
mobile:list   ok /questions                                    ovf 0 cls 0
mobile:detail ok /questions/01a15d63-…                         ovf 0 cls 0
mobile:new    ok /questions/new                                ovf 0 cls 0
mobile:edit   ok /questions/01a15d63-…/edit                    ovf 0 cls 0
tablet:*      ok (4 rute)                                      ovf 0 cls 0
desktop:list  ok                                               ovf 0 cls 0
desktop:detail ok                                              ovf 0 cls 0
desktop:new   ok                                               ovf 0 cls 0.0087
desktop:edit  ok                                               ovf 0 cls 0.0087
```
Tiap sel juga mencatat `reactOwnedNodes` > 0 (hidrasi benar-benar terjadi) dan `inertRoutes: []`.

### 2.3 Editor 6 tipe (`perf-mat154-mb-editor.mjs`, 360 px coarse pointer)
| Tipe | Switch | Field khas terdeteksi | Pelanggaran 44×44 di panel tipe | pageerror |
| --- | --- | --- | --- | --- |
| `single_choice` | OK | kunci opsi A–E, isi opsi, alasan pengecoh | 0 | 0 |
| `complex_multiple_choice` | OK | idem (multi-centang) | 0 | 0 |
| `matching` | OK | kolom premis/respons, pasangan premis↔respons | 0 | 0 |
| `matrix_grid` | OK | pernyataan, kunci pernyataan B/S, tambah baris | 0 | 0 |
| `short_answer` | OK | jawaban diterima, rubrik | 0 | 0 |
| `essay` | OK | rubrik penilaian | 0 | 0 |

### 2.4 Smoke simpan draf
```
single_choice            POST /api/questions 201
complex_multiple_choice  POST /api/questions 201
matching                 POST /api/questions 201
matrix_grid              POST /api/questions 201
short_answer             POST /api/questions 201
essay                    POST /api/questions 201
```
Payload draf yang terkirim untuk `single_choice` (progressive typing bekerja — `type` absen saat struktur belum lengkap, jadi tidak kena 422):
```json
{"dataPayload":{"options":[],"shuffleOptions":true},"status":"draft","questionType":"single_choice"}
```
Keenam baris uji (`content_markdown like 'Draf verifikasi MAT-154%' / 'MAT-154-VERIFY%'`) sudah dihapus; `select count(*)` = 0.

### 2.5 KaTeX (`perf-mat154-katex.mjs`, soal `01a115ed-58c8-…`)
```
mobile  katex 17  escape []  docOvf 0  parentScroll 0
tablet  katex 17  escape []  docOvf 0  parentScroll 0
desktop katex 17  escape []  docOvf 0  parentScroll 0
```

### 2.6 Unit test MAT-148
```
$ vitest run src/components/questions/question-editor.test.tsx src/components/questions/matrix-grid-view.test.tsx
Test Files  2 passed (2)
     Tests  14 passed (14)
```

## 3. Baseline di `/home/hari/projects/axiom` (bukan MAT-148)

| Perintah | Hasil |
| --- | --- |
| `pnpm typecheck` | 0 error (setelah 3 file spec MAT-148 yang menggantung dipindah ke `docs/specs/mat-148/*.txt`) |
| `pnpm lint` | 0 error, 0 warning |
| `pnpm build` | 0 error, 0 warning (`next build` sempat berhenti sekali karena nudge advisory keamanan Next.js, lolos pada retry) |
| `pnpm gate:continuous` | **CONTINUOUS GATES: green** (7 gate) |
| `pnpm db:verify` | `Schema OK — no drift from the committed migrations` (16 tabel, 3 CHECK, 7 unique index) |
| `pnpm test` | **1 gagal / 1983**: `src/app/api/bundles/route.test.ts` → `expected 500 to be 200` |
| Audit hidrasi 4 rute × 3 viewport | 12/12 bersih, 0 overflow, CLS ≤ 0.0045 |
| Shell geometry (`perf-mat154-shell.mjs`) | 360: rail `display:none`, hamburger 44×44, drawer 270 px (D-3), 0 kontrol < 44, Esc menutup; 768: rail 64 px; 1280: 240↔64↔240, konten reflow; `prefers-reduced-motion`: CLS 0 |
| Dark mode (`perf-mat154-theme.mjs`) | Tidak ada FOUC: `data-theme="dark"` sudah ada saat DOMContentLoaded, bg konstan `rgb(15,23,42)`, 0 flip, toggle bolak-balik bersih |

## 4. Defect

### D-1 — Touch target kontrol metadata editor 32 px
- **Severity:** Medium
- **Domain:** Layout (a11y)
- **Repos:** mathbank (`src/components/questions/question-editor.tsx`, kolom metadata)
- **Evidence:** `perf-mat154-mb-editor.mjs` @360 px `hasTouch`: `Tipe soal`, `Jenjang`, `Kesulitan`, `Level kognitif`, `Wacana stimulus induk`, `conceptual` → semua 280×32 px (6 pelanggaran untuk tipe PG, 5 untuk tipe lain).
- **Expected:** ≥44×44 pada pointer kasar (project floor).
- **Actual:** 32 px tinggi.
- **Assign to:** Ichsan

### D-2 — Build `mathbank` merah karena 3 file `scripts/`
- **Severity:** High (memblokir gate build repo)
- **Domain:** Build
- **Evidence:** `pnpm typecheck` di tree asli → 22 error, semua `scripts/r5-batch2.ts` (syntax: unterminated string). Tanpa file itu, `next build` masih gagal di `scripts/mat35-audit-state.ts` (8 error `RowList.rows`) dan `scripts/r5-essay-rubric-batch1.ts` (1 error cast).
- **Expected:** `pnpm build` hijau.
- **Actual:** build berhenti di fase TypeScript; `src/**` sendiri bersih.
- **Assign to:** Taufiq (pemilik script batch/ingest)

### D-3 — Lebar drawer mobile 270 px, bukan `min(360px, 85vw)` = 306 px
- **Severity:** Low
- **Domain:** Layout
- **Repos:** axiom (`src/components/ui/sheet.tsx` + `mobile-nav.tsx`)
- **Evidence:** `perf-mat154-shell.mjs` @360: `drawer.width = 270`, dokumentasi komponen menyebut `min(360px,85vw)`. Penyebab: varian `data-[side=left]:w-3/4` (spesifisitas lebih tinggi) mengalahkan `w-[min(360px,85vw)]`.
- **Expected:** 306 px.
- **Actual:** 270 px (75 vw).
- **Assign to:** Ichsan

### D-4 — Test `bundles` route gagal di axiom
- **Severity:** Low
- **Domain:** Gate/Test
- **Evidence:** `pnpm test` → 1 gagal/1983: `src/app/api/bundles/route.test.ts:87 expected 500 to be 200`.
- **Assign to:** Salman (backend) / pemilik route bundles

## 5. Artefak
- `scripts/perf-mat154-audit.mjs` — hidrasi + overflow + CLS + touch target 4 rute × 3 viewport (axiom repo).
- `scripts/perf-mat154-mb-editor.mjs` — switch 6 tipe + ukur kontrol + simpan draf (mathbank).
- `scripts/perf-mat154-mb-save.mjs` — round-trip simpan draf per tipe.
- `scripts/perf-mat154-katex.mjs` — isolasi overflow KaTeX.
- `scripts/perf-mat154-shell.mjs` — geometri shell 360/768/1280 + reduced motion.
- `scripts/perf-mat154-theme.mjs` — probe FOUC dark mode.
