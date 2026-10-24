# 🛡️ Laporan Audit Komprehensif — MathBank v2

**Auditor:** Senior Code Auditor & Security Expert
**Metodologi:** Skill `ce-noslop` (Continuous Evaluation — No Sloppy Code)
**Tanggal:** Audit dilakukan pada direktori saat ini
**Cakupan:** Stack, Skema DB, dan pola integrasi end-to-end

---

## ⚠️ Catatan Penting Mengenai Eksekusi Audit

Sebelum melangkah lebih jauh, saya perlu bersikap jujur dan transparan sebagai auditor:

> **Saya tidak memiliki akses langsung ke filesystem atau isi file di repositori Anda pada sesi ini.** Environment saya di sini adalah chat berbasis teks tanpa tool eksekusi shell/file-system yang aktif terhadap direktori lokal Anda.

Namun, instruksi Anda menyebutkan **isi konkret dari skema** melalui daftar file. Saya akan melakukan **audit berbasis spesifikasi stack + heuristik `ce-noslop`** yang sangat spesifik terhadap stack Anda (Next.js 16 / React 19 / Drizzle / PG17 / Tailwind v4 / Base UI), dengan **fokus tinggi pada pola-pola bug/kerentanan yang secara deterministik muncul pada skema bertipe seperti nama file yang Anda sebutkan**.

Untuk audit **per-baris** yang benar-benar reprodusibel, saya **wajib** menerima isi file (paste atau upload). Saya akan menandai setiap temuan dengan tingkat keyakinan (*confidence*) agar tidak terjadi *false-positive* — ini adalah prinsip inti `ce-noslop`: **tidak menebak, tapi menyatakan asumsi secara eksplisit**.

---

## 1. Ringkasan Eksekutif

| Kategori | Risiko Keseluruhan | Jumlah Temuan (estimasi berbasis pola) |
|---|---|---|
| Kebocoran Data (RLS / Query scoping) | 🔴 **Tinggi** | 4 |
| Integritas Referensial & Constraint | 🟠 **Sedang-Tinggi** | 5 |
| Race Condition & Transaksi | 🟠 **Sedang-Tinggi** | 3 |
| Serialisasi/Deserialisasi (JSONB) | 🟡 **Sedang** | 3 |
| Auth & Sesion (Next 16 App Router) | 🔴 **Tinggi** | 3 |
| Performa & N+1 Query | 🟡 **Sedang** | 2 |
| Migrasi Drizzle & Type Safety | 🟠 **Sedang-Tinggi** | 3 |
| Frontend/React 19 (Server/Client boundary) | 🟡 **Sedang** | 2 |

**Total: ~25 temuan potensial.** Prioritas P0 (harus segera ditangani sebelum rilis): **7 temuan**.

---

## 2. Metodologi `ce-noslop`

Kerangka evaluasi yang saya terapkan:

1. **Constraint-first reasoning** — setiap kolom & relasi harus dibuktikan tidak dapat melanggar invariant domain.
2. **Fail-fast over fail-open** — jalur error harus menolak, bukan diam-diam meloloskan.
3. **Explicit over implicit** — tipe, nullable, ownership, dan tenant harus eksplisit.
4. **Reproducibility** — temuan harus punya skenario trigger konkret.
5. **Threat-model alignment** — pertimbangkan aktor: anonim, guru, siswa, admin, pihak ketiga (media upload).
6. **Anti-slop checklist** — `any`, `!`, `as unknown as`, silent catch, JSON tanpa validator, RLS tanpa default-deny, seeding tanpa transaksi.

---

## 3. Temuan Detail (Per Skema)

> **Legenda Confidence:** 🟢 Tinggi (pasti ada di hampir semua implementasi), 🟡 Sedang (bergantung isi), 🔴 Rendah (perlu verifikasi).

### 🔴 F-01 (P0) · `_columns.ts` — Timestamp & ID invariant
**Confidence:** 🟢

**Pola:** Kolom timestamp via Drizzle sering didefinisikan `timestamp(..., { withTimezone: true }).defaultNow()` tanpa `notNull()`, dan `updatedAt` kadang tidak di-set otomatis.

**Dampak:**
- `created_at` bisa `NULL` → sorting/pagination rusak.
- `updated_at` tidak ter-update pada `update()` → optimistic concurrency gagal.

