# AUDIT DATABASE MENYELURUH — MathBank (2026-10-02)

> **Status:** 📊 **audit DB menyeluruh** — dasar keputusan pemilik produk
> **Metode:** mengukur **seluruh** struktur DB (bukan sampel) via `information_schema`,
> `pg_constraint`, `pg_indexes`, `EXPLAIN ANALYZE`, dan **query nyata dari kode**.
> Referensi industri **dibaca**, bukan sekadar dicari.
> **Prinsip:** dinilai dari **bentuk & kesiapan pemakaian**, **bukan** dari tabel
> yang kebetulan sudah terisi.

---

## 0. Skala yang diaudit (bukan sampel)

| Ukuran | Jumlah |
|---|---:|
| Tabel | **28** |
| Kolom | **291** |
| Constraint | **246** |
| Index | **88** (63 non-PK) |
| Endpoint | 51 |

Data mentah: `/tmp/db-audit/{columns,constraints,indexes}.tsv`

---

## 1. Yang sudah BAIK — dan **jangan diubah**

**Ini bukan pujian kosong. Beberapa praktik ini jarang ditemukan.**

### 1.1 Soft delete + partial unique index ✅ *praktik terbaik*

```sql
uq_bundles_slug_active  btree (slug) WHERE (deleted_at IS NULL)
uq_questions_content_hash btree (content_hash)
  WHERE (deleted_at IS NULL AND content_hash IS NOT NULL)
idx_questions_has_embedding btree (id) WHERE (embedding IS NOT NULL)
```

> **PostgreSQL docs §11.8 Partial Indexes:** *"A third possible use for partial
> indexes does not require the index to be used in queries at all. The idea here
> is to create a **unique index over a subset** of a table."*
>
> Ini persis pemakaian yang dianjurkan — **dan banyak proyek melewatkannya**.
> Tanpa partial index, soft-delete + UNIQUE akan **bentrok**: baris yang sudah
> dihapus tetap menahan slug.

### 1.2 Diversity index yang tepat sasaran ✅

| Jenis | Dipakai untuk | Kenapa tepat |
|---|---|---|
**GIN trigram** | `questions.content_markdown`, `tags.name`, `topics.name` | pencarian typo-tolerant (pg_trgm) |
**HNSW** | `questions.embedding vector_cosine_ops` (m=16, ef=64) | pencarian semantik |
**Composite** | `idx_questions_grade_diff_status` (grade, difficulty, status) | cocok filter gabungan |
**Partial** | 3 index (lihat 1.1) | hemat & tepat |

> Referensi: *Use The Index, Luke* — *"you must know the column combinations that
> appear in the `where` clause"*. Proyek ini **sudah** melakukannya:
> `idx_questions_grade_diff_status` cocok dengan filter nyata di UI.

### 1.3 Integritas referensial dipilih sadar ✅

```
24 FOREIGN KEY — CASCADE & RESTRICT dipilih per relasi:
  bundle_items.question_id  → RESTRICT   (soal terpakai tak boleh hilang)
  bundles      (→ items)    → CASCADE    (hapus naskah, isinya ikut)
  question_options          → CASCADE
```

Bukan asal `CASCADE` semua — ada **penalaran** per relasi.

### 1.4 Trigger: 25, termasuk yang menjaga invarian ✅

```
trg_audit_logs_immutable   ← audit tak bisa diubah (append-only)
trg_questions_stimulus_depth · trg_topics_cycle
trg_question_topics_usage  · trg_question_tags_usage
trg_*_updated_at (20)
```

`trg_topics_cycle` mencegah **siklus** di hierarki topik — itu **tidak sepele**.

### 1.5 Enum sebagai tipe asli ✅

**17 enum** PostgreSQL (`question_type`, `question_status`, `media_origin`, …).
Lebih baik daripada `varchar` + validasi aplikasi: **DB ikut menjaga**.

---

## 2. Temuan — yang perlu diperhatikan

### 🟠 D1 — `question_type` difilter 10×, **tanpa index**

**Bukti terukur:**

```
Filter di UI/API:      grade 19× · status 14× · questionType 10×
                       topicId 9× · difficulty 9× · sourceId 1×

Index di questions:    grade ✅ · status ✅ · difficulty ✅
                       question_type  ❌ TIDAK ADA
```

**`EXPLAIN ANALYZE`** (filter `question_type='single_choice' AND deleted_at IS NULL`):
```
Seq Scan on questions  (rows=52)   ← 90 baris, seq scan WAJAR sekarang
```

