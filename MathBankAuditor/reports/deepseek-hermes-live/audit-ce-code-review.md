# 🔍 Laporan Audit Keamanan & Kode — MathBank v2

**Auditor:** Senior Code Auditor & Security Expert
**Fokus:** `ce-code-review`
**Stack:** Next.js 16 (App Router) · React 19 · Drizzle ORM · PostgreSQL 17 · Tailwind v4 · Base UI
**Cakupan:** Skema DB (`src/lib/db/schema/*`), layer API/Server Actions, auth, boundary validasi.

---

## ⚠️ Catatan Metodologi (Wajib Dibaca)

Instruksi meminta saya mengeksekusi skill `ce-code-review`. Skill tersebut **tidak tersedia di lingkungan saya** — saya tidak memiliki akses ke filesystem repositori, tidak memiliki katalog skill tersebut, dan tidak dapat membuka file schema yang Anda sebutkan. Karena itu:

- Saya **tidak** akan berpura-pura telah membaca isi file atau mengutip nomor baris spesifik.
- Temuan di bawah ini adalah **checklist audit bertarget** yang diturunkan dari kombinasi stack (Next.js App Router + Drizzle + Postgres 17 + Auth) dan konvensi umum skema domain seperti yang Anda deskripsikan (enums, columns, auth, system, source, question, media, event, bundle, collection, taxonomy, solution).
- Setiap temuan dirumuskan agar **dapat diverifikasi/direproduksi** saat Anda menjalankannya terhadap kode aktual.

Agar audit menjadi definitif, jalankan repo dan salah satu dari:
1. Paste isi file schema (`_enums.ts`, `_columns.ts`, `auth.ts`, dst.) + middleware + route handler/Server Action kritikal, **atau**
2. Izinkan saya menjalankan `cat`/`grep`/`et al.` terhadap direktori kerja (via tool filesystem/terminal), **atau**
3. Sediakan output `pnpm drizzle-kit generate` + `json-schema-to-typescript` bila ada.

Dengan info tambahan itu, saya bisa mempersempit ke baris file & memberikan patch.

---

## 1. Ringkasan Eksekutif

| ID | Kategori | Severity | Prioritas |
|----|----------|----------|-----------|
| F-01 | Otorisasi Server Action / Route Handler | 🔴 Critical | P0 |
| F-02 | Isolation Multi-Tenant (bundle/collection/organization) | 🔴 Critical | P0 |
| F-03 | Constraint Integritas Referensial (`ON DELETE`) | 🟠 High | P1 |
| F-04 | Enumerasi & Validasi Enum vs Zod | 🟠 High | P1 |
| F-05 | Race Condition pada Penomoran & Counter | 🟠 High | P1 |
| F-06 | Auth Session & Cookie Hardening | 🟠 High | P1 |
| F-07 | Mass-Assignment via Drizzle `set()` / spread body | 🔴 Critical | P0 |
| F-08 | Prompt/Content XSS pada `question` & `solution` | 🟠 High | P1 |
| F-09 | IDOR pada `source` & `media` | 🟠 High | P1 |
| F-10 | Rate Limit & Abuse pada endpoint generate/auth | 🟡 Medium | P2 |
| F-11 | Audit Log di skema `event` tidak immutable | 🟡 Medium | P2 |
| F-12 | Indexing & performa query wajib (taxonomy, event) | 🟡 Medium | P2 |
| F-13 | Drizzle migration drift & destructive change | 🟡 Medium | P2 |
| F-14 | Dependency & RSC surface (Next 16 / React 19) | 🟡 Medium | P2 |
| F-15 | Error leakage & observability | 🟢 Low | P3 |

Skor risiko keseluruhan: **Tinggi** — 2 temuan Critical, 7 High.

---

## 2. Temuan Detail

### F-01 · 🔴 Server Action tanpa otorisasi berbasis resource

**Kategori:** Broken Access Control (OWASP A01) / Next.js App Router.

**Pola rawan** (khas Next 16):
```ts
// src/app/actions/question.ts
"use server";
export async function updateQuestion(id: string, data: QuestionInput) {
  return db.update(questions).set(data).where(eq(questions.id, id));
}
```

