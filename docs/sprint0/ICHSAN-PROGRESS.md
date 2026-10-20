# ICHSAN — SPRINT 0 / ACT-04: Eliminasi HTTP Waterfall `BundleListView`

**Issue:** MAT-119 · **Prioritas:** P0 · **Status:** selesai & terverifikasi
**Tanggal:** 2026-10-20 · **Branch:** `paperclip/dev` · **Project:** `/home/hari/projects/mathbank`

---

## 1. Akar Masalah

`BundleListView` memakai hook `useAllBundles()` (`src/lib/hooks/use-bundles.ts`) yang
menelusuri **semua** halaman `GET /api/bundles` secara **sekuensial** (`for` loop,
`PAGE = 100`, batas 50 iterasi) hanya untuk memotong 20 baris di klien.

Konsekuensi pada data nyata (577 paket): ±6 roundtrip HTTP berurutan setiap kali
`/bundles` dibuka, plus filter `status` & pencarian `q` dikerjakan di memori
(sehingga seluruh dataset harus diunduh dulu). Ini bottleneck P0 (PERF-01).

## 2. Perubahan yang Dikerjakan

### 2.1 Backend — `GET /api/bundles` (server-side filter + paginasi + agregat)

| Berkas | Perubahan |
| --- | --- |
| `src/app/api/bundles/route.ts` | Skema query `listQuerySchema` menerima `status` (`active\|draft\|review\|ready\|archived`) dan `q` (maks 120 char, di-trim). Diteruskan ke service. |
| `src/lib/services/bundle-query.ts` | `listBundles()` menerapkan `status` & `q` sebagai kondisi SQL: `eq(bundles.status, …)` dan `ILIKE` pada judul **atau** `CAST(year AS TEXT)` (meniru pencarian klien lama). `active` = semua yang belum diarsip (tanpa kondisi status). |
| `src/lib/services/bundle-query.ts` | Tambahan **4 kueri paralel dalam satu request**: total baris, halaman ini, agregat per `bundleType`, dan total `bundleItems`. Hasilnya `stats: { byType: {exam, source}, totalItems }`. |
| `src/lib/services/bundle-shared.ts` | `BundleListResult` mendapat field wajib `stats: BundleListStats`. |

Alasan `stats` di server: setelah paginasi server-side, klien hanya menerima 20 baris —
menghitung kartu statistik ("Naskah Ujian / Bank Sumber / Butir Terhimpun") dari baris
halaman akan **salah**. Agregat dihitung pada `where` yang sama, jadi tetap akurat tanpa
request tambahan.

### 2.2 Frontend — hook

| Berkas | Perubahan |
| --- | --- |
| `src/lib/hooks/use-bundles.ts` | `useAllBundles()` **dihapus** (dead hook). `useBundlesPage(params)` mengirim `status`, `q`, `limit`, `offset` dalam **satu** request + `placeholderData: keepPreviousData` agar tak flicker saat ganti halaman. `BundlesListFilter` mendapat `status` & `q`. |

### 2.3 Frontend — `BundleListView`

| Perubahan | Detail |
| --- | --- |
| Sumber data | `useAllBundles` → `useBundlesPage({ …, limit: 20, offset: page * 20 })`. |
| Pencarian | Input lokal + **debounce 300 ms** → satu request per jeda ketik (bukan per karakter). |
| Filter status | Dikirim ke server; `all` tidak mengirim parameter. |
| Statistik | Dibaca dari `stats` server (`byType.exam`, `byType.source`, `totalItems`) — bukan lagi `data.filter(…)` atas 20 baris. |
| Paginasi | `totalPages = ceil(total / 20)`, tombol Previous/Next, teks "Menampilkan X–Y dari N paket". |
| Reset halaman | `setPage(0)` saat kata kunci / status / filter URL berubah, plus jaring aman bila halaman aktif kosong (mis. data berubah di tab lain). |
| Empty state | Dipisah: `total === 0 && hasFilterActive` → "Tidak ada paket yang cocok"; `total === 0` → "Belum ada paket soal"; `total > 0 && data.length === 0` → "Halaman ini kosong" + tombol ke halaman 1 (jaring aman tanpa efek/setState). |
| Filter "Arsip" | Opsi dihapus dari dropdown status: mengarsipkan = soft-delete (`deleted_at`), jadi paket terarsip tak pernah muncul di daftar aktif — opsi itu akan selalu kosong. |
| Grid & tabel | Keduanya merender `data` (halaman dari server), bukan `paged` hasil slice klien. |

