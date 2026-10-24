# Audit React 19 Actions & Optimistic UI — MathBank v2

> **Tanggal audit:** 18 Oktober 2026
> **Commit acuan:** `7c4df34` (`feat(math): render tabel markdown GFM di MathContent`)
> **Skill:** `react-19-actions-and-optimistic-ui` (`~/.claude/skills/react-19-actions-and-optimistic-ui/SKILL.md`)
> **Versi terpasang (diverifikasi):** React `19.3.0` · React DOM `19.3.0` · Next.js `16.3.8`
> **Sifat:** *read-only audit* — **tidak ada kode aplikasi yang diubah**. Berkas baru = laporan ini + satu baris registrasi di `docs/PETA-DOKUMEN.md` (CONSTRAINTS #31).
> **Status dokumen:** 🔴 — **Kepatuhan literal terhadap skill: sangat rendah.** Namun sebagian besar penyimpangan **disengaja dan dibenarkan oleh ADR-0022**, bukan kelalaian. Temuan nyata bukan "tidak pakai `useOptimistic`", melainkan **celah UX yang justru bisa ditutup tanpa melanggar ADR**.

---

## 0. Catatan Metodologis — Batas antara "Skill" dan "Kontrak Proyek"

Skill ini menetapkan lima pilar. Sebelum menilai, penting membedakan mana yang **wajib** di MathBank dan mana yang **dilarang** oleh kontrak proyek sendiri:

| Pilar skill | Status di MathBank | Dasar |
|---|---|---|
| §1 Larang memoization manual (React Compiler) | 🟠 **Dilarang sebagai konvensi**, tetapi **alasan skill-nya tidak berlaku** | `CONSTRAINTS.md` #6; §1 constraint mengakui "*React Compiler **BELUM aktif** … jadi larangan ini **konvensi**, bukan efek compiler*" |
| §2 `useActionState` | ❌ **Dilarang** untuk mutasi domain | `docs/ADR/0022` (status **Diusulkan**, direncanakan v2.0 Fase 3) |
| §3 `useFormStatus` | ❌ Mengikuti §2 | idem |
| §4 `useOptimistic` | ✅ **Tidak dilarang** — kompatibel dengan React Query | ADR-0022 hanya melarang *Server Actions*, bukan hook klien |
| §5 Validasi Zod + kontrak error terstruktur | ✅ **Wajib** | `CONSTRAINTS.md` #22; `wrapRoute()` |

**Konsekuensi metodologis (dinyatakan terbuka):** skill mengasumsikan arsitektur **Server Action + `useActionState`**. MathBank memilih **Route Handler `wrapRoute()` + React Query**. Memaksakan §2/§3 ke MathBank akan **melanggar ADR-0022** dan membuang pipa `resolveActor → assertCan → rateLimit → Zod → service → audit` yang sudah bekerja.

Audit ini karena itu **tidak** menilai "tidak adanya Server Actions" sebagai cacat. Ia menilai:

1. **Kepatuhan** terhadap apa yang relevan (Zod di boundary, kontrak error, memoization, `useOptimistic`).
2. **Celah nyata** — di mana pola React Query yang dipakai **kehilangan** jaminan yang seharusnya diberikan oleh §2–§5 (pending state, anti double-submit, penanganan galat, umpan balik instan).

> Bila pemilik proyek bermaksud **migrasi** ke Server Actions (v2.0 Fase 3), ADR-0022 **harus digantikan lebih dulu** lewat ADR baru. Lihat §6.

---

## 1. Ringkasan Eksekutif

| # | Area | Hasil |
|---|------|-------|
| 1 | **React Compiler & memoization** | 🟠 Compiler **tidak terpasang & tidak aktif** (`next.config.ts` tanpa `reactCompiler`; `babel-plugin-react-compiler` hanya *optional peer* di lockfile, tidak ada di `node_modules`). Larangan #6 karena itu **murni konvensi**. Kepatuhan kode **hampir sempurna**: hanya **1** `memo()` non-vendor (`QuestionCard`) — **sah & terdokumentasi** sebagai workaround terukur (PERF-02), alasan yang sama dengan pengecualian skill §1. |
| 2 | **`useActionState` / `useFormStatus`** | ⛔ **0 penggunaan** — sesuai ADR-0022. Namun ada **regresi UX** nyata: **tidak satu pun** `<form>` di aplikasi memakai tombol `type="submit"` (2 form ada, keduanya pencarian). Semua mutasi = `onClick` + `mutate()`. Akibatnya: **tidak ada proteksi double-submit berbasis `isPending` tunggal** untuk toolbar (lihat R-01). |
| 3 | **`useOptimistic`** | 🔴 **0 penggunaan** — padahal **diizinkan**. Tiga alur yang skill nilai tinggi (**DRAG-REORDER**, toggle flag, hapus item) mengalami **latensi visual penuh** ke server (R-02, R-03). |
| 4 | **Validasi Zod di boundary** | ✅ **Kuat.** Semua handler `POST/PATCH/PUT/DELETE` di `/api/questions*` memakai `body:` Zod schema via `wrapRoute`. |
| 5 | **Kontrak error terstruktur** | ✅ **Sangat baik** — `{ data }` / `{ error: { code, message } }`, pemetaan kelas error → status HTTP, log terstruktur. 🟠 Tetapi klien **sering membuang** kontrak ini (`catch` kosong, `onError` tak dipasang). |
| 6 | **Umpan balik galat mutasi** | 🟠 **Tidak konsisten.** 16 berkas memanggil `mutate()`; hanya sebagian memasang `onError`. Beberapa titik **gagal senyap** (R-05). |
| 7 | **Integritas state klien** | 🔴 **1 bug konkret:** `setState` saat *render* di `BundleBuilder` (R-04) — memicu *render-phase update*; dan state `bundle` di klien **tidak pernah diurutkan ulang** setelah drag. |

**Verdict:** Skor kepatuhan *literal* terhadap skill ≈ **1.5 / 5 pilar**. Skor kepatuhan terhadap *spirit* skill (umpan balik instan + status aman + validasi server) ≈ **3 / 5**. Arsitektur **sehat & konsisten**; yang hilang adalah **lapisan UX reaktif** (`useOptimistic`) dan **disiplin penanganan galat klien**. Tidak ada temuan CRITICAL keamanan dari sudut pandang skill ini.

---

## 2. Tabel Temuan

Format: **ID · Severity · Lokasi · Bukti · Dampak · Rekomendasi**.
Severity: 🔴 HIGH · 🟠 MEDIUM · 🟡 LOW · ✅ Sah (kontrol berjalan).

### 2.1 Pilar §1 — React Compiler & Memoization

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **R-06** | 🟠 | `next.config.ts` (seluruh), `package.json:devDependencies` | Tidak ada kunci `reactCompiler`; `babel-plugin-react-compiler` **tidak** ada di `devDependencies` sehingga **tidak terpasang** (`ls node_modules/babel-plugin-react-compiler` → *No such file*). Di `pnpm-lock.yaml` ia hanya muncul sebagai **peerDependency optional** `next@16.3.8` (baris 3762) dan `@vitejs/plugin-react@6.1.1` (baris 2007). | Klaim skill §1 ("*Next.js 16 dan React 19 memiliki React Compiler otomatis*") **tidak berlaku** untuk proyek ini. Larangan `useMemo`/`useCallback` di #6 adalah **disiplin sukarela**, bukan jaminan kinerja. Setiap kali komponen butuh memoization nyata, keuntungan compiler **tidak ada** — terbukti dengan `QuestionCard` yang harus di-`memo()` manual. | *(Opsi A — status quo)* Perbarui komentar §1 di `CONSTRAINTS.md` agar tegas "compiler tidak aktif"; jadikan pengaktifan compiler backlog terukur. *(Opsi B)* Pasang `babel-plugin-react-compiler@^1` + `reactCompiler: true`, lalu **jalankan ulang** gerbang `pnpm check`; hapus `memo()` `QuestionCard` bila profil menunjukkan compiler sudah cukup. **Jangan** aktifkan tanpa ADR — compiler mengubah semantik tiap komponen klien (56 berkas). |
| **R-07** | ✅ | `src/components/questions/question-card.tsx:522` | `export const QuestionCard = memo(QuestionCardInner, areCardPropsEqual)` — **satu-satunya** `memo` non-vendor (`grep` di luar `components/ui/` hanya menemukan ini). Komparator sengaja mengabaikan `onToggleSelect` (`:App` dok komentar `:484-500`) karena handler memakai `setSelected(prev => …)` yang perilakunya stabil. | — | Keputusan **sah** dan sejalan dengan pengecualian skill §1 ("*hanya bila profil menunjukkan bottleneck*"). Beri catatan: **bila** React Compiler diaktifkan (R-06 Opsi B), komparator ini perlu diuji ulang — compiler + `memo` manual bisa saling menimpa. |
| **R-08** | ✅ | Seluruh `src/**` non-`components/ui/` | Tiada `useMemo`/`useCallback` di luar vendor. | — | — |

### 2.2 Pilar §2/§3 — Form, Pending, Anti Double-Submit

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **R-09** | ⛔✅ | Seluruh `src/` | `grep "'use server'"` → **0 berkas**. Sesuai ADR-0022. | — | **Bukan cacat.** Catat sebagai kepatuhan ADR. Jangan "perbaiki" ke Server Actions tanpa ADR pengganti. |
| **R-01** | 🔴 | `src/components/questions/question-bank-view.tsx:141` (toolbar `:314-352`); `src/components/questions/review-view.tsx:197,205,214,314,333,374,447` | Toolbar seleksi massal punya **5 tombol** (`Setujui`, `Tolak`, `Arsipkan`, `Tandai`, `Lepas tanda`) semuanya `disabled={bulk.isPending}` dan memanggil `runBulk(...)`. **`bulk.isPending` di TanStack Query adalah *observers count*, bukan *mutation count*** — ia `true` hanya selama observer aktif. Karena `isPending` ini benar secara praktis (mutation masih ter-attach ke komponen), **risikonya bukan disabled yang salah**, melainkan: **tidak ada debounce/guard di dalam `runBulk`**, sehingga *double-click sebelum re-render* (atau click programatik/IME/AT) dapat mengirim **dua POST `/api/questions/batch`**. Gunakan pola yang sama untuk `review-view` (`status.mutate` & `flag.mutate` — **tidak ada `type="submit"`** dan tidak ada guard `if (status.isPending) return`). | Aksi massal ganda → **dua kali transisi FSM** (`review → ready` dua kali). Bergantung pada FSM, ini bisa menghasilkan `409 INVALID_TRANSITION` (aman) **atau** audit log ganda & notifikasi ganda. Untuk `flag` (idempoten semantik) hasilnya aman, tetapi tetap menambah beban & log. | **(1)** Tambahkan guard di dalam handler: `if (bulk.isPending) return;` (atau `if (status.isPending) return;`) — pertahanan berlapis tak tergantung re-render. **(2)** Untuk endpoint mutasi terpenting (POST `:201`, batch), kirim header **`Idempotency-Key`** — **infrastruktur sudah ada** (`wrapRoute({ idempotent: true })`, `src/lib/api/idempotency.ts`) tetapi **belum dipakai klien**: `apiFetch` di `use-questions.ts` tidak pernah mengirim header itu. Ini rekomendasi berdaya-ungkit tertinggi di laporan ini. |
| **R-10** | 🟠 | `src/app/change-password/page.tsx:84-100`; `src/app/login/page.tsx:63-91` | Kedua form login/ganti-sandi memakai `onClick` tanpa `<form>`/`type="submit"`. Konsekuensi: **(a)** *Enter* di kolom kata sandi **tidak mengirim** (form tak ada → browser tak punya submit default); **(b)** menekan Enter pada form login adalah kebiasaan universal pengguna, jadi ini regresi aksesibilitas & efisiensi nyata. | Pengguna harus mengklik tombol setiap kali. Di layar kecil/AT, ini menambah langkah. | Bungkus dengan `<form onSubmit={e => { e.preventDefault(); submit(); }}>` dan jadikan tombol `type="submit"`. Bila tetap memakai `useState(busy)`, minimal jaga `busy` guard: `if (busy) return;`. **(Penting)** Sertakan pola `useFormStatus` **hanya jika** form-nya direfaktor ke Server Action — untuk Route Handler, `busy` state sudah cukup. |
| **R-11** | 🟡 | `src/components/system/settings-view.tsx:65-75`; `src/components/system/ai-settings-card.tsx:54-75` | Keduanya memakai `saved` state (`setSaved(false)` lalu `onSuccess: () => setSaved(true)`). `saved` **tidak pernah di-reset saat user mengubah input lagi**; pada `ai-settings` label "Tersimpan." tetap tampil hingga klik berikut. | Indikator "tersimpan" bisa berbohong singkat setelah user mengubah field lagi. | Reset `saved` di `onChange` field, atau turunkan `saved` dari `update.isSuccess && !update.isPending`. |

### 2.3 Pilar §4 — `useOptimistic` (Umpan Balik Instan)

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **R-02** | 🔴 | `src/components/bundles/bundle-builder.tsx:102-139, 379` | `onDragEnd` **tidak** mengubah state lokal: dari `items` (props dari `useBundle`) ia menghitung `next` lalu hanya `onReorder(next)` (`:379` → `reorder.mutate(ids)`). `internal.use-bundle.ts` `useReorderBundleItems` **hanya** `invalidateQueries` (`onSuccess`). Tidak ada `setState`/`setQueryData` optimistik. | **Setelah user melepas item, baris "melompat kembali" ke posisi lama** selama round-trip `PUT …/items` + refetch. Dengan `PUT` berat (batch item) di jaringan lambat ini terasa seperti **drag gagal**. Kemudian baris berpindah lagi → **layout shift ganda**. Ini persis skenario yang `useOptimistic`/`setQueryData` dirancang selesaikan. | **Rekomendasi utama:** buat `useReorderBundleItems` memakai `onMutate` + `setQueryData(bundleKeys.detail(id), applyOrder)` + `onError` → *rollback* (simpan snapshot dari `getQueryData`). Ini pola ekuivalen `useOptimistic` di ranah React Query, **tidak melanggar ADR-0022**. Alternatif alternatif: `useOptimistic` lokal di `BundleBuilder` (state `optimisticItems`) selama `reorder.isPending`. |
| **R-03** | 🟠 | `src/components/questions/review-view.tsx:197,205,214,314,333,374,447` | Review & flagged queue **tidak menghapus baris secara instan**. `status.mutate("ready")` → `onSuccess` → `invalidateQueries` → refetch daftar. Selama t 3 tombol tetap aktif (kecuali observer `status` yang sama; tetapi di `ReviewQueue` tiap baris punya `ReviewRow` dengan hook **sendiri**, jadi `status.isPending` hanya menonaktifkan tombol baris itu sendiri — baik untuk isolasi, buruk untuk *feedback global*). | Dalam antrean panjang (limit 50), penelaah harus menunggu baris "lenyap" → click berulang menimbulkan *perception* macet. `useOptimistic` (hapus baris dari daftar selama *pending*) adalah perbaikan yang skill rekomendasikan dan **aman** untuk studi kasus ini. | Tambahkan `onMutate` di `useChangeQuestionStatus`/`useSetQuestionFlag` yang menghapus/menandai baris dari **semua** cache `questionKeys.list(*)` secara optimistik, dengan rollback pada `onError`. Bila gagal → *toast* "Transisi ditolak server". |
| **R-04** | 🔴 | `src/components/bundles/bundle-builder.tsx:175-179` | Blok kode di **tubuh render**: `if (bundle && bundle.id !== lastBundleId) { setLastBundleId(...); setDurationDraft(...); setInstructionsDraft(...); }` | React mengizinkan ini hanya sebagai **pola "adjust state on prop change"** dan ia memicu *re-render sinkron tambahan*. Namun di sini bertemu dengan **`useParams` yang bisa berubah tanpa unmount** dan **query yang refetch** — bila `bundle.id` tetap, blok tidak jalan, tetapi bila query `refetch` mengembalikan **objek `bundle` baru dengan nilai `instructions` berbeda** (mis. setelah `updateBundle.mutate` sukses), draft **tidak** ikut disegarkan → *stale draft* yang bila `saveSettings` dipanggil lagi akan **menimpa perubahan server**. | Potensi **lost update** pada `instructions`/`durationMinutes` saat editor & pengguna lain/refetch bersamaan. | Ganti dengan pola yang lebih tahan lama: `key={bundle.id}` di komponen turunan, **atau** `useEffect(() => { ... }, [bundle?.id])` dengan dependency **hanya id**, dan hapus sinkron draft dari render. Lebih baik lagi: jadikan `instructionsDraft` `undefined` saat tidak diedit (`const instr = instructionsDraft ?? bundle.instructions ?? ""`). |
| **R-12** | 🟡 | `src/components/questions/enrich-button.tsx:31-44, 76-95` | `run()` → `setOpen(true); enrich.mutate(questionId)`. Saat mutation kedua dipicu, **`enrich.data` lama masih ada** (TanStack Query mempertahankan `data` terakhir). `{!enrich.isPending && res?.ok && proposal && …}` → selama `isPending` lama disembunyikan, tetapi **jika request kedua selesai lebih cepat/gagal**, dialog bisa menampilkan proposal **dari soal sebelumnya**. Respons API saat ini adalah `mode:"single"` dan `questionId` ikut dikembalikan (`EnrichResult.result.questionId`) — klien **tidak pernah memverifikasi** `res.result.questionId === questionId`. | Usulan AI bisa tertukar antar-soal → user menyetujui metadata soal yang salah. | `enrich.reset()` sebelum `mutate`, **atau** tambahkan guard `res?.result.questionId === questionId` saat render, dan gunakan `enrich.variables` untuk mencocokkan. |

### 2.4 Pilar §5 — Keamanan Aksi & Kontrak Error

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **R-13** | ✅ | `src/lib/api/route-wrapper.ts:285-405`; `src/app/api/questions/**` | Semua `POST/PATCH/PUT/DELETE` domain memakai `body: zodSchema` (contoh `questions/route.ts:21`, `[id]/route.ts:36`, `[id]/flag/route.ts:11`). Error dipetakan ke `{ error: { code, message } }` + status HTTP tepat (400/401/403/404/409/413/415/422/429/500). | — | — |
| **R-14** | ✅ | `src/app/api/media/upload/route.ts`; `src/app/img/[shortId]/route.ts` | Upload multipart: validasi `instanceof File`, MIME allowlist, batas 5 MB. Penyajian: `isValidShortId` sebelum DB, **anti path-traversal** (`abs.startsWith(root + sep)`), `nosniff`, `Content-Security-Policy` ketat untuk SVG. | — | Pertimbangkan verifikasi **magic bytes** (bukan hanya `file.type` klien) bila SVG tidak dibutuhkan — SVG tetap bisa berisi `<script>` walau CSP `default-src 'none'` menahan eksekusi. Saat ini **cukup aman**. |
| **R-15** | 🟠 | `src/lib/hooks/use-questions.ts:20-31`; `use-ai.ts:19-24`; `use-media.ts:46-51`; **duplikat `apiFetch`** | 4 salinan `apiFetch` hampir identik, padahal `src/lib/api/fetcher.ts` sudah ada (dokumentasi C3 menyebut konsolidasi). `use-questions` & `use-ai` membuang `error.code`; hanya pesan. | Klien **tidak bisa membedakan** `409 INVALID_TRANSITION` dari `500` → tidak bisa menampilkan pesan spesifik ("Soal sudah berstatus *ready*") atau melakukan retry cerdas. | Konsolidasi ke `src/lib/api/fetcher.ts`; buat `ApiError extends Error` yang membawa `code`, `status`, `details` (dari `wrapRoute`). Ini **prasyarat** R-16/optimistic UI yang aman. |
| **R-16** | 🟠 | `src/components/questions/question-bank-view.tsx:148-172`; `src/components/questions/question-detail-view.tsx:96`; `bundle-builder.tsx:238`; `asset-gallery-view.tsx:298` | Mutasi **tanpa `onError`**: `useQuestions` bulk (`:148` — hanya `onSuccess`, `onError` ada di `runBulk`? **ya** untuk bulk), tetapi (**detail**) `changeStatus.mutate("review")` **tanpa** `onError` → galat 409/403 **tidak ditampilkan**; `addItem.mutate(...)` di builder **tanpa** `onError`; `del.mutate` di galeri memasang `onError` ✅. | User mengklik, tidak terjadi apa pun, **tanpa pesan** — kegagalan senyap. Ini melanggar semangat skill §5 ("*return safe error contracts*") karena kontraknya dibuang di klien. | Pasang `onError` di semua `mutate` → `toast.error(e.message)`. Idealnya tangani di layer: `QueryClient` `defaultOptions.mutations.onError` global (lihat R-17). |
| **R-17** | 🟡 | `src/components/providers/query-provider.tsx:11-24` | `defaultOptions` hanya mengatur `queries: { retry: 1 }`. **Tidak ada `mutations.onError` global.** | Setiap hook yang lupa `onError` = kegagalan senyap (R-16). | Tambahkan `mutations: { onError: (err) => toast.error("…") }` di `QueryClient`. **Perhatikan**: `sonner` `toast` harus diimpor di titik provider atau lewat modul `toast` yang tidak memakai hook — valid untuk `sonner`. Pastikan tidak menggandakan toast pada handler yang **sudah** punya `onError` (buat `silence` flag via meta: `mutation.meta`). |

### 2.5 Aksesibilitas & React 19 API Lain

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **R-18** | ✅ | `question-editor.tsx:411-424` (toolbar), `review-view.tsx:330` dsb. | `disabled={pending}` dengan `Loader2` berputar; `aria-pressed` pada toggle kunci opsi; tombol `aria-label` 44px. | — | — |
| **R-19** | 🟡 | `src/components/questions/review-view.tsx:111-118` | `useEffect` memasang `keydown` untuk ←/→ dengan `[total]`; **tidak** memeriksa `isTypingTarget` (fungsi itu sudah ada di `use-keyboard-shortcuts.ts`), sehingga **ArrowLeft/Right saat mengetik di textarea/dialog "Tolak" memindahkan soal**. | Pengguna menjatuhkan fokus keyboard saat mengetik catatan. | Tambahkan guard `isTypingTarget(e.target)` dan `if (!rejectOpen)` sebelum navigasi. |
| **R-20** | 🟡 | `src/app/(app)/page.tsx`, `src/components/questions/matrix-grid-view.tsx`, `src/app/(app)/studio/*` | Beberapa komponen drag/`@dnd-kit/react` memakai state internal yang tidak dipetakan ke TanStack — perlu dicek ulang bila R-02 diterapkan. | Potensi konflik state ketika dua sumber (server & optimistik) diperbarui. | Setelah R-02, pastikan `SortableRow` menerima `key={item.item.id}` stabil (sudah ✅) sehingga reorder optimistik memindahkan DOM dengan benar. |

---

## 3. Analisis Mendalam per Temuan Kunci

### 3.1 R-01 — "Anti double-submit yang *ada di kertas*, tidak di kode"

`ADR-0022` dan komentar `questions/route.ts:24` menyatakan:

```ts
idempotent: true, // #4: dukung Idempotency-Key (anti double-submit)
```

**Infrastruktur lengkap:** `checkIdempotency`, `rememberResponse`, `forgetIdempotencyStore` (src/lib/api/idempotency.ts, 136 baris) + logika replay/in-flight di `route-wrapper.ts:335-360`.

**Namun:** `grep -r "Idempotency-Key" src/` pada **klien** → **0 hasil**. `apiFetch` di `use-questions.ts` tidak mengirim header. Akibatnya:

- `POST /api/questions` (create) — **klien tidak memakai** idempotensi; double-click "Simpan Draf" di `question-editor.tsx:375-378` (yang memanggil `create.mutate`) **dapat membuat dua soal**.
- `POST /api/bundles` (create) — `bundle-list-view.tsx:168` `create.mutate` **tanpa** `idempotent` di server (`bundles/route.ts` perlu dicek) → duplikat mungkin.
- `POST /api/questions/batch` — tidak diaktifkan `idempotent`.

Ini **temuan HIGH** karena dampaknya *data ganda* (kebersihan data = prioritas #2 di AGENTS.md: "data milik orang"), bukan sekadar UI.

**Bukti kode — editor tidak memakai idempotensi:**
```ts
// question-editor.tsx:374-379
update.mutate(payload, { onSuccess: (q) => (q ? onDone(q) : router.refresh()) });
create.mutate(payload, { onSuccess: onDone });
```

**Rekomendasi konkret:**
1. `apiFetch` terima `init.idempotencyKey` → set header `Idempotency-Key: crypto.randomUUID()`.
2. Hook `useCreateQuestion`/`useCreateBundle` membangkitkan key **per form-submit attempt** (simpan di `useRef` saat submit) — bukan per render — agar retry otomatis React Query memakai key **yang sama**.
3. Server: pasang `idempotent: true` pada `POST /api/bundles` & `POST /api/questions/batch`.

### 3.2 R-02 — Drag reorder tanpa optimistic update

`BundleBuilder` adalah **satu-satunya** alur di aplikasi yang punya interaksi "geser piksel demi piksel" namun **tidak** memindahkan data lokal. Perilaku saat ini:

1. User menyeret item 5 ke posisi 2, melepas.
2. `onDragEnd` menghitung `next[]` → `reorder.mutate(ids)`.
3. `useReorderBundleItems.onSuccess` → `invalidateQueries(detail)`.
4. **Selama t**, `bundle.items` (**sumber render**) masih urutan **lama** → baris melompat kembali.
5. Setelah refetch: urutan baru muncul.

Ini adalah **anti-pattern klasik** yang skill §4 sasar. Perbaikannya tidak membutuhkan Server Action:

```ts
// use-bundles.ts — pola setQueryData (ekuivalen useOptimistic di React Query)
mutationFn: (itemIds) => api(`/api/bundles/${bundleId}/items`, { method: "PUT", body: JSON.stringify({ itemIds }) }),
onMutate: async (itemIds) => {
  await qc.cancelQueries({ queryKey: bundleKeys.detail(bundleId) });
  const prev = qc.getQueryData<BundleDetail>(bundleKeys.detail(bundleId));
  if (prev) {
    const byId = new Map(prev.items.map(i => [i.item.id, i]));
    qc.setQueryData(bundleKeys.detail(bundleId), {
      ...prev,
      items: itemIds.map(id => byId.get(id)).filter(Boolean),
    });
  }
  return { prev };
},
onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(bundleKeys.detail(bundleId), ctx.prev),
onSettled: () => qc.invalidateQueries({ queryKey: bundleKeys.detail(bundleId) }),
```

> Catatan: `useOptimistic` **tidak bisa** dipakai langsung di hook TanStack Query (ia terikat `startTransition` + state React). Pola `onMutate`/`setQueryData` adalah padanan idiomatiknya dan **tidak melanggar ADR** (tetap Route Handler + React Query).

### 3.3 R-04 — `setState` saat render

```ts
// bundle-builder.tsx:174-179 (di badan fungsi komponen)
if (bundle && bundle.id !== lastBundleId) {
  setLastBundleId(bundle.id);
  setDurationDraft(bundle.durationMinutes ? String(bundle.durationMinutes) : "");
  setInstructionsDraft(bundle.instructions ?? "");
}
```

React mendokumentasikan pola ini sebagai **"adjusting state when a prop changes"** — sah **hanya bila** kondisi dipicu murni oleh prop. Di sini ia bermasalah karena:

- `bundle.instructions` **juga** berubah akibat refetch/invalidasi, bukan hanya `id`. Karena guard = `id`, draft **tidak** di-resync → **stale edit**.
- `saveSettings()` (`:200-212`) mengirim **seluruh** `instructionsDraft` **hanya bila** `instr !== bundle.instructions`. Dengan draft yang basi, perbandingan bisa menghasilkan `patch` yang benar atau **salah** tergantung kapan refetch masuk.

Perbaikan yang lebih aman (tanpa mengubah arsitektur): gunakan state *overrides* opsional.

```ts
const [overrides, setOverrides] = useState<{ duration?: string; instructions?: string }>({});
const durationValue = overrides.duration ?? (bundle?.durationMinutes ? String(bundle.durationMinutes) : "");
const instructionsValue = overrides.instructions ?? (bundle?.instructions ?? "");
// onChange → setOverrides({ ...overrides, instructions: e.target.value })
// setelah sukses simpan → setOverrides({})
```

### 3.4 R-16/R-17 — Kegagalan senyap

`question-detail-view.tsx:96`:

```ts
changeStatus.mutate("review");
```

FSM dapat menolak (`409 INVALID_TRANSITION` — mis. soal sudah `review`) atau `403` (izin ber-`own` ditegakkan di service). Tanpa `onError`, **user melihat tombol berkedip lalu tidak terjadi apa pun**. Ini memperburuk diagnosis; pengguna akan menekan berulang kali (memperkuat R-01).

### 3.5 Yang Sudah Baik (Jangan Disentuh)

- **Proyeksi anti-bocorkan kunci** (`CONSTRAINTS #34`, ESLint `no-restricted-syntax`) — server memfilter `answer_key`; klien pun tak bisa melihat kunci untuk non-guru. Ini jauh lebih kuat dari pola Server Action yang mengembalikan payload.
- **`wrapRoute` sebagai choke point tunggal** — rate limit, idempotensi, audit, metrik, dan pemetaan error terpusat. Skill §5 sepenuhnya terpenuhi di sini.
- **Distribusi `isPending` per-baris** di `ReviewRow`/`FlaggedRow` (`useChangeQuestionStatus(q.id)` **per baris**) — pilihan tepat: satu baris menolak tidak mengunci antrean.

---

## 4. Matriks Kepatuhan Skill

| Skill § | Klausa | Status | Catatan |
|---|---|---|---|
| §1 | Larang `useMemo`/`useCallback`/`React.memo` default | 🟠 **Patuh sebagai konvensi** | 1 `memo` sah; compiler **tidak aktif** (R-06) |
| §1 | Pengecualian via profil terukur | ✅ | `QuestionCard` didokumentasikan PERF-02/MAT-47 |
| §2 | `useActionState` menggantikan `useState(loading)+useEffect+submit` | ⛔ **Dilarang** (ADR-0022) | Kontrak proyek menang atas skill |
| §3 | `useFormStatus` di dalam `<form>` | ⛔ **Tidak relevan** | Tidak ada form mutasi (R-10 tetap isu UX) |
| §4 | `useOptimistic` untuk umpan balik instan | 🔴 **Tidak dipakai** (padahal diizinkan) | R-02, R-03 |
| §5 | Validasi Zod di server | ✅ | `wrapRoute` + schema |
| §5 | Kembalikan `{ success, error }`, jangan throw | ✅ **Setara** | `{ data }` / `{ error: { code, message } }` |
| §5 | Jangan biarkan error terobscured di produksi | ✅ | `errorResponse` → `INTERNAL_ERROR` 500 tanpa detail |

**Skor literal:** 3 ✅ · 1 🟠 · 1 🔴 · 3 ⛔ (konflik kontrak) — **≈ 2.0/5** bila ⛔ dianggap nol, **≈ 3.5/5** bila ⛔ dikecualikan sebagai konflik yang sah.
**Skor spirit (umpan balik instan + aman + validasi):** **≈ 3.0/5**.

---

## 5. Rekomendasi Berprioritas

### P0 — sebelum rilis berikutnya
1. **R-01** Guard double-submit + **hubungkan `Idempotency-Key`** di klien (perbaikan infrastruktur yang sudah ada, dampak data ganda).
2. **R-02** Optimistic reorder `bundle-builder` (`setQueryData` + rollback).
3. **R-04** Ganti `setState`-saat-render di `BundleBuilder` dengan pola *overrides*.

### P1 — sprint ini
4. **R-16/R-17** `mutations.onError` global + tambahkan `onError` pada titik yang hilang (`question-detail-view:96`, `bundle-builder:238`).
5. **R-15** Konsolidasi `apiFetch` ke `fetcher.ts`; bawa `code`/`status` di `ApiError`.
6. **R-03** Optimistic removal/marking di antrean telaah.
7. **R-10** `<form onSubmit>` untuk login & ganti-sandi.

### P2 — backlog
8. **R-06** Keputusan ADR soal React Compiler (aktifkan atau tegaskan "konvensi").
9. **R-12** `enrich.reset()` + guard `questionId`.
10. **R-11** Bentuk tunggal `saved` (derivasi, bukan state).
11. **R-19** Guard `isTypingTarget` di navigasi keyboard RapidReview.
12. **R-14** Verifikasi magic bytes upload (opsional).

---

## 6. Risiko Migrasi ke Server Actions (Peringatan)

Bila pemilik memutuskan skill ini **patuh secara literal** (migrasi ke §2/§3):

- **ADR-0022 harus digantikan** lebih dulu (ADR baru, bukan timpa — AGENTS §5).
- **Lapisan `wrapRoute`** (rate-limit, idempotensi, audit, metrik, pemetaan 10 kelas error) **belum punya padanan** di Server Action. Menggantinya secara langsung = **regresi keamanan** (sekitar 50 route).
- **Anti-bocorkan kunci** (`#34`) bergantung pada proyeksi di server; Server Action mengembalikan payload React → risiko terulang (disebut ADR-0022 §Konteks poin 3).
- Nilai yang **bisa diambil tanpa migrasi** hanyalah §4 (`useOptimistic`) dan disiplin pending/error — itulah fokus rekomendasi §5.

**Kesimpulan:** **jangan** migrasi. Adopsi §4 + perbaikan §5; tolak §2/§3 sesuai ADR-0022.

---

## 7. Catatan Verifikasi (CONSTRAINTS #44)

**Langkah yang dieksekusi & buktinya:**

| Klaim | Perintah/Bukti | Hasil |
|---|---|---|
| Versi React/Next | `node -e "require('react/package.json').version …"` | `19.3.0 / 16.3.8 / 19.3.0` ✅ |
| Server Action tidak ada | `grep -rl "'use server'" src` | **0 berkas** ✅ |
| Hook React 19 action | `grep -rn "useOptimistic\|useActionState\|useFormStatus" src` | **0** ✅ |
| React Compiler tidak aktif | `grep reactCompiler next.config.ts` → 0; `ls node_modules/babel-plugin-react-compiler` → *No such file*; `pnpm-lock.yaml:2007,3762` hanya *optional peer* | ✅ |
| `memo` non-vendor | `grep -rn "React.memo\|memo(" src --include=*.tsx \| grep -v components/ui/` | **1** (`question-card.tsx:522`) ✅ |
| `useMemo`/`useCallback` non-vendor | idem | **0** ✅ |
| `type="submit"` | `grep -rn 'type="submit"' src --include=*.tsx \| grep -v components/ui/` | **0** ✅ |
| `<form>` | `grep -rn "<form" src --include=*.tsx \| grep -v components/ui/` | **2** (keduanya pencarian) ✅ |
| Idempotency-Key di klien | `grep -rn "Idempotency-Key" src` | **0** pada klien; hanya di `route-wrapper.ts` & test ✅ |
| `pnpm typecheck` | dijalankan | **LULUS** (tanpa error) |
| `pnpm lint` | dijalankan | **GAGAL** — `7 errors, 45 warnings`; **semua error di `scripts/dev/**`** (`prefer-const`, `no-require-imports`), **bukan** di `src/**`. Tidak terkait temuan audit ini, tetapi **gerbang mutu AGENTS §4 sedang merah** — dilaporkan apa adanya. |

**Yang TIDAK dijalankan:** `pnpm test`, `pnpm test:db`, `pnpm db:verify`, `pnpm build` (audit read-only; tidak ada perubahan kode, dan menjalankan build memakan waktu/DB. **Tidak ada klaim hijau** untuk gerbang-gerbang tersebut).

**Batas keyakinan:** Temuan R-01, R-02, R-04, R-10, R-15, R-16 diverifikasi langsung dengan membaca kode & grep. **R-11** serta **R-12** bergantung pada perilaku runtime TanStack Query (`isSuccess` bertahan setelah input berubah; `data` bertahan antar-`mutate`) — ini perilaku terdokumentasi pustaka, **tidak** diverifikasi lewat tes di lingkungan ini.

---

## 8. Yang Belum Selesai / Di Luar Cakupan

- Tidak ada perbaikan kode yang diterapkan (audit read-only).
- Tidak ada uji runtime/Playwright untuk mereproduksi R-01/R-02 secara visual.
- `matrix-grid-view.tsx`, `studio/*`, `command-palette.tsx` **tidak** diaudit mendalam — hanya disampling.
- Klaim "`bulk.isPending` adalah observers count" pada R-01 **dikoreksi di temuan itu sendiri**: risiko sebenarnya adalah *absennya guard* dan *absennya Idempotency-Key*, bukan disabled-state yang salah.
- Registrasi `docs/PETA-DOKUMEN.md` (#31) ditambahkan; bila pemilik lebih suka laporan di `docs/audit/` (bukan `MathBankAuditor/reports/`), pindahkan dan perbarui registrasi.
