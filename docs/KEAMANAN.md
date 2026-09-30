# KEAMANAN.md — Model Keamanan MathBank

> **Status:** 📝 dibuat 2026-09-29 (fondasi enterprise).
> **Sifat:** dokumen hidup — perbarui saat permukaan serangan berubah.
> **Rujukan:** `CONSTRAINTS.md` (Keamanan #20–23), `DESAIN-PER-LAPISAN` (L1 auth), `AGENTS.md`.

---

## 1. Aset yang Dilindungi

| Aset | Sensitivitas | Lokasi |
|------|--------------|--------|
| **Kunci jawaban** (`answer_key`) | 🔴 tinggi | `questions.answer_key` |
| **Soal & pembahasan** | 🟠 sedang (IP) | `questions`, `solutions` |
| **Data pengguna** | 🔴 tinggi (PII) | `user`, `account`, `user_roles` |
| **Kredensial** (kata sandi, sesi) | 🔴 tinggi | `account.password`, `session` |
| **API key** (agen/mesin) | 🔴 tinggi | `apikey` |
| **Konfigurasi AI** (`ai.api_key`) | 🔴 tinggi | `app_settings` |
| **Audit log** | 🟠 sedang | `audit_logs` |

---

## 2. Model Ancaman (Threat Model — ringkas, STRIDE)

| Ancaman | Skenario | Mitigasi (kini) | Status |
|---------|----------|-----------------|:------:|
| **Spoofing** | Penyusup mengaku admin | Session cookie (Better Auth) + API key terverifikasi | ✅ |
| **Tampering** | Ubah status soal tanpa izin | RBAC `assertCan` di service + FSM | ✅ |
| **Repudiation** | "Bukan saya yang ubah" | `audit_logs` mencatat setiap mutasi | ✅ |
| **Information disclosure** | Bocornya `answer_key` ke publik | *belum ada filter output per-peran* | 🔴 |
| **DoS** | Banjir request | Rate limit **hanya** di API key; route umum **belum** | 🔴 |
| **Elevation of privilege** | Dapat peran lebih tinggi | Multi-role dari tabel `user_roles`, dicek per-aksi | ✅ |

**Permukaan serangan utama:** API routes (`/api/*`), auth (`/api/auth/*`), halaman soal.

---

## 3. Autentikasi (L1)

Dua kelas kredensial, satu sistem:

| Kelas | Untuk | Mekanisme |
|-------|-------|-----------|
| **Session cookie** | Manusia (UI) | Better Auth, `expiresIn` 7 hari, `updateAge` 1 hari |
| **API key** | Agen/mesin (MCP, ingest) | Plugin `@better-auth/api-key`, rate limit bawaan |

- **Rahasia:** `BETTER_AUTH_SECRET` wajib di produksi — **aplikasi menolak start tanpa itu** (`server.ts`).
- **Pagar dev bypass:** `AUTH_DEV_BYPASS` mengaktifkan aktor admin palsu, TETAPI **mati total bila `NODE_ENV === "production"`** — kini **3 pagar**: `NODE_ENV` produksi, `APP_ENV` (`production`/`staging`), dan nilai harus `= "true"` literal (`resolve.ts`).
- **mustChangePassword:** aktor dengan flag ini **diblokir 403 `PASSWORD_CHANGE_REQUIRED`** di semua route domain (wrapper), **kecuali** `/api/auth/me` (`allowPasswordChangePending`) & endpoint auth Better Auth. UI mengalihkan ke `/change-password`.

### 3.1 Aturan Wajib
1. **Jangan pernah** mengaktifkan `AUTH_DEV_BYPASS` di produksi.
2. Rahasia **tak pernah** masuk ke kode/git — hanya ENV atau `app_settings` terenkripsi.
3. Sesi di-invalidasi saat perubahan kata sandi.

---

## 4. Otorisasi (RBAC — L1)

**5 peran:** `admin`, `teacher`, `reviewer`, `agent`, `machine`.

- Izin = matriks `PERMISSIONS` (`permissions.ts`) — `Record<Permission, Record<Role, Access>>`.
- Ditegakkan di **tiga gerbang**:
  1. **Route** — `wrapRoute({ permission })` → `assertCan`.
  2. **Service** — `assertCan` (pertahanan berlapis; jangan andalkan route saja).
  3. **Kepemilikan** — `{ ownerId }` (teacher hanya boleh edit miliknya).

### 4.1 Prinsip
- **Least privilege:** peran default = hak minimum.
- **Multi-role:** satu akun boleh punya beberapa peran (tabel `user_roles`).
- **Fail closed:** tak ada izin → tolak (403), bukan izinkan.

---

## 5. Validasi Input

- **Semua boundary** memakai **Zod** (API body & query; MCP input).
- Format respons error tunggal — **tak membocorkan** stack/jejak internal (500 = pesan generik).
- Sanitasi: KaTeX dirender **tanpa** `trust` untuk protokol file/`\includegraphics` (lihat §7).

---

## 6. Rahasia & Konfigurasi

| Rahasia | Penyimpanan | Aturan |
|---------|-------------|--------|
| `DATABASE_URL` | ENV | jangan log; jangan kirim ke klien |
| `BETTER_AUTH_SECRET` | ENV | `openssl rand -hex 32`; rotasi berkala |
| `ai.api_key` | `app_settings` | terenkripsi; hanya server yang baca |
| API key agen | tabel `apikey` | hash; tampil sekali saat dibuat |

**Aturan:** dokumen/commit **tidak pernah** memuat nilai rahasia. Contoh di dokumen pakai `***`.

---

## 7. Permukaan Berisiko (Spesifik MathBank)

| Area | Risiko | Mitigasi |
|------|--------|----------|
| **LaTeX/TikZ compile** | LFI / command injection | `openin_any='p'` (CONSTRAINTS #20); sandbox akar temp khusus |
| **KaTeX render** | XSS via `\htmlClass`/protokol | `trust` **off**; `strict` sesuai |
| **Ingest PDF (M9)** | File berbahaya / resource | validasi tipe & ukuran; proses terisolasi |
| **AI enrichment (M10)** | Prompt injection / data exfil | endpoint dari `app_settings`; batas keluaran; audit |
| **MCP tulis (M11)** | Agen menulis liar | `policy.ts` + izin peran `agent`/`machine` |

---

## 8. Header Keamanan (S2 — aktif)

Diterapkan ke **semua rute** via `next.config.ts` `headers()`:

| Header | Nilai | Fungsi |
|--------|-------|--------|
| `Content-Security-Policy` | lihat bawah | cegah XSS/injeksi |
| `X-Content-Type-Options` | `nosniff` | cegah MIME sniffing |
| `X-Frame-Options` | `DENY` | anti-clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | batasi kebocoran referrer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | matikan fitur tak dipakai |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | **produksi saja** (HSTS) |
| `X-DNS-Prefetch-Control` | `off` | privasi |

**CSP (produksi):** `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`.

- **Dev** menambah `'unsafe-eval'` (React debug) — **tak pernah** di produksi.
- **Dev TIDAK memakai `upgrade-insecure-requests`** ⚠️ — directive ini memaksa browser menaikkan `http://` → `https://`. Bila halaman disajikan lewat **HTTP polos** (mis. uji produksi via LAN `http://192.168.x.x:3001`, tanpa TLS), seluruh CSS/JS/font gagal dimuat → halaman tampil tanpa gaya.
- **Kendali via env `APP_HTTPS=true`** ✅ — directive `upgrade-insecure-requests` **dan** HSTS hanya dikirim bila operator menandai bahwa app berjalan di balik **HTTPS** (reverse-proxy TLS). Default (env tak diset) = HTTP → keduanya **tidak** dikirim. Ini karena `next.config.ts` `headers()` bersifat statis (tak punya akses ke protokol request). *Bug ditemukan & diperbaiki 2026-09-29 (akses LAN, dua kali: dev lalu produksi-HTTP).* **Saat deploy produksi di balik reverse-proxy TLS, wajib set `APP_HTTPS=true`.**
- **Utang lanjutan:** ganti `'unsafe-inline'` skrip dengan **nonce/hash** (S9) untuk CSP ketat.

---

## 8b. Kebijakan Kunci Jawaban (S3 — aktif)

`answer_key` & `options.is_correct` adalah **rahasia**. Aturan:

| Konteks | `answer_key`? | `is_correct`? |
|---------|:-------------:|:-------------:|
| Viewer berwenang (admin/teacher/reviewer) | ✅ | ✅ |
| `agent` / `machine` (API key) | ❌ | ❌ |
| Field internal (`embedding*`, `aiTagged*`) | ❌ **selalu** | — |

- Ditegakkan di **proyeksi kolom** (bukan filter di UI) — data tak pernah meninggalkan server.
- Semua jalur baca API lewat `questionColumns()`/`optionColumns()`.
- Uji: `src/lib/db/projections/question.test.ts` (13 tes).

---

## 9. Kesadaran Risiko Operasional (utang keamanan)

Audit 2026-09-29 mencatat yang **BELUM** ada — dicatat jujur sebagai utang:

| # | Utang | Prioritas |
|---|-------|-----------|
| S1 | Token bucket in-memory, per aktor/IP, 429 + `Retry-After`. Lihat `src/lib/api/rate-limit.ts`. **✅ SELESAI** (2026-09-30): (a) 3 route GET yang terlewat ditambal; (b) rate-limit **login Better Auth** diverifikasi aktif (rule bawaan `/sign-in` 3/10 s) + **storage database** (tabel `rate_limit`, persisten) + IP asli via `cf-connecting-ip` (Cloudflare) → tahan spoof. Lihat `docs/RENCANA-RATE-LIMIT.md`. | ✅ |
| S2 | ~~Security headers~~ **✅ SELESAI** (2026-09-29): CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS (produksi). Di `next.config.ts`. Pengerasan lanjutan: nonce/hash CSP (kini `'unsafe-inline'`). | ✅ |
| S3 | Proyeksi kolom (`src/lib/db/projections/question.ts`); `answer_key`+`isCorrect` hanya untuk viewer berwenang; `embedding*`/`aiTagged*` **selalu** dibuang. CONSTRAINT #34. **✅ pada jalur `/questions`** (13 tes). **⚠️ UTANG:** jalur baca **paket** (`listBundleItems`) belum meneruskan `actor` → kunci selalu dibuang (under-exposure, inkonsisten — NEW4, M13). | 🟠 |
| S4 | **Verifikasi email** — kini `requireEmailVerification: false` | 🟠 |
| S5 | **Kebijakan kata sandi kuat** + rotasi | ✅ |
| S6 | Pemindaian rahasia — **selesai** via skrip Node murni + pre-commit hook (`scripts/secret-scan.mjs`) | ✅ |
| S7 | Audit akses baca data sensitif (kunci jawaban, ekspor) | ✅ |
| S8 | Pantau advisory — skrip `pnpm security:advisories`; **override esbuild@0.18.20 dibuang** (GHSA-67mh-4wv8-2f99) → `pnpm audit` 0 | ✅ |
| S9 | **CSP nonce** — ⛔ **diblokir bug Turbopack** (vercel/next.js#93094: nonce tak ditempel ke `<script>` chunk → strict-dynamic memblokir semua JS). Direvert; **proxy strip header CSP request** (anti CVE-2026-44581) tetap ada. Utang: aktifkan bila bug ditutup | 🟠 |
| S10 | **Role DB `mathbank` TIDAK boleh superuser di produksi** — saat ini superuser (dev lokal, agar `CREATE EXTENSION vector` jalan). **✅ alat disiapkan** (2026-09-30): `drizzle/manual/provision-prod.sql` (role app NOSUPERUSER + GRANT CRUD + `audit_logs` append-only) + `docs/RENCANA-DEPLOY.md` §5 dua-tahap. **Sisa:** jalankan di DB produksi sungguhan. | 🟡 |

---

## 9. Respons Insiden (garis besar)

1. **Deteksi** — alert dari log/observabilitas (lihat `OBSERVABILITAS.md`, menyusul).
2. **Isolasi** — cabut sesi/API key terdampak; blokir sumber.
3. **Evaluasi** — cakupan dampak via `audit_logs`.
4. **Pemulihan** — restore dari backup (lihat `BACKUP-RECOVERY.md`, menyusul).
5. **Pasca-insiden** — tulis post-mortem; perbarui dokumen ini.

---

## 10. Daftar Periksa Sebelum Produksi

- [ ] `BETTER_AUTH_SECRET` diset & kuat.
- [ ] `AUTH_DEV_BYPASS` **false** / kosong.
- [ ] Security headers aktif (S2).
- [ ] Rate limiting umum aktif (S1).
- [ ] CORS dibatasi sesuai kebutuhan.
- [ ] `answer_key` tak bocor ke output publik (S3).
- [ ] Backup terjadwal + uji restore (E4).
- [ ] Log tak memuat rahasia/PII.
- [ ] HTTPS wajib; HSTS.

---

*Dokumen ini fondasi enterprise — perbarui setiap perubahan autentikasi/otorisasi/permukaan serangan.
Lihat juga: `PETA-DOKUMEN.md` (peta seluruh dokumen), `CONSTRAINTS.md` §Keamanan.*
