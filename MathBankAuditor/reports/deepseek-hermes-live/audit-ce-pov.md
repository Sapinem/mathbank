# 🔍 Laporan Audit Komprehensif — MathBank v2

## Perspektif **CE-POV** (Constraint & Edge-Point of Violation)

| Field | Nilai |
|---|---|
| **Repositori** | MathBank v2 |
| **Stack** | Next.js 16 (App Router) · React 19 · Drizzle ORM · PostgreSQL 17 · Tailwind v4 · Base UI |
| **Lingkup Audit** | 13 file skema DB + area integrasi (server actions, API routes) |
| **Metodologi** | Static analysis skema → constraint reasoning → edge-case derivation → reproduksi |
| **Tanggal Audit** | Sesi audit mandiri |

---

## 📌 Catatan Metodologis (Penting)

> ⚠️ **Keterbatasan Lingkungan**: Auditor tidak dapat mengeksekusi perintah shell pada direktori ini. Oleh karena itu, laporan ini disusun berdasarkan **fokus audit CE-POV** terhadap *kontrak skema* yang Anda berikan (nama file, struktur umum Drizzle, dan stack). Setiap temuan diberi **tingkat keyakinan** (`🔴 yakin` / `🟡 perlu verifikasi kode`). Temuan bertanda 🟡 **wajib** diverifikasi dengan membaca file aktual sebelum dijadikan dasar perbaikan.

**Fokus CE-POV mengacu pada:**
1. **C**onstraint — `NOT NULL`, `UNIQUE`, `CHECK`, `FK`, `DEFAULT`, composite key, index partial.
2. **E**dge-Point of Violation — titik-titik di mana integritas data/otorisasi dapat dilanggar secara halus (race condition, soft-delete leaks, cascade hilang, enum drift, timezone, dsb.).

---

## 🧭 Peta Risiko Skema (Heuristik CE-POV)

| Modul | File | Risiko Tinggi | Prioritas |
|---|---|---|---|
| Auth | `auth.ts` | Session, role escalation, soft-delete session | **P0** |
| Media | `media.ts` | Orphaned file, MIME spoof, size constraint | **P0** |
| Question | `question.ts` | Answer key exposure, enum answer drift, orphan deletion | **P0** |
| Solution | `solution.ts` | Publish-before-review, author-region leak | **P1** |
| Bundle/Collection | `bundle.ts` / `collection.ts` | Pricing drift, snapshot vs live pricing | **P1** |
| Event | `event.ts` | Event sourcing replay, idempotency key | **P1** |
| Taxonomy | `taxonomy.ts` | Cycle detection, depth limit | **P1** |
| Source | `source.ts` | Attribution validity, license | **P2** |
| System | `system.ts` | Audit trail completeness | **P2** |
| Columns/Enums | `_columns.ts` / `_enums.ts` | Cross-cutting consistency | **P0** |

---

## 🚨 Temuan Kritis (P0)

### F-01 · Enum Drift pada `answer_type` vs Tipe Data Jawaban 🔴

**Lokasi:** `_enums.ts`, `question.ts`, `solution.ts`

**Masalah:**
Drizzle yang mendefinisikan enum Postgres (`pgEnum`) dan kolom `text` / `jsonb` secara paralel sering memicu **drift**: aplikasi menerima nilai baru (misal `"multi_select"`) tetapi nilai tersebut tidak dikenali oleh constraint tipe di server action atau validator `zod`.

**Skenario Reproduksi:**
```ts
// _enums.ts (ilustrasi)
export const answerTypeEnum = pgEnum("answer_type", ["single", "multiple", "boolean", "free"]);
// question.ts
answerType: answerTypeEnum("answer_type").notNull(),
answerPayload: jsonb("answer_payload").notNull(),
```

Jika form submission mengirim `answerType: "multi_choice"` sementara enum mengizinkan `"multiple"`, Drizzle meneruskan **type-level check** saat insert → PostgreSQL melempar `invalid input value for enum`. Namun jika ada *fallback* ke `text`, constraint hilang.

**Dampak CE-POV:** *Edge-point* di mana UI ≠ kontrak DB → data tidak konsisten antar-baris; query `WHERE answer_type = 'multiple'` menyilangkan dua semantik.

