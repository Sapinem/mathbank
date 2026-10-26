# ADR-0026 — Deklarasi otorisasi eksplisit per method route

- **Status:** Diterima
- **Tanggal:** 2026-10-26
- **Pengambil keputusan:** pemilik produk + audit `/api-and-interface-design` (Fase A)
- **Terkait:** ADR-0022 (pipa `wrapRoute`), CONSTRAINT #35, `docs/KONTRAK-API.md`

## Konteks

`wrapRoute` menerima `permission?: Permission` yang **opsional**. Akibatnya ada tiga
keadaan yang tak bisa dibedakan dari "lupa mengisi":

1. gerbang izin memang di route (`permission: "question:view"`),
2. otoritas sengaja ditegakkan di service karena izinnya ber-`own` (butuh `ownerId`),
3. route memang publik.

Peninjau hanya bisa menebak dari komentar — dan komentar bisa basi. Itu bukan
kemungkinan teoretis: `src/app/api/bundles/route.ts` pernah menuliskan alasan yang
tidak lagi sesuai kode. Yang lebih serius, tiga cacat otorisasi hidup berdampingan
dengan komentar yang meyakinkan:

- **14 endpoint 403 ke guru/penelaah/agen.** `taxonomy:manage` (8 method) dan
  `reference:manage` (6 method) bernilai `own`, padahal tabel `topics`/`tags`/
  `sources`/`events` **tidak punya kolom pemilik**. `assertCan(actor, perm)` di
  gerbang route dipanggil tanpa `ownerId` → `own` selalu ditolak (CONSTRAINT #35).
  Artinya fitur taksonomi & referensi **mati untuk semua peran non-admin**.
- **Mesin 403 pada antreannya sendiri.** `GET /api/v1/ingest/queue` memakai
  `question:view`, sedangkan `PERMISSIONS["question:view"].machine === "no"` →
  pipeline ingest tak bisa membaca antrean yang ia isi sendiri.

Keduanya lolos karena tidak ada yang **memeriksa** deklarasi terhadap matriks dan
terhadap kode service. Tes yang ada memanggil service langsung, bukan route
(#37), sehingga gerbang route tak pernah diuji.

## Keputusan

**Otorisasi dideklarasikan per method, wajib, dan diverifikasi mesin.**

`RouteOptions.authz: Authz` **wajib** (bukan opsional, bukan alias dari `permission`),
dengan empat bentuk:

| Bentuk | Arti | Ditegakkan di |
|---|---|---|
| `{ kind: "route", permission }` | gerbang izin di route | `wrapRoute` → `assertCan` |
| `{ kind: "service", enforcedIn, routeGate? }` | otoritas di service yang punya `ownerId` | service; `routeGate` (bila ada) tetap di route |
| `{ kind: "authenticated" }` | cukup login | `wrapRoute` |
| `{ kind: "public", reason }` | tanpa login | tidak ada — karena itu wajib beralasan |

Pengaman berlapis:

1. **Tipe.** `NonOwnPermission` mengecualikan izin ber-`own` dari `route`/`routeGate`;
   route tanpa `authz` gagal `typecheck`.
2. **Pemeriksa** (`scripts/check-authz.ts`, `pnpm lint:authz`, masuk `pnpm check`)
   memindai `src/app/api/**/route.ts` dengan pencocokan kurung (bukan regex yang
   berhenti di `});` pertama) dan memeriksa: tepat satu `authz`; `public` ber-`reason`
   **dan** terdaftar di `PUBLIC_ROUTES`; izin gerbang ada di matriks **dan tidak
   ber-`own` untuk peran mana pun**; `enforcedIn` menunjuk berkas+fungsi nyata yang
   badannya memuat `assertCan(`/`assertBundle*`/`hasRole(`/`ForbiddenError`.
3. **Allowlist.** Route yang sengaja tidak memakai `wrapRoute` (health, ready,
   metrics, mcp, quick-login, auth catch-all) terdaftar di `MANUAL_ROUTES` **dengan
   alasan tertulis**; route baru yang melewati pembungkus langsung gagal.

Koreksi matriks yang menyertai:

- `taxonomy:manage` dan `reference:manage` → `"yes"` untuk teacher/reviewer/agent
  (tabelnya tak punya pemilik; `own` di sana mustahil dipenuhi). `machine` tetap
  `"yes"` untuk taksonomi dan `"no"` untuk referensi.
- Izin baru `ingest:queue:read` (machine `"yes"`, manusia `"yes"`) untuk antrean
  ingest. **`question:view` tidak dilonggarkan** untuk `machine` — melonggarkannya
  akan membuka seluruh bank soal ke pipeline.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|---|---|
| Tetap `permission` opsional + komentar penjelas | Tidak bisa diverifikasi; justru inilah akar dua bug di atas |
| `permission` dipertahankan sebagai alias `authz` | Dua jalan menuju satu tujuan; pemeriksa harus menangani keduanya dan bisa dilewati |
| Gerbang `own` di route dengan mengambil `ownerId` lebih dulu | Menduplikasi otoritas service, menambah query, dan tetap salah untuk operasi massal (`batch`) yang izinnya berbeda per butir |
| Tambah kolom pemilik di `topics`/`tags`/`sources`/`events` | Perubahan skema besar untuk konsep yang memang bukan milik siapa pun; `own` di sana salah secara domain |
| Longgarkan `question:view` untuk `machine` | Membuka seluruh bank soal (termasuk kunci jawaban yang diproyeksikan) ke pipeline; izin sempit lebih benar |

## Konsekuensi

**Positif:**

- Otorisasi setiap method terbaca dari kode, bukan dari komentar, dan **diperiksa**
  tiap `pnpm check`.
- Dua bug hidup tertutup: taksonomi/referensi bisa dipakai guru & agen; mesin bisa
  membaca antreannya sendiri.
- Komentar basi tertangkap mesin: `enforcedIn` harus menunjuk fungsi yang benar-benar
  memeriksa izin.
- Hitungan route tidak lagi ditulis tangan di tes (48/60 dihapus); semuanya
  diturunkan dari filesystem.

**Negatif / utang:**

- Diff besar tapi mekanis (42 berkas route). Risiko utama salah `kind` → route lebih
  longgar; dimitigasi default-deny (tanpa `authz` = gagal compile) + allowlist publik.
- `route-inventory.ts` adalah pemindai teks, bukan AST TypeScript: ia mengenali
  bentuk yang dipakai repo ini (`export const M = wrapRoute({...})`, fungsi manual,
  delegasi). Pola eksotis baru (mis. menyusun opsi lewat spread) akan ditolak
  eksplisit — itu disengaja, bukan celah diam-diam.
- `kind: "authenticated"` tidak di-allowlist; risiko salah pakainya rendah (masih
  butuh login) tetapi tidak nol.

## Catatan

- Modul: `src/lib/api/authz.ts`, `src/lib/api/route-inventory.ts`.
- Pemeriksa: `scripts/check-authz.ts` (`pnpm lint:authz`).
- Tes: `src/lib/api/authz-coverage.test.ts` (25 kasus, termasuk negatif),
  `src/lib/api/ingest-authz.db.test.ts`, `src/lib/api/reference-authz.db.test.ts`.
- Bukti pra-perbaikan (dijalankan 2026-10-26): dengan matriks lama + `question:view` di
  route antrean, **5 tes baru gagal (403)** — 4 endpoint taksonomi/referensi + 1 antrean
  mesin — sementara **3 tes "harus tetap tertutup" tetap lolos** (machine → `/api/sources`
  403, machine → `/api/questions` 403, machine upload 201). Setelah perbaikan: 8/8 lolos.
