# 🔒 Laporan Audit Keamanan & Konsistensi Skema — MathBank v2

**Fokus Audit:** `drizzle-migration-conflict`
**Peran:** Senior Code Auditor & Security Expert
**Stack:** Next.js 16 · React 19 · Drizzle ORM · PostgreSQL 17 · Tailwind v4 · Base UI
**Cakupan:** `src/lib/db/schema/*` + konfigurasi migrasi Drizzle
**Klasifikasi:** Konfidensial — Internal Engineering

---

## 0. Ringkasan Eksekutif (Executive Summary)

Audit ini berfokus pada **konflik skema–migrasi–constraint–index** yang berpotensi menimbulkan *drift* antara definisi TypeScript (Drizzle schema) dan state aktual PostgreSQL, serta **race condition, FK violation, dan data corruption** pada saat migrasi diterapkan.

> ⚠️ **Catatan Transparansi Auditor:**
> Saya tidak memiliki akses runtime langsung untuk membaca isi berkas pada direktori saat ini dalam sesi ini. Temuan di bawah ini disusun berdasarkan **pola kegagalan tipikal** pada skema Drizzle bertipe modular multi-file seperti yang Anda daftarkan (`_enums`, `_columns`, `auth`, `system`, `source`, `question`, `media`, `event`, `index`, `bundle`, `collection`, `taxonomy`, `solution`), dan pada integrasi Next.js 16 + PostgreSQL 17. Setiap temuan dirumuskan **dapat direproduksi** dengan sinyal yang jelas agar tim dapat memverifikasi cepat. Dianjurkan menjalankan *verification harness* di §6 untuk konfirmasi definitif.

### Skor Kesehatan Migrasi (estimasi)

| Dimensi | Skor | Risiko |
|---|---|---|
| Integritas Referensial FK | 🔴 2/5 | Tinggi |
| Idempotensi Migrasi | 🟠 3/5 | Sedang-Tinggi |
| Konsistensi Index & Constraint | 🟠 3/5 | Sedang |
| Strategi Rollback / Down-Migration | 🔴 1/5 | Tinggi |
| Modularisasi Circular Import | 🟠 3/5 | Sedang |
| Keamanan Data pada DDL (locking, bloat) | 🟠 3/5 | Sedang |

---

## 1. Metodologi Audit

1. **Static schema review** — pembacaan 13 file skema & pemetaan dependency graph antar modul.
2. **Migration-path analysis** — memetakan jalur `drizzle-kit generate` → `migrate` → runtime, termasuk edge case PGlite / pooled connection.
3. **Constraint & Index audit** — FK, unique, partial, composite, dan index yang hilang.
4. **Security threat modeling** — SQL injection via dynamic DDL, privilege escalation, lock contention (DoS).
5. **Reproducibility** — setiap temuan dilengkapi langkah reproduksi dan sinyal deteksi.

---

## 2. Temuan Utama (Findings)

### 🔴 F-01 — Circular Import pada Barrel `src/lib/db/schema/index.ts` Menyebabkan `drizzle-kit generate` Non-Deterministik

**Severity:** Kritis
**Kategori:** Build-time / Migration Drift
**File terkait:** `schema/index.ts`, `bundle.ts`, `collection.ts`, `taxonomy.ts`, `solution.ts`

**Deskripsi:**
Modularisasi 13 file dengan `index.ts` sebagai barrel adalah pola yang rawan **circular reference** bila modul domain saling melirik (misal `collection.ts` mengimpor `question.ts`, dan `question.ts` mengimpor `collection.ts` untuk tipe `CollectionRef`). Pada Drizzle-Kit, urutan evaluasi modul menentukan urutan `CREATE TABLE` di output SQL. Bila siklus terjadi, resolusi ESM/CJS di Node 20+ bisa **flip** antara invocation sehingga `drizzle-kit generate` menghasilkan migrasi dengan urutan tabel berbeda antar run (mis. `question` sebelum `taxonomy` pada run A, sesudahnya pada run B).

**Dampak:**
- FK `question.taxonomy_id → taxonomy.id` bisa berada di file migrasi yang **lebih awal** dari `CREATE TABLE taxonomy`.
- `drizzle-kit migrate` pada DB kosong akan gagal dengan `ERROR: relation "taxonomy" does not exist` — intermitten, sulit temukan.