**Mengapa kritis:** Server Action = endpoint publik HTTP. Tanpa `auth()`/`requireRole()` **di dalam action**, siapa pun yang tahu `id` bisa mengubah record. Ini klasik IDOR pada RSC.

**Reproduksi:**
- Buka DevTools, ambil `Next-Action` header dari request klien.
- Replay `POST /` dengan header tersebut + `Next-Router-State-Tree` dan body `{ id: "<uuid korban>", ... }`.

**Perbaikan:**
1. Buat helper terpusat:
```ts
// src/lib/auth/guard.ts
export async function requireUser() {
  const s = await auth();
  if (!s?.user) throw new AuthError("unauthenticated");
  return s.user;
}
export async function requireRole(role: Role) { /* ... */ }
```
2. Setiap action: `const user = await requireUser();` lalu **cek kepemilikan** via query berlapis (`where(and(eq(row.id, id), eq(row.ownerId, user.id)))`), bukan `findById` lalu `if`.
3. Tambahkan lint rule `no-restricted-syntax` atau plugin `eslint-plugin-server-actions-guard` untuk memblokir action tanpa `requireUser`.

---

### F-02 · 🔴 Batas isolation tenant pada `bundle`/`collection` tidak jelas

**Kategori:** Multi-tenancy / Data leakage.

Skema memisahkan `bundle.ts`, `collection.ts`, `taxonomy.ts` — tanpa melihat isi, risiko tipikal: relasi antar-tenant tanpa `WHERE` tenant, atau `question_bundle` junction tanpa komposit unik sehingga insert idempoten gagal.

**Checklist verifikasi:**
- Semua tabel turunan `question_*`, `solution_*`, `media_*` **harus** punya `tenantId`/`ownerId` atau FK transitif yang dilindungi **RLS** Postgres.
- Aktifkan RLS bila multi-tenant:
```sql
ALTER TABLE question ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON question
  USING (owner_id = current_setting('app.user_id')::uuid);
```
Drizzle mendukung `pgPolicy` (lihat `drizzle-orm/pg-core`) — definisikan di schema agar musuh tak bisa bypass lewat raw SQL.

**Reproduksi:** buat user A & B; panggil endpoint listing bundle dengan session A, cek apakah record milik B terbocor.

---

### F-03 · 🟠 Drizzle FK default `ON DELETE no action` → orphan

**Risiko:** `references(() => questions.id)` tanpa opsi `onDelete` **tidak** cascade. Menghapus `source` akan gagal jika masih dirujuk `question`, atau meninggalkan orphan jika implementasi manual.

**Reproduksi:** `DELETE FROM source WHERE id = ...` sementara ada `question.source_id = ...` → `ForeignKeyViolation` 500 di API.

**Perbaikan per-relasi:**

| Relasi | Rekomendasi |
|--------|-------------|
| `question.sourceId → source.id` | `onDelete: "restrict"` (data master tidak boleh hilang) |
| `questionBundle.bundleId → bundle.id` | `onDelete: "cascade"` |
| `solution.questionId → question.id` | `onDelete: "cascade"` |
| `media.ownerId → auth.users.id` | `onDelete: "set null"` + `media.soft_deleted_at` |
| `event.actorId` | `onDelete: "set null"` (audit trail tetap) |

Konsistensikan ini di `_columns.ts` agar tidak duplikatif.

---

### F-04 · 🟠 Enum DB & Zod tidak sinkron (drift)

**Pola:** `pgEnum("difficulty", ["easy","medium","hard"])` di `_enums.ts` tetapi validasi request menerima `string`. Konsekuensi: `500` bukan `400`, atau **diterima** value di luar domain via raw query.

**Perbaikan:**
```ts
// src/lib/db/schema/_enums.ts
export const difficultyEnum = pgEnum("difficulty", ["easy","medium","hard"] as const);
export const difficultyValues = difficultyEnum.enumValues; // sumber tunggal

// zod
const difficulty = z.enum(difficultyValues);
```
Tambahkan test integritas yang membandingkan `enumValues` vs `z.enum().options` per tipe.

---

### F-05 · 🟠 Race condition pada counter/versioning (soal, bundle order)

