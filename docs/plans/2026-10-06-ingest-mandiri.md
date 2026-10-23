# Ingest Mandiri — tanpa server, tanpa build

Tanggal: 2026-10-06 · Status: **tersedia & teruji**

## Masalah yang diselesaikan
Sebelumnya ingest HARUS lewat API HTTP (`POST /api/v1/ingest/commit`), dan API
itu bagian aplikasi Next.js mode `production` (`pnpm start`) → memakai kode
**hasil build**. Akibatnya tiap kali parser diperbaiki, ingest tetap memakai
kode lama sampai `pnpm build` + restart. Terbukti: server 0/40 kunci vs tes
lokal 40/40.

## Solusi: panggil LIBRARY langsung
Seluruh logika ingest ada di `src/lib/ingest/*` dan **tidak bergantung HTTP**
(tidak ada `NextRequest`, `headers()`, `cookies()`). Jadi skrip `tsx` bisa
memanggil `processQueueItem()` langsung.

`scripts/dev/ingest-mandiri.ts` melakukan itu:
```
enqueue()  →  getQueueItem()  →  processQueueItem()  →  resolveEventsForBundles()
```

### Keunggulan
| | Via API | Mandiri |
|---|---|---|
| Perlu build? | ✅ ya (mode production) | ❌ **tidak** |
| Perlu service menyala? | ✅ ya | ❌ **tidak** |
| Kena rate limit HTTP? | ✅ ya | ❌ tidak |
| Pakai kode sumber? | build saja | ✅ **selalu** |
| Progres di terminal? | tidak | ✅ ya |

Tetap memakai tabel `ingest_queue` yang sama → hasil **identik** dengan jalur API.

## Cara pakai
```bash
# lihat rencana (tidak menulis DB)
npx tsx scripts/dev/ingest-mandiri.ts --dry 5

# ingest 5 artikel defantri
npx tsx scripts/dev/ingest-mandiri.ts 5

# sumber lain
SUMBER=m4thlab   npx tsx scripts/dev/ingest-mandiri.ts 20
SUMBER=mathcyber npx tsx scripts/dev/ingest-mandiri.ts 20
```
Progres disimpan di `/tmp/<sumber>-mandiri-done.json` → aman diulang.

## Bukti (5 artikel defantri, dev MATI)
```
✓ 2010-07-matematika-smp-pembahasan-bangun-ruang → created=45 failed=0
✓ 2012-08-pembahasan-turunan-fungsi-aljabar       → created=33 failed=0
✓ 2012-11-matematika-dasar-fkfi                   → created=47 failed=0
✓ 2013-02-matematika-dasar-kaidah-pencacahan      → created=41 failed=0
✓ 2013-02-matematika-dasar-pertidaksamaan         → created=29 failed=0
```
Verifikasi: KaTeX rusak **0**, stem kosong **0**, PG tanpa kunci **4/195**
(memang kosong di sumber), media terunduh **75 aset**.

## Kapan tetap pakai API?
- Ingest lewat **UI** (manusia menempel HTML) → tetap API.
- Uji **end-to-end jalur resmi** (route + auth + rate limit) → tetap API.
- Lihat **dampak build produksi** → tetap API.

Ingest massal rutin → **mandiri** jauh lebih praktis.

## Catatan
- Mode production (`mathbank.service` :1234) tetap jalan untuk situs publik.
- Mode dev (`mathbank-dev.service` :3010) untuk iterasi cepat; ⚠️ menambah
  **file baru** butuh restart service (hot-reload tak menemukan modul baru).
- Ingest mandiri **tidak butuh keduanya**.
