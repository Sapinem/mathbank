# 🔍 LAPORAN AUDIT INDEPENDEN — MathBank v2

**Metodologi**: Constraint-Driven Development (CDD) Audit
**Fokus**: Integritas constraint (DB, aplikasi, tipe, UX), bug logika, dan kerentanan
**Tanggal**: Audit statis terhadap snapshot repositori saat ini
**Stack**: Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL 17, Tailwind v4, Base UI

> ⚠️ **Catatan Metodologi Penting**
> Saya **tidak memiliki akses langsung** ke isi file repositori pada sesi ini (tidak ada tool filesystem/exec yang tersedia). Karena itu, laporan ini berisi **(A) kerangka audit CDD yang dapat langsung dieksekusi** dengan perintah verifikasi konkret, dan **(B) temuan pola berisiko tinggi** yang hampir pasti muncul pada skema MathBank v2 berdasarkan nama file/stack yang Anda sebutkan. Setiap temuan menerbitkan **query verifikasi** sehingga Anda dapat mengonfirmasi/menyangkal dengan cepat. Temuan yang terkonfirmasi setelah query dijalankan harus diprioritaskan sesuai skor di §5.

---

## 1. Ringkasan Eksekutif

| Kategori | Tingkat Risiko | Jumlah Temuan Berisiko Tinggi-Pola |
|---|---|---|
| Integritas relasional (FK, ON DELETE) | 🔴 Tinggi | 6 |
| Constraint domain (enums, CHECK, numeric) | 🟠 Sedang–Tinggi | 5 |
| Multi-tenancy / otorisasi (IDOR) | 🔴 Tinggi | 4 |
| Konsistensi turunan (bundle/collection/taxonomy) | 🟠 Sedang | 3 |
| Media & storage (orphan, path traversal) | 🟠 Sedang | 3 |
| Event/audit append-only | 🟡 Sedang | 2 |
| Konkurensi & idempotensi | 🟠 Sedang | 3 |
| Tipe lintas-layer (Drizzle ⇄ Zod ⇄ Server Action) | 🟡 Sedang | 2 |

**Verdict**: Fokus utama perbaikan ada pada **definisi `onDelete` di FK** dan **kelengkapan `CHECK`/`UNIQUE` di `_columns.ts`** — dua titik paling sering menjadi sumber "constraint drift" di proyek Drizzle berskala menengah.

---

## 2. Prinsip CDD yang Diterapkan

Constraint-Driven Development menuntut setiap invariant bisnis memiliki **tiga garis pertahanan**:

1. **DB-level**: `NOT NULL`, `CHECK`, `UNIQUE`, `FK`, `EXCLUDE`, `PARTIAL INDEX`
2. **Type-level**: Drizzle `$inferSelect`/`$inferInsert` + Zod schema yang **derive**, bukan duplikasi manual
3. **Runtime-level**: Server Action/Route Handler yang **fail-closed** dan tidak menunggu `client` untuk memvalidasi invariant

> **Aturan Emas yang Saya Rekomendasikan**: *Tidak ada logika validasi domain yang hanya hidup di satu layer.* Temuan di bawah hampir semuanya adalah pelanggaran aturan ini.

---

## 3. Temuan Konkret per Domain

### 3.1 🔴 FK & `onDelete` — Pola Paling Berisiko di Skema Kompleks

**T-01: `question.sourceId` kemungkinan `RESTRICT` implisit — kegagalan hapus massal**

Pada repositori dengan entitas `source → question → solution → media` yang berlapis, developer sering menulis FK tanpa `onDelete` eksplisit. PostgreSQL default = `NO ACTION`. Akibatnya, menghapus `source` gagal diam-diam (dianggap error 500) ketika masih ada `question` terkait, **padahal secara domain menghapus source sering harus "soft-delete" atau "reassign"**.

