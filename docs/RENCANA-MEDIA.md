# RENCANA MEDIA (Gambar/hasil scrape korpus)

> **Status:** ✅ **TERIMPLEMENTASI** (M9-2b, 2026-09-30) — teruji end-to-end pada korpus nyata
> **Dibuat:** 2026-09-30
> **Milestone:** M9-2b (bagian dari M9 Ingest Korpus)
> **Bergantung pada:** `media_assets` + `question_media` (skema M1), `MEDIA_STORAGE_PATH`

---

## 1. Masalah

Soal matematika **sering butuh gambar** (grafik, bangun, diagram). Dari korpus M9:

| Sumber | Gambar | Absolut | Relatif | `srcset` hidup | Status unduh |
|---|---:|---:|---:|---:|---|
| defantri | 4.321 | 4.318 | 0 | — | ✅ hidup (200) |
| mathcyber | 2.771 | 8 | **2.763** | **2.405 (87%)** | 🟡 `src` 404, `srcset` hidup |
| m4thlab | 142 | 112 | 15 (+15 tanpa src) | — | ✅ hidup (200) |
| **TOTAL** | **~7.234** | | | | |

**Temuan kunci:**
1. `clean.ts` hanya mengambil `src`, **mengabaikan `srcset`** → untuk mathcyber, `src`
   adalah **path crawler lama yang rusak (404)**. URL asli yang hidup ada di **`srcset`**.
2. Korpus **tidak menyimpan berkas gambar** — hanya HTML. Jadi gambar **wajib diunduh**.
3. Sumber bisa **hilang** kapan saja (mathcyber `src` sudah 404).

## 2. Keputusan (2026-09-30)

- **Unduh + simpan lokal** (`MEDIA_STORAGE_PATH`) — tahan sumber hilang.
- **Tanpa atribusi tampil** (keputusan user); URL asli tetap disimpan di data
  (`sourceRef`/`originalImagePath`) untuk jejak & pengembangan.
- **Prioritas URL**: `srcset` (URL terbesar/hidup) → `src`. Dua-duanya gagal → **flag**.
- **Dikerjakan sekarang** sebagai bagian M9-2b.

## 3. Perubahan `clean.ts` (ekstraksi URL)

`extractImages` diperbaiki:
- Ambil **kandidat URL** dari `srcset` (pilih lebar terbesar) **lalu** `src`.
- Bila `src` relatif (mis. `/uploads/...`) → **jangan** dipakai bila ada `srcset` absolut.
- Kembalikan daftar `media[]` berisi URL **pilihan** (bukan semua kandidat).

Hasil: markdown `![alt](URL-pilihan)` memakai URL **yang paling mungkin hidup**.

## 4. Komponen baru

```
src/lib/ingest/media/
  resolve-url.ts   — pilih URL terbaik (srcset>src; absolutisasi bila perlu)
  fetch.ts         — unduh 1 URL (timeout, retry, batas ukuran, cek mime)
  store.ts         — simpan berkas ke MEDIA_STORAGE_PATH (hash-based path)
  ingest-media.ts  — orkestrasi: URL → unduh → simpan → catat hasil
```

- **Fungsi murni** (`resolve-url.ts`) — tanpa I/O, mudah diuji.
- **I/O terisolasi** (`fetch.ts`, `store.ts`) — injeksikan agar bisa di-mock.
- **Orkestrasi** (`ingest-media.ts`) — dipakai M9-3 (commit) / skrip ingest.

## 5. Penyimpanan berkas

- Path: `MEDIA_STORAGE_PATH/{hash[0:2]}/{hash}{ext}` (sharding 2 huruf, hindari
  satu folder terlalu besar).
- Nama = **contentHash** (sha256) → **dedup otomatis** (satu gambar dipakai 100× = 1 berkas).
- Batas ukuran (mis. 10 MB) & mime whitelist (`image/png|jpeg|gif|webp|svg+xml`).
- Tulis atomik (tulis `.tmp` → rename).

## 6. Penyajian ke klien

Belum ada route penyajian. Opsi (putuskan saat M9-3/UI):

| Opsi | Catatan |
|---|---|
| A. Route `/media/[...path]` membaca `MEDIA_STORAGE_PATH` | akses terkontrol, bisa cache header |
| B. Symlink/copy ke `public/uploads/` | paling sederhana, tapi tak terkontrol |
| C. Endpoint `GET /api/v1/media/{id}` | konsisten API, bisa kontrol izin |

**Usulan: Opsi A** (stream dari storage, `Cache-Control` panjang karena berkas
immutable by hash).

## 7. Integrasi skema

Tiap berkas yang berhasil → baris `media_assets`:
- `contentHash` = sha256 → **dedup** via `uq_media_content_hash`
- `originalImagePath` = URL sumber (jejak)
- `mimeType`, `fileSize`, `width`, `height` (bila terbaca)
- `sourceOrigin` = **`web_ingest`**
- `svgPath`/`thumbnailPath` — ditunda

Lalu `question_media` (soal ↔ aset, `role` dari posisi gambar: stem=`content`,
opsi=`option`, pembahasan=`solution`).

## 8. Aturan mutu

- **Gagal unduh → flag** (soal tetap dibuat, gambar ditandai untuk telaah).
- **Jangan blokir ingest** karena gambar (gambar = pelengkap, bukan penghalang).
- **Idempoten**: contentHash sama → tak unduh ulang.
- **Hormati sumber**: 1 permintaan per gambar, jeda kecil antar-permintaan
  (hindari membebani server sumber).

## 9. Catatan Verifikasi

- **Data gambar**: dihitung dari **seluruh 1.069 file korpus** (script sekali-pakai,
  dibersihkan setelah selesai).
- **`src` mathcyber 404**: diverifikasi `HEAD https://mathcyber1997.com/uploads/
  mathcyber/soal-final-ogm-kpm-sma-2021/img_1.png` → **404**.
- **`srcset` hidup**: `HEAD https://mathcyber1997.com/wp-content/uploads/2021/06/
  OGMSMA25-768x299.png` → **200**.
- **defantri hidup**: `HEAD ...blogger.googleusercontent.com/...` → **200**.
- **Skema media**: `src/lib/db/schema/media.ts` (baris 20–70) — `media_assets`
  + `question_media` + enum `web_ingest` di `_enums.ts:99–107`.
- **Storage**: `.env.example:51` → `MEDIA_STORAGE_PATH=./storage/media`.
