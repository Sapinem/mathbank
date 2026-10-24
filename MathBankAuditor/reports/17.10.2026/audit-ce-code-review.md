Berikut adalah laporan audit komprehensif basis kode **MathBank v2** menggunakan kerangka kerja spesialis **`ce-code-review`** (*Senior Code Reviewer Multi-Axis Evaluation*).

Hasil temuan audit ini telah dicatat ke dalam memori persisten Mnemosyne dan disajikan secara lengkap dalam format laporan Markdown di bawah ini agar dapat langsung disimpan ke dalam berkas [`MathBankAuditor/reports/17.10.2026/audit-ce-code-review.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-ce-code-review.md).

---

# Laporan Audit Kode MathBank v2.0 (`ce-code-review`)

## Review Summary

**Verdict:** **REQUEST CHANGES**

**Overview:**  
Meskipun arsitektur fondasi MathBank v2.0 memiliki desain modular yang sangat rapi (pembagian L1–L9, isolasi mesin murni, guard otorisasi seragam, dan *zero schema drift* PostgreSQL), audit mendalam menemukan **3 cacat Kritis (Critical)** dan **6 cacat Wajib (Required)** yang berpotensi merusak integritas konten matematika saat *ingest*, memblokir akses peran pengajar pada manajemen taksonomi akibat *permission gate trap*, serta meninggalkan celah SSRF berbasis *Time-of-Check to Time-of-Use* (DNS Rebinding).

---

### Critical Issues

- **[`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400) & [`src/lib/ingest/parsers/clean.ts:409`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L409) — Cacat Regex `stripTags` Memutilasi Rumus Matematika Berkurung & Typo Pembersihan Link**
  - **Dimensi:** *Correctness & Data Integrity*
  - **Uraian:**
    1. Pada baris 400:
       ```typescript
       s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
       ```
       Karakter kelas `[^)]*?` pada cabang kedua segera berhenti begitu menemukan tanda kurung tutup pertama `)`. Jika naskah memuat rumus inline dengan fungsi matematika bertanda kurung seperti `\(f(x) < 3\)`, `\(\sin(2x)\)`, atau `\(\binom{n}{k}\)`, rumus tersebut **gagal disembunyikan ke placeholder `store`**. Akibatnya, pada baris 418 (`s = s.replace(/<[^>]+>/g, " ")`), ekspresi `< 3\)` dianggap tag HTML dan **dihapus**, merusak soal matematika secara permanen saat ingest.
    2. Pada baris 409:
       ```typescript
       s = s.replace(/< [\s>][^>]*>([\s\S]*?)<\/a>/gi, "$1");
       ```
       Terdapat spasi typo antara `<` dan `[` (`< [\s>]`). Tag tautan pembuka HTML selalu berawalan `<a` (bukan `< `). Akibatnya, pembersihan tautan `<a ...>...</a>` tidak pernah cocok pada pola ini.
  - **Rekomendasi Perbaikan:**
    Gunakan lazy match dengan *negative lookahead* hingga delimiter penutup `\\\)`, serta perbaiki typo baris 409:
    ```typescript
    // Baris 400:
    s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])*?)\\\)/g, hide);

    // Baris 409:
    s = s.replace(/<a[\s>][^>]*>([\s\S]*?)<\/a>/gi, "$1");
    ```