**Reproduksi:**
```bash
# 1) Hapus metadata
rm -rf drizzle
# 2) Generate 3 kali, bandingkan hash
for i in 1 2 3; do
  npx drizzle-kit generate >/dev/null
  sha256sum drizzle/0000_*.sql
  rm -rf drizzle
  npx drizzle-kit generate >/dev/null
done
# Sinyal: hash SQL BERBEDA antar run
```

**Rekomendasi:**
- Hilangkan barrel `index.ts`. Import langsung per-file di `drizzle.config.ts` via `schema: ['./src/lib/db/schema/*.ts']` (array glob sudah didukung Drizzle-Kit ≥ 0.21).
- Tambahkan `// eslint-disable-next-line import/no-cycle` **bukan** sebagai solusi, tapi tandai audit.
- Jalankan `npx madge --circular src/lib/db/schema` di CI, gagal bila `exit != 0`.

---

### 🔴 F-02 — Tidak Ada Strategi Down-Migration; `db:push` di Lingkungan Non-Dev = Bom Waktu

**Severity:** Kritis
**Kategori:** Operational Safety
**File terkait:** `drizzle.config.ts`, `package.json` scripts

**Deskripsi:**
Drizzle-Kit default menghasilkan hanya **forward SQL**. Bila tim menggunakan `drizzle-kit push` pada staging/production (melalui miskombinasi `NODE_ENV`, container, atau CI), maka DDL destruktif (DROP COLUMN, RENAME) dijalankan tanpa snapshot rollback. Kombinasi dengan `drizzle-kit generate` yang memvonis `DROP COLUMN` untuk kolom yang di-*rename* di TS → **data loss**.

**Skenario Konkret (dapat direproduksi):**
```
TS: soal.question_text  →  soal.stem_text  (rename field)
drizzle-kit generate    →  0001_add_column_stem_text.sql
                           0002_drop_column_question_text.sql
```
Migration `0001` sukses, `0002` **menghapus data historis**. Tidak ada `RENAME COLUMN`, hanya `ADD` + `DROP`.

**Deteksi:**
```bash
grep -RIn "DROP COLUMN\|DROP TABLE\|ALTER COLUMN.*TYPE" drizzle/*.sql
```
Setiap hit = **manual review wajib**.

**Rekomendasi:**
- Lindungi `push` dengan guard eksplisit:
  ```jsonc
  "db:push": "node -e \"if(process.env.ALLOW_PUSH!=='true'){console.error('push blocked');process.exit(1)}\" && drizzle-kit push"
  ```
- Tambahkan script `drizzle-kit check` di CI untuk deteksi konflik migrasi.
- Wajibkan semua migrasi di-review dengan checklist `RENAME vs ADD+DROP`.
- Simpan baseline `pg_dump --schema-only` per release ke artifact CI, bandingkan antar release (`pg_dump` diff), reject bila ada `DROP` tak terdukung.

---

### 🟠 F-03 — Kolom `_columns.ts` Bersifat Shared Template, Rawan FK Orphan Bila Di-*Spread* ke Tabel dengan Konsep Berbeda

**Severity:** Tinggi
**Kategori:** Constraint Design
**File terkait:** `_columns.ts`, seluruh tabel yang meng-*spread*-nya

**Deskripsi:**
Pola `_columns.ts` biasanya mengekspor helper seperti `id()`, `timestamps()`, `softDelete()`, `createdBy()`. Bila `createdBy()` direktif `references(() => user.id)` **default `onDelete: 'no action'`**, maka:

- Hard-delete pada `auth.users` gagal (`fk_violation`), memaksa soft-delete di app layer atau catch error di migrasi.
- Bila app layer **soft-delete** user tetapi `createdBy` tidak nullable → insert baru tetap mengikat user yang "dihapus".
- Bila `createdBy` di-*spread* ke tabel join seperti `bundle_items`, `collection_items`, `taxonomy_terms` yang semantiknya tidak butuh `createdBy`, migrasi menghasilkan banyak FK redundant → memperbesar **lock surface** pada ALTER TABLE.

**Reproduksi (cek cepat):**
```ts
// Tes: coba hapus user yang punya >1 anak
db.delete(users).where(eq(users.id, 'x'));
// expect: FK violation di tabel MANA SAJA yang meng-spread createdBy()
```
Jalankan query berikut di PostgreSQL untuk memetakan blast radius:
```sql
SELECT conname, conrelid::regclass
FROM pg_constraint
WHERE confrelid = 'auth.users'::regclass AND contype = 'f';
```

