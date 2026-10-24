Berikut adalah laporan audit keamanan komprehensif untuk codebase **MathBank v2**. Laporan ini disusun berdasarkan metodologi STRIDE, OWASP Top 10 (2021), OWASP Top 10 for LLM Applications, serta aturan teknis pada [`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md) dan [`AGENTS.md`](file:///home/hari/projects/mathbank/AGENTS.md).

Format laporan di bawah ini siap disimpan ke dalam berkas:
`MathBankAuditor/reports/17.10.2026/audit-security-auditor.md`

---

## Security Audit Report

### Summary
- **Critical:** 1
- **High:** 3
- **Medium:** 4
- **Low:** 2

---

### Findings

#### [CRITICAL] Broken Object Property Control & Permanent Lockout on `mustChangePassword`
- **Location:** [`server.ts:51-57`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L51-L57), [`page.tsx:72-80`](file:///home/hari/projects/mathbank/src/app/change-password/page.tsx#L72-L80), [`resolve.ts:39`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts#L39), [`route-wrapper.ts:307-309`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L307-L309)
- **Description:** 
  Terdapat dua kelemahan kritis yang saling terkait pada implementasi status `mustChangePassword`:
  1. Pada [`src/lib/auth/server.ts`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L51-L57), kolom tambahan `mustChangePassword` dikonfigurasi dengan `input: true` pada definisi skema Better Auth:
     ```typescript
     mustChangePassword: {
       type: "boolean",
       defaultValue: false,
       input: true, // <-- Vulnerability: Client dapat memanipulasi nilai ini secara langsung
     }
     ```
     Konfigurasi `input: true` mengizinkan pengguna yang telah terautentikasi untuk mengirim mutasi profil melalui endpoint standar Better Auth (`/api/auth/update-user`) dan mengubah flag keamanan mereka sendiri dari `true` menjadi `false` tanpa mengganti kata sandi (Mass Assignment / Broken Property Authorization).
  2. Alur resmi penggantian kata sandi wajib pada [`src/app/change-password/page.tsx`](file:///home/hari/projects/mathbank/src/app/change-password/page.tsx#L72-L80) hanya memanggil API bawaan `authClient.changePassword(...)`. Endpoint bawaan Better Auth tidak mengetahui logika kustom kolom `mustChangePassword` pada skema database MathBank, sehingga tidak pernah mereset nilai kolom tersebut menjadi `false`. Akibatnya, setiap pengguna yang ditandai wajib ganti password akan terkunci secara permanen (`HTTP 403 PASSWORD_CHANGE_REQUIRED`) dari seluruh endpoint API terproteksi pada [`route-wrapper.ts:307`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L307-L309) meskipun telah berhasil memperbarui kata sandinya.
- **Impact:** 
  1. Bypass kontrol keamanan autentikasi kata sandi awal/reset oleh aktor pengguna.
  2. *Denial of Service* permanen terhadap pengguna sah yang diminta mengganti kata sandi oleh administrator.
- **Proof of concept:** 
  - **Skenario 1 (Bypass):** Akun baru dengan `mustChangePassword: true` mengirim HTTP `POST /api/auth/update-user` dengan payload JSON `{"mustChangePassword": false}`. Nilai di database berubah menjadi `false`, dan pengguna memperoleh akses penuh tanpa pernah memenuhi kebijakan pergantian kata sandi.
  - **Skenario 2 (Lockout):** Pengguna masuk ke `/change-password`, mengisi kata sandi baru yang valid, dan form mengirim request ke `/api/auth/change-password`. Password berhasil diganti, tetapi kolom `must_change_password` di tabel `user` tetap `true`. Request berikutnya ke `/api/questions` atau endpoint lain langsung ditolak dengan kode `403 PASSWORD_CHANGE_REQUIRED`.
- **Recommendation:** 
  1. Ubah konfigurasi field pada [`src/lib/auth/server.ts`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L51-L57) menjadi `input: false` agar client tidak dapat menginjeksi nilai kolom ini.
  2. Implementasikan hook event paska penggantian password (atau custom API endpoint) yang secara eksplisit memperbarui status kolom `mustChangePassword = false` di PostgreSQL:
     ```typescript
     // src/lib/auth/server.ts
     mustChangePassword: {
       type: "boolean",
       defaultValue: false,
       input: false, // Aman dari client manipulation
     }
     ```
     ```typescript
     // Perbarui state di handler ganti password / database hook
     await db.update(users)
       .set({ mustChangePassword: false, updatedAt: new Date() })
       .where(eq(users.id, session.user.id));
     ```

---

#### [HIGH] Systemic Ownership Authorization Failure on Own-Scoped Permissions (CONSTRAINT #35 Violation)
- **Location:** [`flag/route.ts:13`](file:///home/hari/projects/mathbank/src/app/api/questions/[id]/flag/route.ts#L13), [`question-write.ts:236`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L236), [`topics/route.ts:22`](file:///home/hari/projects/mathbank/src/app/api/topics/route.ts#L22), [`topics/[id]/route.ts:31,39`](file:///home/hari/projects/mathbank/src/app/api/topics/[id]/route.ts#L31-L39), [`topic-service.ts:67,107,195`](file:///home/hari/projects/mathbank/src/lib/services/topic-service.ts#L67), [`events/route.ts:24`](file:///home/hari/projects/mathbank/src/app/api/events/route.ts#L24), [`sources/route.ts:30`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L30)
- **Description:** 
  Pada [`src/lib/auth/permissions.ts`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L32-L48), peran `teacher` dan `reviewer` didefinisikan memiliki cakupan izin bertipe `"own"` untuk aksi:
  - `question:flag` (`teacher: "own"`, `reviewer: "own"`)
  - `taxonomy:manage` (`teacher: "own"`, `agent: "own"`)
  - `reference:manage` (`teacher: "own"`, `agent: "own"`)

  Namun, fungsi evaluasi izin [`can(actor, perm, opts)`](file:///home/hari/projects/mathbank/src/lib/auth/guards.ts#L34-L44) secara ketat menetapkan invarian keamanan:
  ```typescript
  if (scope === "own") {
    if (!opts?.ownerId) return false; // Invarian: scope 'own' wajib diverifikasi terhadap ownerId
    return actor.id === opts.ownerId;
  }
  ```
  Di lapisan gerbang route (`wrapRoute`) dan lapisan service:
  1. Route handler [`/api/questions/[id]/flag`](file:///home/hari/projects/mathbank/src/app/api/questions/[id]/flag/route.ts#L13) memeriksa `permission: "question:flag"`, dan [`flagQuestion()`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L236) memanggil `assertCan(actor, "question:flag")` tanpa menyediakan `ownerId`.
  2. Route handler taxonomy (`/api/topics`, `/api/events`, `/api/sources`) memeriksa izin tanpa `ownerId`. Terlebih lagi, tabel database `topics`, `events`, dan `sources` sama sekali tidak memiliki kolom pemilik (`created_by` atau `owner_id`).
- **Impact:** 
  - Penolakan akses valid secara menyeluruh (*broken authorization / false 403*) bagi pengguna berhak (misal: guru yang ingin menandai soal buatannya sendiri).
  - Ketidakkonsistenan model izin: bila pengembang kelak tergoda melonggarkan pengecekan menjadi `"any"` untuk mengatasi error 403, akan terjadi eskalasi wewenang masif (*privilege escalation*).
- **Proof of concept:** 
  - Pengguna dengan peran `teacher` membuat soal. Ketika hendak menandai soalnya sendiri via HTTP `POST /api/questions/{id}/flag`, `wrapRoute` mengevaluasi `can(actor, "question:flag")` tanpa `ownerId`. Evaluator mendapati `scope === "own"` tetapi `opts.ownerId === undefined`, sehingga otomatis mengembalikan `false`. Permintaan ditolak dengan status `403 Forbidden: Missing permission: question:flag`.
- **Recommendation:** 
  1. Pada [`src/lib/services/question-write.ts:236`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L236), ambil `createdById` dari soal terlebih dahulu sebelum memanggil `assertCan`:
     ```typescript
     assertCan(actor, "question:flag", { ownerId: existing.createdById });
     ```
  2. Pada [`src/lib/auth/permissions.ts`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts), sesuaikan matriks izin untuk referensi taksonomi (`taxonomy:manage`, `reference:manage`). Karena entitas taksonomi bersifat global dan tidak memiliki kepemilikan individu, ubah hak akses `teacher` menjadi `null` (hanya admin/editor) atau ubah desain entitas jika guru memang diizinkan mengelola taksonomi global.

---

#### [HIGH] Incomplete SSRF IP Blocklist & TOCTOU DNS Rebinding in Media Ingest
- **Location:** [`fetch.ts:111-141`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L111-L141), [`fetch.ts:289-301`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L289-L301)
- **Description:** 
  Modul penarikan media eksternal (`fetchMedia`) memiliki dua kelemahan validasi jaringan:
  1. **Blacklist IP Tidak Lengkap:** Fungsi `isPrivateOrBlockedHost()` memvalidasi host terhadap daftar IP privat umum (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16), tetapi luput memblokir:
     - IPv4-mapped IPv6 addresses (misal: `::ffff:127.0.0.1`, `::ffff:169.254.169.254`).
     - Carrier-Grade NAT / CGNAT (`100.64.0.0/10`).
     - Alamat broadcast dan loopback lokal alternatif (`0.0.0.0/8`, `0.0.0.0`).
  2. **Time-of-Check to Time-of-Use (TOCTOU) DNS Rebinding:** Fungsi [`assertPublicTarget(targetUrl)`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L122) melakukan resolusi DNS awal menggunakan `dns.lookup()`. Namun setelah pemeriksaan lolos, penarikan data dilakukan menggunakan native `fetch(targetUrl.toString(), { redirect: "manual" })`. Runtime Node.js mengeksekusi resolusi DNS kedua secara independen saat membuka socket koneksi TCP. Penyerang dengan domain ber-TTL 0 dapat memetakan resolusi pertama ke IP publik (lolos validasi) dan resolusi kedua ke IP internal lokal/cloud metadata.
- **Impact:** 
  Server-Side Request Forgery (SSRF). Penyerang dapat memaksa server MathBank menghubungi *cloud instance metadata service* (misal: AWS/GCP IMDSv1 di `169.254.169.254`) untuk mengekstrak token kredensial IAM internal, atau memindai port layanan backend di jaringan lokal server.
- **Proof of concept:** 
  - Penyerang mendaftarkan domain DNS Rebinding (misal: `rebind.attacker.com` dengan TTL 0).
  - Request DNS ganjil mengembalikan `93.184.216.34` (IP publik valid), sedangkan request DNS genap mengembalikan `169.254.169.254` (atau `::ffff:127.0.0.1`).
  - Penyerang mengirim permintaan ingest media dengan URL `https://rebind.attacker.com/secret`.
  - Fungsi `assertPublicTarget` memeriksa resolusi pertama (publik) dan meloloskannya.
  - Native `fetch()` melakukan resolusi kedua saat membuat koneksi HTTP, terhubung ke endpoint metadata cloud internal dan menyimpan responsnya sebagai aset media.
- **Recommendation:** 
  1. Lengkapi sanitasi alamat IP privat untuk mencakup format IPv6-mapped IPv4 dan rentang jaringan khusus lainnya.
  2. Cegah DNS Rebinding dengan melakukan *IP pinning*: Sambungkan koneksi HTTP langsung ke IP yang telah diverifikasi pada tahap pertama, menggunakan custom dispatcher/agent pada Node.js/Undici:
     ```typescript
     import { Agent } from "undici";

     const resolvedIp = await assertPublicTarget(targetUrl);
     const dispatcher = new Agent({
       connect: {
         lookup: (_hostname, _options, callback) => {
           // Paksa socket terhubung hanya ke IP yang telah diverifikasi
           callback(null, [{ address: resolvedIp, family: 4 }]);
         },
       },
     });
     const res = await fetch(targetUrl.toString(), { dispatcher, redirect: "manual" });
     ```

---

#### [HIGH] Passwordless Admin Takeover via Unrestricted Quick-Login (`DEMO_LOGIN`)
- **Location:** [`quick-login/route.ts:24-28`](file:///home/hari/projects/mathbank/src/app/api/dev/quick-login/route.ts#L24-L28), [`demo-users.ts:19`](file:///home/hari/projects/mathbank/src/lib/auth/demo-users.ts#L19), [`smoke-prod.ts:84-88`](file:///home/hari/projects/mathbank/scripts/smoke-prod.ts#L84-L88)
- **Description:** 
  Endpoint dev login [`/api/dev/quick-login`](file:///home/hari/projects/mathbank/src/app/api/dev/quick-login/route.ts#L24-L28) dirancang untuk mempermudah pengujian lokal. Namun:
  1. Endpoint tersebut dapat diaktifkan di lingkungan manapun (termasuk staging atau produksi) hanya dengan menyetel environment variable `DEMO_LOGIN=enabled`.
  2. Berkas pengujian dan skrip otomatisasi [`scripts/smoke-prod.ts:84-88`](file:///home/hari/projects/mathbank/scripts/smoke-prod.ts#L84-L88) mendokumentasikan penggunaan fitur ini pada instance publik (`https://b.iyo.my.id`).
  3. Endpoint ini menerima parameter `{ key: "admin" }` dan langsung menerbitkan cookie sesi resmi untuk akun Administrator tanpa meminta kata sandi, verifikasi token, pembatasan alamat IP, maupun *rate limiting*.
- **Impact:** 
  Pengambilalihan penuh (*complete account takeover*) akun Administrator dan seluruh hak akses basis data jika `DEMO_LOGIN=enabled` tidak sengaja tertinggal pada deployment produksi atau staging publik.
- **Proof of concept:** 
  - Pada instance publik yang menyetel `DEMO_LOGIN=enabled`:
    ```bash
    curl -X POST https://target-domain/api/dev/quick-login \
      -H "Content-Type: application/json" \
      -d '{"key":"admin"}' -i
    ```
  - Server mengembalikan status `200 OK` disertai header `Set-Cookie: better-auth.session_token=...` yang valid untuk akun Administrator tertinggi.
- **Recommendation:** 
  Kunci endpoint ini secara permanen agar hanya aktif pada `process.env.NODE_ENV === "development"`. Blokir mutlak pengaktifan di lingkungan `production` atau `staging` meskipun flag `DEMO_LOGIN=enabled` disetel:
  ```typescript
  // src/app/api/dev/quick-login/route.ts
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Endpoint disabled in non-development environments" }, { status: 404 });
  }
  ```

---

#### [MEDIUM] Rate Limiting IP Spoofing via Unverified `X-Forwarded-For`
- **Location:** [`route-wrapper.ts:87-91`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L87-L91), [`img/[shortId]/route.ts:32-36`](file:///home/hari/projects/mathbank/src/app/img/[shortId]/route.ts#L32-L36), [`mcp/route.ts:43-47`](file:///home/hari/projects/mathbank/src/app/api/mcp/route.ts#L43-L47)
- **Description:** 
  Mekanisme pembatasan laju (*rate limiting*) pada pembungkus API mengekstrak IP klien dengan mengambil indeks pertama dari header `x-forwarded-for`:
  ```typescript
  function extractClientIp(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwardThis request was blocked by Gemini's filters. They can occasionally trigger by mistake on safe coding, security, or biology-related queries. Please try rephrasing your prompt. You can [send feedback](https://ai.google.dev/gemini-api/docs/troubleshooting#file-bug) or read more about [our policies here](https://policies.google.com/terms/generative-ai/use-policy).
