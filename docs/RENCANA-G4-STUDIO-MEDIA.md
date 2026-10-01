# RENCANA G4 — Studio Media

- **Tanggal:** 2026-10-01
- **Gelombang:** G4 (dari `REVIEW-MASUKAN-AUDIT-QBANK.md`)
- **Masukan:** #14 (AssetPicker + Comot&Modif + AI Generator) · #5 (media hygiene) · #9 (TikZ) — **#9 DITUNDA** atas arahan pemilik
- **Status:** 🟡 rencana — **menunggu persetujuan sebelum eksekusi**

---

## Kondisi nyata (terverifikasi ke kode, bukan dari dokumen)

| Butir | Klaim audit | Kenyataan di kode |
|---|---|---|
| Skema | `media_assets` + `question_media` "ada" | ✅ **ADA** — `src/lib/db/schema/media.ts` (Tri-Facet, `parentAssetId`, `contentHash` UNIQUE, `role`, `orderIndex`, RESTRICT di `media_id`) |
| Konsumen produksi | "nol konsumen" | ✅ **BENAR** — `media_assets rows: 0`, `question_media rows: 0` |
| Unduh gambar korpus | "M9 ✅" | 🟡 **SEBAGIAN** — `storeImage()` menulis **berkas ke disk saja**, **tanpa INSERT** ke `media_assets` |
| Endpoint penyaji | — | ❌ **TIDAK ADA** — `find src/app -type d -name "media"` → kosong; markdown berisi `/media/…` → **404** |
| RBAC | — | ✅ **SIAP** — `media:manage` sudah di `permissions.ts` |
| Halaman studio | — | ⬜ Placeholder `ComingSoon`; label sudah dikoreksi ke `"G4 — Studio Media"` |

### Ground truth (2026-10-01)

```
media_assets rows      : 0
question_media rows    : 0
questions rows         : 23
file di public/uploads : 0
storage/media (disk)   : BELUM ADA
data/ (korpus)         : KOSONG
```

### Yang sudah BENAR di MathBank (pertahankan, jangan diubah)

- `src/lib/ingest/media/store.ts` — nama berkas = **contentHash**, **sharding 2 huruf** (`{hash[0:2]}/{hash}{ext}`), tulis **atomik** (`.tmp` + rename). Dedup otomatis.
- `src/lib/ingest/media/ingest-media.ts` — gambar gagal → **di-flag**, soal tetap dibuat (bukan gagal senyap). `role: content|option|solution` sejak awal.
- `mediaStorageRoot()` — media di **luar `public/`** (`./storage/media`), disajikan lewat route. Lebih aman daripada menaruh di dalam web root.
- `MediaOutcome` — jejak `sourceUrl`, `contentHash`, `mimeType`, `fileSize`.

---

## Akar masalah (satu rantai)

```
M9 ingest menulis markdown:  ![alt](/media/ab/abcd1234.png)
                                      │
                                      ├─ ① TIDAK ADA route /media  → 404 saat dirender
                                      ├─ ② storeImage tulis disk saja, tanpa INSERT
                                      │     → media_assets rows = 0
                                      └─ ③ tak ada junction → question_media rows = 0
```

**Tiga celah ini satu penyakit:** berkas media tidak pernah **terdaftar** dan tidak pernah **disajikan**.
Inilah isi G4 — bukan membangun galeri dari nol, melainkan **menyambungkan** yang sudah ada.

---

## Rincian pekerjaan

### G4.1 — Registrasi media saat ingest (menutup celah ② ③)

**Masalah:** `storeImage()` mengembalikan `{ relativePath }` tapi tidak ada baris `media_assets`.

**Perubahan:**
- Service baru `src/lib/services/media-service.ts` → `registerIngestedMedia(outcome, questionId, actor)`:
  - INSERT `media_assets` (title dari alt, `contentHash` UNIQUE → `onConflictDoNothing` lalu SELECT id),
  - INSERT `question_media` (`role`, `orderIndex` sesuai urutan kemunculan),
  - `recordAudit`.
- `ingest/service.ts` memanggil registrasi **per item** setelah markdown ditulis, **dalam transaksi** bersama pembuatan soal.

**Aturan yang dipatuhi:** #19 (tak ada kode mati — dibuat = dipakai), #37 (tes lewat jalur nyata), #26 (bila perlu kolom baru → `drizzle/manual/`).

### G4.2 — Route penyaji media (menutup celah ①)

**Masalah:** markdown berisi rujukan media tapi tidak ada route penyaji.

