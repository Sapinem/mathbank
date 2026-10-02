# EVALUASI — `collections` vs `bundles`: digabung atau dipisah?

> **Status:** 📊 **evaluasi menyeluruh** (2026-10-02) — dasar untuk keputusan pemilik produk
> **Metode:** membaca skema & riwayat git **kedua repo**, seluruh ADR 0009–0017,
> `ARSITEKTUR-DATA-FINAL.md`, dan mengukur **pemakaian nyata** di DB.
> **Terkait:** ADR-0009 · ADR-0013 · ADR-0014 · ADR-0016 · ADR-0017

---

## 1. Akar kebingungan — sudah ketemu

**QBank sedang berada di `detached HEAD` pada tag `v0.9.0` (versi LAMA).**

```
QBank v0.9.0 (aktif)  → src/lib/db/schema/collections.ts + exams.ts   ← ADA (37 + 80 baris)
QBank master (final)  → src/lib/db/schema/bundles.ts saja             ← collections/exams DIHAPUS
                        commit 5d01dfe "hapus tabel legacy collections/exam_packages/exam_items"
```

Akibatnya **tiap orang membaca fakta berbeda** tentang "apa yang QBank putuskan":

| Pembaca | Melihat | Menyimpulkan |
|---|---|---|
| **ADR-0009** (MathBank) | QBank `master` | "QBank sudah **menyatukan** → MathBank ikuti: **satu tabel**" |
| **Diskusi/desain lain** | QBank `v0.9.0` di disk | "QBank **memisah** → MathBank sebaiknya pisah" |
| **ADR-0009 bagian Catatan** | — | *"kekacauan ada di QBank karena disk berada di tag `v0.9.0` (lama), bukan `master` (final)"* |

**Kekacauan ini sudah terdeteksi 1 Okt, tapi tak pernah diselesaikan.** Lalu
**ADR-0016** menambah `collections` — makin keruh, karena tidak menyebut
tautan ini secara tegas.

## 2. Kronologi keputusan (jejak lengkap)

| Tgl | Peristiwa | Hasil |
|---|---|---|
| 2 Sep | Spec bank soal | "tahun menempel pada sumber"; lahir konsep **Koleksi** |
| 1 Okt 06:32 | "Opsi 2" | unified DB, 1 tabel, dipisah **100% di UI** |
| 1 Okt 08:22 | **ADR-0009** | 1 tabel `bundles`; pisah tabel **DITOLAK** (ikut QBank `master`) |
| 1 Okt siang | **ADR-0013** | **PISAH** → diterima + migrasi `0009` diterapkan |
| 1 Okt sore | Audit DB | alasan: *"`question_sources` sudah jadi Koleksi"* → **DIBATALKAN**, direvert |
| 1 Okt | **ADR-0014** | Sumber menempel pada **bundle**; `question_sources` **DIHAPUS** |
| 2 Okt | **ADR-0016** | **Tambah `collections`** (alasan lama sudah hilang) |
| 2 Okt | **ADR-0017** | Buang `exercise`; `bundle_type` = `source`\|`exam` |
| 2 Okt | Arah pemilik produk | *"ingest web masuk `collections`, bukan bundle"* |

**Pola yang terlihat:** topik ini sudah **7× berubah arah** dalam ~1 bulan.
Itu bukan tanda bodoh — itu tanda **pertanyaannya belum dirumuskan dengan benar**.

## 2b. Referensi industri — **kriterianya jelas**, dan hampir tak dipakai di sini

Pola ini bernama **Single Table Inheritance (STI)** vs **Class/Joined Table
Inheritance (CTI)**. Semua sumber utama membahasnya — dan **kriterianya konsisten**:

**Kapan GABUNG (STI) tepat** — Oracle/JPA §12.6.1 (dokumentasi resmi):

> Sesuai bila sub-tipe **"differ primarily in behavior only"** (beda **perilaku**,
> bukan data) dan **"do not have unique data requirements"** (tak punya kebutuhan
> data unik).
>
> **Keunggulan:** *"Simplest to implement · single table to administer · performs
> better than other inheritance strategies · no complex joins"*
> **Kelemahan:** *"Unused fields when sub-types have unique properties · sub-type
> columns must be nullable · harder to enforce constraints · not normalized"*

**Kapan PISAH (CTI) tepat** — GitLab (praktik nyata, skala besar):

> *"always use separate tables instead of polymorphic associations"*
> Alasan: **tak bisa menegakkan foreign key** · *"a table should have a single
> responsibility"* (tanggung jawab kolom tercampur) · indeks komposit rumit.

**Dan yang paling penting** — SQLAlchemy 2.0:

> *"The **discriminator** column will store a value which indicates the type of
> object represented within the row."*

**Kata kuncinya: DISCRIMINATOR.** Di seluruh literatur, kolom pembeda disebut
**discriminator column** — ia **memang dirancang** untuk itu. Jadi STI **bukan
anti-pattern**; ia **pola resmi** dengan syarat jelas.

### Uji kriteria itu ke kasus kita

