# MAT-131 · Blueprint & Orkestrasi Penghapusan Kolom Slug 2 Tahap

**Tanggal:** 21 Oktober 2026  
**Penulis:** Zaid (Chief of Staff & Lead Architect)  
**Target:** MathBank (`paperclip/dev`)  
**Referensi:** Mandat Owner, `docs/audit/ARAHAN-SLUG-REMOVAL-2TAHAP.md`, ADR-0019  
**Status:** 📋 Diajukan ke Owner (Menunggu Konfirmasi Eksekusi Subtask)

---

## 1. Latar Belakang & Rasional Arsitektur

MathBank telah mengadopsi standar identitas kanonik berbasis UUIDv7 (`uuidPk()`) untuk seluruh entitas inti (soal, topik, tag, paket, sumber). Seluruh routing Next.js App Router (`/questions/[id]`, `/bundles/[id]`) dan relasi basis data telah 100% berbasis ID.

Keberadaan kolom `slug` pada tabel `topics`, `tags`, `sources`, dan `bundles` merupakan artefak legacy yang:
1. Menimbulkan beban pemeliharaan (kewajiban auto-slugify, penanganan tabrakan slug NFKD/panjang karakter, dan benturan unique index).
2. Membuka potensi anomali integritas data (benturan nama yang berbeda menghasilkan slug sama).
3. Menambah kompleksitas query pencocokan (`OR ${table.slug} = ${slug}`).

Sesuai arahan Owner:
> *"Untuk slug, kita hapus saja. Tapi nanti 2 tahap. Pertama kita pakai skenario A dulu. Kalau sudah stabil baru ke B."*

Proses penghapusan dilakukan secara terstruktur melalui **2 Tahap**:
- **Tahap A (Soft Deprecation — Skenario A, SEKARANG)**: Menghentikan seluruh ketergantungan kode terhadap `slug` tanpa merusak integritas data eksisting atau melakukan breaking changes mendadak.
- **Tahap B (Hard Removal — Skenario B, NANTI)**: Pembersihan permanen (drop column & drop unique index) setelah Tahap A terbukti stabil di production.

---

## 2. Rincian Teknis Tahap A (Soft Deprecation)

### 2.1 Database & Skema Drizzle (Owner: Salman)
1. **Migrasi SQL**:
   Mengubah kolom `slug` menjadi nullable tanpa menghapus data atau unique index:
   ```sql
   ALTER TABLE topics ALTER COLUMN slug DROP NOT NULL;
   ALTER TABLE tags ALTER COLUMN slug DROP NOT NULL;
   ALTER TABLE sources ALTER COLUMN slug DROP NOT NULL;
   ALTER TABLE bundles ALTER COLUMN slug DROP NOT NULL;
   ```
2. **Drizzle Schema Update**:
   - `src/lib/db/schema/taxonomy.ts`: Hapus `.notNull()` dari `topics.slug` dan `tags.slug`.
   - `src/lib/db/schema/source.ts`: Hapus `.notNull()` dari `sources.slug`.
   - `src/lib/db/schema/bundle.ts`: Hapus `.notNull()` dari `bundles.slug`.
   - **Krusial**: `uniqueIndex("uq_topics_slug")` dan `uniqueIndex("uq_tags_slug")` **JANGAN di-drop**. Di PostgreSQL, unique index pada kolom nullable mengizinkan multiple NULLs, sehingga data eksisting tetap unik dan valid sementara baris baru tanpa slug aman disimpan sebagai NULL.

### 2.2 Service Layer & Data Contracts (Owner: Salman)
1. **`src/lib/services/topic-service.ts`**:
   - Hilangkan keharusan generate `slug` pada `createTopic` dan `updateTopic` (opsional atau NULL).
2. **`src/lib/services/question-read.ts`**:
   - Perbarui tipe `QuestionTopicView`: ubah `slug: string` menjadi `slug?: string | null`.
3. **`src/lib/services/taxonomy/tag.ts` & `src/lib/services/taxonomy/source.ts`**:
   - Hentikan kewajiban auto-slugify saat insert/update tag dan source.
4. **`src/lib/services/bundle-shared.ts` & `src/lib/services/bundle-write.ts`**:
   - Sesuaikan `uniqueSlug` agar tidak memblokir payload tanpa slug.
5. **`src/lib/services/enrichment/taxonomy-tx.ts`**:
   - Pencocokan topik/tag diprioritaskan murni berbasis nama (`lower(name) = lower(:name)`), slug hanya sebagai fallback sekunder untuk data legacy.
