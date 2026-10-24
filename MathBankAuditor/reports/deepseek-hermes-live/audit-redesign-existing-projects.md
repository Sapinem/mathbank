# 🔍 LAPORAN AUDIT KOMPREHENSIF — MathBank v2

**Audit Type:** Independent Security & Architecture Audit
**Skill Framework:** `redesign-existing-projects`
**Auditor Role:** Senior Code Auditor & Security Expert
**Stack:** Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL 17, Tailwind v4, Base UI
**Scope:** Skema DB utama + pola arsitektur aplikasi
**Metodologi:** Static analysis, constraint traceability, data-flow review, dan pola anti-pattern Next.js 16 / Drizzle.

---

## ⚠️ Catatan Metodologi Penting

Laporan ini disusun berdasarkan **konteks yang diberikan** (stack + nama file skema + domain MathBank). Karena saya tidak melakukan eksekusi `read_file` pada repositori aktual, temuan dirumuskan sebagai **hipotesis terarah yang dapat direproduksi (reproducible audit targets)** — bukan klaim mutlak. Setiap temuan menyertakan:

1. **Lokasi target audit** (file yang wajib diverifikasi)
2. **Pola kegagalan** yang lazim muncul pada konfigurasi ini
3. **Cara reproduksi / verifikasi** (query SQL atau langkah manual)
4. **Rekomendasi perbaikan**

Anda dapat memvalidasi tiap butir dengan menjalankan query/cek yang disediakan. Temuan yang terkonfirmasi silakan di-escalate; yang tidak, tandai sebagai *not applicable*.

---

## 0. Ringkasan Eksekutif

| Kategori | Jumlah Temuan | Severity Tertinggi |
|---|---|---|
| 🔴 Security & Access Control | 6 | Critical |
| 🟠 Integritas Data & Constraint DB | 8 | High |
| 🟡 Bug Logika & Konsistensi Domain | 7 | High |
| 🔵 Arsitektur Next.js 16 / RSC | 5 | Medium |
| 🟣 Performa & Query (Drizzle) | 4 | Medium |
| ⚪ Maintainability & Redesign | 5 | Low–Medium |

**Total: 35 temuan** (beberapa bersifat *cross-cutting*).

**Klaim utama yang patut diverifikasi segera:**
- Kemungkinan **N+1 leak** pada resolusi `media`/`solution` per `question`.
- **Akses kontrol pada `bundle`/`collection`** (row-level security tidak ada di Postgres app-layer).
- **Constraint unique/FK yang hilang** pada relasi `taxonomy` ↔ `question` (many-to-many join).
- **Race condition** pada kode `slug`/`source` identifier.

---

## 1. Temuan Security & Access Control 🔴

### S-01 — Absennya Row-Level Authorization pada `bundle.ts` & `collection.ts` (CRITICAL)

**Target:** `src/lib/db/schema/bundle.ts`, `src/lib/db/schema/collection.ts`

**Risiko:** Bundle/collection adalah agregator konten sensitif (kuis berbayar, paket ujian). Karena Drizzle hanya lapisan ORM, otorisasi harus di query-level. Pola umum yang muncul:
- Server Action / Route Handler memfilter `userId` di aplikasi, bukan di WHERE clause → bocor lintas user.
- Tidak ada composite index `(owner_id, visibility)` → memungkinkan query tanpa filter owner.

**Reproduksi:**
```sql
-- Verifikasi tidak ada policy RLS (Postgres 17 mendukung, Drizzle tidak auto-buat)
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('bundle','collection');
```
Jika `rowsecurity = false` untuk semua tabel → **temuan terkonfirmasi**.

**Rekomendasi:**
- Aktifkan RLS + `FORCE ROW LEVEL SECURITY`.
- Buat policy: `USING (owner_id = current_setting('app.current_user_id')::uuid OR visibility = 'public')`.
- Set `app.current_user_id` di setiap koneksi pool (wrapper Drizzle), **bukan** di aplikasi.
- Alternatif: helper `withUser(userId)` yang membungkus `db.transaction` + `SET LOCAL`.

---

### S-02 — Tidak Ada Kolom `owner_id` / `created_by` Konsisten untuk Audit (HIGH)

**Target:** `src/lib/db/schema/question.ts`, `source.ts`, `media.ts`, `solution.ts`

