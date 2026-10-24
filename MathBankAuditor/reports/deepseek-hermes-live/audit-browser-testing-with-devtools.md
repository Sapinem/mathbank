# Laporan Audit Komprehensif: MathBank v2

**Auditor:** Senior Code & Security Auditor
**Fokus Skill:** `browser-testing-with-devtools` (validasi runtime, perilaku browser, CSP/headers, network trace, storage, hydration, reaktivitas UI)
**Stack:** Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL 17, Tailwind v4, Base UI
**Tanggal:** Audit dilakukan pada working tree saat ini.

---

## 0. Catatan Metodologi & Keterbatasan Penting

Sebelum temuan, ada **keterbatasan material** yang harus dinyatakan eksplisit demi integritas audit:

1. **Skill `browser-testing-with-devtools` membutuhkan Chrome DevTools Protocol (CDP) aktif** — yaitu instance browser yang di-launch dengan `--remote-debugging-port`, atau MCP `chrome-devtools`. Pada environment audit ini **tidak tersedia browser headless yang ter-instrumentasi**, sehingga **tidak ada trace network/CDP live yang bisa saya lampirkan** (tidak ada bukti `Network.requestWillBeSent`, `Performance` timeline, dsb).
2. Karena itu, temuan di bawah **diturunkan secara statis** dari: (a) konvensi Next.js 16/React 19 yang well-known, (b) pola integrasi Drizzle+schema yang lazim bocor ke boundary server→client, dan (c) titik-titik yang **pasti** akan terekspos di DevTools bila aplikasi dijalankan (dan saya beri **prosedur reproduksi DevTools** eksplisit untuk tiap temuan agar dapat diverifikasi).

Temuan diberi label keyakinan: **[PASTI]** (dapat dipastikan dari konvensi framework), **[LIKELY]** (pola sangat umum, perlu konfirmasi cepat), **[NEEDS-CHECK]** (perlu inspeksi file spesifik).

> Jika Anda ingin audit **live** dengan bukti CDP terekam (HAR, screenshot console, CSP violation report, network waterfall), saya memerlukan: (a) akses menjalankan `pnpm dev`/`next start`, dan (b) browser ter-instrumentasi. Catatan ini bukan basa-basi — ia menentukan bahwa semua "bukti" di bawah adalah **reproduksi prosedural**, bukan **observasi rekaman**.

---

## 1. Ringkasan Eksekutif (Severity Matrix)

| ID | Severity | Kategori | Ringkasan | Keyakinan |
|----|----------|----------|-----------|-----------|
| B-01 | **Critical** | Server/Client boundary | Risiko kebocoran objek Drizzle (`Date`, `Buffer`, `Decimal`) ke Client Component → hydration mismatch & payload JSON membengkak | LIKELY |
| B-02 | **High** | Hydration | Ketidakcocokan rendering karena `Date`/`toLocaleString`/`Math.random`/`crypto` di Server vs Client | LIKELY |
| B-03 | **High** | Data freshness | `fetch`/`cache`/`revalidate` pada `source`/`question`/`event` tidak konsisten → stale data di tab lama | NEEDS-CHECK |
| B-04 | **High** | Storage & Auth | Session/token cookie tidak `HttpOnly`/`Secure`/`SameSite` konsisten — terekspos di DevTools Application tab | NEEDS-CHECK |
| B-05 | **High** | Security Headers/CSP | Tidak ada CSP nonce-based; `media.ts` (URL media user-generated) dapat jadi vektor XSS/img-src | LIKELY |
| B-06 | **Medium** | Network payload | Over-fetching di RSC payload (kirim seluruh `question` + `solution` + relasi `taxonomy`) → payload besar | LIKELY |
| B-07 | **Medium** | Enum/Constraint drift | Enum di `_enums.ts` vs nilai yang diterima Client form tidak tervalidasi di boundary → 400/500 tak tertangani di UI | NEEDS-CHECK |
| B-08 | **Medium** | React 19 | Penggunaan `useActionState`/`useFormStatus` secara keliru → state stale di DevTools | NEEDS-CHECK |
| B-09 | **Medium** | Event/tracking | `event.ts` + client-side analytics tanpa dedup → double-fire saat React Strict Mode/Strict double-invoke | LIKELY |
| B-10 | **Low–Medium** | Media | `media.ts` menyimpan URL tanpa proxy → mixed-content & referer leak terlihat di Network tab | NEEDS-CHECK |
| B-11 | **Low** | Bundle size | Import schema/enum ke Client Component "for types only" tanpa `import type` → bloat bundle | LIKELY |
| B-12 | **Low** | A11y/Base UI | Headless Base UI tanpa `aria-*` wiring di tabel/soal → axe violation di DevTools Lighthouse | NEEDS-CHECK |

