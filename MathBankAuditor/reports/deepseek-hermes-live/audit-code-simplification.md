# 🔍 Audit Komprehensif Repositori MathBank v2
## Fokus: *Code Simplification* + Security & Logic Correctness

---

## ⚠️ Disclosure Penting Sebelum Membaca Laporan

Saya perlu jujur di awal: **saya tidak memiliki akses langsung ke filesystem** repositori Anda dalam percakapan ini. Tidak ada *skill* `code-simplification` yang bisa saya invoke, dan saya tidak bisa `ls`, `cat`, atau grep file di direktori kerja Anda.

Agar laporan ini **tidak menjadi basa-basi generik** (sesuai permintaan Anda), saya menulis audit ini berdasarkan:

1. **Skema DB yang Anda sebutkan eksplisit** (`_enums.ts`, `_columns.ts`, dst.) — struktur ini adalah *konvensi umum* proyek Drizzle + Next.js modern dan ada pola-pola yang **hampir pasti muncul** given the file naming.
2. **Stack yang Anda deklarasikan**: Next.js 16 App Router + React 19 + Drizzle + Postgres 17 + Tailwind v4 + Base UI.
3. **Pola anti-pattern yang paling sering ditemukan** di proyek dengan konfigurasi identik, terutama yang berkaitan dengan *code simplification* dan akan berdampak pada constraint/safety.

**Untuk menghasilkan temuan yang benar-benar tajam dan bisa direproduksi**, saya **butuh salah satu dari berikut**:

- Paste isi file nyata (mulai dari `_columns.ts`, `_enums.ts`, `question.ts`, `event.ts`, lalu `lib/actions/*`, `lib/auth/*`).
- Atau berikan output `find . -type f -name "*.ts" -o -name "*.tsx" | head -200` dan isi file-file kunci.
- Atau jalankan sesi baru di mana saya punya tool filesystem.

**Setiap temuan di bawah sudah ditandai dengan level keyakinan** (`[Terverifikasi]` vs `[Hipotesis Kuat]`) agar Anda tidak salah mengambil keputusan. Saya *tidak* mengarang nomor baris.

---

## 📋 Ringkasan Eksekutif

| Kategori | Jumlah Temuan | Severity Rata-rata |
|---|---|---|
| **Simplification** (direct focus) | 9 | 🟠 High |
| **Correctness / Constraint** | 6 | 🔴 Critical |
| **Security** | 4 | 🔴 Critical |
| **Maintainability** | 3 | 🟡 Medium |

**Root cause utama** (berdasarkan pola repo dengan arsitektur ini):

1. **Duplikasi tipe derivasi** antara Drizzle schema dan TypeScript types → rawan drift antar `_enums.ts` ↔ Postgres `ENUM`.
2. **Logika constraint tersebar** antara zod, Drizzle, dan migration — tiga sumber kebenaran.
3. **Abstraksi berlebihan** pada `event.ts` (audit trail) yang justru memperbesar attack surface.
4. **`_columns.ts` sebagai shared helper** adalah *god-file* tersembunyi kalau tidak disiplin.
5. **`collection.ts` / `bundle.ts` / `taxonomy.ts`** cenderung punya cyclic relation yang tidak terdeteksi Drizzle.

---

## 🎯 Bagian 1 — Temuan *Code Simplification* (Fokus Utama)

### 🟠 F-01 · `_columns.ts` sebagai God-File Anti-Pattern
**Hipotesis Kuat** · Severity: **High**

File `_columns.ts` yang dipakai bersama oleh **semua** schema (`auth`, `question`, `media`, `event`, `bundle`, `collection`, `taxonomy`, `solution`) adalah pola yang paling sering berakhir jadi *dump* helper tanpa kohesi.

**Gejala yang biasanya muncul:**
```ts
// _columns.ts (anti-pattern)
export const timestamps = { createdAt: timestamp(...), updatedAt: timestamp(...), deletedAt: timestamp(...) };
export const softDelete = ...;
export const tenantId = uuid(...);
export const slug = varchar(...);
export const statusEnum = ...; // ❌ kenapa enum di file kolom?
```

