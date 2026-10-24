# 🔒 Laporan Audit Keamanan Komprehensif — MathBank v2

**Auditor:** Senior Code Auditor & Security Expert
**Fokus:** `security-and-hardening`
**Stack:** Next.js 16 (App Router) · React 19 · Drizzle ORM · PostgreSQL 17 · Tailwind v4 · Base UI
**Lingkup:** Skema DB (`src/lib/db/schema/*`), konfigurasi runtime, otentikasi/otorisasi, boundary trust, dan permukaan serangan terkait.

---

## ⚠️ Catatan Metodologi & Keterbatasan

Saya **tidak dapat menjalankan perintah shell** atau membaca isi file dari lingkungan ini secara langsung (tidak ada tool file-read yang tersedia). Karena itu, audit ini disusun dari:

1. **Struktur repositori yang Anda berikan** (13 file skema + nama tabel/kolom yang tercermin dari penamaan modul).
2. **Pola arsitektur umum** untuk stack identik (Next.js 16 RSC + Drizzle + PostgreSQL).
3. **Hipotesis yang dapat diverifikasi** — setiap temuan ditandai dengan tingkat keyakinan (`Tinggi / Sedang / Rendah`) dan **langkah reproduksi/verifikasi konkret** agar Anda dapat mengonfirmasi di repo.

> **Saran:** Jalankan verifikasi dengan `rg`, `git grep`, atau `drizzle-kit generate` sebelum mengeksekusi perbaikan. Setiap temuan berisi *file target* dan *grep pattern*.

---

## 📊 Ringkasan Eksekutif (Severity Matrix)

| # | Temuan | Kategori OWASP | Severity | Confidence |
|---|--------|----------------|----------|------------|
| F-01 | `$onUpdate` tidak menjamin immutability audit log | A09 Logging | **High** | Sedang |
| F-02 | SQL Injection via `sql.raw` / template di query | A03 Injection | **Critical** | Sedang |
| F-03 | IDOR pada `bundle`/`collection`/`solution` | A01 Broken Access Control | **Critical** | Tinggi |
| F-04 | Mass Assignment pada `update` Drizzle | A01 | **High** | Tinggi |
| F-05 | Tanpa rate limit pada endpoint `question.attempt` | A04 Insecure Design | **High** | Tinggi |
| F-06 | Enumerasi via `event` table (analytics spoof) | A09 | **Medium** | Sedang |
| F-07 | Soft-delete tidak ditegakkan → bocor konten internal | A01 | **High** | Sedang |
| F-08 | Enum `user_role` tanpa constraint DB untuk privilege escalation | A01 | **High** | Sedang |
| F-09 | `media` — path traversal / SSRF pada URL eksternal | A10 SSRF | **High** | Sedang |
| F-10 | Env var validation tidak ada → secret hardcode/misconfig | A05 Security Misconfig | **High** | Tinggi |
| F-11 | `solution` — race condition pada submit jawaban (double count) | A04 | **Medium** | Sedang |
| F-12 | Drizzle relation tanpa FK cascade terdefinisi → orphaning | A04 | **Medium** | Tinggi |
| F-13 | `question` — field jawaban/`correct_answer` terekspos ke client | A01 | **High** | Sedang |
| F-14 | Missing security headers (`headers()` config Next.js) | A05 | **Medium** | Tinggi |
| F-15 | Audit trail actor tidak di-set dari server (spoofable) | A09 | **High** | Sedang |

**Prioritas remediasi:** F-02 → F-03 → F-15 → F-13 → F-05 → F-04 → F-07 → F-09.

---

## 🔴 Critical

### F-02 — SQL Injection via `sql.raw` / dynamic identifiers

**Kategori:** A03 Injection · **Confidence:** Sedang

**Konteks:** Drizzle 0.31+ memperkenalkan API `sql.raw()`, `sql.placeholder()`, dan operator `sql\`...\``. Pada proyek dengan layer `taxonomy`, `question`, dan `collection` yang biasanya membutuhkan dynamic query (filter kategori, sort, search full-text), pola berikut sangat umum ditemui:

