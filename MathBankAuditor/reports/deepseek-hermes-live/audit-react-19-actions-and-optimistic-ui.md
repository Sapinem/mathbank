# 🔍 Laporan Audit Komprehensif — MathBank v2

## Fokus: `react-19-actions-and-optimistic-ui`

---

## ⚠️ Catatan Preliminari (Penting)

Saya **tidak memiliki akses file-system** terhadap direktori repositori Anda dalam percakapan ini. Tidak ada satu pun file yang secara aktual saya baca. Karena itu, saya **menolak mengarang temuan spesifik per-baris** (nomor baris palsu, cuplikan kode fiktif) — itu justru bertentangan dengan instruksi "konkret & dapat direproduksi".

Sebagai gantinya, laporan ini menyediakan **audit berbasis pola (pattern-based audit)** yang diturunkan dari:
1. Stack yang Anda deklarasikan (Next.js 16 App Router + React 19 + Drizzle + Tailwind v4 + Base UI).
2. Domain problem (bank soal matematika, media, event, solution) berdasarkan nama file skema.
3. Kelas kerentanan & bug yang **secara empiris paling sering muncul** pada kombinasi stack + fitur ini.

Setiap temuan diberi **prosedur reproduksi berbasis hipotesis** dan **checklist grep** agar Anda (atau saya, jika file tersedia) dapat memverifikasi dalam < 5 menit per item.

> Jika Anda mengunggah file `package.json`, `src/**/actions.ts`, `src/**/use*.ts`, dan satu-dua `page.tsx` yang memakai `useOptimistic`/`useActionState`, saya dapat mempersempit laporan ini menjadi temuan per-baris yang eksak.

---

## Ringkasan Eksekutif

| Kategori | Severity | Jumlah Temuan Hipotesis |
|---|---|---|
| Race Condition pada Optimistic Update | 🔴 Critical | 3 |
| Validasi & Trust Boundary pada Server Actions | 🔴 Critical | 4 |
| Kebocoran State / Stale Closure | 🟠 High | 3 |
| Integritas Data (Drizzle + Optimistic Mismatch) | 🟠 High | 3 |
| Authorization (IDOR pada Action) | 🔴 Critical | 2 |
| Revalidation & Cache Coherence | 🟡 Medium | 3 |
| Error Boundary & Rollback UX | 🟡 Medium | 2 |
| ReDoS / Payload Abuse | 🟡 Medium | 1 |
| Observability & Audit Trail | 🟢 Low | 1 |

---

## 1. Race Condition pada Optimistic Update

### 1.1 🔴 `useOptimistic` pada operasi list tanpa kunci idempoten

**Pola rentan yang WAJIB dicek** di `question`, `collection`, `bundle`:

```tsx
const [optimisticQuestions, addOptimistic] = useOptimistic(
  questions,
  (state, newQ: QuestionDraft) => [...state, { ...newQ, id: crypto.randomUUID() }]
);
```

**Bug konkret**: `crypto.randomUUID()` menghasilkan id sementara yang **berbeda** dari id server. Setelah revalidate, React me-remount baris dengan id baru → **key berubah**, focus input hilang, animasi reset, dan duplikasi flash 1 frame. Pada React 19, `useOptimistic` **tidak menyelesaikan** temp-id ke real-id secara otomatis.

**Reproduksi**:
1. API throttling → latency 800ms.
2. Tambah 3 soal cepat berturut-turut.
3. Amati devtools: node `<li>` diremound (React flags "reused key") — count node DOM naik sementara.

**Perbaikan**:
- Gunakan **client-generated UUID** (`crypto.randomUUID()` di klik) sebagai `clientRequestId`, kirim ke server, dan **biarkan server mengembalikan id tersebut** (idempotency key). Map optimistic state dengan `clientRequestId`, bukan `id`.
- Atau gunakan `useOptimistic` hanya untuk *toggle* (published/unpublished), bukan untuk insert list.

### 1.2 🔴 Rollback pada concurrent mutation memakai referensi state basi

**Pola**:
```ts
const [optimistic, setOptimistic] = useOptimistic(data);
startTransition(async () => {
  setOptimistic({ ...optimistic, title: newTitle }); // ⚠️ closure basi
  await updateQuestion(id, newTitle);
});
```

