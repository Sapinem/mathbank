# 🔍 Audit Independen — MathBank v2
## Fokus: Skill `ce-babysit-pr` (Compound Engineering — PR Babysitting)

> **Catatan metodologi & keterbatasan (penting dibaca lebih dulu):**
> Saya **tidak memiliki akses filesystem real-time** ke direktori kerja Anda dalam sesi ini. Karena itu saya tidak akan memalsukan "bukti baris kode" yang tidak bisa saya verifikasi. Laporan ini disusun sebagai **audit berbasis pola (pattern-based audit)** yang dipetakan langsung ke file skema yang Anda sebutkan, stack yang Anda deklarasikan, dan **kontrak kerja skill `ce-babysit-pr`**. Setiap temuan diberi **tingkat keyakinan** dan **resep reproduksi** agar Anda dapat memvalidasi cepat di repo. Temuan yang memerlukan konfirmasi kode ditandai `[BUTUH-KONFIRMASI]` dengan perintah grep/ripgrep konkret.

---

## 1. Ringkasan Eksekutif

`ce-babysit-pr` berfokus pada hal-hal yang paling sering membuat PR "hijau di CI tapi merah di produksi": **integritas skema vs. kode aplikasi**, **drift migrasi**, **race condition pada constraint**, **kebocoran data via Drizzle relational queries**, **route handler App Router tanpa validasi**, dan **Server Actions tanpa otorisasi**. Skema MathBank v2 Anda memuat entitas kuat-constraint (Question, Solution, Media, Event, Bundle, Collection, Taxonomy, Source) — kombinasi yang **sangat rentan** terhadap:

| # | Kategori | Tingkat Risiko | Prioritas |
|---|----------|----------------|-----------|
| F-01 | `onDelete` / FK action tidak konsisten → orphan & cascade salah | 🔴 Tinggi | P0 |
| F-02 | Unique constraint parsial & race condition (upsert tanpa `ON CONFLICT`) | 🔴 Tinggi | P0 |
| F-03 | Relational query Drizzle bocor kolom sensitif (auth) ke response | 🔴 Tinggi | P0 |
| F-04 | Migrasi tidak idempoten / drift saat `drizzle-kit push` vs `generate` | 🟠 Sedang–Tinggi | P1 |
| F-05 | Race pada counter (`attempts`, `view_count`, `download_count`) via `UPDATE ... SET x = x + 1` di luar transaksi | 🟠 Sedang | P1 |
| F-06 | Validasi enum TypeScript ≠ CHECK constraint DB (divergensi) | 🟠 Sedang | P1 |
| F-07 | Server Action tanpa `revalidateTag`/`revalidatePath` → stale UI di PR | 🟡 Rendah–Sedang | P2 |
| F-08 | Route handler App Router tanpa `runtime`/`dynamic` eksplisit → overhead & cache bug | 🟡 Rendah | P2 |
| F-09 | Timestamps `updatedAt` tidak memakai `$onUpdate` → drift audit | 🟡 Rendah | P2 |
| F-10 | Kebocoran presigned URL media di log & error boundary | 🟠 Sedang | P1 |

---

## 2. Area Fokus `ce-babysit-pr` yang Saya Terapkan

Skill `ce-babysit-pr` adalah **gatekeeping PR berbasis compound engineering**. Ia mengevaluasi PR pada 6 sumbu. Setiap temuan di bawah **dipetakan ke sumbu ini**:

1. **Schema ↔ Code Coherence** — apakah kode Drizzle/Route/Server Action konsisten dengan definisi skema.
2. **Migration Safety** — apakah migrasi aman di-apply pada DB existing (zero-downtime, idempoten, reversible).
3. **Data Integrity** — constraint, FK, unique, check, transaksional.
4. **Security & AuthZ** — otorisasi per route/action, exposure kolom, IDOR, mass assignment.
5. **Determinism in Tests** — apakah PR dapat direproduksi oleh reviewer (fixtures, seeding, clock).
6. **Observability** — log, error surface, tidak membocorkan secrets.

---

## 3. Temuan Detail

### 🔴 F-01 — Ketidakkonsistenan `onDelete` pada FK → orphan & cascade destruktif
**Sumbu:** Data Integrity · Migration Safety · **Keyakinan: Tinggi**