**⚠️ Penilaian jujur:** pada **90 baris**, `Seq Scan` itu **PILIHAN YANG BENAR** —
Postgres tahu membaca seluruh tabel lebih murah daripada index. Jadi ini
**bukan masalah sekarang**.

**Tapi akan jadi masalah:** dengan **~10.000 soal**, filter `question_type`
(10× dipakai) akan **scan seluruh tabel** setiap kali.

**Rekomendasi:** tambah `idx_questions_question_type`. **Murah** (kolom enum
berkardinalitas rendah, index kecil) dan **mencegah** masalah sebelum muncul.

> Referensi: *Use The Index, Luke* — index harus mengikuti **kombinasi `where`
> clause** yang nyata dipakai. `question_type` termasuk yang paling sering.

### 🟡 D2 — hanya **3 CHECK** untuk 28 tabel

```
media_assets  CHECK (short_id ~ '^[0-9A-Za-z]{8}$')   ✅ bagus
questions     CHECK (difficulty BETWEEN 1 AND 5)      ✅ bagus
topics        CHECK (level BETWEEN 1 AND 3)           ✅ bagus
```

Ketiganya **tepat**. Tapi **kandidat CHECK lain** yang belum ada:

| Kandidat | Alasan |
|---|---|
`bundles.year` / `questions.event_year` — rentang (mis. 1900–2100) | tahun ngawur bisa masuk (sudah ada di Zod, **tapi Zod tak menjaga data langsung di DB**) |
`question_topics.is_primary` — bila menyatakan "satu utama per soal" | saat ini bisa punya **banyak** `is_primary=true` |
`questions.parent_id` — hanya boleh menunjuk `question_type='stimulus'` | **dijaga trigger/aplikasi** (perlu dicek apakah cukup) |

> ⚠️ **Tapi hati-hati:** CONSTRAINTS **#27** sengaja memilih **invarian lunak di
> service**, bukan CHECK keras — agar data boleh dilengkapi **bertahap**.
> Itu **keputusan sadar**, bukan kelalaian. Karena itu D2 ini **rendah**, dan
> hanya untuk invarian yang **tidak pernah boleh dilanggar**.

### 🟡 D3 — `user` tanpa PRIMARY KEY (3 kolom)

```
user: id (text) · name · email   ← tak ada PK terdeteksi
```

**⚠️ Perlu diklarifikasi:** `user` dikelola **Better Auth** (library). PK-nya
mungkin berupa **unique index** (`user_pkey` ada di daftar index, tapi
`information_schema` melaporkan tak ada PK constraint). Kemungkinan besar
**false positive dari toolku** — perlu dicek manual sebelum dianggap temuan.

### 🟡 D4 — 8 kolom JSONB: mayoritas tepat, 1 kandidat

Diterapkan **framework 3 pertanyaan** (Suparbase 2026):
*akan di-`WHERE`? · bentuk stabil? · di-agregasi?*

| Kolom | Stabil | WHERE | Putusan |
|---|:--:|:--:|---|
`questions.data_payload` | ❌ | tidak | ✅ **JSONB tepat** |
`audit_logs.diff_payload` | ❌ | tidak | ✅ tepat |
`ingest_queue.media_manifest` | ❌ | tidak | ✅ tepat |
`app_settings.value` | ❌ | jarang | ✅ tepat |
`events.subtests`/`aliases` | ✅ | mungkin | 🟡 kandidat array/kolom |
`media_assets.tags` | ✅ | mungkin | 🟡 kandidat relasi |
**`questions.answer_key`** | ✅ | **sering dibaca** | 🟡 **kandidat kolom** |

**Untuk `answer_key`:** bentuknya **stabil** (`correct`, `explanation`) dan
**selalu dibaca** saat menampilkan soal. Menurut framework, ia **layak jadi
kolom**. **Tapi** bentuknya berbeda per tipe soal (`matrix_grid`, `matching`) —
jadi JSONB **masih masuk akal**. **Keputusan terbuka, bukan kesalahan.**

---

## 3. Metode yang **GAGAL** — dan ini harus kusampaikan

Aku mencoba mendeteksi **kolom mati** secara otomatis (bandingkan kolom DB vs
pemakaian di kode). **Hasilnya salah total, dua kali berturut-turut:**

