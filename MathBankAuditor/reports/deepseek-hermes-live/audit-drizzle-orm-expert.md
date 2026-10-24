# 🔒 Laporan Audit Komprehensif — MathBank v2
## Fokus: Drizzle ORM Expert | Kategori: Security & Data Integrity

---

> **⚠️ Catatan Metodologi Penting**
> Saya tidak memiliki akses filesystem langsung ke repositori pada sesi ini. Laporan disusun berdasarkan (a) pemetaan file yang Anda berikan, (b) konvensi umum Drizzle ORM + Next.js App Router + PostgreSQL 17, dan (c) pola anti-pattern yang lazim ditemukan di repositori bertipe ini. Setiap temuan diberi **"Titik Verifikasi"** agar Anda dapat mengonfirmasi/menyangkal dengan cepat. Mohon dijadikan checklist audit, bukan verdict final, sampai dikonfirmasi pada kode aktual.

---

## 1. Ringkasan Eksekutif

| Kategori | Tingkat Risiko | Jumlah Temuan |
|---|---|---|
| **Security (SQLi, RBAC, IDOR)** | 🔴 Kritis | 4 |
| **Data Integrity (Constraint, FK, Cascade)** | 🟠 Tinggi | 5 |
| **Drizzle Logic Bug (Query, Transaction, Types)** | 🟠 Tinggi | 6 |
| **Schema Design (Enum, Index, Soft Delete)** | 🟡 Sedang | 5 |
| **Migration & Runtime Safety** | 🟡 Sedang | 4 |
| **Performance (N+1, Missing Index)** | 🟢 Rendah | 3 |

**Verdict:** Repositori memerlukan hardening sebelum produksi—terutama pada lapisan **transaksi multi-tabel (bundle/collection/question)**, **validasi input Drizzle `sql.raw`**, dan **soft-delete inconsistency** yang berpotensi menyebabkan kebocoran data.

---

## 2. Temuan Kritis — Security

### 🔴 C-01: Potensi SQL Injection via `sql.raw()` / Dynamic Identifier

**Lokasi kandidat:** `src/lib/db/schema/_columns.ts`, query builder di layer service (biasanya `src/lib/services/*.ts` atau `src/actions/*.ts`).

**Pola berbahaya yang harus dicari:**

```ts
// ❌ ANTI-PATTERN
db.select().from(questions).where(sql.raw(`title ILIKE '%${userInput}%'`));
```

```ts
// ❌ Dinamis kolom
db.select().from(questions).orderBy(sql.raw(req.query.sortBy));
```

**Risiko:** Drizzle secara desain *safe by default* (menggunakan prepared statement + parameter binding). Satu-satunya jalan masuk SQLi adalah `sql.raw()`, `db.execute()` dengan string interpolation, atau `pgTable()` dinamis dari input.

**Checklist Verifikasi:**
- [ ] `grep -rn "sql\.raw" src/`
- [ ] `grep -rn "db\.execute(sql" src/`
- [ ] `grep -rn "\${.*}" src/lib/db/`
- [ ] Pastikan semua query dinamis menggunakan `sql.identifier()` untuk identitas, `sql\`${col} = ${value}\`` untuk nilai.

**Rekomendasi:**

```ts
import { sql } from 'drizzle-orm';

// ✅ Safe: parameterized
db.select().from(questions).where(
  sql`${questions.title} ILIKE ${'%' + userInput + '%'}`
);

// ✅ Safe: whitelist sort
const SORT_MAP = {
  title: questions.title,
  createdAt: questions.createdAt,
} as const;
const col = SORT_MAP[sortBy as keyof typeof SORT_MAP] ?? questions.createdAt;
db.select().from(questions).orderBy(asc(col));

// ✅ Safe: identifier dinamis
sql.identifier(validatedColumn);
```

---

### 🔴 C-02: `view` PostgreSQL Tanpa `security_invoker` → Row-Level Leak

**Lokasi:** `src/lib/db/schema/system.ts`, `src/lib/db/schema/event.ts` (kemungkinan `event_view`, `stats_view`).

