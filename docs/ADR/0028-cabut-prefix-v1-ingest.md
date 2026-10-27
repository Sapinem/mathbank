# ADR-0028 — Cabut prefix `v1` dari jalur ingest (alias 90 hari)

- **Status:** Diterima
- **Tanggal:** 2026-10-27
- **Pengambil keputusan:** pemilik produk + rencana remediasi API (Fase C)
- **Terkait:** ADR-0022 (`wrapRoute`), ADR-0026 (deklarasi otorisasi), ADR-0027 (kontrak OpenAPI), `docs/KONTRAK-API.md` §8

## Konteks

Seluruh API MathBank tidak memakai prefix versi (`/api/questions`, `/api/bundles`,
`/api/topics`, …) — **kecuali** tiga endpoint ingest yang hidup di
`/api/v1/ingest/*`. Perbedaan ini tidak pernah membawa manfaat: tidak ada `v2`
yang direncanakan, dan tidak ada endpoint lain yang mengikuti pola itu.

Yang ditimbulkan justru biaya:

1. **Dua konvensi yang harus diingat** klien, dokumentasi, dan generator kontrak.
   `docs/KONTRAK-API.md` §8 dulu berstatus “BELUM DIPUTUSKAN” dan meminta agen
   “jangan menambah prefix versi baru” — aturan yang hanya ada karena ambiguitas ini.
2. **Kesalahan klasifikasi.** Prefix `v1` membuat jalur ingest tampak lebih stabil
   daripada API lain, padahal keduanya diikat kontrak yang sama (`wrapRoute`,
   envelope `{ data }`, matriks izin).
3. **Kontrak mesin jadi bercabang.** Generator OpenAPI harus menampung dua gaya
   path sekaligus, dan pembaca spec mengira ada dua versi API.

Klien ingest yang sudah berjalan (skrip korpus, runner eksternal) memakai jalur
lama, jadi pencabutan **tanpa masa transisi** akan memutus mereka.

## Keputusan

**Jalur kanonik dipindah ke `/api/ingest/*`; `/api/v1/ingest/*` menjadi alias
deprecated yang berakhir 2027-01-25 (90 hari).**

| Jalur | Peran |
|---|---|
| `POST /api/ingest/upload` | kanonik |
| `GET /api/ingest/queue` | kanonik |
| `POST /api/ingest/commit` | kanonik |
| `POST /api/v1/ingest/upload` | alias deprecated |
| `GET /api/v1/ingest/queue` | alias deprecated |
| `POST /api/v1/ingest/commit` | alias deprecated |

Bentuk alias:

```ts
// src/app/api/v1/ingest/upload/route.ts
import { POST as canonicalHandler } from "@/app/api/ingest/upload/route";
import { ingestV1Alias } from "@/lib/api/deprecation";

export const POST = ingestV1Alias(canonicalHandler);
```

`ingestV1Alias` **tidak menyalin logika** — ia memanggil handler kanonik lalu
menambahkan tiga header pada respons yang sama:

```http
Deprecation: true
Sunset: Mon, 25 Jan 2027 00:00:00 GMT
Link: </api/ingest>; rel="successor-version"
```

Konsekuensinya penting: rate limit, idempotensi (`Idempotency-Key`), gerbang izin,
envelope, dan `Cache-Control` tetap berasal dari `wrapRoute` kanonik. Alias tak
bisa menyimpang karena tak punya kode sendiri.

Karena alias bukan `wrapRoute`, ia terdaftar di `MANUAL_ROUTES` (allowlist
pemeriksa otorisasi) dan di `MANUAL_OPERATIONS` dengan `deprecated: true` — jadi
`/openapi.json` menampilkan jalur lama sebagai usang, bukan menyembunyikannya.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Hapus `/api/v1/ingest/*` seketika | Memutus klien mesin yang sudah berjalan tanpa peringatan; tak ada cara mereka tahu. |
| Salin isi handler ke alias | Dua salinan logika → perbaikan bug hanya masuk ke satu jalur. Persis kelas masalah yang ADR-0026/0027 hapus. |
| Alias lewat `rewrites()` di `next.config.ts` | Tak terlihat oleh inventaris route, pemeriksa `authz`, dan generator OpenAPI — alias jadi jalur gelap yang tak diuji. |
| Naikkan semua API ke `/api/v1` | Memecah **seluruh** klien UI sekaligus, untuk keuntungan kosmetik. |
| Pertahankan `v1` selamanya | Mempertahankan dua konvensi tanpa alasan; `v2` tak pernah direncanakan. |
| Alias tanpa header, hanya dokumentasi | Klien yang tidak membaca dokumen tak akan tahu. Header terlihat oleh mesin. |

## Konsekuensi

**Positif**

- Satu konvensi path di seluruh API; `docs/KONTRAK-API.md` §8 tak lagi ambigu.
- Klien lama tetap jalan, tapi **diberi tahu mesin** (bukan hanya lewat dokumen).
- Alias diuji paritas: status, body, dan header kanonik harus identik.
- Setelah 2027-01-25 penghapusan alias = hapus 3 berkas re-export, tanpa menyentuh domain.

**Biaya & batas**

- Selama 90 hari ada **dua jalur hidup** untuk tiga operasi. Beban uji bertambah
  (satu tes paritas per alias; saat ini tes paritas untuk `queue`).
- `Deprecation: true` mengikuti RFC 9745 yang masih relatif baru; klien yang hanya
  membaca `Sunset` tetap mendapat informasi yang cukup.
- Alias tidak menambahkan rate limit sendiri — batasnya sama dengan kanonik, jadi
  panggilan lewat alias **dan** kanonik berbagi kuota yang sama (memang diinginkan).
- Tanggal `Sunset` adalah komitmen: setelah itu alias dihapus, bukan diperpanjang
  diam-diam. Bila perlu diperpanjang, itu keputusan baru + ADR baru.

## Catatan Verifikasi

| Perintah | Hasil |
|---|---|
| `pnpm lint:authz` | **76 method di 51 route** (alias terdaftar di `MANUAL_ROUTES`) |
| `pnpm openapi:generate` | **76 operasi / 51 path**; tiga alias bertanda `deprecated: true` |
| `npx vitest run src/lib/api/deprecation.test.ts` | **4/4 lulus** (status/body/header diteruskan, `Sunset` tepat 90 hari) |
| `pnpm test:db` | lulus, termasuk tes paritas alias `queue` (status, body, tiga header) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | lulus |
| `pnpm test:coverage` | **1359 lulus**, cakupan 90.43 / 81.85 / 92.25 / 92.95 |
| `next start` → `curl /api/v1/ingest/queue` | **401**, plus `deprecation: true`, `sunset: Mon, 25 Jan 2027 00:00:00 GMT`, `link: </api/ingest>; rel="successor-version"` |
| `next start` → `curl /api/ingest/queue` | **401**, **tanpa** header deprecation; body kedua jalur **identik** (dibandingkan byte-per-byte) |

Tes paritas membandingkan respons alias dengan respons kanonik pada permintaan yang
sama, sehingga perbedaan sekecil apa pun (termasuk `Cache-Control`) akan gagal.
