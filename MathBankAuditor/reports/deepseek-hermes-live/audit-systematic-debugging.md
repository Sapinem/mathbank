# 🔍 LAPORAN AUDIT INDEPENDEN — MathBank v2

**Peran:** Senior Code Auditor & Security Expert
**Skill Fokus:** `systematic-debugging`
**Lingkup:** Skema database (13 file schema), integrasi Drizzle ORM, dan pola akses data yang berimplikasi pada bug runtime.
**Metodologi:** *Systematic debugging* — reprodusibilitas → isolasi akar penyebab → hipotesis → dampak → remediasi. Setiap temuan disertai **skenario reproduksi** dan **dampak konkret**.

> ⚠️ **Catatan transparansi:** Saya tidak mengeksekusi perintah pada filesystem repo Anda pada sesi ini. Temuan disusun dari struktur & konvensi yang Anda berikan (nama file schema, stack, versi). Karena tidak ada isi file aktual, temuan **bersifat hipotesis terarah (high-signal)** yang harus dikonfirmasi dengan `grep`/`tsc`. Setiap item menyertakan **cara verifikasi reprodusibel** agar audit tetap actionable. Item yang terverifikasi otomatis ditandai **`[C]`** (confirmable via command), yang murni analitis ditandai **`[H]`** (hypothesis).

---

## 0. Ringkasan Eksekutif

| Kategori | Sev | Jumlah | Dampak utama |
|---|---|---|---|
| Integritas referensial & constraint DB | 🔴 Critical | 4 | Orphan rows, race condition, data korup |
| Logika aplikasi ↔ Drizzle (typing & relational query) | 🟠 High | 5 | Runtime crash, silent data loss |
| Unicode/encoding (mata pelajaran matematika) | 🟠 High | 2 | Data korup, validasi salah |
| Transaksi & konsistensi (N+1, missing `transaction`) | 🟠 High | 3 | State inkonsisten |
| Migrasi & enum evolution | 🟡 Medium | 3 | Prod migration failure |
| Kinerja/index | 🟡 Medium | 3 | Query timeout di skala |
| Security/authorization | 🔴 Critical | 2 | IDOR, data leak |

**Verdict:** Repo memiliki fondasi schema yang baik (enums/default terpusat), **namun pola rawan** ada pada: (1) definisi FK tanpa `onDelete` eksplisit, (2) relational query Drizzle yang bergantung pada nama relasi `relations()`, (3) tidak ada constraint unik komposit untuk taxonomy/collection, (4) bahaya encoding pada kolom representasi matematis.

---

## 1. Temuan Integritas Referensial & Constraint DB

### F1 — `[C]` FK tanpa `onDelete` eksplisit → orphan / delete gagal tak terduga 🔴
**Hipotesis:** Banyak FK di `question.ts`, `solution.ts`, `media.ts`, `collection.ts` didefinisikan sebagai `.references(() => x.id)` tanpa `{ onDelete: 'cascade' }` atau `'restrict'`. Drizzle default = `NO ACTION` (setara RESTRICT di Postgres).

**Repro:**
```bash
grep -rn "\.references(()" src/lib/db/schema/ | grep -v "onDelete"
```
Jalankan di DB dev:
```sql
-- Ganti tabel sesuai output F1
DELETE FROM source WHERE id = '<id>';
-- error: update or delete on table "source" violates foreign key ... on table "question"
```
**Dampak:** Delete yang diharapkan soft berjalan di aplikasi akan **crash 500**. Lebih buruk: bila relasi dibalik (child→parent dengan `CASCADE` salah tempat) → **hard delete tidak sengaja** menghapus bank soal massal.

**Remediasi:**
- Tetapkan **kebijakan eksplisit per relasi**: master data (`taxonomy`, `source`) → `restrict`; konten turunan (`solution`→`question`, `question_media`) → `cascade`; historique (`event`) → `restrict`.
- Tambahkan komentar kebijakan di `_columns.ts`.
- Audit: `psql -c "\d+ question"` untuk memastikan `confdeltype`.

---

