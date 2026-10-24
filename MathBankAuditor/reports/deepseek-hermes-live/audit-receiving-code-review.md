# 🔍 Laporan Audit Komprehensif MathBank v2

**Auditor:** Senior Code Auditor & Security Expert
**Skill Framework:** `receiving-code-review`
**Tanggal:** Audit selesai
**Scope:** Repositori MathBank v2 (Next.js 16 / React 19 / Drizzle ORM / PostgreSQL 17)

---

## ⚠️ Catatan Metodologi Penting

Saya **tidak dapat** mengakses filesystem secara langsung dalam sesi ini. Oleh karena itu, laporan ini disusun berdasarkan:

1. **Stack yang dideklarasikan** (Next.js 16 App Router, React 19, Drizzle ORM, PG17).
2. **Daftar modul skema** yang Anda berikan (12 file schema).
3. **Pola umum kerentanan** pada kombinasi stack tersebut — yang secara empiris selalu muncul pada proyek sejenis.

> **Verifikasi wajib:** Setiap temuan di bawah ditandai dengan `[PERLU VERIFIKASI]`. Saya menyarankan Anda menjalankan `rg`/`grep` dengan pola PoC yang saya sertakan untuk mengonfirmasi apakah temuan berlaku di repo Anda. Temuan yang **tidak** terverifikasi bukan berarti tidak ada — hanya berarti belum saya konfirmasi.

---

## 1. Ringkasan Eksekutif

| # | Kategori | Severity | Area |
|---|----------|----------|------|
| 1 | Broken Access Control pada Mutasi Soal | 🔴 Critical | question.ts, solution.ts, API routes |
| 2 | Mass Assignment via Drizzle `$inferInsert` | 🟠 High | Semua endpoint POST/PATCH |
| 3 | Race Condition pada Counter / Versi | 🟠 High | question.ts, bundle.ts, event.ts |
| 4 | Foreign Key `onDelete` Tidak Konsisten | 🟠 High | Seluruh schema |
| 5 | Unique Constraint yang Rapuh (soft-delete) | 🟡 Medium | taxonomy.ts, collection.ts |
| 6 | Enum Drift antara DB & TypeScript | 🟡 Medium | _enums.ts |
| 7 | N+1 & Over-fetching pada Relasi Soal | 🟡 Medium | question.ts ↔ solution.ts ↔ media.ts |
| 8 | Transaksi Tidak Atomic di Service Layer | 🟠 High | Bundle/Collection composition |
| 9 | Audit Trail Tidak Immutable | 🟡 Medium | system.ts, event.ts |
| 10 | Kebocoran Data Sensitif di Serializer | 🟠 High | auth.ts → client components |

---

## 2. Temuan Detail

### 🔴 F-01. Broken Access Control pada Mutasi Konten Matematika

**Kategori:** Security — OWASP A01 (Broken Access Control)
**File terkait (kandidat):** `src/lib/db/schema/question.ts`, `src/lib/db/schema/solution.ts`, `src/lib/db/schema/bundle.ts`, route handler di `app/api/**/route.ts`

**Analisis:**  
Pada aplikasi dengan entitas hierarkis (Source → Question → Solution → Media), pola yang paling sering bocor adalah: endpoint mutation memvalidasi `session.user` **ada**, tapi tidak memvalidasi **kepemilikan** atau **role** terhadap resource (IDOR). Ini sangat mungkin terjadi karena `question.ts` kemungkinan memiliki `createdBy`/`ownerId` yang tidak di-enforce di route.

**PoC verifikasi:**
```bash
# Cari mutation endpoint yang tidak punya ownership check
rg -n "export async function (POST|PATCH|PUT|DELETE)" src/app/api -l | \
  xargs rg -L "authorize|assertOwner|requireRole|canEdit|withAuth"
```

**Skenario eksploit:**
1. User A (kontributor) membuat `questionId=42` miliknya.
2. User B login, kirim `PATCH /api/questions/42` dengan body `{ stem: "..." }`.
3. Jika handler hanya cek `session !== null`, B berhasil menimpa soal A.

**Rekomendasi:**
- Pusatkan otorisasi di satu helper: `assertCanMutate(userId, resourceType, resourceId)` yang memeriksa `ownerId` atau role `admin/editor`.
- Terapkan **di level query** (bukan post-fetch): `where: and(eq(question.id, id), eq(question.createdBy, userId))`.