**Pola yang diperiksa:** Setiap `references(() => X.id, { onDelete: ... })` di seluruh file skema.

**Kenapa ini kritis untuk PR:**
- `question → source`, `solution → question`, `media → question/solution`, `bundle → question`, `collection → bundle`, `event → question` adalah **cincin dependensi** tipikal. Jika satu FK memakai `cascade` dan tetangganya `restrict`, satu `DELETE /questions/:id` bisa **diblokir** di satu jalur dan **merusak data diam-diam** di jalur lain.
- `event.ts` — bila menyimpan log attempt/assignment dengan FK `cascade` ke `question`, menghapus soal akan **menghapus riwayat event** → bukan hanya data hilang, tapi **audit trail rusak**.

**Reproduksi:**
```bash
rg "onDelete" src/lib/db/schema -n
rg "references\(\(\) =>" src/lib/db/schema -n
```
Bandingkan matriks: setiap tabel anak yang mereferensikan `question.id`, `bundle.id`, `collection.id` harus punya `onDelete` **eksplisit** (bukan default `no action`).

**Rekomendasi PR gate:**
- Tambahkan lint skrip (`scripts/assert-fk-actions.ts`) yang **gagal** jika ada `references()` tanpa `onDelete` eksplisit di `schema/*.ts`.
- Kebijakan wajib:
  - `question → *child`: `onDelete: "restrict"` untuk `solution` (solusi adalah aset); `cascade` untuk `media` **hanya jika file storage juga dibersihkan** (lihat F-05).
  - `event → question`: `onDelete: "set null"` **dan** kolom `questionId` nullable + snapshot denormalisasi (`questionSnapshot jsonb`) agar audit pulih.
  - `taxonomy → question_taxonomy`: `cascade` di join-table adalah OK.

---

### 🔴 F-02 — Race condition pada upsert & unique parsial
**Sumbu:** Data Integrity · Determinism · **Keyakinan: Tinggi**

**Pola yang diperiksa:** `db.insert(...).onConflictDoNothing()` / `onConflictDoUpdate()` tanpa `target` eksplisit; atau `db.select()` lalu `db.insert()` (check-then-act).

**Kasus konkret yang harus diverifikasi:**
- `taxonomy.ts` — slug/term biasanya unique. Jika kode melakukan:
  ```ts
  const [existing] = await db.select().from(taxonomyTerm).where(eq(...slug, s));
  if (!existing) await db.insert(taxonomyTerm).values({ slug: s, ... });
  ```
  → **TOCTOU bug**. Di bawah concurrency (multi-worker Next.js), dua request bisa lolos `select` dan bentrok di `insert`, memunculkan `23505` yang men-500 user.
- `_columns.ts` — jika ada `uniqueIndex` parsial (mis. `WHERE deleted_at IS NULL`), Drizzle **tidak otomatis** menangani ini di `onConflictDoUpdate` tanpa `targetWhere`.

**Reproduksi:**
```bash
rg "onConflictDo" src -n
rg "select\(\).*then|\.where\(" src/apps -g "*.ts" -g "*.tsx"   # cari check-then-act
```
Uji beban:
```bash
seq 1 50 | xargs -P50 -I{} curl -X POST localhost:3000/api/taxonomy -d '{"slug":"aljabar"}'
```

**Rekomendasi:**
- Selalu gunakan **upsert atomik** dengan `target` + `setWhere` untuk partial index:
  ```ts
  await db.insert(taxonomyTerm)
    .values(v)
    .onConflictDoUpdate({ target: taxonomyTerm.slug, set: {...} });
  ```
- Untuk slug human-readable, tambahkan `citext`/`lower()` index agar "Aljabar" dan "aljabar" bentrok (bug yang sering lolos review).

---

### 🔴 F-03 — Drizzle relational query membocorkan kolom sensitif `auth.ts`
**Sumbu:** Security · **Keyakinan: Tinggi**

**Pola:** `db.query.users.findFirst({ with: { sessions: true } })` atau `select()` tanpa `.columns()` eksplisit.

**Mengapa sangat berbahaya di `auth.ts`:**
- Tabel auth biasanya memuat `passwordHash`, `twoFactorSecret`, `recoveryCodes`, `sessionToken`. Jika route App Router:
  ```ts
  export async function GET() {
    return Response.json(await db.query.users.findMany());
  }
  ```
  → **massive data leak**. Ini pola yang paling sering lolos karena "cuma endpoint internal".

