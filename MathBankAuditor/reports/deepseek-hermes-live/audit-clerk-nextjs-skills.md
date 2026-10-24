# 🔐 Laporan Audit Komprehensif — MathBank v2
## Fokus: `clerk-nextjs-skills` (Autentikasi, Otorisasi & Integrasi Clerk + Next.js App Router)

---

## ⚠️ Catatan Penting Sebelum Membaca Laporan

Saya **tidak dapat mengakses direktori atau berkas** repositori MathBank v2 secara langsung dalam percakapan ini — saya tidak memiliki kemampuan mengeksekusi perintah shell, membaca filesystem, maupun menjalankan tool `Read`/`Grep` terhadap lingkungan Anda pada sesi ini. Karena itu, saya **tidak akan memalsukan temuan** seolah-olah saya telah membaca berkas tertentu.

Agar audit ini tetap bernilai tinggi dan **dapat langsung Anda validasi**, laporan disusun dalam dua bagian:

1. **Bagian A — Checklist Audit Berbasis Skill `clerk-nextjs-skills`** (temuan yang paling mungkin muncul di stack Anda, masing-masing disertai *sinyal deteksi* agar Anda bisa memverifikasi cepat dengan `grep`).
2. **Bagian B — Template temuan siap-isi + instruksi reproduksi** agar Anda bisa mengonversi sinyal menjadi temuan konkret dalam <15 menit.

Jika Anda ingin saya melakukan audit **berbasis isi berkas**, cukup lampirkan (paste) isi berkas kunci berikut ke chat, dan saya akan kembali dengan temuan yang benar-benar spesifik per-baris:
- `middleware.ts` (root atau `src/`)
- `src/app/layout.tsx`
- `src/lib/db/schema/auth.ts`
- `src/lib/auth.ts` / `src/lib/clerk.ts` (jika ada)
- `src/app/api/**/route.ts` (minimal sample)
- `drizzle.config.ts` + `.env.example`

---

## 1. Ringkasan Eksekutif

| Aspek | Status |
|---|---|
| Metode audit | Statis (berbasis pola & checklist skill) |
| Cakupan stack | Next.js 16 App Router, React 19, Drizzle ORM, PostgreSQL 17, Clerk |
| Fokus utama | Siklus hidup sesi Clerk ↔ sinkronisasi DB ↔ proteksi route ↔ webhook |
| Tingkat keparahan tertinggi yang perlu divalidasi | **P0 / Critical** — potensi *webhook tanpa verifikasi signature* & *bypass middleware pada Server Actions* |

> **Insight kunci Next.js 16 + Clerk:** Perubahan besar di Next.js 15/16 — `cookies()`, `headers()`, `params`, `searchParams` kini **async**. Integrasi Clerk (`auth()`, `currentUser()`) yang salah menempatkan `await` akan menghasilkan **sesi `null` secara diam-diam** → *silent auth bypass*. Ini adalah sumber bug paling umum pada stack yang Anda gunakan.

---

## 2. Bagian A — Checklist Audit Berbasis Skill

### 🔴 A1. `middleware.ts` — Konfigurasi Matcher & Proteksi Route

**Skill focus:** `clerkMiddleware()` harus membungkus proteksi dan matcher harus benar.

**Sinyal deteksi:**
```bash
# Cari middleware
find . -name "middleware.ts" -not -path "*/node_modules/*"

# Cek matcher (sumber bypass paling umum)
grep -n "matcher" -A5 middleware.ts
```

**Temuan yang paling sering (dan berisiko):**

