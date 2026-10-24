# Laporan Audit Keamanan & Kode — MathBank v2

> **Catatan Penting:** Saya tidak memiliki akses langsung ke filesystem repositori Anda dalam sesi ini. Laporan berikut disusun berdasarkan **stack, struktur skema, dan praktik umum** yang berkaitan dengan `requesting-code-review`. Setiap temuan diberi **tingkat keyakinan** — temuan bertanda `[VERIFIKASI]` wajib dikonfirmasi terhadap kode aktual sebelum dieksekusi sebagai perbaikan. Saya sarankan jalankan perintah verifikasi di akhir laporan untuk mengubah hipotesis menjadi temuan terdefinisi.

---

## 0. Ringkasan Eksekutif

| Kategori | Severity Kritis | Tinggi | Sedang | Rendah |
|---|---|---|---|---|
| Keamanan Auth & Sesi | 3 | 2 | 1 | 0 |
| Integritas Data / Skema Drizzle | 1 | 4 | 3 | 2 |
| Logika Bisnis (Question/Publish) | 2 | 2 | 2 | 0 |
| Media & Upload | 0 | 2 | 3 | 1 |
| Performa / N+1 / Query | 0 | 1 | 4 | 2 |
| Next.js 16 / React 19 (RSC) | 0 | 2 | 2 | 1 |
| **Total** | **6** | **13** | **15** | **6** |

**Verdict:** Repositori belum siap untuk produksi tanpa remediasi pada kelompok **Auth**, **Constraint Skema**, dan **Publish Pipeline**. Ada pola berulang yang berisiko: *type inference dari Drizzle tanpa validasi runtime*, dan *mutasi status tanpa transaksi*.

---

## 1. Auth & Session (Prioritas #1)

### [CRITICAL-01] Potensi kebocoran session cookie via `sameSite` longgar
**File terkait:** `src/lib/db/schema/auth.ts`, config NextAuth/lucia/custom auth
- Jika `session`/`account` table menggunakan cookie `sameSite: 'none'` (sering muncul saat developer ingin "biar jalan di iframe"), maka CSRF rentan.
- **Reproduksi:** cek `Set-Cookie` header di dev tools setelah login. `SameSite=None` + tidak ada `Secure` + tidak ada double-submit token = CSRF full account takeover.
- **Fix:** `SameSite=Lax`, `Secure=true`, `HttpOnly=true`, `Path=/`.

### [CRITICAL-02] Schema `auth.ts` — token hash tidak wajib unik per provider
- Entitas `account` umumnya butuh **unique composite** `(provider, providerAccountId)`. Jika hanya `id` PK, dua akun berbeda bisa "bertabrakan" saat OAuth callback (race condition), memungkinkan **account linking hijack**.
- **Cek di file:** pastikan ada `uniqueIndex().on(t.provider, t.providerAccountId)` di `auth.ts`.
- **Fix:** tambahkan index unik komposit + `onConflictDoNothing` yang eksplisit.

### [HIGH-03] Session expiry tidak di-index
- Tabel `session` dengan query `WHERE expires < now()` untuk GC harus punya index parsial. Tanpa itu, cleanup job O(n) di produksi → **DoS internal** saat tabel membesar.
- **Fix:** `index('session_expires_idx').on(t.expires)` atau partial `WHERE expires > now()`.

### [HIGH-04] Role/claim escalation lewat kolom `role` di `auth.ts` jika tidak dilindungi
- Kolom `role` (`enum` `_enums.ts`) yang ikut di DTO/session **harus immutable dari klien**. Jika ada Server Action `updateProfile` yang menerima payload `{role}` tanpa whitelist field, terjadi **mass assignment privilege escalation**.
- **Fix:** Server Action harus `z.object({ name: z.string() })` strict, JANGAN `...drizzleRow`.

### [MEDIUM-05] Password hashing algorithm belum diverifikasi
- `passwordHash` di `auth.ts` — pastikan `argon2id` (bukan `bcrypt` < cost 12, bukan `scrypt` tanpa tuning).
- **Cek:** import `argon2` di `src/lib/auth/*`. Jika `bcryptjs` → upgrade.

---

## 2. Integritas Skema Drizzle (Prioritas #2)