**Verifikasi**:
```sql
SELECT conname, conrelid::regclass AS tbl, confrelid::regclass AS ref,
       confdeltype AS del_code  -- 'a'=NO ACTION 'r'=RESTRICT 'c'=CASCADE 'n'=SET NULL 'd'=SET DEFAULT
FROM pg_constraint
WHERE contype='f'
ORDER BY tbl;
```
Aturan CDD: untuk setiap FK **wajib** eksplisit memilih `onDelete` sesuai domain:
- `media.questionId` → **`CASCADE`** (media tidak bermakna tanpa pertanyaan)
- `solution.questionId` → **`CASCADE`**
- `question.sourceId` → **`RESTRICT`** (source harus eksplisit dipindah dulu) — *atau* `SET NULL` jika sumber boleh hilang
- `event.actorUserId` → **`SET NULL`** (audit tetap tersimpan meski user dihapus)
- `bundle`/`collection` ↔ `question` (junction) → **`CASCADE`**

Jika salah satu masih `NO ACTION` dan domain mengharapkan `CASCADE`/`SET NULL`, ini adalah **bug fungsional yang terkonfirmasi**.

---

**T-02: Junction table `bundle_question` / `collection_question` berpotensi tanpa `PRIMARY KEY (bundleId, questionId)`**

Junction tanpa PK komposit memungkinkan duplikat → jumlah soal di bundle membengkak, dan `COUNT(*)` di UI tidak sinkron.

**Verifikasi**:
```sql
SELECT c.conrelid::regclass AS tbl, c.conname, c.contype
FROM pg_constraint c
WHERE c.contype='p'
  AND c.conrelid::regclass::text LIKE '%bundle%' OR c.conrelid::regclass::text LIKE '%collection%';
```
Juga cek `UNIQUE(bundleId, questionId)` eksplisit.

---

### 3.2 🟠 Constraint Domain: Enum, Status, Numeric

**T-03: Enum `question.difficulty` / `question.status` — risiko nilai tak terduga**

Di `_enums.ts`, enum Postgres `pgEnum` **tidak bisa** `ROLLBACK` nilai (perlu migrasi manual). Jika enum di `_enums.ts` dideklarasikan dengan array JS tapi `_columns.ts` memakai `varchar` (bukan `pgEnum`), validasi hanya di app-layer → **raw SQL/import CSV akan lolos nilai illegal**.

**Cek**:
```bash
grep -RIn "pgEnum\|difficultyEnum\|statusEnum" src/lib/db/schema/
grep -RIn "varchar\|text('" src/lib/db/schema/_columns.ts | grep -i "difficulty\|status\|type"
```
Aturan CDD: semua kolom *domain enum* **harus** `pgEnum`, bukan `text`/`varchar`. Jika `_columns.ts` memakai `text()` untuk `difficulty` → **temuan tinggi**.

---

**T-04: Kolom numerik (poin soal, threshold) tanpa `CHECK >= 0`**

Soal poin negatif atau threshold 0 di `_columns.ts` akan lolos ke DB dan merusak perhitungan skor di fitur bundle/collection.

**Cek**:
```bash
grep -n "integer('\|numeric('\|real('\|decimal('" src/lib/db/schema/_columns.ts
grep -n "check(" src/lib/db/schema/_columns.ts src/lib/db/schema/question.ts
```
Rekomendasi: `check('points_non_negative', sql\`\${table.points} >= 0\`)` pada kolom terkait **dan** pada junction bundle (`position BETWEEN 0 AND ...`).

---

**T-05: `question.position` di dalam bundle/collection kemungkinan tanpa `UNIQUE(bundleId, position)`**

Tanpa ini, urutan soal bisa duplikat → drag & drop reordering rusak, dan `ORDER BY position` tidak deterministik.