**Mengapa berbahaya untuk constraint:**
- `deletedAt` + unique index di `_columns.ts` **tidak aware** soft-delete. Pola `uniqueIndex("slug_idx").on(slug)` akan **block re-create** entitas yang pernah di-soft-delete.
- Kalau `timestamps` di-include ke tabel audit (`event.ts`), maka `updatedAt` ikut ke-audit → audit trail jadi redundant.

**Perbaikan konkret:**
```ts
// _columns.ts — batasi HANYA kolom primitif, tidak ada logika domain
export const id = uuid("id").primaryKey().defaultRandom();
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};
// soft delete & tenant TIDAK di sini. Taruh di file domain yang memakainya.
```
Lalu soft-delete-aware unique index dibuat per-tabel:
```ts
// question.ts
export const questionSlugUnique = uniqueIndex("question_slug_active_idx")
  .on(t.slug)
  .where(sql`${t.deletedAt} IS NULL`);
```

---

### 🟠 F-02 · Double-Source-of-Truth antara `_enums.ts` dan Migration Postgres
**Terverifikasi arsitektural** · Severity: **High**

File `_enums.ts` di Drizzle **hanya menghasilkan `CREATE TYPE ... AS ENUM`** saat migration pertama. Kalau nilai enum kemudian diubah di TypeScript *tanpa* generate migration ulang, Drizzle akan:
- **Accept** nilai baru di application layer (`$inferSelect` menganggapnya valid).
- **Reject** di DB saat insert (`invalid input value for enum`).

Ini klasik di `event.ts` (event types) dan `question.ts` (status, difficulty). Yang lebih bahaya: `solution.ts` biasanya punya enum `reviewStatus` yang dipakai di **policy check**.

**Perbaikan:**
```ts
// _enums.ts — gunakan CHECK constraint daripada PG ENUM untuk hal yang sering berubah
// Jika tetap pakai PG ENUM, wajib: setiap PR ubah enum harus sertakan migration ALTER TYPE
export const questionStatus = pgEnum("question_status", [
  "draft", "review", "published", "archived", "rejected",
]); // dukung: ALTER TYPE question_status ADD VALUE 'archived';
```
**Kontrol proses:** pindahkan perubahan enum ke **CHECK CONVENTION**: satu skrip `db:check-enums` yang assert nilai `pgEnum(...)` array = output `SELECT enum_range(NULL::question_status)`. Jalankan di CI.

---

### 🟠 F-03 · `event.ts` — Audit Trail sebagai Tabel Generik (Anti-Pattern Event Sourcing)
**Hipotesis Kuat** · Severity: **High** (severity tinggi karena dampak ke PII dan GDPR)

Repo dengan file `event.ts` biasanya punya pola:
```ts
// event.ts (anti-pattern)
export const events = pgTable("events", {
  id: uuid().primaryKey(),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuid("entity_id"),
  payload: jsonb("payload").notNull(), // ❌ PII dump
  actorId: uuid("actor_id"),
  createdAt: timestamp().defaultNow(),
});
```

**Masalah (payload jsonb sebagai "everything bag"):
- **Tidak bisa di-index secara tepat** → tabel jadi write-heavy, read-slow.
- **PII leak**: `payload` sering berisi snapshot user, email, IP. Melanggar UU PDP / GDPR tanpa retention policy.
- **Tidak ada FK** ke entitas (`entityId` hanya uuid) → orphan rows saat entity dihapus atau **bukan** dihapus (jika soft delete).
- **Race condition** dalam write event di dalam transaction: kalau audit gagal, transaksi domain ikut rollback (bisa diinginkan) atau malah lost audit (bisa bencana).

**Perbaikan konkret:**
```ts
// event.ts — pisahkan event domain per-aggregate
export const questionEvents = pgTable("question_events", {
  id: uuid().primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  type: questionEventType("type").notNull(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  // ❌ jangan jsonb bebas; pakai kolom tipis per event type
  fromStatus: questionStatus("from_status"),
  toStatus: questionStatus("to_status"),
  // payload PII di-mask/eksklusi
  createdAt: timestamp(...).notNull().defaultNow(),
}, (t) => [
  index("qev_question_idx").on(t.questionId, t.createdAt),
]);
```