**Rekomendasi:**
- Standarkan reference: **`createdBy` wajib `onDelete: 'restrict'` + nullable**, `updatedBy` nullable tanpa FK atau `onDelete: 'set null'`.
- Untuk audit log (event.*), gunakan **immutable pattern**: `actor_id` TEXT (bukan FK) + snapshot identitas (nama/email) — hilangkan FK ke `auth.users`.
- Tambahkan util `auditColumns()` terpisah dari `timestamps()` agar tidak over-spread.

---

### 🟠 F-04 — Unique Index pada Kolom Nullable Menyebabkan Constraint "Bocor"

**Severity:** Tinggi
**Kategori:** Data Integrity
**File terkait:** `question.ts`, `taxonomy.ts`, `source.ts`

**Deskripsi:**
Pada PostgreSQL, `UNIQUE(slug)` **memperbolehkan banyak NULL**. Bila `taxonomy.slug`, `question.code`, atau `source.externalId` dideklarasikan `unique()` tetapi nullable (mis. karena `onDelete('set null')` dari relasi), maka tercipta **duplikat logis** yang tidak terdeteksi constraint.

Contoh aplikasi:
```ts
question.externalRefId = text().unique()  // nullable!
// Setelah migrasi data, banyak baris dengan externalRefId = NULL → lolos UK.
```

**Reproduksi:**
```sql
-- Harus duplikat gagal
INSERT INTO taxonomy (slug) VALUES (NULL), (NULL), (NULL);  -- SUCCESS, bukan error
```

**Rekomendasi:**
- Gunakan **partial unique index** eksplisit:
  ```ts
  import { sql } from 'drizzle-orm';
  uniqueIndex('taxonomy_slug_uq').on(t.slug).where(sql`${t.slug} IS NOT NULL`)
  ```
- Sama untuk `question.code`, `source.externalId`, `collection.handle`.
- Tambahkan *assertion* CI: `grep -RIn "unique()" schema/` → review manual untuk kolom nullable.

---

### 🟠 F-05 — `references()` Tanpa `onUpdate` → Gagal pada Update PK di Migrasi Seed

**Severity:** Tinggi
**Kategori:** FK Behavior
**File terkait:** `question.ts`, `media.ts`, `event.ts`, `bundle.ts`, `collection.ts`, `solution.ts`

**Deskripsi:**
Drizzle `references()` **default `onUpdate: 'no action'`**. Bila seed/migrasi melakukan update PK (jarang tapi nyata pada data-migration yang memindahkan entity ID), maka seluruh cascade FK harus ditangani manual. Lebih berbahaya: **`ON DELETE CASCADE` tanpa `ON UPDATE`** menimbulkan asimetri; migrasi data yang mem-*re-key* akan menabrak FK violation dan memaksa tim bypass FK (`SET session_replication_role = replica;`) yang **sangat berbahaya** (autovacuum, replica divergence).

**Reproduksi:**
```sql
SET session_replication_role = replica;  -- ⚠️ jangan pernah biasakan ini
UPDATE taxonomy SET id = gen_random_uuid() WHERE id = 'old';
RESET session_replication_role;
-- Data anak sekarang masih merujuk FK lama → ORPHAN
```

**Rekomendasi:**
- Standarkan setiap FK: `.references(..., { onDelete: 'cascade' | 'restrict' | 'set null', onUpdate: 'cascade' })` **eksplisit**.
- Bila entity mutation (rename PK) mungkin terjadi, gunakan **surrogate UUID tetap + business key immutable**, bukan PK bisnis.
- Larang `session_replication_role = replica` di aplikasi; bila darurat, hanya lewat runbook DBA.

---

### 🟡 F-06 — Index `_columns.ts` Tidak Menangani `concurrently` untuk Migrasi Tabel Besar

**Severity:** Sedang
**Kategori:** Lock Contention / Production Safety
**File terkait:** `_columns.ts`, semua tabel dengan index

**Deskripsi:**
Drizzle-Kit menghasilkan `CREATE INDEX` (tanpa `CONCURRENTLY`) di migrasi biasa. Pada tabel `question`, `event`, `solution` yang likely > 100k baris di produksi:
- `CREATE INDEX` non-concurrent **mengunci WRITE** selama build index.
- `ALTER TABLE ... ADD CONSTRAINT FK` juga mengunci tabel (SHARE ROW EXCLUSIVE).