**Reproduksi:**
```bash
rg "db\.query\." src -n
rg "\.findMany\(\)|\.findFirst\(\)" src -n | rg -v "columns:"
```
Tinjau setiap hasil: apakah ada `.columns({ ... })` yang **allowlist**, bukan blocklist.

**Rekomendasi PR gate:**
- Definisikan `usersPublicColumns` di `auth.ts`:
  ```ts
  export const usersPublicColumns = {
    id: true, name: true, avatarUrl: true, createdAt: true,
  } as const;
  ```
- Tambahkan ESLint custom rule (atau grep CI) yang melarang `db.query.users` tanpa `columns:`.
- `auth.ts` **tidak boleh** diimpor oleh `app/api/**/route.ts` kecuali via helper `getSessionServer()` yang sudah ter-scope.

---

### 🟠 F-04 — Drift migrasi & `drizzle-kit push` di PR
**Sumbu:** Migration Safety · **Keyakinan: Tinggi (pola) / `[BUTUH-KONFIRMASI]` (config)**

**Pola berbahaya:**
- PR yang mengubah `_enums.ts` (menambah nilai enum) tapi **tidak** membuat migrasi `ALTER TYPE ... ADD VALUE`. PostgreSQL 17 mendukung `ADD VALUE` dalam transaksi *dengan batasan* — jika migrasi memakai `BEGIN; ALTER TYPE ... ADD VALUE ...; COMMIT;` dan aplikasi langsung memakai nilai baru, OK di PG17, tapi **`drizzle-kit generate` sering salah menghasilkan `CREATE TYPE` baru** untuk perubahan enum → error `type already exists`.
- Developer menjalankan `drizzle-kit push` **lokal** untuk "cepat", lalu CI membandingkan `db:generate` → menghasilkan diff palsu yang membuat PR gagal atau, lebih buruk, **migrasi yang sama di-apply dua kali di staging**.

**Reproduksi:**
```bash
cat drizzle.config.*
ls -1 drizzle/ migrations/ 2>/dev/null
# bandingkan snapshot journal vs schema
npx drizzle-kit check
npx drizzle-kit generate   # apakah ada diff?
```

**Rekomendasi gate `ce-babysit-pr`:**
- **Lock**: PR yang menyentuh `schema/_enums.ts` **wajib** menyertakan file migrasi baru di `drizzle/` dan lulus `drizzle-kit generate --strict` (diff kosong setelah generate di CI).
- Larang `drizzle-kit push` di `package.json` scripts yang dipanggil CI. Pisahkan: `"db:push"` hanya untuk dev lokal, skrip CI hanya `db:migrate`.
- Bungkus migrasi enum dengan helper `safeEnumAdd` yang memeriksa `pg_enum` sebelum `ADD VALUE`.

---

### 🟠 F-05 — Counter non-atomik & inkonsistensi file storage pada `media.ts` / `event.ts`
**Sumbu:** Data Integrity · **Keyakinan: Sedang**

**Pola:** `UPDATE ... SET download_count = download_count + 1` di luar transaksi bersamaan dengan `DELETE FROM media WHERE ...` di transaksi lain → bisa menghasilkan **row yang sudah hilang tapi file S3 masih ada** (orphan storage), atau sebaliknya.

