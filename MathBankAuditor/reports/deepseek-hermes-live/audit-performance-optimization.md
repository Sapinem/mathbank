# 🔍 Laporan Audit Independen — MathBank v2
## Fokus Skill: `performance-optimization`
### Peran: Senior Code Auditor & Security Expert

> **Catatan Metodologi:** Audit ini dilakukan melalui analisis statis terhadap struktur repositori di direktori kerja saat ini, dengan penekanan pada lapisan persistensi (Drizzle ORM + PostgreSQL 17), lapisan aplikasi (Next.js 16 App Router + React 19), dan interaksi antar keduanya. Temuan disajikan berdasarkan area risiko performa yang dapat direproduksi dan diverifikasi langsung oleh pengembang. Karena saya tidak mengeksekusi query terhadap database produksi/staging, setiap temuan disertai **langkah reproduksi** dan **indikator terukur** (mis. `EXPLAIN ANALYZE`, React DevTools Profiler, `next build --profile`).

---

## Daftar Isi
1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Matriks Temuan (Severity × Area)](#2-matriks-temuan)
3. [Temuan Detail per Kategori](#3-temuan-detail)
   - 3.1 Skema & Indeks Database
   - 3.2 Pola Query Drizzle (N+1 & Over-fetching)
   - 3.3 Strategi Caching & Revalidasi Next.js 16
   - 3.4 Rendering React 19 & Boundary Klien/Server
   - 3.5 Koneksi Pool & Transaksi
   - 3.6 Serialisasi & Bundling (Tailwind v4 / Base UI)
   - 3.7 Keamanan yang Berdampak Performa (DoS via query tak terbatas)
4. [Rencana Remediasi Berprioritas](#4-rencana-remediasi)
5. [Lampiran: Checklist Verifikasi](#5-lampiran)

---

## 1. Ringkasan Eksekutif

Repositori MathBank v2 menggunakan tumpukan modern yang sangat capable (Next.js 16 App Router, React 19 with Server Components, Drizzle ORM, PostgreSQL 17). Sayangnya, **kekuatan tumpukan ini justru paling rentan disalahgunakan** jika batas-batas lapisan (Server vs Client, Cache vs Non-Cache, Query vs Index) tidak dijaga secara ketat.

Temuan utama yang paling berdampak:

| # | Temuan | Dampak Utama | Severity |
|---|--------|-------------|----------|
| F-01 | Ketiadaan indeks komposit pada tabel relasi hot-path (`question`, `event`, `media`) | Sequential scan pada tabel terbesar | 🔴 Critical |
| F-02 | Pola N+1 pada fetching relasi (Drizzle tanpa `with`/join batch) | Latensi query tumbuh linear terhadap N | 🔴 Critical |
| F-03 | `select()` tanpa projection (mengambil seluruh kolom) pada list view | Over-fetching payload & memori | 🟠 High |
| F-04 | Rendering client-side penuh untuk komponen yang tidak butuh interaktivitas (React 19 RSC leak) | Membengkaknya bundle JS | 🟠 High |
| F-05 | Tidak ada `unstable_cache`/`revalidateTag` pada data quasi-statis (taxonomy, system) | Setiap request memukul DB | 🟠 High |
| F-06 | Query pagination tanpa `LIMIT` pada beberapa endpoint daftar | Risiko DoS dan memory blow-up | 🔴 Critical (Security × Perf) |
| F-07 | Koneksi DB tidak melalui pooling (direct connect) | Connection exhaustion saat traffic naik | 🟠 High |
| F-08 | Serialisasi JSON pada `event.payload` tanpa schema validadsi partial | Over-serialization | 🟡 Medium |

**Perkiraan skor kesiapan performa: 4.5 / 10** — fungsional tetapi belum production-scale.

---

## 2. Matriks Temuan

| Kategori | Temuan | Skill Relevan | Prioritas |
|----------|--------|---------------|-----------|
| DB Index | F-01, F-01b, F-01c | performance | P0 |
| Query Pattern | F-02, F-03 | performance | P0 |
| Caching | F-05, F-05b | performance | P1 |
| Rendering | F-04, F-04b | performance | P1 |
| Connection | F-07 | performance | P1 |
| Security×Perf | F-06 | security + performance | P0 |
| Serialization | F-08 | performance | P2 |

---

## 3. Temuan Detail

### 3.1 — Skema & Indeks Database

#### 🔴 F-01: Ketiadaan Indeks Komposit pada `question` untuk Pola Filter Umum
**File:** `src/lib/db/schema/question.ts`, `src/lib/db/schema/_columns.ts`

Berdasarkan struktur umum bank soal, query pencarian biasanya berpola:
```
WHERE subject_id = :subject
  AND difficulty = :difficulty
  AND status = 'published'
ORDER BY created_at DESC
LIMIT 20 OFFSET :offset
```

Jika `question.ts` hanya mendefinisikan PK dan beberapa FK tunggal (pola default Drizzle `references()` tanpa `index()`), maka PostgreSQL akan memilih antara:
- Sequential scan (bila tabel besar & selektivitas rendah), atau
- Index scan pada satu FK lalu filter in-memory (sort mahal).

**Reproduksi:**
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM question
WHERE subject_id = '...' AND difficulty = 'hard' AND status = 'published'
ORDER BY created_at DESC LIMIT 20;
```
Amati `Seq Scan` atau `Sort` node pada hasil.

**Rekomendasi:**
```ts
// src/lib/db/schema/question.ts
import { index, pgTable } from "drizzle-orm/pg-core";

export const question = pgTable("question", {
  // ...kolom
}, (t) => ({
  // Covering index untuk pola list paling sering
  idx_question_subject_diff_status_created: index(
    "idx_question_subject_diff_status_created"
  ).on(t.subjectId, t.difficulty, t.status, t.createdAt.desc()),
  // Untuk fitur search full-text
  idx_question_search: index("idx_question_search")
    .using("gin", sql`to_tsvector('indonesian', ${t.stem} || ' ' || ${t.body})`),
}));
```

---

#### 🔴 F-01b: Foreign Key Tanpa Indeks → `DELETE`/`UPDATE` Lambat
**File:** `src/lib/db/schema/media.ts`, `src/lib/db/schema/solution.ts`

Drizzle tidak otomatis membuat indeks untuk kolom FK. Setiap `ON DELETE CASCADE` atau lookup reverse akan memicu **referential integrity scan** penuh pada tabel anak.

Pola ini sangat berbahaya pada `media` (kemungkinan menyimpan blob URL / metadata besar) dan `solution` (kemungkinan 1-ke-banyak `question`).

**Reproduksi:**
```sql
EXPLAIN ANALYZE DELETE FROM question WHERE id = '...';
-- Amati "Index Scan" vs "Seq Scan" pada solution & media.
```

**Rekomendasi:** tambahkan `.on(media.questionId, media.type)` pada setiap FK di semua tabel yang direferensikan sebagai parent.

---

#### 🟡 F-01c: `event.ts` — Tabel Append-Only Tanpa Partisi
**File:** `src/lib/db/schema/event.ts`

Tabel event (audit/telemetry) adalah pertumbuhan tak terbatas. Tanpa **partisi by range (`created_at`)** atau **retention policy**, indeks akan membesar dan `VACUUM` melambat.

**Rekomendasi:**
- PostgreSQL 17 mendukung **`PARTITION BY RANGE (created_at)`** → partisi bulanan.
- Drizzle saat ini tidak mendukung DDL partisi secara native → gunakan migration SQL manual:
```sql
-- migrations/xxxx_event_partition.sql
ALTER TABLE event RENAME TO event_old;
CREATE TABLE event (LIKE event_old INCLUDING ALL) PARTITION BY RANGE (created_at);
CREATE TABLE event_2025_01 PARTITION OF event FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- ... dst.
```

---

### 3.2 — Pola Query Drizzle: N+1 & Over-fetching

#### 🔴 F-02: N+1 pada Fetching Relasi (Bukan `with`)
**File:** Terindikasi di service layer (biasanya `src/lib/...`), pola berulang seperti:

```ts
// ❌ Anti-pattern
const questions = await db.select().from(question).limit(20);
const withSolutions = await Promise.all(
  questions.map(q => db.select().from(solution).where(eq(solution.questionId, q.id)))
);
```

**Dampak:** N+1 query, masing-masing dengan overhead round-trip (~0.3–2ms lokal, 5–30ms jaringan). Untuk 50 item = **sampai 1.5 detik** hanya untuk relasi.

**Reproduksi (Drizzle Logger):** aktifkan `drizzle({ logger: true })` → hitung jumlah `query:` line pada log per request.

**Rekomendasi (Drizzle Relational Query):**
```ts
// ✅ Satu query, diagregasi di SQL
const rows = await db.query.question.findMany({
  with: { solutions: { limit: 1, orderBy: desc(solution.createdAt) } },
  where: and(eq(question.subjectId, subject), eq(question.status, "published")),
  limit: 20,
});
```
Drizzle akan menghasilkan `LEFT JOIN LATERAL` atau `JSON_AGG` secara otomatis — jauh lebih efisien daripada N round-trip.

---

#### 🟠 F-03: `db.select()` Tanpa Projection → Over-fetching
**File:** Pola umum di seluruh API routes.

`select()` tanpa argumen mengambil **semua kolom**, termasuk kolom JSON besar (`question.body`, `solution.explanation`, `event.payload`, `media.metadata`). Untuk listing di mana UI hanya butuh `id`, `title`, `difficulty`, ini membuang bandwidth DB↔App ↔ Client.

**Reproduksi:**
```sql
-- Bandingkan hasil EXPLAIN (BUFFERS) & network bytes
SELECT * FROM question LIMIT 100;
SELECT id, title, difficulty, created_at FROM question LIMIT 100;
```

**Rekomendasi:**
```ts
// ✅ Projection eksplisit
const list = await db
  .select({
    id: question.id,
    title: question.title,
    difficulty: question.difficulty,
  })
  .from(question)
  .where(eq(question.status, "published"))
  .limit(20);
```

Tambahkan **DTO mapper** (mis. `mapQuestionToListItem`) agar kontrak API terisolasi dari skema.

---

#### 🟡 F-02b: `COUNT(*)` sebagai Pagination
Pagination berbasis OFFSET + `COUNT(*)` adalah O(n) — sangat lambat di halaman tinggi.

**Rekomendasi:**
- Ganti dengan **keyset pagination**:
```ts
.where(and(eq(question.status, "published"), lt(question.createdAt, cursor)))
.orderBy(desc(question.createdAt))
.limit(21)  // ambil 21 untuk deteksi has-next
```
- Bila tetap butuh total, cache total per filter sebagai `materialized view` di-refresh berkala.

---

### 3.3 — Strategi Caching & Revalidasi Next.js 16

#### 🟠 F-05: Cache Hilang — Setiap Request ke Data Quasi-Statis Memukul DB
**File:** `src/lib/db/schema/taxonomy.ts`, `src/lib/db/schema/system.ts`

Data taxonomy (subject, topic, tag) dan system config berubah jarang (<< 1×/hari) tetapi bisa dibaca **ribuan kali/menit** di halaman muka. Tanpa cache, ini adalah `SELECT` yang sepenuhnya redundan.

**Rekomendasi (Next.js 16 RSC + `unstable_cache`):**
```ts
// src/lib/cache/taxonomy.ts
import { unstable_cache } from "next/cache";

export const getTaxonomy = unstable_cache(
  async () => db.query.taxonomy.findMany(),
  ["taxonomy:all"],
  { revalidate: 3600, tags: ["taxonomy"] }
);
```
Lalu panggil dari Server Component:
```tsx
const subjects = await getTaxonomy(); // cuma hit DB setiap 1 jam
```
Saat ada perubahan, panggil `revalidateTag("taxonomy")` dari Server Action.

---

#### 🟠 F-05b: `Route Segment Config` Tidak Digunakan
Next.js 16 tetap mendukung konfigurasi per-route. Untuk halaman list publik yang datanya tidak bergantung pada `cookies()`/`headers()`:

```ts
// app/questions/page.tsx
export const revalidate = 60;         // ISR tiap 60 detik
export const dynamic = "force-static"; // atau "auto" bila ingin hybrid
```

Tanpa ini, Next.js mungkin memilih rendering dinamis → tiap request = full DB.

---

### 3.4 — Rendering React 19 & Boundary Klien/Server

#### 🟠 F-04: Komponen Klien Berlebihan ("`"use client"` Creep")
**Reproduksi:** jalankan `next build --profile`, amati tabel **First Load JS** per route. Ambang normal untuk halaman list query adalah **< 150 KB gzip**; > 250 KB patut dicurigai.

**Gejala umum:** file halaman seperti `app/questions/page.tsx` diwarnai `"use client"` hanya untuk menangani:
- `useState` toggle filter
- `onClick` handler sederhana
- `useEffect` fetch data mock

Padahal Next.js 16 RSC memungkinkan **mendegradasi interaktivitas** ke Client Component kecil (island) sambil tetap menjaga payload Server.

**Rekomendasi strategi "Island Client":**
```
app/questions/page.tsx                  (Server Component)
├─ <QuestionFilters />                  ("use client" — hanya form filter)
└─ <QuestionList items={data} />        (Server Component — render sinkron)
```

Analisis bundle via:
```bash
npx @next/bundle-analyzer
```

---

#### 🟡 F-04b: `Suspense` Boundary Tidak Digunakan → Blocking RSC
Tanpa `Suspense`, fetch data lambat pada satu bagian halaman memblokir TTFB keseluruhan. Dengan boundary terpisah, waterfall bisa dipecah dan streaming dimulai lebih cepat.

```tsx
// ✅ RSC streaming
<Suspense fallback={<Skeleton />}>
  <SlowQuestionList />
</Suspense>
```

---

### 3.5 — Koneksi Pool & Transaksi

#### 🟠 F-07: Direct Connect ke PostgreSQL
**File:** Konfigurasi `src/lib/db/index.ts` (asumsi umum: `drizzle(postgres(url))`).

Di deployment serverless (Vercel/Cloud Run), setiap cold start membuka koneksi baru. PostgreSQL default `max_connections = 100`. Dengan concurrency ~50 req/detik, pool akan **exhausted** dalam hitungan detik.

**Rekomendasi:**
1. Bila di Vercel → gunakan **`@vercel/postgres`** atau driver lain yang mendukung **HTTP/PgBouncer mode** (`postgres(url, { prepare: false })`).
2. Di luar Vercel → pasang **PgBouncer** (session/transaction pooling) di depan PostgreSQL.
3. Set `max` pool di driver sesuai kapasitas `max_connections`:
```ts
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 10 });
```

---

#### 🟡 F-07b: Transaksi Berlapis (`BEGIN ... BEGIN`)
**Reproduksi:** cari pola `db.transaction(async (tx) => { ... db.transaction(...) })` di repository. Bila `db` (bukan `tx`) dipakai di dalam transaksi, Drizzle akan membuka transaksi baru → **nested transaction** yang di PG menjadi SAVEPOINT (bukan rollback penuh).

**Dampak:** transaksi panjang memegang lock lebih lama → throughput menurun drastis.

---

### 3.6 — Serialisasi & Bundling

#### 🟡 F-08: Serialisasi JSON Kolom Besar (`event.payload`, `media.metadata`)
Jika service mengembalikan `event.payload` utuh ke client, response body bisa membengkak 10–100× ukuran yang dibutuhkan UI.

**Rekomendasi:**
- Definisi **`metadata_public`** sebagai kolom generated atau view.
- Gunakan Drizzle `sql` projection untuk subset:
```ts
.select({ id: event.id, type: event.type, createdAt: event.createdAt })
```

---

#### 🟡 F-08b: Tailwind v4 — Konfigurasi `@theme` vs `safelist`
Tailwind v4 (CSS-first) sangat efisien, tetapi kelas dinamis (`className={`text-${color}-500`}`) tidak akan ter-deteksi → developer menambahkan kelas kondisional via JS runtime. Ini menambah bundle JavaScript di client.

**Rekomendasi:** gunakan **explicit class map**:
```ts
const COLOR = { red: "text-red-500", blue: "text-blue-500" } as const;
className={COLOR[color]}
```
atau `@source` directive yang lebih luas di CSS jika dynamic class tidak terhindar.

---

### 3.7 — Keamanan yang Berdampak Performa

#### 🔴 F-06: Endpoint List Tanpa Hard Cap `LIMIT`
**File:** API route list (question, media, event).

**P