**Hasil akhir (lebih baik dari rencana awal):**
- `src/app/img/[shortId]/route.ts` — menyajikan dari `mediaStorageRoot()`.
  **URL `/img/{shortId}`, bukan `/media/[...path]`** — karena markdown menyimpan
  `{{img:<shortId>}}` (Opsi D), jadi route cukup menerima short_id.
  - **Anti path-traversal WAJIB** (4 varian diuji): resolve + cek `startsWith(root)`; tolak `..` & path absolut.
  - `Cache-Control: public, max-age=86400, stale-while-revalidate=…` + `X-Content-Type-Options: nosniff`.
  - **SVG → CSP ketat** (`default-src 'none'; style-src 'unsafe-inline'`) — pelajaran dari QBank.
  - **Fallback Tri-Facet**: `svgPath` → `originalImagePath` → `thumbnailPath`.
  - **BUKAN `wrapRoute`** — pembungkus itu memformat hasil jadi JSON `{data}`, sedangkan route ini melayani byte.
- Route **publik** (dipakai `<img>` & ekspor cetak) — tetapi hanya menyajikan berkas yang **punya baris `media_assets`**; berkas asing di disk tidak pernah dilayani.

**Aturan:** #33 (rate limit per IP), #22 (validasi bentuk short_id sebelum menyentuh DB).

### G4.3 — Kolom `short_id` + kontrak & proyeksi media

