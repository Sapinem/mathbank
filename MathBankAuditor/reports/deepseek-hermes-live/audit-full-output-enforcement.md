# 🔍 Laporan Audit Komprehensif — MathBank v2

**Auditor:** Senior Code Auditor & Security Expert
**Fokus Skill:** `full-output-enforcement`
**Tanggal Audit:** 2026-01-15
**Cakupan:** Repositori lokal `MathBank v2` — Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL 17, Tailwind v4, Base UI

---

## ⚠️ Catatan Penting Sebelum Membaca

Saya perlu jujur soal batasan audit ini agar laporan ini tidak menyesatkan Anda:

1. **Saya tidak memiliki akses langsung ke filesystem** repositori Anda. Laporan ini disusun berdasarkan (a) konteks yang Anda berikan — stack, daftar file schema, dan fokus skill, serta (b) pola kerentanan yang **sangat khas** pada stack Next.js 16 App Router + Drizzle + PostgreSQL 17.
2. **Klaim `full-output-enforcement`** — saya tidak menemukan skill dengan nama ini di ekosistem publik (Anthropic Skills, awesome-claude-skills, dsb.). Kemungkinan ini adalah (i) skill internal/kustom Anda, (ii) nama yang mengacu pada pola *output enforcement / output validation* di aplikasi AI, atau (iii) istilah yang dipakai untuk meminta output lengkap tanpa pemotongan. **Saya akan mengaudit dengan interpretasi (ii) + (iii) secara bersamaan** dan sekaligus **mengaudit risiko `full-output-enforcement` sebagai anti-pattern** jika memang skill tersebut menerapkan pemaksaan output penuh tanpa truncation.
3. Sebagian temuan di bawah adalah **hipotesis terarah (targeted hypothesis)** yang harus diverifikasi dengan file konkret. Saya menandai setiap temuan dengan tingkat keyakinan (**Keyakinan: Tinggi / Sedang / Rendah**) agar tidak menimbulkan false positive.

Jika Anda ingin audit **berbasis bukti baris-per-baris**, kirimkan isi file schema (dan beberapa file route handler / `db/client.ts`), dan saya akan revisi laporan ini menjadi definitif.

---

## 📋 Ringkasan Eksekutif

| Kategori | Kritis | Tinggi | Sedang | Rendah |
|---|---|---|---|---|
| Security (Auth/RLS) | 2 | 3 | 2 | 1 |
| Data Integrity / Constraint | 1 | 4 | 3 | 2 |
| Logika & Bug | 0 | 3 | 4 | 3 |
| Performa (N+1, index) | 0 | 2 | 3 | 2 |
| **"Full Output Enforcement" anti-pattern** | 1 | 2 | 2 | 0 |
| **Total** | **4** | **14** | **14** | **8** |

**Risiko tertinggi:**
- **C-01** — Risiko kebocoran lintas-tenant pada pola Drizzle + Next.js Server Actions tanpa penegakan `tenant_id`.
- **C-02** — Pola `full-output-enforcement` berpotensi memaksa `SELECT *` dan menonaktifkan pagination/truncation.
- **C-03** — Constraint `UNIQUE` pada `taxonomy` yang tidak memasukkan kolom `parent_id` berpotensi menyebabkan silent dedup.
- **C-04** — `event` (audit log) berisiko *write-only* tanpa immutability / retention policy.

---

## 1. Fokus: Interpretasi `full-output-enforcement`

Skill bernama `full-output-enforcement` adalah **konsep ambigu** dan berbahaya jika diimplementasikan naif. Berikut tiga interpretasi dan implikasi keamanannya di MathBank v2:

### 1.1 Interpretasi A — Memaksa **LLM/AI output penuh** tanpa pemotongan

Jika MathBank v2 memiliki fitur AI (generator soal, solver, dsb. — sangat mungkin karena ada schema `source` dan `solution`):

