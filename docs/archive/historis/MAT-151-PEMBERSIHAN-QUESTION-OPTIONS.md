# MAT-151 — Pembersihan Sisa Referensi `question_options`

**Status:** selesai · **Konteks:** tindak lanjut MAT-146 (drop tabel `question_options`, migrasi opsi ke `questions.data_payload.options` JSONB).

Dokumen ini mencatat skrip yang **dihapus** karena masih memakai tabel relasional
`question_options`, beserta penggantinya. Semua file tetap dapat dipulihkan dari
riwayat git (`git log --diff-filter=D --name-only`), jadi penghapusan bersifat
arsip, bukan kehilangan data.

---

## 1. Invarian skema (`pnpm db:verify`)

| Item | Sebelum | Sesudah | Alasan |
|------|---------|---------|--------|
| `EXPECTED.tables` | 26 | **25** | `question_options` di-drop di `drizzle/0017` |
| `EXPECTED.triggers` | 24 | **23** | `trg_question_options_updated_at` ikut terhapus |
| `EXPECTED.fks` (restore-check) | 20 | **19** | FK `question_options.question_id` hilang |
| `EXPECTED.indexes` (restore-check) | 80 | **78** | PK + `idx_question_options_question` hilang |

`db-verify.ts` kini juga punya **invarian negatif**: `FORBIDDEN_TABLES = ["question_options"]`.
Bila tabel itu muncul kembali (mis. dump lama ter-restore), verifikasi **gagal**
dengan pesan `tabel terlarang masih ada: question_options`.

`restore-check.mjs` mengganti baris `rows:question_options` dengan invarian turunan
`rows:questions_with_options` (menghitung soal hidup yang `data_payload.options`
tidak kosong), sehingga latihan restore tetap membuktikan opsi ikut pulih.

## 2. Skrip yang di-port ke JSONB (tetap dipakai)

| Skrip | Perubahan |
|-------|-----------|
| `scripts/seed-questions.ts` (`pnpm seed:questions`) | Opsi ditulis ke `data_payload.options` (`{id,label,contentMarkdown}`); tidak ada lagi `DELETE`/`INSERT` ke tabel opsi |
| `scripts/audit-pedagogy.ts` (audit MAT-33/35) | Seluruh 20 query memakai CTE `opt` yang membaca `data_payload.options` + `answer_key.correctOptionIds`; bentuk kolom dipertahankan (`label`, `content_markdown`, `distractor_rationale`, `is_correct`) agar angka laporan lama tetap sebanding |
| `scripts/distribute-difficulty.ts` | `option_count` dari `jsonb_array_length(data_payload->'options')` (dengan guard `jsonb_typeof`), bukan `LEFT JOIN question_options` |
| `scripts/probe-db-state.ts` | Probe tabel opsi dihapus; cakupan opsi dibaca dari `data_payload.options` |
| `scripts/r2-extract-rationale-jsonb.ts` | Jalur fallback relasional dihapus; bila `data_payload.options` kosong skrip berhenti dan menyuruh menjalankan `migrate-options-to-jsonb.ts` |
| `scripts/restore-check.mjs` | `ORPHAN_CHECKS` tanpa `question_options`; diganti `DERIVED_CHECKS` (JSONB) |

## 3. Skrip yang dihapus (sudah digantikan)

### 3.1 Kurasi distractor rationale / rubrik — domain MAT-35 (Faruq)

Pengganti JSONB sudah ada dan dipakai di commit MAT-35 terakhir:
`scripts/r2-extract-rationale-jsonb.ts`, `scripts/r3r4-curate-rationale-jsonb.ts`,
`scripts/r4-barisan-deret-rationale.ts`, `scripts/r5-essay-rubric-jsonb.ts`.

| Dihapus | Pengganti |
|---------|-----------|
| `scripts/r2-extract-rationale.ts` | `scripts/r2-extract-rationale-jsonb.ts` |
| `scripts/curate-distractor-rationale-batch1.ts` | `scripts/r3r4-curate-rationale-jsonb.ts` |
| `scripts/curate-distractor-rationale-batch2.ts` | `scripts/r3r4-curate-rationale-jsonb.ts` |
| `scripts/dev/curate-distractor-rationale-batch1.ts` | duplikat dev dari batch1 |

### 3.2 Probe sekali pakai (sudah tidak relevan pasca-drop)

