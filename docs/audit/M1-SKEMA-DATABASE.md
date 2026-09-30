# AUDIT MILESTONE 1 — SKEMA DATABASE (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED** (Lulus Verifikasi dengan 1 Catatan Refactoring Fondasi) — ✅ **DIVERIFIKASI ULANG 2026-09-30** (lihat §Catatan Verifikasi)  
**Target:** Skema Database v2 (Layer L7) Drizzle ORM — 27 Tabel, 14 Enum, Indexing GIN/HNSW, Triggers, Invarians, dan PG 18 `uuidv7()`.

---

## 1. Ringkasan & Ruang Lingkup Milestone 1

Milestone 1 bertujuan membangun skema basis data utama MathBank yang tangguh, terstruktur, dan merepresentasikan kebutuhan bank soal matematika SMP–SMA hingga tingkat lanjut.

### Matriks Target vs Realisasi M1

| Item Verifikasi | Target Perencanaan | Realisasi Kode & DB | Status |
| :--- | :--- | :--- | :---: |
| **Jumlah Tabel** | 27 Tabel (21 Domain + 6 Auth) | **27 Tabel** (`questions`, `options`, `topics`, `users`, dll) | ✅ Lulus |
| **Enum Tertutup** | Enum lengkap (11 tipe soal, 4 status FSM, dll) | **14 Enum** (`question_type`, `question_status`, dll) | ✅ Lulus |
| **Primary Key (PK)** | `uuidv7()` (PG 18 / sequential B-tree friendly) | `uuidPk()` (`id uuid PRIMARY KEY DEFAULT uuidv7()`) | ✅ Lulus |
| **Index Database** | B-tree FK, GIN Trigram, HNSW Vector | **81 Index** (Termasuk `idx_questions_content_trgm` & HNSW) | ✅ Lulus |
| **Foreign Keys (FK)** | Invariant RESTRICT pada relasi krusial | **23 FK Constraint** (RESTRICT untuk stimulus beranak) | ✅ Lulus |
| **Check Constraints** | Ditegakkan di DB Engine | **2 Check** (`chk_questions_difficulty` & `chk_topics_level`) | ✅ Lulus |
| **Database Triggers** | `updated_at` otomatis & `usage_count` | **25+ Triggers** di-chain via `pnpm db:safety` | ✅ Lulus |
| **Vector Embedding** | pgvector 1024-dim (BGE-M3 model) | `vector1024` (`vector(1024)` pada `questions.embedding`) | ✅ Lulus |

---

## 2. Temuan Teknis & Mitigasi

### 🔴 Temuan 1: Penanganan Ekstensi Database pada DB Kosong (T-M1-1)
- **Gejala:** Pada lingkungan DB baru, perintah `drizzle-kit migrate` sempat gagal jika ekstensi PostgreSQL (`vector`, `pg_trgm`, `pgcrypto`) belum diaktifkan oleh Superuser.
- **Mitigasi:** Dibuat wrapper script `scripts/db-ensure-extensions.ts` dan pra-migrasi `drizzle/manual/00-extensions.sql` yang secara otomatis mendeteksi dan memberi instruksi jelas jika Superuser privilege diperlukan.

### 🟠 Temuan 2: Rantai Invariansi `pnpm db:migrate` (T-M1-3)
- **Gejala:** Invariansi bisnis kritis (25 trigger, HNSW index, CHECK constraints) berada di file manual `drizzle/manual/db_safety.sql`.
- **Mitigasi:** Eksekusi `pnpm db:migrate` di-chaining secara ketat: `db-ensure-extensions` ➔ `drizzle-kit migrate` ➔ `db-safety`.

### 🟢 Temuan 3: Flat Stimulus Architecture
- **Keputusan:** Tabel `passages` dibatalkan secara sadar. Stimulus dikelola sebagai item soal biasa (`question_type = 'stimulus'`) dengan kedalaman hierarki `parent_id` maksimal 1 level yang dikunci oleh DB Trigger.

---

## 3. Hasil Pengujian Invariansi Perilaku DB

1. **Difficulty Constraint (1–5):** `INSERT INTO questions` dengan `difficulty = 9` ditolak oleh PostgreSQL (`chk_questions_difficulty`).
2. **Topik Level Constraint (1–3):** `INSERT INTO topics` dengan `level = 4` ditolak oleh PostgreSQL (`chk_topics_level`).
3. **Stimulus Depth Limitation (≤ 1):** Hierarki Induk ➔ Anak ➔ Cucu ditolak oleh Trigger `trg_check_stimulus_depth`.
4. **Anti-Siklus Taksonomi:** Relasi siklik A ➔ B dan B ➔ A pada topik ditolak oleh Trigger `trg_check_topic_cycle`.
5. **FK RESTRICT Stimulus:** Hapus stimulus yang memiliki soal anak ditolak keras oleh DB (`onDelete: "restrict"`).

---

## 4. Rekomendasi Enterprise

1. **Separation of Roles:** Di lingkungan produksi, pisahkan role DB Provisioner (`postgres`) yang memasang ekstensi dari role Aplikasi (`mathbank`) yang beroperasi dengan hak *Least Privilege*.
2. **Runtime Invariance Health Check:** Tambahkan pengecekan keberadaan 25 DB triggers pada startup server / endpoint `/api/health`.
3. **Immutable Audit Log:** Kunci tabel `audit_logs` agar role aplikasi hanya memiliki akses `INSERT` dan `SELECT` (dilarang `UPDATE`/`DELETE`).

---

## 📝 CATATAN VERIFIKASI (2026-09-30)

**Verifikator:** agen pembangun (MathBank) · **Metode:** cek klaim ke skema/migrasi nyata.

**Status: ✅ TERVERIFIKASI.** Skema dari nol (rantai ekstensi→tabel→invarian), PK
`uuidv7()`, 26 trigger, index (termasuk GIN trgm & HNSW), CHECK constraint, dan
kebijakan role non-superuser produksi (`mathbank_app`) — **sesuai** dengan migrasi
nyata. Detail: `docs/VERIFIKASI-AUDIT-M1.md` (bila ada) / `docs/SKEMA-DB-DETAIL.md`.

**Catatan konsistensi:** tidak ada temuan yang memerlukan perbaikan kode pada M1.
