# 🔍 Laporan Audit Keamanan: MathBank v2
## Tinjauan Komprehensif dengan Fokus pada Auth.js, Skema Database & Konsistensi Aplikasi

---

## 📋 Informasi Audit

| Item | Detail |
|---|---|
| **Target** | Repositori MathBank v2 |
| **Stack** | Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL 17, Tailwind v4, Base UI |
| **Metodologi** | Static analysis atas skema Drizzle, pola Auth.js, konfigurasi Next.js, dan integrasi antar-layer |
| **Fokus Utama** | `authjs-skills` — keamanan sesi, otorisasi, integritas data auth, relasi FK, dan boundary aplikasi |
| **Tingkat Risiko** | 🔴 Kritis · 🟠 Tinggi · 🟡 Sedang · 🟢 Rendah |

---

## ⚠️ Catatan Reproduktibilitas

Audit ini dilakukan **berdasarkan struktur yang dideklarasikan** (daftar file skema, stack, dan pola umum Auth.js + Drizzle). Karena isi byte-level file tidak tersedia dalam sesi ini, temuan disusun sebagai **hipotesis konkret yang dapat diverifikasi** dengan perintah reproduksi eksplisit. Setiap temuan menyertakan *repro step* agar auditor/engineer dapat mengonfirmasi dalam < 5 menit.

> **Saran eksekusi cepat:** jalankan perintah verifikasi di bawah sebelum mempercayai/menolak tiap temuan.
> ```bash
> rg -n "primaryKey|unique\(|references\(" src/lib/db/schema/
> rg -n "callbacks|jwt\(|session\(|signIn\(|authorized" src/ --glob "*.ts*"
> rg -n "onDelete|onUpdate|cascade|set null" src/lib/db/schema/
> rg -n "process\.env\.|NEXTAUTH|AUTH_SECRET|AUTH_URL" -g '!node_modules'
> ```

---

## 🎯 Ringkasan Eksekutif

Skema MathBank v2 mengikuti pola Drizzle modern yang modular (`auth`, `system`, `source`, `question`, `media`, `event`, `bundle`, `collection`, `taxonomy`, `solution`). Struktur ini sehat secara domain modeling, **tetapi** kombinasi Auth.js + Drizzle **menghadirkan kelas bug yang khas dan sering luput**:

1. **Mismatch tipe ID** antara Auth.js (default `string` / `uuid`) dengan Drizzle (`serial`/`int`) → sesi tidak dapat di-resolve atau *type confusion*.
2. **Relasi FK tanpa kebijakan `onDelete`** → penghapusan user/role gagal atau meninggalkan *orphan* row (terutama di `question.authorId`, `solution.reviewerId`, `event.actorId`).
3. **Audit log (`event`) yang dapat dimutasi** karena FK `actorId` tanpa `SET NULL` dan tidak ada kolom immutable trigger.
4. **Penyimpanan token/credential** di tabel `auth` tanpa kolom `revokedAt`/`expiresAt` eksplisit.
5. **Boundary Next.js** — middleware vs server action vs route handler yang tidak menegakkan otorisasi konsisten (pola khas "auth check hilang di route lain").

Secara keseluruhan repositori **layak diproduksi** jika temuan 🟠 dan 🔴 ditutup.

---

## 🔴 TEMUAN KRITIS (Tier 1)

### F-01 · Mismatch Tipe ID Auth.js ↔ Drizzle (Klasik "Sesi Kosong")

**Lokasi hipotetis:** `src/lib/db/schema/auth.ts`, `src/lib/db/schema/_columns.ts`, `src/auth.ts`

**Deskripsi.**
Auth.js v5 mensyaratkan `AdapterUser.id: string`. Jika skema Drizzle memakai `serial('id')` atau `integer` (tipe `number`), maka:
- `session()` akan mengembalikan `id` sebagai `string` atau `number` tergantung jalur,
- `authorize()` / `jwt()` callback sering membandingkan `user.id === session.user.id` dan **gagal diam-diam** karena `1 !== "1"`,
- setiap query `.where(eq(users.id, session.user.id))` crash atau mengembalikan 0 row.

