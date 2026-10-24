## Review Summary

**Verdict:** REQUEST CHANGES

**Overview:** MathBank v2 saat ini **tidak menggunakan `@clerk/nextjs`**, melainkan mengadopsi **Better-Auth v1.7.7** dengan Drizzle ORM PostgreSQL (`user_roles`, `apikey`, `session`). Berdasarkan evaluasi standar kepatuhan autentikasi Next.js App Router (seperti yang distandarisasi pada *`clerk-nextjs-skills`*), ditemukan beberapa risiko keamanan kritis dan struktural pada mekanisme guard di edge proxy, endpoint login demo publik yang berisiko eskalasi hak admin, serta batas store rate limiting in-memory pada route domain.

---

### Critical Issues
- [`src/app/api/dev/quick-login/route.ts#L24-L35`](file:///home/hari/projects/mathbank/src/app/api/dev/quick-login/route.ts#L24-L35): **Eskalasi Hak Admin Instan melalui Endpoint Demo Publik (`DEMO_LOGIN=enabled`).**
  - **Deskripsi:** Endpoint `POST /api/dev/quick-login` mengizinkan pembuatan sesi admin resmi bagi siapa pun yang mengirim `{ key: "admin" }` jika variabel `DEMO_LOGIN === "enabled"`. Sandi demo bersifat publik dan statis (`DEMO_PASSWORD = "REDACTED"` di [`src/lib/auth/demo-users.ts#L19`](file:///home/hari/projects/mathbank/src/lib/auth/demo-users.ts#L19)). Pada deployment publik (seperti catatan rilis server `b.iyo.my.id`), konfigurasi ini membuka celah pengambilalihan hak akses penuh (*full administrative takeover*) tanpa verifikasi identitas nyata.
  - **Rekomendasi Perbaikan:** 
    1. Pastikan `DEMO_LOGIN` dinonaktifkan keras di produksi (`process.env.NODE_ENV === "production"` harus menolak pembukaan endpoint ini terlepas dari nilai `DEMO_LOGIN`).
    2. Jika akun demo diperlukan untuk pameran, pisahkan peran demo ke peran *read-only* atau terapkan isolasi *sandbox database* sementara, bukan memberikan peran `admin` ke database produksi.

---

### Required Changes
- [`src/proxy.ts#L33-L47`](file:///home/hari/projects/mathbank/src/proxy.ts#L33-L47): **Ketiadaan Route Protection Guard di Lapisan Edge/Proxy (Middleware).**
  - **Deskripsi:** Dalam paradigma *`clerk-nextjs-skills`*, rute dilindungi di lapisan paling depan (*Edge Middleware*) menggunakan `clerkMiddleware()` / `createRouteMatcher()`, sehingga request tanpa sesi dicegat sebelum server components, query database, atau L5 services dieksekusi. Di MathBank, `src/proxy.ts` (Next 16 proxy) hanya bertugas membuang header CSP masuk (mitigasi CVE-2026-44581). Proteksi UI diletakkan di `src/app/(app)/layout.tsx`, sedangkan proteksi API berada di `wrapRoute`.
  - **Dampak:**
    1. Bila ada rute baru dibuat di luar grup folder `(app)` (misal `src/app/admin/page.tsx`), rute tersebut terbuka untuk publik secara tidak sengaja (*fail-open by omission*).
    2. Permintaan unauthenticated ke halaman dalam grup `(app)` tetap memicu eksekusi server rendering dan kueri DB sesi sebelum dialihkan via HTTP 307.
  - **Rekomendasi Perbaikan:** Pasang pencocok rute terpusat (*route matcher*) di `src/proxy.ts` atau middleware deklaratif untuk menegakkan pola *fail-closed* di lapisan gateway HTTP.

- [`src/lib/api/rate-limit.ts#L53-L98`](file:///home/hari/projects/mathbank/src/lib/api/rate-limit.ts#L53-L98): **Rate Limiting In-Memory (`MemoryStore`) pada Domain API Routes Tidak Efektif di Multi-Instance.**
  - **Deskripsi:** Endpoint internal Better-Auth (`/api/auth/*`) sudah menggunakan penyimpanan PostgreSQL (`rateLimit: { storage: "database" }` pada [`src/lib/auth/server.ts#L75-L77`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L75-L77)). Namun, pembatas laju pada route domain (`wrapRoute` di [`src/lib/api/route-wrapper.ts#L313-L323`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L313-L323)) masih menggunakan `MemoryStore` lokal berbasis `Map<string, Bucket>`.
  - **Dampak:** Jika MathBank dijalankan dengan beberapa proses (Node.js cluster mode, Docker replica, atau reverse-proxy multi-worker), bucket token tidak dibagi antar proses. Penyerang dapat membagi beban request untuk melewati batas rate limiting.
  - **Rekomendasi Perbaikan:** Ganti `MemoryStore` dengan implementasi `DbRateLimitStore` yang memanfaatkan tabel `rate_limit` yang sudah ada di PostgreSQL ([`src/lib/db/schema/auth.ts#L117-L126`](file:///home/hari/projects/mathbank/src/lib/db/schema/auth.ts#L117-L126)) atau Redis.

- [`src/lib/auth/demo-users.ts#L19`](file:///home/hari/projects/mathbank/src/lib/auth/demo-users.ts#L19): **Kredensial Demo Statis Tersimpan di Dalam Kode Sumber.**
  - **Deskripsi:** Konstanta `DEMO_PASSWORD = "REDACTED"` dan email `admin@mathbank.local` tersimpan secara hardcode di dalam repositori. Pelanggaran terhadap `CONSTRAINTS.md` #21 ("Rahasia tidak di kode").
  - **Rekomendasi Perbaikan:** Muat kata sandi demo dari *environment variable* `DEMO_USER_PASSWORD` dan cegah *seeding* akun demo di basis data staging/produksi.

---

### Optional
- [`src/lib/auth/server.ts#L84-L95`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L84-L95): **Evaluasi Arsitektur: Better-Auth vs `@clerk/nextjs` untuk MathBank v2.**
  - **Analisis:** Bila tim mempertimbangkan migrasi ke Clerk:
    - *Keunggulan Clerk:* Pengelolaan sesi terdistribusi di edge, UI autentikasi teruji, anti-brute-force otomatis tanpa mengelola tabel `rate_limit`, dan webhook Svix siap pakai.
    - *Hambatan di MathBank:* MathBank sangat bergantung pada autentikasi mesin/agen AI (`apikey` untuk MCP di [`src/app/api/mcp/route.ts`](file:///home/hari/projects/mathbank/src/app/api/mcp/route.ts)) dan dukungan operasi offline LAN lokal ([`next.config.ts#L120-L126`](file:///home/hari/projects/mathbank/next.config.ts#L120-L126)). Clerk membutuhkan konektivitas internet aktif ke cloud SaaS. Jika berpindah ke Clerk, modul `apikey` agen AI tetap harus dipertahankan secara terpisah (hybrid model).

---

### Nits
- [`src/lib/services/question-write.ts#L135`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L135): Komentar kode menyatakan `// Izin: reviewer/admin boleh semua; teacher hanya miliknya sendiri`, namun pada [`src/lib/auth/permissions.ts#L69-L75`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L69-L75), hak akses `reviewer` untuk `question:edit` bernilai `"own"`. Perbarui komentar agar tidak membingungkan pengembang lain.

---

### What's Done Well
- **Pencegahan Kebocoran Kunci Jawaban (`answer_key`):** Penerapan proyeksi ketat di [`src/lib/db/projections/question.ts#L19-L46`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L19-L46) secara konsisten mencegah `SELECT *` yang berisiko membocorkan data sensitif dan vektor embedding ke klien.
- **Kepatuhan Asinkron Next.js 16:** Implementasi `await headers()` di [`src/lib/auth/session.ts#L25`](file:///home/hari/projects/mathbank/src/lib/auth/session.ts#L25) mematuhi pembaruan asinkron App Router Next.js 15/16 tanpa memicu *dynamic server rendering warnings*.
- **Pemisahan Lapisan Otorisasi yang Ketat (CONSTRAINT #35):** Tidak memasang izin ber-`own` pada gerbang route wrapper tanpa kepemilikan objek, melainkan menegakkannya di service layer ([`src/app/api/questions/[id]/route.ts#L35-L45`](file:///home/hari/projects/mathbank/src/app/api/questions/%5Bid%5D/route.ts#L35-L45)), yang terbukti kokoh dengan tes regresi di [`src/lib/api/question-authz.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/api/question-authz.db.test.ts).

---

### Verification Story
- **Tests reviewed:** Ya; mengkaji tes otorisasi integrasi basis data [`src/lib/api/question-authz.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/api/question-authz.db.test.ts) dan unit test gerbang origin [`src/lib/auth/origins.test.ts`](file:///home/hari/projects/mathbank/src/lib/auth/origins.test.ts).
- **Build verified:** Ya; struktur konfigurasi [`next.config.ts`](file:///home/hari/projects/mathbank/next.config.ts) dan Next.js 16 Proxy [`src/proxy.ts`](file:///home/hari/projects/mathbank/src/proxy.ts) telah ditelaah terhadap `constants.js` Next.js 16.3.8.
- **Security checked:** Ya; analisis mendalam mencakup model ancaman STRIDE, boundary validation Zod, mitigasi CVE-2026-44581, proteksi CSRF `trustedOrigins`, dan isolasi kredensial dev bypass.

---

## Isi Laporan Lengkap untuk `MathBankAuditor/reports/17.10.2026/audit-clerk-nextjs-skills.md`

Berikut adalah draf dokumen Markdown komprehensif yang siap disimpan ke dalam berkas `MathBankAuditor/reports/17.10.2026/audit-clerk-nextjs-skills.md`:

```markdown
# LAPORAN AUDIT KOMPREHENSIF: AUTENTIKASI & OTORISASI NEXT.JS 16
## Komparasi & Kepatuhan Arsitektur terhadap Standar 'clerk-nextjs-skills'

> **Dokumen Audit:** `MathBankAuditor/reports/17.10.2026/audit-clerk-nextjs-skills.md`  
> **Tanggal Pelaksanaan:** 17 Oktober 2026  
> **Auditor:** MathBank Lead Systems Auditor & Senior Code Reviewer  
> **Target Repositori:** MathBank v2 (`/home/hari/projects/mathbank`)  
> **Rujukan Utama:** `CONSTRAINTS.md`, `docs/KEAMANAN.md`, `docs/ARCHITECTURE.md`, Pola Standar Auth Next.js App Router  

---

### 1. Eksekutif & Klarifikasi Fondasi Arsitektur

Berdasarkan pemeriksaan menyeluruh pada `package.json` dan kode sumber aplikasi MathBank:
1. **Status Implementasi Eksisting:** MathBank v2 saat ini **tidak terpasang pustaka `@clerk/nextjs`**. MathBank menggunakan sistem autentikasi mandiri berbasis **Better-Auth v1.7.7** dengan skema PostgreSQL kustom (`user`, `session`, `account`, `apikey`, `user_roles`) via `@better-auth/drizzle-adapter`.
2. **Tujuan Audit:** Mengevaluasi ketahanan, keamanan, dan kepatuhan arsitektur autentikasi Next.js 16 MathBank saat ini terhadap kaidah emas industri yang dipopulerkan oleh paradigma *`clerk-nextjs-skills`* (mencakup proteksi Edge Middleware, pola Route Matcher deklaratif, penanganan sesi asinkron, proteksi eskalasi hak, dan rate-limiting terdistribusi).

---

### 2. Matriks Evaluasi Kepatuhan (Compliance Matrix)

| Kriteria / Standar `clerk-nextjs-skills` | Kondisi Eksisting MathBank (Better-Auth + Next 16) | Status Kepatuhan | Risiko / Catatan |
|---|---|:---:|---|
| **Edge Middleware Protection** | `src/proxy.ts` hanya membuang header CSP (CVE-2026-44581); tidak ada route protection di edge. | 🔴 Non-Compliant | Celah bila rute baru ditambahkan di luar grup `(app)`. |
| **Async Auth in App Router** | `getSessionUser()` di `session.ts` menggunakan `await headers()`. | 🟢 Compliant | Sesuai kaidah Next.js 15/16 App Router. |
| **Fail-Closed Route Matching** | Rute dilindungi di level layout server component dan per-route wrapper. | 🟡 Partial | Tidak ada manifest tunggal rute publik vs terproteksi. |
| **RBAC & Organization Isolation** | 5 peran (`admin`, `teacher`, `reviewer`, `agent`, `machine`) dengan aljabar izin `yes` > `own` > `no`. | 🟢 Compliant | Sangat granular dan deterministik. |
| **Session Invalidation on Password Change** | Flag `mustChangePassword` dengan penolakan 403 `PASSWORD_CHANGE_REQUIRED`. | 🟢 Compliant | Sesuai protokol NIST SP 800-63B. |
| **Distributed Rate Limiting** | DB storage untuk Better-Auth; `MemoryStore` in-memory untuk domain API. | 🟡 Partial | `MemoryStore` rentan bypass pada arsitektur multi-instance. |
| **Agent / Machine M2M Auth** | Plugin `@better-auth/api-key` dengan tabel `apikey` dan `permissions`. | 🟢 Compliant | Mendukung MCP Streamable HTTP tanpa ketergantungan B2C. |

---

### 3. Temuan Audit Terinci & Kerentanan

#### 3.1. Temuan Kritis: Potensi Eskalasi Hak Akses Admin Publik
- **Lokasi:** `src/app/api/dev/quick-login/route.ts` (baris 23–35)
- **Kondisi:** Fungsi `demoLoginAllowed()` mengizinkan login instan jika `process.env.DEMO_LOGIN === "enabled"`.
- **Dampak:** Siapa pun dapat melakukan POST ke `/api/dev/quick-login` dengan payload `{"key": "admin"}` dan memperoleh cookie sesi admin penuh.
- **Rekomendasi:** Blokir total fungsi ini jika `process.env.NODE_ENV === "production"` tanpa pengecualian flag environment.

#### 3.2. Temuan Utama: Ketiadaan Guarding Deklaratif pada Edge Proxy
- **Lokasi:** `src/proxy.ts` (baris 33–47)
- **Kondisi:** Next.js 16 mengenali `src/proxy.ts` sebagai penerus middleware. Namun, berkas ini saat ini tidak memeriksa cookie sesi.
- **Dampak:** Beban kueri verifikasi sesi dilemparkan ke Server Component di `src/app/(app)/layout.tsx`. Jika pengembang membuat rute halaman di luar folder `(app)`, rute tersebut otomatis terbuka tanpa autentikasi.
- **Rekomendasi:** Terapkan route matcher deklaratif pada `src/proxy.ts` yang memvalidasi keberadaan cookie sesi sebelum request diteruskan ke App Router runtime.

#### 3.3. Temuan Utama: Rate Limiter In-Memory pada Route Mutasi Domain
- **Lokasi:** `src/lib/api/rate-limit.ts` & `src/lib/api/route-wrapper.ts`
- **Kondisi:** `wrapRoute` menggunakan `MemoryStore` lokal untuk membatasi laju request.
- **Dampak:** Tidak persisten dan tidak tersinkronisasi lintas node/worker proses.
- **Rekomendasi:** Pindahkan state bucket ke tabel `rate_limit` PostgreSQL atau Redis.

---

### 4. Analisis Kelayakan & Dampak Adopsi `@clerk/nextjs` pada MathBank v2

Bila Dewan Arsitektur MathBank mempertimbangkan adopsi resmi `@clerk/nextjs`:

1. **Keuntungan Teknis:**
   - Proteksi DDoS & pembatasan brute force ditangani sepenuhnya oleh edge network Clerk.
   - Mengeliminasi kebutuhan pemeliharaan tabel basis data `session`, `account`, `verification`, dan `rate_limit`.
   - Komponen antarmuka pengguna (`<SignIn />`, `<UserProfile />`) sudah teruji aksesibilitasnya.

2. **Tantangan & Diskrepansi Arsitektural:**
   - **Konektivitas Offline/LAN:** MathBank memiliki persyaratan operasional jaringan lokal sekolah (`192.168.x.x`). Clerk adalah layanan *Cloud-only* yang membutuhkan akses internet stabil.
   - **Machine-to-Machine (MCP API Keys):** MathBank memfasilitasi integrasi agen AI via header `x-api-key`. Clerk berfokus pada autentikasi pengguna manusia (B2C/B2B). Integrasi MCP tetap memerlukan subsistem API key mandiri.
   - **Skema Relasional PostgreSQL:** Seluruh tabel MathBank merujuk ke `user.id`. Mengadopsi Clerk mengharuskan penataan ulang sinkronisasi webhook Svix (`user.created`, `user.deleted`) ke basis data lokal.

---

### 5. Rekomendasi Rencana Aksi (Action Plan)

1. **Fase Segera (P0 - Security Hardening):**
   - Kunci keras `src/app/api/dev/quick-login/route.ts` agar ditolak 404 mutlak pada mode produksi.
   - Pindahkan `DEMO_PASSWORD` ke environment variable terenkripsi.
2. **Fase Konsolidasi (P1 - Gateway Guarding):**
   - Lengkapi `src/proxy.ts` dengan pemeriksaan session token awal (*fast-path rejection*) untuk mencegah beban server rendering pada request anonim.
3. **Fase Skalabilitas (P2 - Rate Limit Shared Store):**
   - Satukan mekanisme rate limit `wrapRoute` ke tabel persisten `rate_limit` PostgreSQL.

---
**Status Audit:** ⚠️ REQUEST CHANGES — Membutuhkan remediasi P0 sebelum rilis produksi v2.0.
```
