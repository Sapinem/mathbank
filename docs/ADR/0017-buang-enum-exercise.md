# ADR-0017 — Buang nilai enum `exercise` (ikut jejak `competition`)

- **Status:** ✅ **DITERAPKAN** (2026-10-02) — migrasi `0012`; `bundle_type`: 3 → **2 nilai**
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `docs/ADR/0009-*.md` (bundle satu tabel — **tetap berlaku**),
  `docs/ADR/0013-*.md` & `0016-*.md` (collections — `exercise` sempat jadi alasannya),
  `docs/AUDIT-ARSITEKTUR-DAN-DATA.md` (**F7** — temuan asal),
  `CONSTRAINTS.md` #19 (tak ada kode mati)

## Konteks

Audit **F7** menemukan **dua nilai enum yang melampaui keputusan resmi**:

> *"Dua nilai enum ekstra yang tidak melalui interview keputusan muncul di kode
> (dan masuk migrasi). … menyimpang dari jejak keputusan resmi dan tak
> terdokumentasi."*

| Nilai | Keputusan resmi (`ARSITEKTUR-DATA-FINAL.md:127`) | Kenyataan kode |
|---|---|---|
| `competition` | ✘ tidak ada | ada |
| `exercise` | ✘ tidak ada | ada |

```sql
-- Keputusan resmi:
CREATE TYPE bundle_type AS ENUM ('source','exam');   -- HANYA DUA
-- Kenyataan kode:
bundleTypeEnum = ["source","exam","exercise"]        -- + exercise
```

**`competition` sudah dibuang** oleh **ADR-0015** (2026-10-01). `exercise`
tertinggal sebagai pasangan F7 yang belum diselesaikan.

### Bukti pemakaian nol

```
bundles.bundle_type='exercise'  →  0 baris
```

Setelah **ADR-0016** menambahkan `collections`, `exercise` makin tak punya
alasan: konsep "latihan" tak lagi perlu dibedakan dari "ujian" karena
**arsip publik sudah punya tabelnya sendiri**.

## Keputusan

**Buang `exercise`.** `bundle_type` final = **`source` | `exam`** — persis
keputusan resmi.

| # | Aksi |
|---|---|
| 1 | Enum DB: `bundle_type` → `('source','exam')` (migrasi `0012`) |
| 2 | `BundleType` (TS) → `"source" \| "exam"` |
| 3 | Dua Zod enum (`api/bundles`, `api/bundles/[id]`) disesuaikan |
| 4 | `TYPE_LABELS` UI: buang entri "Latihan" |
| 5 | Tes yang memakai `exercise` sebagai sampel → `exam` |

## Alternatif yang Ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| **Pertahankan + dokumentasikan** | Konsep "latihan" **tidak cukup beda** dari "ujian": sama-sama kumpulan soal milik guru. Bedanya cuma **niat pemakaian**, bukan struktur — bisa dijawab label, bukan jenis |
| **Tunda sampai ada pola pemakaian** | Setelah `collections` ada (ADR-0016), kebutuhan itu **sudah terjawab**: arsip publik = `collections`, naskah guru = `bundles`. Menyimpan enum yang menyimpang dari keputusan resmi hanya memelihara utang audit |
| **Pakai `exercise` untuk `collections`** | `collections` **tak butuh enum jenis** — dimensinya `source_id`/`event_id`, bukan tipe |

## Konsekuensi

- `bundle_type`: **3 → 2 nilai**. Tak ada data hilang (**0 baris** memakai).
- **Migrasi wajib lebih dulu memastikan 0 baris `exercise`**; bila ada,
  konversi enum **gagal** (`invalid input value for enum`). ✅ Terbukti saat
  penerapan: DB uji punya **2 baris** sisa tes → diubah ke `exam` lebih dulu.
- Kode: 4 tempat (`_enums.ts`, `bundle-service.ts`, 2 route Zod) + UI.
- **`bundles` masih menyimpan kolom bergantian NULL** (`source_id`/`event_id`
  untuk `exam`; `duration_minutes`/`status` untuk `source`). Itu **sengaja
  dibiarkan** — pemilik produk memutuskan **jangan merombak `bundles`**
  (pelajaran ADR-0013: jangan memutuskan bentuk sebelum jelas).

## Catatan

- **Bug lama terbongkar saat penerapan:** 10 skrip di `scripts/` semuanya
  mendeklarasikan `main()`. Saat satu skrip diberi nama unik, **skrip lain
  rusak** (`main is not defined`) — karena `tsc` menyatukan seluruh file.
  Diperbaiki: setiap skrip kini memakai nama fungsi unik. Semua skrip
  **diverifikasi jalan**, bukan sekadar lolos typecheck.
- **Pelajaran dari ADR-0015/0016 diterapkan lagi:** enum di DB **dan** DB uji
  diperiksa sebelum migrasi — di sinilah 2 baris `exercise` di DB uji ketahuan.
- `exercise` masih muncul di **snapshot lama** (`drizzle/meta/0000-0011`).
  Itu **normal & benar** — snapshot adalah riwayat, tak boleh diubah.