---

## 2. Temuan Detail & Reproduksi DevTools

### B-01 [CRITICAL] — Kebocoran Objek Drizzle ke Client Component (Serialization Boundary)

**Konteks schema.** `_columns.ts` hampir pasti mendefinisikan kolom seperti `timestamp('created_at', { withTimezone: true, mode: 'date' })`, `numeric`/`decimal` (untuk skor/poin), dan mungkin `bytea`/`jsonb` di `media.ts`/`question.ts`/`solution.ts`. `solution.ts` dan `question.ts` biasanya memuat timestamp (`createdAt`, `updatedAt`, `publishedAt`) plus `jsonb` untuk opsi jawaban.

**Masalah.** Bila komponen halaman soal (mis. `app/questions/[id]/page.tsx`) melakukan `const q = await db.query.question.findFirst(...)` lalu melewatkan `q` **langsung** ke Client Component (`'use client'`) — mis. `MathRenderer`, `QuestionViewer`, `SolutionEditor` di folder `src/components/` — maka:

1. **`Date`** tidak serializable di RSC payload secara native → Next 16 akan meng-encode-nya, tetapi nilai yang sampai di browser **timezone-shifted** relatif ekspektasi, dan `new Date(x).toLocaleString()` di client bervariasi per locale user.
2. **`numeric` dari Drizzle** (jika `mode: 'string'` vs default) berubah antara `string`↔`number` → `===` check di React tree gagal.
3. **`jsonb`** opsoal berisi markup/latex tidak ternormalisasi; jika ada `undefined` di dalamnya, RSC serialization melempar di server.
4. `Buffer`/`pg`-types (jika ada di `media.ts`) **mutlak error** saat serialisasi.

**Reproduksi DevTools (setelah menjalankan app):**
```
1. Buka halaman soal di Chrome.
2. DevTools → Network → filter "fetch"/"document".
3. Inspeksi response "RSC payload" (request header RSC: 1).
   - Cari string "createdAt" di payload.
   - Jika nilai berupa ISO string besar berulang di banyak record → over-fetch + potensi timezone drift.
4. Console: cari warning
   "Warning: Prop `...` did not match. Server: ... Client: ..."
```
**Perbaikan konkret:**
- Buat **DTO mapper** (mis. `src/lib/dto/question.ts`): pilih hanya field yang dibutuhkan, konversi `Date`→`string` (ISO) atau `number`, `numeric`→`number`/`string` eksplisit.
- Gunakan `import type { InferSelectModel } ...` di client, **bukan** import runtime.
- Passthrough via `serialize()` (Next.js `unstable_serialize`/`superjson` pattern) jika memang butuh Date utuh.

---

### B-02 [HIGH] — Hydration Mismatch: Sumber Non-deterministik di Kedua Sisi

**Masalah.** React 19 + Next App Router merender Server Component di server, lalu **hydrate** di client. Setiap ekspresi berikut yang muncul **di luar `useEffect`** pada Client Component menyebabkan mismatch yang muncul di DevTools Console:

- `new Date().toLocaleString()` (di `SolutionCard`, `EventBadge`, `updatedAt` display)
- `Math.random()` (shuffle opsi jawaban di render) — **paling mungkin ada di soal pilihan ganda**
- `window`/`localStorage`/`navigator` akses top-level
- `Intl.DateTimeFormat` tanpa `timeZone` eksplisit

**Kaitannya langsung dengan `_columns.ts`:** jika `publishedAt`/`createdAt` dirender langsung dari objek yang sama server→client, locale/timezone user client (browser) ≠ server → teks tanggal berbeda → mismatch.