### 2.4 Alat verifikasi

`scripts/verify-act04.mjs` — skrip Playwright sekali pakai: login demo, buka `/bundles`,
lalu mencatat **setiap** request `/api/bundles` pada tiap aksi (buka, Next, cari, filter
status). Dipakai untuk membuktikan DoD "1 request per halaman" secara empiris:

```bash
node scripts/verify-act04.mjs http://127.0.0.1:3010
```

## 3. Verifikasi

Lingkungan: dev server proyek di `http://127.0.0.1:3010` (Next.js 16.3.8, DB `mathbank` :5433),
login demo `admin` (cookie sesi better-auth nyata).

**a. Statis**

- `npx tsc --noEmit` → **exit 0**, tanpa error.
- `npx eslint` pada 4 berkas yang disentuh → **bersih** (termasuk aturan
  `react-hooks/set-state-in-effect`: jaring aman halaman kosong dibuat tanpa efek,
  memakai cabang render).
- `grep -rn useAllBundles src` → **0 hasil** (hook benar-benar terhapus).

**b. Runtime API** (`GET /api/bundles`, cookie sesi nyata)

| Request | Hasil terukur |
| --- | --- |
| `?status=active&limit=20&offset=0` | `items=20`, `total=577`, `stats={byType:{exam:0,source:577}, totalItems:12336}` |
| `?limit=20&offset=20` | `items=20`, item pertama berubah → paginasi server benar |
| `?q=2024&limit=5` | `items=5`, `total=15`, `stats.totalItems=395` → pencarian server (judul **atau** tahun) |
| `?q=matematika&limit=5` | `total=195`, `stats.totalItems=5675` → statistik ikut filter |
| `?status=draft&limit=3` | `total=577` → benar (DB dev 100% `draft`) |
| `?status=ready&limit=5` | `total=0` → filter status benar |
| `?bundleType=exam&limit=5` | `total=0` (semua paket dev = `source`) |
| `?q=zzzznotfound&limit=5` | `total=0`, `stats` nol |

**c. Bukti "satu request" di browser** (`scripts/verify-act04.mjs`, Playwright + `page.on("request")`)

| Aksi | Request `/api/bundles` | URL |
| --- | --- | --- |
| Buka `/bundles` | **1** | `?limit=20&offset=0` |
| Klik "Berikutnya" | **1** | `?limit=20&offset=20` |
| Ketik "matematika" (debounce 300 ms) | **1** | `?q=matematika&limit=20&offset=0` |
| Pilih status "Draf" | **1** | `?status=draft&q=matematika&limit=20&offset=0` |

Hasil render yang sama: `20 dari 577 paket · hal. 1/29`, kartu grid = 20, tabel = 20 baris,
indikator halaman `hal. 2/29` setelah Next, dan setelah pencarian `20 dari 195 paket · hal. 1/10`
dengan kartu statistik ikut berubah (195 / 0 / 195 / 5675). **Tidak ada error konsol**
(hidrasi bersih), termasuk pada viewport 390×844 (mobile).

Sebelumnya: `useAllBundles` menembak ±6 request berurutan (577 paket ÷ 100) untuk
halaman yang sama, lalu memotong 20 baris di klien.

## 4. DoD

- [x] `/bundles` hanya 1 request HTTP per halaman (20 item) — dibuktikan di browser
- [x] Tidak ada loop sekuensial (tidak ada waterfall)
- [x] `useAllBundles` dihapus (`grep` = 0 hasil)
- [x] Parameter `?status=&q=&limit=&offset=` didukung `GET /api/bundles`
- [x] UI paginasi Previous/Next berfungsi (29 halaman pada data dev)
- [x] Kartu statistik tetap akurat tanpa request tambahan (`stats` di amplop)
- [x] `tsc --noEmit` & `eslint` bersih

## 5. Catatan untuk Rofik (QA)

Area yang layak ditutup tes:

