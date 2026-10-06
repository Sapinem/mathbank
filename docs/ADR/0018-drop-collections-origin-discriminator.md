# ADR-0018 — Konsolidasi Bundles: Hapus `collections` dan Tambah Diskriminator `bundles.origin`

- **Status:** ✅ **Diterapkan** (2026-10-05) — commit `1764f67` (MAT-39), migrasi Drizzle `0014_harsh_rick_jones.sql`
- **Pengambil keputusan:** Pemilik produk & Software Architect
- **Terkait:** `docs/ADR/0016-tambah-collections-berdampingan.md` (**digantikan**),
  `docs/ADR/0009-bundle-pisah-koleksi-dan-latihan.md` (bundle satu tabel — **diperkuat**),
  `docs/ADR/0017-buang-enum-exercise.md` (`bundle_type` tetap `source` | `exam`),
  `CONSTRAINTS.md` #19 (tak ada kode mati)

## Konteks

Pada 2 Oktober 2026, ADR-0016 memperkenalkan tabel `collections` dan `collection_items` (migrasi `0011`) dengan hipotesis bahwa MathBank membutuhkan wadah arsip publik institusional yang terpisah dari `bundles` (rakitan personal guru).

Namun dalam implementasi dan audit operasional per 5 Oktober 2026:
1. **0 Baris Terisi di Produksi:** Tabel `collections` dan `collection_items` memiliki 0 baris data riil, sementara seluruh alur impor korpus naskah massal (ingest Defantri, Mathcyber1997) secara alami mengalir ke tabel `bundles`.
2. **Duplikasi Konseptual & Overhead Skema:** Memelihara dua konsep paralel (`collections` vs `bundles`) memaksa MathBank memelihara 2 tabel tambahan, 2 permission terpisah (`collection:view`, `collection:manage`), file service ganda (`collection-service.ts`), endpoint ganda (`/api/collections/*`), dan enum audit ekstra (`audit_entity.collection`).
3. **Pembeda Sejati adalah Cara Perolehan (Origin), Bukan Entitas:** Kebutuhan membedakan naskah rakitan manual guru vs naskah hasil serapan scraper/ingest bukanlah perbedaan relasional M:N baru, melainkan dimensi ortogonal asal-usul (*provenance origin*).

Hal ini melanggar batasan arsitektur `CONSTRAINTS.md` #19 (kode mati dan tabel mubazir).

## Keputusan

1. **Hapus Tabel `collections` dan `collection_items`:**
   - Drop kedua tabel via migrasi `0014_harsh_rick_jones.sql`.
   - Bersihkan entri orphaned pada `audit_logs` (54 baris sisa pengujian dihapus) dan buat ulang enum `audit_entity` tanpa nilai `'collection'`.
2. **Tambah Diskriminator `origin` pada Tabel `bundles`:**
   - Tambah PostgreSQL enum baru: `bundle_origin` bernilai `'manual'` dan `'ingest'`.
   - Tambah kolom `bundles.origin` bertipe `bundle_origin NOT NULL DEFAULT 'manual'`, dilengkapi index `idx_bundles_origin`.
3. **Penyelarasan Kontrak API, Izin & Service:**
   - Hapus `collection:view` dan `collection:manage` dari matriks izin (`src/lib/auth/permissions.ts`).
   - Ubah seluruh endpoint `/api/collections/*` menjadi stub yang mengembalikan HTTP `410 Gone`.
   - Perluas kontrak `BundleRow`, `CreateBundleInput`, `UpdateBundleInput`, dan query service untuk menerima dan memfilter berdasarkan `origin`.
   - Naskah hasil ingest otomatis diset `origin: 'ingest'`, sedangkan naskah yang dibuat guru dari UI menggunakan default `origin: 'manual'`.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| **Pertahankan `collections` (Status Quo ADR-0016)** | Menghasilkan kode mati dan 2 tabel kosong. Membingungkan pengembang dan agen AI karena ada dua tempat penyimpanan paket soal yang overlapping. |
| **Tambah Nilai Baru pada Enum `bundle_type` (misal `'collection'`)** | Ditolak karena `bundle_type` (`source` vs `exam`) mengatur peruntukan fungsional naskah (naskah sumber asli vs lembar ujian rakitan), sedangkan asal-usul (manual vs ingest) adalah ortogonal. Sebuah naskah sumber bisa diperoleh lewat ingest maupun disusun manual. |
| **Simpan Metadata Asal di Kolom JSONB** | Ditolak karena `origin` adalah filter utama dalam antarmuka kurasi guru/reviewer, sehingga membutuhkan kolom skalar terindeks dengan jaminan integritas tipe enum database. |

## Konsekuensi

**Positif:**
- **Skema Bersih & Ramping:** Berkurang 2 tabel (dari 28 menjadi 26 tabel). Mengurangi beban migrasi, trigger `updated_at`, dan verifikasi drift.
- **Model Mental Tunggal:** Semua himpunan soal terpadu di dalam tabel `bundles`. Guru dan sistem ingest menggunakan kontrak yang seragam.
- **Efisiensi Kode:** Menghapus ratusan baris kode service mati, menyederhanakan matriks otorisasi peran RBAC, dan mempercepat pemeliharaan.

**Negatif / utang:**
- Endpoint `/api/collections` kini berstatus `410 Gone` dan kontrak lama harus dipertahankan sebagai stub hingga seluruh klien eksternal selesai bermigrasi.
- ADR-0016 secara resmi ditandai usang (*superseded*).

## Catatan

- Diterapkan secara penuh pada git commit `1764f67` (MAT-39) dan diuji dengan 7 pengujian otomatis spesifik untuk verifikasi default origin, filtering, dan copy origin pada duplikasi bundle.
