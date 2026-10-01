# ADR-0009 — Bundle: satu tabel `bundles` (Koleksi & Latihan) — **mengikuti keputusan final QBank**

- **Status:** 🔴 **DITOLAK / DIBATALKAN** (usulan awal "pisah tabel" salah arah; lihat Catatan Revisi)
- **Tanggal:** 2026-10-01
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `docs/DESAIN-SKEMA-BUNDLE-TERPISAH.md` (proposal pembanding), QBank `master:src/lib/db/schema/bundles.ts`,
  QBank commits `9e09211` (legacy cleanup) & `5d01dfe` (hapus collections/exams), QBank `docs/superpowers/specs/2026-09-27-exam-origin-events-design.md`

> ## ⚠️ Catatan Revisi (2026-10-01)
> ADR ini **awalnya** mengusulkan **memisah** `collections` (Koleksi) dari `bundles` (Latihan).
> Setelah **verifikasi ke riwayat git QBank**, usulan itu **TERBUKTI SALAH ARAH**:
> - QBank **v0.9.0** (tag, versi LAMA) memang punya `collections.ts` + `exams.ts` **terpisah**.
> - QBank **`master`** (FINAL) **MENGHAPUS keduanya** (commit `5d01dfe`), menyatukan menjadi
>   **satu tabel `question_bundles`** — `"752 collections_legacy sudah 100% tergabung ke question_bundles"`.
> - **MathBank saat ini sudah ≈ identik** dengan keputusan final QBank (satu tabel `bundles`).
>
> Maka "pisah tabel" = **desain yang justru sudah ditinggalkan**. Status ADR: **DITOLAK.**
> Rancangan versi terpisah tetap didokumentasikan di `docs/DESAIN-SKEMA-BUNDLE-TERPISAH.md`
> sebagai bahan pembanding, bukan rencana eksekusi.

## Konteks (dipertahankan untuk jejak)

`bundles` menampung `bundle_type`: `source` | `exam` | `exercise`. Dua konsep domain
(Koleksi = arsip statis institusional; Latihan = naskah rakitan personal) menyatu di satu tabel.

## Keputusan (FINAL — mengikuti QBank `master`)

**Pertahankan SATU tabel `bundles` + `bundle_items`** dengan kolom tipe-spesifik yang sudah ada
(`sourceId`,`eventId`,`year` untuk `source`; `durationMinutes`,`instructions`,`status`,`createdById`
untuk `exam`). **Jangan pisah tabel.**

Yang tetap **perlu dikerjakan** (bukan soal pisah/satu tabel):
1. **Beri perilaku pada `bundle_type`** — saat ini label pasif (tak membedakan perilaku/izin).
2. **Tegakkan `createdById`** (own) — sekarang ditulis tapi tak dipakai (`listBundles` tanpa filter pemilik;
   izin `bundle:manage` broadcast) → **cacat perilaku**: guru bisa menyentuh bundle guru lain.
3. **(Opsional, fase depan)** `points` di `bundle_items` — QBank pun menunda.

## Alternatif yang Dipertimbangkan

| Alternatif | Keputusan |
|---|---|
| **Pisah tabel** (`collections` + `bundles`) | ❌ **Ditolak** — desain lama QBank yang sudah dibuang (`D2`); +2 tabel, risiko migrasi, tanpa manfaat nyata |
| **Satu tabel + perilaku per-tipe** | ✅ **Dipilih** — cermin QBank final; murah; mengikuti pola `questions.status` |

## Konsekuensi

- Skema **tak berubah** (tetap 28 tabel) → nol risiko migrasi.
- Fokus bergeser ke **perilaku** (izin `own`, read-only vs editable) & **konsistensi `event`/`source`**.
- `docs/DESAIN-SKEMA-BUNDLE-TERPISAH.md` disimpan sebagai rujukan historis.

## Catatan

- Keputusan ini **belum dieksekusi** (menunggu persetujuan pemilik produk atas poin #1–#3 di atas).
- Temuan git: **MathBank tidak kacau & tak ada rollback**; kekacauan ada di QBank karena disk berada di
  tag `v0.9.0` (lama), bukan `master` (final).