**Skenario:** `SELECT max(position) ...; INSERT position=max+1` — dua request paralel menghasilkan duplikat `position`. Sama untuk `version` soal (jika ada).

**Perbaikan:**
- Gunakan `unique(bundleId, position)` + retry `onConflictDoNothing`.
- Atau `posisi` dari sequence: `INSERT ... SELECT coalesce(max(position),0)+1 FROM ... FOR UPDATE` di dalam transaksi.
- Drizzle `db.transaction(tx => ...)` dengan default isolation `READ COMMITTED` — perlu `FOR UPDATE` eksplisit.

**Reproduksi:** `for i in $(seq 1 20); do curl ... & done` → hitung duplikat `(bundle_id, position)`.

---

### F-06 · 🟠 Session cookie tidak di-hardening

Cek di `src/lib/auth/*` atau `auth.ts` skema:
- Cookie `SameSite=Lax` **wajib** untuk OAuth callback; jika `None`, wajib `Secure`.
- `httpOnly: true`, `__Host-` prefix.
- Session TTL ≠ refesh TTL; refresh token rotation harus **invalidasi** token lama (lihat kolom `refresh_token.revoked_at`).
- Cek `CSRF` pada Server Action non-GET: Next 16 mengandalkan `Origin` check bawaan **hanya untuk action**, bukan route handler `POST` di `/api/*`. Pastikan `POST /api/*` sensitif dilindungi CSRF token atau `SameSite=strict` cookie.

**Reproduksi:** kirim `POST /api/...` dari origin lain (curl dengan `Origin: https://evil`).

---

### F-07 · 🔴 Mass-assignment lewat `set(body)`

**Pola Iblis:**
```ts
export async function PATCH(req) {
  const body = await req.json();
  await db.update(questions).set(body).where(...); // body bisa berisi ownerId, isPublished, dsb
}
```

**Dampak:** User bisa memposisikan `id`/`ownerId`/`createdAt`/`deletedAt`/`role`.

**Perbaikan:** whitelist via Zod + `.strict()`:
```ts
const Update = z.object({ title: z.string().min(1).max(200), // ...
}).strict();
const parsed = Update.parse(body);
await db.update(questions).set(parsed).where(...);
```
`strict()` penting — default Zod `strip` sudah mencegah *sampai* kode men-spread body utuh. **Aturan tim:** `update().set()` **hanya** boleh menerima objek dari parser Zod.

---

### F-08 · 🟠 XSS lewat konten soal/solusi (Markdown/LaTeX)

`question.ts` & `solution.ts` menyimpan konten rich text. Risiko:
- Render via `dangerouslySetInnerHTML` tanpa sanitasi.
- Markdown dengan `javascript:` URL pada link.
- KaTeX `\htmlClass`/`\htmlData` (jika `trust: true`).

**Perbaikan:**
1. Sanitasi server-side dengan `rehype-sanitize` schema ketat (whitelist `img`, `math`, dst.).
2. `KaTeX` opsi `trust: false`, `strict: "warn"`.
3. Content-Security-Policy header di `next.config.ts` / middleware:
```
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; script-src 'self'; object-src 'none'; base-uri 'self'
```
4. Cek tidak ada `eval`/`Function` di renderer.

**Reproduksi:** input soal dengan `<img src=x onerror=alert(1)>` dan link `[x](javascript:alert(1))`, buka halaman preview sebagai user biasa.

---

### F-09 · 🟠 IDOR pada `media` & `source`

`media` biasanya menyimpan `url`, `storageKey`, `ownerId`. Cek:
- Generate signed URL **wajib** memfilter `ownerId = session.user.id`.
- `source` (buku/PDF) — download endpoint harus authorize per-role, bukan hanya "login".
- Tidak ada `public-read` di bucket S3/R2 untuk objek yang belum dipublikasikan. Cek `Content-Disposition` & `Cache-Control: private`.

**Reproduksi:** ganti UUID di endpoint `/api/media/[id]` ke milik user lain.

---

### F-10 · 🟡 Rate-limit & abuse (login, OTP, AI generate)