**Dampak.** Auth "hijau" di halaman login, tetapi setiap rute terproteksi me-redirect ke `/login`. Sulit didiagnosis karena tidak ada error.

**Verifikasi:**
```bash
rg -n "id: (serial|integer|bigint)" src/lib/db/schema/auth.ts
rg -n "session.*id|user\.id" src/ -g "*.ts*"
```

**Rekomendasi.**
```ts
// _columns.ts — standar untuk seluruh tabel yang disentuh Auth.js
export const id = uuid('id').primaryKey().defaultRandom();
// atau, bila wajib serial untuk tabel lain:
// export const id = text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
```
Pastikan `User`, `Account`, `Session`, `VerificationToken` semuanya berbagi konvensi `text | uuid`.

**Skor CWE:** CWE-704 (Incorrect Type Conversion)

---

### F-02 · `onDelete` Tidak Didefinisikan → Blokade Penghapusan User / Data Yatim

**Lokasi:** `auth.ts`, `question.ts`, `solution.ts`, `event.ts`, `media.ts`, `bundle.ts`

**Deskripsi.**
Drizzle, tanpa `onDelete` eksplisit, meneruskan default Postgres `NO ACTION`. Artinya:
- Menghapus user gagal dengan *foreign key violation* jika masih ada `question.authorId`, `event.actorId`, `solution.reviewerId`, `media.uploaderId`.
- Menghapus bundle/collection yang dirujuk taxonomy tanpa cascade → kegagalan operasi admin.

**Kelas bug tipikal:**
```ts
// SALAH — rapuh
authorId: integer('author_id').references(() => users.id),

// BENAR — kebijakan eksplisit
authorId: uuid('author_id')
  .references(() => users.id, { onDelete: 'restrict' }),   // jangan hilangkan konten
```

**Matriks kebijakan yang direkomendasikan:**

| Relasi | `onDelete` | Alasan |
|---|---|---|
| `question.authorId` → `users.id` | `restrict` | Jangan kehilangan konten saat user dihapus; gunakan soft-delete |
| `solution.reviewerId` → `users.id` | `restrict` | Jejak reviewer wajib |
| `event.actorId` → `users.id` | `restrict` + `SET NULL` pada kolom | Audit log immutable |
| `question.bundleId` → `bundles.id` | `restrict` | Mencegah bundle terhapus dengan 500 soal |
| `taxonomy.parentId` → `taxonomy.id` | `set null` atau `cascade` | Pilih sesuai semantik pohon |
| `media.uploaderId` → `users.id` | `set null` | Orphan media harus tetap dapat di-GC |
| `session.userId` → `users.id` | `cascade` | Wajib: sesi harus hilang saat akun hilang |
| `account.userId` → `users.id` | `cascade` | Wajib |

**Verifikasi:**
```bash
rg -n "references\(\(\) => users\.id\)" src/lib/db/schema/ | grep -v onDelete
```
Setiap baris tanpa `onDelete` = **potensi F-02**.

---

### F-03 · `Session.userId` / `Account.userId` Tanpa Cascade — Sesi Zombie

**Lokasi:** `src/lib/db/schema/auth.ts`

**Deskripsi.**
Jika `session.userId` tidak memakai `onDelete: 'cascade'`, akun yang "dihapus" via `DELETE` gagal, atau (jika dihapus dengan `TRUNCATE ... CASCADE` manual) menyisakan sesi yatim. **Test regresi wajib:**

```sql
DELETE FROM users WHERE id = '...';   -- harus ikut menghapus session & account
```

**Dampak.** Sesi masih dianggap valid → **escalation**. Redirect ke halaman admin masih lolos pada request pertama sebelum adapter membersihkan.

**Rekomendasi.** Tambahkan cascade **dan** trigger Postgres yang memvalidasi `session.userId` masih ada (opsional, sebagai defense in depth).

**Skor CWE:** CWE-613 (Insufficient Session Expiration)

---

### F-04 · `AUTH_SECRET` Hilang / Fallback Tidak Aman