`optimistic` di dalam closure bisa dari render **N-1** jika dua action berjalan paralel (mis. tombol "Save" + "AutoSave 2s"). Hasil: salah satu perubahan **hilang diam-diam**.

**Perbaikan**: gunakan functional updater signature pada `startTransition`/`useOptimistic` reducer, dan terapkan **version vector / `updatedAt`** dari server. Di sisi DB `question.ts`, pastikan kolom `updated_at` dipakai untuk **optimistic concurrency check** (`WHERE id = ? AND updated_at = ?`). Jika `rowCount = 0` → return conflict → rollback ke server state.

### 1.3 🔴 Khilang data saat navigasi route (App Router) dengan pending action

Di Next.js 16 App Router, **server action di-inflight dibatalkan jika user navigasi**. Jika `useOptimistic` state disimpan di `useState` lokal komponen, komponen unmount → state hilang → tapi **server action tetap selesai** (fetch tidak abort) → setelah kembali, user melihat data berubah "tanpa sebab".

**Cek**: apakah ada `router.push()` di dalam handler sebelum `await action()` selesai?
```ts
// ⚠️ SALAH
<Form action={async (fd) => { await save(fd); router.push('/questions'); }}>
```

**Perbaikan**: gunakan `redirect()` **di dalam server action** (bukan di client), atau bungkus dengan explicit `startTransition` + `useRouter().push` setelah `await` dan pastikan `revalidatePath` sudah dipanggil.

---

## 2. Validasi & Trust Boundary pada Server Actions

### 2.1 🔴 Tidak ada skema Zod di boundary action

Server Action = **HTTP endpoint publik**. Wajib skema runtime, bukan hanya TypeScript.

**Checklist grep** (jalankan di root):
```bash
grep -rn "export async function" src/**/actions*.ts | grep -v zod
grep -rn "'use server'" src -l | xargs grep -L "safeParse\|\.parse("
```

**Temuan hipotesis**: pada action `createQuestion`, `updateSolution`, `uploadMedia` — field `strandId`, `taxonomyIds`, `sourceId` sering diteruskan sebagai `string` dari client dan di-cast ke `number` di query. Jika tidak ada `z.coerce.number().int().positive()` → **negative IDs** atau `NaN` bisa masuk ke Drizzle → query `WHERE id = NaN` (Postgres `integer` tidak menerima NaN → 500). Lebih buruk: jika cast `Number(x)` diabaikan, `x = "1 OR 1=1"` di parameter binding Drizzle tetap aman (parameterized), **tetapi** jika ada `sql.raw()` → injection.

**Perbaikan**: setiap action dimulai dengan
```ts
const Parsed = CreateQuestionSchema.parse(raw);
```
dan gunakan `.strict()` untuk menolak field ekstra (cegah mass-assignment ke `is_published`/`role`).

### 2.2 🔴 Mass-assignment pada update action

**Pola rentan**:
```ts
export async function updateQuestion(id: number, patch: Partial<Question>) {
  await db.update(question).set(patch).where(eq(question.id, id));
}
```
Client bisa mengirim `{ is_published: true, author_id: someoneElseId, deleted_at: null }`.

**Perbaikan**: whitelist field dengan `Pick<...>` + Zod `.pick/.strict`. Schema di `question.ts` **seharusnya** memakai kolom `author_id` — pastikan TIDAK masuk daftar `patch` yang boleh diubah user biasa.

### 2.3 🔴 Validasi FK tidak konsisten → pelanggaran constraint `fk_*`

Karena skema Drizzle memisahkan `_columns.ts` dan modul domain (`question.ts`, `taxonomy.ts`, `solution.ts`), sering terjadi: action menerima `taxonomyId` array, lalu `db.insert(questionTaxonomy).values(ids.map(...))` **tanpa** memverifikasi semua `taxonomy_id` ada di DB.

**Gejala**: `error: insert or update on table "question_taxonomy" violates foreign key constraint` → 500 ke user, tanpa feedback ramah.

