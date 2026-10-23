# MAT-148 — Independent Verification (Hafiz)

**Tanggal:** 2026-10-23
**Verifier:** Hafiz (Performance & Integration Verifier)
**Repo:** `/home/hari/projects/mathbank` (bukan `axiom` — lihat §0)
**Baseline terverifikasi:** `paperclip/dev` @ `847798f` (worktree bersih: `/home/hari/projects/mathbank-verify`)
**Server:** `next dev --port 3220` (dev Turbopack, DB `localhost:5433/mathbank`, akun demo `guru`)

## 0. Koreksi lokasi repo

Issue verifikasi menyebut `src/app/(ui)/questions/**` (struktur repo `axiom`). Implementasi
MAT-148 **tidak ada** di `axiom`; ia ada di `mathbank` pada `src/app/(app)/questions/**` +
`src/components/questions/**`. Verifikasi ini dijalankan di `mathbank`, sesuai catatan Ichsan
di issue MAT-148. Di `axiom`, `pnpm typecheck` masih gagal karena berkas uji WIP
(`editor-model-mat148.test.ts`, `question-editor.test.tsx`) menunjuk modul yang tak ada —
artefak salinan, bukan deliverable.

## 1. Build & type safety — **MERAH** (di luar lingkup MAT-148)

```
$ node_modules/.bin/next build          # HEAD 847798f
✓ Compiled successfully in 75s
  Running TypeScript ...
31 error TS  →  Failed to type check.   BUILD_EXIT=1
```

Sebaran 31 error (tidak satu pun dari berkas MAT-148):

| Berkas | Error | Pemilik |
| --- | --- | --- |
| `src/lib/ingest/parsers/adapters/payload-contract.test.ts` | 22 | Taufiq (MAT-147, `4b51546`) |
| `src/lib/ingest/commit.ts` | 3 | Taufiq (MAT-147, `4b51546`) |
| `src/components/reference/labels-view.test.tsx` | 4 | test reference (MAT-135, `924385a`) |
| `scripts/r4-batch12-rationale.ts`, `scripts/r5-batch7-rubrik.ts` | 2 | pipeline konten (MAT-35, `847798f`) |

`tsc --noEmit` standalone menambah 2 error `Cannot find name 'LayoutProps'`
(`src/app/layout.tsx`, `src/app/(app)/layout.tsx`) — artefak `.next/types` belum
di-generate, hilang saat `next build`. Total standalone: 33.

**Konsekuensi:** `pnpm build`/`next start` tidak bisa dipakai → verifikasi hidrasi
mode **produksi** tidak dapat dijalankan. Hidrasi diverifikasi di dev Turbopack
(mode paling galak untuk mismatch) — lihat §3.

## 2. Multi-viewport — **HIJAU**

`documentElement.scrollWidth === clientWidth` di seluruh kombinasi (15/15), tanpa
overflow horizontal 1px pun.

| Rute | 360px | 768px | 1280px |
| --- | --- | --- | --- |
| `/questions` | 360=360 | 768=768 | 1280=1280 |
| `/questions/new` | 360=360 | 768=768 | 1280=1280 |
| `/questions/{matrix}` | 360=360 | 768=768 | 1280=1280 |
| `/questions/{matching}` | 360=360 | 768=768 | 1280=1280 |
| `/questions/{matrix}/edit` | 360=360 | 768=768 | 1280=1280 |

Soal uji: `matrix_grid 01a166ab-f8eb-7b1a-8df5-de4611cb3f98`,
`matching 01a166ab-f7e1-7ace-9c0f-fece38f0f250` (dibuat lewat API, lihat §5).

## 3. Hidrasi & konsol — **HIJAU (dev mode)**

`page.on('console')` + `page.on('pageerror')` menangkap **0 error, 0 warning, 0 pageerror**
di 15 kombinasi rute × viewport. Tidak ada `Hydration failed because…`,
`Text content does not match…`, maupun `console.error` Base UI
(`A component that acts as a button expected a native <button>` sudah hilang).

Batas kejujuran: ini **dev Turbopack**, bukan `next start`. Verifikasi hidrasi
produksi menunggu §1 hijau.

## 4. Touch target (pointer kasar, 360px) — **HIJAU** untuk kontrol baru

| Kontrol | Ukuran | Status |
| --- | --- | --- |
| Tombol kunci matriks “Benar” | 56×44 | PASS |
| Tombol kunci matriks “Salah” | 54×44 | PASS |
| Hapus pernyataan | 44×44 | PASS |
| Tambah pernyataan | 280×44 | PASS |
| Hapus premis / respons | 44×44 | PASS |
| Tambah premis / respons | 280×44 | PASS |
| Select pasangan menjodohkan | 262×44 | PASS |
| Hapus jawaban diterima | 44×44 | PASS |
| Tambah variasi jawaban | 280×44 | PASS |