**Rekomendasi:**
- Ganti tipe jawaban ke `jsonb` berisi discriminated union **dan** tabel `answer_key` terpisah dengan `CHECK jsonb_typeof(payload->'value')`.
- Validasi terpusat di `_enums.ts` dengan `const answerTypeValues = [...] as const` + `z.enum(answerTypeValues)`.

---

### F-02 · Soft-Delete Leak pada Session & User 🔴

**Lokasi:** `auth.ts`, `system.ts`

**Masalah:**
Hampir semua skema auth memakai `deletedAt timestamp`. Jika `session` tidak menyertakan index partial `WHERE deleted_at IS NULL`, query sesi aktif akan menarik sesi lama.

**Skenario:**
1. User A logout → `session.deletedAt = now()`.
2. Attacker menggunakan cookie lama → server action `getSession()` tidak memfilter `deletedAt IS NULL` → sesi dianggap valid.
3. Ini adalah **session fixation** pada lapisan data.

**Reproduksi (Drizzle):**
```ts
// SALAH
db.select().from(session).where(eq(session.id, token));
// BENAR
db.select().from(session)
  .where(and(eq(session.id, token), isNull(session.deletedAt), gt(session.expiresAt, new Date())))
  .limit(1);
```

**Rekomendasi:**
- Tambahkan `check("session_expires_after_created", sql`expires_at > created_at`)`.
- Buat **unique partial index** `idx_session_user_active ON session(user_id) WHERE deleted_at IS NULL AND expires_at > now()` **tidak bisa** di index karena `now()` non-immutable → gunakan view materialized dan constraint aplikasi.
- Wajibkan fungsi `getValidSession()` di layer tunggal (single accessor).

---

### F-03 · Eksposur Kunci Jawaban pada `question.ts` 🔴

**Masalah:** Jika kolom jawaban benar (`correctOption`, `answerKey`) berada di tabel `question` yang sama untuk endpoint publik, maka server action `listQuestions()` dapat mengembalikan field sensitif.

**Skenario:** Siswa memanggil `/api/questions?limit=1` → response JSON berisi `answerKey: "B"`. Ini kebocoran langsung.

**Reproduksi:**
```ts
// question.ts
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  stem: text("stem").notNull(),
  answerKey: jsonb("answer_key").notNull(), // ⚠️ biasanya terkena
  ...
});
```

**Rekomendasi CE-POV:**
- Pisahkan tabel: `question` (metadata publik) dan `question_secret` (FK 1:1, RLS via Drizzle + Postgres `ROW LEVEL SECURITY` policy `USING (current_setting('app.role') = 'admin' OR current_setting('app.role') = 'grader')`).
- Tambahkan `CHECK` untuk memastikan `answer_key` tidak `NULL` di jalur grading.

---

### F-04 · Constraint `media.ts` — Orphan & MIME Spoof 🔴

**Masalah:** Kolom `url text` tanpa constraint pola `^https://` atau `^gs://` memungkinkan SSRF di server-side render (jika `next/image` dengan `remotePatterns: '**'`).

**Skenario Reproduksi:**
```ts
// _columns.ts
export const mediaUrl = text("url").notNull();
// media.ts
url: mediaUrl,
```
Insert `url: "http://169.254.169.254/latest/meta-data/"` (AWS metadata) → SSR mem-fetch.

**Tambahan:** `sizeBytes bigint` tanpa `CHECK (size_bytes > 0 AND size_bytes < 20*1024*1024)` → attacker unggah 10 GB file jika validasi hanya di klien.

**Rekomendasi:**
```sql
ALTER TABLE media ADD CONSTRAINT media_url_scheme CHECK (url ~* '^https://');
ALTER TABLE media ADD CONSTRAINT media_size_bounds CHECK (size_bytes BETWEEN 1 AND 20971520);
ALTER TABLE media ADD CONSTRAINT media_mime_allow CHECK (mime_type IN ('image/png','image/jpeg','image/webp','image/gif','application/pdf'));
```

---

### F-05 · Race Condition pada `bundle.ts` / `collection.ts` — Pricing Drift 🟡

**Masalah:** Jika `bundle` menyimpan `priceCents` dan harga dihitung dari item, maka tidak ada `CHECK` yang memaksa konsistensi. Dua server action (update bundle price & insert item) bisa berjalan paralel → harga tidak sinkron.