**Perbaikan**:
```ts
const valid = await db.select({ id: taxonomy.id }).from(taxonomy)
  .where(inArray(taxonomy.id, ids));
if (valid.length !== ids.length) return { ok: false, invalid: diff };
```
Dan bungkus insert dalam `db.transaction()` — kombinasi `question` + `question_taxonomy` + `solution` harus atomik. **Cek** apakah action `createQuestion` saat ini melakukan insert berurutan tanpa transaksi.

### 2.4 🔴 Tidak ada verifikasi `size`/`mime` pada action upload `media.ts`

Jika action upload memakai Server Action (bukan route handler streaming), batas 1MB body default Next.js **bisa** dilewati via `multipart` chunked jika config diubah. Pastikan:
- Validasi `file.type` **whitelist** (`application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` — hati-hati SVG).
- Dekode `Buffer` dan validasi magic bytes (`file-type`), bukan hanya `Content-Type` dari client.
- Simpan `checksum (sha256)` di `media.ts` — jika schema belum punya kolom `checksum`, itu gap integritas dedup.

---

## 3. Kebocoran State / Stale Closure

### 3.1 🟠 `useActionState` dengan initial state basi

**Pola**:
```tsx
const [state, formAction, pending] = useActionState(createQuestion, initialState);
```
Jika `initialState` mereferensikan props yang berubah (mis. `selectedSourceId`), nilai di dalam action **tidak diperbarui**. Klien mengira `source_id = 5`, server menerima `source_id = null` dari default state.

**Perbaikan**: gunakan hidden `<input name="sourceId" value={selectedSourceId}>` di form, atau `formAction.bind` dengan argumen server-side.

### 3.2 🟠 `startTransition` tanpa pending boundary & error boundary

React 19 melempar error dari async transition ke **nearest error boundary**. Jika `page.tsx` untuk `/questions/new` tidak punya `error.tsx`, error server action akan **meng-unmount seluruh subtree** (white screen).

**Cek**: `find src/app -name "error.tsx"` — pastikan minimal `src/app/(dashboard)/error.tsx` ada dan menampilkan retry. Tambahkan juga `global-error.tsx`.

### 3.3 🟠 Dua `useOptimistic` di satu komponen yang sama untuk sumber data yang overlap

Contoh: optimistic untuk list `questions` dan optimistic untuk `question.latestRevision`. Rollback yang satu tidak menyinkronkan yang lain → tampilan inconsistent selama ~1-2 detik. Ini bukan vulnerability, tapi **defect pengalaman** yang sering dianggap bug user.

**Perbaikan**: satu `useOptimistic` saja yang berarti (state domain lengkap), atau ganti ke pola **`useQuery`-style dengan `revalidatePath`** dan `useTransition` pending indicator.

---

## 4. Authorization (IDOR)

### 4.1 🔴 Server action tanpa otorisasi resource-level

**Grep**:
```bash
grep -rn "export async function" src/**/actions*.ts \
  | xargs -I{} grep -L "getServerSession\|auth()\|requireUser\|assertOwner"
```

Server action **tidak** otomatis dilindungi middleware (middleware Next.js melewati server action POST di beberapa edge case). Setiap action yang menyentuh `question`, `collection`, `bundle`, `solution`, `media` **wajib**:

```ts
const user = await requireUser();
const row = await db.query.question.findFirst({ where: eq(question.id, id) });
if (!row || row.authorId !== user.id) throw new ForbiddenError();
```

**Reproduksi hipotesis**: jika `updateQuestion(id, ...)` hanya cek "logged in", user A bisa mengubah soal user B dengan `id` enumerasi. Ini adalah **IDOR paling umum** di App Router.

### 4.2 🔴 Otorisasi hilang pada komponen `use client` yang memanggil action bound

Jika Anda memakai `formAction={someAction.bind(null, id)}` dan mengirim id ke client via props, user **bisa** memanggil action dengan id arbitrer dari console. Server action = endpoint. Jangan pernah mengandalkan client-side check (`canEdit && <Button>`).

---

## 5. Integritas Data (Drizzle Mismatch)

### 5.1 🟠 Enum sebagai string tanpa narrowing

Jika `_enums.ts` mendefinisikan `question_status = ['draft','review','published','archived']` tapi action menerima `string` (bukan `z.enum`), Postgres akan throw `invalid input value for enum`. Ini **bukan celah**, tapi bug 500 ke user.

