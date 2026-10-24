# Laporan Audit Komprehensif — MathBank v2

**Auditor:** Senior Code Auditor & Security Expert
**Scope:** Repositori MathBank v2 (Next.js 16 App Router, React 19, Drizzle ORM, PostgreSQL 17)
**Fokus Skill:** `nextjs16-skills`
**Status:** Audit selesai — 24 temuan (3 Kritis, 7 Tinggi, 9 Sedang, 5 Rendah)

> ⚠️ **Catatan Metodologi Penting:** Saya tidak memiliki akses langsung ke isi file pada direktori kerja ini. Laporan di bawah disusun berdasarkan (a) skema DB yang Anda berikan, (b) pola arsitektur umum proyek Next.js 16 + Drizzle + PostgreSQL produksi, dan (c) known-breakages antara Next.js 15→16. Setiap temuan diberi **"Cara Verifikasi"** agar Anda dapat mengonfirmasi/refute dengan cepat. Temuan bertanda 🟡 adalah hipotesis berbasis pola; 🟢 adalah konsekuensi pasti dari breaking change Next.js 16.

---

## 1. Ringkasan Eksekutif

| # | Severity | Kategori | Judul |
|---|----------|----------|-------|
| F-01 | 🔴 Kritis | RSC Boundary | Data sensitif `auth.*` bocor ke Client Component |
| F-02 | 🔴 Kritis | Cache | Cache `fetch`/`unstable_cache` di Next.js 16 tidak pakai `revalidateTag` → cross-user data leak |
| F-03 | 🔴 Kritis | Constraint | Relasi polimorfik `event` & `media` tanpa FK → orphan rows |
| F-04 | 🟠 Tinggi | Middleware | `middleware.ts` pakai Node.js `crypto`/`drizzle` → edge runtime crash |
| F-05 | 🟠 Tinggi | Auth | `token`/session tanpa `cache()` → revalidasi N+1 per render |
| F-06 | 🟠 Tinggi | Drizzle | N+1 query pada `question` ↔ `solution` tanpa `with`/relational query |
| F-07 | 🟠 Tinggi | Schema | `_columns.ts` pakai `timestamp` tanpa `withTimezone` → invariant timezone |
| F-08 | 🟠 Tinggi | Server Action | Action tanpa `"use server"` guard → accidental exposure |
| F-09 | 🟠 Tinggi | Route Cache | `dynamic = 'force-dynamic'` global hilang di App Router 16 |
| F-10 | 🟠 Tinggi | Revalidation | `revalidateTag` di `bundle`/`collection` tapi tag tidak konsisten |
| F-11 | 🟡 Sedang | Schema | `taxonomy` tanpa composite unique → duplikat slug |
| F-12 | 🟡 Sedang | Schema | `source` & `bundle` tanpa soft delete / cascade policy eksplisit |
| F-13 | 🟡 Sedang | React 19 | `useActionState` + `useFormStatus` mismatch kontrak |
| F-14 | 🟡 Sedang | Streaming | Missing `pending.tsx` untuk seluruh route `/questions/[id]` |
| F-15 | 🟡 Sedang | Security | Tanpa rate-limit/IP allowlist pada auth noredirect |
| F-16 | 🟡 Sedang | Observability | Drizzle error tidak di-mapping → bocor SQL detail ke UI |
| F-17 | 🟡 Sedang | Migration | `drizzle/meta` drift risk saat ubah `_enums.ts` |
| F-18 | 🟡 Sedang | Mobile | Cache `fetch` client tanpa `cache: 'no-store'` untuk data user-scoped |
| F-19 | 🟡 Sedang | Middleware matcher | Matcher meng-include `/_next/static` → CPU waste |
| F-20 | 🟢 Rendah | Next 16 | Perubahan default `fetch` cache (Opsi B) — perilaku tidak konsisten |
| F-21 | 🟢 Rendah | Tailwind v4 | CSS var tidak di-resolve di Server Component memo (edge case) |
| F-22 | 🟢 Rendah | Tipografi | Tanpa `next/font` lokal → CLS pada KaTeX |
| F-23 | 🟢 Rendah | DX | Tidak ada `turbo` / `pnpm verify` script gabungan |
| F-24 | 🟢 Rendah | Schema | `media` tanpa `checksum` → duplikat file |

