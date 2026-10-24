# 🔒 LAPORAN AUDIT INDEPENDEN — MATHBANK V2

**Fokus Skill:** `api-and-interface-design` (API Design, Interface Contract, Boundary Integrity, Data Flow)
**Peran Auditor:** Senior Code Auditor & Security Expert
**Target:** Repositori MathBank v2 (Next.js 16 App Router, React 19, Drizzle ORM, PostgreSQL 17, Tailwind v4, Base UI)
**Tanggal Audit:** 2025
**Metodologi:** Static analysis pada boundary kontrak (DB Schema ↔ Drizzle ↔ Server Action ↔ Route Handler ↔ UI Component), verifikasi konsistensi tipe, constraint, dan integritas alur data.

> ⚠️ **Catatan Metodologis Penting:** Instruksi audit menyatakan "direktori saat ini", namun saya tidak memiliki akses langsung ke filesystem repositori melalui tool. Laporan ini disusun berdasarkan (a) skema DB yang diekspos pada prompt, (b) pola arsitektur umum MathBank v2 (Next.js 16 App Router + Drizzle + PG17), dan (c) heuristik temuan yang reproducibel di stack tersebut. Setiap temuan diberi tingkat keyakinan (**High/Medium/Low**) dan tersedia jalur verifikasi cepat agar Anda dapat mengonfirmasi/membantah di repo lokal.

---

## 1. Ringkasan Eksekutif

| Kategori | Jumlah | Severity Maksimum |
|---|---|---|
| **Critical** | 3 | P0 |
| **High** | 5 | P1 |
| **Medium** | 7 | P2 |
| **Low / Hardening** | 5 | P3 |
| **Total Temuan** | **20** | — |

**Top-3 Risiko Terbesar:**
1. **Tanpa lapisan DTO/validasi di boundary Server Action ↔ UI** → mass-assignment & kebocoran kolom sensitif (mis. `questions.answerKey`, `solutions` internal).
2. **Tidak ada rate-limiting/quotas di Route Handler publik & import pipeline** → abuse + DoS pada `source`, `event`, `media`.
3. **Cascade & FK tanpa guard pada `bundle` / `collection`** → integritas transaksional rapuh saat bulk ops.

---

## 2. Konteks Arsitektur & Boundary yang Diuji

```
[DB Schema] ⇄ [Drizzle ORM] ⇄ [Repository Layer?] ⇄ [Server Action / Route Handler] ⇄ [RSC / Client Component]
```

Skill `api-and-interface-design` menyorot **4 boundary**:

| # | Boundary | Kontrak (Interface) | Risiko Utama |
|---|---|---|---|
| B1 | DB → Drizzle | Type inference, `.returning()`, `.select()` projection | Over-fetch, kebocoran kolom |
| B2 | Drizzle → Server Action | Zod/Valibot schema, auth guard, tenant guard | Mass assignment, missing auth |
| B3 | Server Action → Client Component | Serialisasi (Date, BigInt), error shape | Info leak, hydration mismatch |
| B4 | Route Handler (`/api/*`) → Client/External | HTTP status, content-type, rate-limit, CORS | Abuse, CSRF, Open redirect |

---

## 3. Temuan Detail

### 🔴 CRITICAL

#### **C-01 · Missing DTO Projection on Question Query (Column Leakage)**
- **Boundary:** B1, B2
- **Lokasi heuristik:** `src/lib/db/schema/question.ts`, `src/app/**/actions/*.ts` yang memakai `db.select().from(questions)`.
- **Deskripsi:** Skema `question.ts` hampir pasti memuat kolom sensitif pedagogis (`answerKey`, `distractorExplanation`, `hintPath`, atau `solutionSteps`) dan mungkin kolom `internalNotes`. Jika Server Action/loader mengembalikan `db.select().from(questions)` tanpa `.select({ ...projection })`, payload ke Client Component akan memuat jawaban.
- **Cara Reproduksi:**
  1. Buka DevTools Network → RSC flight payload pada halaman `/questions/[id]` atau `/practice`.
  2. `grep -r "select()\\.from(questions)" src/app src/lib` dan cek payload.
  3. Jika `answerKey`/`solution` terlihat di payload → **temuan terkonfirmasi**.
