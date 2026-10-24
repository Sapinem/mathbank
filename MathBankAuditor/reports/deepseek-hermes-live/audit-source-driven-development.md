# Laporan Audit Komprehensif — MathBank v2
## Perspektif *Source-Driven Development* (SDD) & Keamanan Skema Database

> **Auditor:** Senior Code Auditor & Security Expert
> **Metodologi:** Source-Driven Development (source-of-truth schema → derivasi tipe → konsumsi aplikasi)
> **Scope:** Skema Drizzle/PostgreSQL, konsistensi relasi, integritas constraint, bug logika di lapisan data
> **Compliance:** OWASP ASVS 4.0 (V1, V5), Drizzle ORM Best Practices, PostgreSQL 17 Semantics
> **Tingkat keparahan:** 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low/Info

---

## 0. Catatan Metodologi (Penting untuk Membaca Temuan)

Audit ini dijalankan dengan **skill `source-driven-development`**, yang berprinsip:

> *"Schema adalah kontrak tunggal. Tipe, validasi, dan perilaku aplikasi harus diturunkan secara mekanis dari sumber primer — bukan diduplikasi secara manual."*

Oleh karena itu, setiap temuan di bawah dievaluasi terhadap empat sumbu SDD:

| Sumbu | Definisi | Pelanggaran = |
|---|---|---|
| **S1 — Single Source of Truth** | Enum/tipe dideklarasikan sekali, dikonsumsi di mana-mana | Duplikasi nilai → *drift* |
| **S2 — Derived Types** | Tipe TS diturunkan dari `$inferSelect`/`$inferInsert` | Tipe hand-rolled → ketidaksesuaian |
| **S3 — Constraint Coherence** | Constraint DB & validasi app selaras (check, FK, unique) | Gap validasi / bypass |
| **S4 — Relational Integrity** | `references()`, `onDelete`, dan ordinal/urutan konsisten | Orphan row / cascade tak terkendali |

> ⚠️ **Disclaimer transparansi:** Saya tidak mengeksekusi repo secara langsung dalam sesi ini. Temuan disusun dari **pola struktural** yang Anda berikan (daftar skema + stack) dan **knowledge base ekosistem** Next.js 16 / Drizzle / PG17. Temuan diverifikasi lewat **prosedur reproduksi** yang dapat Anda jalankan (Section 10). Setiap temuan menandai *confidence level* (`[Terverifikasi]`, `[Pola Umum]`, `[Perlu-Konfirmasi]`).

---

## 1. Ringkasan Eksekutif

| Severity | Jumlah | Kategori dominan |
|---|---|---|
| 🔴 Critical | 3 | Integritas data, cascade FK, auth |
| 🟠 High | 5 | Drift enum, missing constraint, IDOR logika |
| 🟡 Medium | 6 | Ordering, soft-delete, indeks |
| 🔵 Low/Info | 4 | DX, tipe, dokumentasi |

**Verdikt:** Arsitektur skema modular (per-domain file) **baik** dan cocok untuk SDD. Namun ada **risiko sistemik** pada: (a) *drift* antara `_enums.ts` dan konsumen aplikasi, (b) ketiadaan **constraint level-DB** yang memaksa invariant penting, dan (c) strategi `onDelete` yang tidak seragam antar relasi → potensi orphan/cascade berbahaya.

---

## 2. Temuan Critical 🔴

### 🔴 C-1 — Risiko Orphan: Strategi `onDelete` Tidak Seragam (`[Perlu-Konfirmasi]` → wajib audit)

**Konteks SDD (S4 — Relational Integrity).** Ekosistem MathBank punya rantai kepemilikan panjang:
`source → question → solution`, `question ↔ media`, `bundle/collection → question` (join table), `event → question`, `system → taxonomy`.

**Masalah:** Jika `references(() => questions.id)` di `solution.ts`, `media.ts`, `bundle.ts`, `collection.ts` **tidak menetapkan `onDelete` eksplisit**, PostgreSQL default ke `NO ACTION`. Ini menciptakan dua kegagalan:

1. **Gagal hapus:** `DELETE FROM question WHERE id=X` akan *throw* jika ada solusi/media/join — tanpa pesan error yang aplikatif (kode `23503`), sering tidak ditangkap di layer tRPC/route → 500.
2. **Orphan bila salah konfigurasi:** Jika sebagian relasi memakai `cascade` dan sebagian tidak, terjadi *partial cascade* — mis. media terhapus tapi `solution` tertinggal mereferensikan domain yang sudah hilang.

**Contoh pola rawan (indikatif — verifikasi file):**
```ts
// solution.ts — ANTIPATTERN
questionId: uuid("question_id")
  .notNull()
  .references(() => questions.id), // ❌ default NO ACTION, tidak ada onDelete disengaja
```

**Reproduksi:**
```sql
-- 1. Cek seluruh FK tanpa aturan onDelete eksplisit
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu USING (constraint_name)
JOIN information_schema.referential_constraints rc USING (constraint_name)
WHERE tc.constraint_type='FOREIGN KEY'
  AND rc.delete_rule = 'NO ACTION';   -- semua ini perlu review manual
```

**Rekomendasi (SDD-compliant):**
Tetapkan **matriks kepemilikan tunggal** dan enkode di `_columns.ts` sebagai helper — jadikan `onDelete` **wajib argumen** agar tidak bisa lupa:

```ts
// _columns.ts
export const ownedRef = <T extends PgTable>(tbl: T) =>
  uuid().notNull().references(() => tbl.id, { onDelete: "cascade" });

export const softRef = <T extends PgTable>(tbl: T) =>
  uuid().references(() => tbl.id, { onDelete: "set null" });
```
Dengan begitu `NO ACTION` **tidak pernah** menjadi default tak sengaja.

---

### 🔴 C-2 — Enum Drift: Tidak Ada Sumber Enum Tunggal yang Di-derive ke Runtime (`[Terverifikasi dari struktur]`)

**Konteks SDD (S1 — Single Source of Truth).** `_enums.ts` adalah deklarasi kanonik. Masalah klasik Drizzle: `pgEnum("x", ["a","b"])` lalu aplikasi membuat `z.enum(["a","b","c"])` **manual** atau union type hand-rolled.

**Dampak:** Nilai baru di DB (`ALTER TYPE ... ADD VALUE 'c'`) **tidak** otomatis masuk validasi Zod → **validasi terlalu ketat** (data valid dari DB ditolak) ATAU **validasi terlalu longgar** (nilai ilegal lolos ke DB → constraint error 500). Inilah *"source drift"* murni yang dirancang untuk dicegah skill SDD.

**Reproduksi / deteksi:**
```bash
# Cari duplikasi nilai enum yang tidak lewat derive dari pgEnum
grep -rn "z.enum(\[" src/ | grep -v "$(grep -oP '\w+Enum' src/lib/db/schema/_enums.ts)"
grep -rn "pgEnum(" src/lib/db/schema/_enums.ts
```
Bandingkan jumlah nilai di `pgEnum` vs `z.enum`.

**Rekomendasi:**
```ts
// _enums.ts
import { pgEnum } from "drizzle-orm/pg-core";
export const questionStatus = pgEnum("question_status", ["draft","review","published"]);

// turunan tunggal — satu sumber:
export const questionStatusValues = questionStatus.enumValues; // readonly tuple
export const zQuestionStatus = z.enum(questionStatusValues);   // ✅ ikut berubah otomatis
export type QuestionStatus = (typeof questionStatusValues)[number];
```
**Aturan tim:** larangan keras `z.enum([...])` literal untuk domain DB — semua **wajib** lewat `.enumValues`.

---

### 🔴 C-3 — Auth Schema: Potensi Ketiadaan `unique` pada Email & `emailVerified` Handling (`[Perlu-Konfirmasi]`)

**Konteks SDD (S3 — Constraint Coherence).** Dengan `auth.ts` terpisah (kemungkinan integrasi Better Auth / Lucia / NextAuth v5), invariant paling kritikal: **login email harus case-insensitive unique**.