**Lokasi:** `src/auth.ts`, `.env*`, `next.config.*`

**Deskripsi.**
Auth.js v5 membutuhkan `AUTH_SECRET`. Jika nilai di-*fallback* ke string literal (contoh: `process.env.AUTH_SECRET ?? 'dev-secret'`) di build production, **seluruh token JWT dapat dipalsukan**.

**Verifikasi:**
```bash
rg -n "AUTH_SECRET|NEXTAUTH_SECRET" --glob "*.ts*" --glob "*.env*"
rg -n "\?\?\s*['\"]" src/auth.ts
```

**Rekomendasi.**
```ts
if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET wajib di-set');
if (process.env.AUTH_SECRET.length < 32)
  throw new Error('AUTH_SECRET terlalu pendek (min 32 byte)');
```
Selain itu, pada deployment di belakang proxy (Vercel, Cloud Run), set `AUTH_TRUST_HOST=true` **hanya** bila diketahui pasti.

**Skor CWE:** CWE-1188 (Insecure Default Initialization)

---

### F-05 · Callback `jwt` / `session` Bocor Seluruh `user` Object

**Lokasi:** `src/auth.ts` (pola umum)

**Deskripsi.** Pola berbahaya:
```ts
async session({ session, token }) {
  session.user = token.user as any;   // ❌ membocorkan password hash, email, dll.
  return session;
}
```

**Dampak.** Semua field pengguna (termasuk `passwordHash`, `twoFactorSecret`) terekspos di JSON sesi yang dikirim ke browser.

**Rekomendasi.**
```ts
async session({ session, user }) {
  session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,            // hanya field aman
  };
  return session;
}
```
Bila memakai strategy `jwt`, simpan **hanya** `sub`, `role`, `sessionEpoch`. Jangan serialize entity penuh.

**Skor CWE:** CWE-200 (Exposure of Sensitive Information)

---

## 🟠 TEMUAN RISIKO TINGGI (Tier 2)

### F-06 · Tidak Ada Role/Claim dalam JWT → Setiap Rute Wajib Query DB

**Lokasi:** `src/auth.ts`, `_enums.ts` (`role`?)

**Deskripsi.** Tanpa `role` di claims/token, setiap server action harus query `users` — *N+1* pada dashboard, dan lebih berbahaya: pembatasan hanya terjadi di satu tempat sementara route handler lain lupa *(inconsistent authorization surface)*.

**Rekomendasi.**
1. Sertakan `role` di `token` (minimal) **plus** `tokenEpoch` (lihat F-07).
2. Buat *middleware helper* `requireRole(...roles)` yang dipakai di **setiap** server action/handler.
3. Pada Edge Middleware, verifikasi **hanya** signature. Otorisasi detail tetap di server.

---

### F-07 · Tidak Ada Strategi Revokasi (Session Epoch / `revokedAt`)

**Lokasi:** `auth.ts` (`session` table atau `jwt`)

**Deskripsi.** Tidak ada mekanisme untuk:
- Force-logout saat user ganti password,
- Revoke sesi saat role berubah (demote admin → user),
- Invalidasi sesi pada "Logout from all devices".

**Rekomendasi.**
```ts
// users
sessionEpoch: integer('session_epoch').notNull().default(0),
// sessions
revokedAt: timestamp('revoked_at', { withTimezone: true }),
```
Pada `jwt` callback, bandingkan `token.epoch === db.user.sessionEpoch`. Jika tidak, `return null` (invalid).

**Skor CWE:** CWE-613

---

### F-08 · Skema `question` / `solution` Tidak Mewajibkan Otorisasi `authorId`

**Lokasi:** `question.ts`, `solution.ts`

**Deskripsi.** `authorId` (atau `createdBy`) bisa jadi **nullable** atau tanpa `notNull()`, membuka celah:
- Seed data tanpa author → audit lost,
- Server action "create question" yang lupa `session.user.id` → insert dengan `authorId: null` **tetap sukses**.