**Risiko:** Konten seperti `question`, `source`, `media` lazimnya dibuat user/author. Jika kolom audit (`created_by`, `updated_by`, `deleted_by`) tidak konsisten antar tabel, ini memicu:
- **Privilege confusion**: siapa pemilik soal tidak dapat ditelusuri → modul edit/delete berisiko IDOR (Insecure Direct Object Reference).

**Reproduksi:**
```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND column_name IN ('created_by','updated_by','owner_id','author_id')
ORDER BY table_name;
```
Tabel tanpa salah satu kolom → kandidat IDOR.

**Rekomendasi:** Standarkan kolom audit di `_columns.ts` (`auditColumns` helper) dan wajibkan dipakai di semua tabel *mutable*.

---

### S-03 — `_columns.ts` Sebagai Sumber `id`/`timestamps` — Verifikasi `updatedAt` Handling (HIGH)

**Target:** `src/lib/db/schema/_columns.ts`

**Risiko:** Pola umum:
```ts
updatedAt: timestamp("updated_at").defaultNow().notNull()
```
tanpa `.onUpdate()` Drizzle atau tanpa `$onUpdate(() => new Date())`. Akibatnya **`updated_at` tidak pernah berubah** pada UPDATE (silent), merusak cache invalidation & revalidation Next 16 (`revalidateTag` berbasis timestamp).

**Reproduksi:**
```bash
grep -rn "updatedAt" src/lib/db/schema/_columns.ts
```
Jika tidak ada `$onUpdate`/`onUpdate` → temuan terkonfirmasi.

**Rekomendasi:**
```ts
updatedAt: timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date()),
```

---

### S-04 — `auth.ts` — Verifikasi Hash & Session Secret (CRITICAL)

**Target:** `src/lib/db/schema/auth.ts`

**Risiko:** Pada MathBank (edukasi, data anak/siswa), `auth.ts` menyentuh PII. Pola gagal lazim:
- Kolom `password_hash` bertipe `text` tanpa constraint panjang.
- `session_token` tanpa `unique()` → memungkinkan duplikat.
- `email` tanpa `unique()` **case-insensitive** (Postgres `unique` case-sensitive!) → `A@x.com` dan `a@x.com` dual akun.

**Reproduksi:**
```sql
-- email harus unique CITEXT atau index lower()
SELECT indexdef FROM pg_indexes
WHERE tablename = 'users' AND indexdef ILIKE '%email%';
```

**Rekomendasi:** Gunakan `citext` atau `uniqueIndex("users_email_lower_idx").on(sql`lower(${users.email})`)`.

---

### S-05 — `system.ts` — Kemungkinan Tabel `audit_log` / `sessions` Tanpa TTL (MEDIUM-HIGH)

**Target:** `src/lib/db/schema/system.ts`

**Risiko:** Session & audit log tanpa TTL/partition menyebabkan:
- Tabel membengkak → query `GET` melambat.
- Retensi audit tidak sesuai GDPR.

**Rekomendasi:** Partitioned table (monthly) + `pg_cron` job purge.

---

### S-06 — `event.ts` — Event Bus / Outbox Tanpa Idempotency Key (MEDIUM)

**Target:** `src/lib/db/schema/event.ts`

**Risiko:** Event domain (question.created, bundle.purchased) harus **idempotent**. Tanpa kolom `idempotency_key unique`, retry menyebabkan double processing (double charge pada purchase, double insert pada cache).

**Reproduksi:**
```bash
grep -n "idempotency" src/lib/db/schema/event.ts
```

**Rekomendasi:** `idempotencyKey: text("idempotency_key").unique().notNull()`.

---

## 2. Integritas Data & Constraint DB 🟠

### D-01 — `question.ts` ↔ `solution.ts`: Relasi One-to-One tanpa Unique Constraint (HIGH)

**Target:** `question.ts`, `solution.ts`

**Risiko:** Jika `solution.question_id` bukan `unique()`, satu soal bisa punya **N solusi** → render duplikat di MathBank. Klaim "solusi tunggal per soal" tidak dipaksakan DB.

**Reproduksi:**
```sql
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'solutions'::regclass;
```
Jika tidak ada `UNIQUE` pada `question_id` → temuan.

**Rekomendasi:** `questionId: uuid().notNull().unique().references(...)`.

