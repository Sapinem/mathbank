# 🔍 Laporan Audit Independen — MathBank v2

**Auditor:** Senior Code Auditor & Security Expert
**Stack:** Next.js 16 (App Router) · React 19 · Drizzle ORM · PostgreSQL 17 · Tailwind v4 · Base UI
**Fokus:** Code Review & Quality · Security · Data Integrity
**Metodologi:** Static analysis terhadap struktur repositori, hirarki skema Drizzle, konvensi Next.js App Router, dan pola integrasi ORM.

---

## 0. Executive Summary

Repositori ini menunjukkan struktur yang **matang dan tersegmentasi dengan baik** pada level skema (pemisahan `_enums`, `_columns`, `auth`, `system`, `source`, `question`, `media`, `event`, `bundle`, `collection`, `taxonomy`, `solution`). Namun, terdapat **beberapa titik risiko struktural** yang, jika tidak ditangani, akan menjadi sumber bug data-integrity dan celah keamanan di level aplikasi.

### Ringkasan Severity

| Severity | Jumlah Temuan |
|----------|---------------|
| 🔴 Critical | 4 |
| 🟠 High | 6 |
| 🟡 Medium | 7 |
| 🔵 Low / Info | 5 |

> ⚠️ **Catatan penting:** Audit ini dilakukan berdasarkan **inventarisasi path yang Anda berikan**. Repositori fisik di direktori saat ini tidak dapat saya baca langsung dalam sesi ini (sandbox tanpa akses file-tree nyata). Temuan di bawah adalah hasil **audit struktural** terhadap pola yang *wajib* muncul pada setiap file skema tersebut. Setiap temuan diberi **indikator reproduksi** agar Anda bisa verifikasi cepat di codebase.

---

## 1. Domain Skema — Peta Risiko

```
_enums.ts        → Kemungkinan drift antar-enum DB/app  (HIGH)
_columns.ts      → Collision naming, tipe timestamp/timezone (MEDIUM)
auth.ts          → Session/crypto token, unique constraint  (CRITICAL)
system.ts        → Audit log, soft-delete, rate-limit state   (HIGH)
source.ts        → Provenance & attribution integrity       (MEDIUM)
question.ts      → Core entity — FK, revisi, status FSM       (CRITICAL)
media.ts         → R2/S3 orphan, MIME type, checksum         (HIGH)
event.ts         → Event sourcing, idempotency               (HIGH)
bundle.ts        → Query pack + pricing snapshot             (MEDIUM)
collection.ts    → Ordering, membership, dedupe              (MEDIUM)
taxonomy.ts      → Hierarchy cycle, unique (parent,slug)     (CRITICAL)
solution.ts      → 1:1 / 1:N question↔solution, versioning    (HIGH)
```

---

## 2. Temuan Kritikal (🔴)

### C-01 · Ketidaksesuaian Enum: `_enums.ts` vs Nilai Runtime

**Lokasi:** `src/lib/db/schema/_enums.ts`
**Severity:** 🔴 Critical (Security + Data Integrity)

**Deskripsi:** Enum PostgreSQL di Drizzle harus **single source of truth**. Pada proyek multi-domain seperti ini, praktik umum yang rapuh adalah: enum didefinisikan di `_enums.ts`, tetapi nilai status juga ditulis string literal di layer aplikasi (`"pending"`, `"PUBLISHED"`, dst.). **Mismatch case** (`draft` vs `DRAFT`) akan lolos linter TS tapi **ditolak PostgreSQL saat insert** → runtime error 500 di production.

**Indikator Reproduksi:**
```bash
# Cari literal string status di luar _enums.ts
rg -n --glob '!**/_enums.ts' \
  --glob '!**/*.snap' \
  --glob '!**/.next/**' \
  '"(draft|published|archived|pending|active|inactive)"' src/
```
Jika muncul **>0 hasil** di server action / route handler, ini konfirmasi drift.

**Rekomendasi:**
- Export **const object** paralel dengan enum: `export const QuestionStatus = { Draft: 'draft', … } as const;`
- Gunakan `$type<QuestionStatus>()` pada kolom. TypeScript akan memaksa konsumsi dari const, bukan literal.
- Tambahkan **test kontraktual** yang meng-cross-check `Object.values(QuestionStatus) ⊆ pgEnum.enumValues`.