`scripts/probe-option-structure.ts`, `scripts/probe-pola-barisan-all.ts`,
`scripts/probe-pola-barisan-sample.ts`, `scripts/probe-ready-bundles.ts`
— keempatnya membaca tabel backup `question_options_mat146_backup` yang hanya
ada selama migrasi berlangsung.

### 3.3 Skrip diagnostik ad-hoc `scripts/dev/` (git-ignored, sekali pakai)

`audit-katex-lint.ts`, `bukti-build.ts`, `db-clear-ingest.ts`, `dbg-dua.ts`,
`delete-mathcyber.ts`, `delete-non-math.ts`, `delete-non-math2.ts`,
`find-left10.ts`, `find-unbalanced.ts`, `fix-katex-reingest.ts`,
`ingest-bertahap.ts`, `konteks-eof.ts`, `lihat-err-b3.ts`, `lihat-salah.ts`,
`lihat-sisa-1.ts`, `migrasi-align-star.ts`, `reingest.ts`, `test-one-dev.ts`,
`uji-gerbang-align.ts`, `verif-align-star.ts`, `verifikasi-db.ts`,
`view-question-log.ts`.

> Catatan: `/scripts/dev/` memang di-`.gitignore` (skrip diagnostik lokal). Bila
> ada yang layak permanen, pindahkan ke `scripts/` dan port ke JSONB lebih dulu.

## 4. Verifikasi

```
grep -rn "question_options" scripts/ src/
```

Hasil yang tersisa **hanya**: komentar historis, `scripts/migrate-options-to-jsonb.ts`
(skrip migrasi), dan konstanta `FORBIDDEN_TABLES` di `scripts/db-verify.ts`
(invarian negatif, bukan query ke tabel).

Uji yang dijalankan:

- **`pnpm db:verify` → HIJAU** pada DB bersih yang dimigrasikan dari nol
  (PG lokal: `drizzle-kit migrate` 0000–0017 + `db-apply-safety.ts`):
  ```
  ✓ tables: 25 (harap ≥ 25)
  ✓ checkConstraints: 3 (harap ≥ 2)
  ✓ hnswIndexes: 1 (harap ≥ 1)
  ✓ triggers: 23 (harap ≥ 23)
  ✓ tabel question_options sudah di-drop
  ✓ CHECK chk_questions_difficulty / chk_topics_level
  ✓ TRIGGER trg_questions_updated_at … trg_audit_logs_immutable
  ✓ PK default = uuidv7()
  ✓ Skema OK — tak ada drift.
  ```
  Ini sekaligus membuktikan `drizzle/0017` (drop `question_options`) replayable
  dari nol. Angka FK pada DB bersih = **19** (sesuai `restore-check.mjs`);
  jumlah indeks DB bersih = 84, sehingga ambang `indexes: 78` sengaja dipakai
  sebagai **batas bawah konservatif** (80 lama − 2 indeks tabel opsi).
- `scripts/db-verify.ts` diuji dua arah: ✓ saat tabel opsi tidak ada, ✗
  (`tabel terlarang masih ada: question_options`) saat tabel opsi dibuat ulang.
- `pnpm lint:names` → lulus.
- `npx eslint` pada 6 skrip yang diubah → bersih.
- `npx tsc --noEmit` → **tidak ada error pada file MAT-151**. Sisa error repo-wide
  berasal dari file di luar scope: `src/components/reference/labels-view.test.tsx`
  (sudah ada di HEAD sebelum perubahan ini) dan dua skrip MAT-35 untracked
  (`scripts/r5-batch2.ts`, `scripts/r5-essay-rubric-batch1.ts`).
- `scripts/audit-pedagogy.ts` dieksekusi penuh terhadap DB scratch berisi 3 soal /
  7 opsi → 20 query mengembalikan angka yang benar (kunci tunggal, kunci ganda,
  opsi terlarang, homogenitas, cakupan rationale).
- `scripts/seed-questions.ts` dieksekusi terhadap DB scratch → 14 soal tersimpan,
  opsi masuk ke `data_payload.options` (diverifikasi lewat `jsonb_array_length`).

> Catatan lingkungan: `pnpm db:verify` terhadap DB dev bersama (`:5433`) belum
> bisa dijalankan pada heartbeat ini karena `DATABASE_URL` di `.env` ditolak
> server (`28P01 password authentication failed for user "mathbank"`). Verifikasi
> di atas dilakukan pada DB bersih hasil migrasi penuh, yang justru merupakan
> kasus terketat untuk klaim "tidak ada drift".