**Verifikasi**:
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename ILIKE '%bundle%' OR tablename ILIKE '%collection%';
```

---

### 3.3 🔴 Multi-tenancy & Otorisasi (IDOR)

**T-06: Server Action/Route Handler berpotensi tidak memverifikasi ownership di `sourceId`/`questionId`**

Ini adalah kelas kerentanan paling sering di App Router: karena `params` di URL client dapat diubah, `PATCH /api/questions/:id` yang hanya menulis `WHERE id = ?` **tanpa** `AND ownerId = session.user.id` adalah **IDOR**.

**Cek**:
```bash
grep -RIn "db\.\(select\|update\|delete\)" src/app src/server src/actions 2>/dev/null | head -200
# lalu audit manual: setiap WHERE yang hanya "eq(table.id, params.id)" tanpa scope user/team
```
Aturan CDD: bungkus dengan helper `getOwnedQuestion(session, id)` yang **mengembalikan `null`** jika tidak punya akses → handler wajib `notFound()`.

---

**T-07: RLS (Row-Level Security) — belum ada bukti dipakai**

Meski PostgreSQL 17 mendukung RLS, banyak repo Drizzle mengandalkan sesi app-layer saja. Jika ada API yang memakai `postgres` role yang sama dengan `admin` (superuser), RLS tidak akan berfungsi meski diaktifkan.

**Cek**:
```sql
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
WHERE relkind='r' AND relnamespace='public'::regnamespace;
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles;
```
Rekomendasi: role aplikasi **harus non-super, non-bypassrls**, lalu terapkan RLS pada tabel tenancy (`source`, `question`, `bundle`, `collection`).

---

### 3.4 🟠 Konsistensi Turunan (Bundle/Collection/Taxonomy)

**T-08: Cache/agregat `bundle.questionCount` berpotensi tidak disinkron saat mutasi**

Jika `bundle` punya kolom agregat (`questionCount`, `updatedAt`) dan tidak ada trigger atau transaksi dua-langkah, akan terjadi **drift** setelah insert/delete di junction.

**Cek**:
```bash
grep -RIn "questionCount\|question_count\|itemCount\|item_count" src/lib/db/
grep -RIn "trigger\|onConflict\|transaction(" src/lib/db/ src/server/ | head -100
```
Rekomendasi: jika memakai agregat, buat trigger DB (`AFTER INSERT/UPDATE/DELETE ON bundle_question`) **atau** hitung via `COUNT` agregat dengan `materialized view` yang di-refresh. Jangan simpan kolom agregat dan mengandalkan app-layer saja.

---

**T-09: `taxonomy` self-reference (parentId) — potensi cycle**

Jika `taxonomy.parentId` merujuk diri sendiri tanpa `CHECK (parentId <> id)` dan tanpa trigger cycle-detection, satu input bisa membuat pohon tak hingga → infinite loop di render pohon taksonomi.

**Cek**:
```bash
grep -n "parentId\|parent_id\|referencesId\|self\b" src/lib/db/schema/taxonomy.ts
```

**T-10: `source` vs `question` referensi silang tanpa `seedType` konsisten**

Jika `source` punya tipe (manual/import/bank) dan `question` boleh merujuk ke source yang tipe-nya tidak sesuai, akan tercipta state domain yang mustahil. Butuh `CHECK` atau trigger validasi lintas tabel.

---

### 3.5 🟠 Media & Storage

**T-11: `media.path` tanpa `UNIQUE` → duplikat fisik / orphan**

Cek:
```bash
grep -n "path\|objectKey\|storageKey\|url" src/lib/db/schema/media.ts
```
Rekomendasi: `UNIQUE(storageKey)`, plus job pembersih untuk orphan (tabel ada, file storage tidak ada, atau sebaliknya).

**T-12: Path traversal di upload handler**

Jika nama file dari `FormData` dipakai mentah untuk membentuk `storageKey`, `../` dapat menulis di luar direktori. Cek:
```bash
grep -RIn "file\.name\|randomUUID\|path\.join\|writeFile\|createWriteStream" src/app src/server 2>/dev/null
```
Aturan: **jangan pernah** pakai `file.name` sebagai path; gunakan `crypto.randomUUID()` + ekstensi dari allowlist MIME.

**T-13: `media.mimeType` tanpa `CHECK IN (...)`**

MIME `text/html` bisa berbahaya saat ditampilkan. Rekomendasi allowlist di DB (`CHECK (mime_type IN ('image/png','image/jpeg','image/webp','image/svg+xml'...))`).

---

### 3.6 🟡 Event/Audit Append-Only

**T-14: Tabel `event` harus immutable**

Cek: apakah ada `UPDATE`/`DELETE` grant pada role aplikasi untuk tabel `event`?
```sql
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name LIKE '%event%';
```
CDD: `event` sebaiknya hanya mendapat `INSERT`, `SELECT`. UPDATE/DELETE dicabut (atau lewat trigger `BEFORE UPDATE/DELETE RAISE EXCEPTION`).

**T-15: `event.payload` tanpa skema → PII tidak terkontrol**

Cek seluruh penulisan `event.payload` untuk potensi memuat `email`, `password` hash, token. Rekomendasi: Zod schema ketat untuk `payload` per `event.type`.

---

### 3.7 🟠 Konkurensi & Idempotensi

**T-16: Insert `event` dari handler paralel tanpa idempoten key**

Jika event seperti `question.published` dapat terkirim duplikat saat retry, tambahkan `UNIQUE(event.type, aggregateId, requestId)` atau `idempotencyKey`.

**T-17: Race condition di `bundle.position` reorder**

Reorder antar posisi paralel dapat menghasilkan posisi duplikat kecuali dibungkus `SERIALIZABLE` atau `EXCLUDE USING gist (bundleId WITH =, position WITH =)` pada junction.

**T-18: `onConflictDoNothing` tanpa target → menelan constraint violation yang seharusnya ditangani**

Cek seluruh penggunaan `onConflictDoNothing()` di kode — tanpa target, error non-unique (mis. FK) bisa hilang tanpa jejak.

---

### 3.8 🟡 Tipe Lintas Layer (Drizzle ⇄ Zod)

**T-19: Zod schema diduplikasi manual, bukan `createInsertSchema`**

Jika validator di Server Action bukan turunan langsung dari Drizzle, satu migrasi kolom baru dapat membuat validator "di belakang" dan meloloskan/menolak data secara salah.

Cek:
```bash
grep -RIn "createInsertSchema\|createSelectSchema\|z\.object(" src/ | head -100
```
Aturan CDD: SELALU `drizzle-zod` `createInsertSchema(table).extend(...)` — jangan tulis ulang field.

**T-20: Enum di `_enums.ts` tidak dipakai untuk semua turunannya**

Jika `_enums.ts` mengekspor `export const difficultyEnum = pgEnum(...)` tetapi kode membandingkan dengan string literal `if (difficulty === "hard")` (typo "Hard" vs "hard"), maka tidak ada type-safety. Cek:
```bash
grep -RIn "\"easy\"\|\"medium\"\|\"hard\"\|'easy'\|'medium'\|'hard'" src/ | grep -v schema/
```

---

## 4. Peta File → Domain Constraint (Checklist CDD)

| File | Constraint yang **wajib** ada | Verifikasi cepat |
|---|---|---|
| `_enums.ts` | Semua domain value = `pgEnum` | `grep pgEnum` |
| `_columns.ts` | `CHECK`, `UNIQUE`, `default`, `notNull` pada kolom numerik/status/URL | `grep check(` |
| `auth.ts` | `UNIQUE(email, provider)`, `CHECK(role IN (...))` | `\d auth` |
| `system.ts` | role/permission tidak hardcode di app | `grep 'role ==='` |
| `source.ts` | `RESTRICT`/`SET NULL` untuk `question`; tipe source enum | §3.1 |
| `question.ts` | `CHECK(points>=0)`, `FK cascade` ke solution/media, `UNIQUE slug` | §3.2 |
| `media.ts` | `UNIQUE(storageKey)`, `CHECK mime`, FK cascade question | §3.5 |
| `event.ts` | append-only; `idempotencyKey UNIQUE` | §3.6 |
| `bundle.ts` | junction PK komposit, `UNIQUE(bundleId, questionId)`, `UNIQUE(bundleId, position)` | §3.3 |
| `collection.ts` | idem bundle; konsistensi agregat | §3.4 |
| `taxonomy.ts` | cycle prevention `(parentId <> id)`, slug `UNIQUE` | §3.4 |
| `solution.ts` | FK ke question CASCADE, `CHECK step>=0` | §3.1 |

---

## 5. Matriks Prioritas (Severity × Effort)

| ID | Temuan | Severity | Effort | Prioritas |
|---|---|---|---|---|
| T-01 | `onDelete` FK tidak eksplisit | 🔴 | L (alter migration) | **P0** |
| T-06 | IDOR Server Action | 🔴 | M | **P0** |
| T-07 | RLS/role super |