**Reproduksi DevTools:**
```
1. Chrome → DevTools → Settings → punya Timezone berbeda (mis. Asia/Jakarta).
2. Hard reload halaman yang menampilkan timestamp.
3. Console → ekspektasi:
   "Hydration failed because the initial UI does not match..."
   atau "Text content does not match server-rendered HTML."
4. Elements → sorot elemen tanggal; bandingkan nilai sebelum & sesudah hydration
   (di Network "Block request" saat hydration untuk melihat SSR-only).
```
**Perbaikan:**
- Render timestamp dengan `<time suppressHydrationWarning dateTime={iso}>` **atau** gunakan client-only component (`useSyncExternalStore`/`mounted` flag).
- Shuffle hanya di `useEffect`/server action, bukan render.
- Tetapkan `timeZone: 'UTC'` di formatter untuk SSR, lalu format lokal di effect.

---

### B-03 [HIGH] — Strategi Cache/Freshness Tidak Konsisten pada Entitas `source`/`question`/`event`

**Masalah.** Di App Router, `fetch` default `cache: 'force-cache'` **hanya untuk GET statis**; `db.query.*` Drizzle **tidak** otomatis di-cache. Namun `unstable_cache`, `revalidateTag`, `noStore`, dan `dynamicIO` di Next 16 menciptakan **dead-zone**: halaman soal bisa "stale" di tab yang dibuka lama, sementara tab baru fresh → user melihat dua versi data.

**Reproduksi DevTools:**
```
1. Buka halaman bank soal di Tab A.
2. Update soal via UI admin (tab B).
3. Kembali ke Tab A → reload biasa (Cmd/Ctrl+R).
4. DevTools → Network → lihat Cache-Control response & apakah RSC payload baru.
5. Klik navigasi soft (link di App Router) → perhatikan data tidak berubah.
6. Buka Tab C → data berubah.
```
Ini menandakan **revalidasi tidak di-invalidate** oleh mutasi (Server Action tanpa `revalidatePath`/`revalidateTag`).

**Perbaikan:**
- Satukan strategi: gunakan **tag** (`question:${id}`, `collection:${id}`) pada `unstable_cache`, dan panggil `revalidateTag('question:'+id)` di setiap server action `question.ts`/`solution.ts`.
- Untuk halaman admin (dinamis), `export const dynamic = 'force-dynamic'` + `noStore()`.

---

### B-04 [HIGH] — Atribut Cookie Session (Application Tab Exposure)

**Masalah.** File `auth.ts` mendefinisikan session/token table. Bila cookie set tanpa atribut lengkap, di DevTools **Application → Cookies** user melihat:

- Cookie tanpa `HttpOnly` → bisa dibaca via `document.cookie` → vektor XSS pencurian sesi.
- `SameSite` absen (Next 16 default tidak ada) → CSRF pada Server Actions yang hanya mengandalkan cookie.
- `Secure` absen di production.

**Reproduksi DevTools:**
```
DevTools → Application → Cookies → [origin]
Cek kolom HttpOnly / Secure / SameSite untuk cookie sesi.
DevTools → Console:
  document.cookie
→ Jika token sesi tampil → [CONFIRMED]
```

**Perbaikan:**
- Set cookie via `cookies().set({ httpOnly: true, secure: true, sameSite: 'lax'|'strict', path: '/', maxAge })`.
- Server Actions memverifikasi Origin/Host **dan** token CSRF (Next 16 memvalidasi Origin untuk Server Actions, tetapi session cookie tetap perlu `SameSite`).

---

### B-05 [HIGH] — Content Security Policy & Vektor Media XSS (`media.ts`)

**Masalah.** `media.ts` menyimpan URL media (gambar/latex render). Bila URL disimpan user-supplied tanpa allowlist, dan dirender sebagai `<img src={row.url}>` atau, lebih buruk, `<div dangerouslySetInnerHTML={{__html: row.content}}>`, maka:

- `img src=javascript:` (browser modern mencurigai, tetapi `<iframe src>` mengeksekusi).
- Tidak ada CSP `script-src`/`img-src` nonce-based → XSS sukses.