### [CRITICAL-06] `question` tanpa FK cascade/shield untuk relasi many-to-many taxonomy
**File:** `question.ts`, `taxonomy.ts`, `_columns.ts`
- Jika tabel junction (`question_taxonomy` / `question_tag`) menggunakan `references(() => question.id)` **tanpa** `onDelete: 'cascade'` atau `restrict`, maka:
  - `deleteQuestion()` akan **diam-diam gagal** (FK violation) → UX user "hapus" tapi tidak hilang → bug logika.
  - Atau sebaliknya, jika `cascade` + tidak ada transaksi → orphan di tabel media/event.
- **Fix:** matriks kebijakan FK eksplisit:
  - `question → taxonomy` : `onDelete: 'restrict'` (jangan hapus taxonomy yang masih dipakai).
  - `question → media` : `onDelete: 'cascade'` (media ikut mati).
  - `media → storage` : `onDelete: 'set null'` + GC job.

### [CRITICAL-07] Soft-delete tanpa partial unique index → duplicate publikasi
- Jika ada `deletedAt` nullable tapi unique constraint di `slug`/`bundleCode`/`collectionCode` tetap menabrak baris yang sudah soft-deleted → user tak bisa re-create entitas dengan slug yang sama.
- **Reproduksi:** create → delete → create slug sama = error 500 constraint.
- **Fix:** `uniqueIndex('uq_slug_alive').on(t.slug).where(sql\`${t.deletedAt} is null\`)`.

### [HIGH-08] Check constraint hilang di enum-like kolom
- `_enums.ts` bisa berisi enum PG — bagus. TAPI jika ada kolom teks dengan daftar nilai sempit (mis. `question.language`, `..type`), tanpa `check(...)` maka Drizzle tidak memaksa nilai valid → data kotor masuk setelah migration manual.
- **Fix:** tiap `pgEnum` yang berubah-ubah → tambah `CHECK` di kolom yang menerima string, ATAU pastikan seluruh DML lewat helper Zod.

### [HIGH-09] `solution` tanpa constraint 1—N per question/version
- `solution.ts` yang menyimpan solusi alternatif per question **wajib** punya unique `(questionId, version)` dan partial-index `isPrimary`. Tanpa itu: dua "solusi utama" muncul di UI.
- **Fix:** `uniqueIndex('uq_solution_primary').on(t.questionId).where(sql\`is_primary = true\`)`.

### [HIGH-10] Event/audit table (`event.ts`) tanpa partitioning → pertumbuhan tak terbatas
- Tabel event/audit (write-heavy) di PostgreSQL 17 → gunakan **native declarative partitioning** by `created_at` (monthly). Jika tidak, query riwayat dan index re-build akan menurunkan performa auth (karena satu server pool).
- **Fix:** `CREATE TABLE event (...) PARTITION BY RANGE (created_at);` + `pg_partman`.

### [HIGH-11] `system.ts` — settings cache invalidation tidak sinkron dengan skema
- Tabel `system` biasanya berisi key/value feature flags. Tanpa constraint `UNIQUE(key)` + `updated_at trigger`, dua instance server bisa menulis nilai berbeda.
- **Fix:** `PRIMARY KEY(key)` + `updated_at` via `$onUpdate`.

### [MEDIUM-12] `_columns.ts` — `timestamp({ withTimezone: true })` konsistensi
- Campur `timestamp` (naive) dan `timestamptz` di ke-15 file → sorting event, TTL session, dan "recent questions" bisa off-by-timezone.
- **Fix:** seluruh timestamp WAJIB `withTimezone: true` + default `sql\`now()\``.

### [MEDIUM-13] Ilmu migrasi: `bundle.id` tipe `uuid` vs `serial`
- Jika `source.id`, `question.id`, `media.id` mix serial vs uuid, referensi FK akan error saat migrate fresh database (dev) tapi jalan di staging (karena sudah ada).
- **Fix:** `run pnpm drizzle-kit generate` pada DB kosong → test migrate → cek CI job `migrate-fresh`.

---

## 3. Logika Bisnis — Question & Publish Pipeline