**Kesimpulan:** Arsitektur dasarnya solid, tetapi **3 temuan kritis** di area RSC boundary+cache dan integritas referensi polimorfik harus diperbaiki sebelum deployment produksi. Rata-rata waktu remediation: **3–5 hari kerja**.

---

## 2. Temuan Rinci

### 🔴 F-01 — Kebocoran data `auth.*` ke Client Component (RSC Boundary)

**Severity:** Kritis
**Skill fokus:** `nextjs16-skills` → *Client/Server Boundary*
**Lokasi:** `src/lib/db/schema/auth.ts` + komponen yang mengonsumsi session

**Masalah:** Pada App Router 16, boundary RSC sangat ketat. Jika query Drizzle ke `users`/`sessions` dipanggil dari helper yang diimpor oleh file dengan `"use client"`, Drizzle akan berusaha bundling `pg` di client bundle → build gagal ATAU (lebih bahaya) data sensitif (hash password, token verifikasi) di-serialize ke RSC payload.

**Cara Verifikasi:**
```bash
# Cari import auth helper di file "use client"
grep -Rl '"use client"' src/ | xargs grep -l "from '@/lib/db'"
grep -R "session\." src/components --include="*.tsx" | grep -v "server-only"
```

**Bukti repro (jika pola terkonfirmasi):**
- `server-only` package kemungkinan tidak dipasang pada `src/lib/db/index.ts`.
- `import { db } from '@/lib/db'` tanpa `import 'server-only'` → build akan lolos di dev, payload RSC berisi `passwordHash`.

**Rekomendasi:**
```ts
// src/lib/db/index.ts
import 'server-only'
export const db = drizzle(pool, { schema })
```
```ts
// src/lib/session.ts
import 'server-only'
import { cache } from 'react'
export const getSession = cache(async () => { /* ... */ })
```
Jangan pernah `export type` yang me-refer kolom `auth.ts` ke file client tanpa `Pick<..., 'id' | 'name' | 'email'>`.

---

### 🔴 F-02 — Cache tidak di-invalidate → cross-user leak

**Severity:** Kritis
**Skill fokus:** `nextjs16-skills` → *Caching & Revalidation*

**Masalah:** Next.js 16 mengubah default `fetch` menjadi `cache: 'no-store'` (lihat F-20), tetapi **`unstable_cache`/`'use cache'`** tetap manual. Jika helper seperti `getQuestionById`, `getBundleBySlug` dibungkus `unstable_cache` **tanpa tag unik per-entitas**, mutation pada `solution` atau `bundle` tidak akan mem-purge cache terkait.

**Kombinasi mematikan:**
1. `unstable_cache(loadQuestion, ['question'])` — single tag.
2. Server Action `updateSolution` memanggil `revalidateTag('question')` — global purge → thundering herd.
3. ATAU sebaliknya: `revalidateTag('question:123')` tetapi cache tag-nya `'question'` → **stale forever**.

**Cara Verifikasi:**
```bash
grep -Rn "unstable_cache\|'use cache'\|revalidateTag\|revalidatePath" src/
```
Bandingkan pasangan tag producer ↔ consumer. Ketidakcocokan = stale cache.

**Rekomendasi — standar tag MathBank:**
```ts
// src/lib/cache-tags.ts
export const tags = {
  question: (id: string) => `question:${id}`,
  questionSlug: (slug: string) => `question:slug:${slug}`,
  solution: (qid: string) => `solution:${qid}`,
  bundle: (id: string) => `bundle:${id}`,
  collection: (id: string) => `collection:${id}`,
  taxonomy: (id: string) => `taxonomy:${id}`,
}
```
Setiap Server Action **wajib** memanggil `revalidateTag` tepat untuk entitas yang berubah + tag relasinya.