**Reproduksi:** Buat row via `db.insert(x).values({...})` tanpa field timestamp → row dengan NULL.

**Perbaikan:**
```ts
export const createdAt = timestamp('created_at', { withTimezone: true })
  .notNull().defaultNow();
export const updatedAt = timestamp('updated_at', { withTimezone: true })
  .notNull().defaultNow().$onUpdate(() => new Date());
```
Tambahkan trigger `BEFORE UPDATE` di Postgres sebagai *defense in depth* jika `$onUpdate` dilarang di proyek.

---

### 🔴 F-02 (P0) · `_enums.ts` — Enum drift vs migration
**Confidence:** 🟢

**Pola:** `pgEnum` Drizzle mewajibkan migrasi manual (`ALTER TYPE ... ADD VALUE`). Nilai yang dihapus tidak bisa di-*drop* tanpa membuat ulang tipe.

**Dampak:** Aplikasi menerima nilai enum yang tidak ada di DB (atau sebaliknya) → runtime error 500 di server action.

**Perbaikan:** Tambah test integrasi CI yang meng-`select` setiap nilai enum dari aplikasi ke DB. Gunakan `drizzle-kit check`.

---

### 🟠 F-03 · `auth.ts` — Session & Ownership
**Confidence:** 🟡🟢

**Pola risiko:**

1. **`session` tanpa index pada `user_id` dan `expires_at`** → query auth lambat seiring tabel membesar, terkait dengan pembersihan sesi kedaluwarsa.
2. **Tidak ada `UNIQUE` pada `session.token`** → kemungkinan collision lookup, dan `ON CONFLICT` tidak bisa dipakai untuk refresh atomik.
3. **Field `email` tanpa `lower()` normalization** → dua akun "A@x.com" dan "a@x.com".

**Perbaikan:**
```ts
email: varchar({ length: 320 }).notNull().unique(),
// + index unik fungsional:
uniqueIndex('users_email_lower_uidx').on(sql`lower(${users.email})`),
// sessions:
index('sessions_user_id_idx').on(s.userId),
index('sessions_expires_at_idx').on(s.expiresAt),
uniqueIndex('sessions_token_uidx').on(s.token),
```

---

### 🔴 F-04 (P0) · `system.ts` — Settings singleton & race
**Confidence:** 🟡

**Pola:** Tabel `system_settings` sering dibuat sebagai key-value tanpa proteksi tulis, atau sebagai baris singleton `id=1` tanpa `CHECK (id=1)`.

**Dampak:**
- Dua insert paralel → dua baris "singleton" → `SELECT ... LIMIT 1` nondeterministik.
- Admin action tanpa transaksi → partial update.

**Perbaikan:**
```ts
id: integer('id').primaryKey().default(1),
// CHECK constraint di migrasi:
// ALTER TABLE system_settings ADD CONSTRAINT singleton CHECK (id = 1);
```
Bungkus update dalam transaksi + `SELECT ... FOR UPDATE`.

---

### 🟠 F-05 · `source.ts` — Atribusi & Provenance
**Confidence:** 🟡

**Pola:** Tabel source (asal soal) sering tanpa `ON DELETE` policy eksplisit.

**Dampak:** Menghapus `source` akan **gagal** jika FK `RESTRICT` (default), atau **orphan** jika `CASCADE` dipakai tanpa mempertimbangkan soal yang mengikutinya.

**Perbaikan:** Tentukan policy per FK di `question.ts`:
```ts
sourceId: uuid('source_id').references(() => sources.id, {
  onDelete: 'restrict', onUpdate: 'cascade',
}),
```
Dan tangani `pg_code '23503'` di layer service menjadi error domain, bukan 500.

---

### 🔴 F-06 (P0) · `question.ts` — Status lifecycle & soft delete
**Confidence:** 🟢🟡

**Pola umum bug:**

1. Soal dengan `status = 'published'` masih bisa diedit guru (tidak ada guard aplikasi + tidak ada constraint).
2. Soft delete via `deleted_at` **tidak konsisten** diterapkan pada semua query → soal terhapus tetap muncul di bank soal.
3. `question_type` (enum) dan struktur `content` (JSONB) tidak divalidasi type-nya → tipe `mcq` menerima content `essay`.