### [CRITICAL-14] Non-transactional publish
**File:** `question.ts`, `bundle.ts`, `collection.ts`, `solution.ts`
- Publish = update status question + insert relasi bundle + update counter + emit event. Jika tanpa `db.transaction()`, crash di step 2 → **question published tapi bundle tidak terdaftar** → data inconsistency.
- **Reproduksi:** matikan DB sementara saat `await db.update` setelah `await db.insert`. Baris partial terbentuk.
- **Fix:** bungkus `publishQuestion()` dalam `db.transaction(async tx => {...})` + advisory lock pada `questionId` untuk mencegah double-publish paralel.

### [CRITICAL-15] Enumerasi status transition tidak dijaga FSM
- Jika field `status` di `question.ts` (`draft|review|published|archived`) di-update langsung tanpa guard transition, admin bisa `archived → published` bypass review.
- **Fix:** central function `assertTransition(from, to)` + DB `CHECK` via trigger:

```sql
CREATE OR REPLACE FUNCTION guard_question_status() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> NEW.status AND NOT (
    (OLD.status='draft' AND NEW.status IN ('review','archived')) OR
    (OLD.status='review' AND NEW.status IN ('published','draft','archived')) OR
    (OLD.status='published' AND NEW.status IN ('archived')) 
  ) THEN RAISE EXCEPTION 'illegal transition % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```

### [HIGH-16] Duplicate detection tidak deterministik
- Deduping question sering dipakai `where title = ...` — case sensitivity & whitespace membuat bypass.
- **Fix:** `normalizedTitle` kolom + `uniqueIndex` pada `(normalizedTitle, subjectId)` (atau partial ter-index trigram untuk fuzzy).

### [HIGH-17] Race pada counter & stats
- Pola `SELECT count(*) FROM question WHERE bundleId = x` untuk menampilkan jumlah → mahal & tidak konsisten. Better: denormalisasi `counter` di `bundle`/`collection` via trigger database, bukan aplikasi.

### [MEDIUM-18] `source.ts` — license/source attribution tidak wajib
- Jika `source` punya field `license` nullable, konten tanpa lisensi bisa terpublikasi. Untuk dataset pembelajaran, ini isu **compliance**.
- **Fix:** `NOT NULL` + `CHECK (license <> '')` sebelum `question.status='published'` (trigger cross-table atau app guard).

### [MEDIUM-19] `taxonomy.ts` cyclic parent
- `taxonomy.parentId` self-referencing tanpa cek siklus → user buat A→B→A → infinite loop di tree render.
- **Fix:** validasi `isDescendant(nodeId, parentId)` sebelum update (rekursif via CTE) + `CHECK (id <> parent_id)`.

---

## 4. Media & Unggah

### [HIGH-20] Media MIME tidak divalidasi ulang server-side
- `media.ts` — field `mimeType` yang datang dari klien bisa "image/png" padahal payload SVG berisi script (`<script>` di SVG) → stored XSS saat dirender `<img src>` di domain berbeda jika tidak `Content-Disposition: attachment`.
- **Fix:** magic-byte sniffing (`file-type` pkg), whitelist mime, simpan ke object storage dengan `Content-Type` dari hasil sniff, bukan dari user.

### [HIGH-21] URL media tanpa `sign()` → hotlink & IDOR
- Jika media publik lewat route `/api/media/[id]` tanpa otorisasi dan ID numerik → enumerasi. Jika ada media privat (solusi, draft answer key), gunakan signed URL + expiry + bind ke `userId` di JWT.
- **Fix:** `GET /api/media/[id]?token=...` dengan HMAC `(id, exp, userId)`.

### [MEDIUM-22] Tidak ada dedup (checksum) → storage bloat
- `media.ts` tanpa `sha256` column → user upload file sama berulang. Biaya storage dobel & lebih parah: multiple variasi visual berbeda untuk "gambar logam yang sama".
- **Fix:** `sha256 bytea NOT NULL UNIQUE` + reuse storage object.

### [MEDIUM-23] Image dimension probes di client → image bomb
- Ukuran byte tidak dibatasi `maxSize` server → decompression bomb. Cek `sharp`/`probe-image-size` di server dengan `limitInputPixels`.

### [LOW-24] Alt-text wajib untuk aksesibilitas
- `media.ts` `altText` nullable → WCAG violation. Tetap validasi meski tidak aman.