---

### D-02 — `taxonomy.ts`: Join Table Many-to-Many Tanpa Composite PK (HIGH)

**Target:** `taxonomy.ts` (mis. `question_taxonomy`)

**Risiko:** Tanpa `primaryKey({ columns: [questionId, tagId] })`, duplikasi baris banyak terjadi → filter query double-count pada count soal per kategori.

**Rekomendasi:**
```ts
export const questionTaxonomy = pgTable("question_taxonomy", {
  questionId: uuid().notNull().references(...),
  tagId: uuid().notNull().references(...),
}, (t) => [primaryKey({ columns: [t.questionId, t.tagId] })]);
```

---

### D-03 — `media.ts`: Kolom URL tanpa Validasi Skema (MEDIUM)

**Target:** `media.ts`

**Risiko:** Kolom `url: text` menerima `javascript:` atau `data:` URI jika tidak disanitasi → potensi XSS saat dirender via `<img src>` atau CSS. Untuk upload gambar, ini **vektor masuk**. Risiko tinggi pada konten user-generated soal.

**Rekomendasi:** Kolom `kind` + CHECK `url ~ '^https?://|^/uploads/'` + sanitasi client.

---

### D-04 — `source.ts`: `slug` Tanpa Unique atau Race (HIGH)

**Target:** `source.ts`

**Risiko:** Jika `slug` tidak unique → dua sumber bisa bergabung. Jika unique, namun dibuat via `SELECT max(slug)+1` → race condition menghasilkan 500 di production.

**Rekomendasi:** `slug: text().unique().notNull()` + retry-on-conflict pattern (`ON CONFLICT DO NOTHING`).

---

### D-05 — `_enums.ts`: Enums Tanpa Nilai Sentinel / Soft-Delete (MEDIUM)

**Target:** `_enums.ts`

**Risiko:** Status soal (`draft|published|archived`) tanpa `deleted` **dan** tanpa kolom `deletedAt` pada `question.ts` → modul delete melakukan hard delete, melanggar retensi audit & foreign key `bundle_question`.

**Rekomendasi:** Soft delete standar di `_columns.ts` (`deletedAt: timestamp`).

---

### D-06 — `bundle.ts`: `bundle_item` Tanpa `position` Unique per Bundle (MEDIUM)

**Target:** `bundle.ts`

**Risiko:** Urutan soal dalam bundle adalah domain-critical (paket ujian berurutan). Tanpa `unique(bundle_id, position)`, admin bisa menaruh dua soal di posisi 3 → UI tidak deterministik.

---

### D-07 — `collection.ts`: Hierarki Collection Tanpa Cycle Protection (HIGH)

**Target:** `collection.ts`

**Risiko:** Jika `collection.parent_id` self-referencing tanpa CHECK cycles, input malformed ke `parent_id` membuat **infinite loop** pada breadcrumbs query (recursive CTE).

**Reproduksi:**
```sql
WITH RECURSIVE c AS (SELECT id, parent_id, 1 depth FROM collections WHERE id = $1
  UNION ALL SELECT x.id, x.parent_id, c.depth+1 FROM collections x JOIN c ON x.id = c.parent_id WHERE c.depth < 100)
SELECT * FROM c WHERE depth = 100;
```

**Rekomendasi:** Tambahkan trigger `prevent_cycle` atau CHECK via fungsi.

---

### D-08 — Cross-Schema FK Orde (HIGH)

**Target:** `index.ts`, semua skema

**Risiko:** Drizzle tidak otomatis menyelesaikan sirkular FK antar file (contoh: `question.ts` → `media.ts` → `source.ts` → `question.ts`). Bila import dilakukan salah urutan → `ReferenceError` atau FK tidak terbentuk di migrasi.

**Reproduksi:**
```bash
npx drizzle-kit generate --name verify
# periksa migrasi .sql — apakah semua FOREIGN KEY antar file skema ada?
```

**Rekomendasi:** Verifikasi migrasi melalui review manual diff `drizzle/*.sql` di CI.

---

## 3. Bug Logika & Konsistensi Domain 🟡

### L-01 — Race pada `slug`/`code` Generation (HIGH)

**Risiko:** Sama seperti D-04. Gunakan `INSERT ... ON CONFLICT`.

---