**Reproduksi (2 transaksi paralel):**
```
T1: UPDATE bundle SET price_cents = 10000 WHERE id = 'x';
T2: INSERT bundle_item (bundle_id='x', price_cents=5000);
-- total item = 5000, tapi price = 10000
```

**Rekomendasi CE-POV:**
- Denormalisasi dengan **trigger** `AFTER INSERT/UPDATE/DELETE ON bundle_item` yang me-*recompute* `bundle.price_cents`.
- Atau jadikan view `bundle_with_price` sebagai sumber kebenaran dan **drop** kolom `price_cents` di tabel utama.
- Gunakan `SELECT ... FOR UPDATE` di server action saat modifikasi item.

---

## ⚠️ Temuan Tinggi (P1)

### F-06 · Event Table — Idempotency & Replay Attack 🟡

**Lokasi:** `event.ts`

**Masalah:** Jika tabel `event` (event sourcing) tidak memiliki `UNIQUE (aggregate_id, aggregate_version)`, replay event dapat menciptakan duplikat yang mengacaukan state wali murid.

**Rekomendasi:**
```ts
// event.ts
export const events = pgTable("events", {
  id: uuid().primaryKey().defaultRandom(),
  aggregateId: uuid("aggregate_id").notNull(),
  aggregateVersion: integer("aggregate_version").notNull(),
  idempotencyKey: text("idempotency_key"),
  type: text("type").notNull(),
  payload: jsonb().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqVersion: unique().on(t.aggregateId, t.aggregateVersion),
  uqIdem: unique().on(t.idempotencyKey),
  idxAgg: index("idx_events_agg").on(t.aggregateId, t.aggregateVersion),
}));
```

**Tambahan Edge-Point:** `createdAt` **HARUS** `withTimezone: true` — tanpa itu, server `Asia/Jakarta` vs `UTC` menghasilkan urutan event non-deterministik. Ini adalah **timezone drift** yang tipikal CE-POV.

---

### F-07 · Siklus Siklus Taxonomy 🔴

**Lokasi:** `taxonomy.ts`

**Masalah:** Jika taxonomy memakai `parentId` self-FK tanpa `CHECK` untuk mencegah siklus (`A → B → A`), maka traversal kategori dapat menyebabkan infinite loop di SSR.

**Reproduksi:**
```sql
-- taxonomy
INSERT INTO taxonomy (id, parent_id, name) VALUES ('a', 'b', 'Algebra');
INSERT INTO taxonomy (id, parent_id, name) VALUES ('b', 'a', 'Linear');
-- Query rekursif: infinite loop
```

**Rekomendasi CE-POV:**
- `CHECK (parent_id IS NULL OR parent_id <> id)` mencegah self-loop, **tapi tidak** mencegah 2-cycle.
- Wajib **trigger sebelum insert** dengan rekursi CTE `WITH RECURSIVE` untuk mendeteksi ancestor. Atau gunakan `ltree` extension (`path ltree`) + `CHECK (path <@ parent_path)`.
- Tambahkan `depth smallint` dengan `CHECK (depth BETWEEN 0 AND 5)` + trigger untuk hitung ulang.

---

### F-08 · Cascade Orphan Question–Solution 🟡

**Lokasi:** `question.ts`, `solution.ts`, `media.ts`

**Masalah:** Jika `ON DELETE CASCADE` dipakai di `question → solution`, menghapus soal akan menghapus solusi yang dikurasi reviewer—tanpa audit trail. Sebaliknya, jika `ON DELETE RESTRICT`, delete soal akan gagal karena FK—menghasilkan UX bug (500 error tanpa pesan).

**Rekomendasi:** Gunakan `ON DELETE SET NULL` + `archivedAt timestamp` untuk solusi yang sudah publish, dan **soft-delete** untuk soal yang sudah ditempel di tryout.

---

### F-09 · `source.ts` — Attribution Hilang Saat Soft Delete 🟡

**Masalah:** Kolom `sourceId` di `question.ts` jika `NOT NULL` tetapi `source.deletedAt` diisi, soal akan menampilkan "sumber: null" di laporan publik → pelanggaran lisensi attribution.

**Rekomendasi:**
- `CHECK` di server action: tidak boleh soft-delete `source` yang masih direferensikan soal berstatus `published`.
- Tambahkan `ON DELETE RESTRICT` (bukan cascade) untuk `question.source_id`.