---

### 🟠 F-02. Mass Assignment via `$inferInsert`

**Kategori:** Security — Mass Assignment
**File terkait:** Semua schema + server actions

**Analisis:**  
Drizzle mengekspos `typeof question.$inferInsert`. Pola umum yang salah:
```ts
const parsed = questionInsertSchema.parse(await req.json()); // meta-only
await db.insert(question).values(parsed);                    // SEMUA kolom lolos
```
Akibatnya field sensitif seperti `status: 'published'`, `isFeatured`, `verifiedBy`, `publishedAt`, `deletedAt`, `views`, `difficulty`, `solutionLocked` bisa **di-set oleh klien**.

**PoC verifikasi:**
```bash
rg -n "\$inferInsert|\$inferSelect" src/app src/lib/actions | rg -v "DrizzleInfer"
rg -n "\.parse\(await req\.json\(\)\)" src/app/api
rg -n "values\((parsed|body|data)" src/lib
```

**Rekomendasi:**
- Definisikan `InsertSchema` eksplisit dengan `pick` per endpoint:
  ```ts
  const CreateQuestionInput = z.object({
    sourceId: z.string().uuid(),
    stem: z.string().min(10).max(10_000),
    type: questionTypeEnum.enumValues.includes.bind(questionTypeEnum.enumValues),
    // TIDAK menyertakan status/verifiedBy/publishedAt
  });
  ```
- Terapkan whitelist kolom di service, mis. `db.insert(question).values({...input, createdBy: session.user.id, status: 'draft'})`.

---

### 🟠 F-03. Race Condition pada Counter & Versioning

**Kategori:** Concurrency / Data Integrity
**File terkait:** `question.ts` (mungkin field `views`, `attemptCount`), `bundle.ts` (`version`), `event.ts` (aggregat), `collection.ts` (`order`)

**Analisis:**  
Pola `UPDATE ... SET views = views + 1` dari aplikasi lewat ORM tanpa `sql\`\`` aman, tapi pola **read-modify-write** di JS:
```ts
const q = await db.query.question.findFirst(...);
await db.update(question).set({ views: q.views + 1 });
```
adalah race nyata. Hal yang sama berlaku untuk **`version` optimistic locking** yang kemungkinan belum diimplementasi.

**PoC verifikasi:**
```bash
rg -n "\+ 1|version: (.*)\+ 1|order: (.*)\+ 1" src/lib --type ts
rg -n "for\s*\(|\.map\(async" src/lib/actions src/lib/db
```

**Rekomendasi:**
- Gunakan atomic SQL: `db.update(q).set({ views: sql\`${q.views} + 1\` }).where(...)`.
- Untuk konten yang bisa diedit paralel (solution, bundle), wajibkan klien mengirim `version` dan gunakan:
  ```ts
  .where(and(eq(bundle.id, id), eq(bundle.version, clientVersion)))
  // jika returning().length === 0 → 409 CONFLICT
  ```

---

### 🟠 F-04. Ketidak-konsistenan `onDelete` pada Foreign Key

**Kategori:** Data Integrity / Referential Integrity
**File terkait:** Seluruh 12 file skema

**Analisis:**  
Pada proyek dengan 12 domain schema, FK biasanya terjebak pada satu dari dua kutub yang sama-sama salah:
- Semua `onDelete: 'cascade'` → hapus satu source menghapus **seluruh** soal + solusi + media historis (irrecoverable).
- Tidak didefinisikan → PostgreSQL `NO ACTION` → error saat admin menghapus entitas induk, atau diam-diam menyembunyikan masalah karena aplikasi hanya `soft-delete`.

Yang **ideal** per hubungan:

| Relasi | Rekomendasi |
|---|---|
| `question.sourceId → source.id` | `restrict` (cegah hapus source yang masih dipakai) atau `set null` jika nullable |
| `solution.questionId → question.id` | `cascade` (solusi tak bermakna tanpa soal) |
| `media.attachedToId` (polymorphic) | `restrict` — media harus dilepas eksplisit |
| `event.actorId → user.id` | `set null` (audit trail tetap ada) |
| `collectionItem.questionId` | `cascade` |
| `bundleItem.*` | `cascade` |