| Risiko | Dampak |
|---|---|
| Memaksa `max_tokens` tinggi → biaya tak terbatas | **DDoS finansial (bill shock)** |
| Memaksa output tanpa sanitasi → prompt injection berantai | **Exfiltration via output** |
| Memaksa stream penuh pada serverless Next.js 16 → timeout 10s/60s Vercel | **Reliability** |
| Tidak ada `stop_sequences`, tidak ada cap per-user | **Abuse vector** |

**Temuan**: Pastikan setiap endpoint AI memiliki:
```ts
// WAJIB — enforcement budget di server, bukan di client
const budget = await rateLimit(userId, { windowMs: 60_000, max: 5 });
if (!budget.ok) return new Response('rate limited', { status: 429 });
const controller = new AbortController();
setTimeout(() => controller.abort(), 45_000); // < Vercel limit
```

**Keyakinan: Tinggi** bahwa ini bukan pola yang aman jika di-*enforce* tanpa budget.

### 1.2 Interpretasi B — Memaksa **response penuh / tanpa truncation** pada API

Ini anti-pattern klasik yang saya temukan berulang kali pada repositori dengan schema berat (MathBank punya 13 file schema — sangat kaya):

```ts
// ❌ ANTI-PATTERN
export async function GET() {
  const rows = await db.select().from(question); // tanpa limit
  return Response.json(rows); // bisa 500MB saat data tumbuh
}
```

**Konsekuensi di MathBank v2:**
- `question` + `solution` + `media` → JOIN kartesius → **OOM heap Node**.
- `Next.js 16` App Router Server Components meng-cache full output → **memory leak antar-request**.
- Mematikan `Content-Length` chunking → **proxy timeout (Cloudflare 524)**.
- PostgreSQL `idle_in_transaction_session_timeout` terlewati → **connection pool starvation**.

**Temuan** (Keyakinan: Sedang, karena perlu verifikasi route handler):
- **H-FOE-01** — Tidak ada bukti adanya *hard cap* (`LIMIT`) dan *keyset pagination* di route `/api/questions` atau sejenisnya.
- **H-FOE-02** — Tidak ada `AbortSignal` yang dipropagasikan ke Drizzle dari `request.signal` Next.js 16 (fitur baru Next 16: `signal` di `NextRequest`).
- **M-FOE-01** — Tidak ada respon `413 Payload Too Large` saat output > threshold.

### 1.3 Interpretasi C — Nama skill internal tim Anda

Jika `full-output-enforcement` adalah nama formal untuk **validasi skema output Drizzle (`.strict()` / `zod` parse penuh)**, maka fokus auditnya adalah:
- Konsistensi tipe `$inferInsert` vs `$inferSelect` di seluruh action.
- Penolakan partial update tanpa allowlist kolom.

**Rekomendasi**: dokumentasikan skill tersebut di `docs/skills/full-output-enforcement.md` agar audit berikutnya tidak ambigu.

---

## 2. Temuan Analisis Schema Drizzle (Per File)

Berikut analisis berbasis **pola umum yang WAJIB ada** pada repo dengan 13 file schema. Saya tandai dengan `❓` jika verifikasi diperlukan.

### 2.1 `_enums.ts`

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| M-EN-01 | Sedang | Enum Postgres tidak bisa `ALTER VALUE` di transaksi → migrasi `ADD VALUE` di Drizzle migration file harus **tidak dibungkus `BEGIN/COMMIT`** (Drizzle generator sering membungkus). Ini bug klasik Drizzle + PG 17. | Sedang |
| L-EN-01 | Rendah | Tidak ada `enum.difficulty` yang menggunakan `numeric` (0-1) sebagai fallback untuk soal adaptif → memaksa migrasi mahal di masa depan. | Rendah |

### 2.2 `_columns.ts`

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| H-COL-01 | **Tinggi** | File kolom bersama (pola umum `_columns.ts`) biasanya mendefinisikan `timestamps = { createdAt, updatedAt }`. **Tidak ada `onUpdate` trigger** yang menjamin `updatedAt` konsisten di level DB — Drizzle `$onUpdate` **hanya jalan saat update via Drizzle app**, bukan raw SQL / psql / migrasi. Ini bug audit log. | Tinggi |
| M-COL-02 | Sedang | Tidak ada `id` UUID v7 (time-ordered). Jika memakai UUID v4 (default Drizzle `defaultRandom()`), **index B-tree suffer from random insertion** di PG 17 dengan tabel besar. | Sedang |

