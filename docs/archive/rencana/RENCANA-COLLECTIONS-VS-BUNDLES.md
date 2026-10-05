# RENCANA — Arah `collections` vs `bundles` (BELUM DIPUTUSKAN)

> **Status:** 📝 **catatan arah** — pemilik produk menyampaikan arahnya, **belum jadi keputusan formal**.
> **Tanggal:** 2026-10-02 · **Terkait:** ADR-0014, ADR-0016, ADR-0017

## Arah yang disampaikan pemilik produk

> *"Kalau hasil ingest web masuknya collection bukan bundle."*

> *"Nanti juga diberi kemampuan yang sama."*

Artinya:

1. **Hasil ingest artikel web** (mathcyber, defantri, m4thlab, pusmendik) → **`collections`**,
   **bukan** `bundles`.
2. **`bundles`** → untuk **naskah guru** (ujian & latihan).
3. **`collections` nanti dilengkapi kemampuan yang sama** seperti `bundles`:
   cetak, ekspor Moodle, status kurasi, urutan — **menyusul**, bukan sekarang.

## Keadaan sekarang (belum diubah)

```
ingest web  →  bundles (bundle_type='source')   ← 2 naskah, 78 soal (hasil ingest 2026-10-02)
collections →  kosong (0)                        ← tabel & UI ada, belum dipakai
```

Ini **bertentangan** dengan arah di atas. Belum diperbaiki karena pemilik produk
memilih **menjelaskan dulu** sebelum keputusan diambil.

## Yang akan terdampak bila arah ini diputuskan

| Berkas | Perlu diubah |
|---|---|
| `docs/ADR/0014-*.md` | keputusan **#7**: *"ingest WAJIB membuat bundle"* → **bertentangan** |
| `docs/ADR/0016-*.md` | `collections` dikatakan "arsip publik"; naskah web **juga** publik → tumpang tindih perlu diselesaikan |
| `src/lib/ingest/commit.ts` | `resolveBundleId()` → `resolveCollectionId()`; `linkQuestionToBundle()` → collection |
| `bundle_type` enum | bila `source` pindah, `bundles` tinggal `exam` → enum mungkin tak perlu (ADR-0017 sudah membuang `exercise`) |
| Data | 2 naskah / 78 soal harus **dipindah** dari `bundles` → `collections` |

## Perbedaan kemampuan saat ini (yang nanti disetarakan)

| Kemampuan | `bundles` sekarang | `collections` sekarang |
|---|:--:|:--:|
| Urutan kaku (`order_index` nomor soal) | ✅ | ❌ (tampilan saja) |
| Status kurasi (`draft/review/ready`) | ✅ | ❌ |
| Cetak (`/bundles/[id]/print`) | ✅ | ❌ |
| Ekspor Moodle | ✅ | ❌ |
| `duration_minutes` / `instructions` | ✅ | ❌ |
| UI | ✅ | ✅ (baru, ADR-0016) |

> ⚠️ **Catatan penting:** bila `collections` kelak punya **semua** kemampuan yang
> sama, pertanyaannya menjadi: **apa bedanya dengan `bundles`?** Perlu dijawab
> saat keputusan diambil — kalau tidak, kita memelihara **dua tabel untuk satu
> konsep** (persis kekhawatiran yang dulu membatalkan ADR-0013).

## Yang BELUM diputuskan (butuh penjelasan pemilik produk)

1. **ADR-0014 diubah, atau ada ADR baru** yang menggantikan bagian ingest?
2. **`bundle_type='source'` dihapus** total, atau dipertahankan?
3. **78 soal hasil ingest 2026-10-02** — dipindah ke `collections`, atau dibiarkan?
4. Bila `collections` = `bundles` + kemampuan sama, **pembeda hakikinya apa**?
   (usulan: `collections` = **publik/institusional**; `bundles` = **milik guru** —
   tapi ini perlu ditegaskan, karena `bundle_type='source'` juga sudah publik)