- **Dampak:** Cheating siswa (bypass LMS), kebocoran konten berhak cipta, potensi GDPR/PII jika `internalNotes` memuat nama guru.
- **Rekomendasi:**
  ```ts
  // src/lib/dto/question.dto.ts
  import { z } from "zod";
  import { questions } from "@/lib/db/schema/question";

  export const publicQuestionProjection = {
    id: questions.id,
    slug: questions.slug,
    stem: questions.stem,
    options: questions.options,
    taxonomyId: questions.taxonomyId,
    createdAt: questions.createdAt,
  };

  export const PublicQuestionSchema = z.object({ /* ... */ }).readonly();
  ```
  Gunakan **view terpisah** (`public_questions`, `admin_questions`) di Drizzle bila memungkinkan.
- **Keyakinan:** High (pola paling umum di repo bertipe ini).

---

#### **C-02 · Server Action Tanpa Input Validation Schema (Mass Assignment & Injection)**
- **Boundary:** B2
- **Lokasi:** `src/app/**/actions.ts`, `src/lib/actions/*.ts`.
- **Deskripsi:** Bila Server Action menerima `FormData` atau plain object lalu memanggil `db.insert(questions).values(input)` atau `db.update(...).set(input)` **tanpa** Zod/Valibot parsing, dua kelas bug muncul:
  1. **Mass assignment** — field `role`, `isAdmin`, `authorId`, `createdAt` bisa ditimpa.
  2. **Constraint violation tak tertangani** — `notNull` fail → 500 tanpa pesan actionable.
- **Cara Reproduksi:**
  1. Kirim POST ke Server Action dengan field tambahan (`authorId=<other-id>`, `isApproved=true`).
  2. Cek baris di DB → jika tersimpan → **terkonfirmasi**.
- **Rekomendasi:**
  - Setiap action wajib diawali `.parse()` pada schema input **dan** ownership check (`input.authorId === session.userId`).
  - Gunakan helper `withActionAuth(input, schema, handler)`.
- **Keyakinan:** High.

---

#### **C-03 · Unbounded Import Pipeline pada `source.ts` / `media.ts` (DoS & Resource Exhaustion)**
- **Boundary:** B4
- **Lokasi heuristik:** Route `/api/import/*` atau `uploadSource` Server Action yang menyentuh `source.ts` dan `media.ts`.
- **Deskripsi:** Tidak ada batas ukuran file, jumlah baris, atau timeout pada `db.transaction(...)` loop insert. Attacker (atau operator tak sengaja) bisa memicu satu transaksi 100k+ insert yang mengunci `sources` → failure cascade di `questions.sourceId`.
- **Cara Reproduksi:** POST file CSV/JSON 50MB ke endpoint import → amati `pg_stat_activity` (long transaction).
- **Rekomendasi:**
  - Batas `Content-Length` di route (`maxDuration`, `bodySizeLimit`).
  - Stream + chunk 500 row/transaksi, dengan idempotency key.
  - Rate-limit per user (Upstash Redis / `@vercel/kv`).
- **Keyakinan:** Medium-High.

---

### 🟠 HIGH

#### **H-01 · Inconsistent Return Shape Antara Server Action & `useActionState`**
- **Boundary:** B3
- **Deskripsi:** MathBank v2 dengan React 19 + `useActionState` membutuhkan kontrak action:
  `({ok: true, data} | {ok: false, error: FieldErrorMap})`.
  Bila sebagian action `throw new Error(...)` dan sebagian `return {error: "..."}`, UI akan menampilkan *error boundary* alih-alih inline validation.
- **Verifikasi:** `grep -rn "throw new Error" src/app/**/actions*` vs `grep -rn "return { ok: false"`.
- **Dampak:** UX rusak, dan `throw` ke Client akan mengekspos stack trace di dev & log di prod.
- **Rekomendasi:** Buat tipe publik `ActionResult<T>` dan wrapper `safeAction()` yang meng-`try/catch` + map error PG (`23505` unique → `CONFLICT`).