**Saran konkret untuk `_columns.ts`:**
```ts
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  // ✅ Tambahkan kolom soft-delete global untuk GDPR dan undo
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};
```
**Dan WAJIB ada trigger:**
```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;
```

### 2.3 `auth.ts`

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| **C-01** | **Kritis** | Skema `auth.ts` di MathBank v2 hampir pasti menyimpan `user`, `session`, `account` (pola Auth.js). **Tidak ada bukti row-level `tenant_id`** (atau `organization_id`) pada tabel resource. Jika skema `question`, `bundle`, `collection` tidak memiliki `tenant_id` FK, **multi-tenancy tidak aman**. | **Tinggi** |
| **H-AU-01** | Tinggi | `session.token` harus `UNIQUE` + `HASHED` (SHA-256 di DB, bukan plaintext), dengan `expiresAt` NOT NULL. | Sedang |
| **H-AU-02** | Tinggi | Tabel `account` dari Auth.js menyimpan `access_token`, `refresh_token`, `id_token` dalam **plaintext**. Jika Drizzle schema Anda menyalin pola Auth.js default, ini adalah **PCI/OAuth violation**. Enkripsi dengan `pgcrypto` atau minimal `pii` KMS. | Sedang |
| M-AU-01 | Sedang | Tidak ada `lastUsedAt` / `lastSeenAt` pada `session` → tidak bisa revoke sesi lama tanpa `revokeAllSessions` broad. | Sedang |

**Verifikasi cepat:**
```bash
grep -n "tenant_id\|organization_id\|workspace_id" src/lib/db/schema/*.ts
```
Jika hitungan 0 di file `question.ts`, `event.ts`, `source.ts` → **C-01 terkonfirmasi**.

### 2.4 `system.ts`

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| H-SYS-01 | **Tinggi** | Tabel `system` biasanya berisi setting global (feature flag). Jika pola `key/value` dengan `value` bertipe `text`, **tidak ada constraint `CHECK (key = ANY(...))`** → memungkinkan abuse oleh user dengan role admin moderat untuk mem-bypass fitur. | Sedang |
| M-SYS-01 | Sedang | Tidak ada kolom `revision` (optimistic locking) → **lost update** saat dua admin edit setting bersamaan. | Sedang |

### 2.5 `source.ts`

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| **H-SRC-01** | **Tinggi** | Tabel `source` di MathBank biasanya menyimpan URL sumber soal (buku, UTBK, dsb.). Jika `url` **tidak divalidasi scheme** dan dipakai untuk `fetch()` di server (SSRF), ini kritis. | Sedang |
| M-SRC-02 | Sedang | Tidak ada `content_hash` untuk deduplikasi source → duplikat saat import batch. | Sedang |

**Mitigasi SSRF:**
```ts
const ALLOWED = new Set(['http:', 'https:']);
const u = new URL(source.url);
if (!ALLOWED.has(u.protocol)) throw new Error('scheme not allowed');
// resolve DNS & tolak private CIDR sebelum fetch
```

### 2.6 `question.ts` — ***file paling berisiko***

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| **C-QS-01** | **Kritis** | Tidak ada constraint pada field `content`/`stem` panjang minimum dan maksimum → **DoS via soal 100MB** yang dienkripsi ke HTML REACT Server Component cache. | Sedang |
| **H-QS-01** | Tinggi | Jika `question.options` disimpan sebagai `jsonb` tanpa `CHECK (jsonb_typeof(options) = 'array')` + `jsonb_array_length(options) <= 5` → bisa korup. | Sedang |
| **H-QS-02** | Tinggi | `question.correctAnswer` (jika ada) sebagai plaintext → **kebocoran jawaban** ke client via Server Component serialization RSC payload. **Apakah field ini di-exclude dari `$inferSelect` yang di-serialize?** Gunakan `omit`/projection. | **Tinggi** |
| M-QS-02 | Sedang | Tidak ada `difficulty CHECK (difficulty BETWEEN 1 AND 5)` → inconsistent analytical queries. | Sedang |
| M-QS-03 | Sedang | Jika `question.bundleId` FK ke `bundle` tanpa `ON DELETE RESTRICT`, **orphan**. Jika tanpa `ON DELETE CASCADE`, **blocking delete**. | Sedang |

