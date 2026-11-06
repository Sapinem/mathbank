# ADR — Architecture Decision Records

> Catatan keputusan arsitektural **formal**, satu keputusan = satu berkas.
> **Beda dari `RIWAYAT-KEPUTUSAN.md`:** RIWAYAT = log kronologis naratif; ADR = keputusan individual dengan konteks, alternatif, dan konsekuensi (untuk keputusan yang layak dirujuk ulang).
> Format: Michael Nygard (ringkas). Status: `Diusulkan` · `Diterima` · `Ditolak` · `Digantikan oleh ADR-NNN`.

## Indeks

| ADR | Judul | Status |
|-----|-------|--------|
| [0001](0001-bangun-ulang-mathbank.md) | Bangun ulang MathBank (bukan refactor QBank) | Diterima |
| [0002](0002-arsitektur-berlapis-l1-l9.md) | Arsitektur berlapis L1–L9 | Diterima |
| [0003](0003-postgresql-18-uuidv7.md) | PostgreSQL 18 + `uuidv7()` sebagai PK | Diterima |
| [0004](0004-better-auth-multi-role.md) | Better Auth + multi-role (tabel `user_roles`) | Diterima |
| [0005](0005-shadcn-komponen-resmi.md) | Pakai komponen **resmi** shadcn (bukan tulis sendiri) | Diterima |
| [0006](0006-invarian-lunak-di-service.md) | Invarian "lunak" di service, bukan CHECK keras | Diterima |
| [0007](0007-db-reproduktif-dari-file.md) | DB wajib direproduksi dari file migrasi | Diterima |
| [0008](0008-basis-ui-base-ui.md) | Basis UI: Base UI (menggantikan Radix) | Diterima |
| [0009](0009-bundle-pisah-koleksi-dan-latihan.md) | Bundle: **satu tabel** `bundles` (Opsi 2 — pisah 100% di UI) | ✅ Berlaku |
| [0010](0010-event-jenis-berulang-tahun-di-soal.md) | `event` = jenis berulang; tahun di `questions.event_year` | Diterima |
| [0011](0011-stimulus-tetap-di-questions.md) | Stimulus tetap di `questions` (`parent_id`) — jangan dipisah | Diterima |
| [0012](0012-provenance-per-butir-question-sources.md) | Provenance per-butir: tabel `question_sources` (many-to-many, anti-duplikat) | ⚪ Digantikan sebagian oleh ADR-0014 |
| [0013](0013-pisah-collections-dari-bundles.md) | Pisah tabel `collections` vs `bundles` | 🔴 **DIBATALKAN** (audit: duplikasi `question_sources`) |
| [0014](0014-sumber-menempel-pada-bundle.md) | Sumber menempel pada **BUNDLE** (bukan soal); `question_sources` dihapus; `event_*` dipertahankan | **Diterapkan** |
| [0015](0015-gabung-books-institutions-ke-sources.md) | Gabung `books` & `institutions` ke `sources` (kolom per-`kind`); hapus 2 tabel | **Diterapkan** |
| [0016](0016-tambah-collections-berdampingan.md) | Tambah `collections` sebagai konsep **berdampingan** (arsip publik); `bundles` tak disentuh | 🔴 Digantikan oleh ADR-0018 |
| [0017](0017-buang-enum-exercise.md) | Buang nilai enum `exercise` (F7, pasangan `competition`); `bundle_type` = `source`\|`exam` | **Diterapkan** |
| [0018](0018-drop-collections-origin-discriminator.md) | Konsolidasi Bundles: Hapus `collections` & Tambah Diskriminator `origin` (MAT-39) | **Diterapkan** |
| [0019](0019-isolasi-vektor-question-embeddings.md) | Isolasi Penyimpanan Vektor 1:1 (`question_embeddings`) & Partial HNSW Index | Diusulkan (v2.0) |
| [0020](0020-pemisahan-event-makro-dan-provenance-naskah.md) | Pemisahan Mutlak Event Ujian Makro & Provenance Naskah (hapus `bundles.event_id`) | Diusulkan (v2.0) |
| [0021](0021-konfigurasi-cetak-print-config-bundles.md) | Konfigurasi Cetak Naskah A4 via `bundles.print_config` (KISS) & CSS Paged Media 2-Kolom | Diusulkan (v2.0) |
| [0022](0022-wraproute-pipeline-banned-server-actions.md) | Pipa Tunggal API Gateway `wrapRoute()` & Larangan Server Actions untuk Mutasi | Diusulkan (v2.0) |
| [0023](0023-satu-evaluator-invarian-skema.md) | Satu evaluator invarian skema di modul murni; hitungan tabel mengecualikan sisa migrasi | **Diterapkan** |
| [0026](0026-deklarasi-otorisasi-eksplisit.md) | Deklarasi otorisasi eksplisit per method route (`authz` wajib + pemeriksa mesin) | **Diterapkan** |
| [0027](0027-kontrak-openapi-dari-kode.md) | Kontrak OpenAPI 3.1 dihasilkan dari kode (registry + deklarasi `wrapRoute`) | **Diterapkan** |
| [0028](0028-cabut-prefix-v1-ingest.md) | Cabut prefix `v1` dari jalur ingest; `/api/v1/ingest/*` jadi alias 90 hari | **Diterapkan** |
| [0029](0029-store-bersama-rate-limit-idempotensi.md) | Rate limit & idempotensi memakai store PostgreSQL bersama (fail-open / fail-closed) | **Diterapkan** |

## Cara menambah ADR

1. Salin `template.md` → `NNNN-judul-singkat.md` (nomor urut 4 digit).
2. Isi Konteks · Keputusan · Alternatif · Konsekuensi.
3. Tambahkan baris di Indeks atas.
4. Jangan hapus ADR lama — tandai `Digantikan oleh ADR-NNN`.