| Percobaan | Hasil | Kenapa salah |
|---|---|---|
1 | **221 "mati"** | mayoritas tabel **library** (Better Auth) |
2 | **174 "mati"** | Drizzle pakai nama **camelCase**, bukan nama kolom DB → `bundles.title`, `questions.content_markdown` ikut terdeteksi "mati" — **mustahil** |
3 | 0x untuk semua | Nama field ≠ nama kolom (`instructions` vs `instructions`, `publisher`, dst) → **lemah** |

**Kesimpulan jujur: aku TIDAK punya data sahih soal kolom mati.**
Untuk mendapatkannya perlu cara lain (mis. `pg_stat_user_columns`, atau
menelusuri tiap field di kode **satu per satu** — mahal).

**Aku tidak akan mengarang angka.** Ini **pertanyaan terbuka**, bukan temuan.

---

## 4. Referensi industri yang dipakai

| Sumber | Dipakai untuk | Kesimpulan |
|---|---|---|
**Use The Index, Luke** (Markus Winand) | index & `where` clause | *"you must know the column combinations that appear in the where clause"* → index proyek **sudah** mengikuti filter nyata; `question_type` **terlewat** |
**PostgreSQL Docs §11.8** | partial index | `uq_bundles_slug_active` = **pemakaian yang dianjurkan** ✅ |
**PostgreSQL Docs** — FK tanpa index | `DELETE` induk memicu seq scan anak | 3 FK tanpa index |
**Suparbase (2026)** — JSONB vs Tables | framework 3 pertanyaan | mayoritas JSONB **tepat** |
**Redgate** — Denormalization | kapan duplikasi boleh | `year`×4 sah **bila** maknanya beda |
**SQL Antipatterns** (Karwin) | pola salah umum | tidak ditemukan antipattern berat |

---

## 5. Prioritas tindakan

| # | Aksi | Dampak | Usaha | Keyakinan |
|---|---|---|---|---|
| **1** | Tambah `idx_questions_question_type` | 🟡 cegah lambat saat data besar | **sangat kecil** | **tinggi** ✅ |
| **2** | Tambah index `media_assets.parent_asset_id` | 🟡 | **sangat kecil** | tinggi ✅ |
| **3** | Klarifikasi PK `user` (cek manual) | 🟡 | kecil | **sedang** ⚠️ |
| **4** | Dokumentasikan makna tiap `year`/`grade` | 🟡 cegah salah kira duplikat | kecil | tinggi ✅ |
| **5** | Tinjau `answer_key` → kolom? | 🟡 | sedang | **rendah** ⚠️ |
| **6** | Kandidat CHECK baru (tahun, is_primary) | 🟡 | sedang | **rendah** ⚠️ |

> **Keyakinan ditandai jujur.** #1, #2, #4 aku **yakin**. #3, #5, #6 **perlu
> diperiksa dulu** — aku tak mau kamu mengerjakan hal yang mungkin keliru.

---

## 6. Yang **TIDAK** bisa kusimpulkan (pertanyaan terbuka)

1. **Kolom mati** — metodeku gagal (§3). Butuh pendekatan lain.
2. **Normalisasi per tabel (1NF–BCNF)** — baru `year`/`grade` yang kusentuh;
   penilaian penuh butuh membaca **makna** tiap kolom, bukan hanya strukturnya.
3. **Perkiraan pertumbuhan** — belum tahu tabel mana akan besar (perlu data nyata).
4. **Rencana query untuk skala besar** — `EXPLAIN` pada 90 baris **tidak
   mewakili** 10.000 baris. Analisisnya **prediktif**, bukan terukur.

**Aku tidak akan berpura-pura menutup celah ini.** Kalau kamu butuh, aku bisa
kerjakan lebih dalam — tapi butuh waktu, dan mungkin butuh kamu menyediakan
konteks (mis. perkiraan jumlah soal ke depan).

---

## 7. Catatan kejujuran

- Audit pertama (§ sebelumnya, `AUDIT-ARSITEKTUR-MENYELURUH.md`) **terlalu cepat** —
  pemilik produk benar menegurnya. Audit ini **mengukur ulang dari nol**.
- **Temuan "kolom mati" kubuang** karena metodenya cacat. Lebih baik kehilangan
  temuan daripada menyampaikan angka **yang menyesatkan**.
- **Beberapa temuan justru memuji** proyek ini — dan itu **bukan basa-basi**:
  partial index + audit immutable + composite index sesuai filter nyata adalah
  praktik yang **sengaja** dipilih, bukan kebetulan.