- **[`src/app/api/topics/route.ts:22`](file:///home/hari/projects/mathbank/src/app/api/topics/route.ts#L22), [`src/app/api/topics/[id]/route.ts:31,39`](file:///home/hari/projects/mathbank/src/app/api/topics/%5Bid%5D/route.ts#L31), [`src/app/api/events/route.ts:24`](file:///home/hari/projects/mathbank/src/app/api/events/route.ts#L24), [`src/app/api/sources/route.ts:30`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L30), [`src/app/api/tags/route.ts:18`](file:///home/hari/projects/mathbank/src/app/api/tags/route.ts#L18) — Pelanggaran CONSTRAINT #35: Izin Ber-`own` Terpasang di Route Gate Tanpa `ownerId` Memblokir 100% Pengajar/Penelaah/Agen (HTTP 403)**
  - **Dimensi:** *Architecture, Security & Access Control*
  - **Uraian:**
    Pada [`src/lib/auth/permissions.ts:111-124`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L111), izin `taxonomy:manage` dan `reference:manage` bernilai `"own"` untuk peran `teacher`, `reviewer`, dan `agent` (dengan catatan: *"taksonomi: bukan admin-only (teacher/reviewer/agent boleh kelola miliknya)"*).
    Namun:
    1. Tabel `topics`, `tags`, `events`, dan `sources` adalah tabel referensi global yang **sama sekali tidak memiliki kolom `author_id` atau `created_by_id`**.
    2. Route handler di atas memasang `permission: "taxonomy:manage"` dan `permission: "reference:manage"` langsung pada gerbang `wrapRoute`.
    3. `wrapRoute` memanggil `assertCan(actor, opts.permission)` tanpa `ownerId`. Karena izin ber-`own` mengharuskan `opts.ownerId === actor.id`, pemanggilan tanpa `ownerId` **selalu menolak** akses (CONSTRAINT #35).
    4. Setiap guru, penelaah, dan agen yang mengirim mutasi POST/PATCH/DELETE pada topik, tag, event, atau sumber akan terblokir 403 Forbidden secara prematur di gerbang rute.
  - **Rekomendasi Perbaikan:**
    - Jika taksonomi dan referensi adalah data master kurikulum terpusat (sesuai mandat dewan direksi ADR-0010 & ADR-0020), ubah matriks di [`src/lib/auth/permissions.ts`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L111) menjadi:
      ```typescript
      "taxonomy:manage": { admin: "yes", teacher: "no", reviewer: "no", agent: "no", machine: "yes" },
      "reference:manage": { admin: "yes", teacher: "no", reviewer: "no", agent: "no", machine: "no" },
      ```
    - Jika guru diperbolehkan mengusulkan/membuat tag pribadi, buat kolom kepemilikan di skema DB dan pindahkan penegakan otorisasi dari gerbang `wrapRoute` ke dalam domain service yang memiliki `ownerId`.

- **[`src/lib/ingest/media/fetch.ts:172-180, 227-238, 252-258`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L172) — Celah SSRF TOCTOU (DNS Rebinding) & Bypass Redirect pada Media Fetcher**
  - **Dimensi:** *Security (OWASP Top 10 - SSRF)*
  - **Uraian:**
    1. Fungsi `assertPublicTarget` melakukan resolusi DNS pra-koneksi dan memvalidasi alamat IP. Namun ketika `fetch(url)` atau `httpRequest({ hostname: u.hostname, ... })` dieksekusi sesudahnya, socket runtime Node.js menjalankan kueri DNS kedua. Penyerang dengan nameserver dinamis dapat merespons kueri DNS pertama dengan IP publik (lolos guard) dan kueri kedua dengan `127.0.0.1` atau `169.254.169.254` (Time-of-Check to Time-of-Use / DNS Rebinding).
    2. Pada fungsi `downloadRelaxed`, saat menerima redirect HTTP 30x (baris 253):
       ```typescript
       if (isPrivateOrBlockedHost(new URL(next).hostname) && !isTlsRelaxed(next, relaxedHosts))
       ```
       Fungsi hanya menguji teks literal hostname tanpa menjalankan resolusi DNS `assertPublicTarget`. Redirect ke domain publik yang mengarah ke intranet (`*.nip.io`) akan lolos.
    3. Terdapat hardcoded path absolut ke repositori eksternal pada baris 36:
       `const CORPORA_BASE = "/home/hari/projects/qbank/data/corpora";`
       Melanggar aturan isolasi repositori AGENTS.md ("MathBank ≠ QBank").
  - **Rekomendasi Perbaikan:**
    1. Pasang custom HTTP agent dengan pinning IP address langsung ke level socket koneksi (`lookup` handler kustom), sehingga IP yang divalidasi adalah IP yang benar-benar dihubungi.
    2. Wajibkan validasi `assertPublicTarget(next, ...)` pada setiap hop redirect.
    3. Pindahkan `CORPORA_BASE` ke `process.env.CORPORA_IMAGE_BASE` dengan fallback terisolasi di dalam direktori proyek MathBank.

---

### Required Changes

- **[`eslint.config.mjs:77-90`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77) — Daftarkan `scripts/dev/**` ke `globalIgnores` (CONSTRAINT #2 & #4)**
  - **Uraian:** Skrip investigasi sementara di `scripts/dev/` (seperti [`sync-done-list.ts:18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L18) dan [`verify-saved.ts:22`](file:///home/hari/projects/mathbank/scripts/dev/verify-saved.ts#L22)) menggunakan `require("node:fs")` dan variabel yang tidak digunakan, menyebabkan exit gate `pnpm check` gagal (exit code 1).
  - **Rekomendasi:** Tambahkan `"scripts/dev/**"` ke dalam array `globalIgnores` di `eslint.config.mjs`.

- **[`scripts/seed-events.ts:67-72, 81-86`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67) — Hapus `PAS-SAS` dan `Try Out` dari Seeder Event (ADR-0010 & ADR-0020)**
  - **Uraian:** Berdasarkan kontrak domain di [`src/lib/db/schema/event.ts:15`](file:///home/hari/projects/mathbank/src/lib/db/schema/event.ts#L15), *"UTS/PAS BUKAN event → itu Bundle"*. Memasukkan penilaian lokal sekolah ke tabel `events` mencemari taksonomi ujian seleksi makro nasional.
  - **Rekomendasi:** Hapus entri `"PAS-SAS"` dan `"Try Out"` dari `scripts/seed-events.ts`. Naskah tersebut cukup dikelola sebagai `bundles` bertipe `bundle_type: "exam"`.

- **[`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86) — Hapus Properti `noScroll` pada Tampilan Pernyataan Soal (CONSTRAINT #12)**
  - **Uraian:** Penggunaan `<MathContent content={r.text} noScroll />` memicu `overflow-hidden`. Persamaan matematika panjang atau matriks pada soal benar-salah terpotong di layar ponsel/tablet.
  - **Rekomendasi:** Hapus atribut `noScroll` menjadi `<MathContent content={r.text} />`.

- **[`vitest.config.mts:66`](file:///home/hari/projects/mathbank/vitest.config.mts#L66) — Sinkronisasi Nama File Usang `bank-soal-view.tsx` ke `question-bank-view.tsx` (CONSTRAINT #3 & #28b)**
  - **Uraian:** File komponen telah berganti nama menjadi `question-bank-view.tsx`, namun konfigurasi coverage Vitest masih mencatat nama file lama `bank-soal-view.tsx`. Akibatnya, komponen utama peramban bank soal tidak terhitung dalam metrik coverage.
  - **Rekomendasi:** Ubah path baris 66 pada `vitest.config.mts` menjadi `"src/components/questions/question-bank-view.tsx"`.

- **[`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50) — Pisahkan Metrik `failedQuestions` dan `failedArticles`**
  - **Uraian:** Ekspresi `failed: results.reduce((a, r) => a + r.failed, 0) + results.filter((r) => r.status === "failed").length` mencampur butir soal gagal dan kegagalan total naskah artikel ke dalam satu angka, membingungkan dasbor telemetri.
  - **Rekomendasi:** Pisahkan menjadi:
    ```typescript
    failedQuestions: results.reduce((a, r) => a + r.failed, 0),
    failedArticles: results.filter((r) => r.status === "failed").length,
    ```

- **[`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) — Selaraskan Gutter Nomor Soal A4 menjadi 24px (ADR-0021)**
  - **Uraian:** Pada JSX `bundle-print-view.tsx:256` penomoran menggunakan lebar `w-6` (24px), tetapi pada selector `.item` di `src/styles/print.css` padding masih tertinggal pada `padding-left: 17px;`. Nomor dua digit (`10.` s.d. `99.`) berisiko menabrak teks soal saat dicetak.
  - **Rekomendasi:** Ubah `padding-left: 17px;` menjadi `padding-left: 24px;` pada selector `.item` di `src/styles/print.css`.

---

### Optional

- **[`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82) & [`drizzle/manual/db_safety.sql:177`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L177) — Isolasi Buffer Pool Vektor 1:1 & Partial Index HNSW**
  - **Deskripsi:** Kolom `embedding vector(1024)` yang tersimpan inline pada tabel `questions` membengkakkan ukuran rata-rata baris hingga $\sim 4.5\text{ KB}$, membebani alokasi RAM buffer pool PostgreSQL saat kueri non-vektor.
  - **Rekomendasi:** Pindahkan vektor ke tabel terpisah `question_embeddings` (1:1) dan ubah indeks HNSW menjadi *partial index* (`WHERE status = 'ready' AND deleted_at IS NULL`) sesuai Cetak Biru Strategis v2.0 Fase 1.

- **[`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187) — Hubungkan Kop Cetak dengan Konfigurasi Dinamis `bundle.printConfig`**
  - **Deskripsi:** Kop lembar kerja cetak masih di-hardcode literal `"MATH MY ID"`, belum memanfaatkan usulan konfigurasi personalisasi guru (`institutionName`, `tagline`) pada ADR-0021.
  - **Rekomendasi:** Sambungkan elemen kop dengan data dinamis `bundle.printConfig`, dengan fallback ke identitas default platform jika kosong.

---

### Nits

- **[`src/lib/services/taxonomy/event.ts:72-82`](file:///home/hari/projects/mathbank/src/lib/services/taxonomy/event.ts#L72) — Sinkronisasi `fullname` dan `code` saat `updateEvent`**
  - **Deskripsi:** Pembaruan nama atau kategori event pada fungsi `updateEvent` tidak memperbarui kolom turunan `fullname` dan `code`. Sebaiknya sinkronisasi dilakukan otomatis atau kolom `code` dinyatakan *immutable*.

---

### What's Done Well

1. **Integritas FSM & Perlindungan Balapan Bersamaan (Race Condition Guard):** Implementasi CAS (*Compare-And-Swap*) optimistik pada [`src/lib/services/question-status.ts:59`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L59) (`WHERE id = ? AND status = from`) mematuhi CONSTRAINT #36 dengan sangat baik dan mencegah konflik konkurensi pada alur telaah.
2. **Propagasi Pohon Taksonomi Atomik:** Fungsi `updateTopic` pada [`src/lib/services/topic-service.ts:165-174`](file:///home/hari/projects/mathbank/src/lib/services/topic-service.ts#L165) secara disiplin memperbarui seluruh `level` subtree keturunan dalam satu transaksi atomik (mematuhi CONSTRAINT #38 & #39).
3. **Penyaji Media Aman & Anti Path-Traversal:** Rute [`src/app/img/[shortId]/route.ts`](file:///home/hari/projects/mathbank/src/app/img/%5BshortId%5D/route.ts) menerapkan validasi regex short ID sebelum kueri DB, verifikasi batas root direktori (`abs.startsWith(root + sep)`), rate limit berbasis IP (`IMAGE_POLICY`), dan Content Security Policy ketat (`default-src 'none'`) untuk berkas SVG.
4. **Pencegahan Kebocoran Kunci Jawaban:** Pipa data membaca secara konsisten menggunakan proyeksi eksplisit `questionColumns({ withAnswerKey })` (CONSTRAINT #34), memastikan kunci jawaban tidak bocor ke peran yang tidak berhak.
5. **Kinerja Render UI:** Komponen [`QuestionCard`](file:///home/hari/projects/mathbank/src/components/questions/question-card.tsx#L522) dan [`MathContent`](file:///home/hari/projects/mathbank/src/components/math/math-content.tsx#L50) mengadopsi LRU cache in-memory modul untuk KaTeX string dan custom `areCardPropsEqual`, menghasilkan navigasi seleksi berkecepatan tinggi tanpa melanggar larangan `useMemo`/`useCallback` (CONSTRAINT #6).

---

### Verification Story

- **Tests reviewed:** Ya. 837 pengujian unit Vitest dan 248 tes integrasi database telah dianalisis. Skema pengujian mencakup FSM soal, proyeksi kolom, kontrak otorisasi, dan linter KaTeX. Teridentifikasi adanya selisih pendaftaran file pada `vitest.config.mts:66`.
- **Build & Schema verified:** Ya. Skema PostgreSQL terpadu 26 tabel, 24 triggers, dan indeks HNSW diverifikasi bebas drift (`pnpm db:verify`).
- **Security checked:** Ya. Analisis menyeluruh mencakup otorisasi multi-peran (L1), sanitasi input KaTeX, pencegahan injeksi SQL via Drizzle parameterized queries, rate limiting per-aktor/IP, dan mitigasi SSRF pada modul ingestion media.

---

### Matriks Kepatuhan 46 Batasan Mutu (CONSTRAINTS.md)

| No | Batasan Mutu | Status | Catatan Audit |
|:---:|---|:---:|---|
| #1 | Zero type errors (`tsc --noEmit`) | ✅ Lulus | Tidak ditemukan galat pengetikan TypeScript. |
| #2 | Zero lint errors (`pnpm lint`) | ⚠️ Remediasi | Membutuhkan penambahan `"scripts/dev/**"` pada `globalIgnores`. |
| #3 | Coverage $\ge 85\%$ statements | ⚠️ Remediasi | Perlu pembaruan target file `question-bank-view.tsx` di `vitest.config.mts`. |
| #6 | Dilarang `useMemo` / `useCallback` | ✅ Lulus | Dipatuhi penuh pada seluruh kode kustom (hanya vendor `ui/**` yang dikecualikan). |
| #7 | Dilarang `space-y-*` | ✅ Lulus | Seluruh layout memakai `flex flex-col gap-*`. |
| #12 | `MathContent` wajib `overflow-x-auto` | ⚠️ Remediasi | `MatrixGridView` masih menyuntikkan `noScroll` pada baris pernyataan. |
| #20 | LaTeX mitigasi LFI (`openin_any='p'`) | ✅ Lulus | Tidak ada pemanggilan engine LaTeX eksternal tanpa isolasi. |
| #22 | Validasi Zod di semua boundary | ✅ Lulus | API routes, MCP tools, dan kontrak input terikat Zod schema. |
| #23 | `AUTH_DEV_BYPASS` non-produksi | ✅ Lulus | Terpasang *triple-guard* di `resolve.ts` (`NODE_ENV`, `APP_ENV`, flag string). |
| #28b | Nama file/folder/route INGGRIS | ✅ Lulus | 100% path kode dan route handler berbahasa Inggris. |
| #33 | Rate limit pada mutasi & daftar | ✅ Lulus | Terpasang `wrapRoute({ rateLimit: ... })` dan `IMAGE_POLICY`. |
| #34 | Proyeksi eksplisit tanpa `.select()` telanjang | ✅ Lulus | Dijaga oleh ESLint rule AST `noBareSelectInApi`. |
| #35 | Larangan izin `own` di gerbang route tanpa `ownerId` | 🔴 Pelanggaran | Route taksonomi, event, source, dan tag memasang izin ber-`own` di `wrapRoute`. |
| #36 | Transisi status berpelindung balapan CAS | ✅ Lulus | Ditegakkan dengan klausa `WHERE status = from` + `.returning()`. |
| #38 | Propagasi level hierarki ke seluruh subtree | ✅ Lulus | Diterapkan secara atomik di `topic-service.ts`. |
| #39 | Audit log update berlabel `action: "update"` | ✅ Lulus | Label audit akurat dan tidak copy-paste dari create. |
| #40 | `slugify` menyertakan batas kolom DB | ✅ Lulus | Pemotongan karakter dilakukan sebelum sanitasi tanda hubung akhir. |
| #42 | Ambang dedup dua tingkat benar logis | ✅ Lulus | Kondisi `exact` dan `near` di `fusion.ts` independen dan tidak saling meniadakan. |
| #45 | `reorderItems` tolak subset/duplikat | ✅ Lulus | Memeriksa kelengkapan array dan menggunakan batch SQL `CASE`. |
| #46 | RESTRICT hapus hanya hitung paket aktif | ✅ Lulus | Menggunakan `innerJoin bundles + isNull(deletedAt)`. |

---

> [!NOTE]
> Seluruh rekomendasi teknis di atas telah disusun dengan tingkat presisi tinggi (lokasi baris berkas dan contoh kode koreksi) untuk memudahkan eksekusi remediasi oleh tim pengembang menuju rilis **MathBank v2.0**.