| # | Pola Bermasalah | Dampak | Severity |
|---|---|---|---|
| A1.1 | Matcher default Clerk (`/((?!_next|.*\\..*).*)`) dipakai apa adanya → **mengabaikan** `/api/**` atau `/trpc/**` karena regex `.*\..*` salah mengira path API bersifat "file statis". | Endpoint API tidak terlindungi. | **Critical** |
| A1.2 | Matcher eksplisit `['/dashboard/:path*']` tanpa mencakup `/admin`, `/api/protected`, dll. | Route baru otomatis **terbuka** (fail-open). | **High** |
| A1.3 | `clerkMiddleware(async (auth, req) => { const { userId } = await auth(); if(!userId) return NextResponse.redirect(...) })` — pengalihan manual, **bukan** `auth.protect()`. Melewatkan `401` untuk API dan `role` handling. | Redirect loop untuk API, status code salah (`302` bukan `401`). | **High** |
| A1.4 | `auth.protect()` dipanggil **tanpa** pengecekan `isPublicRoute` → login page ikut terproteksi → **redirect loop**. | Login tidak bisa diakses. | **Medium** |

**Rekomendasi pola yang benar (Next.js 16 + Clerk v6+):**
```ts
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',      // WAJIB publik (webhook diverifikasi via signature, bukan sesi)
  '/api/health',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()   // 404 untuk user tak login, atau atur unauthenticatedUrl/role
  }
})

export const config = {
  matcher: [
    // Lewati file statis & _next, tapi TETAP jalankan untuk semua API
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)', // eksplisit
  ],
}
```

---

### 🔴 A2. Server Actions & Route Handlers — "Middleware ≠ Otorisasi"

**Skill focus:** `clerkMiddleware` **tidak** mengeksekusi otorisasi granular. Setiap Server Action & Route Handler wajib memanggil `await auth()` sendiri.

**Sinyal deteksi:**
```bash
# Cari Server Actions
grep -rn "use server" --include="*.ts" --include="*.tsx" src/

# Cari Route Handlers
find src/app -name "route.ts"

# Setiap action/handler WAJIB memanggil auth()
grep -rLn "await auth()\|auth.protect\|currentUser" $(grep -rl "use server" src/ --include="*.ts")
```

**Temuan konkret yang dapat direproduksi (bila `grep -L` di atas mengembalikan berkas):**

- **A2.1 — Server Action tanpa pengecekan auth.**
  - **Reproduksi:** Buka DevTools, salin payload action ID (dari network tab saat klik tombol di UI), lalu `fetch` POST ke `/` (Server Actions di Next 16 menuju root) dengan `Next-Action: <id>` dan body form — **tanpa cookie sesi**.
  - **Ekspektasi aman:** `401/403`.
  - **Jika berhasil:** **Critical** — *Insecure Direct Object Reference / unauthenticated mutation*.

- **A2.2 — `auth()` dipanggil tanpa `await`.**
  ```ts
  const { userId } = auth()   // ❌ di Next.js 16 → Promise, userId undefined
  if (!userId) redirect('/sign-in')  // tidak pernah kena
  ```
  - **Dampak:** semua user dianggap *authenticated*, atau sebaliknya seluruh app redirect. Bug logika senyap yang **tidak** menghasilkan error TypeScript hanya jika tipe caller tidak strict.
  - **Deteksi:** `grep -rn "= auth()" src/ | grep -v "await"` → harus kosong.

- **A2.3 — Otorisasi berbasis `userId` dari client (searchParams/headers).** Pola `const userId = req.headers.get('x-user-id')` → **spoofable**. Wajib dari `await auth()`.

---

### 🔴 A3. Webhook Clerk ↔ Sinkronisasi Drizzle (`auth.ts` schema) — Integrity & Idempotensi

**Skill focus:** Webhook Clerk adalah **satu-satunya** jalur tulis yang sah untuk tabel `users`. Ini titik rawan *auth ↔ DB divergence*.

**Sinyal deteksi:**
```bash
grep -rn "svix\|Webhook\|webhook" src/ --include="*.ts"
grep -n "clerkId\|clerk_id\|userId" src/lib/db/schema/auth.ts
```

**Temuan wajib divalidasi:**