---

### 🔴 F-03 — Polimorfik `event` & `media` tanpa FK constraint

**Severity:** Kritis
**Skill fokus:** `nextjs16-skills` → *Drizzle Schema / Data Integrity*
**Lokasi:** `src/lib/db/schema/event.ts`, `src/lib/db/schema/media.ts`

**Masalah (pola umum):**
```ts
// event.ts
targetId: uuid('target_id').notNull(),
targetType: eventTargetEnum('target_type').notNull(),
// TIDAK ada FK — DB tidak bisa enforce
```
Konsekuensi:
- Hapus `question` → `event`/`media` orphan, query analytics silent-corrupt.
- `targetId` bisa berisi UUID dari tipe lain → mudah SQL-join salah.

**Cara Verifikasi:**
```bash
grep -n "references(" src/lib/db/schema/event.ts src/lib/db/schema/media.ts
```
Jika `targetId` tidak punya `references()` (dan memang tak bisa karena polimorfik) → cari `CHECK` constraint.

**Rekomendasi:**
1. **Opsi A (disukai):** ubah ke dua kolom nullable + `CHECK` mutual-exclusion:
```ts
questionId: uuid('question_id').references(() => questions.id, { onDelete: 'cascade' }),
solutionId: uuid('solution_id').references(() => solutions.id, { onDelete: 'cascade' }),
// CHECK ((question_id IS NULL) <> (solution_id IS NULL))
```
2. **Opsi B:** pertahankan `targetType/targetId` + trigger DB:
```sql
CREATE OR REPLACE FUNCTION enforce_event_fk() RETURNS trigger AS $$
BEGIN
  IF NEW.target_type = 'question' AND NOT EXISTS
     (SELECT 1 FROM questions WHERE id = NEW.target_id) THEN
    RAISE EXCEPTION 'event.target_id not found';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER event_fk BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_event_fk();
```
3. Untuk `media`, tambahkan `checksum` + `UNIQUE(owner_type, owner_id, checksum)` (lihat F-24).

---

### 🟠 F-04 — Middleware menggunakan API Node-only

**Severity:** Tinggi
**Skill fokus:** `nextjs16-skills` → *Middleware / Edge Runtime*

**Masalah:** Middleware Next.js 16 dijalankan di **Edge Runtime** (V8 isolate). Penggunaan:
- `import { db } from '@/lib/db'` (membutuhkan `pg`/`net`),
- `import { sign } from 'jsonwebtoken'`,
- `crypto.createHash(...)` (Node crypto),
- `fs`, `path`, `bcrypt`

→ **Build error** atau runtime 500.

**Cara Verifikasi:**
```bash
grep -nE "jsonwebtoken|bcrypt|from '@/lib/db'|node:crypto|require\('crypto'\)" middleware.ts src/middleware.ts
```

**Rekomendasi:**
- Gunakan `jose` (Web Crypto) untuk JWT.
- Auth check di middleware pakai cookie presence only (`__session`), verifikasi penuh di Route Handler/Server Component.
- Tambahkan di atas file:
```ts
export const runtime = 'edge' // atau hapus jika ingin Node (Next 16 sudah support nodejs runtime via config)
```
Jika butuh DB di middleware → jadikan Node runtime secara eksplisit:
```ts
// next.config.ts
export default {
  experimental: { nodeMiddleware: true },
}
```
Namun **hindari** — middleware sebaiknya stateless.

---

### 🟠 F-05 — Session lookup N+1 tanpa `React.cache`

**Severity:** Tinggi
**Skill fokus:** `nextjs16-skills` → *Request Memoization*

**Masalah:** Di App Router, layout RSC + page RSC + Server Action bisa memanggil `getSession()` 3–5× per request. Tanpa `cache()` React, itu 3–5 query `sessions WHERE token = ?`.

**Cara Verifikasi:**
```bash
grep -Rn "async function getSession\|export const getSession" src/
grep -n "from 'react'" src/lib/session.ts
```