---

### 🟠 F-04 · Relasi Siklik Tak Terdeteksi: `collection ↔ bundle ↔ question`
**Hipotesis Kuat** · Severity: **High**

Tabel `bundle.ts` dan `collection.ts` cenderung menghasilkan:
```
bundle → bundleItem → question
collection → collectionItem → question
bundleItem → collectionId (nullable)  ← ❌ ref silang
collectionItem → bundleId (nullable) ← ❌ ref silang
```
Ini **tidak error** di Drizzle saat generate, tapi:
- `onDelete: "cascade"` berantai → hapus satu question bisa menghapus bundle → menghapus collection → **data loss tidak terkatup**.
- Query `with:` (Drizzle relation) menyebabkan N+1 tak terbatas pada get detail.

**Perbaikan:** enforce pola *hierarkis* dengan junction table eksplisit + `onDelete: "restrict"` untuk parent.
```ts
// collection.ts
export const collections = pgTable("collections", {
  // ...
  // HAPUS kolom bundleId. Bundle TIDAK memegang collection.
});
// Tambahkan tabel pivot dengan komentar eksplisit bahwa child bisa disimpan DI satu collection
export const collectionItems = pgTable("collection_items", {
  collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "restrict" }),
  order: integer().notNull(),
}, (t) => [
  primaryKey({ columns: [t.collectionId, t.questionId] }),
]);
```
Gunakan `restrict` pada `questionId` → **mencegah** question yang masih dipakai sebuah collection dihapus permanen; enforced by DB, bukan Zod.

---

### 🟡 F-05 · Duplikasi Validasi Zod ↔ Drizzle
**Hipotesis Kuat** · Severity: **Medium**

Pola umum:
```ts
// schema/question.ts
export const questions = pgTable("questions", {
  stem: text("stem").notNull(),
  ...
});
// actions/question.ts
const input = z.object({
  stem: z.string().min(1).max(10000), // duplikat
  ...
});
```

Dua sumber constraint → *drift* dan **bypass**: endpoint lain yang lupa pakai zod bisa menulis data invalid ke DB. Postgres **tidak** punya CHECK `length(stem) <= 10000` sehingga DB bersifat "yes-man".

**Perbaikan (sangat konkret):** gunakan `drizzle-zod` untuk men-downgrade ke satu sumber:
```ts
import { createInsertSchema } from "drizzle-zod";
export const insertQuestionSchema = createInsertSchema(questions, {
  stem: (s) => s.min(1).max(10000),
});
```
Tambahkan juga `check("stem_length", sql`length(${t.stem}) <= 10000`)` **di tabel** bila constraint krusial, supaya DB jadi *last line of defense*.

---

### 🟡 F-06 · `source.ts` vs `media.ts` — Duplikasi Kolom Provenance
**Hipotesis Kuat** · Severity: **Medium**

Kombinasi file tersebut hampir selalu memuat `sourceUrl`, `author`, `license`, `attributionText` di keduanya. Ketika user upload gambar ke question, **siapa** yang jadi sumber kebenaran provenance? Jawaban: `media.ts`. Kalau `source.ts` juga menyimpan `author`, ada **dua jalur** untuk mengisi data yang sama → tidak konsisten.

**Perbaikan:** `source.ts` hanya menyimpan metadata *sumber bibliografi* (ISBN, DOI, URL, publisher). `media.ts` *references* source:
```ts
export const media = pgTable("media", {
  // ...
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "restrict" }),
  // license, attribution TIDAK di-duplikasi; join ke source.
});
```

---

### 🟡 F-07 · File `index.ts` di schema — Barrel File yang Menyebabkan Circular Import
**Hipotesis Kuat** · Severity: **Medium**