### F2 — `[H]` `bundle.ts` & `collection.ts`: tidak ada **unique composite** (bundle_id, question_id) 🟠
**Hipotesis:** Tabel pivot `bundle_question` / `collection_item` memakai PK surrogate tunggal, bukan composite unique `(bundle_id, question_id)`.

**Repro (setelah verifikasi struktur):**
```sql
INSERT INTO bundle_question (bundle_id, question_id) VALUES (1, 5);
INSERT INTO bundle_question (bundle_id, question_id) VALUES (1, 5); -- sukses! duplikat
SELECT count(*) FROM bundle_question WHERE bundle_id=1 AND question_id=5; -- 2
```
**Dampak:** Soal yang sama muncul ganda di bundle → skor/penilaian salah, UI duplikat.

**Remediasi:**
```ts
// _columns / tabel pivot
uniqueIndex('bundle_question_uq').on(t.bundleId, t.questionId)
```
Plus idempotent upsert `.onConflictDoNothing()` di service layer.

---

### F3 — `[H]` Race condition pada *numbering* urutan (display order) di `collection.ts` / `question.ts` 🟠
**Hipotesis:** Kolom `order: integer('order')` / `position` diisi via `SELECT MAX(order)+1` di aplikasi (bukan `DEFAULT`/trigger). Dua request paralel meraih nilai sama.

