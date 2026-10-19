# Audit Konsistensi Dokumen & ADR vs Kode — MathBank

> **Tanggal audit:** 18 Oktober 2026
> **Sifat:** *read-only audit* — kode aplikasi **tidak diubah**; satu-satunya berkas baru = dokumen ini + satu baris registrasi di `docs/PETA-DOKUMEN.md` (#31).
> **Metode:** `find docs -name '*.md'` vs registrasi `docs/PETA-DOKUMEN.md`; pembacaan `docs/ADR/*.md` lalu verifikasi ke `src/lib/db/schema/*.ts`, `src/lib/services/*`, `src/app/api/**/route.ts`; `pnpm db:verify` pada DB utama **dan** DB uji; kueri baca langsung ke DB (`psql`) untuk jumlah baris.
> **Status dokumen:** ⚠️ — 5 dari 7 klaim yang diperiksa **drift**; rincian & bukti di bawah.

---

## 1. Ringkasan

| # | Area | Hasil |
|---|---|---|
| 1 | Registrasi dokumen (#31) | 🔴 **~120 dari 176 berkas `docs/**/*.md` tak terdaftar**; klaim di `PETA-DOKUMEN.md` bahwa semua dokumen didaftarkan **tidak benar** |
| 2 | ADR vs kode | 🟠 **3 drift** (ADR-0020 `bundles.event_id`, ADR-0021 `print_config`, ADR-0009 izin `own`); ADR-0019/0022/0018/0017/0015/0014/0012 **sesuai kode** (berstatus usulan atau sudah diterapkan) |
| 3 | `docs/audit/` §Catatan Verifikasi (#44) | ✅ patuh untuk `docs/audit/*.md`; ⚠️ laporan auditor di `MathBankAuditor/reports/2026-10-17/` **sebagian tak ber-§** dan **belum terdaftar** |
| 4 | `AGENTS.md` §8 | 🔴 **drift berat** — 28→**26** tabel, 0→**11.867** soal, 5→**11** event, ADR-0016 masih disebut "berlaku", utang `warnings` & `curriculum.yaml` sudah selesai |
| 5 | `CLAUDE.md` vs `AGENTS.md` vs `CONSTRAINTS.md` | ✅ tidak bertentangan (CLAUDE.md hanya `@AGENTS.md`); 🟡 `AGENTS.md` mewarisi drift §8 + satu pernyataan berlebihan (lihat §6) |

---

## 2. Tabel Temuan Utama

Bentuk kolom sesuai acceptance: **klaim dokumen | lokasi | realita kode (path:line) | drift? | rekomendasi**.

| # | Klaim dokumen | Lokasi | Realita kode (path:line) | Drift? | Rekomendasi |
|---|---|---|---|---|---|
| **D-01** | "Satu-satunya acuan kerja sah … tercantum pada Bagian 2 … serta berkas aturan proyek" — implisit: **semua** dokumen aktif terdaftar (#31) | `docs/PETA-DOKUMEN.md:23-24, 47-66` | 176 berkas `docs/**/*.md`; hanya **±55** yang dirujuk eksplisit di PETA (§4 merujuk pola folder `docs/plans/` & `docs/ADR/`, bukan per-berkas). **Tak terdaftar sama sekali:** `docs/A11Y.md`, `docs/pedagogy/AUDIT-DISTRACTOR-RATIONALE.md`, `docs/redesign-ui/*.md` (2), `docs/superpowers/**/*.md` (2), 15 berkas `docs/plans/*` lain, ±120 berkas `docs/archive/**` | 🔴 **YA** | Lihat §3 (daftar per kelompok). Putuskan kebijakan: (a) daftar **per folder** untuk `archive/` (alasan: cold-storage), lalu (b) daftar per-berkas untuk `docs/*.md` aktif + `plans/`, `pedagogy/`, `redesign-ui/`, `superpowers/`. Update skrip pemeriksa agar `#31` bisa diaudit mekanis. |
| **D-02** | `#31` "Setiap dokumen **wajib** terdaftar … Tak ada dokumen berstatus implisit" | `CONSTRAINTS.md:61` | Sama dengan D-01 — tidak ada skrip/gerbang yang menegakkan; `docs/plans/2026-10-04-perbaikan-temuan-audit.md` dan 17 berkas `docs/plans/*` lain tak berstatus | 🔴 **YA** (aturan tak dapat ditegakkan karena tak ada pemeriksa) | Tambah skrip (mis. `scripts/check-docs-index.mjs`) ke `pnpm check` yang membandingkan `find docs -name '*.md'` vs indeks. |
| **D-03** | ADR-0020 "Hapus `bundles.event_id` … **dihapus secara permanen** dari skema Drizzle" — status **"Diusulkan (v2.0 Fase 1)"** di berkas, **tetapi** dokumen audit/registrasi memakai bahasa seolah sudah final | `docs/ADR/0020-…md:3, 51-53`; dikutip sebagai "resolusi utang teknis" di `MathBankAuditor/reports/2026-10-17/audit-ce-doc-review.md:124-126` | `bundles.eventId` **masih ada**: `src/lib/db/schema/bundle.ts:32`, indeks `:51`, relasi `:82`; kontrak `src/lib/contracts/bundle.ts:30`; tulis `src/lib/services/bundle-write.ts:59,100`; baca `src/lib/services/bundle-shared.ts:140`. DB: **81 bundle** ber-`event_id` terisi | 🟠 **YA (status vs praktik)** — ADR berstatus usulan, jadi belum "drift skema", **tetapi** utang `docs/plans/2026-10-06-utang-teknis-bundles-event-id.md` masih TERBUKA dan tak tercantum di `AGENTS.md` §8 "Utang terbuka" | Catat di `AGENTS.md` §8 utang sebagai "utang terbuka"; jangan rujuk ADR-0020 sebagai "selesai". `docs/DATABASE.md:16` & `docs/ADR/0009:14` ("`eventId` untuk `source`") juga musti diselaraskan bila kolom di-drop. |
| **D-04** | ADR-0021 mengusulkan kolom `bundles.print_config jsonb` + engine CSS Paged Media 2-kolom | `docs/ADR/0021-…md:3, 22-49` | **Tidak ada** `print_config`/`printConfig` di `src/**` maupun `drizzle/**` (pencarian 0 hasil). Rute cetak `src/app/api/bundles/[id]/export/moodle` & halaman cetak masih memakai kolom lama (`instructions`, `duration_minutes`, `grade`) — `src/lib/db/schema/bundle.ts:36-38` | ❌ Tidak — status ADR **"Diusulkan"** sudah benar | Tidak perlu tindakan skema. Pastikan `docs/RENCANA-MATHBANK-V2.md:139` & `docs/RENCANA-ADOPSI-ARSITEKTUR-MATHCORE-SOAL.md:152-154` tidak dibaca sebagai "sudah ada" (keduanya sudah berlabel rencana ✅). |
| **D-05** | ADR-0019 mengusulkan `question_embeddings` 1:1 & drop `questions.embedding` | `docs/ADR/0019-…md:3, 27-60` | `questions.embedding` **masih inline**: `src/lib/db/schema/question.ts:82-84` (`embedding`, `embedding_content_hash`, `embedding_model_name`); HNSW tunggal di `drizzle/manual/00-extensions.sql`/`db_safety.sql`; DB: `count(embedding is not null)=0` | ❌ Tidak — status **"Diusulkan"** benar; belum ada vektor terisi jadi migrasi tak mendesak | Tidak ada aksi; pertahankan status Diusulkan. Bila dieksekusi, ingat `db:verify` `hnswIndexes ≥ 1` (`src/lib/db/invariants.ts`) harus ikut disesuaikan. |
| **D-06** | ADR-0022 "Larangan mutlak Server Actions untuk mutasi" & "semua endpoint mutasi wajib `wrapRoute()`" | `docs/ADR/0022-…md:3, 30-55` | **0** direktif `"use server"` di `src/**` ✅ (aturan dipatuhi). `wrapRoute` dipakai **40 dari 51** route; 11 di luar: `auth/[...all]`, `health`, `ready`, `metrics`, `mcp`, `dev/demo-status`, `dev/quick-login`, `bundles/[id]/export/moodle`, + **3 stub `collections/*` (410 Gone)** | ⚠️ Sebagian — status ADR "Diusulkan (Fase 3)" tapi larangan SA & envelope **sudah** dipatuhi; pengecualian `wrapRoute` didokumentasikan di `MathBankAuditor/reports/2026-10-17/audit-nextjs16-skills.md:173-180` | Adrikan ADR-0022 "Diterapkan (larangan SA)" atau pecah: pipa wrapRoute bagian infrastruktur sudah ada → ubah status menjadi **Diterima** untuk butir 1–2, butir "v1 → v2 refactor lengkap" tetap usulan. Tidak ada drift kode. |
| **D-07** | ADR-0018 "Endpoint `/api/collections/*` menjadi stub `410 Gone`; UI koleksi dihapus" | `docs/ADR/0018-…md:30-33` | ✅ Stub 410: `src/app/api/collections/route.ts:15`, `…/[id]/route.ts:14`, `…/[id]/items/route.ts:15`. UI: `src/app/(app)/collections/page.tsx` & `[id]/page.tsx` **ada tapi** hanya `redirect("/bundles")` (MAT-40). `src/lib/contracts/collection.ts` & `src/lib/db/schema/collection.ts` = stub kosong berkomentar | ❌ Tidak | Tidak ada aksi. |
| **D-08** | AGENTS.md §8 **"ADR berlaku"** hanya menyebut **0009, 0010, 0011, 0014, 0015, 0016** — dan 0016 **collections** | `AGENTS.md:114` | ADR-0016 berstatus 🔴 **DIGANTIKAN** oleh ADR-0018 (`docs/ADR/0016-…md:1-3`). ADR-0017 (buang `exercise`), ADR-0018 (`origin`), ADR-0022 (SA ban) **berlaku** tapi tak disebut. `_enums.ts:62-86` membuktikan `bundle_type`=2 nilai & `origin` ada | 🔴 **YA** (AGENTS.md) | Ganti daftar: **0009, 0010, 0011, 0014, 0015, 0017, 0018, 0022**; hapus 0016; tambahkan catatan 0019/0020/0021 = usulan. |
| **D-09** | `docs/DATABASE.md` mencatat `questions`: `code`, `status_version`, `topic_id`, `grade_id`, `difficulty: enum(easy/medium/hard)`, `cognitive_level: enum(C1–C6)` | `docs/DATABASE.md:41-50`, §3 CAS `:70-82` | Skema nyata: `difficulty` = **smallint 1–5** (`src/lib/db/schema/question.ts:44`), tak ada `code`/`topic_id`/`grade_id`/`status_version`; relasi topik via `question_topics` (`taxonomy.ts`); `cognitive_level` = enum `remember|understand|apply|analyze|evaluate|create` (`_enums.ts:29-36`); CAS memakai `WHERE status = from` (`src/lib/services/question-status.ts:32`). **Sudah ditemukan** sebagai `DOCS-REQ-05` di `MathBankAuditor/reports/17.10.2026/audit-ce-doc-review.md:109-115` | 🔴 **YA** — **temuan lama, belum diperbaiki** (dilaporkan 17 Okt, masih ada 18 Okt) | Selaraskan `docs/DATABASE.md` dengan `_enums.ts` & `question.ts`; atau tandai dokumen "usang — lihat DATABASE nyata", lalu perbarui. Jangan menyajikan sebagai temuan baru. |
| **D-10** | AGENTS.md §8 **"28 tabel"** | `AGENTS.md:111` | **26 tabel** di DB utama & DB uji (`pnpm db:verify` → `✓ tables: 26`); 26 `pgTable` di `src/lib/db/schema/*`; `EXPECTED_INVARIANTS.tables=26` (`src/lib/db/invariants.ts:17`), `scripts/db-verify.ts:19` | 🔴 **YA** | Ubah ke **26 tabel · 24 trigger**. |
| **D-11** | AGENTS.md §8 **"0 soal — kanvas kosong (177 soal mentah lama sudah dibuang)"** | `AGENTS.md:113` | DB utama: **11.867 soal** (`questions` = 11.867; `deleted_at IS NULL` sama). Riwayat ingest mathcyber+defantri → lihat `CHANGELOG.md` ("7.623 soal" mathcyber, "9.548 soal defantri") | 🔴 **YA** — klaim paling berbahaya: agen bisa memutuskan "data kosong, aman hapus" | Perbarui angka + tanggal; tambahkan perintah cek (`psql … select count(*) from questions`) sebagai sumber kebenaran, jangan angka statis. |
| **D-12** | AGENTS.md §8 "**5 events**, **6 sumber**, **174 topik**" | `AGENTS.md:112` | DB: **11 events**, **5 sources**, **174 topics** | 🔴 **YA** (events: 5→11; sources: 6→5) | Perbarui. Seed `scripts/seed-events.ts` + `CHANGELOG.md` ("katalog +Ujian Nasional … → 11 event") konsisten dengan 11. |
| **D-13** | AGENTS.md §8 "Utang terbuka: … `warnings`→`isFlagged` tak tersambung" | `AGENTS.md:115` | **Sudah tersambung**: `src/lib/ingest/commit.ts:285-286` (`isFlagged: it.warnings.length > 0`), dikunci tes `src/lib/ingest/ingest.db.test.ts:209-239` | 🔴 **YA**— klaim "utang" sudah selesai | Hapus dari utang terbuka. |
| **D-14** | AGENTS.md §8 "Utang terbuka: `curriculum.yaml` di luar repo" | `AGENTS.md:115` | `config/curriculum.yaml` **sudah ada di repo**; `scripts/seed-taxonomy.ts:1-14` membacanya (`CURRICULUM_YAML ?? "config/curriculum.yaml"`) | 🔴 **YA** — sudah selesai | Hapus dari utang terbuka. |
| **D-15** | AGENTS.md §8 "Utang terbuka: **UI koleksi**" | `AGENTS.md:115` | `/collections` = redirect 302 ke `/bundles` (`src/app/(app)/collections/page.tsx`); menu di UI sudah `bundles` — ADR-0018 menyatakan UI koleksi dihapus | 🟡 **YA** — utang basi (bukan bug) | Ganti dengan utang nyata: "hapus folder stub `collections` & 3 route 410 bila klien eksternal nol" (keputusan produk). |
| **D-16** | ADR-0009 menyatakan "guru bisa menyentuh bundle guru lain … izin `bundle:manage` broadcast" (cacat) | `docs/ADR/0009-…md` §Keputusan poin 2 | **Sudah diperbaiki**: `bundle:manage: teacher: "own"` / `reviewer: "own"` (`src/lib/auth/permissions.ts:125-129`); ditulis `assertBundleWrite(existing, actor)` di service (`src/lib/services/bundle-write.ts:90`) sesuai #35 | 🟡 **Ya** — dokumen tak menandai "poin 2 selesai" | Tambahkan catatan di ADR-0009: "poin 2 selesai — izin `own` di `permissions.ts:125-129`". |
| **D-17** | ADR-0020 mengklaim event = **milik tunggal** `questions` dan `bundles.event_id` "keliru" | `docs/ADR/0020-…md:30-52` | Benar sebagai keputusan, **tetapi** kode & DB masih dual-source (D-03). Selain itu `docs/DATABASE.md:16` menyebut `bundles` discriminator `bundle_type`+`origin` (✅ sesuai kode) tanpa menyebut `event_id` yang **masih ada** | 🟡 **Ya** — DATABASE.md tidak lengkap, bukan salah | Sebutkan `event_id` sebagai sisa (utang) di DATABASE.md §2.2 agar pembaca tidak bingung |
| **D-18** | ADR-0017 `bundle_type` = `source`\|`exam`, `exercise` dibuang | `docs/ADR/0017-…md:1-3` | `src/lib/db/schema/_enums.ts:60-64` = 2 nilai; migrasi `drizzle/0012_salty_domino.sql` persis `('source','exam')`; enum `bundle_item_role` tetap ada | ❌ Tidak | — |
| **D-19** | ADR-0015 `source_kind` = book\|website\|school, `sources` 12 kolom | `docs/ADR/0015-…md:1-3` | `src/lib/db/schema/_enums.ts:49-55` 3 nilai; `source.ts` memuat publisher/author/book_year/city | ❌ Tidak | — |
| **D-20** | ADR-0014 `questions.source_id` dihapus, `bundles.url`+`grade` ditambah | `docs/ADR/0014-…md:1-3` | Tidak ada `source_id` di `questions`; `bundles.url:33` & `bundles.grade:35` | ❌ Tidak | — |
| **D-21** | ADR-0012 `question_sources` dihapus, `content_hash` unique partial | `docs/ADR/0012-…md:1-3` | Tidak ada `question_sources`; `uq_questions_content_hash` (`question.ts:110-112`) | ❌ Tidak | — |
| **D-22** | `MathBankAuditor/reports/2026-10-17/audit-nextjs16-skills.md` menyebut `(app)/collections/[id]/page.tsx` sebagai halaman nyata | laporan `:35` | Halaman itu **redirect** ke `/bundles/[id]` (stub MAT-40) | 🟡 Ya (laporan auditor, bukan docs/) | Bukan `docs/`; cukup dicatat. |
| **D-23** | Auditor laporan `2026-10-17` wajib §Catatan Verifikasi (#44 hanya mengikat `docs/audit/`) | `CONSTRAINTS.md:74` | `audit-security-and-hardening.md` ✅ punya `:537`; **`AUDIT-DRIZZLE-ORM.md`** ❌ (hanya ada §6.2/6.3 "Verifikasi parameterisasi/Typecheck", bukan §Catatan Verifikasi); **`audit-nextjs16-skills.md`** ❌ (hanya §5 & Lampiran mentah) | 🟡 Ya (kebijakan) | Tambahkan §Catatan Verifikasi (verifikator/metode/koreksi) ke dua laporan itu. |
| **D-24** | `MathBankAuditor/reports/2026-10-17/AUDIT-DRIZZLE-ORM.md` dan `…/audit-nextjs16-skills.md` = laporan aktif | `docs/PETA-DOKUMEN.md:56-57` (hanya 2 berkas lain didaftar) | 2 laporan di atas **tidak** terdaftar; folder `MathBankAuditor/reports/deepseek-flash*`, `17.10.2026` (35 laporan) juga tidak; hanya 2 dari **±140** laporan didaftar | 🔴 Ya | Daftar per folder + tandai yang digantikan. |

---

## 3. Registrasi Dokumen (#31) — Rincian

Dasar: `find docs -name '*.md'` = **176 berkas**.

| Kelompok | Jumlah | Terdaftar eksplisit di PETA | Catatan |
|---|---:|---:|---|
| `docs/*.md` (akar) | 36 | ~13 (`ARCHITECTURE`, `DATABASE`, `DESIGN_SYSTEM`, `PEDAGOGY`, `PETA-DOKUMEN`, `PRD`, `RUNBOOK`, `KEAMANAN`, 2× `RENCANA-*`) | Belum: `A11Y`, `ARSITEKTUR-*` (3), `ATURAN-CLEANING-KORPUS`, `AXIOM-VS-*`, `BACKUP-RECOVERY`, `CETAK-BIRU`, `DESAIN-PER-LAPISAN`, `DESIGN-QUESTION-VIEW-MODES`, `DESIGN-THEME-FRAMEWORK`, `GOVERNANCE`, `KAMUS-DATA`, `KEPATUHAN-PRIVASI`, `KONTRAK-API`, `MIGRASI-ZERO-DOWNTIME`, `MILESTONE`, `OBSERVABILITAS`, `PERFORMA`, `RIWAYAT-KEPUTUSAN`, `SKEMA-DB-DETAIL`, `SLA-SLO`, `STRATEGI-INGEST`, `STRATEGI-TES`, `THEME-FRAMEWORK-GUIDE`, `VISION` |
| `docs/ADR/*.md` | 24 | 0 (dirujuk sebagai **folder** `docs/ADR/`, `PETA:53`) | Kebijakan "per-folder" tidak tertulis; `#31` menuntut per-berkas. |
| `docs/audit/` | 1 | 1 ✅ | patuh |
| `docs/plans/` | 24 | 9 (`2026-10-06-benar-salah-qn-*`, `-gerbang-mapel-*`, `-perbaikan-jalur-pg-*`, `-temuan-event-dan-wacana-*`, `-temuan-variasi-layout-*`, `-utang-teknis-bundles-event-id`, `-verifikasi-ingest-*`, `2026-10-07-catatan-remediasi-review-v2`, `2026-10-16-evaluasi-arsitektur-*`) | **15 belum**: `2026-10-04-perbaikan-temuan-audit`, `2026-10-05-perbaikan-catatan-audit`, `2026-10-06-ingest-{m4thlab,mandiri,mathcyber}`, `-metodologi-cek-katex`, `-spesifikasi-parser-defantri`, `-temuan-{dolar-bertumpuk,event-tidak-terisi,katex-bersarang,kunci-mathcyber,mcma-belum-didukung,pembahasan-defantri}`, `2026-10-08-rencana-konsolidasi-bank-soal-ce`, `perbaikan-manual-mathcyber` |
| `docs/pedagogy/`, `docs/redesign-ui/`, `docs/superpowers/` | 5 | 0 | belum |
| `docs/archive/**` | 85 | 0 (hanya 4 subfolder dijelaskan pola) | Bisa dibenarkan sebagai cold-storage, **tapi** `#31` literal menolak "implisit" |

**Kesimpulan D-01:** klaim "peta kanonikal" benar untuk **derajat**, salah untuk **cakupan**. Butuh kebijakan eksplisit (per-folder untuk `archive/`) + penegakan mekanis.

---

## 4. ADR vs Kode — Pemetaan Status

| ADR | Status di berkas | Bukti kode | Konsisten? |
|---|---|---|---|
| 0009 (satu tabel bundles) | ✅ Berlaku | `bundles` + `bundle_items` ada (`bundle.ts:14,62`) | ✅ (poin #2 selesai — D-16) |
| 0010 (event = jenis, tahun di soal) | ✅ Diterima | `questions.event_id/event_year/…` (`question.ts:73-78`) | ✅ |
| 0011 (stimulus di `questions`) | ✅ Diterima | `parentId` RESTRICT + trigger `trg_questions_stimulus_depth` (`db_safety.sql:87`) | ✅ |
| 0012 (`question_sources`) | ⚪ Digantikan sebagian | tabel tidak ada; `content_hash` unique partial (`question.ts:110`) | ✅ |
| 0013/0016 (collections) | 🔴 Dibatalkan/Digantikan | `schema/collection.ts` stub kosong; migrasi `0014` drop | ✅ |
| 0014 (sumber di bundle) | ✅ Diterapkan | tak ada `questions.source_id`; `bundles.url/grade` | ✅ |
| 0015 (books/institutions → sources) | ✅ Diterapkan | enum 3 nilai, kolom per-kind | ✅ |
| 0017 (buang `exercise`) | ✅ Diterapkan | migrasi `0012`; `_enums.ts:60-64` | ✅ |
| 0018 (drop collections + `origin`) | ✅ Diterapkan | migrasi `0014`; `bundle.ts:22` | ✅ |
| 0019 (`question_embeddings`) | 🔵 Diusulkan | `questions.embedding` inline (`question.ts:82`) | ✅ status jujur |
| 0020 (hapus `bundles.event_id`) | 🔵 Diusulkan | `bundles.event_id` masih ada (`bundle.ts:32`); 81 baris terisi | ✅ status jujur, **tapi** utang tak tercatat di AGENTS §8 |
| 0021 (`print_config`) | 🔵 Diusulkan | tidak ada di kode | ✅ status jujur |
| 0022 (`wrapRoute` + ban SA) | 🔵 Diusulkan | `"use server"` = 0; `wrapRoute` 40/51 route | ⚠️ status bisa diekskalasi "Diterima" untuk ban SA |

---

## 5. `docs/audit/` — §Catatan Verifikasi (#44)

| Berkas | §Catatan Verifikasi | Status |
|---|---|---|
| `docs/audit/audit-performance-optimization.md` | ✅ `## Lampiran 8 — Catatan Verifikasi (CONSTRAINTS #44)` (`:557-577`) berisi verifikator, metode, yang terverifikasi, koreksi, belum diverifikasi | **Patuh** ✅ |
| `docs/audit/2026-10-18-konsistensi-dokumen-adr-vs-kode.md` (dokumen ini) | ✅ §7 | Patuh |
| `MathBankAuditor/reports/2026-10-17/audit-security-and-hardening.md` | ✅ `## §Catatan Verifikasi` (`:537`) | Patuh |
| `MathBankAuditor/reports/2026-10-17/AUDIT-DRIZZLE-ORM.md` | ❌ | **Tambah §Catatan Verifikasi** |
| `MathBankAuditor/reports/2026-10-17/audit-nextjs16-skills.md` | ❌ | **Tambah §Catatan Verifikasi** |
| `MathBankAuditor/reports/17.10.2026/*` (35 laporan) | Bervariasi (mis. `audit-performance-optimization.md:372` ✅, `audit-ce-doc-review.md:183` ✅) | Digantikan oleh `2026-10-17/` untuk 2 laporan; sisanya belum diaudit — rekomendasi: kebijakan #44 diperluas ke seluruh `MathBankAuditor/reports/` aktif |

---

## 6. `CLAUDE.md` / `AGENTS.md` vs `CONSTRAINTS.md`

| # | Pemeriksaan | Hasil |
|---|---|---|
| 6.1 | `CLAUDE.md` isi | Hanya `@AGENTS.md` (1 baris) → **tidak mungkin** bertentangan; semua instruksi diwarisi dari AGENTS. ✅ |
| 6.2 | AGENTS §0 "**46** batas mutu" vs `CONSTRAINTS.md` | CONSTRAINTS punya **46** bernomor (1–46). ✅ |
| 6.3 | AGENTS §5 "Audit di `docs/audit/` wajib §Catatan Verifikasi (#44)" vs `CONSTRAINTS.md:74` | ✅ konsisten |
| 6.4 | AGENTS §5 "Dokumen baru → daftarkan di PETA (#31)" vs `CONSTRAINTS.md:61` | ✅ konsisten (aturan sama; lihat D-01) |
| 6.5 | AGENTS §3 "Update `invariants.ts` **dan** `scripts/db-verify.ts` … `db_safety.sql`" vs `#24/#26` | ✅ konsisten; keduanya = 26/24 (terverifikasi `pnpm db:verify`) |
| 6.6 | AGENTS §6 "Dilarang `useMemo`/`useCallback` (kecuali `components/ui/**`)" vs `#6` | ✅ konsisten |
| 6.7 | AGENTS §6 "`assertCan` tanpa `ownerId` selalu menolak — **tegakkan di service**" vs `#35` | ✅ konsisten |
| 6.8 | AGENTS §0 prioritas baca: "`docs/ADR/` … **mengubah skema**" — tapi tidak menyebut bahwa **0019–0022 = usulan** | 🟡 **Ambiguitas**: agen bisa mengira ADR-0020/0021 sudah keputusan berlaku. Rekomendasi: tambahkan di §0 "(perhatikan status ADR — 0019–0022 masih **Diusulkan**)". |
| 6.9 | AGENTS §8 vs `CONSTRAINTS` | **Tidak** konflik langsung (CONSTRAINTS tidak menyebut angka 28/0 soal), tetapi §8 **drift** ke realita (D-10…D-15) — lihat tabel §2. |

---

## 7. Catatan Verifikasi (CONSTRAINTS #44)

- **Verifikator:** auditor konsistensi dokumen (statis), 2026-10-18.
- **Metode:**
  1. `find docs -name '*.md'` (176) vs `grep` rujukan eksplisit di `docs/PETA-DOKUMEN.md`.
  2. Pembacaan 22 ADR + `README.md`; verifikasi ke `src/lib/db/schema/*.ts`, `src/lib/services/{bundle-write,bundle-shared,question-status}.ts`, `src/lib/contracts/bundle.ts`, `src/app/api/**/route.ts`, `drizzle/*.sql`, `drizzle/manual/db_safety.sql`.
  3. `pnpm db:verify` → DB utama ✅ (26 tabel, 24 trigger, 3 CHECK, 1 HNSW, `uuidv7`). DB uji: dijalankan dengan `DATABASE_URL=$TEST_DATABASE_URL` → ✅ 26/24. **Catatan:** pola `DATABASE_URL="$TEST_DATABASE_URL"` (seperti di AGENTS §3) **gagal** di shell non-interaktif (`✗ DATABASE_URL tidak diset`) — perlu nilai URL literal. Ini temuan operasional, bukan drift skema.
  4. Kueri baca DB (`psql`): `questions`=11.867, `events`=11, `sources`=5, `topics`=174, `bundles`=579, `bundles.event_id not null`=81, `questions.embedding not null`=0.
  5. `grep '"use server"'` → 0; `wrapRoute` di 40/51 route; `print_config` → 0.
- **Yang terverifikasi benar:**
  - ✅ ADR-0014, 0015, 0017, 0018, 0012, 0013, 0016 **sesuai kode** (skema & migrasi).
  - ✅ Stub 410 `/api/collections/*` + redirect UI `/collections` sesuai ADR-0018/MAT-40.
  - ✅ `docs/audit/*.md` patuh #44.
  - ✅ `CLAUDE.md` tidak bertentangan dengan `AGENTS.md`/`CONSTRAINTS.md` (file hanya `@AGENTS.md`).
  - ✅ `db:verify` hijau di DB utama & DB uji.
- **Koreksi:** tidak ada klaim lama yang perlu dicabut; **namun** D-09 sudah pernah dilaporkan sebagai `DOCS-REQ-05` (17 Okt) dan **belum diperbaiki** — disajikan sebagai konfirmasi berulang, bukan temuan baru.
- **Belum diverifikasi (jujur):**
  - `pnpm typecheck`/`lint`/`test`/`build` **tidak** dijalankan (audit statis dokumentasi).
  - Estimasi "±55 terdaftar" dihitung dari rujukan eksplisit per-berkas; PETA merujuk beberapa kelompok sebagai folder (`archive/`, `ADR/`) — tidak dihitung sebagai terdaftar per-berkas.
  - Laporan `MathBankAuditor/reports/17.10.2026/*` (35 berkas) tidak diperiksa satu per satu untuk #44.
- **Kode aplikasi:** tidak diubah. Berkas baru: dokumen ini + satu baris registrasi di `docs/PETA-DOKUMEN.md`.

---

## 8. Rekomendasi Berurutan (prioritas)

| # | Prioritas | Aksi | Pemilik |
|---|---|---|---|
| 1 | 🔴 P0 | Perbarui `AGENTS.md` §8: **26 tabel · 24 trigger · 11.867 soal · 11 events · 5 sources · 174 topik**; ADR berlaku = **0009, 0010, 0011, 0014, 0015, 0017, 0018, 0022**; hapus utang `warnings` & `curriculum.yaml` & "UI koleksi" yang sudah selesai; **tambah** utang `bundles.event_id` (ADR-0020). | Dokumen |
| 2 | 🔴 P0 | `docs/DATABASE.md`: selaraskan `questions` (smallint 1–5, tanpa `status_version`/`code`/`topic_id`/`grade_id`, enum Bloom 6 nilai), CAS `WHERE status=from`, dan sisa `bundles.event_id`. | Dokumen |
| 3 | 🟠 P1 | `docs/PETA-DOKUMEN.md`: daftar per-berkas untuk `docs/*.md` aktif, `plans/`, `pedagogy/`, `redesign-ui/`, `superpowers/`; per-folder (dengan alasan cold-storage) untuk `archive/`; tambah `MathBankAuditor/reports/2026-10-17/AUDIT-DRIZZLE-ORM.md` & `audit-nextjs16-skills.md`. | Dokumen |
| 4 | 🟠 P1 | Skrip `check-docs-index.mjs` di `pnpm check` agar #31 dapat diversifikasi mekanis. | Kode/CI |
| 5 | 🟡 P2 | Tambah §Catatan Verifikasi ke `AUDIT-DRIZZLE-ORM.md` & `audit-nextjs16-skills.md`. | Auditor |
| 6 | 🟡 P2 | ADR-0009: catat poin #2 (`bundle:manage` own) **selesai**. ADR-0022: eskalasi status butir 1–2 → **Diterima**. | Dokumen |
| 7 | 🟡 P2 | AGENTS §0: tandai ADR-0019–0022 berstatus usulan agar tidak dibaca sebagai aturan berlaku. | Dokumen |
| 8 | 🟢 P3 | Catat di AGENTS §3 bahwa verifikasi DB uji butuh **URL literal** (variabel shell tak terekspansi). | Dokumen |

---

*Laporan ini read-only. Setiap klaim punya `path:line` dan dapat direproduksi dengan `grep`/`pnpm db:verify`/`psql` di atas.*
