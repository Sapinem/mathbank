# ADR-0027 — Kontrak OpenAPI dihasilkan dari kode, bukan ditulis tangan

- **Status:** Diterima
- **Tanggal:** 2026-10-27
- **Pengambil keputusan:** pemilik produk + rencana remediasi API (Fase B)
- **Terkait:** ADR-0022 (pipa `wrapRoute`), ADR-0026 (deklarasi otorisasi), CONSTRAINT #17, #31, #44

## Konteks

Sebelum ADR ini, "kontrak API" hidup di **empat** tempat yang bisa saling menyimpang:

1. kode route (`src/app/api/**/route.ts`) — yang benar-benar berjalan;
2. `docs/KONTRAK-API.md` §4 — tabel 73 method yang disunting tangan;
3. `src/lib/api/zod-hardening.test.ts` — angka `48`/`60` yang ditulis tangan;
4. kepala dokumen yang menyebut jumlah route.

Fase A (ADR-0026) sudah membuat daftar method + otorisasi **terbaca mesin**
(`route-inventory.ts`), tetapi skema query/body dan bentuk respons masih hanya
ada di kode. Akibatnya:

- tidak ada spesifikasi mesin yang bisa dipakai klien, generator SDK, atau
  Postman/Insomnia;
- tabel dokumen tetap bisa basi: menambah route tanpa menyunting dokumen tidak
  menggagalkan gerbang apa pun;
- menambah field ke skema Zod tidak memberi sinyal apa pun bahwa dokumen
  (atau artefak turunan) perlu diperbarui.

Menulis `openapi.yaml` dengan tangan akan menambah sumber kebenaran kelima, yaitu
persis masalah yang ingin dihapus.

## Keputusan

**Kontrak OpenAPI disusun dari tiga sumber yang sudah ada, lalu diverifikasi
mesin.** Tidak ada spesifikasi tulis-tangan.

| Bagian spec | Sumber | Sifat |
|---|---|---|
| daftar path + method + `authz` | `src/lib/api/route-inventory.ts` (pemindaian sumber) | diturunkan |
| skema `query`/`body`/`params`, status sukses, idempotensi | `ROUTE_DECLARATION` yang ditempel `wrapRoute` ke handler — **skema yang sama** dengan yang dipakai runtime | diturunkan |
| ringkasan, tag, skema respons, galat tambahan, catatan | `src/lib/api/openapi/registry.ts` | ditulis manusia, **wajib** per method |

Mekanismenya:

1. **`wrapRoute` menempel deklarasi ke handler** lewat
   `Object.defineProperty(handler, Symbol.for("mathbank.routeDeclaration"), { enumerable: false })`.
   Tidak ada map global kedua yang bisa lupa diperbarui; deklarasi menempel pada
   fungsi yang benar-benar diekspor route.
2. **`buildOpenApi()` murni** (`src/lib/api/openapi/spec.ts`) — tanpa fs, tanpa DB,
   sehingga bisa diuji unit. Ia mengubah Zod → JSON Schema 2020-12 dengan
   `z.toJSONSchema(schema, { io: "input" })` lalu membuang `$schema` rekursif
   (OpenAPI 3.1 menolak kata kunci itu di dalam schema objek).
3. **`scripts/generate-openapi.ts`** mengimpor modul route, mengumpulkan
   deklarasi, lalu menulis **dua artefak**:
   - `public/openapi.json` — disajikan statis di `/openapi.json` (tanpa route Next,
     jadi tanpa biaya render);
   - blok `<!-- BEGIN:GENERATED:endpoints -->` … `<!-- END:GENERATED:endpoints -->`
     di `docs/KONTRAK-API.md` §4 — tabel per tag, satu baris per operasi.
4. **Gerbang `pnpm openapi:check`** (masuk `pnpm check`) gagal bila salah satu
   artefak menyimpang, atau bila ada method tanpa entri registry. Skrip ini
   **tidak butuh `.env`**: `scripts/openapi-env.ts` mengisi `DATABASE_URL`
   placeholder karena generator hanya membaca skema, tidak pernah menyentuh DB.
