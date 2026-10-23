# MAT-125: Pertimbangan Penghapusan Slug (Topics & Tags) — 2 Tahap

**Dari:** Hari Kuswanto (Owner)
**Kepada:** Zaid (CEO)
**Tanggal:** 2026-10-20
**Referensi:** CROSS-AUDIT-ACTION-PLAN-V2.md, RENCANA-MATHBANK-V2.md (Fase 1), ADR-0019

## Latar Belakang

Saat ini kolom `slug` ada di:
- **topics.slug** (varchar(255), NOT NULL, UNIQUE INDEX)
- **tags.slug** (varchar(100), NOT NULL, UNIQUE INDEX)

Slug dipakai di 9+ file:
1. Schema Drizzle (taxonomy.ts)
2. question-read.ts (return slug)
3. topic-service.ts (select + generate slug)
4. bundle-shared.ts (query by slug)
5. bundle-write.ts (generate uniqueSlug)
6. labels-view.tsx (tampilkan slug)
7. topic-tag.tsx (props slug)
8. map-question-topics.ts (190+ rules pakai slug)
9. auto-tag-questions.ts (tag definitions pakai slug)

## Usulan: 2 Tahap

### TAHAP A (Soft Deprecation) — SEKARANG
Tujuan: Kode berhenti bergantung slug, data existing tetap aman.

1. **SCHEMA**: Ubah slug jadi nullable (hapus .notNull()), keep index
2. **MIGRATION**: ALTER COLUMN slug DROP NOT NULL
3. **SERVICE**: Hapus semua penggunaan slug dari:
   - question-read.ts, topic-service.ts, bundle-shared.ts, bundle-write.ts
4. **UI**: Tampilkan name bukan slug (labels-view, topic-tag)
5. **TEST**: Update expect slug -> expect name/id
6. **SCRIPT FARUQ**: TIDAK DIUBAH (slug masih ada untuk matching internal)

### TAHAP B (Hard Removal) — NANTI SETELAH STABIL
1. Drop UNIQUE INDEX (uq_topics_slug, uq_tags_slug)
2. Drop COLUMN (topics.slug, tags.slug)
3. Migrate script Faruq ke ID-based matching

## Risiko

| Aspek | Tahap A | Tahap B |
|-------|---------|---------|
| Data loss | TIDAK (nullable) | YA (irreversible) |
| Rollback | Mudah (tambah .notNull()) | Sulit (restore backup) |
| Break change | Minimal (kode internal saja) | Tinggi (schema berubah) |
| Effort | Sedang (30-60 menit agent) | Besar (planning + testing) |

## Pertimbangan CEO:

1. **Setuju 2 tahap?** (A=soft dulu, B=hard nanti)
2. **Ada endpoint publik yang pakai slug?** Kalau ya, perlu migration path ke ID
3. **Timing Tahap B?** Setelah apa stabil baru boleh drop?
4. **Script Faruq boleh tetap pakai slug internal di Tahap A?**

## Tindakan (jika disetujui):

1. Dispatch task ke Salman (backend) untuk eksekusi Tahap A
2. Scope: schema change + service cleanup + test update
3. Estimasi: 30-60 menit kerja agent
4. Output: progress report di docs/sprint1/SLUG-TAHAP-A.md

---

**Keputusan:** [ SETUJU / REVISI / TOLAK ]
**Alasan:** _______________
**Catatan:** _______________


---

## § Catatan Verifikasi

- **Verifikator:** CodeBuddy (agen), 2026-10-23.
- **Metode:** cek definisi kolom di `src/lib/db/schema/taxonomy.ts`, indeks unik di DB/skema, dan pemakaian `slug` di `src/app/api/**`.
- **Terverifikasi benar:** **Tahap A sudah dieksekusi** — `topics.slug` (`taxonomy.ts:29`) dan `tags.slug` (`taxonomy.ts:97`) sudah nullable (MAT-131A), sementara `uq_topics_slug`/`uq_tags_slug` masih ada; tidak ada route API yang membaca slug topik/tag (satu-satunya `slug` di route adalah metadata sumber pada `POST /api/v1/ingest/upload`).
- **Koreksi:** klaim "dipakai di 9+ file" kurang lengkap — per 2026-10-23 ada **49 berkas** `src/**` yang menyebut `slug` (termasuk test dan UI); daftar 9 berkas inti tetap relevan.
- **Status:** ⏳ Tahap B (drop kolom) belum dijalankan; keputusan CEO belum diisi.
