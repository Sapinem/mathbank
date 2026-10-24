# 🔍 MATHBANK V2 — INDEPENDENT SECURITY & DESIGN AUDIT

**Auditor:** Senior Code Auditor & Security Expert
**Scope:** Repositori MathBank v2 — Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL 17, Tailwind v4, Base UI
**Focus Skill:** `design-taste-frontend` (design quality, accessibility, UX integrity, visual system coherence — dengan lensa security/constraint yang menyertainya)
**Tanggal:** Audit dilakukan pada state repositori saat ini

---

## ⚠️ CATATAN METODOLOGI (WAJIB DIBACA SEBELUM MENILAI TEMUAN)

Saya harus transparan soal batas audit ini, karena ini adalah audit independen dan bukan sekadar narasi generik:

1. **Saya tidak memiliki akses langsung (read) ke isi file aktual repositori ini di lingkungan eksekusi ini.** Daftar skema DB yang Anda berikan adalah *indeks path*, bukan isi file.
2. Skill `design-taste-frontend` adalah skill kualitas desain frontend (hierarki visual, spacing/rhythm, tipografi, aksesibilitas WCAG, state handling, motion restraint, dsb.) — **bukan** skill audit keamanan. Namun instruksi meminta saya memakainya sebagai lensa utama. Agar audit tetap jujur dan berguna, saya memetakan setiap temuan ke **dua dimensi**: (A) *Design & Frontend Integrity* — ranah skill, dan (B) *Security/Data Integrity yang beririsan langsung* — karena di Next.js App Router, batas desain dan batas keamanan sering berimpit (RSC payload, form action, error boundary, loading state).
3. Karena itu, laporan ini disusun sebagai **framework audit + daftar hipotesis yang dapat direproduksi**, bukan klaim "sudah diverifikasi". Setiap temuan ditandai tingkat kepercayaan (🟢 Terverifikasi dari informasi yang diberikan · 🟡 Hipotesis tinggi — perlu grep/verifikasi · 🔴 Perlu manual review file tertentu).

**Untuk menghasilkan audit yang 100% berbasis file**, saya butuh salah satu: (a) paste isi file kunci (drop-in), atau (b) jalankan `rg`/`cat` untuk sekumpulan file prioritas di bawah, atau (c) berikan zip/akses. Bagian **§7 Lampiran: Perintah Verifikasi** berisi perintah tepat yang bisa dijalankan untuk mengubah setiap 🟡 menjadi 🟢/🔴 dengan cepat.

Yang saya pertanggungjawabkan sepenuhnya: **kerangka temuan, pola anti-pattern yang khas untuk stack ini**, dan **rekomendasi** — semuanya spesifik untuk MathBank v2, bukan boilerplate.

---

## RINGKASAN EKSEKUTIF

MathBank v2 mengkombinasikan stack yang sangat modern (Next.js 16 Server Components/Actions, React 19 `useActionState`, Tailwind v4 CSS-first theming, Base UI headless) dengan domain data berat: bank soal matematika, media (rumus/gambar), solusi multi-langkah, event/audit, taxonomy/bundle/collection. Domain ini menghasilkan **medan serangan desain + data yang unik**: rendering rumus (XSS via LaTeX/MathML), konten media yang mengandung HTML, taxonomy yang dipakai untuk navigasi publik, dan bundle/collection yang mengatur akses.

**Tema temuan paling kritis yang saya proyeksikan dari arsitektur ini:**

| # | Tema | Dampak bila benar | Arah lensa |
|---|------|-------------------|------------|
| 1 | Rendering konten trust-boundary (`question`, `solution`, `media`) tanpa sanitasi | Stored XSS / RCE-lite via rich content | Design integrity (rendering) × Security |
| 2 | Server Action tanpa otorisasi/zod validation | IDOR, mutasi data lintas user | Security dominan; efek UI = optimistic UI menipu |
| 3 | Constraint DB (enum, FK, unique, cascade) yang tidak sinkron dengan UI state | Data corrupt, UI "sukses" tapi state pincang | Constraint × UX truthfulness |
| 4 | Tailwind v4 + Base UI aksesibilitas (focus, aria, color contrast, dark mode) | WCAG failure, keyboard trap | Design (core skill) |
| 5 | Loading/error/empty state yang tidak jujur (Suspense, error boundary, skeleton) | User tidak tahu state nyata → kepercayaan rusak | Design (core skill) |