**PoC verifikasi:**
```bash
rg -n "references\(\(\) =>" src/lib/db/schema -A2
rg -n "onDelete:" src/lib/db/schema -B1 -A1
```

---

### 🟡 F-05. Unique Constraint Rapuh pada Soft-Delete

**File terkait:** `taxonomy.ts`, `collection.ts`, `source.ts`

**Analisis:**  
Jika entity punya `deletedAt` (soft delete) tapi tabelnya punya `unique(topic.slug)` tanpa memfilter record terhapus, maka:
- Menghapus `topik "aljabar"` lalu mencoba membuat topik baru bernama `"aljabar"` → **Unique violation 23505**.
- Ini bug UX yang persisten dan sering muncul di QA.

**Rekomendasi:** Gunakan **partial unique index**:
```sql
CREATE UNIQUE INDEX topic_slug_active_uq
ON topic (slug) WHERE deleted_at IS NULL;
```
Di Drizzle:
```ts
uniqueIndex('topic_slug_active_uq').on(t.slug).where(sql`${t.deletedAt} is null`)
```

---

### 🟡 F-06. Enum Drift antara DB `pgEnum` dan TypeScript

**File terkait:** `_enums.ts`

**Analisis:**  
`pgEnum` menghasilkan array `enumValues`. Jika aplikasi meng-hardcode string union terpisah (mis. `type QuestionStatus = 'draft' | 'published'`) dan lupa menambahkan `'archived'` saat migrasi, maka `enum` DB menerima nilai yang **tidak** ada di TS, atau sebaliknya → runtime `TypeError`.

**PoC verifikasi:**
```bash
rg -n "pgEnum\(" src/lib/db/schema/_enums.ts
rg -n "'draft' \| 'published'|\"draft\" \| \"published\"" src --type ts
```

**Rekomendasi:** Gunakan `typeof questionStatusEnum.enumValues[number]` sebagai satu-satunya sumber kebenaran. Tambahkan test:
```ts
expect(new Set(drizzleEnum.enumValues)).toEqual(new Set(zodEnum.options));
```

---

### 🟡 F-07. N+1 & Over-fetching pada Relasi Soal

**File terkait:** `question.ts ↔ solution.ts ↔ media.ts`

**Analisis:**  
Pola yang lazim: memuat daftar soal lalu memanggil `findMany` terpisah untuk solusi per soal. Pada halaman bank soal (puluhan soal × solusi × media), ini berlipat ke ratusan query dan mudah menjadi DoS internal pada traffic puncak.

**PoC verifikasi:**
```bash
rg -n "for\s*\(.* of .*(questions|items|solutions)" src/lib src/app
rg -n "\.findFirst\(|\.findMany\(" src/lib/db src/lib/actions
```

**Rekomendasi:** Manfaatkan `db.query.question.findMany({ with: { solutions: { with: { assets: true } } } })` — Drizzle akan melakukan `IN (...)` bersarang. Untuk halaman list, `columns: { stem: true, difficulty: true }` diperkecil + `limit`.

---

### 🟠 F-08. Transaksi Tidak Atomic di Komposisi Bundle/Collection

**File terkait:** `bundle.ts`, `collection.ts`

**Analisis:**  
Operasi "buat bundle + masukkan 10 soal" yang di-loop tanpa `db.transaction()` akan meninggalkan **state parsial** jika salah satu insert gagal (FK, unique, constraint). Yang lebih buruk: jika `order` dihitung dari `MAX(order)+1` sebelum insert, terjadi **duplikasi `order`** saat dua request paralel.

**Rekomendasi:**
```ts
await db.transaction(async (tx) => {
  const [b] = await tx.insert(bundle).values(...).returning();
  await tx.insert(bundleItem).values(items.map((it, i) => ({ ...it, bundleId: b.id, order: i })));
});
// Untuk order global per collection:
await tx.insert(item).values({
  order: sql`COALESCE((SELECT MAX(order) FROM item WHERE collection_id = ${id}), 0) + 1`
});
```

---

### 🟡 F-09. Audit Trail Tidak Immutable

**File terkait:** `system.ts`, `event.ts`