**Risiko:** Sejak PostgreSQL 15, `CREATE VIEW` default berjalan dengan privilege **owner**. Jika Next.js app terkoneksi sebagai user `app_reader` sementara view milik `postgres` superuser → **bypass RLS**.

**Titik Verifikasi:**
```bash
grep -rn "pgView\|CREATE VIEW\|security_invoker" src/lib/db/
```

**Rekomendasi:**

```ts
import { pgView } from 'drizzle-orm/pg-core';

export const eventStatsView = pgView('event_stats_view', {
  // ...columns
}).with({ securityInvoker: true })  // ✅ Drizzle 0.31+
  .as((qb) => qb.select().from(events));
```

Jika versi Drizzle belum mendukung `.with()`, gunakan migration SQL manual:
```sql
ALTER VIEW event_stats_view SET (security_invoker = true);
```

---

### 🔴 C-03: Missing RBAC di `source.ts` & `bundle.ts` — IDOR pada Relasi Owner

**Lokasi:** `src/lib/db/schema/source.ts`, `src/lib/db/schema/bundle.ts`, `src/lib/db/schema/collection.ts`.

**Risiko:** Jika `sources` memiliki `createdBy`/`ownerId` tapi query Next.js hanya memfilter `id`, maka user A dapat membaca bundle milik user B dengan enumerasi UUID.

**Titik Verifikasi:**
- [ ] Cari `db.select().from(bundles).where(eq(bundles.id, id))` **tanpa** `.and(eq(bundles.createdBy, session.user.id))`
- [ ] Cari route handler di `app/api/bundles/[id]/route.ts` dst.

**Rekomendasi Pola:**

```ts
const [bundle] = await db
  .select()
  .from(bundles)
  .where(and(
    eq(bundles.id, id),
    eq(bundles.createdBy, session.user.id)   // ✅ ownership check
  ))
  .limit(1);

if (!bundle) return notFound(); // jangan bedakan "tidak ada" vs "bukan milik"
```

---

### 🔴 C-04: `drizzle-kit` Credentials Leak

**Titik Verifikasi:**
- [ ] File `drizzle.config.ts` — pastikan `dbCredentials` menggunakan `process.env.DATABASE_URL`, bukan hardcoded.
- [ ] Pastikan `.env*` masuk `.gitignore`, dan dump contoh di `.env.example` tanpa nilai asli.
- [ ] Commit history: `git log -p --all -S "postgres://"`

---

## 3. Temuan Tinggi — Data Integrity

### 🟠 H-01: Missing `onDelete` pada FK dari `solution.ts` → `question.ts`

**Lokasi:** `src/lib/db/schema/solution.ts`.

**Risiko:** Menghapus question akan **gagal** (RESTRICT default) atau **meninggalkan orphan** jika constraint tidak ada sama sekali. Untuk solusi yang merupakan child dari question, hampir pasti harus `cascade`.

**Titik Verifikasi:**
```bash
grep -n "references" src/lib/db/schema/solution.ts
```

**Pola wajib:**
```ts
export const solutions = pgTable('solutions', {
  questionId: uuid('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),  // ✅
  // ...
});
```

**Matriks Rekomendasi Cascade:**

| Relasi | `onDelete` | Alasan |
|---|---|---|
| `solution.questionId → question.id` | `cascade` | Solusi tidak bermakna tanpa question |
| `media.questionId → question.id` | `cascade` | Media embedded |
| `question.mediaId → media.id` (nullable) | `set null` | Media bisa di-share |
| `bundleItem.bundleId → bundle.id` | `cascade` | Junction |
| `bundleItem.questionId → question.id` | `restrict` | **Cegah** hapus question yang dipakai bundle aktif |
| `collection.bundleId → bundle.id` | `restrict` | Proteksi koleksi |
| `question.taxonomyId → taxonomy.id` | `set null` | Taxonomy boleh dihapus |
| `sessions.userId → user.id` | `cascade` | Auth cleanup |

---

### 🟠 H-02: Soft-Delete + Unique Constraint = Conflict

**Lokasi:** `src/lib/db/schema/question.ts`, `taxonomy.ts` (kemungkinan ada kolom `deletedAt`).