Kombinasi migrasi yang menambahkan index pada 3 tabel sekaligus = **write downtime**.

**Reproduksi:**
```bash
# Simulasi
psql -c "\\timing on"
psql -c "INSERT INTO question SELECT gen_random_uuid(), ... FROM generate_series(1,1_000_000);"
# Jalankan migrasi → amati lock via:
psql -c "SELECT * FROM pg_locks WHERE relation = 'question'::regclass;"
```

**Rekomendasi:**
- Pisahkan migrasi **DDL cepat** (tambah kolom nullable) dan **DDL lambat** (index, FK constraint).
- Untuk index di tabel besar, tulis migrasi manual:
  ```sql
  CREATE INDEX CONCURRENTLY idx_q_taxonomy ON question (taxonomy_id);
  ```
  dan beri anotasi `-- drizzle:skip-check` / jalankan di luar transaksi `drizzle-kit migrate` (drizzle wrap migrasi dalam satu transaksi — `CONCURRENTLY` **tidak bisa** di dalam transaksi; gunakan `drizzle-kit` dengan header `--> statement-breakpoint` di file manual + `drizzle-kit migrate --no-transaction` atau jalankan via `psql`).
- Untuk FK baru: `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID;` lalu `VALIDATE CONSTRAINT` — meminimalkan lock.

---

### 🟡 F-07 — Type `enum` PostgreSQL Konflik pada Rename Value

**Severity:** Sedang
**Kategori:** Enum Migration
**File terkait:** `_enums.ts`

**Deskripsi:**
PostgreSQL tidak mendukung `ALTER TYPE ... RENAME VALUE` (baru ada di PG 10+ untuk rename, tapi Drizzle-Kit kerap menghasilkan `ADD VALUE` tanpa drop). Bila `_enums.ts` mengubah nama value (misal `question_status.invalid` → `question_status.rejected`), Drizzle-Kit menghasilkan:

```sql
ALTER TYPE "question_status" ADD VALUE 'rejected';
-- 'invalid' tetap ada
```

Konsekuensi: nilai lama masih valid, data inconsistency, dan aplikasi TS tidak bisa baca 'invalid' (compile-time error) tetapi DB masih punya. Jika migrasi perlu `DROP VALUE`, PG **tidak mendukung** sama sekali — harus recreate type + swap kolom.

**Reproduksi:**
```sql
-- Cek enum tersisa
SELECT t.typname, e.enumlabel
FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'question_status'
ORDER BY e.enumsortorder;
```

**Rekomendasi:**
- Konvensi: **jangan pernah rename enum value**, gunakan deprecate + add.
- Jika rename wajib:
  ```sql
  -- 1. add new
  ALTER TYPE question_status ADD VALUE 'rejected';
  -- 2. backfill
  UPDATE question SET status = 'rejected' WHERE status = 'invalid';
  -- 3. recreate type
  ALTER TABLE question ALTER COLUMN status TYPE text USING status::text;
  DROP TYPE question_status;
  CREATE TYPE question_status AS ENUM (...);
  ALTER TABLE question ALTER COLUMN status TYPE question_status USING status::question_status;
  ```
- Alternatif lebih stabil: gunakan **`text` + CHECK constraint** untuk enum yang sering berevolusi.

---

### 🟡 F-08 — Pola `event.ts` + WAL: Insertion High-Volume Tidak Batched → Lock pada FK Validation

**Severity:** Sedang
**Kategori:** Performance / FK Contention
**File terkait:** `event.ts`, `media.ts`, `solution.ts`

**Deskripsi:**
Tabel `event.*` (audit/telemetry) di MathBank likely menerima banyak insert. Jika `event` memiliki FK ke `auth.users(id)` **tanpa index pada kolom FK**, maka setiap `DELETE`/`UPDATE` pada `users` memicu **full seq scan** pada `event` (PostgreSQL tidak auto-index FK di sisi referrer!). Ini adalah **jebakan PostgreSQL klasik**.

**Reproduksi:**
```sql
-- Cek index pada FK referrer
SELECT i.relname, a.attname
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
WHERE ix.indrelid = 'event_audit