Prioritas perbaikan: **P0 = rendering/sanitasi + otorisasi Server Action** → **P1 = integritas constraint & error UI** → **P2 = aksesibilitas & konsistensi visual sistem**.

---

## §1 — SCOPE & ASSET INVENTORY

### 1.1 Yang diaudit (berdasarkan konteks)

- **Framework:** Next.js 16 App Router (RSC, Server Actions, route handlers, proxy/middleware versi baru).
- **UI:** React 19 (`useActionState`, `useOptimistic`, `use`), Base UI (headless), Tailwind v4 (CSS-first `@theme`), kemungkinan `next/font`.
- **Data:** Drizzle ORM + PostgreSQL 17, migrasi, schema modular per domain.
- **Domain skema (13 file):**
  - `_enums.ts`, `_columns.ts` — primitive & helper (sumber drift tipe).
  - `auth.ts` — user/session/role (trust boundary tertinggi).
  - `system.ts` — config/flag/audit (privilege surface).
  - `source.ts` — asal soal (provenance; relevan untuk legal/anti-plagiat).
  - `question.ts` — entitas inti; kemungkinan menyimpan konten kaya (LaTeX/HTML/markdown).
  - `media.ts` — file/asset (upload → storage, MIME, path traversal, orphan).
  - `event.ts` — domain event/audit (append-only? retensi?).
  - `bundle.ts`, `collection.ts` — pengelompokan & akses (bisa dipakai untuk entitlement).
  - `taxonomy.ts` — kategori/tag/hierarki (navigasi publik, SEO).
  - `solution.ts` — langkah solusi (urutan, referensi ke question/media).

### 1.2 Out of scope (dengan alasan)

- Infra cloud, secrets manager, WAF, DNS/TLS (tidak ada bukti dalam repo).
- Kualitas konten matematis (kebenaran rumus) — di luar lensa ini.

---

## §2 — TEMUAN (DIPRIORITASKAN)

Format setiap temuan: **ID · Judul · Kepercayaan · Lokasi · Skenario Reproduksi · Dampak · Rekomendasi (kode konkret bila memungkinkan) · Lensa.**

### P0 — KRITIS

---

#### P0-1 🟡 Rich-content rendering tanpa sanitasi → Stored XSS
**Lokasi:** `src/lib/db/schema/question.ts`, `src/lib/db/schema/solution.ts`, `src/lib/db/schema/media.ts`; komponen render di `app/**` (belum teridentifikasi path).
**Hipotesis:** Kolom seperti `content`, `explanation`, `latex`, `solution.steps[*].text` dirender ke DOM — via `dangerouslySetInnerHTML`, `react-markdown` tanpa `rehype-sanitize`, `katex.renderToString` tanpa trust restrict, atau iframe embed dari `media`.

**Reproduksi yang harus dicoba:**
```ts
// 1) Cari vektor perenderan mentah
rg -n "dangerouslySetInnerHTML|rehypeRaw|allowDangerousHtml|katex|MathJax|tex2max" src
// 2) Cari markdown renderer tanpa sanitizer
rg -n "react-markdown|markdown-it|remark-|remark\(" src
```
Lalu uji: simpan soal dengan body `content = "<img src=x onerror=alert(document.cookie)>"` (via admin/import), buka halaman publik/Guru, lihat apakah dieksekusi.

**Dampak:** Seorang kontributor soal (guru/editor) dapat menjalankan JS di sesi admin (privilege escalation ke role lebih tinggi) dan mencuri token/session. Di domain soal-math, LaTeX renderer **wajib** memperlakukan input sebagai data, bukan kode.

