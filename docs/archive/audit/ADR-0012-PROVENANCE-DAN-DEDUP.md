# Audit — ADR-0012 `question_sources` (provenance per-butir + dedup dua-tingkat)

- **Tanggal:** 2026-10-01
- **Status:** ✅ **TERIMPLEMENTASI** (T1–T6) — T7 (UI) & data-lama dedup ditunda.
- **Rujukan:** `docs/ADR/0012-*.md`, `docs/RENCANA-QUESTION-SOURCES.md`

## Ringkas

Menutup dua cacat nyata yang ditemukan saat verifikasi:
1. **Judul artikel & URL terbuang** saat `commitItems` (jejak provenance hilang).
2. **Dedup salah arah**: `itemHash(source, stem)` memasukkan sumber → **soal identik dari
   sumber berbeda dibuat ulang** (duplikat), kebalikan dari kebutuhan many-to-many.

## Yang dikerjakan

| # | Perubahan | Bukti |
|---|---|---|
| T1 | Tabel `question_sources` + `questions.content_hash` | migrasi `drizzle/0008_cloudy_talos.sql` + snapshot |
| T2 | Invarian tabel 28→29 | `invariants.ts`, `db-verify.ts`; `pnpm db:verify` hijau |
| T3 | `contentHash` internal (tak bocor publik) | `question-read.ts` Omit |
| T4 | Dedup exact (ingest) + near (enrichment) + fix provenance | `commit.ts`, `dedup.ts`, `enrichment-service.ts` |
| T5/T6 | `GET /api/questions/[id]` menyertakan `sources` | `question-read.ts` `QuestionSourceView` |

## Penutupan CONSTRAINTS

- **#42** (dedup dua-tingkat): `classifyDuplicate` — `near < exact`; zona near duplikat
  **hanya bila penalaran sama**. Ada tes batas eksplisit (`fusion.test.ts`).
- **#43** (`fusion.ts` tanpa konsumen produksi): kini dipakai `enrichment-service` (near-dedup)
  → **status berubah dari "belum terintegrasi" → terintegrasi**.

## Hasil uji

- Unit: **540 pass** (termasuk 7 `classifyDuplicate` + 5 `contentHash`).
- DB: **161 pass** (termasuk MANY-TO-MANY 1 soal/2 provenance; provenance artikel; T5 getQuestion).
- `pnpm check` **EXIT 0**; coverage 92.75/84.1/91.66/94.8.
- Produksi: `/api/health` 200 (tables **29**), `/api/ready` 200.

## Belum dikerjakan (transparan)

- **T7** UI menampilkan asal-usul (belum ada).
- **Dedup data lama**: 14 soal prod belum dimigrasi-judul; kemungkinan ada duplikat lintas-sumber
  yang perlu ditinjau (skrip terpisah).
- `questions.source_id` (FK tunggal) dipertahankan untuk kompatibilitas.

## § Catatan Verifikasi

- ✅ Migrasi **diterapkan** ke DB dev & uji; `db:verify` menegaskan 29 tabel, 26 trigger, 0 drift.
- ✅ **Bukan no-op**: tes MANY-TO-MANY **gagal** bila `contentHash` dimasukkan `source`
  (dibuktikan lewat skenario sumber berbeda → tetap 1 soal).
- ✅ Fix `audit_logs` di db-test **nyata** dibutuhkan (trigger immutable menolak DELETE) — bukan asumsi.
- ⚠️ **Koreksi arah (2026-10-01)**: near-dedup **awalnya** dirancang di ingest; **dipindah ke
  enrichment** atas instruksi pemilik produk (agar ingest tetap cepat) — tercatat di ADR.
- ⚠️ **Verifikasi git**: MathBank **tidak** pernah rollback; kekacauan ada di QBank karena disk
  di tag `v0.9.0` (lama), sedangkan keputusan final di `master` (satu tabel `question_bundles`).