| # | Isu | Dampak | Severity |
|---|---|---|---|
| A3.1 | Handler webhook **tanpa** `svix.verify(payload, headers)` (hanya `req.json()`). | **Siapa pun** dapat memanggil endpoint publik `/api/webhooks` dan menyisipkan/menghapus user, mengubah `role`. | **Critical** |
| A3.2 | `verify()` memakai **body teks** setelah `req.json()` → body sudah dikonsumsi → verifikasi selalu gagal, atau dibungkus `catch` yang men-*swallow* → **fail-open**. | Bypass signature. | **Critical** |
| A3.3 | Event `user.created` **tidak** di-*upsert* dengan `onConflictDoNothing({ target: users.clerkId })` → retry Clerk (at-least-once) menghasilkan *duplicate key* → webhook `500` → Clerk retry loop. | Data korup / user tak terbuat. | **High** |
| A3.4 | `user.deleted` hanya menghapus dari Clerk, **tidak** dari DB (atau soft-delete tanpa cascade) → akun "zombie" yang masih lolos `userId` check bila token cache. | Akses tidak sah pasca-hapus. | **High** |
| A3.5 | Perubahan `publicMetadata.role` di Clerk tidak di-*sync* ke kolom `role` di `auth.ts` saat event `user.updated`. Otorisasi membaca **sumber berbeda** (token vs DB) → *role confusion*. | Eskalasi hak akses jika Admin baca role dari DB lama. | **High** |
| A3.6 | Webhook handler tidak mengembalikan `200` cepat saat event tidak relevan → Clerk menandai gagal. | Retry storm. | **Medium** |

**Pola aman (ringkas):**
```ts
// src/app/api/webhooks/clerk/route.ts
import { verifyWebhook } from '@clerk/nextjs/webhooks' // v6+, handles svix internally

export async function POST(req: Request) {
  try {
    const evt = await verifyWebhook(req) // ✅ baca body mentah + verify
    switch (evt.type) {
      case 'user.created':
      case 'user.updated':
        await db.insert(users).values(mapUser(evt.data))
          .onConflictDoUpdate({ target: users.clerkId, set: mapUser(evt.data) })
        break
      case 'user.deleted':
        await db.update(users).set({ deletedAt: new Date() }).where(eq(users.clerkId, evt.data.id!))
        break
    }
    return new Response('ok', { status: 200 })
  } catch {
    return new Response('bad signature', { status: 400 })
  }
}
```
> **Catatan integritas DB:** `users.clerkId` pada `auth.ts` **wajib** `unique` + `notNull`. Tanpa itu, `onConflictDoUpdate` Anda tidak akan berfungsi dan `A3.3` menjadi fatal.

---

### 🟠 A4. Race Condition Webhook vs. First-Render (Cold Start)

**Skill focus:** Clerk sering "lebih cepat" dari webhook (terutama saat dev/emulator).  

**Skenario reproduksi:**
1. Daftar user baru.
2. Webhook tertunda (mis. tunnel dev mati).
3. User langsung akses `/dashboard` → `auth()` valid, **tetapi** row `users` belum ada di DB.
4. Query `db.select().from(users).where(eq(clerkId, userId))` → `undefined` → `throw`/`500`, atau (buruk) code jatuh ke default role `admin` (lihat `A5`).

**Rekomendasi:** Pola *lazy-upsert* di titik pembacaan (`getOrCreateUser`) untuk **guest→user** transisi, ATAU perketat dengan menolak akses s/d row ada. Yang **tidak boleh**: default-role = privileged.

---

### 🟠 A5. Default Role & Fallback Otorisasi

**Sinyal:** `grep -rn "role\b" src/lib/db/schema/auth.ts src/lib/auth*` dan cari `?? 'admin'` / `|| 'admin'` / `case role`.

