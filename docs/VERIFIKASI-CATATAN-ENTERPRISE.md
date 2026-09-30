# VERIFIKASI — Catatan Penyempurnaan Enterprise

> **Pemicu:** pemilik meminta membahas `CATATAN-PENYEMPURNAAN-ENTERPRISE.md`.
> **Metode:** verifikasi tiap dari 6 rekomendasi ke kode + **uji nyata**. **Hasil:**
> 1 rekomendasi = **bug nyata** (slug overflow → 500), 2 = **sudah sebagian ada**,
> 3 = **belum relevan / opsi**, beberapa klaim perlu **koreksi**.

## Ringkasan verdict

| # | Rekomendasi | Kenyataan kode | Verdict |
|:-:|-------------|----------------|:-------:|
| 1 | `db.transaction` mutasi multi-tabel | `createQuestion`/`updateQuestion` **sudah** `db.transaction` | ✅ **sudah** |
| 2 | `slugify` batas panjang per-tabel | `slugify` **selalu** `slice(0,255)`; `tags.slug`=**100** | 🔴 **BUG NYATA** |
| 3 | `"use cache"` Next 16 | belum ada; `cacheComponents`/`dynamicIO` **belum diaktifkan** | 🟡 opsi (prasyarat) |
| 4 | `Idempotency-Key` | belum ada | 🟡 opsi |
| 5 | Sanitasi SVG TikZ + CSP ketat | CSP **sudah ada** (dgn `'unsafe-inline'`); **TikZ belum dibangun** (stub 11 baris) | ⚠️ **belum relevan** |
| 6 | `requestId` / `X-Request-ID` | belum ada | 🟡 opsi |

---

## 🔴 #2 — BUG NYATA: `slugify` menulis 255 char ke kolom `varchar(100)`

`src/lib/taxonomy/tree.ts:42-48` — `slugify()` **selalu** `.slice(0, 255)`.
Namun `tags.slug` = `varchar(100)` (`taxonomy.ts:93`). Nama tag dibatasi 100 char,
**tetapi `slugify` bisa MEMPERPANJANG** karena `normalize("NFKD")` memekarkan
ligatur/karakter gabung (mis. `ﬃ` → `ffi`, `ǅ` → `Dž`).

**Bukti perhitungan:** `slugify("ﬃ".repeat(100)).length` = **255** (dari nama 100).
**Bukti LIVE** (`b.iyo.my.id`): `POST /api/tags {"name":"ﬃ"×60}` →
**HTTP 500** + log server:
```
[cause]: value too long for type character varying(100)
file: 'varchar.c'
```
→ **bukan** 400 ramah, tapi **500** (cacat). Dokumen **akurat**.

**Perbaikan:** `slugify(name, maxLength = 255)`; panggil dengan batas kolom:
`tags`=100, `topics/sources/bundles`=255. Buang trailing `-` **setelah** slice
(saat ini `-` dibuang **sebelum** slice → bisa menyisakan `-` ekor).

## ⚠️ #5 — CSP ada, tetapi TikZ belum dibangun (koreksi)

- CSP **sudah** diterapkan (`next.config.ts:74`) — dokumen mengesankan belum. Namun
  memakai `'unsafe-inline'` (didokumentasikan sengaja "pragmatis"). **Pengerasan
  sejati** (nonce) belum.
- **TikZ belum ada** — `src/app/(app)/studio/tikz/page.tsx` hanya **stub 11 baris**;
  tak ada rendering SVG/`dangerouslySetInnerHTML` untuk TikZ. → **Sanitasi SVG belum
  relevan.** Yang ada: `math-content.tsx` (KaTeX).
- **Catatan kecil**: `renderMath` cabang `catch` meng-interpolasi `value` **tanpa
  escape** ke HTML (baris 69). Namun dengan `throwOnError:false`, KaTeX **terbukti
  tak melempar** untuk input berbahaya → jalur praktis **tak tercapai**. Tetap
  disarankan escape sebagai pertahanan berlapis.

## 🟡 #3 — `"use cache"` butuh prasyarat (koreksi)

`"use cache"` Next.js 16 memerlukan **`cacheComponents: true`** (eksperimental) di
`next.config.ts`. Saat ini **belum diaktifkan** → direktif tak akan berfungsi apa
adanya. Juga berisiko: caching pada `taxonomy-service` **harus** dibarengi
`revalidateTag` di SEMUA jalur mutasi (kita baru menambah `cleanUnusedTags` dsb.) —
salah kelola = **data basi** di UI. **Opsi**, bukan cacat.

## Kesimpulan
Dari 6 rekomendasi: **hanya #2 yang cacat nyata & mendesak** (500 pada input sah).
#3/#4/#6 = **opsi peningkatan** (feasible, bukan bug). #5 = **koreksi** (CSP sudah ada;
TikZ belum dibangun). #1 = **sudah baik**.

---

## 3. PELAKSANAAN (2026-09-30)

### ✅ #2 slugify — DIPERBAIKI & terbukti live
`slugify(name, maxLength = 255)`; `tags`→100, `events.code`→50; buang `-` ekor
**sesudah** potong. Live: tag nama ligatur panjang → **409** (dulu **500**).

### ✅ #6 X-Request-ID — DITERAPKAN & terbukti live
`wrapRoute` membuat/meneruskan `requestId`, menyetel header `X-Request-ID` pada
**semua** respons (sukses & error) + menyertakannya di log 500. Live: header ada ✅.

### ✅ #4 Idempotency-Key — DITERAPKAN & terbukti live
Modul `src/lib/api/idempotency.ts` (store in-memory, siap-swap Redis) + opsi
`idempotent: true` di `wrapRoute`. Diaktifkan pada `POST /api/questions` &
`POST /api/bundles`. Live: 2× POST key sama → **id SAMA** + header
`Idempotent-Replay: true` (satu baris dibuat) ✅.

### ⛔ #3 `"use cache"` — DITELAAH, **DIBATALKAN** (keputusan sadar, bukan gagal)
`cacheComponents: true` **berhasil** diaktifkan (build 0) + guard layout dipindah ke
`<Suspense>`. **Namun dua efek samping nyata membuatnya tak layak sekarang:**
1. **Data basi (SWR).** `revalidateTag(tag,'max')` = *stale-while-revalidate* →
   **terbukti live**: topik baru tak muncul **~2–5 detik**. `updateTag`
   (read-your-own-writes) **hanya** bisa di Server Action, **bukan** Route Handler.
   Untuk UI admin taksonomi → **UX turun** (selalu-segar sebelumnya).
2. **Guard kehilangan 307.** Guard dlm `<Suspense>` → pengalihan jadi navigasi
   **klien** (HTTP 200 + `NEXT_REDIRECT`), **bukan 307 server** → smoke test gagal.

**Keputusan:** **revert #3** — `cacheComponents` & cache referensi dibatalkan;
guard dikembalikan (307 server). Alasan: **nol manfaat nyata** untuk daftar
referensi (sudah di-cache klien via React Query) tapi **menambah risiko data basi +
melemahkan guard**. Selaras prinsip proyek: *"jangan tambal sulam"* — tak memaksakan
fitur yang menurunkan mutu. **#3 dicatat sebagai kandidat M8+** untuk target yang
**memang statis** (mis. data referensi ekspor cetak/PDF), bila ada cache handler
persisten.

**Bukti:** build 0 (30 halaman), smoke **7/7**, 269 unit + 86 DB, tsc 0, lint 0.

---
*Lihat juga: `docs/audit/CATATAN-PENYEMPURNAAN-ENTERPRISE.md`, `CONSTRAINTS.md`,
`docs/KEAMANAN.md`.*
