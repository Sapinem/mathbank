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
| Empty state | Dipisah: `total === 0 && hasFilterActive` → "Tidak ada paket yang cocok"; `total === 0` → "Belum ada paket soal". |
| Grid & tabel | Keduanya merender `data` (halaman dari server), bukan `paged` hasil slice klien. |

## 3. Verifikasi

Lingkungan: dev server proyek di `http://localhost:3010` (Next.js 16.3.8, DB `mathbank` :5433).

**a. Statis**

- `npx tsc --noEmit` → **exit 0**, tanpa error.
- `npx eslint` pada 4 berkas yang disentuh → **bersih**.
- `grep -rn useAllBundles src` → **0 hasil** (hanya tersisa di dokumen audit).

**b. Runtime API** (login demo `admin`, cookie sesi nyata)

| Request | Hasil |
| --- | --- |
| `?status=active&limit=20&offset=0` | `items=20`, `total=577`, `stats={byType:{exam:0,source:577}, totalItems:12336}` |
| `?offset=20&limit=20` | halaman berbeda (item pertama berubah) → paginasi server benar |
| `?q=2024&limit=5` | `total=15`, item pertama "Osn K Matematika Sma 2024 Dasar" → pencarian server benar |
| `?status=ready&limit=5` | `total=0` → filter status benar (DB dev seluruhnya `draft`) |
| `?q=zzzznotfound` | `total=0` |
| `?bundleType=exam` | `total=0`, `stats` ikut 0 (konsisten dengan filter) |

Catatan: pada DB dev 100% paket berstatus `draft`, sehingga `status=draft` juga
mengembalikan 577 — ini benar, bukan bug filter (dikonfirmasi via `SELECT status, COUNT(*)`).

**c. Bukti "satu request"**

Jalur kode klien hanya memanggil **satu** `useQuery` (`useBundlesPage`) per halaman;
tidak ada `for`/loop fetch, tidak ada `useAllBundles`. Satu perpindahan halaman =
satu `GET /api/bundles?...&limit=20&offset=…`, dan kartu statistik tidak memicu
request kedua karena ikut di amplop `stats`.

## 4. DoD

- [x] `/bundles` hanya 1 request HTTP per halaman (20 item)
- [x] Tidak ada loop sekuensial (tidak ada waterfall)
- [x] `useAllBundles` dihapus
- [x] Parameter `?status=&q=&limit=&offset=` didukung `GET /api/bundles`
- [x] UI paginasi Previous/Next berfungsi
- [x] `tsc --noEmit` & `eslint` bersih

## 5. Catatan untuk Rofik (QA)

Area yang layak ditutup tes:

1. `listBundles()` — filter `status`/`q`, amplop `stats`, dan bahwa `total` tidak
   terpengaruh `limit`.
2. `useBundlesPage` — pembentukan query string (limit/offset/status/q).
3. `BundleListView` — perilaku paginasi (reset ke halaman 1 saat filter berubah) dan
   empty state ganda.
