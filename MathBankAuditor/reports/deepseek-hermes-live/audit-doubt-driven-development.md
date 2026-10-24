# 🔍 AUDIT INDEPENDEN MATHBANK v2
## Metodologi: *Doubt-Driven Development*

**Auditor:** Senior Code Auditor & Security Expert
**Tanggal:** Audit Komprehensif
**Stack:** Next.js 16 (App Router) · React 19 · Drizzle ORM · PostgreSQL 17 · Tailwind v4 · Base UI

---

## 0. Filosofi Audit — Membaca dengan "Doubt-Driven"

Skill *doubt-driven-development* bukan soal "percaya lalu verifikasi", tapi **"curigai dulu, baru terima"**. Setiap baris kode diperlakukan sebagai *suspect* sampai ada bukti eksplisit bahwa ia benar. Pertanyaan inti yang dipakai di sepanjang audit:

> *"Apa yang akan terjadi bila kode ini menerima input yang tidak diharapkan, race condition, atau dipanggil dalam urutan yang salah?"*

Temuan di bawah dikelompokkan berdasarkan **tingkat keparahan** dan disertai bukti konkret (path + pola) agar dapat direproduksi.

> ⚠️ **Catatan transparansi audit:** Laporan ini disusun terhadap *kontrak skema* dan *pola umum* yang Anda deklarasikan (daftar file schema + stack). Saya **tidak** membaca isi file secara langsung di lingkungan ini — karena itu, semua temuan dilabeli **[KONFIRMASI-DIPERLUKAN]** dan harus diverifikasi dengan `grep`/`sed` pada file yang disebut spesifik. Saya sengaja tidak mengarang nomor baris.

---

## 1. Ringkasan Eksekutif

| Severity | Jumlah | Area dominan |
|:--:|:--:|:--|
| 🔴 **Critical** | 4 | Auth/session, event sourcing, media, integritas relasi |
| 🟠 **High** | 7 | Enums & enum drift, cascade, soft-delete, taxonomy |
| 🟡 **Medium** | 9 | Constraint, index, tipe kolom, concurrency |
| 🔵 **Low / Hardening** | 6 | Ergonomi skema, observabilitas, migrasi |

**Skor kesiapan (proxy):** Skema fungsional tetapi **fragile pada tiga titik**: (1) kontrak identitas & sesi, (2) transisi status pertanyaan/solusi, (3) event taxonomy. Ketiganya adalah titik di mana *bug logika paling mahal* muncul di production.

---

## 2. Temuan Kritis 🔴

### C-1 — Ketidaksepakatan sumber-dari-kebenaran enum (Enum Drift) 
**File:** `src/lib/db/schema/_enums.ts`, `src/lib/db/schema/question.ts`, `src/lib/db/schema/solution.ts`

**Doubt:** Enum di Drizzle adalah `pgEnum`. Bila ada nilai baru (mis. status pertanyaan `'archived'`, status solusi `'needs_review'`) yang di-hardcode sebagai string literal di komponen React / service, TS **tidak** akan menolaknya bila literal itu ada di tipe union yang lebih luas, dan DB akan **menolak** saat runtime.

**Repro potensial:** tambah `"archived"` di form (string cast) → `INSERT` gagal `invalid input value for enum question_status` → 500 di production, lolos dari typecheck CI.

**Root cause:** tidak ada *single source of truth* untuk nilai enum lintas layer. `pgEnum` + union TypeScript = dua tempat yang bisa menyimpang.

**Rekomendasi:**
```ts
// _enums.ts — derive tipe dari pgEnum, JANGAN tulis union manual
export const questionStatus = pgEnum("question_status", ["draft","published","archived"]);
export type QuestionStatus = (typeof questionStatus.enumValues)[number]; // auto-turun enumValues
```
Lalu pastikan **semua** string literal status di `components/`, `app/`, `server/` memakai `QuestionStatus`, bukan `string`. Tambah test CI: `expect(() => questionStatus.enumValues).toEqual(goldenList)`.

---

### C-2 — `event.ts`: Pola Event/Outbox tanpa Idempotency Key
**File:** `src/lib/db/schema/event.ts`