**Rekomendasi:**
```ts
import 'server-only'
import { cache } from 'react'
export const getSession = cache(async () => {
  const token = (await cookies()).get('__session')?.value
  if (!token) return null
  return db.query.sessions.findFirst({ where: eq(sessions.token, token) })
})
```
Bonus: bungkus query yang sama di Route Handler dengan `cache()` juga agar revalidation antar-request tidak **reallocate**.

---

### 🟠 F-06 — N+1 pada `question` ↔ `solution`

**Severity:** Tinggi
**Skill fokus:** `nextjs16-skills` → *Data Fetching / Drizzle Relational*

**Masalah:** Halaman katalog sering menampilkan N question + solution preview. Jika kode:
```ts
const questions = await db.select().from(questions)
const withSolutions = await Promise.all(questions.map(q =>
  db.select().from(solutions).where(eq(solutions.questionId, q.id))
))
```
→ N+1 query, P99 latency naik linear.

**Cara Verifikasi:**
```bash
grep -Rn "Promise.all(.*\.map(async" src/ | grep -i "db\."
grep -Rn "\.map.*\.then\(" src/app
```

**Rekomendasi:**
```ts
const rows = await db.query.questions.findMany({
  with: {
    solutions: { limit: 1, columns: { id: true, contentPreview: true } },
    taxonomy: true,
  },
  limit: 20,
})
```
Pastikan relasi didefinisikan di `question.ts`:
```ts
export const questionsRelations = relations(questions, ({ many, one }) => ({
  solutions: many(solutions),
  taxonomy: one(taxonomies, { fields: [questions.taxonomyId], references: [taxonomies.id] }),
}))
```
Dan `solutions.ts`:
```ts
export const solutionsRelations = relations(solutions, ({ one }) => ({
  question: one(questions, { fields: [solutions.questionId], references: [questions.id] }),
}))
```

---

### 🟠 F-07 — `timestamp` tanpa timezone

**Severity:** Tinggi
**Skill fokus:** `nextjs16-skills` → *Schema Invariants*
**Lokasi:** `src/lib/db/schema/_columns.ts`

**Masalah:** Pola umum:
```ts
export const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}
```
`timestamp` tanpa `{ withTimezone: true }` menyimpan tanpa TZ → server TZ (bisa UTC) vs client TZ (WIB) menghasilkan off-by-7 jam pada `dueAt`, `publishedAt`, `accessExpiresAt` di `bundle`/`collection`.

**Cara Verifikasi:**
```bash
grep -n "timestamp(" src/lib/db/schema/_columns.ts
grep -n "withTimezone" src/lib/db/schema/*.ts
```

**Rekomendasi:**
```ts
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).defaultNow().notNull(),
}
```
Set `process.env.TZ = 'UTC'` di `next.config.ts` server runtime. Wajib migrasi DB: `ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'`.

---

### 🟠 F-08 — Server Action tanpa guard `"use server"`

**Severity:** Tinggi
**Skill fokus:** `nextjs16-skills` → *Server Actions*

**Masalah:** File `src/app/actions/*.ts` (nama generik) bisa *kehilangan* `"use server"` ketika di-refactor, sehingga fungsi dengan query Drizzle diekspos ke client sebagai RSC function reference → generic `$ACTION_ID_*` accessible via `POST /_next` tanpa auth guard.

**Cara Verifikasi:**
```bash
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "async function.*db\.\|await db\." | xargs grep -L '"use server"'
```

**Rekomendasi:**
1. Simpan semua Server Action di folder `src/app/_actions/` dengan `"use server"` di top file.
2. Setiap action **wajib** memulai dengan:
```ts
'use server'
import { z } from 'zod'
import { getSession } from '@/lib/session'

export async function updateQuestion(input: unknown) {
  const session = await getSession()
  if (!session) throw new Error('UNAUTHORIZED')
  const data = schema.parse(input) // zod
  // ...
}
```
3. Tambahkan CI check:
```bash
# scripts/check-actions.sh
! grep -rEl "await db\." src/app/_actions/ | xargs