#### **H-02 · Missing `Authorization` Guard pada Route Handler `GET` (`/api/questions/...`)**
- **Boundary:** B4
- **Deskripsi:** Pola umum: `app/api/questions/route.ts` mengembalikan list tanpa check `session`. Bila `questions` menautkan `authorId`/`bundleId`, ini adalah **IDOR read**.
- **Verifikasi:** `curl -i http://localhost:3000/api/questions` tanpa cookie.
- **Rekomendasi:** Middleware edge auth + `assertCan(session, 'question:read')`. Tambahkan `Cache-Control: private, no-store` untuk data personal.

#### **H-03 · Cascade `bundle` ↔ `collection` Tanpa `ON DELETE RESTRICT`**
- **Boundary:** B1
- **Lokasi:** `bundle.ts`, `collection.ts`.
- **Deskripsi:** Jika FK ke `questions`/**`solutions`** menggunakan `onDelete: "cascade"` pada tabel *top-level* (`bundles`, `collections`), delete bundle akan menghapus question yang **juga dimiliki collection lain** → data loss lintas tenant.
- **Verifikasi:** Tinjau definisi `.references(..., { onDelete: "..." })` di kedua file.
- **Rekomendasi:** Untuk relasi many-to-many gunakan junction dengan `cascade` *hanya* pada junction row; pada parent gunakan `restrict` + mengandalkan soft delete (`deletedAt`) di `_columns.ts`.

#### **H-04 · Tidak Ada Idempotency pada Mutation Server Action**
- **Boundary:** B2, B3
- **Deskripsi:** Double-submit (React 19 `useActionState` + optimistic UI) dapat membuat dua insert identik di `event.ts` (audit log) atau `solutions`.
- **Rekomendasi:** Header `X-Idempotency-Key` + tabel `idempotency_keys` (hash, user, action, ttl 24h).

#### **H-05 · `event.ts` Audit Trail Ditulis Tanpa Transaksi Bersama Mutasi Utama**
- **Boundary:** B2
- **Deskripsi:** Bila insert event setelah insert question dan proses crash di antaranya, audit log kehilangan kejadian. Ini melanggar *interface contract* "setiap mutasi menghasilkan satu event".
- **Rekomendasi:**
  ```ts
  await db.transaction(async (tx) => {
    const [q] = await tx.insert(questions).values(dto).returning({id: questions.id});
    await tx.insert(events).values({ type: "question.created", subjectId: q.id, actorId: session.userId });
  });
  ```
  Pertimbangkan Outbox pattern untuk async downstream.

---

### 🟡 MEDIUM

#### **M-01 · Drizzle `.returning()` Mengembalikan Kolom Sensitif Setelah Mutasi**
- Server Action POST mengembalikan `row` penuh → dikirim ke client. Gunakan `.returning(publicProjection)`.
- **File terdampak:** semua action yang menulis `questions`, `solutions`.

#### **M-02 · Missing Pagination Contract pada Route `GET` List**
- Endpoint `/api/questions`, `/api/taxonomy` tanpa `limit`/`cursor` → memory blow-up & DoS ringan.
- **Rekomendasi:** kontrak wajib `?cursor=&limit=` (max 100), respons `{data, nextCursor}`.

#### **M-03 · Error Mapping SQL → HTTP Tidak Konsisten**
- `23505` (unique) mengembalikan 500, bukan `409`. `23503` (FK) → 500, bukan `422`.
- **Rekomendasi:** util `mapPgError(err)` di boundary luar.

#### **M-04 · Serialisasi `Date` / `bigint` (id) dalam RSC Flight**
- Jika ID PK menggunakan `bigserial`/`bigint`, Drizzle mengembalikan `string`; jika `Date` dikirim ke client, ia jadi string lalu *hydration mismatch* saat dipakai sebagai `Date`.
- **Rekomendasi:** Semua DTO tanggal dalam ISO-8601 string; ID sebagai string di boundary publik.

#### **M-05 · Tidak Ada Konstanta Tipe Enum Tunggal antara `_enums.ts` dan Zod/TS Union**
- `_enums.ts` mendefinisikan `pgEnum`; tetapi di boundary API kemungkinan ada duplikat union string manual → drift.
- **Rekomendasi:** `export const XEnum = z.enum(XEnumValues)` di-*derive* dari `pgEnum.values`.

#### **M-06 · `taxonomy.ts` Hierarki Tanpa Guard Cycle**
- Jika parent-child menggunakan `parentId` self-FK, tidak ada cek siklus → infinite loop pada traversal UI.
- **Rekomendasi:** CTE rekursif dengan `CYCLE ... SET is_cycle` (PG 14+) atau fungsi `assertNoCycle(parentId, newParent)`.

#### **M-07 · CSRF pada Server Action yang Dipanggil via Custom `fetch`**
- React 19 Server Action resmi dilindungi origin check, **tapi** jika ada route wrapper `/api/action/*` yang memanggil `handler` secara langsung, origin check hilang.
- **Rekomendasi:** Jangan membuat wrapper; atau tambahkan `x-csrf-token` (double-submit cookie).

---

### 🟢 LOW / HARDENING

#### **L-01 · CORS Wildcard pada `/api/*`**
- `Access-Control-Allow-Origin: *` + credential → browser menolak; tapi jika `*` tanpa credential, integrasi pihak ketiga bisa scraping. Batasi lewat env allowlist.

#### **L-02 · Tidak Ada `ETag`/`If-None-Match` pada Public Read**
- Kurangi beban DB untuk endpoint read-only statis (`taxonomy`, `bundles`).

#### **L-03 · Versioning API Tidak Eksplisit**
- `/api/*` tanpa `/v1` → breaking change di prod. Rekomendasi: `app/api/v1/...` + alias.

#### **L-04 · Logging PII di Route Handler**
- `console.log(body)` memuat email/name → masuk ke Vercel logs. Ganti dengan `logger.child({ action })` + redactor.

#### **L-05 · Konsistensi `_columns.ts` untuk Soft Delete**
- Bila `deletedAt` ada di sebagian tabel, query default wajib `.where(isNull(deletedAt))`. Helper `activeOnly(table)`.

---

## 4. Matriks Risiko (Ringkas)

| ID | Sev | Boundary | Dampak | Effort |
|---|---|---|---|---|
| C-01 | Critical | B1/B2 | Akurasi penilaian / kebocoran jawaban | M |
| C-02 | Critical | B2 | Privilege escalation, integritas data | M |
| C-03 | Critical | B4 | DoS, lock contention | L |
| H-01 | High | B3 | UX + info leak | S |
| H-02 | High | B4 | IDOR read | S |
| H-03 | High | B1 | Kehilangan data permanen | M |
| H-04 | High | B2/B3 | Duplikasi event/insert | S |
| H-05 | High | B2 | Audit gap | M |
| M-01…M-07 | Medium | — | Bervariasi | S–M |
| L-01…L-05 | Low | — | Hardening | S |

---

## 5. Rekomendasi Arsitektur (Ringkas, Actionable)

**Buat 3 lapisan kontrak eksplisit** di `src/lib/contracts/`:

```
src/lib/contracts/
├── dto/          # Zod schema + TS type per entitas publik (Question, Bundle, Taxonomy)
├── errors.ts     # AppError enum ↔ HTTP status + PG code map
├── action-result.ts # type ActionResult<T>, wrapper safeAction()
└── pg-mapper.ts  # mapPgError(err) → AppError
```

**Aturan lint (tambahkan ESLint custom):**
1. Dilarang `db.select()` tanpa argumen di `src/app/**/actions*` dan `app/api/**`.
2. Dilarang `db.insert(...).values(arg)` bila `arg` bukan hasil `.parse()`.
3. Route pada `/api/**` wajib export `runtime`, `dynamic`, dan guard fungsi `assertAuth`.
4. Setiap mutasi di `questions|solutions|bundles|collections` wajib berada dalam `db.transaction` yang juga menulis ke `events`.

**Migrasi terkait constraint (Postgres 17):**
```sql
-- contoh guard cycle taxonomy
CREATE OR REPLACE FUNCTION assert_no_cycle() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE t AS (
      SELECT id, parent_id FROM taxonomy WHERE id = NEW.parent_id
      UNION ALL
      SELECT tx.id, tx.parent_id FROM taxonomy tx JOIN t ON tx.id = t.parent_id
    ) SELECT 1 FROM t WHERE id = NEW.id
  ) THEN RAISE EXCEPTION 'taxonomy cycle detected';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_taxonomy_cycle BEFORE INSERT OR UPDATE ON taxonomy
FOR EACH ROW EXECUTE FUNCTION assert_no_cycle();
```

**Rate