**Risiko:** `@unique()` pada `slug` atau `name` akan **memblokir re-create** setelah soft-delete. User tidak bisa membuat ulang taxonomy yang pernah dihapus → 500 error pada `INSERT`.

**Pola buruk:**
```ts
// ❌
export const taxonomy = pgTable('taxonomy', {
  name: text('name').notNull(),
  deletedAt: timestamp('deleted_at'),
}, (t) => [unique().on(t.name)]);  // unique tetap aktif saat soft-delete
```

**Fix (Partial Index):**
```ts
import { uniqueIndex, sql } from 'drizzle-orm/pg-core';

}, (t) => [
  uniqueIndex('taxonomy_name_active_uniq')
    .on(t.name)
    .where(sql`${t.deletedAt} IS NULL`),  // ✅
]);
```

> **Catatan Drizzle:** `.where()` pada `uniqueIndex` didukung penuh di Drizzle ORM ≥ 0.30. Reproduksi: `INSERT` → `UPDATE ... SET deleted_at=now()` → `INSERT` ulang dengan nama sama → error `23505`.

---

### 🟠 H-03: Timestamp Kolom Tanpa `timezone: true` — Silent Bug

**Lokasi:** `src/lib/db/schema/_columns.ts` (kemungkinan helper `timestampCol()`).

**Risiko:** PostgreSQL `TIMESTAMP` (tanpa tz) menyimpan **wall-clock**, sehingga aplikasi multi-timezone (atau yang migrasi server region) menghasilkan pergeseran waktu. Untuk `created_at`, `expires_at` sesi, `published_at`, ini bug fatal.

**Pola buruk:**
```ts
// ❌
export const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
};
```

**Fix:**
```ts
// ✅
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow().notNull().$onUpdate(() => new Date()),
};
```

**Validasi:**
```sql
\d+ questions  -- harus `timestamp with time zone`
```

---

### 🟠 H-04: Enum Migration Drift

**Lokasi:** `src/lib/db/schema/_enums.ts`.

**Risiko:** `pgEnum` sangat sering memicu *migration drift* karena PostgreSQL tidak dapat `DROP VALUE` dari enum. Menambah/menghapus value di kode tanpa migration manual → `drizzle-kit push` **mengabaikan** perubahan; `drizzle-kit generate` membuat migration yang **gagal** di prod.

**Aturan yang harus dipatuhi:**
1. **Jangan pernah** rename value enum — buat enum baru + migrasi via temporary column.
2. Untuk menambah value: `ALTER TYPE ... ADD VALUE` aman **sejak PG 12**, tapi harus commit terpisah dari `ADD COLUMN ... DEFAULT` yang memakainya (error `unsafe use of new value of enum type`).
3. Drizzle men-generate `ALTER TYPE ADD VALUE` — **jangan jalankan di dalam transaksi** (bug lama PG, fixed hanya untuk beberapa kasus).

**Rekomendasi:** Pertimbangkan `text` + `CHECK` constraint untuk enum yang sering berubah (mis. `question_status`, `event_type`), gunakan `pgEnum` hanya untuk yang benar-benar stabil (`user_role`).

---

### 🟠 H-05: `bundleItem` — Missing Composite PK / Unique

**Lokasi:** `src/lib/db/schema/bundle.ts`.

**Risiko:** Tabel junction `bundle_items(bundle_id, question_id)` tanpa `PRIMARY KEY(bundle_id, question_id)` atau `UNIQUE` memungkinkan duplikasi baris → bundle menampilkan soal yang sama berkali-kali, dan skor agregat bergeser.

**Fix:**
```ts
export const bundleItems = pgTable('bundle_items', {
  bundleId: uuid('bundle_id').notNull().references(() => bundles.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'restrict' }),
  position: integer('position').notNull(),
  // ...
}, (t) => [
  primaryKey({ columns: [t.bundleId, t.questionId] }),  // ✅
  uniqueIndex('bundle_items_position_uniq').on(t.bundleId, t.position),  // ✅
]);
```

---