1. `listBundles()` — filter `status`/`q`, amplop `stats`, dan bahwa `total` tidak
   terpengaruh `limit`.
2. `useBundlesPage` — pembentukan query string (limit/offset/status/q).
3. `BundleListView` — perilaku paginasi (reset ke halaman 1 saat filter berubah) dan
   empty state ganda.

---

## 6. Verifikasi Ulang (heartbeat lanjutan)

Dijalankan ulang pada dev server `http://127.0.0.1:3010` (Next.js 16, DB `mathbank`
:5433, login demo `admin`) untuk mengonfirmasi hasil commit `9a1c8a5` + `492c8db`.

**Statis:** `npx tsc --noEmit` → **exit 0**; `grep -rn useAllBundles src/` → **0 hasil**.

**Runtime (Playwright, hitung request jaringan nyata):**

| Aksi | Request `/api/bundles` | Bukti |
| --- | --- | --- |
| Buka `/bundles` | **1** | `GET /api/bundles?limit=20&offset=0` |
| Render awal | — | 20 kartu · "20 dari 577 paket · hal. 1/29" |
| Klik **Berikutnya** | **1** | `GET /api/bundles?limit=20&offset=20` → "hal. 2/29" |
| Klik **Sebelumnya** | **0** (cache) | kembali "hal. 1/29" |
| Cari "matematika" | **1** | `GET /api/bundles?q=matematika&limit=20&offset=0` → "20 dari 195 paket · hal. 1/10" |
| Filter status Draf | **1** | `GET /api/bundles?status=draft&q=matematika&limit=20&offset=0` |

Konsol browser: **tidak ada error** (0 hydration/console error). Total request
`/api/bundles` untuk satu sesi buka + next + prev = **2** (bukan 50). Waterfall
sekuensial benar-benar hilang.

**Kesimpulan:** DoD ACT-04 terpenuhi dan terverifikasi ulang pada kode yang sudah
di-commit. Tidak ada pekerjaan tersisa untuk Ichsan; siap diserahkan ke Rofik (QA)
bila ingin menambah cakupan tes otomatis.

## 6. Re-verifikasi Independen (2026-10-20, heartbeat lanjutan)

Dijalankan ulang dari *working tree* saat ini (bukan mengandalkan catatan run sebelumnya)
untuk memastikan DoD masih terpenuhi pasca-commit `9a1c8a5` + `492c8db`.

| Pemeriksaan | Perintah | Hasil |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | **exit 0** (bersih) |
| Hook mati benar-benar hilang | `grep -rn useAllBundles src scripts` | **0 hasil** |
| Dev server | `next dev --turbopack -p 3010` | Ready, `/api/health` → **200** |
| Bukti browser | `node scripts/verify-act04.mjs http://127.0.0.1:3010` | lihat tabel di bawah |

Keluaran `verify-act04.mjs` (Playwright, `page.on("request")`, login demo `admin` → 200):

| Aksi | Request `/api/bundles` | URL |
| --- | --- | --- |
| Buka `/bundles` | **1** | `?limit=20&offset=0` |
| Klik "Berikutnya" | **1** | `?limit=20&offset=20` |
| Cari "matematika" (debounce) | **1** | `?q=matematika&limit=20&offset=0` |
| Filter status "Draf" | **1** | `?status=draft&q=matematika&limit=20&offset=0` |

- Indikator halaman setelah Next: `hal. 2/29` (577 paket ÷ 20 = 29 halaman) → paginasi nyata.
- Setelah pencarian: `20 dari 195 paket · hal. 1/10` → filter & total dihitung server.
- Konsol browser: **tidak ada error** (tidak ada hydration mismatch).
- Catatan: pada pengambilan pertama skrip sempat membaca `0 dari 0 paket` karena query halaman
  belum selesai dikompilasi/dimuat (filesystem lambat, compile awal ±36 s); nilai benar
  (`hal. 2/29`, `20 dari 195`) muncul pada aksi berikutnya. Bukan regresi fungsional.

**Kesimpulan:** DoD ACT-04 tetap terpenuhi — 1 request HTTP per halaman, tanpa loop
sekuensial, `useAllBundles` terhapus, paginasi & filter server-side berfungsi.