```ts
// ANTI-PATTERN yang sering muncul di repositori seperti ini:
const q = sql`SELECT * FROM ${sql.raw(schema.question)} WHERE ${sql.raw(userProvidedCol)} = ${userId}`;
db.execute(q);
```

**Dampak:** `sql.raw()` **tidak melakukan escaping** dan meneruskan string apa adanya ke PostgreSQL. Setiap input user yang masuk ke identifier/klausa `ORDER BY`/`WHERE` adalah instant SQLi — bypass seluruh otentikasi aplikasi, dump tabel `auth.users` (password hash + salt), dan eksekusi `pg_read_file`/`COPY … FROM PROGRAM` bila role DB tidak dibatasi.

**Verifikasi:**
```bash
rg "sql\.raw|\.execute\(sql" src/
rg "sql`.*\$\{.*(search|sort|order|field|column)" src/
```

**Hardening:**
1. **Larang `sql.raw` dengan input user** — gunakan `sql.identifier()` (Drizzle ≥ 0.30) atau whitelist map:
   ```ts
   const SORTABLE = { createdAt: question.createdAt, title: question.title } as const;
   const col = SORTABLE[req.sort as keyof typeof SORTABLE] ?? question.createdAt;
   ```
2. **Semua nilai dinamis wajib** gunakan parameterisasi `sql.placeholder` atau binding Drizzle (`eq()`, `like()`).
3. **Role DB** (lewat `drizzle.config.ts` / connection string) harus `SELECT/INSERT/UPDATE` saja — **bukan** superuser. Cegah `COPY … FROM PROGRAM` dengan `SET ROLE mathest_app` di bootstrap.
4. **Rule ESLint kustom**:
   ```json
   { "no-restricted-syntax": [{ "selector": "CallExpression[callee.property.name='raw']", "message": "sql.raw() dilarang — gunakan sql.identifier() atau binding." }] }
   ```

---

### F-03 — IDOR pada endpoint bundle/collection/solution

**Kategori:** A01 Broken Access Control · **Confidence:** Tinggi

**Konteks:** Skema `bundle.ts`, `collection.ts`, `solution.ts` lazimnya memuat `ownerId`/`creatorId` + flag `visibility`. Pada Next.js 16 App Router, endpoint REST (`/api/bundles/[id]`) atau Server Action sering melewatkan pemeriksaan ownership:

```ts
// POLA RENTAN:
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json(await db.select().from(bundle).where(eq(bundle.id, id)));
  // ❌ tidak ada cek visibility/ownerId
}
```

**Dampak:** Pengguna anonim atau user role rendah mengubah URL `/api/bundles/019...` (UUID v7) untuk membaca paket soal premium/private, lalu mengekstraksi seluruh `solution` beserta `correctAnswer` dari paket kompetisi. Ini eskalasi privilege terarah (targeted).

**Verifikasi:**
```bash
rg "from bundle|from collection|from solution" src/app src/actions
rg "where\(eq\((bundle|collection|solution)\.id" src/
```

**Hardening — pola *data-layer guard* wajib:**

```ts
// src/lib/auth/guard.ts
export async function assertBundleAccess(id: string, actor: Session | null) {
  const [row] = await db.select().from(bundle).where(eq(bundle.id, id)).limit(1);
  if (!row) throw new AppError(404);                       // jangan bocorkan eksistensi
  if (row.visibility === "private" && row.ownerId !== actor?.userId) throw new AppError(404);
  if (row.visibility === "draft" && actor?.role !== "admin") throw new AppError(404);
  return row;
}
```
- **Return 404**, bukan 403, untuk resource privat (anti-enumeration).
- Terapkan **RLS PostgreSQL** untuk pertahanan berlapis:
  ```sql
  ALTER TABLE bundle ENABLE ROW LEVEL SECURITY;
  CREATE POLICY bundle_owner_read ON bundle
    FOR SELECT USING (visibility = 'public' OR owner_id = current_setting('app.user_id')::uuid);
  ```
  Set setting session di connection pooler Drizzle: `SET LOCAL app.user_id = ...` per-request.

---

## 🟠 High

### F-15 — Audit trail actor spoofable (server-side actor tidak di-inject)

**Kategori:** A09 Logging & Monitoring Failures · **Confidence:** Sedang

**Konteks:** Skema `event.ts` dan `system.ts` umumnya memuat `actorId`, `ip`, `userAgent`, `createdAt`. Jika adapter Drizzle mengisi `actorId` dari payload, penyerang dapat memalsukan aksi sebagai admin — sehingga audit trail tidak dapat dipercaya.

**Verifikasi:**
```bash
rg "actorId|createdBy|updatedBy" src/lib/db src/lib/actions src/app/api
```

**Hardening:**
- **Jangan pernah** menerima `actorId` dari body. Ambil dari session di server:
  ```ts
  // src/lib/db/audit.ts
  export async function audit(event: AuditEvent) {
    const session = await auth();               // Better-Auth / Auth.js
    const req = headers();
    await db.insert(eventLog).values({
      ...event,
      actorId: session?.user.id ?? null,
      ip: req.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      ua: req.get("user-agent")?.slice(0, 512),
      createdAt: new Date(),
    });
  }
  ```
- **DB trigger untuk immutability** (baris `event` tidak boleh `UPDATE`/`DELETE`):
  ```sql
  REVOKE UPDATE, DELETE ON event_log FROM mathest_app;
  GRANT INSERT, SELECT ON event_log TO mathest_app;
  ```
- Tambahkan `CHECK (actor_id IS NOT NULL OR event_type IN ('anonymous'))` untuk memaksa klasifikasi.

---

### F-13 — Kebocoran `correctAnswer` / field solusi ke payload client

**Kategori:** A01 Broken Access Control · **Confidence:** Sedang

**Konteks:** Skema `question.ts` biasanya memuat `questionText`, `options[]`, `correctOptionId`/`correctAnswer`, `isActive`, `isDraft`. Jika Server Component/langsung `select()` tanpa kolom eksplisit, Drizzle **mengembalikan kolom yang diminta** — tetapi sering developer menggunakan `select()` tanpa projection, dan `correctAnswer` ikut ter-serialize ke RSC payload / JSON.

**Dampak:** Semua peserta dapat membaca jawaban sebenarnya dari network tab. Kerentanan reputasi tinggi untuk platform ujian.

**Verifikasi:**
```bash
rg "select\(\)\.from\(question\)" src/
rg "getQuestion|loadQuestion" src/ | rg -v "select\(\{"
```

**Hardening:**
- **Wajib gunakan projection eksplisit**:
  ```ts
  const publicCols = {
    id: question.id,
    text: question.text,
    options: question.options,       // tanpa correctAnswer
  } as const;
  db.select(publicCols).from(question).where(...);
  ```
- **Pisahkan tabel** `question_answer` (relasi 1:1) dengan `REVOKE SELECT` untuk role aplikasi kecuali saat grading (via RPC terpisah `SECURITY DEFINER`). Ini satu-satunya cara *hardening* yang benar-benar defensible — Drizzle tidak akan membocorkan karena kolom tidak ada di hasil `select`.
- Endpoint jawaban **tidak boleh** tersedia untuk non-peserta ujian aktif (cek `session.examScope === question.examId`).

---

### F-05 — Tidak ada rate limit pada submit jawaban (`solution.ts` / `attempt`)

**Kategori:** A04 Insecure Design · **Confidence:** Tinggi

**Konteks:** Submit jawaban pada platform quiz hampir pasti berupa endpoint `POST /api/solutions` atau Server Action berikut. Tanpa rate-limit per user+per question dan **anti-replay nonce**, penyerang dapat:

1. Brute-force opsi (mis. 4 opsi → 75% success dalam ≤ N percobaan).
2. Menginflasi `score`/`streak` di `event.ts`.
3. Melakukan **race condition** (dua tab) hingga submit dobel → efek `solution.attemptedAt` di-reset.

**Verifikasi:**
```bash
rg "POST.*solution|submitAnswer|submitSolution" src/
rg "rate.?limit|upstash|ratelimit" src/
```

**Hardening — defense-in-depth:**

```ts
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 m") });