| Kriteria | `exam` vs `source` | Lolos? |
|---|---|---|
Beda **perilaku** (izin, cetak, urutan) | ya — `source` publik, `exam` milik guru | ✅ |
**Tak** punya kebutuhan data unik | ya — kolomnya sama, sebagian NULL | 🟡 |
FK tetap bisa ditegakkan | ya — `source_id`/`event_id` FK sah | ✅ |
Sub-tipe punya "kolom harus nullable" | ya — **inilah kelemahannya** | 🟡 |

**Kesimpulan referensi:** kasus kita **cocok STI**, dengan **satu kelemahan
nyata** (kolom bergantian NULL). Kelemahan itu **bukan alasan otomatis untuk
pisah** — ia **harga** yang ditukar dengan kesederhanaan. JPA menyarankan
**`CHECK` constraint** untuk menguranginya (mis. `exam` wajib punya `duration_minutes`).

> ⚠️ **Argumen terkuat untuk PISAH (GitLab) TIDAK berlaku di sini.** GitLab
> menolak *polymorphic associations* karena **FK tak bisa ditegakkan**. Kasus
> kita **berbeda**: `bundles.source_id` dan `bundles.event_id` **adalah FK sah**
> ke tabel nyata — bukan `target_type` + `target_id`. Jadi kelemahan utama
> GitLab **tidak kita alami**.

## 3. Apa kata dokumen terkuat (acuan yang paling awal & rinci)

`ARSITEKTUR-DATA-FINAL.md` — keputusan yang **paling rinci & terdokumentasi** —
menetapkan **satu tabel `bundles`** dengan **dua konsep di dalamnya**:

```sql
CREATE TYPE bundle_type   AS ENUM ('source','exam');
CREATE TYPE bundle_origin AS ENUM ('ingest','manual');        -- ← kunci!
CREATE TYPE bundle_item_role AS ENUM ('member','origin','forked');
```

```
bundles
├─ bundle_type   = 'source' | 'exam'      ← APA isinya
├─ origin        = 'ingest' | 'manual'    ← DARI MANA datangnya
├─ source_id, event_id, year              ← dimensi 'source'
└─ duration_minutes, instructions, status ← dimensi 'exam'
```

**Dan QBank `master` (final) persis begitu** — `question_bundles` dengan
komentar eksplisit di kode:

```ts
// source-type columns (bundle_type = 'source')
sourceId, eventId, year

// exam-type columns (bundle_type = 'exam')
schoolId, durationMinutes, instructions, status, createdById
```

> **Artinya: dua sistem independen (MathBank & QBank) sampai pada kesimpulan
> yang SAMA — satu tabel dengan `bundle_type` sebagai pembeda.** Itu bukti kuat,
> bukan kebetulan: keduanya menghadapi masalah yang sama.

## 4. Pemakaian nyata di DB hari ini

| Tabel | Isi | Dipakai? |
|---|---:|---|
| `bundles` | **2** (hasil ingest, `type='source'`) | ✅ jalur ingest + UI `/bundles` |
| `bundle_items` | **78** | ✅ |
| `collections` | **0** | ⚠️ **kosong** — tabel & UI ada, tapi tak satu pun dipakai |
| `collection_items` | **0** | ⚠️ kosong |
| `questions` | 90 | — |

**`collections` = 100% kosong, 0 pemakaian.** Yang hidup justru `bundles`.

## 5. Analisis: apa bedanya, secara hakikat?

Aku uji pembeda yang biasa dikemukakan, dengan bukti:

| Klaim pembeda | Bertahan? | Bukti |
|---|---|---|
| "Koleksi = **statis**, Latihan = **dinamis**" | ❌ **lemah** | Artikel web juga bisa diperbarui; naskah UTS juga bisa disunting |
| "Koleksi = **publik**, Latihan = **milik guru**" | ❌ **lemah** | `bundle_type='source'` **sudah** publik (izin `source` = umum, ADR-0014). Jadi pemisahan ini **sudah ada di dalam `bundles`** |
| "Koleksi **tak punya** durasi/status/cetak" | ❌ **hilang** | Pemilik produk: *"nanti juga diberi kemampuan yang sama"* |
| "Koleksi = **arsip mentah**, Latihan = **siap pakai**" | 🟡 **mungkin** | Tapi ini soal **kematangan isi**, bukan **jenis entitas** — dan bisa dinyatakan lewat `origin`/`status` |

**Kesimpulan analisis:** setiap pembeda yang diajukan **gugur** atau **sudah
terwakili** oleh kolom yang ada. Bila `collections` kelak punya **semua**
kemampuan `bundles`, keduanya menjadi **dua tabel untuk satu konsep** — persis
kekhawatiran yang dulu membatalkan ADR-0013.

## 6. Biaya memisah (terukur, bukan perkiraan)