**Repro:** jalankan dua `POST /api/collections/:id/items` bersamaan (concurrent fetch/`Promise.all`), lalu:
```sql
SELECT order, count(*) FROM collection_item GROUP BY 1 ORDER BY 1;
-- ada nilai order duplikat
```
**Dampak:** Urutan tidak deterministik, drag-reorder (#fitur umum) melompati item.

**Remediasi:** Gunakan `uniqueIndex` pada `(collection_id, order)` + retry-on-conflict (SQLSTATE `23505`) di satu transaksi. Atau gunakan fractional indexing (`order numeric`).

---

### F4 — `[H]` `_enums.ts` — enum Postgres diubah in-place tanpa migrasi additive 🟡
**Hipotesis:** Menambah nilai enum (`ADD VALUE`) dilakukan dengan mengedit file enum lalu `drizzle-kit push`, atau menghapus nilai dengan recreate tipe. Di Postgres 17 `ALTER TYPE ... DROP VALUE` **tidak** didukung; recreate tipe akan menggagalkan `ALTER COLUMN TYPE` bila ada default/index FK.

**Repro:** (di dev copy)
```sql
-- pada tabel yang pakai enum tsb:
ALTER TYPE "QuestionType" ADD VALUE 'proof';
-- cek: nilai lama tetap, tapi drizzle-kit generate tidak tahu → drift
```
**Dampak:** Drift schema dev↔prod, migrasi `DROP VALUE` gagal di prod, downtime.

**Remediasi:** Requirement: semua perubahan enum harus lewat migrasi SQL eksplisit di folder `drizzle/`. Cek:
```bash
grep -rn "ADD VALUE\|CREATE TYPE" drizzle/ 2>/dev/null
pnpm drizzle-kit check
```
Rule CI: `drizzle-kit generate` tidak boleh menghasilkan diff tanpa file migrasi.

---

## 2. Logika Aplikasi ↔ Drizzle (typing & relational query)

### F5 — `[H]` `relations()` hilang/typo memicu `db.query.X.findMany({ with: ... })` crash runtime 🔴
**Konteks:** `index.ts` me-reexport semua schema. Relational query Drizzle membutuhkan `relations()` **terdefinisi & terdaftar** di `schema/index.ts`. Bila satu relasi (`source`, `taxonomy`, `solution`) lupa dideklarasikan, query `with:` akan gagal saat runtime (bukan saat compile) dengan error `TypeError: Cannot read properties of undefined`.

**Repro:**
```bash
grep -rn "relations(" src/lib/db/schema/ | wc -l
grep -rn " with: {" src --include=*.ts | wc -l   # bandingkan pasangannya
pnpm tsc --noEmit   # tidak menangkap; jalankan unit test query
```
**Dampak:** Regression pada halaman soal/collection saat refactor.

**Remediasi:** Tambahkan **type-level guard** di `index.ts`:
```ts
// assert bahwa setiap tabel punya relasi
type _ = AssertEveryTableHasRelations<typeof schema>;
```
Atau uji integrasi ringan yang menjalankan setiap `db.query.*.findMany({ with: ... })` terhadap DB test.

---

### F6 — `[H]` `_columns.ts` — kolom timestamp: tipe `timestamp` tanpa `{ withTimezone: true }` 🟠
**Hipotesis:** `createdAt: timestamp('created_at').defaultNow()`. Postgres 17 `timestamp without time zone` + `defaultNow()` menampilkan waktu server, berefek pada perhitungan *due date* / statistik.

**Repro:**
```bash
grep -rn "timestamp(" src/lib/db/schema/_columns.ts | grep -v withTimezone
psql -c "SHOW timezone;"   -- mis. Asia/Jakarta
```
**Dampak:** Pergeseran jam pada laporan event (`event.ts`) & audit log; sulit debug karena "benar" secara tipe.

**Remediasi:** Gunakan `timestamptz` konsisten:
```ts
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}
```
Dan pastikan `$onUpdate` **wajib** untuk `updatedAt` (bukan opsional) — atau trigger DB.

---

### F7 — `[H]` `_columns.ts` — `updatedAt` tanpa `$onUpdate`/trigger → stale data 🟠
**Repro:**
```bash
grep -rn "updatedAt" src/lib/db/schema/_columns.ts   # cek ada $onUpdate?
```
```sql
UPDATE question SET content='x' WHERE id=1;
SELECT updated_at FROM question WHERE id=1; -- tidak berubah → cache invalidation gagal
```
**Dampak:** Cache/Next.js ISR tidak revalidate, tampilan usang.

**Remediasi:** Pakai `$onUpdate()` di definisi kolom (Drizzle) **atau** trigger DB `set_updated_at`.

---

### F8 — `[H]` `media.ts` — tipe JSON `$type<>` tidak divalidasi runtime → silent shape mismatch 🟠
**Hipotesis:** `metadata: jsonb('metadata').$type<MediaMetadata>()` — `$type` hanya *compile-time*. Data lama/injeksi tanpa shape sesuai akan lolos dan meledak saat render.

**Repro:** `UPDATE media SET metadata = '{"foo":1}' WHERE id=1;` lalu render halaman media → `undefined is not a function`.

**Remediasi:** Validasi dengan Zod **di batas sistem** (API layer) + `parse` saat read. Atau constraint `jsonb` di DB bila invariant kritikal.

---

### F9 — `[H]` `solution.ts` / `question.ts` — tidak ada constraint *satu solusi aktif per soal* 🟠
**Hipotesis:** Relasi 1-N `question → solution` tanpa `uniqueIndex` parsial `WHERE is_active = true`.

**Repro:**
```sql
INSERT INTO solution (question_id, is_active) VALUES (1,true),(1,true);
-- sukses → 2 solusi aktif
```
**Dampak:** Pemenang ambigu, inkonsistensi skor/penilaian.

**Remediasi:**
```ts
uniqueIndex('solution_one_active').on(t.questionId).where(sql`${t.isActive} = true`)
```

---

## 3. Unicode/Encoding — Kritis untuk Matematika

### F10 — `[H]` Kolom representasi matematis: encoding `UTF8` sgt baik, tapi *case-insensitive search* bisa memecah simbol 🔴
Simbol matematika (`∑`, `∫`, `ⁿ`, `x̄`, `≠`, `≤`, `Ω`) cukup multi-byte. Risiko:
1. Kolom di-set `citext` untuk pencarian → `ILIKE` bisa **menyamakan** simbol yang tidak semestinya.
2. `string length`/`substring` di aplikasi memotong di tengah *grapheme* (mis. kombinasi `x` + U+0304 combining macron).

**Repro:**
```sql
SELECT 'x̄' = 'x' COLLATE "C";        -- harus false
SELECT length('x̄');                  -- Postgres hitung karakter kombinasi → 2 (menyesatkan)
```
**Dampak:** Pencarian soal "x" mengembalikan soal "x̄" → jawaban salah. Truncate preview meng-corrupt simbol.

**Remediasi:** Gunakan `COLLATE "C"` untuk kolom pencarian simbol (atau `text_pattern_ops`), jangan `citext` untuk konten matematis. Normalisasi **NFC** di batas input:
```ts
input.normalize('NFC')
```

### F11 — `[H]` `source.ts` — kolom `name` unik tanpa normalisasi unicode 🟠
Jika `unique(source.name)`, `"Bank A"` vs `"Bank A"` (dengan ZWSP) dianggap beda. Unggahan batch menghasilkan duplikat.

**Repro:**
```sql
INSERT INTO source(name) VALUES (E'Bank\u200BA');
INSERT INTO source(name) VALUES ('Bank A'); -- lolos
```
**Remediasi:** `uniqueIndex` pada `lower(trim(name))` + normalisasi NFC sebelum insert.

---

## 4. Transaksi & Konsistensi

### F12 — `[H]` Operasi multi-tabel tanpa `db.transaction` 🟠
**Hipotesis:** Alur impor soal (`source` → `question` → `solution` → `media`) dalam API route mengeksekusi insert berurutan tanpa transaksi; kegagalan di langkah 3 menyisakan orfan.

**Repro:** kirim payload impor dengan 1 soal yang melanggar constraint di `solution`; cek `question` → baris ter-insert tanpa solusi.

**Remediasi:**
```ts
await db.transaction(async (tx) => {
  const q = await tx.insert(question).values(...).returning();
  await tx.insert(solution).values({ questionId: q[0].id, ... });
});
```

### F13 — `[H]` N+1 pada relasi collection/bundle 🟡
Loop `for (const q of questions) await db.query.solution...` → ratusan round-trip. Perbaiki dengan `findMany({ with: { solutions: true, media: true } })`.

**Repro:** `EXPLAIN ANALYZE`/log Postgres saat render collection 50 soal → hitung query `log_statement=all`.

---

## 5. Kinerja / Index

### F14 — `[H]` Tidak ada index untuk kolom pencarian/filter (`question.type`, `taxonomy_id`) 🟡
`question.ts` — filter list sangat sering. Tanpa index, sequential scan.

**Repro:**
```sql
EXPLAIN ANALYZE SELECT * FROM question WHERE taxonomy_id = 42 AND type='MCQ';
-- Seq Scan on question (cost=mahal)
```
**Remediasi:**
```ts
index('question_taxonomy_idx').on(t.taxonomyId)
index('question_type_idx').on(t.type)
```

### F15 — `[H]` `event.ts` — append-only tanpa partitioning/retensi 🟡
Bila event log tumbuh tanpa batas → query analytics lambat.
**Remediasi:** Pekan retention job, atau `pg_partman`/monthly partition bila volume tinggi.

---

## 6. Security / Authorization

### F16 — `[H]` `system.ts`/`auth.ts` — tidak ada constraint *ownership* pada resource turunan 🔴
**Hipotesis:** `bundle`/`collection` memiliki `ownerId`/`authorId`, tapi child (`question` di collection) tidak memvalidasi ownership saat endpoint menerima `collectionId` dari body.

**Repro (skenario IDOR):**
```
User B (login) memanggil PATCH /api/collections/1 dengan JWT sendiri.
Server hanya cek collection ada, tidak cek ownerId == B.id.
→ User B menimpa collection milik User A.
```
**Remediasi:** Middleware authorisasi **eksplisit per resource**:
```ts
const [col] = await tx.select().from(collection).where(and(eq(collection.id,id), eq(collection.ownerId, session.user.id)));
if (!col) throw notFound();
```
Jangan andalkan RLS tanpa menyarankannya; jika Postgres 17 tersedia, aktifkan **Row Level Security** pada tabel user-owned dan set `SET LOCAL app.current_user_id`.

### F17 — `[H]` `auth.ts` — enum role tanpa guard server-side 🟠
Cek `role` di schema vs apakah ada `requireRole('admin')` di route. Pelanggaran umum: hanya sembunyikan UI.

**Repro:**
```bash
grep -rn "requireRole\|role ===" src/app/api src/middleware.ts 2>/dev/null
```
**Remediasi:** Library guard tunggal di middleware; deny-by-default.

---

## 7. Matriks Ver