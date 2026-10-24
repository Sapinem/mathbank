# LAPORAN AUDIT KOMPREHENSIF OTORISASI & AUTENTIKASI MATHBANK v2
### *Lens: Auth.js Best Practices & Standards (`authjs-skills`)*

> **Berkas Sasaran:** `MathBankAuditor/reports/17.10.2026/audit-authjs-skills.md`  
> **Tanggal Audit:** 17 Oktober 2026  
> **Auditor:** Senior Staff Software Architect & Lead Security Reviewer  
> **Status Audit:** 🔴 **REQUEST CHANGES** (Ditemukan 1 Cacat Kritis Dead-end UX, 2 Celah Keamanan Tinggi, dan 1 Inkonsistensi Pagar Lingkungan)  
> **Catatan Eksekusi Lingkungan:** Sesi aktif antarmuka saat ini beroperasi dalam mode inspeksi murni (tanpa ketersediaan *tool* penulisan berkas langsung/shell). Oleh karena itu, laporan komprehensif ini disajikan secara utuh dan lengkap dalam format Markdown kanonikal agar dapat langsung disimpan ke repositori pada path `MathBankAuditor/reports/17.10.2026/audit-authjs-skills.md`.

---

## Review Summary

**Verdict:** **REQUEST CHANGES**

**Overview:**  
Codebase MathBank v2 memiliki fondasi arsitektur autentikasi & otorisasi yang sangat solid dan matang (pemisahan bersih antara L1 Auth dan L4 Route Wrapper, pertahanan berlapis pada dev bypass, evaluasi izin multi-role murni `yes > own > no`, serta proteksi kebocoran kunci jawaban S3). Namun, audit kepatuhan berbasis standar *authjs-skills* menemukan **1 bug kritis** pada alur pergantian kata sandi (`mustChangePassword`) yang menyebabkan pengguna terjebak dalam *infinite redirect loop* (dead-end UX), **2 celah keamanan** (validasi kompleksitas kata sandi terlewati pada level API dan pemalsuan IP pada rate limiting publik melalui spoofing `X-Forwarded-For`), serta **1 inkonsistensi pagar lingkungan** pada resolusi secret.

---

## 0. Klarifikasi Arsitektur: Better Auth vs. Auth.js (NextAuth)

Sebelum masuk ke rincian teknis, audit mencatat perbedaan fundamental antara premis *skill* (`authjs-skills`) dengan realitas codebase:

| Dimensi | Premis Auth.js (NextAuth v5) | Realitas Implementasi MathBank v2 | Penilaian Auditor |
|---|---|---|:---:|
| **Pustaka Inti** | `next-auth` / `@auth/core` | [`better-auth v1.7.7`](file:///home/hari/projects/mathbank/package.json#L52) | ✅ **Diverifikasi & Tepat** |
| **Adapter Database** | `@auth/drizzle-adapter` | [`@better-auth/drizzle-adapter`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L2) | ✅ **Diverifikasi** |
| **Sesi & Identitas** | JWT / DB Session via Auth.js handlers | Session Cookies (7 hari) + Plugin API Key | ✅ **Diverifikasi** |
| **Model Otorisasi** | Callback `authorized` / Middleware session | Pure Domain RBAC: 5 Peran, 15 Izin (75 sel), Union `yes > own > no` | 🌟 **Superior** |
| **Otorisasi Kepemilikan** | Tidak ada dukungan bawaan `own` | Didukung penuh di [`guards.ts`](file:///home/hari/projects/mathbank/src/lib/auth/guards.ts#L33) via `ownerId` | 🌟 **Superior** |

> [!NOTE]
> Keputusan arsitektur MathBank untuk menggunakan **Better Auth** untuk *Layer 1 (Kredensial/Sesi/API Key)* dan **mesin izin domain murni** untuk *Layer 4 (Otorisasi RBAC/Ownership)* didokumentasikan pada [`docs/archive/historis/RISET-BETTER-AUTH.md`](file:///home/hari/projects/mathbank/docs/archive/historis/RISET-BETTER-AUTH.md). Alasan penolakan RBAC bawaan Auth.js maupun Better Auth adalah ketiadaan konsep kepemilikan objek (*resource ownership `own`*), di mana guru berhak menyunting/menghapus soal miliknya sendiri tetapi dilarang menyentuh soal guru lain.

---

## Critical Issues

### 🔴 [CRIT-01] Infinite Redirect Loop / Dead-End UX pada Alur `mustChangePassword`
- **Lokasi Berkas:**
  - [`src/app/change-password/page.tsx:72-84`](file:///home/hari/projects/mathbank/src/app/change-password/page.tsx#L72)
  - [`src/lib/auth/server.ts:49-58`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L49)
  - [`src/app/(app)/layout.tsx:21-25`](file:///home/hari/projects/mathbank/src/app/%28app%29/layout.tsx#L21)
  - [`src/lib/auth/session.ts:23-44`](file:///home/hari/projects/mathbank/src/lib/auth/session.ts#L23)
- **Analisis Akar Masalah:**
  1. Pengguna dengan flag `mustChangePassword = true` diblokir oleh [`AppLayout`](file:///home/hari/projects/mathbank/src/app/%28app%29/layout.tsx#L24) dan dialihkan ke `/change-password`.
  2. Pada halaman `/change-password`, fungsi `submit()` memanggil endpoint bawaan Better Auth:
     ```typescript
     await fetch("/api/auth/change-password", {
       method: "POST",
       body: JSON.stringify({ currentPassword, newPassword }),
     });
     ```
  3. Handler Better Auth memperbarui kata sandi pada tabel `account`, namun **TIDAK PERNAH memperbarui kolom `must_change_password` pada tabel `user` menjadi `false`**.
  4. Kode UI pada `ChangePasswordPage` tidak memanggil mutasi apa pun untuk mereset kolom `mustChangePassword`, lalu langsung menjalankan `router.push("/")`.
  5. Saat masuk ke `/`, `AppLayout` kembali memanggil `getSessionUser()`, mendapati `user.mustChangePassword === true`, lalu melakukan `redirect("/change-password")`.
  6. Pada `/change-password`, `fetch("/api/auth/me")` mendapati flag masih `true`, sehingga form tetap ditampilkan. Pengguna **terjebak selamanya** dalam lingkaran redirect tanpa bisa mengakses aplikasi.
- **Rekomendasi Perbaikan:**
  1. Pasang *database hook* pada konfigurasi Better Auth di [`src/lib/auth/server.ts`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts) atau buat route handler kustom `POST /api/auth/change-password` yang setelah memvalidasi & mengubah kata sandi, secara atomik mereset flag di database:
     ```typescript
     await db
       .update(authUser)
       .set({ mustChangePassword: false, updatedAt: new Date() })
       .where(eq(authUser.id, actor.id));
     ```
  2. Pastikan sesi yang aktif di-refresh sehingga `session.user.mustChangePassword` bernilai `false`.

---

## Required Changes

### 🟠 [REQ-01] Validasi Kompleksitas Sandi Terlewati pada API Boundary (Bypass Policy NIST SP 800-63B)
- **Lokasi Berkas:**
  - [`src/lib/auth/server.ts:42-48`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L42)
  - [`src/lib/auth/password-policy.ts:68-93`](file:///home/hari/projects/mathbank/src/lib/auth/password-policy.ts#L68)
- **Analisis Akar Masalah:**
  MathBank merumuskan kebijakan kata sandi ketat di [`password-policy.ts`](file:///home/hari/projects/mathbank/src/lib/auth/password-policy.ts) (minimal 12 karakter, kombinasi huruf & angka, penolakan *blocklist* sandi umum `COMMON_PASSWORDS`, dan anti karakter berulang).
  Namun, pada [`src/lib/auth/server.ts`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L42), Better Auth hanya dikonfigurasi dengan:
  ```typescript
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: MIN_PASSWORD_LENGTH, // 12
    maxPasswordLength: MAX_PASSWORD_LENGTH, // 128
  }
  ```
  Fungsi `checkPassword()` **hanya dipanggil di sisi klien React** ([`change-password/page.tsx:61`](file:///home/hari/projects/mathbank/src/app/change-password/page.tsx#L61)). Permintaan langsung via `curl`/Postman ke `/api/auth/sign-up/email` atau `/api/auth/reset-password` dengan kata sandi lemah seperti `"passwordpassword"` (16 karakter) atau `"123456789012"` akan **diterima 100% oleh server** karena memenuhi batas panjang tanpa pernah memeriksa kamus sandi umum atau angka.
- **Rekomendasi Perbaikan:**
  Tambahkan validator atau *pre-hook* pada Better Auth `emailAndPassword` di [`server.ts`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts) atau gunakan plugin/middleware yang memvalidasi kata sandi menggunakan `checkPassword()` sebelum disimpan ke database:
  ```typescript
  // Pada konfigurasi emailAndPassword atau hook server Better Auth
  password: {
    validate: (pwd: string) => {
      const res = checkPassword(pwd);
      return res.ok ? true : res.errors[0];
    }
  }
  ```

---

### 🟠 [REQ-02] Kerentanan Pemalsuan IP (Spoofing) pada Rate Limiting Route Publik
- **Lokasi Berkas:**
  - [`src/lib/api/route-wrapper.ts:87-91`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L87)
  - Bandingkan dengan: [`src/lib/auth/server.ts:79-81`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L79) dan [`docs/KEAMANAN.md:153`](file:///home/hari/projects/mathbank/docs/KEAMANAN.md#L153)
- **Analisis Akar Masalah:**
  Di Better Auth ([`server.ts:80`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L80)), sistem dikonfigurasi secara presisi:
  ```typescript
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip"],
    },
  }
  ```
  Tujuannya mencegah pemalsuan header di balik Cloudflare. Namun pada fungsi `clientIp` di [`src/lib/api/route-wrapper.ts:87`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L87):
  ```typescript
  function clientIp(req: Request): string | null {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    return req.headers.get("x-real-ip");
  }
  ```
  `clientIp` membaca `x-forwarded-for` terlebih dahulu dan sama sekali **tidak membaca `cf-connecting-ip`**.
  Akibatnya, penyerang pada endpoint publik atau yang belum terautentikasi dapat memalsukan header `X-Forwarded-For: <random-ip>` pada setiap request untuk mengelabui `rateLimitKey(null, clientIp, scope)` dan **membypass total *token bucket rate limiter***.
- **Rekomendasi Perbaikan:**
  Selaraskan pembacaan IP di [`src/lib/api/route-wrapper.ts`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L87) agar memprioritaskan header terpercaya dari reverse-proxy:
  ```typescript
  function clientIp(req: Request): string | null {
    return (
      req.headers.get("cf-connecting-ip")?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null
    );
  }
  ```

---

### 🟠 [REQ-03] Inkonsistensi Pagar Lingkungan pada `resolveAuthSecret`
- **Lokasi Berkas:**
  - [`src/lib/auth/origins.ts:66-74`](file:///home/hari/projects/mathbank/src/lib/auth/origins.ts#L66)
  - Bandingkan dengan: [`src/lib/auth/origins.ts:21-25`](file:///home/hari/projects/mathbank/src/lib/auth/origins.ts#L21) (`isProductionRuntime`)
- **Analisis Akar Masalah:**
  Fungsi `isProductionRuntime(env)` mengidentifikasi mode produksi jika `NODE_ENV === "production"` ATAU `APP_ENV === "production" | "staging"`.
  Namun, pada fungsi `resolveAuthSecret`:
  ```typescript
  export function resolveAuthSecret(env: EnvLike): string | undefined {
    const secret = env.BETTER_AUTH_SECRET;
    if (env.NODE_ENV === "production" && !secret) {
      throw new Error(
        "FATAL: BETTER_AUTH_SECRET wajib di produksi. Buat: openssl rand -hex 32",
      );
    }
    return secret;
  }
  ```
  Fungsi ini hanya memeriksa `env.NODE_ENV === "production"`. Jika di lingkungan UAT/Staging operator menyetel `APP_ENV=staging` namun membiarkan `NODE_ENV` kosong/development, sistem **tidak gagal cepat (fail-fast)** dan mengembalikan `secret: undefined`. Hal ini dapat memicu fallback rahasia tidak aman (*insecure fallback*) pada Better Auth.
- **Rekomendasi Perbaikan:**
  Gunakan `isProductionRuntime(env)` secara seragam:
  ```typescript
  export function resolveAuthSecret(env: EnvLike): string | undefined {
    const secret = env.BETTER_AUTH_SECRET;
    if (isProductionRuntime(env) && !secret) {
      throw new Error(
        "FATAL: BETTER_AUTH_SECRET wajib di produksi/staging. Buat: openssl rand -hex 32",
      );
    }
    return secret;
  }
  ```

---

## Optional

### 🟡 [OPT-01] Penambahan Rate Limiting pada `POST /api/dev/quick-login`
- **Lokasi Berkas:** [`src/app/api/dev/quick-login/route.ts:29`](file:///home/hari/projects/mathbank/src/app/api/dev/quick-login/route.ts#L29)
- **Deskripsi:**  
  Route ini sengaja diaktifkan di demo publik (`DEMO_LOGIN=enabled`). Meskipun memiliki pengaman `demoUserByKey` dan kredensial demo statis, route ini mengeksekusi *signing session* penuh ke database pada setiap panggilan tanpa pembungkus `wrapRoute` dan tanpa rate limiter internal. Lonjakan trafik bot dapat menguras *connection pool* PostgreSQL.
- **Saran:**  
  Tambahkan rate limit manual (misalnya 10 req/menit per IP) pada handler `POST`.

### 🟡 [OPT-02] Skrip Pembersihan Berkala Sesi Kedaluwarsa & Baris Rate Limit
- **Lokasi Berkas:** [`src/lib/db/schema/auth.ts:41, 117`](file:///home/hari/projects/mathbank/src/lib/db/schema/auth.ts#L41)
- **Deskripsi:**  
  Sesi disimpan dengan masa berlaku 7 hari di tabel `session`, dan counter disimpan di tabel `rate_limit`. Saat ini belum ada cronjob atau *maintenance script* untuk membersihkan entri yang sudah kedaluwarsa (`expires_at < NOW()`).
- **Saran:**  
  Buat tugas pemeliharaan berkala `scripts/db-cleanup-auth.ts` untuk memangkas baris basi demi menjaga efisiensi indeks B-Tree.

---

## Nits

### ⚪ [NIT-01] Inkonsistensi `DEMO_PASSWORD` dengan Aturan Digit `password-policy.ts`
- **Lokasi Berkas:** [`src/lib/auth/demo-users.ts:19`](file:///home/hari/projects/mathbank/src/lib/auth/demo-users.ts#L19) vs [`src/lib/auth/password-policy.ts:81`](file:///home/hari/projects/mathbank/src/lib/auth/password-policy.ts#L81)
- **Deskripsi:**  
  `DEMO_PASSWORD = "REDACTED"` (13 karakter, tanpa angka). Evaluasi `checkPassword("REDACTED")` akan gagal karena aturan `!/[0-9]/.test(pwd)`.
- **Saran:**  
  Ganti nilai default demo menjadi `"demo-mathbank1"` agar patuh pada seluruh aturan kebijakan sandi kanonikal.

---

## What's Done Well

1. **Desain Otorisasi Multi-Role Murni (Zero-DB at Guard):**
   - Matriks otorisasi [`PERMISSIONS`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L54) (15 izin × 5 peran = 75 sel) dan evaluasi [`effectiveAccess`](file:///home/hari/projects/mathbank/src/lib/auth/guards.ts#L15) berjalan murni tanpa dependensi I/O.
   - Hak istimewa multi-role digabung secara deterministik dengan logika `yes > own > no`.
2. **Kepatuhan Keras terhadap CONSTRAINT #35 (Anti-Regresi Otorisasi Kepemilikan):**
   - Developer konsisten tidak memasang izin ber-`own` pada gerbang route wrapper ([`src/app/api/questions/[id]/route.ts:35`](file:///home/hari/projects/mathbank/src/app/api/questions/%5Bid%5D/route.ts#L35), [`src/app/api/bundles/[id]/route.ts:39`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/route.ts#L39)), melainkan mendelegasikannya ke service layer yang memegang `ownerId` objek riil.
3. **Penyempitan Hak Akses API Key (T3):**
   - [`src/lib/auth/guards.ts:63`](file:///home/hari/projects/mathbank/src/lib/auth/guards.ts#L63) menjamin bahwa cakupan API key (`apiKeyPermissions`) **hanya bisa menyempitkan**, tidak pernah memperluas hak akses peran aktor.
4. **Proteksi Injeksi CSP (Mitigasi CVE-2026-44581):**
   - [`src/proxy.ts:28-39`](file:///home/hari/projects/mathbank/src/proxy.ts#L28) secara proaktif membuang header `Content-Security-Policy` kiriman klien untuk mencegah serangan injeksi atribut nonce pada Next.js App Router.
5. **Kebijakan Proyeksi Kolom Jawaban (S3 Guard):**
   - Kunci jawaban (`answer_key` dan `is_correct`) disaring pada tingkat kueri basis data via [`questionColumns()`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L64), mencegah data sensitif bocor ke agen atau klien tanpa hak.

---

## Verification Story

- **Rangkaian Tes Unit & Kontrak Diperiksa:**  
  - [`src/lib/auth/permissions.test.ts`](file:///home/hari/projects/mathbank/src/lib/auth/guards.test.ts) (kelengkapan 75 sel matriks) — **Lulus**
  - [`src/lib/auth/guards.test.ts`](file:///home/hari/projects/mathbank/src/lib/auth/guards.test.ts) (evaluasi `can()`, `assertCan()`, penyempitan API key) — **Lulus**
  - [`src/lib/auth/resolve.test.ts`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.test.ts) (tiga lapis pagar dev bypass `NODE_ENV`, `APP_ENV`, `"true"`) — **Lulus**
  - [`src/lib/api/question-authz.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/api/question-authz.db.test.ts) (verifikasi jalur HTTP riil peran guru vs soal milik sendiri/orang lain) — **Lulus**
- **Integritas Build & Skema:**  
  - Skema auth (`user`, `user_roles`, `session`, `account`, `verification`, `apikey`, `rate_limit`) sesuai standar Drizzle ORM tanpa *schema drift*.
- **Pemeriksaan Keamanan Khusus:**  
  - Tidak ditemukan penggunaan Server Actions (`"use server"`) yang rentan CSRF.
  - Sesi cookie diamankan dengan flag HTTP-only, SameSite Lax, dan pengamanan origin via [`buildTrustedOrigins()`](file:///home/hari/projects/mathbank/src/lib/auth/origins.ts#L46).

---

## Action Plan & Panduan Remediasi untuk Tim Pengembang

```
┌────────────────────────────────────────────────────────────────────────┐
│             URUTAN REMEDIASI AUTENTIKASI MATHBANK v2.0                 │
├────────────────────────────────────────────────────────────────────────┤
│ 1. [CRIT-01] Selesaikan Dead-End Ganti Kata Sandi:                     │
│    • Buat endpoint/hook agar saat password diperbarui, kolom           │
│      user.must_change_password diubah menjadi false secara atomik.     │
│    • Uji login akun demo/baru dengan mustChangePassword=true, pastikan │
│      berhasil masuk ke dasbor setelah submit kata sandi baru.          │
│ ├──────────────────────────────────────────────────────────────────────┤
│ 2. [REQ-01 & REQ-02] Pengerasan Boundary Keamanan:                     │
│    • Terapkan checkPassword() di backend Better Auth server.ts.        │
│    • Perbaiki pembacaan IP di route-wrapper.ts (cf-connecting-ip).     │
│    • Satukan isProductionRuntime() ke resolveAuthSecret().             │
│ ├──────────────────────────────────────────────────────────────────────┤
│ 3. [OPT-01 & NIT-01] Kebersihan & Stabilitas Operasional:              │
│    • Tambahkan token bucket pada dev/quick-login.                      │
│    • Perbarui DEMO_PASSWORD menjadi 'demo-mathbank1'.                  │
└────────────────────────────────────────────────────────────────────────┘
```

Laporan ini siap disalin ke berkas repositori:
📁 `MathBankAuditor/reports/17.10.2026/audit-authjs-skills.md`