## 4. Temuan Tinggi — Drizzle Logic Bug

### 🟠 L-01: Transaksi Multi-Tabel Tidak Dibungkus

**Lokasi:** Kemungkinan besar `createBundle`, `submitQuestion`, `processEvent`.

**Pola buruk:**
```ts
// ❌ Partial failure → orphan
const [bundle] = await db.insert(bundles).values(...).returning();
await db.insert(bundleItems).values(items);  // jika gagal → bundle kosong
```

**Fix:**
```ts
await db.transaction(async (tx) => {
  const [bundle] = await tx.insert(bundles).values(...).returning();
  await tx.insert(bundleItems).values(items.map(i => ({ bundleId: bundle.id, ...i })));
});
```

**Reproduksi:** Putuskan koneksi setelah insert pertama (misal `SET statement_timeout='50ms'`), observe bundle tanpa item.

---

### 🟠 L-02: `.returning()` Missing on `insert` yang Butuh ID Langsung

**Pola buruk:**
```ts
// ❌
await db.insert(media).values({ ... });
// kemudian query ulang berdasarkan field non-unique:
const media = await db.select().from(mediaTable).where(eq(mediaTable.url, url));
// → race condition jika concurrent insert URL sama
```

**Fix:** `.returning({ id: mediaTable.id })` dan gunakan hasilnya.

---

### 🟠 L-03: `eq()` pada Kolom Nullable — Silent Empty Result

**Pola:** `where(eq(questions.deletedAt, null))` menghasilkan `deleted_at = NULL` → **selalu false** (SQL three-valued logic).

**Fix:**
```ts
import { isNull, isNotNull } from 'drizzle-orm';
where(isNull(questions.deletedAt))
```

**Grep wajib:** `grep -rn "eq(.*, null)" src/` — nol tolerance.

---

### 🟠 L-04: Relational Query (`db.query.*`) Lupa `with: { deletedAt: isNull() }`

**Risiko:** Jika Anda menggunakan Drizzle relational API (`db.query.questions.findMany({ with: { solutions: true } })`), filter soft-delete **tidak otomatis** diterapkan ke relasi anak.

**Fix:**
```ts
db.query.questions.findMany({
  with: {
    solutions: { where: isNull(solutions.deletedAt) },  // ✅
  },
  where: isNull(questions.deletedAt),
});
```

---

### 🟠 L-05: `$onUpdate` vs `$defaultFn` — Salah Pilih

**Pola:** `updatedAt: timestamp(...).defaultNow()` — tidak update otomatis saat `UPDATE`.

**Fix:**
```ts
updatedAt: timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date()),  // ✅ dipanggil oleh Drizzle pada setiap .update()
```

**Catatan:** `$onUpdate` hanya berjalan via Drizzle query builder; **tidak** berjalan jika ada `UPDATE` via raw SQL atau trigger eksternal. Untuk defense in depth, tambahkan trigger DB:
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

---

### 🟠 L-06: Prepared Statement Tanpa Cache di Edge Runtime

**Risiko:** Jika query dipanggil per-request di route handler yang `runtime='edge'`, Drizzle dengan `prepare: true` (default `postgres-js`/`node-postgres`) akan **gagal** atau menambah latensi. Di `app/api/**` dengan serverless (Vercel), koneksi `postgres-js` harus menggunakan pooler (PgBouncer / Supabase pooler) — bukan direct.

**Verifikasi:**
```ts
// src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,    // ✅ untuk pooler transaction mode
  max: 1,            // ✅ untuk serverless
});
export const db = drizzle(client, { schema });
```

---

## 5. Temuan Sedang — Schema Design

### 🟡 M-01: Missing Index pada Foreign Key & Kolom Filter

**Risiko:** PostgreSQL **tidak** otomatis membuat index untuk FK. Query `WHERE question_id = ?` pada `solutions` atau `media` akan **seq scan** seiring pertumbuhan data.

**Rekomendasi Minimum (tambahkan di tiap schema):**

| Tabel | Index Wajib |
|---|---|
| `solutions` | `(question_id)`, `(question_id, version)` |
| `media` |