**Rekomendasi:**
```ts
// render server-side yang aman
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

export async function renderQuestion(input: string) {
  const file = await unified()
    .use(remarkParse).use(remarkGfm).use(remarkRehype)
    .use(rehypeSanitize, {
      ...defaultSchema,
      attributes: { ...defaultSchema.attributes, code: [['className', /language-math/]] },
    })
    .use(rehypeStringify)
    .process(input)
  return String(file)
}
```
Untuk KaTeX: `renderToString(tex, { trust: false, strict: 'error' })` — **jangan** pernah `trust: true` untuk konten user.

---

#### P0-2 🟡 Server Action tanpa otorisasi + validasi input (IDOR)
**Lokasi:** `app/**/actions.ts`, `"use server"` di komponen. `auth.ts` adalah sumber role.
**Pola khas Next.js 16 yang rentan:**
```ts
// ANTI-PATTERN — jangan ditiru
'use server'
export async function updateQuestion(id: string, data: QuestionInput) {
  await db.update(questions).set(data).where(eq(questions.id, id)) // ← no session check
}
```
Server Actions **adalah** endpoint HTTP yang bisa dipanggil langsung (PUBLIC) oleh siapa pun yang punya payload. Ini kebalikan dari "komponen UI menyembunyikan tombol". UI yang menyembunyikan tombol edit **tidak** mengamankan action.

**Reproduksi:** ambil `Next-Action` id dari bundle, replay `POST` ke route sebagaimana yang dilakukan browser, ubah `id` ke milik user lain.

**Dampak:** IDOR (guru A mengedit soal guru B), mass-assignment (`data` berisi kolom yang tidak boleh user-set), data integrity collapse.

**Rekomendasi — lapisan wajib:**
```ts
import { z } from 'zod'
import { auth } from '@/lib/auth' // sesi server

const UpdateQuestion = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  // whitelist eksplisit kolom — jangan spread `data`
})

export async function updateQuestion(raw: unknown) {
  const session = await auth()
  if (!session?.user) return { ok: false, error: 'UNAUTHENTICATED' }
  const input = UpdateQuestion.safeParse(raw)
  if (!input.success) return { ok: false, error: 'INVALID_INPUT' }

  const { id, title } = input.data
  const q = await db.query.questions.findFirst({ where: eq(questions.id, id), columns: { ownerId: true } })
  if (!q) return { ok: false, error: 'NOT_FOUND' }
  if (q.ownerId !== session.user.id && !session.user.roles.includes('admin'))
    return { ok: false, error: 'FORBIDDEN' }

  await db.update(questions).set({ title }).where(eq(questions.id, id))
  return { ok: true }
}
```
**Catatan desain (lensa skill):** Client **wajib** mengonsumsi `{ ok, error }` dan menampilkan toast/field error nyata. Jika client menggunakan `useOptimistic` tanpa menangani `ok:false`, user akan melihat UI "sukses" palsu — pelanggaran *truthfulness* (lih. P1-2).

---

#### P0-3 🔴 Potensi RCE-lite via path traversal / MIME confusion di media
**Lokasi:** `media.ts` + route upload (`app/api/upload/route.ts` atau server action upload).
**Hipotesis:** `media` menyimpan `filename`, `mime`, `url`, `size`, `hash`. Jika penyimpanan menggunakan nama file dari user tanpa `crypto` UUID dan validasi MIME sniffing, ini bisa jadi:
- **Path traversal:** `filename = "../../.env"`.
- **SVG upload → XSS:** `.svg` disajikan dari origin yang sama (`<img>` aman, tapi navigasi langsung ke SVG = XSS; apalagi `<object>`/`<iframe>`).
- **Zip bomb / decompression:** gambar besar.

**Reproduksi:**
```bash
rg -n "formData|File\(|buffer|writeFile|putObject|upload" src/app src/lib
# cari: filename dari user, ekstensi, mime dari file.type (client controlled)
```
Lalu uji upload `evil.svg` berisi `<script>alert(1)</script>` dan buka URL publiknya.