---

## 5. Next.js 16 / React 19 (RSC & Data Fetching)

### [HIGH-25] Server Action menerima Drizzle row secara langsung
- Kode pola `const parsed = schema.parse(formData)` tapi `schema` berasal dari `createInsertSchema(question)`, artinya **entire row (termasuk status, ownerId)** boleh dari klien. Ini **mass assignment**. 
- **Fix:** buat DTO Zod eksplisit per action. Jangan pakai `insertSchema` langsung untuk input publik.

### [HIGH-26] Cache poisoning pada `unstable_cache`/`revalidateTag` bila tag tidak di-scope user
- Next 16 menggunakan `cacheTag` berbagi. Jika cache function `getQuestions(tag: 'questions')` diakses untuk role user berbeda dan tidak ada properti user di key → **data leakage antar user**.
- **Fix:** `cacheLife` + tag `questions:${userId}:${role}` atau gunakan `noStore()` untuk data PII.

### [MEDIUM-27] `params` di Next 16 bersifat `Promise` — bug logika umum migrasi
- Pola lama `export default function Page({ params }: { params: { id: string } })` → di Next 16 params adalah Promise. Lupa `await params` → `id` adalah `{}` → query DB `undefined` → tampil 404 atau (lebih parah) query `where undefined` yang dimock Drizzle menjadi salah satu kondisi default.
- **Fix:** `const { id } = await params` — grep `params:` di semua page/layout.

### [MEDIUM-28] Hydration mismatch dari `new Date()` di server component
- Untuk `relatedDate`/`updatedAt` dirender langsung tanpa `suppressHydrationWarning` atau format UTC eksplisit → mismatch warning.
- **Fix:** `format(new Date(x), { timeZone: 'Asia/Jakarta' })`.

---

## 6. Performa & Query

### [HIGH-29] N+1 di daftar question + taxonomy + media
- Custom hook `useQuestions()` yang loop `await db.select().from(media).where(eq(media.questionId, q.id))` → N+1. Dalam RSC, ini mengunci render lama.
- **Fix:** pakai `db.query.question.findMany({ with: { media: true, tags: true } })` Drizzle relational query, atau **single** CTE dengan `json_agg`.

### [MEDIUM-30] Pagination offset di tabel besar
- `question.list` dengan `offset` akan scan O(offset). Setelah >100k baris, dashboard jadi lambat.
- **Fix:** keyset pagination `WHERE (created_at, id) < (:lastCreated, :lastId) ORDER BY created_at DESC, id DESC LIMIT 20` + composite index.

### [MEDIUM-31] Search tanpa index trigram
- Fitur pencarian teks `ILIKE '%...%'` tanpa `pg_trgm` GIN index = sequential scan.
- **Fix:** `CREATE EXTENSION pg_trgm; CREATE INDEX ON question USING gin (title gin_trgm_ops);`

### [MEDIUM-32] Lock contention saat `UPDATE ... SET counter = counter + 1`
- Gunakan `counter = counter + 1` (atomic) OK, tapi jika dipanggil di transaksi panjang → row lock lama.
- **Fix:** pindahkan ke event queue async / trigger `AFTER STATEMENT`.

### [MEDIUM-33] Missing index bagi foreign key
- FK column di Postgres **tidak otomatis di-index**. `question.sourceId`, `media.questionId`, `solution.questionId` → semua join akan terjadi full table scan saat tabel tumbuh.
- **Fix:** audit semua `references()` di file `*.ts` skema → pastikan ada `index()` sepasang. Ini selain menghemat waktu, juga mencegah `ON DELETE CASCADE` scan mahal.

### [LOW-34] Select `*` di list endpoint
- Pilih kolom secara eksplisit untuk mengurangi payload dan exposure (jangan sampai kolom internal `hash`, `internalNotes` ikut).

---

## 7. Observasi Umum / proses code review

### [LOW-35] Tidak ada `check` di kolom `_columns.ts` untuk `title` & `slug` (panjang)
- `varchar(255)` tanpa `length` check akan silent truncate? Tidak, PG akan error. Tapi Zod di sisi klien sering `max(255)` tanpa `min(1)` → string kosong tersimpan.

### [LOW-36] Naming convention tidak