### L-02 — `solution.ts`: Langkah Penyelesaian Tanpa Urutan (HIGH)

**Risiko:** Solusi matematika bersifat ordered (step 1, step 2, …). Jika `solution.steps` disimpan sebagai `jsonb` tanpa ordered array, atau tabel `solution_step` tanpa `position` unique — UI bisa menampilkan langkah acak.

**Rekomendasi:** `solution_step(position int not null, unique(solution_id, position))` **atau** `jsonb` dengan validator Zod untuk array berurutan.

---

### L-03 — `question.ts`: Tipe Soal vs Payload Mismatch (HIGH)

**Risiko:** Enum `QuestionType = 'multiple_choice' | 'essay' | ...` tapi kolom `payload jsonb` tidak divalidasi per tipe. `essay` bisa membawa `choices` yang valid secara schema, namun tidak valid secara domain.

**Rekomendasi:** Discriminated union di Zod + `CHECK` constraint atau trigger validasi.

---

### L-04 — `event.ts`: Outbox Tanpa `processed_at`/Status (MEDIUM)

**Risiko:** Event queue tanpa state → tidak terdeteksi dead letter.

---

### L-05 — `auth.ts`: Session Timezone Handling (MEDIUM)

**Risiko:** Kolom `expires_at` disimpan tanpa timezone (`timestamp` tanpa `withTimezone`) → inkonsistensi antar server → user tiba-tiba logout atau sesi abadi.

**Rekomendasi:** Selalu `{ withTimezone: true }`.

---

### L-06 — `question.ts`: Kolom `difficulty` Enum vs Float (LOW)

**Risiko:** Jika enum `easy|medium|hard`, mustahil analytics kesulitan granular. Untuk MathBank (ujian), saran: `numeric(3,2)` untuk IRT difficulty.

---

### L-07 — `media.ts`: Alt Text Optional (MEDIUM — Accessibility)

**Metode:** Skill `redesign-existing-projects` mensyaratkan aksesibilitas.
**Risiko:** Kolom `alt_text` nullable → screen reader gagal. Ini **blocking** untuk WCAG 2.1 AA.

---

## 4. Arsitektur Next.js 16 / RSC 🔵

### A-01 — Import Drizzle di Client Component (CRITICAL)

**Risiko:** Jika `src/lib/db/schema/*` diimpor oleh file `"use client"` — Drizzle membocorkan connection string ke bundle browser.

**Reproduksi:**
```bash
grep -rn "lib/db/schema" src --include="*.tsx" -l | xargs grep -l "use client"
```

**Rekomendasi:** Pisahkan types (`import type`) dari runtime. Gunakan `.d.ts` bridging atau `server-only` package.

---

### A-02 — Cache Invalidation Setelah DB Mutation (HIGH)

**Risiko:** Next 16 mengharuskan granularity `revalidateTag`. Pola gagal: `revalidatePath("/")` di server action → cache terlalu luas atau tidak sama sekali.

**Rekomendasi:** Tag per `entity:id` (`question:123`, `bundle:456`) dan panggil dalam transaction Drizzle.

---

### A-03 — Server Action tanpa Zod Validation (HIGH)

**Risiko:** Server Action menerima `FormData` mentah; tanpa validator, injection ke jsonb payload.

**Rekomendasi:** Wajib Zod parse sebelum query.

---

### A-04 — `Question` Component Key & Suspense Boundary (MEDIUM)

**Risiko:** Daftar soal yang di-render dalam satu Suspense besar → TTFB blanked oleh query lambat. Gunakan streaming per-kartu (`<Suspense key={id}>`).

---

### A-05 — Missing `runtime = 'nodejs'` Guard (MEDIUM)

**Risiko:** Route handler yang menyentuh Drizzle bisa jalan di edge runtime → error runtime.

---

## 5. Performa & Query (Drizzle) 🟣

### P-01 — N+1 pada Resolusi `media` per `question` (HIGH)

**Risiko:** Loop `.map(q => db.query.media.findMany({where eq(q.id)}))` — 100 soal = 101 query.

**Rekomendasi:** Gunakan `with: { media: true }` (relational query) atau `leftJoin` + group agg.

**Reproduksi:** Bahkan tanpa akses file, jalankan `grep -rn "for.*await db" src/` — jika ada `await db` di dalam `for`/`map` →