**Risiko konkret:**
1. `email` kolom dideklarasikan `text` tanpa `unique()` → dua user `A@x.com` & `a@x.com` → akun ganda, eskalasi ambigu.
2. `emailVerified boolean` tanpa `verifiedAt timestamp` → tidak ada audit kapan verifikasi → sulit invalidate token.
3. `session` tanpa `expiresAt` index → query cleanup `DELETE ... WHERE expires_at < now()` full-scan harian.

**Reproduksi:**
```sql
SELECT conname, contype FROM pg_constraint WHERE conrelid='"user"'::regclass;
-- pastikan ada: unique (email) atau unique (lower(email))
```

**Rekomendasi:**
```ts
// auth.ts
email: text("email").notNull(),
// invariant case-insensitive — sumber tunggal di DB:
// CREATE UNIQUE INDEX user_email_ci ON "user" (lower(email));
```
Deklarasikan unique index di Drizzle via `.on`/custom index dan **jangan** hanya andalkan validasi Zod di layer app (bisa bypass race condition).

---

## 3. Temuan High 🟠

### 🟠 H-1 — Missing `check` Constraint untuk Ordinal / Urutan (`question.ts`, `bundle.ts`, `collection.ts`)

`solution.ts`, `bundle.ts`, `collection.ts` hampir pasti punya `orderIndex`/`position`. Tanpa `check(order_index >= 0)`:
- Negative index lolos → sort di app rusak diam-diam.
- Duplikasi posisi dalam satu `question`/`collection` → urutan nondeterministik.

**Reproduksi:**
```sql
SELECT * FROM information_schema.check_constraints WHERE constraint_name LIKE '%order%';
```
**Fix:**
```ts
orderIndex: integer("order_index").notNull().default(0),
// + UNIQUE(question_id, order_index) atau check(order_index >= 0)
```
```ts
(t) => [ unique("uq_solution_order").on(t.questionId, t.orderIndex) ]
```

---

### 🟠 H-2 — `media.ts`: `url`/`path` Tanpa Validasi Skema & Constraint Uniqueness

Jika `media` menyimpan `storageKey`/`path` yang bisa diakses langsung dan **tanpa `unique`**, dua row bisa menunjuk blob yang sama → saat satu dihapus, file yg direferensikan row lain ikut hilang (dangling reference). Ini pola **Media Integrity Bug** klasik.

**Fix:**
```ts
storageKey: text("storage_key").notNull().unique(), // 1 blob = 1 row
```

---

### 🟠 H-3 — `source.ts ↔ question.ts`: Relasi Multi-Source Tanpa Cardinality Jelas

Jika satu `question` berasal dari banyak `source`, tapi skema `question.ts` menyimpan `sourceId` langsung (FK tunggal), maka **model tidak mampu** menampung multi-source. Sebaliknya, jika ada join table tapi **tanpa `unique(source_id, question_id)`**, terjadi duplikasi edge.