**Doubt:** Schema event (audit/domain event) hampir pasti punya kolom `type`, `payload`, `aggregate_id`, `created_at`. **Bahaya:** bila event dipublish oleh retry (webhook, queue) tanpa `idempotency_key UNIQUE`, event ganda tercipta → double-counting di leaderboard, poin ganda, notifikasi dobel.

**Repro:** handler webhook `POST /api/webhooks/...` di-retry 2× saat timeout → dua baris event identik → agregat kredit ganda.

**Rekomendasi (wajib):**
```ts
idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
// + uniqueIndex("event_idempotency_uq").on(table.idempotencyKey)
// atau composite unique (aggregateId, type, version) untuk optimistic concurrency
```
Lalu di handler: `insert(...).onConflictDoNothing({ target: event.idempotencyKey })`.

---

### C-3 — `media.ts`: Tidak ada validasi kepemilikan / orphan & MIME
**File:** `src/lib/db/schema/media.ts`

**Doubt:** Media (gambar soal, audio solusi) biasanya punya `url`, `mime`, `size`, `uploaderId`. Dua jebakan:
1. **Orphaned media**: file ter-upload ke S3/storage tapi baris DB gagal dibuat (transaksi putus) → biaya storage membengkak, tidak terdeteksi.
2. **Content-type spoofing**: `mime` disimpan dari klien → SSR/image optimizer bisa memproses SVG berisi script (stored XSS via `<img>`? tidak, tapi SVG inline / Next.js Image bypass signing lolos).

**Rekomendasi:**
- Kolom `uploaded_by` FK + `status pgEnum('media_status',['pending','ready','rejected'])`.
- Simpan `mime` dari **hasil sniffing server** (magic bytes), bukan header klien.
- FK dengan `onDelete: 'restrict'` dan job pembersih orphan (`created_at < now()-1d AND status='pending'`).

---

### C-4 — `auth.ts`: Relasi sesi/refresh tanpa constraint rotasi
**File:** `src/lib/db/schema/auth.ts`

**Doubt:** Skema auth (session/token) rentan bila:
- `session.token` tidak `UNIQUE` → peluang tabrakan (kecil, tapi prinsipnya).
- Refresh token rotation tanpa `replaced_by`/family ID → deteksi *token reuse attack* mustahil. Penyerang yang mencuri token bisa memutar selamanya tanpa alarm.
- `expires_at` tanpa index → *cleanup* scan ke seluruh tabel.

**Repro:** curi refresh token → tukar 2× paralel → kedua respons `200` (karena tidak ada rotasi keluarga) → dua sesi aktif, sesi korban tetap diam.

**Rekomendasi:**
```ts
token: varchar(...).notNull().unique(),
familyId: uuid("family_id").notNull(),      // identitas rotasi
replacedByTokenId: uuid().references(() => session.id), // null = aktif
revokedAt: timestamp(),
expiresAt: timestamp().notNull(),           // + INDEX(expiresAt)
// UNIQUE (familyId, revokedAt IS NULL)? gunakan partial unique index:
// uniqueIndex("one_active_per_family").on(familyId).where(sql`revoked_at IS NULL`)
```
Implementasi *theft detection*: bila token yang sudah `replacedByTokenId != null` dipakai → revoke seluruh `familyId`.

---

## 3. Temuan High 🟠

### H-1 — `_columns.ts`: Soft-delete tanpa indeks parsial & tanpa `deletedAt` konsisten
**Doubt:** Jika `_columns.ts` menyediakan helper `timestamps`/`softDelete` dan dipakai **sebagian** tabel, query listing (`WHERE deleted_at IS NULL`) akan full-scan hingga tabel besar. Lebih buruk: UNIQUE constraint yang tidak mempertimbangkan soft-delete → user "menghapus" pertanyaan, buat baru dengan slug sama → **konflik**. 

**Repro:** `INSERT question (slug='pythagoras')` → `duplicate key` walau slug lama sudah soft-deleted.

**Rekomendasi:** `UNIQUE (slug)` **diganti** `UNIQUE INDEX ON (slug) WHERE deleted_at IS NULL` (partial). Berlaku untuk semua natural key: `users.email`, `taxonomy.slug`, `collection.slug`.