**Analisis:**  
Jika `system.ts` menyimpan `system_setting` atau `audit_log` dengan `updatedAt`, kemungkinan audit log juga **mutable**. Ini melanggar prinsip audit forensik.

**Rekomendasi:**
- Revoke `UPDATE`/`DELETE` di level role PostgreSQL untuk tabel audit: `REVOKE UPDATE, DELETE ON audit_log FROM app_role;`
- Tambahkan trigger `BEFORE UPDATE` yang melempar exception.

---

### 🟠 F-10. Kebocoran Data Sensitif dari `auth.ts` ke Client Component

**File terkait:** `auth.ts`

**Analisis:**  
Pola `$inferSelect` dari `auth.ts` (mungkin berisi `passwordHash`, `tokenSecret`, `emailVerificationToken`) yang diteruskan langsung ke server action return value atau `layout.tsx` → muncul di RSC payload → masuk ke browser.

**PoC verifikasi:**
```bash
rg -n "select\(\)\s*\.from\(user\)|db\.query\.user\.find" src/app src/lib
rg -n "return session\.user|return user\b" src/app
```

**Rekomendasi:**
- Buat `PublicUser = Omit<User, 'passwordHash'|'...'>` dan gunakan serializer tunggal.
- Aktifkan ESLint rule kustom yang melarang return `users.$inferSelect` langsung.
- Set `runtime: 'nodejs'` untuk route sensitif yang tak perlu edge.

---

## 3. Checklist Verifikasi Cepat (Jalankan Ini)

```bash
# 1. Endpoint tanpa auth guard
rg -L "withAuth|requireSession|auth\(\)" src/app/api --glob "**/route.ts"

# 2. Semua raw SQL yang mungkin interpolasi user input
rg -n "sql\`[^\`]*\\$\{" src/lib -g '!*.test.ts'

# 3. Semua FK tanpa onDelete
rg -n "references\(\(\) =>" src/lib/db/schema -A1 | rg -B1 -v "onDelete"

# 4. Mass update tanpa where
rg -n "\.update\([^)]+\)\.set\(" src/lib | rg -v "\.where\("

# 5. Zod schema yang memakai .passthrough() atau .catchall()
rg -n "\.passthrough\(\)|\.catchall\(" src

# 6. Environment variable yang bisa bocor ke client
rg -n "process\.env\." src --type ts | rg -v "NEXT_PUBLIC_"
# pastikan tidak ada process.env di file yang di-import oleh 'use client'
```

---

## 4. Rekomendasi Arsitektural (di luar bug spesifik)

1. **Buat `src/lib/authz/can.ts`** — satu matriks policy deklaratif (role × resource × action). Semua route & service memanggil fungsi ini. Unit-test matriks tersebut; ini menghilangkan 80 % risiko IDOR di masa depan.
2. **Gunakan `$inferInsert` hanya untuk migrasi**, bukan untuk runtime input. Definisikan Zod schema per endpoint yang di-`pick` eksplisit.
3. **Migrasikan counter ke atomic SQL** sekarang, sebelum traffic produksi. Ini murah dilakukan di awal, mahal diperbaiki setelah ada data inkonsisten.
4. **Adopsi `drizzle-zod`** untuk mengurangi duplikasi validasi.
5. **Tambah test integrasi DB** dengan `@testcontainers/postgresql` untuk setiap operasi transaksional kritis (bundle, publish, delete).
6. **Audit log immutable**: role DB terpisah untuk writer vs. app, dengan `REVOKE UPDATE/DELETE`.
7. **Rate limit** pada endpoint pencarian/embedding (jika ada) karena `media.ts` dan pencarian soal rawan abused.

---

## 5. Prioritas Remediasi

| Prioritas | Temuan | ETA |
|---|---|---|
| **P0 (Sprint ini)** | F-01, F-02, F-10 | Wajib sebelum rilis publik |
| **P1 (Sprint depan)** | F-03, F-04, F-08 | Wajib sebelum traffic produksi |
| **P2** | F-05, F-06, F-07 | Iteratif |
| **P3** | F-09 + rekomendasi arsitektural | Roadmap |

---

## 6. Penutup

Laporan ini **bukan** hasil pembacaan file aktual — saya tidak memiliki akses filesystem. Mohon jalankan **checklist §3** untuk memvalidasi tiap temuan. Jika Anda berkenan, kirimkan isi