5. **Uji relasional** `src/lib/api/openapi/registry.test.ts` menjaga hal yang tidak
   bisa dijaga gerbang byte: registry ↔ filesystem dua arah (tak ada operasi
   yatim), tag sah, kode galat wajar, setiap parameter path dideklarasikan,
   envelope galat tak pernah memuat `data` (CONSTRAINT #17), dan tabel §4 memuat
   tepat satu baris per operasi.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| `openapi.yaml` tulis tangan | Sumber kebenaran kelima; basi tanpa gejala. |
| Generator pihak ketiga (`next-openapi-gen`, `zod-to-openapi` penuh) | Menambah dependensi + konvensi sendiri untuk hal yang bisa disusun dari deklarasi yang sudah ada; `zod` 4 sudah menyediakan `toJSONSchema`. |
| Route `/api/openapi.json` yang menyusun spec saat request | Spec jadi dinamis padahal isinya statis; menambah permukaan serang dan biaya render. Artefak statis cukup. |
| Anotasi JSDoc per handler | Tidak bisa diverifikasi mesin; ringkasan tetap bisa bohong. Registry + uji relasional lebih ketat. |
| Menyerahkan dokumen ke `wrapRoute` saja (tanpa registry) | Bentuk respons tidak terbaca dari kode (service mengembalikan objek Drizzle); ringkasan/tag butuh tempat menulis. |

## Konsekuensi

**Positif**

- `/openapi.json` bisa langsung dipakai klien, generator SDK, dan alat uji.
- Menambah route tanpa entri registry = gagal `openapi:check` (bukan temuan audit
  berbulan-bulan kemudian).
- Mengubah skema Zod tanpa regenerasi = gagal `openapi:check`.
- Tabel §4 KONTRAK-API tak bisa lagi disunting tangan tanpa ketahuan.

**Biaya & batas**

- **Registry wajib diisi** untuk setiap method baru. Itu memang tujuannya, tetapi
  menambah friksi: 73 entri harus lengkap sebelum `pnpm check` hijau.
- `public/openapi.json` berukuran **≈810 KB** karena skema dibiarkan **inline** per
  operasi (tanpa `$ref` ke `components.schemas`). Belum dioptimalkan; bila ukuran
  mengganggu, langkah berikutnya adalah hoisting skema identik ke
  `components.schemas` — perubahan murni pada `spec.ts`, tanpa mengubah registry.
- Route **non-wrap** (9 method: health, ready, metrics, mcp×3, quick-login,
  auth catch-all×2) didokumentasikan manual di `MANUAL_OPERATIONS`; skemanya tidak
  berasal dari Zod karena route itu memang tak memakai `wrapRoute`.
- Parameter catch-all `/api/auth/{all}` dideklarasikan sebagai satu parameter
  string; OpenAPI tidak punya notasi untuk "sisa jalur" sehingga beberapa segmen
  (`sign-in/email`) tidak terepresentasi persis.
- Spesifikasi ini **tidak** menjanjikan bentuk respons non-JSON (mis. ekspor
  Moodle berupa berkas) — hanya `application/json`.

## Catatan Verifikasi

Semua angka di bawah berasal dari eksekusi nyata (2026-10-27), bukan perkiraan.

| Perintah | Hasil |
|---|---|
| `pnpm openapi:generate` | `public/openapi.json` — **73 operasi / 48 path**, tabel §4 diperbarui |
| `pnpm openapi:check` | `✅ OpenAPI sinkron` |
| `pnpm openapi:check` setelah artefak dirusak (`printf 'x' >> public/openapi.json`) | **rc=1**, pesan “menyimpang dari registry” — gerbang terbukti menggigit |
| `pnpm openapi:check` dengan `DATABASE_URL=` kosong | lulus (bukti placeholder benar-benar membuat gerbang bebas `.env`) |
| `npx vitest run src/lib/api/openapi` | **27/27 lulus** (`registry.test.ts` 19 + `spec.test.ts` 8) |
| `npx vitest run src/lib/api/route-inventory.test.ts` | **29/29 lulus** (fixture berkas route di direktori sementara) |
| `npx vitest run --coverage` | **1353 lulus**, cakupan 90.39 / 81.84 / 92.23 / 92.91 (ambang 90/80/88/92) |
| `pnpm test:db` | **284 lulus** (25 berkas) |
| `pnpm theme:check && pnpm lint:names && pnpm lint:authz && pnpm typecheck && pnpm lint` | semuanya lulus |
| `pnpm build` | lulus |
| `npx next start -p 3099` → `curl /openapi.json` | **200**, `application/json`, 828.458 byte (sama dengan berkas) |

### Perbaikan yang ikut terbawa

`RouteFile` di `src/lib/api/route-inventory.ts` kini membawa `problems` dan
`verifyAuthz` melaporkannya. Sebelumnya `scanRoutes()` membuang `problems` hasil
`scanFile`, sehingga cacat seperti **dua `authz`**, **kunci warisan**,
**spread pada opsi**, **`route.ts` tanpa method**, dan **argumen `wrapRoute`
bukan objek** **tidak pernah dilaporkan** `pnpm lint:authz`. Ditemukan saat
menulis uji pemindai di Fase B; ditutup di sini dan dijaga 12 uji baru di
`route-inventory.test.ts`.