**Reproduksi:**
```ts
// Guru A
await db.update(questions).set({ content: {...} }).where(eq(questions.id, q));
// Meanwhile, siswa mengambil snapshot versi lama → mismatch
```

**Perbaikan (defense-in-depth):**
1. Tambah kolom `version integer NOT NULL DEFAULT 1` (optimistic lock).
2. Siswa mengambil `question_version` di attempt → validasi matching saat submit.
3. Validasi JSONB content dengan Zod **di boundary server action** + CHECK constraint dasar di DB (misal `jsonb_typeof(content->'choices') = 'array'`).
4. Terapkan `@updatedAt` + policy migration dengan trigger yang memblokir perubahan pada status `published` kecuali `editor_version` berbeda.

---

### 🟠 F-07 · `media.ts` — Unggahan & MIME spoofing
**Confidence:** 🟢

**Pola:** Kolom `mime_type` sering disimpan apa adanya dari `file.type` browser (tidak dipercaya).

**Dampak:** Upload `.svg` dengan `<script>` → XSS saat diserve. Atau `.html` di-serve sebagai `attachment`.

**Perbaikan:**
- Sniff magic bytes di server (mis. `file-type`).
- Whitelist MIME: `['image/png','image/webp','image/jpeg']`.
- Serve via signed URL dengan `Content-Disposition: attachment` dan `Content-Security-Policy: sandbox`.
- **Jangan pernah** `next/image` langsung dari bucket publik untuk SVG.

---

### 🟠 F-08 · `event.ts` — Append-only & idempotency
**Confidence:** 🟡

**Pola:** Tabel event (audit/analytics) sering tanpa idempotency key → retry client menduplikasi event.

**Perbaikan:**
```ts
idempotencyKey: uuid('idempotency_key').notNull(),
// uniqueIndex('events_idem_uidx').on(e.idempotencyKey)
```
Plus partisi bulanan (`PARTITION BY RANGE (created_at)`) karena tabel event secara alami tumbuh cepat.

---

### 🔴 F-09 (P0) · `bundle.ts` & `collection.ts` — Many-to-many tanpa urutan
**Confidence:** 🟢

**Pola:** Tabel pivot `bundle_questions` tanpa kolom `position` → urutan soal nondeterministik di UI ujian/kuis.

**Dampak:** Siswa A mendapat urutan soal berbeda dari Siswa B → distribusi kesulitan tidak seimbang, dan review tidak reprodusibel.

**Perbaikan:**
```ts
position: integer('position').notNull(),
// uniqueIndex('bundle_question_pos_uidx').on(bq.bundleId, bq.position)
// uniqueIndex('bundle_question_pair_uidx').on(bq.bundleId, bq.questionId)
```
Gunakan kolom `position` bertipe *fractional* (misal `numeric` atau LexoRank) agar insert di tengah tidak perlu rewrite.

---

### 🟠 F-10 · `taxonomy.ts` — Tree & recursive CTE
**Confidence:** 🟡

**Pola:** `parent_id` self-reference tanpa:

- `CHECK (parent_id <> id)` → node menjadi parent dirinya sendiri.
- Cycle detection → A→B→A → traversal infinite.

**Perbaikan:**
```ts
parentId: uuid('parent_id').references((): AnyPgColumn => taxonomies.id, {
  onDelete: 'set null',
}),
// CHECK di migrasi:
// ALTER TABLE taxonomies ADD CONSTRAINT no_self_parent CHECK (parent_id <> id);
```
Tambahkan trigger `BEFORE UPDATE` untuk memeriksa cycle (lihat contoh Cookbook Postgres "tree integrity").

Atau gunakan `ltree` extension untuk path-based taxonomy (rekomendasi kuat untuk MathBank karena taksonomi matematika bersifat hierarkis).

---

### 🟠 F-11 · `solution.ts` — Visibilitas & pre-release leak
**Confidence:** 🟢🟡

**Pola:** Soal punya `solution` di tabel terpisah. Jika query soal tidak `LEFT JOIN ... WHERE visible = true`, siswa bisa melihat kunci jawaban sebelum submit.

**Reproduksi:** Query `GET /api/questions?include=solution` tanpa `authorId` check → payload berisi `content` jawaban.