### H-2 — `question.ts`: Transisi status tanpa check constraint
**Doubt:** Pertanyaan `draft → published` harus punya ≥1 solusi/answer valid dan ≥1 media? Tidak ada `CHECK` yang menegakkan itu di DB → service yang bug bisa mempublish soal kosong. Karena publishing berdampak ke peserta ujian, ini *high*.

**Rekomendasi:** tambah kolom `publishedAt` (nullable) dan constraint aplikasi + (ideal) `CHECK (status <> 'published' OR published_at IS NOT NULL)`. Lebih kuat: trigger DB `validate_question_publishable` (defense-in-depth walau Drizzle "schema-first").

### H-3 — `solution.ts`: Integritas ke `question` & urutan solusi
**Doubt:** Solusi terhubung ke `question_id` tapi bila `onDelete` default (`no action`) → hapus soal gagal; bila `cascade` → hapus soal menghapus solusi **tanpa audit**. Juga: tidak ada `UNIQUE(question_id, order)` → dua solusi "langkah ke-1".

**Rekomendasi:** `onDelete: 'restrict'` + soft-delete di level aplikasi; tambah `uniqueIndex("solution_question_order_uq").on(questionId, order)`.

### H-4 — `source.ts`: Attribution tanpa FK ke media/user
**Doubt:** `source` (sumber soal, hak cipta) biasanya berisi `url`, `publisher`. Bila `sourceId` di question **nullable** dan tidak `restrict`, soal bisa ada tanpa provenance — masalah legal/plagiarism. Bila ada `uploaderId` tanpa FK ke `auth` → ghost user.

**Rekomendasi:** `sourceId: uuid().references(() => source.id, { onDelete: 'restrict' })` (bukan nullable untuk soal `published` — enforced di H-2).

### H-5 — `bundle.ts` & `collection.ts`: Cross-entity tanpa transaksi
**Doubt:** "bundle berisi banyak collection/question" butuh tabel junction. Bila junction dibuat **tanpa** `PRIMARY KEY (bundle_id, collection_id)` → duplikasi. Bila tanpa `onDelete: 'cascade'` di FK junction → orphan rows. Bila `position` tanpa unique per bundle → urutan ganda.

**Rekomendasi:** junction selalu: `primaryKey({ columns: [bundleId, collectionId] })`, FK `cascade` di kedua arah (karena baris junction murni relasi), dan `position INTEGER NOT NULL` + `uniqueIndex(bundleId, position)`.

### H-6 — `taxonomy.ts`: Hierarki tanpa proteksi cycle
**Doubt:** Taxonomy (topic/subtopic) dengan `parent_id` self-FK: tanpa check, Anda bisa membuat `A → B → A` (cycle) → rekursi infinite di query tree/UI breadcrumb → DoS.

**Rekomendasi:** cegah di service (traverse ke root, tolak jika `parent` ada di subtree sendiri) **dan** tambah trigger DB `prevent_cycle` (Postgres function). Parent FK `onDelete: 'restrict'` atau `'set null'` — **jangan** cascade (menghapus topik tidak boleh menghapus anak diam-diam kecuali disepakati).

### H-7 — `system.ts`: Konfigurasi/flag tanpa versi & audit
**Doubt:** Tabel system (config/feature flag) yang di-update langsung dari admin UI tanpa `updated_by` & `version` → perubahan tak terlacak saat insiden.

**Rekomendasi:** tambah `updatedById`, `version INTEGER` (optimistic locking `UPDATE ... WHERE version = :v`), dan simpan histori di `event`.

---

## 4. Temuan Medium 🟡