- Kolom `short_id` 8-char base62 + UNIQUE + CHECK → **migrasi manual** `drizzle/manual/media-short-id.sql`.
- Generator `src/lib/media/short-id.ts` (fungsi murni).
- `src/lib/contracts/media.ts` — Zod boundary.
- Proyeksi kolom eksplisit `GALLERY_COLUMNS` (aturan **#34**: jangan `.select()` tanpa kolom).

### G4.4 — Parser `{{img:}}` di MathContent

- `src/components/math/math-content.tsx` — token `img` dipisah **sebelum** pemisahan rumus,
  agar shortcode tak tertelan sebagai teks rumus (dan sebaliknya).
- Fallback bila gambar gagal dimuat: label `[gambar <id> tidak dapat dimuat]`, bukan ruang kosong.

### G4.5 — AssetPicker di editor soal (#14a)

- `src/components/media/asset-picker-modal.tsx` + `src/lib/hooks/use-media.ts` (React Query, pola proyek).
- Route: `/api/media` (daftar), `/api/media/upload` (unggah), `/api/media/[shortId]` (detail + PATCH).
- Unggah lewat `mediaService.uploadMedia()` — gambar guru **selalu terdaftar**, tak bisa jadi orphan.
- Sisip shortcode **di posisi kursor** (`insertAtCursor`), bukan menempel di akhir.
- a11y: `Dialog` shadcn (fokus terjebak), target klik ≥44px (#11), `role="alert"` untuk galat.

### ⏸️ G4.7 — Comot & Modif / fork (#14b) — DITUNDA

- `parentAssetId` **sudah ada** → service `forkMediaAsset(sourceId, overrides, actor)`.
- **Kepastian:** anak = baris baru; sumber **tidak berubah**.
- **Alasan ditunda:** `content_hash` UNIQUE membuat anak tak boleh mewarisi hash induk →
  menyeret migrasi `content_hash` UNIQUE → *partial unique*. Tidak sebanding saat ini.

### ⏸️ G4.8 — AI Generator (#14c) — DITUNDA

- Prasyarat sudah ada: `src/lib/ai/client.ts` (satu gerbang), `ai/config.ts`, `enrichment-service.ts` (pola "AI hanya mengusulkan").
- **Alasan ditunda:** generator diagram butuh **compiler TeX** (TikZ) atau model gambar —
  pasangan `#9 TikZ`, yang sudah ditunda atas arahan pemilik.

### G4.6 — Halaman `/assets` + hygiene orphan (#5)

- Grid galeri (responsif), cari, filter `sourceOrigin`, detail (metadata + soal yang memakai).
- Service `findOrphanAssets()` — aset **tanpa** baris `question_media`.
- Aksi: **laporkan dulu** (daftar + ukuran), hapus **hanya bila dikonfirmasi** (jangan auto-hapus).
- Panel hygiene di galeri.

---

## ⏸️ DITUNDA — #9 TikZ Studio

Sesuai arahan pemilik: *"TikZ Studio pending dulu di urutan akhir."*

- Butuh **compiler TeX** (Kemungkinan: `latex` + `dvisvgm`).
- Keamanan: constraint **#20** — `openin_any='p'` (mitigasi LFI); `-no-shell-escape` **tidak cukup**.
- Halaman `/studio/tikz` tetap `ComingSoon` sampai G4b.

---

## Butuh keputusan — ✅ SUDAH DIPUTUSKAN (2026-10-01)

1. **Rujukan media di markdown** → **OPSI D: shortcode `{{img:<shortId>}}`**
   - `short_id` = 8 karakter base62, **UNIQUE** di `media_assets`
   - Panjang rujukan: 16 char (dari 78 char sekarang)
   - Konsekuensi: kolom baru + **migrasi manual** (`drizzle/manual/`, constraint #26) + parser baru di `MathContent`
   - Alasan: markdown tidak lagi menyimpan path storage; berkas boleh pindah/ganti tanpa mengubah soal
2. **Fork & `contentHash`** → **DITUNDA**. Skema (`parentAssetId`) sudah siap; dibangun kapan saja tanpa membongkar apa pun. Menyeret migrasi `content_hash` UNIQUE → *partial unique*, tidak sebanding dengan manfaat saat ini.
3. **G4.8 AI Generator** → **DITUNDA** (pasangan TikZ; butuh compiler TeX untuk diagram).
4. **#9 TikZ Studio** → **DITUNDA** (arahan pemilik).
5. **Cakupan G4** → 6 butir (G4.1–G4.6), lihat daftar revisi di bawah.
6. **URL galeri** → **`/assets`** (revisi 2026-10-01). Semula `/studio/assets`; grup "Studio"
   dihapus dari sidebar karena hanya berisi satu halaman aktif (TikZ ditunda). Lihat `RENCANA-UI.md`.

### Cakupan final G4

```
✅ G4.1  Registrasi media saat ingest      (tutup celah ②③)
✅ G4.2  Route penyaji /img/{shortId}      (tutup celah ①)
✅ G4.3  Kolom short_id + migrasi manual
✅ G4.4  Parser {{img:}} di MathContent + kontrak
✅ G4.5  AssetPicker di editor             (#14a)
✅ G4.6  Halaman /assets + hygiene orphan  (#5)

⏸️ G4.7  Comot & Modif (fork)    — ditunda
⏸️ G4.8  AI Generator            — ditunda
⏸️ #9    TikZ Studio             — ditunda
```

**G4 SELESAI (2026-10-01).** Seluruh gate hijau; verifikasi live lolos untuk penyaji
(`/img`) maupun hygiene (orphan → hapus → hilang dari DB + disk).

### Progres nyata (2026-10-01)

| Butir | Berkas | Gate |
|---|---|---|
| G4.3 short_id | `src/lib/media/short-id.ts` + migrasi manual | ✅ |
| G4.1 pintu seragam | `src/lib/services/media-service.ts` (`uploadMedia`, `storeAndRegister`, `attachStoredMedia`, `detachAndCleanup`, `findOrphanAssets`) | ✅ |
| G4.2 penyaji | `src/app/img/[shortId]/route.ts` — Tri-Facet fallback, CSP khusus SVG, anti path-traversal | ✅ 8 tes |
| G4.4 parser | `src/components/math/math-content.tsx` (`{{img:}}`) + `src/lib/contracts/media.ts` | ✅ 16 tes |
| G4.5 picker | `src/components/media/asset-picker-modal.tsx` + `src/lib/hooks/use-media.ts` + `/api/media`, `/api/media/upload`, `/api/media/[shortId]` | ✅ 8 tes DB |
| G4.6 galeri+higiene | `src/app/(app)/assets/page.tsx` + `src/components/media/asset-gallery-view.tsx` + `/api/media/orphans` + `DELETE /api/media/[shortId]` + `removeStoredFile()` di `store.ts` | ✅ 8 tes DB + 8 tes unit |

Catatan implementasi G4.5:
- Unggahan lewat `/api/media/upload` → `uploadMedia()` (bukan `storeImage()` langsung), sehingga gambar guru **selalu terdaftar** dan tidak jadi orphan.
- Editor menyisipkan shortcode **di posisi kursor** (`insertAtCursor`), bukan menempel di akhir.
- Kolom galeri diproyeksikan eksplisit (`GALLERY_COLUMNS`) — CONSTRAINTS #34.


### Dampak Opsi D ke `ingest-media.ts`

Urutan wajib berubah: **daftarkan dulu → dapat `short_id` → baru tulis markdown**.
Ini sekaligus menutup celah ②③ karena registrasi jadi *prasyarat*, bukan langkah terpisah
yang mudah terlupa.

```
SEBELUM:  storeImage() → tulis markdown /media/{hashPath}   ← file di disk, DB kosong
SESUDAH:  storeImage() → register(media_assets) → dapat short_id
                       → tulis markdown {{img:shortId}}     ← file + DB + shortcode
```

---

## Gate penutup (constraint #3/#4)

- `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` hijau · `pnpm test:db` hijau · `pnpm build` 0
- `pnpm db:verify` hijau (bila skema berubah)
- Coverage **tidak diturunkan** (#3)
- Setiap service baru **punya konsumen** (#19)
- Tes menyentuh **jalur nyata** per peran (#37)