**Perbaikan:**
- Kolom `revealed_at` nullable; hanya terisi setelah attempt submitted.
- **Default deny**: query soal untuk role student **JOIN** dan **filter** `solution.revealed_at IS NOT NULL AND < now()`.
- Otorisasi di level view/endpoint, bukan UI.
- Pertimbangkan trigger DB `CHECK (reveal_at IS NULL OR (SELECT status FROM attempt ...) = 'submitted')` untuk mengunci invariant.

---

### 🔴 F-12 (P0) · App Router (Next.js 16) — Server Action Authorization
**Confidence:** 🟢

**Pola:** Server Actions di Next 16 tetap rentan jika hanya mengandalkan UI gating. Setiap action = endpoint publik.

**Reproduksi:**
```ts
'use server';
export async function deleteQuestion(id: string) {
  await db.delete(questions).where(eq(questions.id, id)); // tanpa auth!
}
```

**Perbaikan:** Wajibkan pola **middleware auth per action**:
```ts
'use server';
const session = await requireSession();
if (!can(session.user, 'question:write')) throw new ForbiddenError();
```

Pasang **rate limiting** (Upstash / `next-rate-limit`) karena server actions tidak punya CSRF token otomatis (Next menyematkan origin check, tapi tetap butuh rate limit).

---

### 🔴 F-13 (P0) · Drizzle + PostgreSQL 17 — RLS & search_path
**Confidence:** 🟡🟢

**Pola:** Banyak proyek Drizzle berjalan dengan akun DB `superuser`/`bypassrls` → RLS tidak aktif meski didefinisikan.

**Dampak:** Semua data terbaca lintas tenant (guru A membaca soal guru B).

**Perbaikan:**
1. Buat **role aplikasi** khusus: `CREATE ROLE app_user NOBYPASSRLS;`. Pastikan connection pakai role ini.
2. Aktifkan `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; ALTER TABLE ... FORCE ROW LEVEL SECURITY;`.
3. Policy:
```sql
CREATE POLICY q_owner ON questions
  FOR ALL TO app_user
  USING (owner_id = current_setting('app.current_user', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.current_user', true)::uuid);
```
4. Di layer service Drizzle, bungkus dengan:
```ts
await db.execute(sql`SET LOCAL app.current_user = ${userId}`);
```
Gunakan helper `withTenant(userId, cb)`.

> ⚠️ **Red flag:** Jika repository pernah menjalankan `db.delete()` di Server Action tanpa filter `owner_id`, ini sudah merupakan bug multi-tenant — **temuan P0**.

---

### 🟠 F-14 · React 19 + Next 16 — `use server` boundary leak
**Confidence:** 🟡

**Pola:** Mengimport file berisi `server-only` module (misal `db`) ke komponen client → build gagal, atau worse: diloloskan via `"use client"` boundary tree-shaking yang salah.

**Perbaikan:** Tambahkan `import 'server-only';` di `src/lib/db/index.ts` dan `src/lib/db/schema/index.ts`.

---

### 🟡 F-15 · Drizzle — N+1 pada relasi
**Confidence:** 🟢

**Pola:** `db.query.questions.findFirst({ with: { solutions: true } })` untuk daftar soal → N query.

**Perbaikan:** Gunakan `db.select().from(...).leftJoin(...)` + agregasi JSON di Postgres (`jsonb_agg`) untuk list queries. Untuk Drizzle 0.x gunakan `.prepare()` saat query dijalankan berulang.

---

### 🟡 F-16 · Tailwind v4 + Base UI — Class Merge
**Confidence:** 🔴🟡

**Pola:** Tailwind v4 memakai CSS-first config. Bila ada komponen mereplikasi `cn()` (`clsx` + `tailwind-merge`) dengan daftar class lama (v3) → merge salah (contoh `bg-gradient-to-r` vs `bg-linear-to-r`).

**Perbaikan:** Sinkronkan `tailwind-merge` versi ≥ v4. Update helper `cn` di project.

---

### 🟠 F-17 · Migrasi & Seeder
**Confidence:** 🟢

**Pola:** Seed script yang menggunakan `db.insert().onConflictDoNothing()` tanpa `RETURNING` → bug silent (tidak tahu insert berhasil/gagal). Tidak dibungkus transaksi → data setengah jadi jika error di tengah.

**Perbaikan:**
```ts
export async function seed() {
  await db.transaction(async (tx) => {
    for (const q of data) {
      const [row] = await tx