Catatan Low: `<input>` teks di dalam baris matriks 262×29 dan kolom premis/respons
228×32 — di bawah 44px tinggi (tidak termasuk kriteria tombol/select issue ini,
tapi relevan WCAG 2.5.8).

Regresi historis: pada commit `d421921` tombol-tombol ini masih 28px
(`Kunci…: Benar` 56×28, `Hapus pernyataan` 28×28, `Tambah pernyataan` 280×28).
Perbaikan masuk di commit setelahnya; karena itu baseline verifikasi = `HEAD`, bukan `d421921`.

## 5. Smoke CRUD 6 tipe lewat API nyata — **HIJAU**

`POST /api/questions` → `PATCH` → `GET /api/questions/{id}` → `DELETE`:

| Tipe | POST | PATCH | GET | DELETE | Round-trip |
| --- | --- | --- | --- | --- | --- |
| `single_choice` | 201 | 200 | 200 | 200 | `dataPayload.type=multiple_choice`, 2 opsi, `answerKey.correctOptionIds="A"` |
| `multiple_choice_checkbox` | 201 | 200 | 200 | 200 | — |
| `matching` | 201 | 200 | 200 | 200 | `premises 2 / responses 2 / matchingPairs {p1:r1,p2:r2}` |
| `matrix_grid` | 201 | 200 | 200 | 200 | `rows 2 / labels [Benar,Salah] / answers [Benar,Salah]` |
| `short_answer` | 201 | 200 | 200 | 200 | — |
| `essay` | 201 | 200 | 200 | 200 | — |

Tidak ada `422` untuk payload kanonik, tidak ada `undefined is not iterable`.
Satu `422` yang muncul hanya karena data uji pertama saya memakai
`distractorRationale` < 40 karakter — gerbang mutu bekerja sebagaimana mestinya
(bukan cacat).

## 6. Kontrak baca JSONB (zero join) — **HIJAU**

- Detail matriks merender baris dari `dataPayload.rows` (2 baris, 2 node KaTeX).
- Detail menjodohkan merender premis+respons dari `dataPayload.premises|responses`
  (6 node KaTeX). Pada `d421921` halaman ini **hanya menampilkan stem** —
  `MatchingView` baru masuk setelahnya, jadi bukti ini hanya sah untuk `HEAD`.
- Editor (`/questions/{id}/edit`) prefill dari JSONB: tipe `matrix_grid`,
  10 input berisi `$2+2=4$`, `$3+3=7$`, pembahasan, jenjang, kesulitan, kognitif.

## 7. CLS (initial load) — **HIJAU kecuali 2 sel**

| Rute | 360 | 768 | 1280 |
| --- | --- | --- | --- |
| `/questions` | 0 | 0 | 0 |
| `/questions/new` | 0 | 0 | **0.0116** |
| `/questions/{matrix}` | 0 | 0 | 0 |
| `/questions/{matching}` | 0 | 0 | 0 |
| `/questions/{id}/edit` | 0 | 0 | **0.0119** |

Target issue “CLS = 0”. Dua sel desktop 0.0116/0.0119 berasal dari form editor
(bukan shell), jauh di bawah ambang “good” 0.1, tapi bukan nol → dicatat Low.

## 8. Unit test lingkup

```
$ vitest run src/components/questions src/app/(app)/questions
Test Files  8 passed (8)
     Tests  101 passed (101)
```

## 9. Verdict

| Domain | Hasil |
| --- | --- |
| Multi-viewport 360/768/1280 (5 rute) | PASS 15/15 |
| Hidrasi/konsol (dev) | PASS 0 error |
| Touch target kontrol baru | PASS (input teks 29–32px → Low) |
| Smoke CRUD 6 tipe | PASS 6/6 |
| Kontrak baca JSONB | PASS |
| CLS initial load | PASS kecuali 2 sel 0.0116/0.0119 (Low) |
| `pnpm build` bersih | **FAIL — 31 error TS, 0 dari berkas MAT-148** |
| Hidrasi mode produksi (`next start`) | **TIDAK BISA DIJALANKAN** (butuh build hijau) |

**MAT-148 lolos verifikasi fungsional.** Gerbang build masih merah karena
pekerjaan MAT-147 (ingest) dan dua berkas test/script lain; defect diteruskan
ke Taufiq.