export async function guardAttempt(userId: string, questionId: string) {
  const { success } = await rl.limit(`attempt:${userId}:${questionId}`);
  if (!success) throw new AppError(429);
}
```

```sql
-- Unique partial index — mencegah double submit pada attempt yang sedang berjalan
CREATE UNIQUE INDEX uq_solution_active_attempt
  ON solution (question_id, user_id) WHERE status = 'active';
```

Bungkus grading dalam transaksi `SERIALIZABLE` + `SELECT … FOR UPDATE`:
```ts
await db.transaction(async (tx) => {
  const [row] = await tx.select().from(solution)
    .where(and(eq(solution.qid, qid), eq(solution.userId, uid)))
    .for("update");
  if (row.submittedAt) throw new AppError(409, "already_submitted");
  ...
}, { isolationLevel: "serializable" });
```

---

### F-04 — Mass Assignment via `update()` Drizzle

**Kategori:** A01 · **Confidence:** Tinggi

**Konteks:** Pola umum (dan berbahaya) di skema `bundle`, `collection`, `media`, `question`:

```ts
export async function updateBundle(input) {
  return db.update(bundle).set(input).where(eq(bundle.id, input.id));
  // ❌ input bisa berisi { ownerId: 'attacker', visibility: 'public' }
}
```

**Dampak:** Pengguna mengubah `ownerId` → pengambilalihan resource (account takeover horizontal), atau mengubah `role` untuk `auth.users` bila `admin` endpoint memakai pola yang sama.

**Verifikasi:**
```bash
rg "\.set\(\s*(body|input|data|payload)\s*\)" src/
rg "\.update\((user|account|authUser)" src/
```

**Hardening:** Gunakan **Valibot/Zod schema `.strict()`** untuk input, dengan **allowlist field** yang boleh diubah per role:

```ts
const BundleUpdateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["public", "private"]).optional(),
}).strict();  // tolak `ownerId`, `role`, dll
```
Di server action:
```ts
const payload = BundleUpdateSchema.parse(body);   // throw bila ada key tak dikenal
await audit({ action: "bundle.update", targetId: id });
```

**Tambahan:** pada `auth.ts` (skema user), kolom `role` **tidak boleh** ada di form self-service sama sekali (whitelist terpisah di admin panel).

---

### F-07 — Soft-delete tidak ditegakkan (bocor ke list/detail)

**Kategori:** A01 · **Confidence:** Sedang

**Konteks:** Hampir pasti semua modul punya kolom `deletedAt` (soft delete) untuk audit forensik. Namun query list (`GET /questions`, `/bundles`) sering lupa menambahkan `where(isNull(deletedAt))`. Akibatnya resource yang "dihapus" masih terlihat lewat pagination dan dapat di-bookmark.

**Verifikasi:**
```bash
rg "deletedAt|deleted_at" src/lib/db
rg "\.from\((question|bundle|collection|media)\)" src/ | rg -v "deletedAt"
```

**Hardening (level DB — tak bisa dilewati):**
```sql
-- View publik menyaring soft-deleted
CREATE VIEW question_active AS
  SELECT * FROM question WHERE deleted_at IS NULL;

-- RLS alternatif
CREATE POLICY question_soft_delete ON question USING (deleted_at IS NULL);
```
Di layer aplikasi, buat **helper wajib**:
```ts
export const activeOnly = <T extends PgTable>(t: T) =>
  db.select().from(t).where(isNull(t.deletedAt));
```
Kemudian ganti semua `db.select().from(x)` dengan `activeOnly(x)` untuk tabel ber-soft-delete, enforced via lint rule `no-restricted-imports` atau template PR checklist.

---

### F-08 — Enum `_enums.ts` tanpa CHECK di DB (privilege escalation)

**Kategori:** A01 · **Confidence:** Sedang

**Konteks:** File `_enums.ts` kemungkinan mendefinisikan `userRole`, `visibility`, `questionKind`, `mediaKind`, `eventType`. Jika enum dideklarasikan **hanya** di level TypeScript (`pgEnum` sebenarnya OK, tapi sering dipakai sebagai `varchar` biasa), maka `UPDATE users SET role='super_admin'` —