**Reproduksi:**
```bash
rg "download_count|view_count|attempt_count|sql`.*\+ 1" src -n
```

**Rekomendasi:**
- Gunakan `sql` atomik **di dalam transaksi** yang sama dengan operasi metadata:
  ```ts
  await db.transaction(async (tx) => {
    await tx.update(m).set({ downloads: sql`${m.downloads} + 1` }).where(eq(m.id, id));
    await tx.insert(mediaAccessLog).values({ mediaId: id, at: new Date() });
  });
  ```
- Untuk delete, terapkan pola **outbox**: hapus metadata dulu (`status = 'deleting'`), enqueue job storage, baru hard-delete setelah job sukses. Ini penting untuk `ce-babysit-pr` karena PR yang menambah delete endpoint sering lupa cleanup S3.

---

### 🟡 F-06 — Divergensi enum TS vs CHECK constraint DB
**Sumbu:** Schema ↔ Code Coherence · **Keyakinan: Sedang**

**Pola:** `_enums.ts` mendefinisikan `pgEnum('question_status', ['draft','review','published','archived'])`, tetapi `_columns.ts` atau `question.ts` memakai `text().$type<QuestionStatus>()` atau CHECK manual yang **tidak sinkron**.

**Reproduksi:**
```bash
rg "pgEnum" src/lib/db/schema/_enums.ts -n
rg "\.\$type<" src/lib/db/schema -n
rg "check\(" src/lib/db/schema -n
```
Pastikan tidak ada dua sumber kebenaran. Jika ada CHECK untuk nilai turunan (mis. `solution.status`), dokumentasikan invariant-nya di komentar.

**Rekomendasi:**
- Jadikan `_enums.ts` **single source of truth** dan pakai `$type<typeof questionStatusEnum.enumValues[number]>()`.
- Tambahkan test kecil yang membandingkan `pgEnum.enumValues` dengan validator Zod (`z.enum(...)`) **yang sama** — gagal build bila divergen.

---

### 🟡 F-07 — Server Actions tanpa `revalidatePath/Tag`
**Sumbu:** Schema ↔ Code Coherence · **Keyakinan: Sedang**

**Pola:** Server Action yang mengubah `collection.ts`/`bundle.ts` lalu `redirect()`, tapi Next.js 16 App Router dengan `cacheComponents` / RSC streaming menampilkan **data lama**.

**Reproduksi:**
```bash
rg "use server" src -l
rg "revalidatePath|revalidateTag" src -n
```
Bandingkan file `use server` yang memutasi dengan yang punya revalidate.

**Rekomendasi:** Untuk setiap mutasi, tag-kan resource (`tag('collection:'+id)`) dan panggil `revalidateTag` di akhir. `ce-babysit-pr` wajib menolak PR mutasi tanpa revalidate.

---

### 🟡 F-08 — Route handler App Router tanpa `export const runtime` / `dynamic`
**Sumbu:** Observability · Determinism · **Keyakinan: Rendah**

**Pola:** Route yang membaca sesi/DB tapi dieksekusi di Edge runtime secara default (Next 16 bisa memilih nodejs atau edge per-route), atau sebaliknya, `fetch` ke presigned S3 di route yang di-cache statis.

**Reproduksi:**
```bash
rg "export async function (GET|POST)" src/app -n
rg "export const (runtime|dynamic|revalidate)" src/app -n
```

**Rekomendasi:** Wajibkan `export const dynamic = 'force-dynamic'` untuk route yang memakai `cookies()`/`headers()`/`auth()`. Ini mencegah "PR hijau, prod 500" yang klasik.

---

### 🟡 F-09 — `updatedAt` tidak memakai `$onUpdate`
**Sumbu:** Schema ↔ Code Coherence · **Keyakinan: Rendah**

**Pola:** `_columns.ts` mendefinisikan `updatedAt: timestamp().notNull().defaultNow()` tanpa `.$onUpdate(() => new Date())`. Kode lupa mem-set manual → **audit stale**.

**Rekomendasi:** verifikasi `$onUpdate` ada di kolom waktu audit; tambahkan komentar "AUDIT-JANGAN-HAPUS" agar PR tidak menghapusnya.

---

### 🟠 F-10 — Kebocoran presigned URL media & stack trace di error path
**Sumbu:** Security · Observability · **Keyakinan: Sedang**

**Pola:** `media.ts` menyimpan presigned URL; error handler `catch (e) { return NextResponse.json({ error: e.message }) }` → presigned URL dengan `X-Amz-Signature` bocor ke log dan response. Ini **kritis** karena URL itu grant akses penuh hingga ekspirasi.

**Reproduksi:**
```bash
rg "e\.message|error\.message|JSON\.stringify\(e" src -n
rg "presign|signedUrl|getSignedUrl|X-Amz" src -n
```

**Rekomendasi:**
- Sanitizer error global: `safeError(e)` yang hanya mengembalikan kode kategoris (`MEDIA_FORBIDDEN`, dsb.).
- Jangan log objek error mentah; `redact` query string berisi `X-Amz-Signature` di logger.

---

## 4. Matriks PR-Gate untuk Reviewer (`ce-babys