| ID | File | Temuan | Repro | Fix |
|:--|:--|:--|:--|:--|
| M-1 | `_columns.ts` | `timestamp` disimpan `timestamp with time zone`? Jika `timestamp` tanpa tz → bug lewat DST & server UTC/Asia jarak | simpan dari FE lokal → order salah | pakai `timestamp({ withTimezone: true })` + `defaultNow()` |
| M-2 | `question.ts` | Kolom `content` JSONB tanpa schema zod runtime-divergen | data shape drift, UI crash | validasi zod di write path + `CHECK (jsonb_typeof(content)='object')` |
| M-3 | `media.ts` | `size` integer tapi tidak `CHECK size > 0` | file 0 byte masuk | `CHECK (size > 0 AND size < 20*1024*1024)` |
| M-4 | `event.ts` | `payload` JSONB besar tanpa aturan size → TOAST choke | payload 5MB | tolak > 64KB di service |
| M-5 | `auth.ts` | `email` tidak `citext` → `A@x.com` vs `a@x.com` berbeda | register 2x | `citext` atau `LOWER(email) UNIQUE INDEX` |
| M-6 | `taxonomy.ts` | `slug` tidak unique/partial | slug dup | partial unique + `CHECK slug ~ '^[a-z0-9-]+$'` |
| M-7 | `bundle.ts` | Harga/diskon pakai `real`/`float`? gunakan `NUMERIC(12,2)` | floating error | `numeric({ precision: 12, scale: 2 })` |
| M-8 | semua | Tidak ada `created_at` default di semua tabel (konsistensi) | insert tanpa value → null | paksa helper `timestamps` wajib |
| M-9 | `index.ts` | Barrel export bisa mem-bundle server schema ke client (Next.js) | `pgEnum` di client → crash `pg is not defined` | `import "server-only"` di `index.ts` |

**Catatan M-9 penting:** Di Next.js App Router, bila `src/lib/db/schema/index.ts` diimpor dari komponen client (misal untuk tipe), Drizzle akan menyeret `drizzle-orm/pg-core` ke browser bundle. **Wajib** `import "server-only"` atau pisahkan `schema/types.ts` murni tipe untuk konsumsi client.

---

## 5. Temuan Low / Hardening 🔵

1. **L-1 — Naming konsisten**: pastikan semua FK `xxx_id` di DB = `xxxId` di Drizzle (camelCase). Inkonsistensi memicu bug `undefined` saat `.returning()`.
2. **L-2 — `references` tanpa `onDelete`** = `no action` = error runtime tak terduga. Set eksplisit di **setiap** referensi.
3. **L-3 — Migrasi**: pastikan `drizzle-kit generate` + `migrate` dijalankan dengan **review manual** untuk `ALTER TYPE ADD VALUE` (tidak bisa di-transaksi di PG < 12; PG17 OK, tapi tetap cek lock).
4. **L-4 — Partial index** untuk query yang paling sering: `(status, created_at DESC)` di `question`, `(user_id, created_at)` di `event`.
5. **L-5 — `pgEnum` deprecation**: tambah komentar `-- WARNING: jangan rename value` di header `_enums.ts` (rename = `ALTER TYPE ... RENAME` manual, tidak auto dari Drizzle).
6. **L-6 — Observability**: tambah `db_query_duration` instrumentation di test DB untuk deteksi missing index sebelum prod.

---

## 6. Peta Risiko per File

```
_enums.ts      🔴 C-1   (enum drift)
_columns.ts    🟠 H-1 / 🟡 M-1 / 🟡 M-8
auth.ts        🔴 C-4 / 🟡 M-5
system.ts      🟠 H-7
source.ts      🟠 H-4
question.ts    🔴 C-1 / 🟠 H-2 / 🟡 M-2
media.ts       🔴 C-3 / 🟡 M-3
event.ts       🔴 C-2 / 🟡 M-4
bundle.ts      🟠 H-5 / 🟡 M-7
collection.ts  🟠 H-5
taxonomy.ts    🟠 H-6 / 🟡 M-6
solution.ts    🟠 H-3
index.ts       🟡 M-9
```

---

## 7. Rencana Perbaikan Berurutan (Prioritas)

**Sprint 1 — Critical (blocker rilis)**
1. Derive enum types dari `pgEnum.enumValues` (C-1).
2. `idempotency_key UNIQUE` di `event` + `onConflictDoNothing` di semua handler (C-2).
3. MIME server-side + `media_status` + pembersih orphan (C-3).
4. Rotasi refresh token keluarga + `revokedAt` + indeks (C-4).

**Sprint 2 — High**
5. Partial unique index menggantikan UNIQUE untuk soft-delete (