| Biaya | Besaran |
|---|---|
| Tabel bertambah | **+2** (28 → 30) |
| Berkas disentuh | **~18** (estimasi rancangan sendiri) |
| **Jalur ganda selamanya** | Ingest, cetak, ekspor, izin, filter, pencarian — **semua** harus punya dua cabang |
| Risiko divergensi | Dua wadah, satu konsep → lambat laun **berbeda perilaku** (inilah yang terjadi pada `question_sources`) |
| Beban kognitif | **Penyebab kebingungan hari ini** — 7× ganti arah |
| Yang harus dibuang bila salah | 78 soal + 2 naskah harus dipindah |
| Manfaat nyata terukur | **0** — `collections` kosong sejak dibuat |

## 7. Rekomendasi

### ⭐ **GABUNG — satu tabel `bundles`, `bundle_type` sebagai pembeda**

**Alasan (berurutan kekuatannya):**

1. **Dua sistem independen setuju.** MathBank (`ARSITEKTUR-DATA-FINAL`) &
   QBank (`master`) — dua tim, dua waktu, **satu kesimpulan**. Menentangnya
   berarti mengklaim kita lebih tahu daripada dua keputusan yang sudah matang.
2. **Semua pembeda sudah terwakili.** `bundle_type` (source/exam) untuk jenis;
   `origin` (ingest/manual) untuk asal; izin per-`bundle_type` untuk publik vs
   milik guru. **Tak ada informasi yang hilang.**
3. **Biaya memisah nyata, manfaatnya nol.** `collections` **kosong**; biaya
   pemisahan **~18 berkas + jalur ganda selamanya**.
4. **Menyelesaikan kebingungan, bukan menambahnya.** Satu tempat untuk "naskah
   berisi soal" = satu jawaban untuk "ditaruh di mana".

### Cara menerapkan (jika setuju)

1. **Buang `collections` + `collection_items`** (0 baris → nol data hilang) — ADR baru.
2. **Tambah `bundles.origin`** (`ingest`|`manual`) — **sudah direncanakan**
   `ARSITEKTUR-DATA-FINAL` §2.1, **belum pernah dibuat**. Ini yang menjawab
   "hasil ingest vs naskah guru" **tanpa tabel baru**.
3. **`bundle_type` tetap** `source`|`exam`; izin sudah benar (source=umum, exam=own).
4. **UI `collections`** → jadikan **tampilan tersaring** atas `bundles`
   (`type='source'`), atau hapus menunya. Keputusan terpisah.
5. **ADR-0016 ditandai "digantikan"**, ADR-0013 tetap dibatalkan (kini dengan alasan lebih kuat).

### Alternatif bila tetap ingin **PISAH**

Bila kamu tetap memilih pisah, **tiga hal ini wajib** supaya tidak mengulang kekacauan:

| # | Syarat |
|---|---|
| 1 | **Tetapkan pembeda hakiki** yang **tidak** bisa diwakili kolom — kalau tidak ada, jangan pisah |
| 2 | **Hapus `bundle_type='source'`** dari `bundles` — jangan biarkan dua jalur hidup bersama (inilah racun `question_sources`) |
| 3 | **Pindahkan 78 soal** dari `bundles` → `collections`, dan siapkan **satu sumber kebenaran** untuk cetak/ekspor/izin |

## 8. Pertanyaan yang harus dijawab sebelum memutuskan

1. **Adakah satu contoh nyata** yang **tidak bisa** diwakili `bundles.bundle_type`
   + `bundles.origin` + izin per-tipe? *(Kalau tidak ada → gabung.)*
2. Bila `collections` nanti punya **semua** kemampuan `bundles`, **apa bedanya**
   yang tersisa? *(Kalau tak ada → itu tabel kembar.)*
3. Apakah arah *"ingest web masuk collections"* lahir dari **kebutuhan nyata**
   atau dari kekacauan QBank `v0.9.0` yang kita baca keliru?

## 9. Catatan kejujuran

- **Aku sendiri menambah `collections`** (ADR-0016) **tanpa** menyadari bahwa
  ini menentang ADR-0009 & QBank `master`. Aku membaca ADR-0013 yang dibatalkan,
  merasa alasannya sudah hilang, lalu mengambil arah **pisah** — **tanpa
  memeriksa skema QBank yang sesungguhnya**. Itu kelalaianku, dan sebagian
  kebingungan ini aku penyebabnya.
- Evaluasi ini **tidak** mengubah apa pun. Semua keputusan menunggu pemilik produk.

## Sumber referensi yang dipakai

| Sumber | Dipakai untuk |
|---|---|
| **Martin Fowler**, *PoEAA* — Single/Class Table Inheritance | definisi pola |
| **Oracle/JPA** §12.6 — Advantages & Disadvantages | **kriteria** kapan STI tepat (*"differ primarily in behavior only"*) |
| **GitLab** — *"Polymorphic associations: always use separate tables"* | **argumen kuat untuk PISAH** — diuji, **tak berlaku** di kasus kita (FK kita sah) |
| **SQLAlchemy 2.0** — Inheritance | istilah resmi **"discriminator column"** |
| **Prisma** — Table inheritance | ringkasan STI vs multi-table |
| `ARSITEKTUR-DATA-FINAL.md` · QBank `master` · ADR 0009–0017 | keputusan yang sudah ada di proyek |
