# DATABASE.md — Struktur Basis Data & Kebijakan PostgreSQL MathBank

> **Status:** Kanonikal Hidup (*Living Document*)  
> **Terakhir Diperbarui:** 5 Oktober 2026 (Mandat Dewan Direksi MAT-38)  
> **Pemilik:** Salman (Lead System & Software Architect)  

---

## 1. Ikhtisar & Arsitektur Penyimpanan

Basis data utama MathBank menggunakan **PostgreSQL (v17/v18)** yang dikelola secara deklaratif melalui **Drizzle ORM**.

Prinsip Utama:
1. **Model Relasional Murni**: Integritas referensial ditegakkan melalui *Foreign Keys*, *Unique Constraints*, dan *Check Constraints*.
2. **Koneksi Database Singleton**: Dikelola via lazy pool proxy (`src/lib/db/index.ts`) untuk mencegah kebocoran koneksi (*pool exhaustion*) di Next.js development dan serverless lifecycle.
3. **Penyatuan Wadah Naskah (GABUNG)**: Menggunakan tabel tunggal `bundles` dengan discriminator `bundle_type` (`source` | `exam`) dan `origin` (`ingest` | `manual`), menghapus redundansi skema `collections`.

---

## 2. Peta Tabel Utama

### 2.1. Wadah Naskah Terpadu (`bundles` & `bundle_items`)
- **`bundles`**:
  - `id`: UUID (Primary Key)
  - `title`: text (Judul paket / naskah)
  - `slug`: text (Unique)
  - `bundle_type`: enum `'source'` (Bank Sumber publik) | `'exam'` (Naskah Ujian/Latihan guru)
  - `origin`: enum `'ingest'` (hasil impor korpus) | `'manual'` (dibuat manual)
  - `instructions`: text (Petunjuk pengerjaan ujian)
  - `duration_minutes`: integer (Durasi waktu ujian)
  - `created_by`, `created_at`, `updated_at`
- **`bundle_items`**:
  - `bundle_id`: UUID (FK ➔ `bundles.id`, ON DELETE CASCADE)
  - `question_id`: UUID (FK ➔ `questions.id`, ON DELETE RESTRICT)
  - `display_order`: integer (Nomor urut soal di dalam naskah)
  - `section`: text (Kelompok/bagian soal)
  - Unique Constraint: `(bundle_id, question_id)` & `(bundle_id, display_order)`

### 2.2. Butir Soal & Opsi (`questions` — Single Table + Hybrid JSONB)
- **`questions`**:
  - `id`: UUID (Primary Key)
  - `code`: text (Kode unik butir soal)
  - `content`: text (Teks stimulus dan pertanyaan dalam Markdown + KaTeX)
  - `question_type`: enum (`single_choice`, `multiple_choice`, `complex_multiple_choice`, `essay`, dll.)
  - `status`: enum (`draft`, `review`, `ready`, `archived`)
  - `status_version`: integer (Atomic CAS concurrency guard)
  - `topic_id`: UUID (FK ➔ `topics.id`)
  - `grade_id`: text (FK ➔ `grades.id`)
  - `cognitive_level`: enum (`C1`–`C6`)
  - `difficulty`: enum (`easy`, `medium`, `hard`)
  - `answer_key`: JSONB (Kunci jawaban, pembahasan, dan rubrik analitik esai)
  - Indeks Performa: Indeks eksplisit pada `question_type`, `status`, `topic_id`, dan `grade_id`.
- **Opsi (JSONB, sejak MAT-146)**: tabel anak `question_options` sudah **dihapus**.
  Opsi disimpan di `questions.data_payload.options[]` dengan bentuk
  `{ id, contentMarkdown, distractorRationale? }`, dan kunci benar di
  `questions.answer_key.correctOptionIds` (string atau array). Konsekuensinya
  baca soal = *zero join*. Kontrak lengkap: `src/lib/validations/question-payload.ts`
  (MAT-145) + `enforceQuestionWriteGate` (MAT-146).

### 2.3. Taksonomi & Hierarki (`topics`, `grades`, `curriculums`)
- **`topics`**: Hierarki materi berstruktur pohon (*adjacency list* `parent_id`), dikelola dengan pure validation di L6 (`src/lib/taxonomy/tree.ts`).
- **`grades`**: Jenjang kelas formal (1–12).

### 2.4. Audit & Keamanan (`audit_logs`)
- Pencatatan seluruh perubahan status dan mutasi penting pada entitas `question`, `bundle`, dan `media`.

---

## 3. Atomic CAS Concurrency Guard (FSM State Transitions)

Untuk mencegah *race condition* dan *lost updates* pada pembaruan status soal, MathBank menerapkan pola **Compare-And-Swap (CAS)**:

```sql
UPDATE questions
SET
  status = $newStatus,
  status_version = status_version + 1,
  updated_at = NOW()
WHERE id = $questionId
  AND status_version = $expectedStatusVersion;
```

Apabila baris yang terpengaruh bernilai `0`, service akan memunculkan galat `ConcurrencyConflictError`, memaksa klien memuat ulang state terkini sebelum mencoba kembali.
