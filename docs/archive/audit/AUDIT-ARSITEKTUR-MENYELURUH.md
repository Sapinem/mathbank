# AUDIT ARSITEKTUR MENYELURUH — MathBank (2026-10-02)

> **Status:** 📊 **audit + rekomendasi** — dasar keputusan pemilik produk
> **Metode:** mengukur **seluruh** 28 tabel, 51 endpoint, 9 lapisan arsitektur,
> kode (`wc`, `grep` terukur), **bukan** kesan. Referensi industri disertakan.
> **Prinsip:** dinilai dari apakah arsitektur **tepat untuk pemakaian yang akan
> datang** — **bukan** dari tabel mana yang kebetulan sudah terisi.

---

## 0. Ringkasan eksekutif (10 temuan)

| # | Temuan | Tingkat | Bertentangan dgn |
|---|---|---|---|
| **A1** | **8 service melampaui batas ~300 baris** (terjauh 665) | 🟠 **tinggi** | CONSTRAINTS #16 |
| **A2** | **2 modul L6 menyentuh DB** — harusnya fungsi murni | 🟠 **tinggi** | CONSTRAINTS #15 |
| **A3** | **`year` di 4 tabel · `grade` di 3 tabel** — duplikasi | 🟡 sedang | prinsip "satu fakta satu tempat" |
| **A4** | **`bundles` vs `collections`** — dua wadah, satu konsep | 🟠 **tinggi** | ADR-0009 · ADR-0014 |
| **A5** | **3 FK tanpa index** (`user_id`×2, `parent_asset_id`) | 🟡 sedang | praktik index FK |
| **A6** | **3 endpoint tulis tanpa `permission:`** | 🟢 **rendah** | — (sudah beralasan, biar terjaga) |
| **A7** | **8 kolom JSONB** — perlu ditinjau per-kolom | 🟡 sedang | framework 3-pertanyaan (§4) |
| **A8** | **48 kolom `*_at`** — konsisten ✅ (bukan masalah) | 🟢 baik | — |
| **A9** | **`collections` = duplikat `bundles`** (16 vs 10 kolom) | 🟠 tinggi | sama dgn A4 |
| **A10** | **Tanpa API versioning** — 51 endpoint, hanya ingest ber-`/v1` | 🟡 sedang | praktik API |