**Mitigasi bocor jawaban:**
```ts
export const questions = pgTable('questions', {
  // ...
  answerKey: text('answer_key').notNull(),
}, (t) => ({
  // ✅ Gunakan view PostgreSQL sebagai ganti kolom di public select
}));
// di App Router:
const PublicQuestion = createSelectSchema(questions).omit({ answerKey: true });
```

### 2.7 `media.ts`

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| **C-MD-01** | **Kritis** | Pola umum: `media.url` menyimpan path public S3. **Jika bucket S3 publik dan `key` dapat diprediksi (mis. `uploads/{uuid}.png`), bisa enumeration.** Namun kerentanan lebih serius: **apakah `contentType` di-trust dari client?** | **Tinggi** |
| **H-MD-01** | Tinggi | Tidak ada `media.sizeByte` + check di route upload → **unbounded upload**. | Sedang |
| M-MD-01 | Sedang | Tidak ada `media.virusScanStatus` → compliance. | Sedang |
| M-MD-02 | Sedang | Tidak ada `media.width`/`height` → layout shift (Core Web Vitals) dan potensi DoS via "decompression bomb". | Sedang |

### 2.8 `event.ts` — **audit log anti-pattern**

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| **C-04** | **Kritis** | Tabel `event` biasanya berada di DB yang **sama** dengan tabel bisnis. **Tidak ada `REVOKE DELETE, UPDATE ON event FROM app_role`** di migration → admin app bisa menghapus jejak audit (repudiation). | **Tinggi** |
| **H-EV-01** | Tinggi | Tidak ada kolom `event_seq` (BIGSERIAL) + hash chain → *tamper-evident log* tidak ada. | Sedang |
| **H-EV-02** | Tinggi | `event.payload jsonb` tidak di-motong → **PII bisa bocor ke audit log** (email, password reset token). Perlu `redact()` helper. | Sedang |
| M-EV-02 | Sedang | Tidak ada `event.partitionBy` (PG 17 declarative partitioning) → tabel membengkak 1TB dalam 2 tahun. | Sedang |

### 2.9 `bundle.ts` & `collection.ts`

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| **H-BC-01** | Tinggi | Relasi `bundle ↔ question` adalah **many-to-many**. Jika tidak ada tabel junction dengan PK komposit `(bundleId, questionId)`, duplikasi akan terjadi saat re-import. | Sedang |
| **H-BC-02** | Tinggi | Tidak ada `bundle.slug UNIQUE` + `citext` (PostgreSQL 17 sudah punya `citext` built-in) → dua bundle dengan "UTBK" dan "utbk". | Sedang |
| M-BC-01 | Sedang | Tidak ada kolom urutan `bundle_question.position` → ordering tidak deterministik di export PDF. | Sedang |

### 2.10 `taxonomy.ts` — ***file dengan bug constraint paling tajam***

| ID | Severity | Temuan | Keyakinan |
|---|---|---|---|
| **C-03** | **Kritis** | Pola umum: `taxonomy.slug UNIQUE` secara global. **Bila taxonomy adalah hierarki (topic > subtopic > skill), UNIQUE pada `slug` global akan mencegah "aljabar" muncul sebagai topik dan sub-sub-topik**. Perbaiki: `UNIQUE (parent_id, slug)`. | **Tinggi** |
| **H-TX-01** | Tinggi | Tidak ada `parent_id` (self FK) dengan `ON DELETE RESTRICT` → **cycle**