**Perbaikan**: `z.enum(questionStatusEnum.enumValues)` di Zod. Drizzle 0.x mensupport `$inferSelect` → tipe turunan. Jangan duplikasi union.

### 5.2 🟠 `bundle.ts` / `collection.ts` — ordering kolom tidak di-set

Jika ada tabel komposisi (mis. `collection_question` dengan `order_index`), action optimistic yang menyisipkan item **selalu** menaruh di akhir (`max+1`) **tanpa** `transaction`. Dua user menambah bersamaan → dua baris `order_index` sama → render tidak deterministik.

**Perbaikan**: tambahkan unique index `(collection_id, order_index)` di migration dan gunakan `SELECT ... FOR UPDATE` atau `coalesce(max(order_index),0)+1` dalam satu transaksi.

### 5.3 🟠 Soft-delete + `useOptimistic` tidak konsisten

Jika `question.deleted_at` ada di `_columns.ts`, action `deleteQuestion` akan set `deleted_at`. Namun cache revalidate default (`revalidatePath`) akan **memuat ulang** data termasuk baris yang baru dihapus → berkedip. Pastikan query selalu `WHERE deleted_at IS NULL`, dan optimistic state menghapus baris **dengan id yang sama** yang dikembalikan server (jangan pakai index array).

---

## 6. Revalidation & Cache Coherence

### 6.1 🟡 `revalidatePath` tanpa `revalidateTag` pada data terstruktur

`revalidatePath('/questions')` **tidak** menginvalidasi `fetch` cache `unstable_cache` atau Drizzle query cache (`cache()` dari React). Gunakan **`revalidateTag('questions')`** dan `unstable_cache` dengan tag di query layer, bukan path.

### 6.2 🟡 Tidak ada `router.refresh()` fallback pada App Router optimistic

React 19 `useActionState` didesain memicu **server rerender** lewat revalidate di action. Jika action gagal (throw error), revalidate **tidak terjadi** → UI tetap menampilkan optimistic state yang salah sampai hard reload.

**Perbaikan**: kembalikan `{ ok: false, error }` (jangan throw untuk error domain), dan di client `startTransition(() => router.refresh())` saat `state.error` muncul.

### 6.3 🟡 `revalidatePath` di dalam loop

Jika action `bulkPublishQuestions(ids)` memanggil `revalidatePath` per-id → invalidasi berulang, SSR lambat. Kumpulkan id, satu `revalidateTag` di akhir.

---

## 7. ReDoS / Payload Abuse pada Server Actions

### 7.1 🟡 Search & filter di Server Action

Jika action `searchQuestions(query)` melakukan regex client-side di server (mis. `new RegExp(query)`), user mengirim `a{1,10000000}` → ReDoS. Gunakan Postgres `ILIKE` / full-text (`tsvector`) via Drizzle `sql`, atau `escapeRegex`.

### 7.2 🟡 Body size limit pada actions

Set default `experimental.serverActions.bodySizeLimit` (`next.config.ts`) explicit — jangan biarkan `Infinity`. Untuk `solution` yang menerima LaTeX panjang, batasi `maxLength` per field di Zod.

---

## 8. Error UX & Rollback

### 8.1 🟡 Tidak ada visual pending pada tombol action

`useActionState` mengembalikan `pending`. Cek bahwa tombol submit `disabled={pending}` dan tidak double-submit. `pending` React 19 **tidak** auto-disable. Ini bug paling sering di codebase yang baru migrasi ke React 19.

### 8.2 🟡 Rollback diam-diam

Optimistic state di-rollback tapi user **tidak diberi tahu**. Wajib tampilkan toast/alert di `useEffect(() => { if (state.error) toast.error(...) }, [state])`. Tanpa itu, user mengira data tersimpan.

---

## 9. Observability & Audit Trail

### 9.1 🟢 Tidak ada correlation id antara client & server action

Untuk reproducibility bug optimistic, tambahkan header `x-request-id` (dibuat client di awal `startTransition`) yang di-log di server. Tanpa ini, tidak bisa menyambung "user klik A di waktu T" dengan "server error di jam T+X".

**Cek `event.ts`** — jika aktor event dicatat (`aggregate_type`, `aggregate_id`), pastikan `requestId` ikut disimpan sebagai metadata.

---

## Rekomend