**Yang sudah BAIK** (pantas dicatat, bukan hanya cela):
- ✅ **9 lapisan arsitektur terdokumentasi & terkunci** — jarang dimiliki proyek
- ✅ **46 CONSTRAINTS mekanis** + gerbang mutu otomatis (typecheck/lint/test/db:verify)
- ✅ **237 tes DB + 664 unit + 14 e2e** — jaring pengaman nyata
- ✅ **Audit log append-only** + trigger immutable
- ✅ **Soft delete dengan partial unique index** (`uq_bundles_slug_active`) — **praktik terbaik**
- ✅ **FK `RESTRICT`/`CASCADE` dipilih sadar** per relasi
- ✅ **Reproduktibilitas DB diuji dari nol** (CONSTRAINTS #24)
- ✅ **ADR culture** — keputusan punya jejak, termasuk yang **dibatalkan**

---

## 1. Temuan A1 — 8 service melampaui batas

```
665  bundle-service.ts          ← 2,2× batas
566  taxonomy-service.ts
479  media-service.ts
381  collection-service.ts      ← baru, sudah lewat
326  question-read.ts
325  topic-service.ts
325  question-write.ts
317  enrichment-service.ts
```

**Batas:** CONSTRAINTS **#16** — *"L5 (service) = fungsi biasa, **maks ~300 baris/file**"*.

### Referensi industri

Panduan ukuran **bukan angka mati** — sejumlah sumber menolak "perfect size"
(mis. *"The Myth of the Perfect Service Size"*). Yang **konsisten** adalah
**prinsipnya**, bukan angkanya:

> **Single Responsibility:** *"Class exceeds 90 lines → trigger a split"* ·
> *"Service handles validation + logic → split"* (SOLID/SRP guide)

**Jadi masalahnya bukan "665 > 300".** Masalahnya: **file itu memikul beberapa
tanggung jawab.** `bundle-service.ts` menangani **metadata + item + urutan +
validasi + izin + cetak** sekaligus.

### Rekomendasi

| Prioritas | Aksi |
|---|---|
| **Tinggi** | Pecah `bundle-service.ts` → `bundle-write.ts`, `bundle-items.ts`, `bundle-query.ts` (pola **sudah ada** di `question-*`: read/write terpisah ✅) |
| Sedang | `taxonomy-service.ts` pecah per entitas (source/event/tag/grades) |
| Rendah | Sisanya — pantau, pecah saat **tumbuh lagi** |

> ⚠️ **Jangan pecah karena angka.** Pecah karena **tanggung jawab bercampur**.
> Kalau `collection-service.ts` (381) isinya kohesif, ia **boleh** tinggal —
> yang penting batasnya **disadari**, bukan dilanggar tanpa tahu.

---

## 2. Temuan A2 — modul L6 menyentuh DB

```
src/lib/question/filters.ts   ← menyentuh @/lib/db
src/lib/taxonomy/tree.ts      ← menyentuh @/lib/db
```

**Batas:** CONSTRAINTS **#15** — *"L6 (engine) = fungsi murni — **tanpa DB**, tanpa network"*.

**Kenapa ini penting:** L6 murni = **mudah diuji tanpa DB**. Begitu ia menyentuh
DB, tesnya butuh database → lebih lambat, lebih rapuh. Buktinya: `question`
**hanya punya 1 file**, dan ia menyentuh DB — jadi **hampir tak ada logika murni
soal** yang bisa diuji cepat.

### Referensi industri

Pemisahan **pure core / imperative shell** (Gary Bernhardt, *Functional Core,
Imperative Shell*) — inti logika tanpa efek samping, cangkang menangani I/O.
Keuntungan: **tes cepat**, logika **bisa dipakai ulang** (klien & server).

### Rekomendasi

| Prioritas | Aksi |
|---|---|
| **Tinggi** | `question/filters.ts` → pisah jadi **builder murni** (menghasilkan struktur) + **executor** (yang menyentuh DB di L5) |
| Sedang | `taxonomy/tree.ts` — ambil bagian murni (hitung level, siklus) ke `tree-pure.ts` |
| Kecil | Tambah tes murni utk logika filter — **tak butuh DB** |

---

## 3. Temuan A3 — `year` di 4 tabel, `grade` di 3 tabel

```
year  : bundles · collections · questions · sources
grade : bundles · collections · questions
```

**Pertanyaan kritis:** apakah ini **duplikasi** (satu fakta di banyak tempat) atau
**dimensi berbeda** (tahun naskah ≠ tahun soal ≠ tahun terbit buku)?

### Cara memutuskan (bukan menebak)

Tanyakan: **bolehkah keduanya berbeda?**
- **Tahun soal** boleh beda dari **tahun naskah** (soal UTBK 2020 muncul di modul 2024) → ✅ **bukan duplikat**
- **Tahun terbit buku** beda dari **tahun naskah** → ✅ **bukan duplikat**
- Tapi **tahun naskah** vs **tahun koleksi** — kalau keduanya sama artinya → ❌ **duplikat**

### Rekomendasi

| Aksi |
|---|
| **Dokumentasikan** perbedaan makna tiap `year`/`grade` di `KAMUS-DATA.md` — supaya tak ada yang mengira duplikat |
| Bila `bundles.year` ≡ `collections.year` (A4 selesai) → **otomatis hilang satu** |
| Pertimbangkan `CHECK`/komentar kolom yang menjelaskan **milik siapa** |

> Referensi: prinsip normalisasi — *"Normalization (3NF) stores each fact once,
> eliminating update anomalies"* (engineering-handbook). **Tapi** denormalisasi
> **boleh** bila **sadar & beralasan** (Redgate: *"be sure why you want to apply
> denormalization"*).

---

## 4. Temuan A7 — 8 kolom JSONB (framework)

| Kolom | Bentuk stabil? | Di-`WHERE`? | Putusan |
|---|:--:|:--:|---|
| `questions.answer_key` | ✅ (correct/explanation) | jarang | 🟡 **kandidat kolom** |
| `questions.data_payload` | ❌ (beda per tipe soal) | tidak | ✅ **JSONB tepat** |
| `audit_logs.diff_payload` | ❌ (bebas) | tidak | ✅ **JSONB tepat** |
| `ingest_queue.media_manifest` | ❌ | tidak | ✅ **JSONB tepat** |
| `events.subtests`/`aliases` | ✅ (array string) | mungkin | 🟡 **kandidat array/kolom** |
| `media_assets.tags` | ✅ | mungkin | 🟡 **kandidat relasi** |
| `app_settings.value` | ❌ | jarang | ✅ **JSONB tepat** |

### Framework 3 pertanyaan (Suparbase, 2026)

> 1. Akan di-`WHERE`? → kalau ya, **kolom + index**
> 2. Bentuk **stabil** antar baris? → kalau ya, **kolom**; kalau tidak, **JSONB**
> 3. Akan di-**agregasi** (`SUM`/`GROUP BY`)? → kalau ya, **kolom**

**Kesimpulan:** mayoritas JSONB di proyek ini **tepat** ✅. Yang perlu ditinjau:
`answer_key` (bentuk stabil, sering dibaca) & `media_assets.tags` (kandidat relasi
— tapi MEDIA **sedang** punya `question_media`, jadi mungkin cukup).

---

## 5. Temuan A4/A9 — `bundles` vs `collections` (rujuk evaluasi terpisah)

Ringkas: **dua wadah untuk satu konsep**. Lihat
[`EVALUASI-COLLECTIONS-VS-BUNDLES.md`](EVALUASI-COLLECTIONS-VS-BUNDLES.md).

**Yang perlu ditambahkan di sini:** secara **arsitektur**, `collections`
(10 kolom) **duplikat** sebagian besar `bundles` (16 kolom) — `source_id`,
`event_id`, `year`, `grade`, `slug`, `title`, `description`. **Ini A3 dalam
bentuk paling nyata.**

---

## 6. Temuan A5 — 3 FK tanpa index

```
account.user_id · session.user_id · media_assets.parent_asset_id
```

**Referensi:** PostgreSQL **tidak** membuat index FK otomatis. Akibatnya
`DELETE`/`UPDATE` pada tabel induk memicu **sequential scan** ke anak, dan
join lewat kolom itu lambat.

### Rekomendasi
Tambah index — **kecuali** `account.user_id`/`session.user_id` (dikelola
Better Auth; ikuti konvensinya). `media_assets.parent_asset_id` → **tambah**.

---

## 7. Temuan A10 — API versioning

**51 endpoint**, hanya `v1/ingest/*` yang ber-versi. Sisanya `/api/questions`,
`/api/bundles`, dst.

**Praktik umum:** versi **wajib** bila ada konsumen eksternal (aplikasi mobile,
MCP, integrasi). Untuk **konsumen internal** (UI satu repo), versioning **opsional**.

### Rekomendasi
**Tidak perlu buru-buru.** Tapi **catat keputusannya**: *"API `/api/*` = internal,
boleh berubah; `/api/v1/*` = kontrak mesin, stabil."* Itu **cukup** sebagai pagar.

---

## 8. Yang sudah BAIK — dan **jangan diubah**

| Praktik | Bukti |
|---|---|
**Audit log append-only** | `trg_audit_logs_immutable` + `audit_action` enum |
**Soft delete + partial unique index** | `uq_bundles_slug_active WHERE deleted_at IS NULL` — **praktik terbaik**, jarang dilakukan |
**FK RESTRICT/CASCADE dipilih sadar** | `bundle_items.question_id` RESTRICT, `bundles` CASCADE |
**Invarian di service, bukan CHECK** | ADR/CONSTRAINTS #27 — tepat untuk data bertahap |
**Reproduktibilitas diuji** | DB dibangun dari nol & diverifikasi **tiap** perubahan skema |
**Rate limit di endpoint mutasi** | #33 — 45/48 endpoint |
**Proyeksi kolom** | #34 — `questionColumns()` mencegah `SELECT *` bocorkan `answer_key` |
**ADR culture** | 17 ADR, termasuk **yang dibatalkan** — jejak keputusan utuh |

> **Ini bukan pujian kosong.** Proyek sebesar ini **jarang** punya audit log
> immutable + partial index soft-delete + invarian teruji. Itu **di atas rata-rata**.

---

## 9. Prioritas tindakan (disarankan)

| # | Aksi | Dampak | Usaha |
|---|---|---|---|
| **1** | **Selesaikan A4** (`bundles` vs `collections`) | 🟠 menghapus sumber kebingungan | sedang |
| **2** | **Pecah `bundle-service.ts`** (665 → 3 file) | 🟠 pemeliharaan | sedang |
| **3** | **Pisahkan DB dari L6** (`filters.ts`, `tree.ts`) | 🟠 tes cepat | kecil |
| **4** | Tambah index `media_assets.parent_asset_id` | 🟡 performa | **sangat kecil** |
| **5** | Dokumentasikan makna tiap `year`/`grade` | 🟡 cegah duplikasi | kecil |
| **6** | Catat keputusan API versioning | 🟡 kejelasan | **sangat kecil** |
| **7** | Tinjau `answer_key` JSONB → kolom | 🟡 | sedang |

**Urutan yang kusarankan:** **1 → 3 → 4 → 6** (kecil dulu, cepat), lalu **2**.

---

## 10. Catatan metodologi & kejujuran

- **Angka diambil dengan mengukur**, bukan mengingat: `wc -l`, `grep -c`,
  `information_schema`, `pg_constraint`. Bila keliru, bisa diperiksa ulang.
- **Tabel kosong TIDAK dipakai** sebagai argumen (koreksi pemilik produk).
  Audit ini menilai **bentuk**, bukan **isi**.
- **Temuan bisa salah.** Bila ada konteks yang tak kulihat (keputusan lama yang
  menjelaskan), **konteks itu yang menang** — audit ini bahan, bukan vonis.
- **Aku bagian dari masalah ini**: `collection-service.ts` (381 baris) **aku
  yang menulis**, dan ia sudah melampaui batas #16 sejak lahir.

## Sumber

| Sumber | Dipakai untuk |
|---|---|
**Oracle/JPA §12.6** · **GitLab** · **SQLAlchemy** · **Fowler** | STI vs CTI (lihat evaluasi terpisah) |
**Suparbase** — *JSONB vs Tables: A Decision Framework* (2026) | framework 3-pertanyaan JSONB |
**Redgate** — *Denormalization: When, Why, and How* | kapan denormalisasi boleh |
**engineering-handbook** — normalisasi vs denormalisasi | prinsip "satu fakta satu tempat" |
**PostgreSQL docs** — partial index, FK tanpa index | index & soft delete |
**CONSTRAINTS.md** · **DESAIN-PER-LAPISAN** · **ADR 0009–0017** | aturan proyek sendiri |