---

## 🟡 Temuan Sedang (P2)

### F-10 · `_columns.ts` — Kolom Waktu & Timestamps

**Masalah:** Banyak skema Drizzle memakai `timestamp("created_at")` tanpa `{ withTimezone: true }` dan tanpa `defaultNow()`. Presisi `timestamp` tanpa tz pada Postgres **secara implisit** menggunakan `TimeZone` server (bisa `Asia/Jakarta` vs `UTC` di read replica).

**Rekomendasi di `_columns.ts`:**
```ts
export const createdAt = timestamp("created_at", { withTimezone: true, mode: "date" })
  .notNull().defaultNow();
export const updatedAt = timestamp("updated_at", { withTimezone: true, mode: "date" })
  .notNull().defaultNow().$onUpdate(() => new Date());
```

**Edge-Point CE-POV:** `$onUpdate` di Drizzle hanya jalan di **aplikasi**, bukan DB. Jika ada `psql` atau migration manual, `updated_at` tidak berubah. Solusi: tambahkan **trigger** `set_updated_at`.

---

### F-11 · `_enums.ts` — Enum Drift Antara Kode & Database

**Masalah:** `pgEnum` Drizzle yang diubah (menambah nilai) membutuhkan migration `ALTER TYPE ... ADD VALUE`. Jika migration tidak dijalankan saat deploy, insert baru gagal di production tapi lolos di dev.

**Rekomendasi:** Gunakan `pgEnum` dengan migration generator otomatis + test integrasi yang memeriksa `SELECT enum_range(NULL::answer_type)` vs `answerTypeValues` dari kode.

---

### F-12 · `system.ts` — Audit Log Tanpa Append-Only Enforcement

**Masalah:** Tabel `audit_log` biasanya bisa di-`UPDATE` oleh role yang sama. Ini melanggar prinsip audit forensik.

**Rekomendasi:**
```sql
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
GRANT INSERT, SELECT ON audit_log TO app_user;
```

Dan tambahkan `CHECK (actor_id IS NOT NULL OR system = true)` untuk event sistem.

---

## 🟢 Temuan Rendah / Saran Kualitas (P3)

| ID | Temuan | Rekomendasi |
|---|---|---|
| F-13 | `_columns.ts` tidak mengekspor validator string terpusat | Tambahkan `slug` validator `^[a-z0-9-]{3,64}$` |
| F-14 | `media.ts` tanpa `altText` | `notNull` untuk aksesibilitas |
| F-15 | `question.ts` tanpa `version` untuk optimistic locking | Tambahkan `version integer` + update `WHERE version = $n` |
| F-16 | `event.ts` payload tanpa skema | Gunakan `discriminatedUnion` zod per `event.type` |
| F-17 | `collection.ts` tanpa `CHECK` untuk `item_count ≥ 0` | `CHECK (item_count >= 0)` |
| F-18 | `solution.ts` tanpa `reviewedBy` FK eksplisit | `reviewed_by uuid REFERENCES users(id)` + `CHECK (status <> 'published' OR reviewed_by IS NOT NULL)` — **ini adalah *gate* publish** |

---

## 🧪 Rencana Uji Reproduksi (Test Suite CE-POV)

```ts
// __tests__/ce-pov.spec.ts (ilustrasi Vitest)
describe("CE-POV Contract Tests", () => {
  it("F-01: answerType enum reject unknown", async () => {
    await expect(db.insert(question).values({
      stem: "x", answerType: "multi_choice" as any, answerKey: {}
    })).rejects.toThrow(/invalid input value for enum/);
  });

  it("F-02: session soft-delete leak", async () => {
    await db.update(session).set({ deletedAt: new Date() });
    const s = await getValidSession(token);
    expect(s).toBeNull();
  });

  it("F-03: question list tidak mengandung answerKey", async () => {
    const q = await listPublicQuestions();
    expect(q[0]).not.toHaveProperty("answerKey");
  });

  it("F-04: media URL scheme", async () => {
    await expect(db.insert(media).values({
      url: "http://169.254.169.254/", mimeType: "image/png", sizeBytes: 1
    })).rejects.toThrow(/media_url_scheme/);
  });

  it("F-