6. **`src/lib/hooks/use-reference.ts`**:
   - Perbarui interface `TopicRow` dan `SourceRow`: jadikan `slug` optional (`slug?: string | null`).

### 2.3 Skrip Eksternal & Kurasi (Owner: Salman / Faruq)
- **Status Skrip Kurasi Faruq**:
  `scripts/map-question-topics.ts` (190+ rule berbasis slug) dan `scripts/auto-tag-questions.ts` **TIDAK DIUBAH** pada Tahap A. Karena kolom fisik `slug` di DB tetap ada dengan nilai eksisting, skrip Faruq tetap berjalan normal 100% tanpa gangguan. Migrasi skrip ke ID kanonik akan dijadwalkan pada Tahap B.

### 2.4 Antarmuka Pengguna / Frontend (Owner: Ichsan)
1. **`src/components/questions/topic-tag.tsx`**:
   - Bersihkan properti `slug` dari `TopicTagItem` atau pastikan tidak ada logika render yang mengonsumsi `slug`.
   - Konfirmasi tautan filter Bank Soal tetap berbasis ID: `topicFilterHref(topic.id)` (`/questions?topicId=${id}`).
2. **`src/components/reference/labels-view.tsx`**:
   - Hapus kolom `Slug` dari tabel referensi label (`<TableHeader>` dan `<TableCell><Badge>{t.slug}</Badge></TableCell>`).
   - Tampilkan informasi nama label, jumlah penggunaan, dan tombol aksi tanpa elemen slug teknis.

---

## 3. Rincian Teknis Tahap B (Hard Removal — Rencana Masa Depan)

Tahap B akan dieksekusi setelah Tahap A berjalan stabil di production:
1. Migrasi skrip Faruq (`scripts/map-question-topics.ts`) dari pencocokan slug ke ID topik kanonik atau kode topik.
2. Drop unique index dari DB (`DROP INDEX uq_topics_slug; DROP INDEX uq_tags_slug;` dsb.).
3. Drop kolom fisik `slug` dari seluruh tabel (`ALTER TABLE ... DROP COLUMN slug`).
4. Hapus fungsi utilitas `slugify` dari `src/lib/taxonomy/tree.ts` dan modul terkait yang tidak lagi memerlukannya.
5. Finalisasi Architecture Decision Record (ADR-0019).

---

## 4. Pembagian Tugas & Matriks Tanggung Jawab

| Agen | Domain | Subtask | File Boundary Eksklusif |
|---|---|---|---|
| **Salman** | Backend & DB | `[Salman] Tahap A: Soft-Deprecate Kolom Slug (Schema Drizzle, Migrasi DB, & Service Layer Cleanup)` | `src/lib/db/schema/*`, `drizzle/*`, `src/lib/services/*`, `src/lib/hooks/use-reference.ts`, `*.db.test.ts` |
| **Ichsan** | Frontend / UI | `[Ichsan] Tahap A: UI Cleanup Penghapusan Slug (Labels View & Topic Tag)` | `src/components/questions/topic-tag.tsx`, `src/components/reference/labels-view.tsx`, UI tests |
| **Zaid** | CEO & Audit | `[Zaid] Quality Gate Audit, Verification & Sign-Off Tahap A Penghapusan Slug` | E2E audit, DB query proof, multi-viewport check, sign-off |

**Ketergantungan (`blockedByIssueIds`)**:
- Subtask Ichsan **DIBLOKIR OLEH** Subtask Salman (Backend selesai dahulu agar tipe data TypeScript dan service layer stabil).
- Subtask Sign-off Zaid **DIBLOKIR OLEH** Subtask Salman dan Subtask Ichsan.

---

## 5. Definition of Done (DoD) Tahap A

1. **Mechanical Gate**:
   - `pnpm typecheck` lulus 0 error.
   - `pnpm lint` lulus 0 error, 0 warning baru.
   - `pnpm test` (1010+ tests) lulus 100%.
2. **Database Verification**:
   - Kolom `slug` pada tabel `topics`, `tags`, `sources`, dan `bundles` terbukti nullable (`is_nullable = 'YES'` di `information_schema.columns`).
   - `INSERT` baris baru tanpa slug berhasil tersimpan (`slug IS NULL`).
   - Indeks unik tidak mengalami kerusakan.