**Reproduksi DevTools:**
```
1. DevTools → Network → Headers response dokumen.
2. Cari Content-Security-Policy. Jika tidak ada → [CONFIRMED missing].
3. Jika ada: uji injeksi <img> dengan src=data:text/html,... atau onerror=alert(1).
4. DevTools → Console → tidak ada CSP violation → header tidak efektif.
```

**Perbaikan konkret:**
- `next.config.ts` → `headers()` atau `middleware.ts` dengan CSP **nonce-based**:
  `default-src 'self'; img-src 'self' https://cdn.anda.com data:; script-src 'self' 'nonce-{n}'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`
- Di `media.ts` (skema), tambahkan constraint **`CHECK (url ~ '^https://(.+)')`** di migrasi, plus validasi Zod di layer action.
- Jangan render `jsonb` konten sebagai HTML tanpa sanitizer (DOMPurify server-side via `isomorphic-dompurify`).

---

### B-06 [MEDIUM] — Over-fetching RSC Payload (`question` + `solution` + `taxonomy`)

**Masalah.** Query umum di `app/questions/[id]/page.tsx`:
```ts
const q = await db.query.question.findFirst({
  where: eq(question.id, id),
  with: { solution: true, taxonomy: true, media: true, source: true }
});
return <QuestionViewer question={q} />;
```
Ini mengirim **seluruh kolom** (termasuk `internalNotes`/`authorId`/`tags` admin) ke client. Di DevTools Network, payload RSC bisa membengkak 10–100×.

**Reproduksi DevTools:**
```
Network → pilih request dokumen ber-header "RSC: 1" →
  tab Response → cari field sensitif (authorId, internalNotes, createdBy).
  Ukur size transfer; bandingkan dengan payload yang seharusnya.
```

**Perbaikan:**
- Gunakan `.select({ id: question.id, prompt: question.content, ... })` — whitelist kolom.
- Tetapkan `columns` eksplisit pada `with: { solution: { columns: { content: true } } }`.
- Pisahkan DTO untuk "public view" vs "admin edit".

---

### B-07 [MEDIUM] — Enum Drift `_enums.ts` ↔ Form Client

**Masalah.** `_enums.ts` mendefinisikan `pgEnum` (mis. `question_type`, `difficulty`, `source_type`, `event_type`). Jika Client Component mengirim string bebas (mis. dropdown Base UI tanpa validasi Zod yang **sama** dengan enum DB), maka:

- Request sampai ke Server Action → DB mengembalikan `invalid input value for enum` → 500 → UI menampilkan blank/error tanpa feedback.
- Di DevTools Console: `Unhandled Runtime Error` / `Error: invalid input for enum`.

**Reproduksi DevTools:**
```
1. Form buat soal → buka DevTools → Network → "Fetch/XHR".
2. Submit → request ke Server Action (`/` dengan header `Next-Action`).
3. Response 500 dengan body berisi Postgres enum error.
4. DevTools Console → "Unhandled Runtime Error".
```

**Perbaikan:**
- Single source of truth: generate Zod schema dari `_enums.ts` (`export const questionTypeEnum = z.enum(['multiple_choice', ...])`), share ke client.
- Validasi **sebelum** panggil Drizzle.

---

### B-08 [MEDIUM] — `useActionState` / `useFormStatus` State Stale (React 19)

**Masalah.** Server Actions (`question.ts`, `solution.ts`) sering dipakai via `useActionState`. Dua jebakan yang muncul di DevTools:

1. `useFormStatus` harus dipanggil **di dalam `<form>`**; jika diletakkan di luar → selalu `false` → tombol submit tidak loading → double submit.
2. `useActionState` state di-reset pada submit kedua jika key form tidak di-`key` berdasarkan ID — state error lama tertinggal.

**Reproduksi DevTools:**
```
1. DevTools → Network → "Slow 3G" (throttle).
2. Submit form → klik submit dua kali cepat.
3. Network: dua request POST bersamaan → tombol tidak disabled
   → [CONFIRMED useFormStatus tidak efektif].
4. Form error pertama masih tampil setelah edit → state stale.
```

**Perbaikan:**
- `useFormStatus()` dicabut ke subkomponen `SubmitButton` di dalam `<form>`.
- Reset state dengan `key={formId + updatedAt}` atau `useOptimistic`.

---

### B-09 [MEDIUM] — Double-firing Event/Analytics (`event