Cek `event.ts` — apakah ada tabel rate-limit/attempt. Jika tidak:
- `POST /api/auth/*` → 5 attempt / 15 menit / IP+email.
- Server Action AI/OCR/import → token budget per user.
Implementasi: Redis (`@upstash/ratelimit`) atau tabel `rate_limit` di `system.ts`. Tanpa ini, biaya LLM/OCR bisa bocor.

**Reproduksi:** loop 100 login gagal, cek status 429.

---

### F-11 · 🟡 Skema `event` sebagai audit log harus immutable

Jika `event.ts` di-update/dihapus oleh aplikasi, itu bukan audit log. Wajib:
- `REVOKE UPDATE, DELETE ON event FROM app_role;`
- `GRANT INSERT, SELECT` saja.
- Append-only + `event.created_at` default `now()` (jangan percaya client).

**Reproduksi:** coba `UPDATE event SET actor_id=...` dari role aplikasi.

---

### F-12 · 🟡 Index wajib (khususnya taxonomy & event)

Minimal:
```sql
CREATE INDEX ON question (owner_id, created_at DESC);
CREATE INDEX ON question USING GIN (search_vector);              -- full text
CREATE INDEX ON question_tag (tag_id, question_id);
CREATE INDEX ON event (actor_id, created_at DESC);
CREATE INDEX ON event (entity_type, entity_id, created_at DESC);
CREATE UNIQUE INDEX ON bundle_question (bundle_id, question_id);
CREATE UNIQUE INDEX ON bundle_question (bundle_id, position) WHERE deleted_at IS NULL;
```
Tanpa ini, dashboard/list akan full-scan dan bisa jadi DoS amplifier.

**Reproduksi:** `EXPLAIN ANALYZE` pada endpoint listing; cari `Seq Scan`.

---

### F-13 · 🟡 Drizzle migration drift & destructive change

- Cek `drizzle/*.sql` untuk `ALTER TABLE ... DROP COLUMN` tanpa rename step — akan **data loss**.
- Jalankan `pnpm drizzle-kit check` & `pnpm drizzle-kit generate` dan pastikan tidak ada diff liar.
- Wajib ada baseline snapshot schema (`drizzle/meta/*`) yang di-checked-in.

---

### F-14 · 🟡 Dependency & RSC surface (Next 16 + React 19)

- Next 16 memperkenalkan perubahan `cacheComponents`/`dynamicIO` — pastikan tidak ada kebocoran data antar-request via module-level mutable state (mis. `let cache`).
- Cek `pnpm audit` — terapkan minimal keamanan `next>=16.0.x` patch terbaru.
- Base UI: pastikan komponen `Dialog`/`Popover` tidak merender konten user tanpa sanitasi (menumpang F-08).

---

### F-15 · 🟢 Error leakage

Next 16 secara default mengirim digest, bukan stack. Namun `route.ts` yang `throw` error Postgres akan bocorkan pesan constraint ke user bila tidak di-catch. Bungkus dengan `problem+json` mapper:
- `23505` → 409 Conflict
- `23503` → 400 Foreign key
- `22P02` (invalid uuid) → 400

---

## 3. Rencana Aksi (Prioritisasi)

| Sprint | Item | Estimasi |
|--------|------|----------|
| S-1 (Critical) | F-01, F-02, F-07 | 3–5 hari |
| S-2 (High) | F-03, F-04, F-05, F-06, F-08, F-09 | 1–2 minggu |
| S-3 (Medium) | F-10, F-11, F-12, F-13, F-14 | 1 minggu |
| Backlog | F-15 + test kontrak Zod↔Drizzle | berkelanjutan |

**Gerbang kualitas sebelum merge:**
- [ ] Semua Server Action memanggil `requireUser`/`requireRole` (lint gate).
- [ ] Semua `.set()` menerima hasil `.parse()` schema `.strict()`.
- [ ] Semua FK punya `onDelete` eksplisit.
- [ ] `z.enum` diturunkan dari `pgEnum.enumValues`.
- [ ] CSP + Sanitasi markdown di CI (test render payload XSS).
- [ ] `drizzle-kit check` di CI.

---

## 4. Yang Saya Butuh untuk Menutup Laporan Ini

Kirimkan salah satu:

1. **Isi file** yang paling berisiko: `src/lib/db/schema/{_enums,_columns,auth,question,solution,bundle,collection,taxonomy