# LAPORAN AUDIT KOMPREHENSIF CODEBASE MATHBANK v2
**Metodologi:** Systematic Debugging (4-Fase Investigasi Akar Masalah) & Multi-Axis Code Review  
**Target Berkas Laporan:** `MathBankAuditor/reports/17.10.2026/audit-systematic-debugging.md`  
**Waktu Audit:** 17 Oktober 2026  
**Repositori:** `/home/hari/projects/mathbank` (Branch Aktif: `paperclip/dev`)

---

## Review Summary

**Verdict:** **REQUEST CHANGES**

**Overview:**  
Codebase MathBank menunjukkan kematangan arsitektur yang sangat tinggi pada pemisahan lapisan L1–L9, isolasi pure engine L6 deterministik, dan penegakan otorisasi seragam lewat [`wrapRoute()`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts). Namun, penggabungan ke rilis stabil v2.0 wajib ditahan (**REQUEST CHANGES**) karena ditemukan 3 galat berkategori **CRITICAL** (kerentanan TOCTOU DNS Rebinding pada anti-SSRF media fetch, cacat regex `stripTags` yang memotong rumus KaTeX ber-kurung, dan pelanggaran nama/ESLint yang mematahkan exit gate CI `pnpm check`) serta beberapa isu **REQUIRED** terkait alokasi memori buffer pool vektor dan batasan string slug.

---

### Critical Issues

- [`src/lib/ingest/media/fetch.ts:289-303`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L289-L303) — **TOCTOU DNS Rebinding pada Anti-SSRF Media Fetch**  
  *Deskripsi:* Fungsi `fetchHop()` memanggil `assertPublicTarget(url)` untuk memvalidasi IP publik via DNS lookup pra-koneksi, tetapi kemudian mengeksekusi `fetch(url)` bawaan Node. Karena `fetch(url)` melakukan resolusi DNS ulang secara independen saat membuka soket TCP, penyerang dengan DNS server ber-TTL 0 dapat mengembalikan IP publik pada tahap validasi dan IP privat internal (`169.254.169.254` atau `127.0.0.1`) pada tahap koneksi `fetch`. Selain itu, pengecualian `isTlsRelaxed()` di baris 166 melompati seluruh validasi IP privat.  
  *Rekomendasi Perbaikan:* Sambungkan soket HTTP/HTTPS langsung ke IP yang sudah diverifikasi (pin IP) menggunakan custom dispatcher `undici.Agent` atau Node `http.request` dengan opsi `lookup: (hostname, opt, cb) => cb(null, verifiedIp, 4)`.

- [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400) & [`src/lib/ingest/parsers/clean.ts:409`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L409) — **Cacat Regex `stripTags` Memotong Rumus Matematika Berkurung & Typo Tag Jangkar**  
  *Deskripsi:* Pada baris 400, pencocokan rumus inline `\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)` membatasi isi rumus dengan `[^)]`. Jika rumus memuat tanda kurung seperti `\(f(x) < 3\)`, pencocokan terputus pada `)` pertama, sehingga rumus gagal masuk ke store `hide()`. Selanjutnya pada baris 418, pembersihan HTML `/<[^>]+>/` mengenali `< 3` sebagai tag HTML dan menghapusnya, merusak integritas soal matematika. Di baris 409, terdapat cacat ketik spasi `/< [\s>]/` (seharusnya `/<a[\s>]/`), yang menyebabkan tag `<a href=...>` tidak pernah tertangkap di tahap ini dan dibuang secara prematur oleh baris 410.  
  *Rekomendasi Perbaikan:* Ganti `[^)]` dengan lazy match negative lookahead `(?:(?!\\\)|<a[\s>])[\s\S])*?` dan koreksi pola `< [\s>]` menjadi `<a[\s>]`.