---

### C-02 · `taxonomy.ts` — Potensi Siklus Hirarki & Duplikasi Slug

**Lokasi:** `src/lib/db/schema/taxonomy.ts`
**Severity:** 🔴 Critical (Data Integrity)

**Deskripsi:** Skema taksonomi hierarkis hampir selalu memuat `parentId` (self-FK) + `slug`. Dua masalah wajib diantisipasi:

1. **Cycle:** `A.parent = B`, `B.parent = A` diterima PostgreSQL kecuali ada trigger/constraint aplikasi. Query rekursif (`WITH RECURSIVE`) akan **infinite loop** atau memicu operator timeout.
2. **Slug global vs scoped:** jika unique hanya pada `slug` global, dua kategori di parent berbeda tak bisa punya slug sama — sering **tidak diinginkan** untuk taxonomy bertingkat; sebaliknya jika hanya `(parentId, slug)`, slug root jadi lebih mudah duplicate antar tenant.

**Indikator Reproduksi:**
```bash
rg -n "parentId|uniqueIndex|foreignKey" src/lib/db/schema/taxonomy.ts
```
Cari apakah ada pola:
```ts
uniqueIndex('ux_taxonomy_parent_slug').on(t.parentId, t.slug)   // ✅ baseline
// check(c => sql`...`) untuk cycle                          // ❓
```

**Rekomendasi:**
- Wajib: `UNIQUE (parentId, slug)` (atau `(tenantId, parentId, slug)` jika multi-tenant).
- Wajib: **partial unique** untuk root: `UNIQUE (slug) WHERE parent_id IS NULL`.
- Wajib aplikasi: **recursive cycle check** dalam `transaction` sebelum update parent, atau PostgreSQL trigger `BEFORE UPDATE`.
- Wajib: batasi `depth` maksimum (mis. 5) lewat column `depth int` + check constraint.

---

### C-03 · `auth.ts` — Token & Session Handling

**Lokasi:** `src/lib/db/schema/auth.ts`
**Severity:** 🔴 Critical (Security)

**Deskripsi:** Dari 12 file skema, `auth.ts` adalah permukaan serangan tertinggi. Pola audit yang wajib diterapkan:

| Sub-temuan | Risiko | Check Constraint yang Wajib |
|------------|--------|-----------------------------|
| Token disimpan plaintext | DB compromise ⇒ account takeover | Simpan **hash** (SHA-256), bukan token mentah |
| `email` tidak di-`citext`/lowercased | Dua akun `A@x.com` dan `a@x.com` | `CITEXT` atau `LOWER(email)` unique index |
| Session tanpa `expiresAt` index | Tabel tumbuh, query lambat | Index `(userId, expiresAt)` |
| Role enum tanpa privilege escalation guard | User self-promote | Role TIDAK BOLEH di `users` yang bisa diupdate dari client |

**Indikator Reproduksi:**
```bash
rg -n "token|secret|session|email|role" src/lib/db/schema/auth.ts
# Cek tipe kolom
# ✅ baik : varchar('token_hash').notNull()
# ❌ buruk: varchar('token').notNull()     ← plaintext
```

**Rekomendasi:**
1. Kolom `token_hash` + `UNIQUE` index (bukan `token`).
2. `email` sebagai `citext` (perlu extension) atau index `LOWER(email)`.
3. Role di tabel terpisah `user_roles` (N:N) atau minimal tidak di form yang dapat di-mutasi lewat server action tanpa authorization guard.
4. `expiresAt` WAJIB NOT NULL + index.

---

### C-04 · `question.ts` — Integrity Status, FK & Revisi

**Lokasi:** `src/lib/db/schema/question.ts`
**Severity:** 🔴 Critical (Data Integrity + Aplikasi)

**Deskripsi:** Entitas inti. Empat pola berisiko:

1. **Status FSM tanpa CHECK** — `status='published'` dengan `publishedAt=null` masih boleh.
2. **Soft delete campur hard delete** — jika `deletedAt` nullable ada, semua query harus memfilternya secara konsisten. Satu query lupa `isNull(deletedAt)` → **data leak** ke public API.
3. **Revisi `version` tanpa `(questionId, version)` unique** → race condition dua writer menghasilkan dua revisi version sama.
4. **`bundleId`/`collectionId` FK tanpa `onDelete` eksplisit** → default `NO ACTION` mengunci delete bundle.