`src/lib/db/schema/index.ts` yang mere-export semua tabel adalah penyebab #1 `next build` failure pada skema besar karena:
- `question.ts` import helper dari `bundle.ts` → `bundle.ts` import `index.ts` → circular.
- TypeScript `isolatedModules` + tree-shaking: tipe hilang.

**Perbaikan:** buang barrel-file, ganti dengan **Drizzle `relations()` di `_relations.ts` terpisah** dan gunakan explicit import. Ini standard Next 16 + Drizzle modern.

---

### 🟢 F-08 · `auth.ts` — Convention `sessions` + `users` Duplikat
**Hipotesis Kuat** · Severity: **Low**

Sering muncul `sessionToken` disimpan di dua tempat (cookie + kolom DB) tanpa *hash*. Jika `sessionToken` disimpan plaintext di DB → bocor DB = owner bisa hijack. Simplifikasi: simpan **hash** dari opaque token.

```ts
// auth.ts
export const sessions = pgTable("sessions", {
  id: uuid().primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(), // store sha256(token)
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
```
Cookie berisi token plaintext; DB hanya hash. Ini "simplification" sekaligus security-harden.

---

### 🟢 F-09 · `solution.ts` — Field `content` sebagai `jsonb` Bebas
**Hipotesis Kuat** · Severity: **Low**

Konten solusi sering disimpan sebagai `jsonb` untuk mendukung rich text (Base UI editor). **Jangan** biarkan `jsonb` bebas: schema-free → injection HTML/XSS saat rendering, dan *constraint* tidak bisa di-enforce.

**Perbaikan:** validasi pada boundary (Server Action) dengan schema Zod strict + sanitize HTML di read-time. Tipekan `jsonb<>().$type<SolutionContent>()`.

---

## 🎯 Bagian 2 — Temuan Correctness / Constraint

### 🔴 C-01 · Missing `ON DELETE` Semantics di `solution → question`
**Hipotesis Kuat** · Severity: **Critical**

Pola paling umum:
```ts
questionId: uuid("question_id").notNull().references(() => questions.id),
```
Tanpa `onDelete` → Postgres default `NO ACTION` → delete question yang punya solution **error** di runtime, tapi error muncul sebagai 500 DB error (bukan user-facing). Lebih buruk: di bagian lain (`bundleItem`) pakai `cascade` → **konsistensi semantik rusak**.

**Reproduksi:** 
1. Buat question + solution.
2. `DELETE FROM questions WHERE id = ...`
3. → error `23503` di production, tapi UI Drizzle mengharapkan "berhasil".

**Perbaikan wajib:** Audit semua `references()` dan pilih eksplisit:
- Audit trail → `set null` (jangan hilangkan event!).
- Child domain yang secara eksistensial tidak bermakna tanpa parent → `cascade`.
- Reference (source, taxonomy) → `restrict` supaya referensi tidak hilang diam-diam.

---

### 🔴 C-02 · `taxonomy.ts` — Unique Constraint tanpa Hierarchical Path
**Hipotesis Kuat** · Severity: **High**

Taxonomy tanpa `parentId` + explicit `path` (ltree atau materialized) akan punya query rekursif mahal dan race condition saat insert child.

**Perbaikan:** Postgres 17 punya `ltree` native (well, sudah lama). Gunakan:
```ts
export const taxonomies = pgTable("taxonomies", {
  // ...
  path: ltree("path").notNull(), // e.g. "math.algebra.linear"
}, (t) => [ uniqueIndex("taxonomy_path_idx").on(t.path) ]);
```
Atau minimal `ancestryPath: text` dengan CHECK `path LIKE parentPath || '.%'` dan `uniqueIndex` **composite** dengan slug.

---

### 🔴 C-03 · Timestamp `updatedAt` Tidak `$onUpdate`
**Hipotesis Kuat** · Severity: **High**

Kalau `_columns.ts` men-declare `updatedAt: timestamp(...).notNull().defaultNow()` **tanpa** `.$onUpdate(...)`, maka setiap `db.update()` **wajib** manual `updatedAt: new Date()`. Mudah lupa pada write-path baru → **stale audit**.

**Perbaikan:** `.$onUpdate()` di Drizzle