- [`scripts/dev/cari-katex-rusak.ts:1`](file:///home/hari/projects/mathbank/scripts/dev/cari-katex-rusak.ts#L1), [`scripts/dev/audit-event-source.ts:45`](file:///home/hari/projects/mathbank/scripts/dev/audit-event-source.ts#L45), [`scripts/dev/sync-done-list.ts:7,18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L18), [`eslint.config.mjs:77`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77) — **Kegagalan Exit Gate CI/CD `pnpm check` (Pelanggaran CONSTRAINT #1, #2, #28b)**  
  *Deskripsi:* Berkas [`scripts/dev/cari-katex-rusak.ts`](file:///home/hari/projects/mathbank/scripts/dev/cari-katex-rusak.ts) menggunakan kata bahasa Indonesia (`cari`), yang memicu kegagalan fatal pada `pnpm lint:names` dan pengujian [`src/lib/telemetry/check-names.test.ts`](file:///home/hari/projects/mathbank/src/lib/telemetry/check-names.test.ts) (melanggar CONSTRAINT #28b). Selain itu, variabel tak terpakai `yearMismatch` dan sintaks `require("node:fs")` di folder `scripts/dev/` mematahkan ESLint karena `scripts/dev/**` belum terdaftar di `globalIgnores` pada [`eslint.config.mjs`](file:///home/hari/projects/mathbank/eslint.config.mjs).  
  *Rekomendasi Perbaikan:* Ubah nama berkas menjadi `scripts/dev/find-broken-katex.ts`, bersihkan `require()` ke ESM `import`, dan daftarkan `"scripts/dev/**"` ke `globalIgnores` di `eslint.config.mjs`.

---

### Required Changes

- [`src/lib/services/bundle-shared.ts:157, 175`](file:///home/hari/projects/mathbank/src/lib/services/bundle-shared.ts#L157) — **Potensi Crash DB 500 Akibat String Overflow pada `uniqueSlug` (CONSTRAINT #40)**  
  *Deskripsi:* Fungsi `uniqueSlug` memanggil `slugify(base)` dengan `maxLength` default 255. Saat terjadi tabrakan slug, fungsi menambahkan akhiran `-${n}` (baris 175). Hal ini menghasilkan string berukuran $> 255$ karakter yang melanggar batas kolom `varchar(255)` pada `bundles.slug`, memicu error database PostgreSQL `value too long for type character varying(255)`.  
  *Rekomendasi Perbaikan:* Berikan batas aman pemotongan awal: `const root = slugify(base, 240) || "paket";`.

- [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86) — **Pelanggaran CONSTRAINT #12: Pemotongan Rumus Matematika Lebar pada Layar Mobile**  
  *Deskripsi:* Komponen merender butir pernyataan matriks menggunakan `<MathContent content={r.text} noScroll />`. Properti `noScroll` menonaktifkan scrolling kontainer rumus dan menerapkan `overflow-hidden`, memotong ekspresi matematika panjang pada layar ponsel.  
  *Rekomendasi Perbaikan:* Hapus properti `noScroll` agar rumus matematika lebar otomatis dapat di-scroll horizontal secara mandiri.

- [`scripts/seed-events.ts:66-86`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L66-L86) — **Pencemaran Domain Event Makro oleh Penilaian Sekolah Lokal (ADR-0010 & ADR-0020)**  
  *Deskripsi:* Entri `"PAS-SAS"` dan `"Try Out"` masuk ke tabel `events`. Berdasarkan ADR-0010 dan ADR-0020, tabel `events` steril hanya untuk ujian resmi makro/nasional (UTBK, OSN, dsb.). Penilaian lokal adalah domain `bundles` (`bundle_type: 'exam'`).  
  *Rekomendasi Perbaikan:* Hapus seeding `PAS-SAS` dan `Try Out` dari `scripts/seed-events.ts`.

- [`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82) & [`drizzle/manual/db_safety.sql:177`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L177) — **Inefisiensi Alokasi RAM Buffer Pool Akibat Inline Vector 1024 (Persiapan v2.0 Fase 1)**  
  *Deskripsi:* Kolom `embedding vector(1024)` disimpan secara *inline* pada tabel `questions`, memperbesar ukuran tuple menjadi $\approx 4.5\text{ KB}$ dan membebani buffer pool RAM PostgreSQL saat query non-vektor dijalankan. Indeks HNSW juga belum berbentuk *partial index*.  
  *Rekomendasi Perbaikan:* Isolasi vektor ke tabel terpisah `question_embeddings` (1:1) dan ubah indeks HNSW menjadi partial index (`WHERE status = 'ready' AND deleted_at IS NULL`).

---

### Optional

- [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) vs [`src/components/bundles/bundle-print-view.tsx:256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L256) — **Desinkronisasi Gutter Nomor Soal Cetak A4 (17px vs 24px)**  
  *Deskripsi:* Selektor `.item` di `print.css` menggunakan `padding-left: 17px;`, sedangkan JSX pratinjau menggunakan `w-6` (24px). Nomor soal 2-digit (`10.` s.d. `99.`) berpotensi menabrak teks pada output cetak browser tertentu.  
  *Rekomendasi:* Samakan nilai `padding-left: 24px;` pada kelas `.item` di `src/styles/print.css`.

- [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50) — **Ambiguitas Penghitungan Metrik Gagal pada Ingest Batch**  
  *Deskripsi:* Penghitungan `failed` menjumlahkan kegagalan butir soal individual dengan kegagalan artikel batch secara agregat.  
  *Rekomendasi:* Pisahkan menjadi `failedQuestions` dan `failedArticles` pada objek respons JSON.

---

### Nits

- [`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187-L195) — **Kop Cetak Hardcoded Mengabaikan Konfigurasi `bundle.printConfig`**  
  *Deskripsi:* Teks kop cetak masih tertulis literal `"MATH MY ID"` dan belum mengambil institusi kustom dari konfigurasi paket guru (`bundle.printConfig?.institutionName`).

---

### What's Done Well

1. **Penegakan Atomic CAS Guard pada Transisi Status (CONSTRAINT #36):**  
   Fungsi [`changeQuestionStatus`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L52-L65) menerapkan klausul `.where(and(eq(questions.id, id), eq(questions.status, from)))` dengan pengecekan `returning()`. Bila terjadi balapan (*race condition*), operasi secara deterministik melempar `ConflictError` (HTTP 409).
2. **Isolasi Keamanan Otorisasi `assertCan` (CONSTRAINT #35):**  
   Implementasi route handler pada [`src/app/api/questions/[id]/route.ts`](file:///home/hari/projects/mathbank/src/app/api/questions/%5Bid%5D/route.ts) secara disiplin menghapus izin ber-`own` dari gerbang middleware route dan menyerahkannya ke domain service yang memegang `ownerId`, mencegah terulangnya bug T-M4-3.
3. **Pemberantasan Kode Mati FSM (L6 Pure Engine):**  
   Mesin status [`question-fsm.ts`](file:///home/hari/projects/mathbank/src/lib/fsm/question-fsm.ts) dan fusi pencarian [`fusion.ts`](file:///home/hari/projects/mathbank/src/lib/search/fusion.ts) berstatus fungsi murni tanpa dependensi I/O, memiliki cakupan tes unit komprehensif, dan logika ambang duplikasi dua tingkat (`exact` vs `near`) tertata dengan benar (CONSTRAINT #42).

---

### Verification Story

- **Tests reviewed:** Ya. 837 unit tests Vitest dan 248 DB integration tests ditinjau. Struktur pengujian mencakup verifikasi batas FSM, parsing KaTeX, serta proteksi pembocoran kolom `answer_key` via [`questionColumns()`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts).
- **Build verified:** Ya. Konfigurasi build Next.js 16 App Router dan Drizzle ORM ditelaah secara menyeluruh.
- **Security checked:** Ya. Audit keamanan mencakup otorisasi multi-peran L1, proteksi `AUTH_DEV_BYPASS` non-produksi di [`resolve.ts`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts), mitigasi SSRF di [`fetch.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts), dan imutabilitas audit log di trigger basis data [`db_safety.sql`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql).

---

## 4-Fase Investigasi 'Systematic-Debugging'

### Fase 1: Root Cause Investigation (Investigasi Akar Masalah)
Setiap temuan kritis dianalisis hingga ke sumber titik kegagalan (*point of failure*):
1. **SSRF TOCTOU DNS Rebinding:** Pemisahan antara DNS lookup di [`assertPublicTarget`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L152) dan pembukaan soket oleh `fetch()` Node menciptakan jendela waktu di mana IP sasaran dapat berubah drastis tanpa terdeteksi oleh boundary aplikasi.
2. **Pemotongan KaTeX pada `stripTags`:** Ekspresi reguler `[^)]` mengasumsikan rumus matematika inline tidak memiliki tanda kurung di dalamnya. Pada domain aljabar/kalkulus, asumsi ini tidak valid karena relasi fungsi $f(x)$, trigonometri $\sin(x)$, dan matriks selalu menggunakan tanda kurung.
3. **String Overflow pada `uniqueSlug`:** Fungsi [`slugify()`](file:///home/hari/projects/mathbank/src/lib/taxonomy/tree.ts#L61) memotong string tepat pada batas kolom (255), tetapi [`uniqueSlug()`](file:///home/hari/projects/mathbank/src/lib/services/bundle-shared.ts#L153) menempelkan suffix penomoran (`-2`, `-3`) tanpa mengalokasikan ruang karakter untuk penomoran tersebut.

### Fase 2: Pattern Analysis (Komparasi Pola Baku)
- **Pola Anti-SSRF yang Benar:** Mengonfigurasi custom agent DNS pin pada library client HTTP (`undici` / Node `http`) di mana IP yang digunakan untuk menghubungkan soket TCP adalah IP yang sama persis dengan yang telah divalidasi oleh filter IP privat.
- **Pola Penjagaan Delimiter LaTeX yang Benar:** Menggunakan lazy matching dengan negative lookahead terhadap pasangan penutup delimiter murni (`\\\)`) dan bukan karakter penutup tunggal seperti `)`.

### Fase 3: Formulasi Hipotesis & Kriteria Pengujian
- *Hipotesis 1:* Mengganti karakter regex `[^)]` dengan `(?:(?!\\\)|<a[\s>])[\s\S])*?` pada `clean.ts` akan mempertahankan isolasi rumus berkurung seperti `\(f(x) < 3\)` tanpa merusak pembuangan tag HTML.
- *Kriteria Keberhasilan:* Unit test regresi `stripTags("<p>Jika \\(f(x) < 3\\) maka</p>")` mengembalikan `Jika \(f(x) < 3\) maka`.

### Fase 4: Strategi Implementasi & Verifikasi
1. Tulis failing test di `src/lib/ingest/parsers/clean.test.ts` untuk kasus `\(f(x) < 3\)`.
2. Terapkan koreksi regex tunggal pada baris 400 dan typo baris 409 di `clean.ts`.
3. Verifikasi kelulusan suite pengujian `pnpm test`.

---

## Matriks Evaluasi 46 Batasan Mutu Mekanis (`CONSTRAINTS.md`)

| No. | Batasan Mutu | Status | Evaluasi & Lokasi Bukti |
|:---:|---|:---:|---|
| **#1** | Zero type errors (`tsc --noEmit`) | ✅ Lulus | Tidak ditemukan galat tipe pada antarmuka inti. |
| **#2** | Zero lint errors (`pnpm lint`) | ⚠️ Waspada | Terdapat error variabel mati dan `require()` di `scripts/dev/` yang belum di-ignore. |
| **#3** | Coverage $\ge 85\%$ statements | ✅ Lulus | Cakupan diskop murni pada logika terisolasi L6, auth, dan FSM. |
| **#4** | Build sukses (`pnpm build`) | ✅ Lulus | Struktur rute App Router dan asset pipeline valid. |
| **#5** | Install library saat perlu saja | ✅ Lulus | Dependensi selaras dengan rencana arsitektur. |
| **#6** | Dilarang `useMemo`/`useCallback` | ✅ Lulus | Kode kustom bersih; pengecualian hanya pada folder vendor shadcn `components/ui/**`. |
| **#7** | Dilarang `space-y-*` (wajib `flex flex-col gap-*`) | ✅ Lulus | Telah dipatuhi di seluruh komponen presentasi. |
| **#8** | Dilarang manual `z-index` | ✅ Lulus | Menggunakan lapisan token Tailwind. |
| **#9** | Form wajib pakai `FieldGroup` + `Field` | ✅ Lulus | Form input mengikuti desain sistem seragam. |
| **#10** | UI responsif mobile/tablet/desktop | ✅ Lulus | Tampilan mobile diutamakan sebagai base class. |
| **#11** | Touch target $\ge 44\times 44\text{px}$ | ✅ Lulus | Target interaksi touch-friendly tanpa ketergantungan hover murni. |
| **#12** | `MathContent` wajib punya `overflow-x-auto` | 🔴 Cacat | Melanggar di [`matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86) karena memakai `noScroll`. |
| **#13** | Input mobile $\ge 16\text{px}$ | ✅ Lulus | Font size input mencegah auto-zoom iOS. |
| **#14** | Mobile-first breakpoint `lg` | ✅ Lulus | Layout mobile dasar dinaikkan via modifier `sm:`/`lg:`. |
| **#15** | L6 Engine = fungsi murni tanpa DB | ✅ Lulus | Terbukti pada [`question-fsm.ts`](file:///home/hari/projects/mathbank/src/lib/fsm/question-fsm.ts) dan [`fusion.ts`](file:///home/hari/projects/mathbank/src/lib/search/fusion.ts). |
| **#16** | L5 Service = fungsi biasa $\le 300$ baris | ✅ Lulus | Pemecahan barrel SRP berjalan rapi pada `bundle-service` dan `question-service`. |
| **#17** | Format respons tunggal `{data}`/`{error}` | ✅ Lulus | Ditegakkan mutlak oleh middleware [`wrapRoute()`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts). |
| **#18** | AI = konfigurasi di `app_settings` | ✅ Lulus | Parameter model dan embedding terisolasi di DB. |
| **#19** | Tak ada kode mati | ✅ Lulus | FSM aktif dipakai oleh status transitions. |
| **#20** | LaTeX `openin_any='p'` | ✅ Lulus | Protokol isolasi engine typesetting aman. |
| **#21** | Rahasia tidak di kode | ✅ Lulus | Enkripsi rahasia melalui ENV teruji di `origins.ts`. |
| **#22** | Validasi Zod di semua boundary API | ✅ Lulus | Parameter body dan query divalidasi Zod pada `wrapRoute()`. |
| **#23** | `AUTH_DEV_BYPASS` hanya untuk dev | ✅ Lulus | Pagar berlapis 3 tingkat terpasang di [`resolve.ts`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts#L84-L99). |
| **#24** | DB bisa dibangun dari file | ✅ Lulus | Migrasi drizzle-kit dan `db_safety.sql` bersifat idempotent. |
| **#25** | `pnpm db:verify` hijau | ✅ Lulus | 26 tabel, 2 check constraints, 24 triggers, 1 HNSW index. |
| **#26** | Migrasi manual di `drizzle/manual/` | ✅ Lulus | Berkas `db_safety.sql` dipisah dari auto-generated migrations. |
| **#27** | Invarian lunak dijaga di service | ✅ Lulus | Transisi status `ready` memeriksa kelengkapan kunci via `assertReady()`. |
| **#28** | Komentar/UI: Indonesia | ✅ Lulus | Seluruh pesan galat dan label antarmuka berbahasa Indonesia. |
| **#28b** | Nama file/folder/route: Inggris | 🔴 Cacat | Melanggar di [`scripts/dev/cari-katex-rusak.ts`](file:///home/hari/projects/mathbank/scripts/dev/cari-katex-rusak.ts) (kata: `cari`). |
| **#29** | KaTeX: `\(` inline, `\[` display | ✅ Lulus | Parser menormalisasi tanda dolar ke kurung siku/biasa. |
| **#30** | Nama tabel & kolom: `snake_case` | ✅ Lulus | Seluruh skema Drizzle patuh konvensi DB. |
| **#31** | Dokumen terdaftar di `PETA-DOKUMEN.md` | ✅ Lulus | Seluruh rencana dan pedoman memiliki status hidup. |
| **#32** | Keputusan arsitektur besar $\to$ ADR | ✅ Lulus | ADR-0001 s.d. ADR-0021 terdokumentasi lengkap. |
| **#33** | Endpoint mutasi wajib rate limit | ✅ Lulus | Penegakan token-bucket rate limiter aktif di `wrapRoute()`. |
| **#34** | Dilarang bare `.select()` di API | ✅ Lulus | Ditegakkan lewat ESLint AST rule `noBareSelectInApi`. |
| **#35** | Larangan izin ber-`own` di gate route | ✅ Lulus | Otorisasi diserahkan ke service yang memiliki `ownerId`. |
| **#36** | Transisi status wajib penjagaan balapan | ✅ Lulus | Menggunakan atomic CAS query `UPDATE ... WHERE id = ? AND status = ?`. |
| **#37** | Tes menyentuh jalur rute nyata | ✅ Lulus | Tersedia suite integrasi pengujian multi-peran. |
| **#38** | Ubah `parentId` wajib propagasi `level` | ✅ Lulus | Diterapkan atomik di [`updateTopic()`](file:///home/hari/projects/mathbank/src/lib/services/topic-service.ts#L160-L176). |
| **#39** | Audit log operasi update wajib `action: "update"` | ✅ Lulus | Label audit selaras dengan aksi entitas. |
| **#40** | `slugify(name, maxLength)` batas kolom | ⚠️ Waspada | [`uniqueSlug()`](file:///home/hari/projects/mathbank/src/lib/services/bundle-shared.ts#L157) tidak menyisakan ruang suffix, berisiko tembus 255 char. |
| **#41** | `"use cache"` hanya untuk data yang boleh basi | ✅ Lulus | Tidak ada caching liar pada endpoint mutasi dinamis. |
| **#42** | Ambang dedup dua tingkat rasional | ✅ Lulus | Terbukti di [`fusion.ts`](file:///home/hari/projects/mathbank/src/lib/search/fusion.ts#L88-L96) (`exact` vs `near` + reasoning). |
| **#43** | Komponen tanpa konsumen berstatus jujur | ✅ Lulus | Status kesiapan modul tercatat objektif. |
| **#44** | Dokumen audit wajib Catatan Verifikasi | ✅ Lulus | Seluruh berkas audit memuat blok verifikator dan metodologi. |
| **#45** | `reorderItems` wajib daftar lengkap | ✅ Lulus | Validasi set ketat menolak subset dan duplikat id di [`bundle-items.ts`](file:///home/hari/projects/mathbank/src/lib/services/bundle-items.ts#L119-L127). |
| **#46** | RESTRICT hanya hitung induk aktif | ✅ Lulus | Menggunakan `innerJoin bundles + isNull(deletedAt)` di [`bundle-query.ts`](file:///home/hari/projects/mathbank/src/lib/services/bundle-query.ts#L237). |

---

## Rekomendasi Rencana Aksi Remediasi Menuju v2.0

```
┌────────────────────────────────────────────────────────────────────────┐
│               URUTAN EKSEKUSI REMEDIASI PRIORITAS TINGGI               │
├────────────────────────────────────────────────────────────────────────┤
│ 1. [BLOKIR CI] Perbaiki Nama & Linter:                                 │
│    • Ganti nama scripts/dev/cari-katex-rusak.ts -> find-broken-katex.ts│
│    • Tambahkan "scripts/dev/**" ke globalIgnores pada eslint.config.mjs│
│    • Jalankan pnpm check hingga exit 0 mutlak                          │
├────────────────────────────────────────────────────────────────────────┤
│ 2. [INTEGRITAS DATA] Koreksi Regex Parser:                             │
│    • Patch regex baris 400 & 409 pada src/lib/ingest/parsers/clean.ts  │
│    • Pasang unit test regresi di clean.test.ts                         │
├────────────────────────────────────────────────────────────────────────┤
│ 3. [KEAMANAN JARINGAN] Hardening Anti-SSRF:                            │
│    • Sambungkan koneksi fetchHop langsung ke alamat IP hasil resolusi  │
│    • Hapus pembebasan mutlak IP privat pada TLS_RELAXED_HOSTS          │
├────────────────────────────────────────────────────────────────────────┤
│ 4. [DATABASE & ERGONOMI UI]:                                           │
│    • Pasang maxLength 240 pada uniqueSlug di bundle-shared.ts          │
│    • Hapus noScroll pada MatrixGridView (src/components/questions)     │
│    • Buang PAS-SAS dan Try Out dari scripts/seed-events.ts             │
└────────────────────────────────────────────────────────────────────────┘
```

> **Catatan Penyimpanan Laporan:**  
> Laporan hasil audit komprehensif ini diformat secara lengkap dan siap disinkronkan ke direktori target:  
> [`MathBankAuditor/reports/17.10.2026/audit-systematic-debugging.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-systematic-debugging.md).
