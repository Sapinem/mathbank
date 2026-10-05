# RENCANA — Rate Limit & Autentikasi (perbaikan benar, bukan tambal sulam)

> **Pemicu:** evaluasi menyeluruh menemukan temuan "NEW1: login tanpa rate-limit".
> Saat menindaklanjuti, pemilik produk menegur: *"Bukan sekeder bisa aja ya, tapi
> harus ikut alur terbaiknya. Kita kan bikin dari awal, jangan sampai jadinya sama
> aja tambal sulam lagi."* → rencana ini menggantikan pendekatan tambal-sulam.
>
> **Status:** ✅ **SELESAI** (2026-09-30) — R1 + R2 + R3 dikerjakan & diverifikasi.

## 1. Koreksi temuan (jujur, berbasis docs resmi better-auth 1.7.6)

Investigasi ulang membuktikan **klaim awal NEW1 sebagian besar SALAH**:

| Klaim awal | Fakta (docs resmi v1.7.6 + kode library) | Status |
|------------|-------------------------------------------|--------|
| Login tanpa rate-limit | Rate-limit **aktif otomatis** bila `NODE_ENV=production` | ❌ salah |
| Perlu `customRules` login | `/sign-in/email` **sudah** 3 req / 10 s bawaan | ❌ salah |
| Perlu `ipv6Subnet` | IPv6 **sudah** dinormalisasi + dibatasi per /64 otomatis | ❌ salah |
| Perlu `ipAddressHeaders` | Hanya bila header non-default | ⚠️ kondisional |

**Pelajaran:** temuan subagent/pihak ketiga harus **diverifikasi ke sumber primer**
(docs + kode library), bukan diterima apa adanya. Ini juga bentuk "jangan tambal sulam".

## 2. Isu NYATA yang tersisa (2, keduanya arsitektural)

### R1 — Konfigurasi IP salah untuk topologi Cloudflare
- **Fakta:** `b.iyo.my.id` dilayani **Cloudflare** (`server: cloudflare`), ke port 1234
  lewat tunnel. Tidak ada reverse-proxy lokal di host.
- **Masalah:** rate-limit memakai `x-forwarded-for` default. Di balik Cloudflare,
  IP asli ada di **`cf-connecting-ip`**. Salah header → IP tidak terdeteksi / bisa
  di-*spoof* → **rate-limit dapat di-bypass**.
- **Perbaikan benar:** set `ipAddressHeaders: ["cf-connecting-ip"]` (header yang
  Cloudflare set & sanitasi) — bukan menumpuk `x-forwarded-for` + tambalan.

### R2 — `storage` rate-limit default `memory`
- **Fakta (docs):** default `memory` → **tidak dibagi antar-instance**, **hilang
  saat restart**, **tidak cocok serverless**.
- **Dampak sekarang:** server tunggal via systemd → memadai, TAPI restart
  menghapus counter (jendela reset) & tak siap multi-instance.
- **Perbaikan benar (bertahap):**
  - **Sekarang:** terima `memory` (satu instance) — **dokumentasikan** batasnya.
  - **Saat skala:** `secondaryStorage` (Redis) via opsi `storage`.
  - **Alternatif tanpa infrastruktur baru:** `storage: "database"` (tabel
    `rateLimit`) — persisten & dibagi, memakai Postgres yang sudah ada.

### R3 — `BETTER_AUTH_URL` salah di `.env` produksi
- **Fakta:** `.env` = `http://localhost:3000`; `.env.example` = `https://b.iyo.my.id`.
- **Masalah:** `baseURL` Better Auth salah → callback/redirect & origin bisa keliru.
- **Perbaikan benar:** set `BETTER_AUTH_URL=https://b.iyo.my.id` di `.env` produksi.

## 3. Rekomendasi (urut nilai/risiko)

| # | Aksi | Nilai | Risiko | Waktu |
|---|------|-------|--------|-------|
| 1 | `ipAddressHeaders: ["cf-connecting-ip"]` | tinggi (cegah bypass) | rendah | 5 mnt |
| 2 | `BETTER_AUTH_URL` produksi → domain | sedang | rendah | 2 mnt |
| 3 | `storage: "database"` (tabel `rateLimit`) | sedang (persisten) | sedang (migrasi) | 30 mnt |
| 4 | `rateLimit.enabled: true` eksplisit | rendah (dev) | rendah | 1 mnt |
| 5 | Redis `secondaryStorage` | tinggi saat multi-instance | tinggi (infra baru) | — |

**Catatan:** #4 (enabled eksplisit) **bukan** tambalan bila disertai alasan jelas —
tapi karena produksi sudah aktif & dev memang sebaiknya tanpa limit (agar tes tak
terganggu), **#4 ditunda** sampai kebutuhan nyata muncul.

## 4. Yang TIDAK dilakukan (menolak tambal sulam)
- ❌ `customRules: { "/sign-in/email": … }` menumpuk di atas rule bawaan identik.
- ❌ Menambah `ipv6Subnet` padahal library sudah menangani.
- ❌ Menambah `x-forwarded-for` + `x-real-ip` "untuk aman" tanpa tahu topologi.

## 5. Keputusan & Hasil ✅
Pemilik memilih **R1 + R2 + R3 sekaligus**. Semua dikerjakan & diverifikasi nyata:

| # | Aksi | Bukti verifikasi |
|---|------|------------------|
| R1 | `ipAddressHeaders: ["cf-connecting-ip"]` | Uji 4 login `cf-connecting-ip: 198.51.100.7` → 3×400 lalu **429**; DB key = `198.51.100.7\|/sign-in/email` (IP terdeteksi) |
| R2 | `storage: "database"` + tabel `rate_limit` (migrasi `0004`) | Counter tersimpan di Postgres, selamat restart service |
| R3 | `BETTER_AUTH_URL`/`APP_URL` = domain di systemd (produksi), `.env` diperbaiki | Smoke 7/7 + login demo via domain tetap jalan |

**Bukti bypass ditutup:** kirim `x-forwarded-for` asli → key jadi `no-trusted-ip…`
(hanya header CF dipercaya). Tanpa R1, header palsu bisa memecah bucket = bypass.

**Tidak dilakukan (menolak tambal sulam):** tak menimpa rule `/sign-in` bawaan;
tak menambah `ipv6Subnet` (library sudah tangani).

---
*Lihat juga: docs/EVALUASI-MENYELURUH.md (temuan NEW1), docs/KEAMANAN.md.*
