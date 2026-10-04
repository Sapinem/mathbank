# Implementation Plan — Perbaikan Catatan Audit MathBank (4 Oktober 2026)

> **Tujuan:** Memperbaiki temuan kritis (P1), tinggi (P2), dan keamanan rantai pasok (P3) hasil audit kode menyeluruh secara bertahap dan teruji menggunakan disiplin Test-Driven Development (TDD Red-Green-Refactor).

---

## 1. Pemetaan Berkas Terdampak

| Berkas | Peran & Tanggung Jawab Perubahan |
|---|---|
| [`src/lib/services/moodle-export-service.ts`](file:///home/hari/projects/mathbank/src/lib/services/moodle-export-service.ts) | Perbaiki otorisasi ekspor paket: gantikan `assertCan` tanpa `ownerId` dengan `assertBundleWrite(bundle, actor)`. |
| [`src/lib/services/moodle-export.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/services/moodle-export.db.test.ts) | Tambahkan tes integrasi DB untuk peran guru (`teacher`) mengekspor naskah miliknya dan ditolak saat mengekspor naskah guru lain. |
| [`src/lib/services/collection-service.ts`](file:///home/hari/projects/mathbank/src/lib/services/collection-service.ts) | Ekspor fungsi pembantu `isQuestionUsedInCollections(questionId: string)`. |
| [`src/lib/services/question-write.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts) | Pasang proteksi penghapusan soal (soft-delete & hard-delete) bila soal masih terhubung ke koleksi (`collection_items`). |
| [`src/lib/services/collection-service.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/services/collection-service.db.test.ts) | Tambahkan tes verifikasi bahwa soal yang ada di koleksi ditolak 409 Conflict saat dihapus (bukan crash SQL 23503). |
| [`src/lib/ingest/media/fetch.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts) | Tambahkan pengawal pra-koneksi anti-SSRF yang memblokir resolusi ke private IP (RFC 1918, loopback, AWS metadata 169.254.169.254). |
| [`src/lib/ingest/media/media-io.test.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/media-io.test.ts) | Tambahkan pengujian unit untuk proteksi SSRF. |
| [`package.json`](file:///home/hari/projects/mathbank/package.json) | Tambahkan override pnpm untuk paket transitif `braces` (>=3.0.4) guna menutup advisory keamanan `pnpm audit`. |

---

## 2. Tahapan Eksekusi (Bite-Sized Tasks)

### Task 1: [SEC-01] Otorisasi Kepemilikan Ekspor Moodle
- [ ] **Langkah 1.1 (TDD Red):** Tambahkan skenario uji guru pada [`src/lib/services/moodle-export.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/services/moodle-export.db.test.ts):
  - Guru dapat mengekspor paket naskah yang dibuatnya sendiri.
  - Guru ditolak 403 Forbidden bila mencoba mengekspor paket naskah milik guru lain.
- [ ] **Langkah 1.2 (Verifikasi Red):** Jalankan `pnpm test:db src/lib/services/moodle-export.db.test.ts` dan amati kegagalan (guru ditolak pada paket miliknya).
- [ ] **Langkah 1.3 (TDD Green):** Di [`src/lib/services/moodle-export-service.ts`](file:///home/hari/projects/mathbank/src/lib/services/moodle-export-service.ts):
  - Impor `assertBundleWrite` dari `@/lib/services/bundle-service`.
  - Ambil `bundle = await getBundle(bundleId)` di awal fungsi.
  - Lempar `NotFoundError` bila `!bundle`.
  - Panggil `assertBundleWrite(bundle, actor)` menggantikan `assertCan(actor, "bundle:manage")`.
- [ ] **Langkah 1.4 (Verifikasi Green):** Jalankan ulang `pnpm test:db src/lib/services/moodle-export.db.test.ts` hingga seluruh pengujian lulus.

---

### Task 2: [SEC-02] Proteksi Hapus Soal yang Tertaut ke Koleksi Publik
- [ ] **Langkah 2.1 (TDD Red):** Di [`src/lib/services/collection-service.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/services/collection-service.db.test.ts):
  - Buat tes `deleteQuestion` dan `hardDeleteQuestion` pada soal yang masuk ke koleksi.
  - Pastikan operasi melempar `ConflictError` (HTTP 409), bukan melempar galat PostgreSQL 23503 tak tertangani.
- [ ] **Langkah 2.2 (Verifikasi Red):** Jalankan tes dan amati kegagalan.
- [ ] **Langkah 2.3 (TDD Green):**
  - Di [`src/lib/services/collection-service.ts`](file:///home/hari/projects/mathbank/src/lib/services/collection-service.ts), implementasikan fungsi `isQuestionUsedInCollections(questionId: string): Promise<boolean>`.
  - Di [`src/lib/services/question-write.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts), periksa `await isQuestionUsedInCollections(id)` pada fungsi `deleteQuestion` dan `hardDeleteQuestion`.
- [ ] **Langkah 2.4 (Verifikasi Green):** Jalankan tes integrasi DB dan buktikan status 409 Conflict tertangani rapi.

---

### Task 3: [SEC-04] Pengerasan Jaringan Anti-SSRF pada `fetchImage`
- [ ] **Langkah 3.1 (TDD Red):** Di [`src/lib/ingest/media/media-io.test.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/media-io.test.ts):
  - Buat tes penolakan URL yang mengarah ke loopback (`127.0.0.1`), metadata server (`169.254.169.254`), dan private IP (`10.0.0.1`).
- [ ] **Langkah 3.2 (TDD Green):** Di [`src/lib/ingest/media/fetch.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts):
  - Implementasikan pengecekan hostname & IP anti-SSRF sebelum melakukan koneksi HTTP.
- [ ] **Langkah 3.3 (Verifikasi Green):** Jalankan `pnpm test src/lib/ingest/media/media-io.test.ts`.

---

### Task 4: [SUP-07] Resolusi Kerentanan Dependensi `braces`
- [ ] **Langkah 4.1:** Tambahkan blok `pnpm.overrides` pada [`package.json`](file:///home/hari/projects/mathbank/package.json):
  ```json
  "pnpm": {
    "overrides": {
      "braces": ">=3.0.4"
    }
  }
  ```
- [ ] **Langkah 4.2:** Jalankan `pnpm install` dan verifikasi dengan `pnpm audit` (0 high vulnerabilities).

---

### Task 5: Verifikasi Mutu Menyeluruh (Exit Gate)
- [ ] Jalankan `pnpm typecheck` (harus 0 errors).
- [ ] Jalankan `pnpm lint` (harus 0 warnings/errors).
- [ ] Jalankan `pnpm test:coverage` (harus memenuhi seluruh ambang).
- [ ] Jalankan `pnpm test:db` (seluruh 23 berkas tes DB harus lulus).
- [ ] Jalankan `pnpm db:verify` (skema harus tetap *zero drift*).
- [ ] Jalankan `pnpm build` (kompilasi Next.js 16 berhasil).