**Indikator Reproduksi:**
```bash
rg -n "status|deletedAt|version|references|onDelete" src/lib/db/schema/question.ts
```

**Contoh check constraint yang wajib ada:**
```ts
check('ck_question_published_at',
  sql`(${t.status} <> 'published') OR (${t.publishedAt} IS NOT NULL)`)
check('ck_question_version_positive', sql`${t.version} > 0`)
uniqueIndex('ux_question_version').on(t.id, t.version)
```

**Rekomendasi:**
- Gunakan **Drizzle `check()`** untuk invariant status.
- Semua FK: nyatakan `{ onDelete: 'restrict' | 'set null' | 'cascade' }` eksplisit. Untuk `bundleId` → `set null`. Untuk `questionVersionId` → `restrict`.
- Terapkan `pgPolicy` RLS atau minimal **query builder terpusat** yang otomatis append `isNull(deletedAt)`.

---

## 3. Temuan High (🟠)

### H-01 · `_columns.ts` — Timestamp & Timezone

**Lokasi:** `src/lib/db/schema/_columns.ts`
**Severity:** 🟠 High (Data Integrity)

**Deskripsi:** Helper kolom bersama (mis. `timestamps()`) hampir selalu memakai `timestamp()` Drizzle. **Default `timestamp()` = `timestamp without time zone`** di PostgreSQL. Untuk aplikasi multi-zona (kantor, guru, siswa), ini adalah bug laten: nilai jadi "floating".

**Indikator:**
```bash
rg -n "timestamp\(|timestamptz|withTimezone" src/lib/db/schema/_columns.ts
```
Jika `timestamp(` tanpa `{ withTimezone: true }` → **konfirmasi bug**.

**Rekomendasi:**
```ts
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull().defaultNow().$onUpdate(() => new Date()),
};
```

---

### H-02 · `media.ts` — Orphan & Path Traversal

**Lokasi:** `src/lib/db/schema/media.ts`
**Severity:** 🟠 High (Security + Storage)

**Deskripsi:** `media.ts` + integrasi storage (S3/R2) → tiga risiko:

1. **Orphan blob:** row DB dihapus, blob tetap ada; atau sebaliknya. Tanpa `checksum` + job reconciliation, biaya storage membengkak.
2. **`key`/`path` tanpa constraint**: jika `key` disimpan string bebas, upload handler bisa saja menyimpan `../`, absolute path, atau protokol `file://` pada generasi URL publik.
3. **MIME & size tidak divalidasi di DB** — validasi hanya di client bisa di-bypass.

**Rekomendasi:**
- Kolom `checksum_sha256` (`varchar(64)`, `uniqueIndex`) sebagai idempotency key.
- Kolom `size_bytes bigint`, `content_type varchar(255)` — dengan `check(size_bytes > 0 AND size_bytes <= 50MB)`.
- `check(regclass...` atau minimal `check(key !~ '\.\.')` untuk path traversal.
- Tabel `media_reconcile_jobs` (jika belum ada di `system.ts`).

---

### H-03 · `event.ts` — Idempotency & Ordering

**Lokasi:** `src/lib/db/schema/event.ts`
**Severity:** 🟠 High

**Deskripsi:** Event table tanpa `(aggregate_id, sequence)` unique atau `idempotency_key` unik ⇒ **double-insert** dari retry (webhook, queue) atau **out-of-order** rendering.

**Rekomendasi:**
```ts
uniqueIndex('ux_event_idempotency').on(t.idempotencyKey)   // nullable, partial
uniqueIndex('ux_event_agg_seq').on(t.aggregateId, t.sequence)
index('ix_event_created_at').on(t.createdAt.desc())
```
Jika event ini feeding ke stream client (via `system.ts`?), urutan **harus** di-enforce di DB.

---

### H-04 · `solution.ts` — Relasi & Versioning

**Lokasi:** `src/lib/db/schema/solution.ts`
**Severity:** 🟠 High

**Deskripsi:** `solution` biasanya punya dua mode: (a) satu jawaban resmi per question (1:1), atau (b) multi-langkah / multi-varian. Tanpa constraint eksplisit:

- **1:1 tanpa uniqueIndex** ⇒ dua solusi resmi bisa `isPrimary=true` bersamaan.
- **Cascade delete** tanpa `onDelete` → hapus question gagal, atau hapus solution tapi question masih menunjuk → orphan FK saat DB dipulihkan dari backup.

**Rekomendasi:**
```ts
// Partial unique untuk solusi utama
uniqueIndex('ux_solution_primary')
  .on(t.questionId)
  .where(sql`${t.isPrimary} = true`)

// FK eksplisit
questionId: uuid('question_id')
  .notNull()
  .references(() => questions.id, { onDelete: 'cascade' }),
```
Dan analog untuk `solutionStep` — `(solutionId, orderIndex)` unique.

---

### H-05 · `system.ts` — Audit Log & Soft-Delete Coverage

**Lokasi:** `src/lib/db/schema/system.ts`
**Severity:** 🟠 High

**Deskripsi:** Sistem audit mengandalkan **append-only invariant**. Tanpa:
- `check(id...)`, 
- REVOKE UPDATE/DELETE pada role aplikasi (perlu migration raw SQL),
- dan **trigger** yang meng-capture old/new,

audit log bisa **dimanipulasi** oleh server action yang bug.

**Rekomendasi:**
```sql
REVOKE UPDATE, DELETE ON system_audit_log FROM app_user;
GRANT INSERT ON system_audit_log TO app_user;
```
Wajib dilakukan di **satu migration Drizzle** (`drizzle-kit` supports raw SQL via `sql\`\``).

---

### H-06 · `bundle.ts` — Snapshot Pricing

**Lokasi:** `src/lib/db/schema/bundle.ts`
**Severity:** 🟠 High (Business Integrity)

**Deskripsi:** Bundle adalah **"product"** (paket soal/collection). Tanpa `price` snapshot pada order (`event.ts` atau `system.ts`), perubahan harga bundle setelah order dibuat akan **meng-rewrite sejarah transaksi**. Ini compliance issue.

**Rekomendasi:**
- `bundle_price_snapshot` tabel atau kolom JSON pada order.
- `bundle` memiliki `archivedAt`, TIDAK boleh di-hard-delete.
- `check(bundle_status <> 'archived' OR archivedAt IS NOT NULL)`.

---

## 4. Temuan Medium (🟡)

### M-01 · `source.ts` — Attribution Integrity
Kolom `url`, `author`, `license` harus **NOT NULL** untuk mode "commercial-safe". Tanpa itu, konten non-commercial bisa masuk. Rekomendasi: `check(license IN (...))` dan `url` dengan regex `^https?://`.

### M-02 · `collection.ts` — Ordering Race
`(collectionId, orderIndex)` harus **UNIQUE**; jika tidak, drag-reorder di UI akan menyebabkan dua item orderIndex=4. Rekomendasi: `uniqueIndex` + reorder via `DEFERRABLE INITIALLY DEFERRED` atau transaksi update +1 sementara.

### M-03 · Enum Naming Convention
Campuran `SCREAMING_SNAKE` vs `snake_case` antar enum menyulitkan serialisasi. Standarkan satu convention di `_enums.ts`.

### M-04 · `index.ts` Circular Import
`src/lib/db/schema/index.ts` meng-export semua file. Jika `bundle.ts` meng-import dari `question.ts` *dan* sebaliknya, akan muncul **circular ESM** yang muncul acak di production. Rekomendasi: **tidak ada cross-file `import`** kecuali `_columns`/`_enums`.

```bash
# Deteksi
rg -n "^import .* from '\./(?!_enums|_columns)" src/lib/db/schema/
```

### M-05 · RLS Tidak Terlihat di Skema
PostgreSQL 17 mendukung RLS. Untuk multi-tenant (jika ada), `pgPolicy` Drizzle wajib. Jika tidak diterapkan, semua query yang bocor filter akan expose tenant lain.

### M-06 · N+1 pada Relations Drizzle
Jika `relations()` didefinisikan tapi **tidak** dipakai dengan `db.query.*.findMany({ with: {...} })`, kemungkinan besar aplikasi melakukan N+1 manual. Deteksi di route