# Audit Komprehensif MathBank v2.0

**Lokasi Laporan:** `MathBankAuditor/reports/17.10.2026/audit-ce-noslop.md`  
**Waktu Audit:** 17 Oktober 2026  
**Auditor:** Senior Code Reviewer / Principal Systems Architect  
**Metode:** Static code analysis, validasi 46 invarian mekanis ([`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md)), penelusuran kontrol akses L1–L9, audit integritas database PostgreSQL, dan analisis jalur input ingest.  
**Kaidah Penulisan:** `ce-noslop` (tanpa kata hiasan/AI tells, fokus mekanisme, keputusan di awal, rujukan file dan simbol eksak).

---

## Ringkasan Eksekutif

**Verdict:** **REQUEST CHANGES**

Basis kode MathBank memiliki pemisahan arsitektur L1–L9 yang tertata rapi, invarian database teruji via `pnpm db:verify` (26 tabel, 24 triggers, zero-drift), dan engine matematika murni yang deterministik. Namun, audit menemukan **4 isu Critical** yang memblokir produksi:
1. **Kerentanan Path Traversal** pada pengambil media korpus ([`src/lib/ingest/media/fetch.ts:358`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L358)).
2. **Kegagalan Otorisasi Sistemik (CONSTRAINT #35)** yang memblokir guru dan penelaah pada 9 endpoint API karena penempatan izin ber-`own` di gerbang route tanpa `ownerId`.
3. **Foreign Key Violation Crash (HTTP 500)** pada [`hardDeleteQuestion`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L318) akibat dependensi `bundle_items` berstatus `RESTRICT` pada paket terarsip.
4. **Bypass `wrapRoute` dan Ketiadaan Rate Limiting** pada endpoint ekspor GitSync/Moodle ([`src/app/api/bundles/[id]/export/moodle/route.ts:28`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/export/moodle/route.ts#L28)).

---

## 1. Masalah Kritis (Critical Issues — Blokir Rilis)

### 🔴 [CRIT-01] Path Traversal pada `fetchCorpusImage` Membuka Pembacaan File Arbitrer di Luar Direktori Korpus
- **File & Baris:** [`src/lib/ingest/media/fetch.ts:358-367`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L358-L367)
- **Mekanisme Kegagalan:**  
  Fungsi [`fetchCorpusImage`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L349) memvalidasi segmen path menggunakan regex:
  ```typescript
  const safe = /^[A-Za-z0-9._\-]+$/;
  if (!parts.every((p) => safe.test(p))) { ... }
  const absPath = join(CORPORA_BASE, sumber!, "images", ...sisa);
  ```
  Karakter `.` termasuk dalam kelas karakter yang diizinkan. Nilai segmen `".."` lolos uji validasi `safe.test("..") === true`. Pemanggilan `join(CORPORA_BASE, ..., ...sisa)` menormalkan path relatif ke atas, meloloskan URL seperti `corpus://defantri/../../../../etc/passwd` atau file konfigurasi XML/SVG keluar dari `CORPORA_BASE`. Bila file ditemukan atau gagal dibuka, blok `catch` pada baris 374 mengembalikan pesan galat yang membocorkan path absolut sistem berkas host.
- **Rekomendasi Perbaikan:**  
  1. Tolak eksplisit segmen yang bernilai `.` atau `..`:
     ```typescript
     if (parts.some((p) => p === "." || p === "..")) {
       return { ok: false, error: "Path traversal ditolak" };
     }
     ```
  2. Tambahkan pengecekan batas kanonikal setelah resolusi path:
     ```typescript
     const rootDir = resolve(CORPORA_BASE);
     const resolvedPath = resolve(absPath);
     if (resolvedPath !== rootDir && !resolvedPath.startsWith(rootDir + sep)) {
       return { ok: false, error: "Akses di luar direktori korpus diblokir" };
     }
     ```

---

### 🔴 [CRIT-02] Pelanggaran Sistemik CONSTRAINT #35: Izin Ber-`own` pada Gerbang Route Menolak Guru dan Penelaah (HTTP 403)
- **File & Baris:**
  - [`src/app/api/questions/[id]/flag/route.ts:13`](file:///home/hari/projects/mathbank/src/app/api/questions/%5Bid%5D/flag/route.ts#L13) (`permission: "question:flag"`)
  - [`src/app/api/topics/route.ts:22`](file:///home/hari/projects/mathbank/src/app/api/topics/route.ts#L22) (`permission: "taxonomy:manage"`)
  - [`src/app/api/topics/[id]/route.ts:31, 39`](file:///home/hari/projects/mathbank/src/app/api/topics/%5Bid%5D/route.ts#L31) (`permission: "taxonomy:manage"`)
  - [`src/app/api/tags/route.ts:18`](file:///home/hari/projects/mathbank/src/app/api/tags/route.ts#L18) (`permission: "taxonomy:manage"`)
  - [`src/app/api/tags/[id]/route.ts:10, 18`](file:///home/hari/projects/mathbank/src/app/api/tags/%5Bid%5D/route.ts#L10) (`permission: "taxonomy:manage"`)
  - [`src/app/api/sources/route.ts:30`](file:///home/hari/projects/mathbank/src/app/api/sources/route.ts#L30) (`permission: "reference:manage"`)
  - [`src/app/api/sources/[id]/route.ts:20, 28`](file:///home/hari/projects/mathbank/src/app/api/sources/%5Bid%5D/route.ts#L20) (`permission: "reference:manage"`)
  - [`src/app/api/events/route.ts:24`](file:///home/hari/projects/mathbank/src/app/api/events/route.ts#L24) (`permission: "reference:manage"`)
  - [`src/app/api/events/[id]/route.ts:16, 24`](file:///home/hari/projects/mathbank/src/app/api/events/%5Bid%5D/route.ts#L16) (`permission: "reference:manage"`)
  - [`src/lib/services/question-write.ts:236`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L236) (panggilan `assertCan` tanpa `ownerId`)
- **Mekanisme Kegagalan:**  
  Matriks izin ([`src/lib/auth/permissions.ts:104-124`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L104)) menetapkan izin `question:flag`, `taxonomy:manage`, dan `reference:manage` bernilai `"own"` untuk peran `teacher` dan `reviewer`.  
  Sesuai kontrak [`CONSTRAINTS.md` #35](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L65) dan [`src/lib/auth/guards.ts:41-43`](file:///home/hari/projects/mathbank/src/lib/auth/guards.ts#L41), fungsi `assertCan(actor, permission)` tanpa parameter `ownerId` **selalu menolak** peran yang memiliki akses `"own"`.  
  Karena [`wrapRoute`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L310) memanggil `assertCan(actor, opts.permission)` tanpa `ownerId`, seluruh pemanggilan mutasi pada 9 rute di atas oleh guru/penelaah langsung melempar `ForbiddenError` 403.  
  Selain itu, tabel `topics`, `tags`, `sources`, dan `events` **tidak memiliki kolom pemilik** (`author_id`), sehingga status izin `"own"` pada taksonomi/referensi adalah anomali konseptual.
- **Rekomendasi Perbaikan:**  
  1. Hapus opsi `permission:` dari gerbang route mutasi tersebut, serahkan ke level service sebagaimana yang telah diterapkan pada `questions/[id]/route.ts`.
  2. Pada [`src/lib/services/question-write.ts:236`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L236), sertakan `ownerId`:
     ```typescript
     assertCan(actor, "question:flag", { ownerId: existing.authorId });
     ```
  3. Perjelas domain izin `taxonomy:manage` dan `reference:manage` pada [`src/lib/auth/permissions.ts`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts#L111): ubah menjadi `"yes"` bila guru/penelaah diizinkan mengelola referensi bersama, atau ubah menjadi `"no"` bila pengelolaan taksonomi dibatasi untuk `admin`.

---

### 🔴 [CRIT-03] Foreign Key Violation `RESTRICT` pada `hardDeleteQuestion` Memutus Integritas Penghapusan (HTTP 500)
- **File & Baris:** [`src/lib/services/question-write.ts:310-318`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L310-L318)
- **Mekanisme Kegagalan:**  
  Constraint database pada [`bundle_items.question_id`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L65) dan [`questions.parent_id`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L47) menggunakan aturan `onDelete: "restrict"`.  
  Fungsi [`hardDeleteQuestion`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L297) memeriksa dependensi via [`isQuestionUsedInBundles(id)`](file:///home/hari/projects/mathbank/src/lib/services/bundle-query.ts#L229). Namun fungsi tersebut hanya memeriksa paket aktif (`isNull(bundles.deletedAt)`).  
  Ketika sebuah paket soal diarsipkan secara soft-delete via [`archiveBundle`](file:///home/hari/projects/mathbank/src/lib/services/bundle-write.ts#L127), baris relasi di tabel `bundle_items` **tidak dihapus**.  
  Ketika `hardDeleteQuestion` dijalankan pada soal yang pernah masuk paket terarsip, `isQuestionUsedInBundles` menghasilkan `false`. Selanjutnya baris 318 mengeksekusi `DELETE FROM questions WHERE id = ?`. Database PostgreSQL menolak eksekusi dan memicu error `23503 foreign_key_violation` (HTTP 500 internal server error). Kasus serupa terjadi jika soal stimulus memiliki anak soal (walaupun anak soal berstatus soft-delete).
- **Rekomendasi Perbaikan:**  
  Jalankan penghapusan relasi yatim dalam satu transaksi database di [`hardDeleteQuestion`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L297):
  ```typescript
  await db.transaction(async (tx) => {
    // 1. Bersihkan referensi dari bundle yang sudah diarsipkan
    await tx.execute(sql`
      DELETE FROM bundle_items bi
      USING bundles b
      WHERE bi.bundle_id = b.id
        AND bi.question_id = ${id}::uuid
        AND b.deleted_at IS NOT NULL
    `);
    // 2. Tolak bila masih ada anak stimulus yang belum dihapus permanen
    const [hasChildren] = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.parentId, id))
      .limit(1);
    if (hasChildren) {
      throw new ConflictError("Hapus permanen seluruh anak soal stimulus terlebih dahulu.");
    }
    // 3. Eksekusi hapus baris soal
    await tx.delete(questions).where(eq(questions.id, id));
  });
  ```

---

### 🔴 [CRIT-04] Bypass `wrapRoute` dan Ketiadaan Rate Limiting pada Ekspor GitSync/Moodle
- **File & Baris:** [`src/app/api/bundles/[id]/export/moodle/route.ts:28-40`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/export/moodle/route.ts#L28-L40)
- **Mekanisme Kegagalan:**  
  Endpoint `POST /api/bundles/[id]/export/moodle` ditulis sebagai handler Next.js mentah tanpa membungkusnya dengan [`wrapRoute`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts). Hal ini melanggar dua batasan mekanis:
  1. [`CONSTRAINTS.md` #17](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L37): Seluruh API wajib menggunakan wrapper dengan amplop seragam.
  2. [`CONSTRAINTS.md` #33](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L63): Seluruh endpoint mutasi wajib memiliki rate limiting.  
  Endpoint ini menjalankan proses I/O berat di sistem operasi ([`writeGitsyncFolder`](file:///home/hari/projects/mathbank/src/lib/export/gitsync-writer.ts#L66)) yang memanggil `git init`, `git add`, dan `git commit` melalui `child_process.execFile`. Ketiadaan rate limit memungkinkan pengguna terautentikasi membanjiri proses worker dengan eksekusi git berulang kali (*resource exhaustion*).
- **Rekomendasi Perbaikan:**  
  Refaktor handler menggunakan `wrapRoute`:
  ```typescript
  export const POST = wrapRoute({
    permission: "bundle:manage",
    rateLimit: { capacity: 5, refillPerSec: 0.1 }, // Maks 5 burst, 6/menit
    handler: async ({ params, actor }) => {
      const { summary, result, write } = await exportBundleToGitsync(params.id, actor);
      if (!result.ok) {
        throw new BadRequestError("Ekspor dibatalkan: ada soal tanpa kunci jawaban.");
      }
      return { summary, result, write };
    },
  });
  ```

---

## 2. Perubahan Wajib (Required Changes — Sebelum Merge)

### 🟠 [REQ-01] Kerentanan DNS Rebinding dan Bypass Host Privat pada Unduh Gambar Korpus
- **File & Baris:** [`src/lib/ingest/media/fetch.ts:166, 252-258`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L166)
- **Mekanisme Kegagalan:**  
  1. Pada baris 166: `if (isTlsRelaxed(rawUrl, relaxedHosts)) return;` keluar sebelum validasi IP publik dijalankan. Jika domain yang di-pin mengarah ke IP privat (`127.0.0.1` atau `169.254.169.254`), permintaan tetap dikirim.
  2. Pada baris 252–258 ([`downloadRelaxed`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L212)), saat menerima HTTP redirect 30x, target baru hanya divalidasi dengan `isPrivateOrBlockedHost(new URL(next).hostname)`. Validasi ini hanya mencocokkan string literal hostname dan **tidak menyelesaikan DNS**. Domain publik milik penyerang yang me-resolve ke IP privat akan lolos.
  3. Pada [`fetchHop`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L281), resolusi DNS dilakukan pada waktu $t_0$ via `assertPublicTarget`, lalu `fetch(url)` menyelesaikan DNS secara independen pada waktu $t_1$. Pola Time-of-Check to Time-of-Use (TOCTOU) ini rentan terhadap DNS Rebinding (TTL 0).
- **Rekomendasi Perbaikan:**  
  Hapus bypass relaksasi TLS dari gerbang IP privat. Validasi resolusi DNS pada setiap hop redirect sebelum soket dibuka. Pin alamat IP hasil resolusi ke koneksi HTTP client agent.

---

### 🟠 [REQ-02] Anomali Input Kredensial `mustChangePassword` pada Konfigurasi Better-Auth
- **File & Baris:** [`src/lib/auth/server.ts:51-56`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L51-L56)
- **Mekanisme Kegagalan:**  
  Properti `mustChangePassword` pada `user.additionalFields` dideklarasikan dengan `input: true`:
  ```typescript
  mustChangePassword: {
    type: "boolean",
    required: false,
    defaultValue: false,
    input: true,
  }
  ```
  Opsi `input: true` memberi izin bagi klien untuk mengirim nilai field ini pada payload registrasi atau pembaruan profil pengguna. Akun yang diwajibkan mengganti kata sandi sementara dapat memanipulasi payload HTTP untuk menyetel `mustChangePassword: false` secara mandiri.
- **Rekomendasi Perbaikan:**  
  Ubah menjadi `input: false`. Kolom kontrol keamanan administratif hanya boleh dimutasi dari backend melalui kueri database atau prosedur admin.

---

### 🟠 [REQ-03] Potensi String Overflow Kolom `bundles.slug` (HTTP 500) pada `uniqueSlug`
- **File & Baris:** [`src/lib/services/bundle-shared.ts:157-175`](file:///home/hari/projects/mathbank/src/lib/services/bundle-shared.ts#L157-L175)
- **Mekanisme Kegagalan:**  
  Fungsi `uniqueSlug(base)` menghasilkan slug dasar dengan `slugify(base)` (panjang default 255 karakter). Bila terjadi bentrokan slug di database, loop baris 175 menambahkan akhiran:
  ```typescript
  candidate = `${root}-${n}`;
  ```
  Panjang string `candidate` membengkak menjadi 257+ karakter. Kolom [`bundles.slug`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L25) didefinisikan sebagai `varchar(255)`. Ketika string hasil bentrokan di-insert, PostgreSQL melempar galat `value too long for type character varying(255)` dan menghasilkan HTTP 500.
- **Rekomendasi Perbaikan:**  
  Potong panjang dasar slug sebelum menambahkan sufiks numerik:
  ```typescript
  const root = slugify(base, 240) || "paket";
  ```

---

### 🟠 [REQ-04] Cacat Regex `stripTags` Memotong Rumus Matematika Berkurung `\(f(x)\)`
- **File & Baris:** [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400)
- **Mekanisme Kegagalan:**  
  Pola regex:
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
  ```
  Karakter kelas `[^)]` berhenti pada tanda kurung tutup pertama. Rumus matematika inline berpasangan seperti `\(f(x) < 3\)`, `\(\sin(2x)\)`, atau `\(\binom{n}{k}\)` gagal disembunyikan ke placeholder. Karakter `<` di dalam rumus kemudian dihapus oleh pembersih tag HTML pada baris 418 (`s.replace(/<[^>]+>/g, " ")`), merusak struktur rumus matematika hasil ingest.
- **Rekomendasi Perbaikan:**  
  Ubah pola pencocokan kurung LaTeX menjadi lazy match yang berhenti pada delimiter `\\\)`:
  ```typescript
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)[\s\S])+?))\\\)/g, hide);
  ```

---

### 🟠 [REQ-05] Pelanggaran CONSTRAINT #12 pada `MatrixGridView`
- **File & Baris:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)
- **Mekanisme Kegagalan:**  
  Komponen merender:
  ```tsx
  <MathContent content={r.text} noScroll />
  ```
  Properti `noScroll` menerapkan utility class `overflow-hidden` pada kontainer ([`src/components/math/math-content.tsx:319`](file:///home/hari/projects/mathbank/src/components/math/math-content.tsx#L319)). Rumus matematika panjang pada pernyataan benar-salah terpotong pada layar ponsel tanpa kemampuan scroll horizontal, melanggar [CONSTRAINT #12](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29).
- **Rekomendasi Perbaikan:**  
  Hapus properti `noScroll`:
  ```tsx
  <MathContent content={r.text} />
  ```

---

### 🟠 [REQ-06] Pelanggaran Batasan Domain Event: `PAS-SAS` & `Try Out` Masuk Seeder `events`
- **File & Baris:** [`scripts/seed-events.ts:67-86`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67-L86)
- **Mekanisme Kegagalan:**  
  Skrip men-seed entri `"PAS-SAS"` dan `"Try Out"` ke dalam tabel `events`. Hal ini bertentangan dengan arsitektur domain pada [`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md), [`ADR-0020`](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md), serta catatan skema pada [`src/lib/db/schema/event.ts:15`](file:///home/hari/projects/mathbank/src/lib/db/schema/event.ts#L15) yang menyatakan *"UTS/PAS BUKAN event → itu Bundle"*. Memasukkan ujian internal sekolah ke tabel `events` mencemari taksonomi ujian makro nasional.
- **Rekomendasi Perbaikan:**  
  Hapus entri `"PAS-SAS"` dan `"Try Out"` dari `scripts/seed-events.ts`. Naskah penilaian sekolah ditampung sebagai baris `bundles` dengan `bundle_type: 'exam'`.

---

### 🟠 [REQ-07] Script Terlarang `"db:push"` Didaftarkan pada `package.json`
- **File & Baris:** [`package.json:22`](file:///home/hari/projects/mathbank/package.json#L22)
- **Mekanisme Kegagalan:**  
  File `package.json` memuat baris:
  ```json
  "db:push": "drizzle-kit push",
  ```
  Menjalankan perintah ini melanggar secara eksplisit aturan wajib di [`AGENTS.md` §3](file:///home/hari/projects/mathbank/AGENTS.md#L52) dan [`CONSTRAINTS.md` #26](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L52) (*"Jangan memakai db:push"*). `db:push` mengeksekusi sinkronisasi skema langsung tanpa file migrasi dan tanpa menerapkan trigger manual dari `db_safety.sql`, merusak status zero-drift database.
- **Rekomendasi Perbaikan:**  
  Hapus baris `"db:push"` dari `package.json`.

---

### 🟠 [REQ-08] Variabel Mati dan Pelanggaran ESLint di Direktori `scripts/dev/`
- **File & Baris:**
  - [`scripts/dev/audit-event-source.ts:45`](file:///home/hari/projects/mathbank/scripts/dev/audit-event-source.ts#L45) (`yearMismatch` tidak terpakai)
  - [`scripts/dev/sync-done-list.ts:7, 18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L7) (`existsSync` unused, `require("node:fs")` di modul ES)
  - [`scripts/dev/verify-saved.ts:22`](file:///home/hari/projects/mathbank/scripts/dev/verify-saved.ts#L22) (`require("node:fs")`)
- **Mekanisme Kegagalan:**  
  Tiga skrip pembantu dev memicu kegagalan lint saat `pnpm lint` dijalankan, menggagalkan exit gate [`CONSTRAINTS.md` #2](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L8).
- **Rekomendasi Perbaikan:**  
  Perbaiki sintaks ESM pada file tersebut dan daftarkan pola `"scripts/dev/**"` ke dalam `globalIgnores` pada [`eslint.config.mjs:77`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77).

---

## 3. Catatan Opsional (Optional Improvements)

### 🟡 [OPT-01] Inkonsistensi Gutter Layout Cetak A4 dan Kop Naskah Hardcoded
- **File & Baris:** [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151) vs [`src/components/bundles/bundle-print-view.tsx:187-195, 256`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187)
- **Observasi:**  
  Selektor `.item` pada `print.css` menyetel `padding-left: 17px;`, sedangkan tampilan preview JSX di `bundle-print-view.tsx` menggunakan `w-6` (24px) sesuai spesifikasi [`ADR-0021`](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md). Selain itu teks nama institusi `"MATH MY ID"` masih berupa string literal hardcoded tanpa membaca konfigurasi dinamis.
- **Saran:**  
  Selaraskan padding `print.css` menjadi `24px` dan siapkan fallback dinamis untuk kop institusi.

---

### 🟡 [OPT-02] Pemisahan Metrik Gagal pada Respons API Ingest Commit
- **File & Baris:** [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50)
- **Observasi:**  
  Kalkulasi metrik `failed` menjumlahkan butir soal yang gagal divalidasi dengan antrean artikel yang gagal secara keseluruhan:
  ```typescript
  failed: results.reduce((a, r) => a + r.failed, 0) + results.filter((r) => r.status === "failed").length
  ```
- **Saran:**  
  Pisahkan menjadi dua kunci eksplisit `{ failedQuestions, failedArticles }` untuk mempermudah pemantauan telemetri ingest.

---

### 🟡 [OPT-03] Pustaka Pencarian Hibrida `fusion.ts` Belum Terintegrasi
- **File & Baris:** [`src/lib/search/fusion.ts`](file:///home/hari/projects/mathbank/src/lib/search/fusion.ts)
- **Observasi:**  
  Pustaka RRF dan dedup telah memiliki implementasi murni dan unit test, namun belum memiliki call-site produksi pada [`src/lib/services/question-read.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-read.ts).
- **Saran:**  
  Sesuai [CONSTRAINT #43](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L73), tandai status modul ini sebagai "Belum Terintegrasi" pada dokumentasi milestone.

---

## 4. Temuan Minor (Nits)

1. [`src/app/api/sources/[id]/route.ts:22, 30`](file:///home/hari/projects/mathbank/src/app/api/sources/%5Bid%5D/route.ts#L22) dan [`src/app/api/events/[id]/route.ts:18, 26`](file:///home/hari/projects/mathbank/src/app/api/events/%5Bid%5D/route.ts#L18):  
   Ekspresi `(await params).id` berlebihan karena `wrapRoute` telah meng-await `args.params` dan meneruskannya sebagai `Record<string, string>`. Gunakan langsung `params.id`.
2. [`src/lib/services/taxonomy/event.ts:78-83`](file:///home/hari/projects/mathbank/src/lib/services/taxonomy/event.ts#L78):  
   Fungsi `updateEvent` tidak memperbarui kolom turunan `code` saat `category` atau `shortname` berubah.
3. [`AGENTS.md:80, 83`](file:///home/hari/projects/mathbank/AGENTS.md#L80):  
   Catatan jumlah tabel tertulis 28 (skema aktual 26 setelah penghapusan `collections` di MAT-39) dan utang `curriculum.yaml` di luar repo masih tercatat padahal file telah disalin ke `config/curriculum.yaml`.

---

## 5. Yang Diterapkan dengan Baik

1. **Proteksi Bypass Produksi Berlapis (CONSTRAINT #23):**  
   Implementasi [`actorFromDevBypass`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts#L84-L100) mengunci bypass dev dengan tiga lapis (`NODE_ENV !== "production"`, `APP_ENV !== "production" && APP_ENV !== "staging"`, dan `AUTH_DEV_BYPASS === "true"`), mencegah eskalasi privilege di lingkungan live.
2. **Atomic CAS Guards pada Transisi Status (CONSTRAINT #36):**  
   Fungsi [`changeQuestionStatus`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L52-L65) menyertakan klausa `WHERE id = ? AND status = from` dengan verifikasi jumlah baris yang terpengaruh, mencegah race condition saat dua sesi menelaah soal secara simultan.
3. **Propagasi Subtree Hierarki Topik (CONSTRAINT #38 & #39):**  
   Fungsi [`updateTopic`](file:///home/hari/projects/mathbank/src/lib/services/topic-service.ts#L159-L188) memperbarui seluruh kedalaman subtree dalam satu transaksi database dan mencatat audit trail dengan `action: "update"`.
4. **Verifikasi Integritas Item Paket (CONSTRAINT #45):**  
   Fungsi [`reorderItems`](file:///home/hari/projects/mathbank/src/lib/services/bundle-items.ts#L117-L146) memvalidasi keutuhan array tanpa duplikasi atau subset, serta mengeksekusi pembaruan indeks urutan melalui batch `CASE` statement dalam transaksi tunggal.
5. **Isolasi Sanitasi Gambar (CONSTRAINT #15 & Anti-XSS):**  
   Penyaji media [`src/app/img/[shortId]/route.ts:79`](file:///home/hari/projects/mathbank/src/app/img/%5BshortId%5D/route.ts#L79) mengunci path traversal dengan `abs.startsWith(root + sep)` dan menyuntikkan header CSP `default-src 'none'` untuk berkas SVG.

---

## 6. Riwayat Verifikasi (Verification Story)

- **Pengujian Kode:** Diperiksa terhadap tes integrasi otorisasi ([`question-authz.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/api/question-authz.db.test.ts)), penjaga penamaan ([`check-names.test.ts`](file:///home/hari/projects/mathbank/src/lib/telemetry/check-names.test.ts)), dan parser pembersih HTML ([`clean.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts)).
- **Integritas Database:** Skema terverifikasi melalui `EXPECTED_INVARIANTS` di [`invariants.ts`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts) (26 tabel, 24 triggers, 2 check constraints, 1 index HNSW).
- **Audit Keamanan:** Ditemukan celah LFI/path traversal pada skema `corpus://` ([`fetch.ts:358`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L358)), SSRF DNS Rebinding ([`fetch.ts:166`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L166)), manipulasi profil auth ([`server.ts:55`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L55)), dan ketiadaan rate limit pada ekspor Moodle ([`export/moodle/route.ts:28`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/export/moodle/route.ts#L28)).

---

## 7. Catatan Verifikasi (CONSTRAINT #44)

- **Verifikator:** Staff Engineer & Senior Code Reviewer
- **Metode Verifikasi:** Static source code walkthrough, verifikasi batasan mekanis `CONSTRAINTS.md` (46 aturan), dan validasi silang rencana perbaikan v2.0.
- **Hasil:**
  - Status Lolos: Invarian DB (26 tabel, 24 triggers), isolasi L6 pure engines, proteksi `AUTH_DEV_BYPASS`, sanitasi SVG `/img/[shortId]`.
  - Status Koreksi (Wajib Perbaikan): 4 temuan Critical ([CRIT-01] s.d. [CRIT-04]) dan 8 temuan Required ([REQ-01] s.d. [REQ-08]).