3. **UI / Accessibility Verification**:
   - Tampilan `/reference/labels` tidak lagi menampilkan kolom/badge slug teknis.
   - Halaman `/questions/[id]` menampilkan tag topik dengan tautan filter `/questions?topicId=<id>`.
   - Multi-viewport (Mobile 360px, Tablet 768px, Desktop 1280px) bebas dari horizontal overflow (`scrollWidth === clientWidth`).
   - Target sentuh mobile tetap memenuhi standar minimum WCAG AA 44px.
4. **Dokumentasi**:
   - Catatan penyelesaian tertera di `docs/sprint1/SLUG-TAHAP-A.md`.

---

## 6. Catatan Penyelesaian Backend — MAT-134 (Salman)

**Status:** ✅ Selesai (backend & skema). Ruang lingkup MAT-134 = `topics` + `tags`
(`sources`/`bundles` tetap di Tahap A penuh sesuai peta jalan Zaid, ditangani terpisah).

### 6.1 Perubahan Skema & Migrasi
- `src/lib/db/schema/taxonomy.ts`: `topics.slug` (`varchar(255)`) dan `tags.slug`
  (`varchar(100)`) tidak lagi `.notNull()` → nullable, dengan komentar deprecation.
- `drizzle/0016_slug_soft_deprecation.sql`: `ALTER TABLE ... DROP NOT NULL` untuk
  kedua kolom (idempoten, aman dijalankan ulang). Snapshot `drizzle/meta/0016_snapshot.json`
  digenerate dari 0015 + flag nullable; `drizzle-kit check` → "Everything's fine".
- `uniqueIndex("uq_topics_slug")` & `uniqueIndex("uq_tags_slug")` **dipertahankan**
  (PostgreSQL mengizinkan banyak `NULL` pada unique index).

### 6.2 Perubahan Service Layer
| Berkas | Perubahan |
|---|---|
| `src/lib/taxonomy/tree.ts` | `TopicNode.slug?: string \| null` (deprecated, opsional). `slugify` dipertahankan sebagai legacy export. |
| `src/lib/services/topic-service.ts` | `createTopic`/`updateTopic` tidak lagi menulis `slug` (baris baru `NULL`). Semua navigasi tetap `id` + `parentId`. |
| `src/lib/services/taxonomy/tag.ts` | `createTag`/`updateTag` tidak lagi memanggil `slugify`; slug legacy dibiarkan apa adanya. |
| `src/lib/services/taxonomy/shared.ts` | `TagRow.slug: string \| null`. |
| `src/lib/services/question-read.ts` | `QuestionTopicView.slug?: string \| null`. |
| `src/lib/services/enrichment/taxonomy-tx.ts` | Lookup utama `lower(name)`; slug hanya fallback legacy (`slug IS NOT NULL AND slug = ...`). Insert tanpa slug → tak ada lagi tabrakan `uq_*_slug` maupun pemotongan NFKD. |

### 6.3 Test Suite
- `topic-service.db.test.ts`, `taxonomy-service.db.test.ts`: asersi slug diganti menjadi
  `slug === null` (identitas = `id`).
- `enrichment.db.test.ts`: CORR-02/CORR-03 diganti uji MAT-131A — nama panjang/ligatur
  tersimpan utuh dengan `slug NULL`; dua nama mirip-slug menjadi dua baris sah.

### 6.4 Verifikasi (bukti)
- `pnpm test`: **93 file / 1010 test lulus**.
- `pnpm test:db`: seluruh suite integrasi lulus (lihat komentar issue MAT-134).
- `pnpm db:verify`: skema OK, 0 drift (26 tabel, 24 trigger, 3 CHECK, 1 HNSW).
- DB dev: `information_schema` → `topics.slug` & `tags.slug` `is_nullable = YES`;
  `SELECT count(*) FROM topics` = **174**, `questions` = **11.889** (utuh, 174 slug legacy
  dipertahankan); probe `INSERT` dua topik tanpa slug dalam transaksi → 2 baris `NULL` OK (rollback).
- `drizzle-kit check`: lolos; `npx tsc` untuk `src/lib/**` bersih.

### 6.5 Catatan untuk Ichsan (frontend)
`TagRow.slug` dan `QuestionTopicView.slug` kini `string | null`. Komponen yang masih
merender `slug` (`labels-view.tsx` badge slug) perlu dibersihkan di subtask Ichsan;
tautan/filter wajib memakai `id`.