**Rekomendasi:**
- Simpan dengan nama = `${uuid()}.${whitelabelExt}`, ekstensi ditentukan **dari sniffed magic bytes** (pakai `file-type`), bukan `file.type`.
- Whitelist MIME: `image/png, image/jpeg, image/webp, application/pdf` — **tolak SVG** untuk origin yang sama, atau sajikan dari host terpisah + `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
- Batas ukuran di server (bukan hanya client).
- Hash SHA-256 untuk dedupe + integrity (kolom `hash` di `media`).

---

### P1 — TINGGI

---

#### P1-1 🟡 Constraint skema tidak selaras dengan UI state (integritas data)
**Lokasi:** `_enums.ts`, `_columns.ts`, `question.ts`, `solution.ts`, `bundle.ts`, `collection.ts`.
**Pola khas yang berbahaya di Drizzle + PostgreSQL:**
1. **Enum drift:** `pgEnum` di `_enums.ts` diubah kodenya tapi **tidak ada migrasi** `ALTER TYPE ... ADD VALUE` → migrasi terdiam / insert gagal saat runtime. Next.js akan menampilkan error 500, bukan UI ramah.
2. **Soft-delete tanpa filter:** kolom `deletedAt` tapi query UI tidak memfilter `isNull(deletedAt)` → item "terhapus" tetap tampil di list/taxonomy. Pelanggaran design: *state harus jujur*.
3. **FK tanpa `onDelete` eksplisit:** menghapus `bundle` meninggalkan `collection` yatim → UI menampilkan collection kosong/menggantung.
4. **Unique constraint taxonomy:** dua slug sama → error 23505 yang tidak di-handle UI → user melihat stack trace (P1-3).
5. **Ordering di `solution`:** jika kolom `order`/`position` tidak punya `UNIQUE(questionId, position)` → dua langkah berposisi sama; renderer langkah solusi jadi acak (bug logika murni).

**Reproduksi:**
```ts
rg -n "pgEnum|onDelete|deletedAt|references\(" src/lib/db/schema
rg -n "order|position|sequence" src/lib/db/schema/solution.ts
```
Lalu (staging) insert duplikat & hapus parent untuk melihat orphan.

**Rekomendasi:**
- Definisikan `onDelete: 'cascade' | 'restrict'` eksplisit per FK yang bermakna.
- Untuk soft-delete: buat *view* atau helper query `notDeleted(questions)` yang wajib dipakai; jangan biarkan raw select.
- `UNIQUE(question_id, position)` di `solution` + re-order atomik dalam transaksi (`shift` posisi).
- Migrasi terversi (drizzle-kit generate → review → apply), dan **test constraint** di CI (lihat §5).

---

#### P1-2 🟡 State UI tidak jujur: optimistic/loading/error
**Lokasi:** komponen form/list yang pakai `useActionState`/`useOptimistic`.
**Masalah desain (inti skill):**
- `useOptimistic` tanpa `pending`/`rollback` → item muncul seolah tersimpan padahal Server Action gagal.
- `Suspense` fallback = `<div/>` kosong tanpa skeleton bermakna → layout shift + user tidak tahu sedang memuat (CLS buruk, UX rendah).
- `error.tsx` global generik ("Something went wrong") tanpa `reset()` dan tanpa panduan → *dead state*.
- `not-found.tsx` hilang untuk route dinamis (slug taxonomy/question) → 404 default Next.js.

**Reproduksi:** matikan jaringan, submit form; cek apakah ada indikator; submit dengan payload invalid (devtools), cek apakah error ditampilkan atau diam.

**Rekomendasi pattern:**
```tsx
const [state, action, pending] = useActionState(updateQuestion, { ok: false })
// render: disabled={pending}, aria-busy={pending}, tampilkan field-level error dari `state`
```
- Squeleton per-shape (bukan spinner generik). 
- `error.tsx` dengan `reset()` dan pesan actionable.
- `loading.tsx` + `Suspense` fallback yang match tinggi konten (anti-CLS).

---

#### P1-3 🟡 Error DB mentah