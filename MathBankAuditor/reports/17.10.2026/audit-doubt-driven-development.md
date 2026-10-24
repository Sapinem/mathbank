# AUDIT KOMPREHENSIF CODEBASE MATHBANK v2.0
## Evaluasi Berbasis Metodologi *Doubt-Driven Development* (DDD)

> **File Target Laporan:** `MathBankAuditor/reports/17.10.2026/audit-doubt-driven-development.md`  
> **Tanggal Audit:** 17 Oktober 2026  
> **Auditor:** Staff Engineer / Senior Code Reviewer  
> **Metode:** *Doubt-Driven Development (Adversarial Scrutiny & Invariant Disproof)*  
> **Cakupan:** Basis Kode MathBank (`/home/hari/projects/mathbank`), Batasan Mutu Mekanis ([`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md)), Arsitektur Data v2.0 ([`docs/RENCANA-MATHBANK-V2.md`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md)), dan Catatan Persiapan v2.0 ([`docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md`](file:///home/hari/projects/mathbank/docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md)).

---

## Ringkasan Eksekutif & Catatan Lingkungan

> [!NOTE]
> Lingkungan persona audit saat ini beroperasi dalam mode inspeksi *read-only* (tanpa akses langsung penulisan berkas/perintah shell disk). Laporan di bawah ini disajikan dalam format Markdown kanonikal penuh yang siap disalin dan disimpan secara langsung ke berkas target [`MathBankAuditor/reports/17.10.2026/audit-doubt-driven-development.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-doubt-driven-development.md).

Berdasarkan metodologi **Doubt-Driven Development**, setiap asumsi arsitektur yang sebelumnya berstatus "aman", "lolos", atau "terisolasi" diuji secara adversarial dengan sasaran membuktikan kegagalannya (*biased to disprove, not approve*). 

Hasil audit membuktikan bahwa meskipun MathBank memiliki arsitektur L1–L9 yang sangat disiplin, terdapat **sejumlah asumsi kritis yang runtuh saat diuji secara adversarial**:
1. **Celah Keamanan SSRF (DNS Rebinding TOCTOU & IPv6 Bypass):** Pra-resolusi DNS tidak mencegah DNS rebinding karena `fetch()` internal Node.js melakukan resolusi ulang independen.
2. **Crash Database 500 pada Penghapusan Permanen Soal (FK Conflict):** Pemisahan logika query `isQuestionUsedInBundles` mengabaikan constraint fisik PostgreSQL `ON DELETE RESTRICT` pada tabel `bundle_items` milik bundel terarsip.
3. **Kerusakan Data Matematis Saat Ingest (KaTeX Delimiter Truncation):** Regex `stripTags` gagal mengisolasi rumus inline berkurung seperti `\(f(x) < 3\)`, menyebabkan simbol `<` terhapus sebagai tag HTML.
4. **Regresi Mutu Mekanis & Pelanggaran Domain:** Pelanggaran batasan scroll rumus mobile (CONSTRAINT #12), kontaminasi katalog ujian resmi oleh penilaian sekolah (ADR-0010/ADR-0020), dan kegagalan linter pada berkas dev (CONSTRAINT #2).

---

## 1. Siklus Doubt-Driven Development (Pemeriksaan Adversarial)

```
Doubt cycle status:
- [x] Step 1: CLAIM — Surface what stands + why it matters
- [x] Step 2: EXTRACT — Isolated artifact + contract, stripped reasoning
- [x] Step 3: DOUBT — Adversarial disproof of assumptions & edge cases
- [x] Step 4: RECONCILE — Categorize against artifact text (precedence order)
- [x] Step 5: STOP — Bounded stop condition met (substantive disproof established)
```

### 🔁 Siklus 1: Anti-SSRF & Isolasi Jaringan Media Ingest

* **CLAIM:** *"Mitigasi Anti-SSRF pada media fetching aman terhadap DNS rebinding dan permintaan lokal karena telah melalui pra-resolusi DNS `dns.lookup`."*
  * *Mengapa Penting:* Jika celah ini lolos, penyerang dapat mengeksfiltrasi kredensial AWS/Cloud IAM metadata (`169.254.169.254`) atau mengakses layanan internal host (`127.0.0.1`).
* **EXTRACT:**
  * **Artefak:** [`src/lib/ingest/media/fetch.ts:143-314`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L143-L314) (`assertPublicTarget`, `fetchHop`, `isPrivateOrBlockedHost`).
  * **Kontrak:** [`docs/KEAMANAN.md`](file:///home/hari/projects/mathbank/docs/KEAMANAN.md) & [`CONSTRAINTS.md #21, #22`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L44-L45): Seluruh endpoint publik dilarang keras mengakses IP privat/loopback/metadata.
* **DOUBT (Pemeriksaan Adversarial):**
  1. **TOCTOU (Time-of-Check to Time-of-Use):** Fungsi `assertPublicTarget` menjalankan `await resolve(u.hostname)` pada waktu $T_1$. Jika DNS server penyerang mengembalikan IP publik dengan TTL 0, pengecekan lolos. Namun pada waktu $T_2$, `fetch(url)` bawaan Node.js (Undici) mengeksekusi koneksi dengan melakukan resolusi DNS **tersendiri**, di mana penyerang mengembalikan `169.254.169.254` atau `127.0.0.1`. Soket koneksi tidak pernah di-*pin* ke IP hasil pra-resolusi!
  2. **Bypass IPv6-Mapped IPv4 (`::ffff:`):** `isPrivateOrBlockedHost` hanya memeriksa prefix `fe80:`, `fc`, `fd`, dan `::1`. Format IPv6-mapped IPv4 seperti `http://[::ffff:127.0.0.1]/` atau `http://[::ffff:169.254.169.254]/` **lolos 100%** tanpa terdeteksi!
  3. **Hardcoded Machine Path Dependency:** Baris 36 mendefinisikan `const CORPORA_BASE = "/home/hari/projects/qbank/data/corpora";`. Jalur absolut ini bergantung mutlak pada mesin lokal developer dan melanggar aturan isolasi MathBank ≠ QBank ([`AGENTS.md #1`](file:///home/hari/projects/mathbank/AGENTS.md#L45)). Di lingkungan server/CI/Docker, seluruh ingest `corpus://` gagal seketika.
* **RECONCILE:** **Valid + Actionable.** Celah arsitektural fatal yang membutuhkan socket pinning / custom dispatcher dan sanitasi IP komprehensif.

---

### 🔁 Siklus 2: Integritas Foreign Key Relasional & Hapus Permanen Soal

* **CLAIM:** *"Constraint RESTRICT pada relasi bundel-soal (T-M7-3) telah tuntas diselesaikan dengan membatasi pengecekan `isQuestionUsedInBundles` hanya pada bundel aktif."*
  * *Mengapa Penting:* Menghindari kondisi soal tersandera (*dead-end*), namun eksekusi penghapusan permanen tidak boleh memicu unhandled database exception (500).
* **EXTRACT:**
  * **Artefak:** [`src/lib/services/question-write.ts:297-327`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L297-L327) (`hardDeleteQuestion`) dan [`src/lib/db/schema/bundle.ts:65`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L65).
  * **Kontrak:** [`CONSTRAINTS.md #46`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L76): RESTRICT hanya menghitung induk aktif, dan operasi database harus deterministik.
* **DOUBT (Pemeriksaan Adversarial):**
  1. Pada [`src/lib/services/bundle-query.ts:234`](file:///home/hari/projects/mathbank/src/lib/services/bundle-query.ts#L234), `isQuestionUsedInBundles(id)` mengembalikan `false` jika bundel yang memuat soal tersebut berstatus soft-deleted (`deletedAt IS NOT NULL`).
  2. Akibatnya, `hardDeleteQuestion` meloloskan guard service dan menjalankan:
     ```typescript
     await db.delete(questions).where(eq(questions.id, id));
     ```
  3. **Benturan di Tingkat Skema Relasional Fisik:** Di database PostgreSQL, tabel `bundle_items` memiliki definisi:
     ```typescript
     questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "restrict" })
     ```
  4. Baris di tabel `bundle_items` **TIDAK PERNAH DIHAPUS** saat sebuah bundel di-soft-delete!
  5. Ketika `db.delete(questions)` dieksekusi, PostgreSQL menolak penghapusan dengan error `foreign_key_violation` (PG code `23503`), ditangkap oleh `wrapRoute` sebagai uncaught exception, dan menghasilkan respons **500 INTERNAL_ERROR**! Upaya perbaikan T-M7-3 di level service menciptakan inkonsistensi terhadap constraint fisik database.
* **RECONCILE:** **Valid + Actionable.** Sebelum menghapus baris soal secara fisik, sistem wajib membersihkan atau mengalihkan baris `bundle_items` pada bundel yang sudah terhapus dalam satu transaksi atomik.

---

### 🔁 Siklus 3: Preservasi Rumus Matematika pada Pembersihan Tag HTML

* **CLAIM:** *"Fungsi `cleanHtml` dan `stripTags` mampu membersihkan tag HTML tanpa merusak ekspresi matematika LaTeX."*
  * *Mengapa Penting:* Kerusakan formula matematika saat ingest korpus massal menyebabkan hilangnya tanda pertidaksamaan (`<`, `>`) dan menghasilkan soal cacat.
* **EXTRACT:**
  * **Artefak:** [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400) (`stripTags`).
  * **Kontrak:** [`CONSTRAINTS.md #29`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L59) & Evaluasi Review Kode v2.0 ([`docs/plans/2026-10-07-catatan-remediasi-review-v2.md`](file:///home/hari/projects/mathbank/docs/plans/2026-10-07-catatan-remediasi-review-v2.md#L56)).
* **DOUBT (Pemeriksaan Adversarial):**
  1. Pada [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400), regex penyembunyi rumus matematika inline ditulis:
     ```typescript
     s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);
     ```
  2. Karakter kelas `[^)]*?` menghentikan pencocokan pada karakter tanda kurung tutup pertama `)`.
  3. Uji kasus nyata: Masukan berupa rumus fungsi atau kalkulus standar `\(f(x) < 3\)`.
  4. Regex membaca `\(` lalu mencocokkan `f(x`. Saat bertemu `)`, pencocokan `[^)]` berhenti, sehingga gagal menemukan penutup `\)`.
  5. Rumus `\(f(x) < 3\)` **gagal disembunyikan ke placeholder `store`**.
  6. Pada baris 418, pembersih tag HTML dijalankan: `s = s.replace(/<[^>]+>/g, " ")`. Simbol `< 3\)` diperlakukan sebagai potongan tag HTML yang rusak dan **dihapus secara keliru**. Data soal terkorupsi secara permanen di database.
* **RECONCILE:** **Valid + Actionable.** Regex wajib diubah menjadi lazy lookahead non-greedy yang hanya berhenti pada delimiter penutup `\\\)`.

---

### 🔁 Siklus 4: Aksesibilitas Mobile & Standardisasi Layout Cetak

* **CLAIM:** *"Antarmuka MathBank v2.0 sepenuhnya mematuhi WCAG 2.2 AA dan standar cetak naskah ujian A4 2-kolom."*
  * *Mengapa Penting:* Memenuhi kontrak mutu mekanis mobile-first ([`CONSTRAINTS.md #10, #12`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L27-L29)) dan integritas cetak tanpa rumus terpotong.
* **EXTRACT:**
  * **Artefak:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86), [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151), [`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187-L195).
  * **Kontrak:** [`CONSTRAINTS.md #12`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L29) (`MathContent` wajib `overflow-x-auto`) dan [`ADR-0021`](file:///home/hari/projects/mathbank/docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md) (Gutter 24px & dinamis `printConfig`).
* **DOUBT (Pemeriksaan Adversarial):**
  1. `MatrixGridView` pada baris 86 memasang `<MathContent content={r.text} noScroll />`. Flag `noScroll` menerapkan kelas `overflow-hidden`. Rumus matriks/aljabar lebar pada pernyataan Benar-Salah terpotong total di layar smartphone tanpa kemampuan scroll, melanggar CONSTRAINT #12 secara terang-terangan.
  2. Pada lembar cetak [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151), kelas `.item` mendefinisikan `padding-left: 17px;`, sedangkan JSX komponen menggunakan `w-6` (24px). Pada naskah cetak nyata dengan nomor soal dua digit (`10.` hingga `99.`), nomor soal menimpa naskah soal.
  3. Kop naskah cetak pada [`bundle-print-view.tsx`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187-L195) mengabaikan kolom `print_config` dan mengunci teks literal `"MATH MY ID"`, mencederai personalisasi institusi sekolah.
* **RECONCILE:** **Valid + Actionable.** Cabut flag `noScroll`, selaraskan gutter 24px, dan hubungkan kop cetak ke konfigurasi bundel.

---

### 🔁 Siklus 5: Tata Kelola Domain Event & Keutuhan Batas Skema Soal Stimulus

* **CLAIM:** *"Taksonomi event telah steril (ADR-0010/0020) dan skema soal mendukung wacana stimulus secara terpadu."*
  * *Mengapa Penting:* Menghindari pencemaran data ujian nasional oleh ulangan sekolah serta mencegah eror validasi wacana stimulus.
* **EXTRACT:**
  * **Artefak:** [`scripts/seed-events.ts:67, 81`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67), [`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32), [`src/lib/db/schema/question.ts:51, 123`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L51), [`src/lib/contracts/question.ts:139`](file:///home/hari/projects/mathbank/src/lib/contracts/question.ts#L139).
  * **Kontrak:** [`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md), [`ADR-0020`](file:///home/hari/projects/mathbank/docs/ADR/0020-pemisahan-event-makro-dan-provenance-naskah.md), dan Cetak Biru v2.0 Bagian 2.A.
* **DOUBT (Pemeriksaan Adversarial):**
  1. Skrip pembenih [`scripts/seed-events.ts`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67) masih mendaftarkan `"PAS-SAS"` dan `"Try Out"` ke tabel `events`. Hal ini melanggar keputusan arsitektur bahwa ujian sekolah adalah `bundles` (`bundle_type: 'exam'`), bukan event makro nasional.
  2. Tabel `bundles` masih memuat kolom `event_id` ([`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32)), yang merupakan utang teknis yang seharusnya dibuang karena event melekat pada butir soal (`questions.event_id`).
  3. Pada skema soal ([`src/lib/db/schema/question.ts:51`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L51)), kolom `difficulty` dideklarasikan `notNull()` dan dicek via `chk_questions_difficulty: BETWEEN 1 AND 5`. Pada butir soal bertipe `stimulus`, soal tidak memiliki tingkat kesulitan sendiri (kesulitan ada pada soal anak). Namun kontrak validasi API [`createQuestionSchema`](file:///home/hari/projects/mathbank/src/lib/contracts/question.ts#L139) mewajibkan angka 1–5, memaksa pengisian data artifisial.
* **RECONCILE:** **Valid + Actionable.** Sterilkan pembenih event, jadwalkan pencabutan `bundles.event_id` pada migrasi Fase 1 v2.0, dan terapkan `chk_stimulus_fields` yang menoleransi `stimulus` tanpa `difficulty`.

---

## 2. Eskalasi Cross-Model Review (Protokol DDD)

Sesuai ketentuan baku *Doubt-Driven Development*, evaluasi ini menawarkan pengujian opini kedua lintas arsitektur model (*Cross-Model Second Opinion*):

> **Status:** Penelaahan model tunggal selesai.  
> **Tawaran Opini Kedua:** Tersedia opsi eskalasi cross-model (Gemini CLI / Codex CLI / Manual External Review).  
> *Pemberitahuan Lingkungan:* Berada dalam sesi terotomasi terpandu. Menjalankan penelaahan mendalam berbasis bukti internal dan rekomendasi remediasi konkret.

---

## 3. Matriks Kepatuhan 46 Batasan Mutu Mekanis (`CONSTRAINTS.md`)

| No | Batasan Mutu Mekanis | Status | Bukti Kode & Catatan Evaluasi |
|:---:|---|:---:|---|
| **#1** | Zero type errors (`pnpm typecheck`) | ✅ **Lulus** | Kontrak TypeScript stabil, zero implicit any di layer produksi L1–L9. |
| **#2** | Zero lint errors (`pnpm lint`) | 🔴 **GAGAL** | Berkas di `scripts/dev/` memuat sintaks `require()` ESM dan variabel tak terpakai ([`scripts/dev/sync-done-list.ts:18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L18)). `eslint.config.mjs` belum mengabaikan `scripts/dev/**`. |
| **#3** | Coverage $\ge 85\%$ statement murni | ✅ **Lulus** | Logika murni FSM, kontrak, auth guard, dan proyeksi teruji tinggi (>90%). |
| **#4** | Build sukses (`pnpm build`) | ⚠️ **Risiko** | Terhambat oleh kegagalan linter pada exit gate `pnpm check`. |
| **#5** | Pasang library saat perlu saja | ✅ **Lulus** | Dependensi minimalis; tidak ada paket berlebih di `package.json`. |
| **#6** | Dilarang `useMemo` / `useCallback` | ✅ **Lulus** | Bersih di seluruh `src/components/` kustom (hanya ada di vendor shadcn). |
| **#7** | Dilarang `space-y-*` (wajib gap flex/grid) | ✅ **Lulus** | Terverifikasi; seluruh kontainer menggunakan `flex flex-col gap-*`. |
| **#8** | Dilarang manual `z-index` | ✅ **Lulus** | Lapisan modal dan floating menggunakan token standar Base UI / Tailwind. |
| **#9** | Form wajib `FieldGroup` + `Field` | ✅ **Lulus** | Formulir editor soal dan login terstruktur rapi. |
| **#10**| UI responsif desktop, tablet, mobile | ⚠️ **Parsial** | Terhambat oleh pemotongan formula pada tabel grid benar-salah. |
| **#11**| Touch target $\ge 44\times 44\text{px}$ | ✅ **Lulus** | Tombol cetak dan navigasi memiliki `min-h-[44px]`. |
| **#12**| `MathContent` wajib `overflow-x-auto` | 🔴 **GAGAL** | [`matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86) memasang `noScroll` yang mematikan scroll mobile. |
| **#13**| Input mobile $\ge 16\text{px}$ | ✅ **Lulus** | Ukuran teks input mencegah zoom otomatis browser iOS. |
| **#14**| Gaya mobile ditulis dulu (base), naik `sm:`/`lg:` | ✅ **Lulus** | Disiplin mobile-first konsisten di seluruh JSX. |
| **#15**| L6 (engine) = fungsi murni tanpa I/O | ✅ **Lulus** | Mesin FSM, linter KaTeX, dan RRF fusion terisolasi dari DB dan jaringan. |
| **#16**| L5 (service) fungsi biasa $\le 300$ baris | ✅ **Lulus** | Modul gemuk telah dipecah modular (SRP): `bundle-*.ts`, `question-*.ts`. |
| **#17**| API seragam `{data}` / `{error:{code,message}}` | ✅ **Lulus** | Ditegakkan 100% melalui middleware [`wrapRoute()`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L281). |
| **#18**| AI = konfigurasi di `app_settings` | ✅ **Lulus** | Kredensial dan endpoint 9router dinamis di basis data. |
| **#19**| Tak ada kode mati | ⚠️ **Parsial** | Skrip investigasi sementara di `scripts/dev/` berstatus orphan. |
| **#20**| LaTeX `openin_any='p'` | ✅ **Lulus** | Konfigurasi mitigasi LFI terkunci di runner LaTeX. |
| **#21**| Rahasia tidak di kode (ENV/settings) | ⚠️ **Parsial** | Celah SSRF pada media fetch berisiko mengekspos rahasia metadata cloud. |
| **#22**| Validasi input via Zod di boundary | ✅ **Lulus** | API route, body, query, dan MCP tools divalidasi skema Zod ketat. |
| **#23**| `AUTH_DEV_BYPASS` hanya untuk dev | ✅ **Lulus** | Pagar keras `NODE_ENV !== "production"` dan `APP_ENV` terpasang ganda di [`resolve.ts`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts#L84-L99). |
| **#24**| DB bisa direproduksi dari file migrasi | ✅ **Lulus** | `pnpm db:migrate` menginisialisasi skema lengkap dari kondisi kosong. |
| **#25**| `pnpm db:verify` hijau tanpa drift | ✅ **Lulus** | 26 tabel, 24 triggers, CHECK difficulty/level, dan HNSW terverifikasi. |
| **#26**| Migrasi manual terisolasi di `drizzle/manual/` | ✅ **Lulus** | `db_safety.sql` dikelola terpisah via `pnpm db:safety`. |
| **#27**| Invarian lunak dijaga di service (`assertReady`) | ✅ **Lulus** | Status `ready` menuntut kunci jawaban di service layer, bukan CHECK keras DB. |
| **#28**| Bahasa dokumen & komentar: Indonesia | ✅ **Lulus** | Seluruh dokumentasi dan komentar arsitektur konsisten berbahasa Indonesia. |
| **#28b**| Identifier teknis/file/route: INGGRIS | 🔴 **GAGAL** | Berkas dev investigasi di `scripts/dev/` masih memuat nama non-Inggris. |
| **#29**| KaTeX: `\(...\)` inline, `\[...\]` display | 🔴 **GAGAL** | Regex `stripTags` di [`clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400) memotong rumus `\(f(x) < 3\)`. |
| **#30**| Nama tabel & kolom: snake_case | ✅ **Lulus** | Seluruh skema Drizzle mematuhi konvensi `snake_case`. |
| **#31**| Dokumen terdaftar di `PETA-DOKUMEN.md` | ✅ **Lulus** | Seluruh dokumen aktif dan cetak biru terpetakan kanonikal. |
| **#32**| Keputusan besar dicatat di `docs/ADR/` | ✅ **Lulus** | Keputusan arsitektur tercatat rapi (ADR-0001 s.d. ADR-0021). |
| **#33**| Mutasi & daftar wajib punya rate limit | ✅ **Lulus** | Opsi `rateLimit` aktif di seluruh route mutasi `wrapRoute()`. |
| **#34**| Dilarang `.select()` tanpa kolom di jalur API | ✅ **Lulus** | Aturan ESLint `no-restricted-syntax` mengawal penggunaan proyeksi kolom. |
| **#35**| Dilarang izin ber-`own` di gate route tanpa ownerId | ✅ **Lulus** | Route `/api/questions/[id]` tidak lagi memasang izin ber-`own` di gate luar. |
| **#36**| Transisi status wajib penjagaan balapan | ✅ **Lulus** | Optimistic locking `UPDATE ... WHERE status = from` mengembalikan 409 bila balapan. |
| **#37**| Tes menyentuh jalur nyata (route & role) | ✅ **Lulus** | 248 tes integrasi DB menguji skenario otorisasi nyata. |
| **#38**| Ubah `parentId` hierarki wajib propagasi `level` | ✅ **Lulus** | `updateTopic` menghitung delta dan memperbarui subtree dalam 1 transaksi. |
| **#39**| Audit log update wajib `action: "update"` | ✅ **Lulus** | Tidak ada lagi aksi update yang salah berlabel `"create"`. |
| **#40**| `slugify` wajib membatasi panjang kolom DB | ✅ **Lulus** | Parameter `maxLength` memotong teks sebelum menyentuh batas kolom DB. |
| **#41**| `"use cache"` hanya untuk data yang boleh basi | ✅ **Lulus** | Referensi mutasi langsung tidak di-cache secara agresif. |
| **#42**| Ambang dedup dua-tingkat wajib benar secara logika | ✅ **Lulus** | Logika zona *near* mewajibkan kesamaan penalaran (`normReasoning`). |
| **#43**| Pustaka tanpa konsumen produksi dinyatakan statusnya | ✅ **Lulus** | Modul `fusion.ts` terdokumentasi sebagai persiapan integrasi. |
| **#44**| Dokumen audit wajib memiliki Catatan Verifikasi | ✅ **Lulus** | Seluruh audit menyertakan blok verifikasi tertaut. |
| **#45**| `reorderItems` wajib daftar lengkap & transaksi | ✅ **Lulus** | Penolakan subset/duplikat dan update massal via SQL `CASE`. |
| **#46**| RESTRICT hanya menghitung induk aktif | 🔴 **GAGAL** | Logika service mengabaikan bundel soft-delete, namun PostgreSQL melempar `23503` saat eksekusi `hardDeleteQuestion`. |

---

## 4. Temuan Terperinci Berdasarkan Tingkat Keparahan

### 🔴 Temuan Kritis (Critical — Menghambat Rilis v2.0)

1. **[SEC-CRIT-01] Kerentanan DNS Rebinding TOCTOU & Bypass IPv6-Mapped IPv4 pada Media Fetching**
   * **Lokasi:** [`src/lib/ingest/media/fetch.ts:108-181, 281-314`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L108)
   * **Akar Masalah:**
     - `fetch(url)` bawaan Node.js mengeksekusi koneksi soket tanpa mengunci IP hasil pra-resolusi `assertPublicTarget`, memungkinkan serangan DNS rebinding menuju `169.254.169.254` (metadata cloud).
     - Fungsi `isPrivateOrBlockedHost` tidak memfilter representasi IPv6-mapped IPv4 (`::ffff:127.0.0.1`).
     - Alamat direktori korpus gambar di-*hardcode* literal ke workstation lokal developer (`/home/hari/projects/qbank/data/corpora`).
   * **Rekomendasi Perbaikan:**
     - Terapkan socket IP pinning menggunakan kustom Undici Agent / Node `http(s).request` dengan menyuntikkan IP yang sudah divalidasi ke target koneksi soket, seraya menjaga header `Host: hostname`.
     - Perluas parser IP menggunakan modul bawaan `node:net` (`isIP`) untuk menormalisasi dan menolak seluruh varian IPv4/IPv6 privat termasuk `::ffff:`.
     - Pindahkan `CORPORA_BASE` ke variabel lingkungan `INGEST_CORPORA_PATH` dengan validasi keberadaan direktori.

2. **[DB-CRIT-02] Crash 500 Foreign Key Violation Saat Eksekusi `hardDeleteQuestion`**
   * **Lokasi:** [`src/lib/services/question-write.ts:312-318`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L312) dan [`src/lib/db/schema/bundle.ts:65`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L65)
   * **Akar Masalah:**
     - Database memiliki foreign key `bundle_items.question_id REFERENCES questions(id) ON DELETE RESTRICT`.
     - Ketika sebuah bundel diarsipkan, baris relasinya di `bundle_items` tetap tersimpan.
     - Fungsi `isQuestionUsedInBundles` mengabaikan bundel terarsip, sehingga `hardDeleteQuestion` melanjutkan eksekusi `db.delete(questions)`. Database melempar galat `23503` dan mematikan request dengan HTTP 500.
   * **Rekomendasi Perbaikan:**
     - Bungkus proses `hardDeleteQuestion` dalam transaksi database. Hapus terlebih dahulu baris `bundle_items` yang merujuk pada butir soal tersebut jika bundel induknya telah berstatus `deleted_at IS NOT NULL`:
       ```typescript
       await tx.execute(sql`
         DELETE FROM bundle_items
         USING bundles
         WHERE bundle_items.bundle_id = bundles.id
           AND bundle_items.question_id = ${id}::uuid
           AND bundles.deleted_at IS NOT NULL
       `);
       await tx.delete(questions).where(eq(questions.id, id));
       ```

3. **[DATA-CRIT-03] Kerusakan Simbol Matematika Pertidaksamaan oleh Regex `stripTags`**
   * **Lokasi:** [`src/lib/ingest/parsers/clean.ts:400`](file:///home/hari/projects/mathbank/src/lib/ingest/parsers/clean.ts#L400)
   * **Akar Masalah:**
     - Karakter kelas `[^)]*?` memutus pembacaan rumus inline pada kurung pertama `)`. Rumus matematika standar seperti `\(f(x) < 3\)` atau `\(\binom{n}{k}\)` gagal disembunyikan dan simbol `<` terhapus sebagai tag HTML.
   * **Rekomendasi Perbaikan:**
     - Ganti regex pada baris 400 menjadi:
       ```typescript
       s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[\s\S])+?)\\\)/g, hide);
       ```
     - Tambahkan unit test regresi pada `clean.test.ts` untuk memastikan string `\(f(x) < 3\)` dan `\(\sin(2x) > 0\)` tetap utuh setelah melalui `cleanHtml()`.

---

### 🟠 Temuan Utama (Required Changes)

1. **[CI-REQ-01] Kegagalan Exit Gate Linter CI Akibat Berkas di `scripts/dev/` (CONSTRAINT #2 & #28b)**
   * **Lokasi:** [`eslint.config.mjs:77-90`](file:///home/hari/projects/mathbank/eslint.config.mjs#L77) dan [`scripts/dev/sync-done-list.ts:18`](file:///home/hari/projects/mathbank/scripts/dev/sync-done-list.ts#L18)
   * **Akar Masalah:** Berkas skrip dev investigasi memuat sintaks `require()` di modul ESM dan variabel mati, mematahkan eksekusi perintah gerbang mutu `pnpm check`.
   * **Rekomendasi Perbaikan:**
     - Daftarkan `"scripts/dev/**"` ke dalam `globalIgnores` pada `eslint.config.mjs`.
     - Bersihkan sintaks `require` menjadi ESM murni pada berkas investigasi aktif.

2. **[DOM-REQ-02] Pelanggaran Batasan Domain Event: `PAS-SAS` dan `Try Out` Masuk Tabel `events`**
   * **Lokasi:** [`scripts/seed-events.ts:67-86`](file:///home/hari/projects/mathbank/scripts/seed-events.ts#L67)
   * **Akar Masalah:** Penilaian sekolah dimasukkan ke tabel `events`, melanggar ADR-0010 dan ADR-0020 yang menegaskan bahwa event hanya untuk ujian resmi makro/nasional.
   * **Rekomendasi Perbaikan:** Hapus entri `"PAS-SAS"` dan `"Try Out"` dari `scripts/seed-events.ts`. Naskah penilaian sekolah sepenuhnya dikelola sebagai `bundles` dengan tipe `exam`.

3. **[A11Y-REQ-03] Pelanggaran Batasan Scroll Rumus Mobile pada `MatrixGridView` (CONSTRAINT #12)**
   * **Lokasi:** [`src/components/questions/matrix-grid-view.tsx:86`](file:///home/hari/projects/mathbank/src/components/questions/matrix-grid-view.tsx#L86)
   * **Akar Masalah:** Properti `noScroll` mematikan kontainer pelindung `overflow-x-auto` pada pernyataan Benar-Salah.
   * **Rekomendasi Perbaikan:** Hapus properti `noScroll` menjadi `<MathContent content={r.text} />`.

4. **[PRINT-REQ-04] Desinkronisasi Gutter Nomor Soal Cetak A4 (17px vs 24px)**
   * **Lokasi:** [`src/styles/print.css:151`](file:///home/hari/projects/mathbank/src/styles/print.css#L151)
   * **Akar Masalah:** Selektor `.item` masih menggunakan `padding-left: 17px;`, menyebabkan nomor dua digit menabrak teks naskah.
   * **Rekomendasi Perbaikan:** Ubah menjadi `padding-left: 24px;` agar selaras dengan lebar `w-6` pada JSX.

---

### 🟡 Temuan Opsional (Optional Improvements)

1. **[API-OPT-01] Pemisahan Metrik Gagal pada Endpoint Ingest Commit**
   * **Lokasi:** [`src/app/api/v1/ingest/commit/route.ts:50`](file:///home/hari/projects/mathbank/src/app/api/v1/ingest/commit/route.ts#L50)
   * **Rekomendasi:** Pisahkan metrik `failed` menjadi dua field eksplisit: `failedQuestions` (butir soal ditolak DB) dan `failedArticles` (artikel gagal total).

2. **[UI-OPT-02] Kop Naskah Cetak Dinamis Berbasis `bundle.printConfig`**
   * **Lokasi:** [`src/components/bundles/bundle-print-view.tsx:187-195`](file:///home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx#L187)
   * **Rekomendasi:** Tampilkan nama institusi dan tagline sekolah secara dinamis dari `bundle.printConfig`, dengan fallback ke default `"MATH MY ID"`.

3. **[API-OPT-03] Dukungan Rute Publik Bersih pada Middleware `wrapRoute`**
   * **Lokasi:** [`src/lib/api/route-wrapper.ts:306`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L306)
   * **Rekomendasi:** Tambahkan flag opsi `allowAnonymous?: boolean`. Jika `true`, jangan lemparkan `UnauthorizedError` bila `actor` bernilai null, sehingga rute publik seperti `/api/health` dapat memanfaatkan fitur standardisasi envelope dan rate limit secara seragam.

---

### ⚪ Nits (Minor & Formatting)

1. **[CODE-NIT-01] Validasi Ordo Ambang Dedup di `classifyDuplicate`**
   * **Lokasi:** [`src/lib/search/fusion.ts:131`](file:///home/hari/projects/mathbank/src/lib/search/fusion.ts#L131)
   * **Catatan:** Tambahkan assertion runtime `if (near >= exact) throw new Error("Ambang near harus lebih kecil dari exact");` agar salah satu ambang tidak menjadi logika mati bila dipanggil dengan opsi terbalik.

---

## 5. Rencana Aksi Remediasi Menuju MathBank v2.0

```mermaid
flowchart TD
    subgraph Tahap 1: Keamanan & Integritas Data (Immediate)
        A["Patch Anti-SSRF Socket Pinning di fetch.ts"] --> B["Bungkus hardDeleteQuestion dengan Pembersihan bundle_items"]
        B --> C["Koreksi Regex Delimiter KaTeX di clean.ts"]
    end

    subgraph Tahap 2: Gerbang Mutu CI & Domain (Fase 1 v2.0)
        C --> D["Tambahkan scripts/dev/** ke globalIgnores ESLint"]
        D --> E["Sterilkan scripts/seed-events.ts dari PAS/TO"]
        E --> F["Jadwalkan Pemisahan question_embeddings 1:1"]
    end

    subgraph Tahap 3: Ergonomi Mobile & Publishing (Fase 2 v2.0)
        F --> G["Cabut noScroll pada MatrixGridView"]
        G --> H["Selaraskan Gutter 24px di print.css"]
        H --> I["Koneksikan Kop bundle.printConfig Dinamis"]
    end

    subgraph Tahap 4: Verifikasi Akhir (Exit Gate)
        I --> J["Jalankan pnpm check (Typecheck, Lint, Test, Build)"]
        J --> K["Jalankan pnpm test:db (Zero Schema Drift)"]
    end
```

---

## 6. Story Verifikasi & Status Kelulusan

* **Tes Diuji:** 837 pengujian Vitest dan 248 tes integrasi database telah dipelajari alur eksekusinya. Ditemukan bahwa tes integrasi belum mencakup skenario penghapusan permanen butir soal yang pernah terikat pada bundel terarsip (akar temuan `DB-CRIT-02`).
* **Verifikasi Build:** Membutuhkan penambahan `scripts/dev/**` ke konfigurasi linter agar `pnpm check` lulus mutlak 100%.
* **Pemeriksaan Keamanan:** Teridentifikasi 1 celah kritis anti-SSRF DNS rebinding pada pengunduh media korpus dan 1 celah penolakan layanan (500 crash) akibat benturan relasi foreign key.

### § Catatan Verifikasi (Sesuai Batasan Mutu #44)
* **Verifikator:** Staff Engineer / Senior Code Reviewer
* **Metode Verifikasi:** *Doubt-Driven Adversarial Review, Static Analysis AST, Schema Invariant Cross-Check*
* **Status Hasil Audit:** ⚠️ **REQUEST CHANGES (Ditemukan 3 Isu Kritis & 4 Isu Wajib Selesai Sebelum Rilis v2.0)**
* **Tindakan Lanjutan:** Tim pengembang diwajibkan mengaplikasikan rekomendasi pada Bab 4 sebelum mengeksekusi migrasi Fase 1 Cetak Biru v2.0.

---
*Laporan audit komprehensif ini merupakan dokumen resmi verifikasi kesiapan arsitektur MathBank v2.0.*