- **A5.1** Fallback default ke `'admin'`/`'editor'` saat `publicMetadata.role` kosong → **privilege escalation** via akun baru.
- **A5.2** Otorisasi diperiksa *hanya* di layer UI (`<Show when="signed-in">`) tanpa pengecekan server. Reproduksi: bypass UI → Server Action jalan.
- **A5.3** Role tidak di-*namespaced* pada konstanta tunggal (`_enums.ts`) — mismatch string antara Clerk metadata dan enum DB memicu `invalid input value for enum` (Postgres `22P02`) → **500** atau, bila di-`try/catch`, jatuh ke default.

---

### 🟡 A6. Sesi, Token & Data Pribadi

| # | Isu | Deteksi |
|---|---|---|
| A6.1 | Endpoint mengembalikan `currentUser().privateMetadata` / `emailAddresses` mentah ke client. | `grep -rn "currentUser" src/` → cek `return NextResponse.json(user)` |
| A6.2 | `getAuth()` lama dipakai (deprecated di v6, sinkron) → selalu `null` di RSC. | `grep -rn "getAuth" src/` |
| A6.3 | `auth().sessionClaims` dipakai sebagai satu-satunya sumber role tanpa re-fetch → user yang di-revoke masih lolos selama token (default 60s TTL) valid. Bisa diterima, tapi **wajib** didokumentasikan dan untuk aksi kritis (delete/export) re-verifikasi server-side. | — |
| A6.4 | Redirect terbuka: `const redirectUrl = searchParams.get('redirect_url'); router.push(redirectUrl)` → **open redirect** setelah sign-in. Wajib *allowlist* path internal. | `grep -rn "redirectUrl\|returnUrl" src/` |

---

### 🟡 A7. Drizzle + Otorisasi Query (Row-level)

- **A7.1** Semua query mutasi wajib menyertakan `and(eq(table.userId, userId), eq(table.id, id))` — bukan hanya `eq(table.id, id)` setelah cek login. Cek login **≠** cek kepemilikan. Reproduksi: user A mengirim `id` milik user B → sukses (IDOR).
- **A7.2** RLS PostgreSQL 17 **tidak** aktif untuk tabel sensitif; semua diandalkan ke aplikasi. Jika arsitektur menerima, pastikan tidak ada endpoint yang query tanpa filter `userId`.
- **A7.3** `bundle.ts`/`collection.ts` atau `event.ts` yang menyimpan `createdBy` — pastikan policy akses ditulis di service layer secara eksplisit, bukan implisit.

---

## 3. Bagian B — Template Temuan Siap-Isi

Isi satu blok per temuan valid (hapus yang tidak relevan):

```markdown
### [SEV-XX] Judul Singkat

- **Berkas:** `path:line`
- **Kategori:** Clerk / Next.js 16 / Drizzle / Otorisasi
- **Severity:** Critical | High | Medium | Low
- **Skill reference:** A3.1

**Deskripsi**
<apa yang salah, mengapa berbahaya>

**Reproduksi**
1. <langkah>
2. <langkah>
3. <observasi>

**Bukti**
```ts
<kode bermasalah>
```

**Dampak**
<teknis + bisnis>

**Perbaikan**
```ts
<kode aman>
```

**Test regresi**
- [ ] unit/integration test yang gagal sebelum fix, lolos sesudah.
```

---

## 4. Prioritas Perbaikan (Roadmap 2 Sprint)

| Sprint | Fokus | Item |
|---|---|---|
| **Sprint 1 (blokir rilis)** | Hardening auth | A1.1, A1.2, A2.1, A3.1, A3.2, A5.1, A7.1 |
| **Sprint 2** | Integritas & observabilitas | A3.3–A3.6, A4, A6.1, A6.4 |

**Gate kualitas sebelum rilis** (wajib hijau):
```bash
# 1) Tidak ada auth() tanpa await
! grep -rn "= auth()" src/ | grep -v await

# 2) Semua Server Action punya auth()
test -z "$(grep -rL 'await auth()\|auth.protect\|currentUser' $(grep -rl 'use server' src/ --include='*.ts'))"

# 3) Webhook terverifikasi
grep -q "verifyWebhook\|svix" src/app/api/webhooks/clerk/route.ts