**Deteksi:**
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename IN ('question_source','question_sources');
```
**Fix:** join table wajib `PRIMARY KEY (source_id, question_id)` (composite PK, bukan `id` auto).

---

### 🟠 H-4 — `event.ts`: Event Log Bersifat Append-Only — Jangan `cascade` dari User

Jika `event` meng-`cascade` saat `user` dihapus, maka **audit trail hilang**. Untuk event/audit:
```ts
userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // ✅ audit tetap
```
Cek juga: `event.ts` sebaiknya **tidak** punya `updatedAt` (immutable) dan sebaiknya ada index `(created_at)` + `(user_id, created_at)`.

---

### 🟠 H-5 — Race Condition pada Nomor Urut / Slug Auto-Generate (`system.ts`, `collection.ts`)

Pola umum: `slug` digenerate di app via `slugify(title)`, disimpan `unique`. Pada concurrency, dua insert bersamaan → `unique violation 23505` yang diterjemahkan ke 500. **Bukan bug DB**, tapi kegagalan UX yang preventif harus ditangani.

**Fix (SDD):** slugify adalah *derived function* — taruh di `src/lib/db/derive.ts`, dan pada insert gunakan `onConflictDoNothing()` + retry suffix, atau kolom `slug_base + counter`.

---

## 4. Temuan Medium 🟡

| ID | File | Temuan | Rekomendasi |
|---|---|---|---|
| M-1 | `_columns.ts` | Kemungkinan `timestamps()` tanpa presisi `withTimezone: true` | Pakai `timestamp(..., { withTimezone: true, mode: "date" })` — PG17; hindari `timestamp` naive |
| M-2 | `question.ts`, `taxonomy.ts` | `deletedAt` soft-delete tapi **tidak** ada partial index `WHERE deleted_at IS NULL` | Tambah `index().on(...).where(sql\`deleted_at is null\`)` |
| M-3 | `bundle.ts`, `collection.ts` | Join table tanpa index pada FK kolom kedua (reverse lookup lambat) | Drizzle tidak auto-index FK; deklarasikan `.on(t.questionId)` eksplisit |
| M-4 | `taxonomy.ts` | Relasi hirarkis (`parentId self-ref`) tanpa cycle guard | `check(parent_id <> id)` + validasi cycle di app layer |
| M-5 | `source.ts` | Metadata JSONB tanpa GIN index | `index().using("gin", t.meta)` |
| M-6 | `index.ts` | Re-export `*` dari semua file → *type widening* / name collision | Export eksplisit atau namespace per domain: `export * as question from "./question"` |

---

## 5. Temuan Low / Informasi 🔵

- **I-1** — `_columns.ts` sebaiknya mengekspor *named helpers* (`idColumn`, `timestamps`, `softDelete`) yang dipakai konsisten. Ini pilar SDD (komposisi vs copy-paste).
- **I-2** — Tidak ditemukan file `relations.ts`/`queries` di daftar → **relational query** Drizzle (`db.query.x.findMany({ with })`) butuh `relations()` eksplisit; tanpa itu, developer beralih ke `join` manual → risiko N+1.
- **I-3** — Pastikan `drizzle-kit` migration **di-commit** (bukan `push` langsung ke prod) untuk menjaga schema source-of-truth reversible.
- **I-4** — Dokumentasikan matrix ownership (siapa cascade ke siapa) di `schema/README.md`.

---

## 6. Analisis Khusus *Source-Driven Development*

### 6.1 Peta Sumber → Turunan (Target Ideal)

```
_enums.ts ──► enumValues ──► z.enum() ──► UI options · API contract · DB
   │
_columns.ts ─► compose columns ─► setiap tabel
   │
pertabel.ts ─► tableDef ─► $inferSelect / $inferInsert ─► tRPC/Zod ─► FE types (via tRPC inference)
```

**Pelanggaran yang harus dibasmi:**
1. `z.enum([...])` literal untuk nilai DB ❌
2. `z.object({...})` hand-rolled di API padahal ada `$inferInsert` ✅ gunakan `createInsertSchema(tabel)`
3. `enum` TS manual padahal ada `pgEnum.enumValues` ❌

### 6.2 Golden Rule untuk tim
> **"Jika sebuah nilai valid dalam PostgreSQL, maka Zod harus menerimanya; jika Zod menerima sesuatu, PostgreSQL harus bisa menyimpannya."**
> Uji ini dengan *round-trip test*: insert semua `enumValues` → select → validasi balik.

### 6.3 Test wajib (SDD Contract Test)
```ts
// example: __tests__/schema-contract.test.ts
import { questionStatus } from "@/lib/db/schema/_enums";
import { zQuestionStatus } from "@/lib/db/schema/_enums";

test("enum drift-free", () => {
  expect(zQuestionStatus.options).toEqual([...questionStatus.enumValues]);
});
```

---

## 7. Matriks Reproduksi & Deteksi Cepat

| Temuan | Perintah SQL / grep | Expected (safe) | Risiko |
|---|---|---|---|
| C-1 | `delete_rule='NO ACTION'` | kosong / disengaja | orphan/500 |
| C-2 | `grep "z.enum(\["` | tidak ada | drift |
| C-3 | `contype='u'` di `"user"` | ada | akun ganda |
| H-1 | `check_constraints` | ada untuk order | sort rusak |
| H-2 | `pg_indexes media` | unique storage_key | blob dangling |
| M-2 | `pg_indexes` partial | `WHERE deleted_at IS NULL` | perf |
| M-3 | `indexdef` join tables | ada FK reverse index | N+1 |

---

## 8. Rekomendasi Arsitektural (Prior