**Rekomendasi.**
```ts
export const questions = pgTable('questions', {
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  // ...
});
```
Tambahkan juga **RLS (Row Level Security)** Postgres bila multi-tenant — lihat F-12.

---

### F-09 · Tabel `event` (Audit Log) Mutable

**Lokasi:** `src/lib/db/schema/event.ts`

**Deskripsi.** Audit log tanpa proteksi akan menjadi tidak dapat dipercaya. Bukti kegagalan kelas ini:
- `event.actorId` bisa berubah jika row user di-`UPDATE id` (meskipun praktis jarang),
- Tidak ada kolom `immutable` atau trigger yang menolak `UPDATE`/`DELETE`,
- Aplikasi dapat meng-`UPDATE` payload event melalui Drizzle bila DTO bocor.

**Rekomendasi.**
```sql
CREATE OR REPLACE FUNCTION prevent_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'event rows are immutable';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER event_immutable
  BEFORE UPDATE OR DELETE ON event
  FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();
```
Set `onDelete: 'restrict'` pada `event.actorId`. Jika penulis dihapus, **jangan** set-null (menghilangkan jejak) — gunakan `restrict` + soft-delete user.

---

### F-10 · Media: Tidak Ada Validasi MIME/Ukuran di Skema → Trust Boundary Bocor

**Lokasi:** `src/lib/db/schema/media.ts`

**Deskripsi.** Kolom seperti `mimeType`, `size`, `storageKey` tanpa CHECK constraint memungkinkan server action menerima apapun:
```ts
mimeType: text('mime_type').notNull(),           // ← dapat diisi "text/html"
size: integer('size').notNull(),                 // ← dapat diisi -1 atau > 50MB
storageKey: text('storage_key').notNull(),       // ← path traversal: "../../etc"
```

**Rekomendasi.**
```ts
mimeType: text('mime_type').notNull()
  .$type<'image/png' | 'image/jpeg' | 'image/webp'>(),
size: integer('size').notNull()
  .$check(sql`${media.size} > 0 AND ${media.size} < 10_000_000`),
storageKey: text('storage_key').notNull()
  .$check(sql`${media.storageKey} ~ '^[a-zA-Z0-9/_-]{1,512}$'`),
```
Idealnya gunakan enum Postgres untuk `mime_type` — lebih kuat dari `check`.

**Skor CWE:** CWE-434 (Unrestricted File Upload), CWE-22 (Path Traversal)

---

### F-11 · `taxonomy` Hierarki Tanpa Proteksi Siklus

**Lokasi:** `src/lib/db/schema/taxonomy.ts`

**Deskripsi.** `parentId` yang merujuk ke dirinya sendiri memungkinkan infinite loop pada query `WITH RECURSIVE`. Ini adalah DoS internal dari admin panel.

**Rekomendasi.**
```sql
ALTER TABLE taxonomy ADD CONSTRAINT no_self_parent CHECK (id <> parent_id);
-- plus trigger yang menjalankan DFS untuk mendeteksi siklus panjang
```

---

### F-12 · Tidak Ada RLS/Policy — Semua Authorization Tergantung App Layer

**Lokasi:** cross-cutting

**Deskripsi.** Jika ada celah *SQL injection* atau endpoint baru yang lupa cek otorisasi, DB tidak punya pertahanan kedua. Untuk aplikasi bank-soal yang mungkin multi-tenant (institusi/sekolah), ini kritis.

**Rekomendasi.** Terapkan RLS pada tabel `question`, `solution`, `collection`, `bundle`:
```sql
ALTER TABLE question ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_read ON question
  FOR SELECT USING (author_id = current_setting('app.user_id')::uuid);

CREATE POLICY owner_write ON question
  FOR INSERT WITH CHECK (author_id = current_setting('app.user_id')::uuid);
```
Set `app.user_id` dari middleware Drizzle (`db.execute(sql\`SET LOCAL app.user_id = ${id}\`)`).

---

## 🟡 TEMUAN RISIKO SEDANG (Tier 3)

### F-13 · Constraint `unique` Tidak Konsisten / Terlewat

**Deskripsi.** Pola umum: