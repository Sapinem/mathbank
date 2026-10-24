# Audit Komprehensif Drizzle ORM — MathBank v2

| Atribut | Nilai |
|---|---|
| **Proyek** | MathBank v2 (`/home/hari/projects/mathbank`) |
| **Commit** | `7c4df34` (`feat(math): render tabel markdown GFM di MathContent`) |
| **Tanggal audit** | 2026-10-17 |
| **Skill acuan** | `drizzle-orm-expert` (`~/.agents/skills/drizzle-orm-expert/SKILL.md`) |
| **Versi terpasang** | `drizzle-orm@0.45.3`, `drizzle-kit` (schema di `src/lib/db/schema/*.ts`) |
| **Database** | PostgreSQL 18.6 @ `localhost:5433`, ekstensi `pg_trgm 1.6`, `vector 0.8.6`, `pgcrypto 1.4` |
| **Ukuran data** | 11.889 soal, 579 bundle, 67.794 baris `audit_logs`, 174 topik |
| **Metode** | Baca kode (schema, client, service, route), bedah 16 migrasi + snapshot Drizzle, **verifikasi empiris** ke DB hidup via `psql`, `drizzle-kit` dialect, dan `tsc --noEmit` |

> **Ringkasan metode validasi.** Setiap temuan di bawah diberi label bukti:
> 🟢 **Terverifikasi empiris** (dijalankan terhadap DB/kompiler), 🟡 **Terverifikasi lewat baca kode** (jalur pasti, dampak bergantung data), ⚪ **Risiko teoretis** (perlu kondisi tertentu).

---

## 1. Ikhtisar Eksekutif

Kualitas lapisan data MathBank **di atas rata-rata industri**: pola `db.transaction`, proyeksi kolom eksplisit untuk mencegah kebocoran `answer_key`, penjagaan balapan optimistik, penanganan pelanggaran UNIQUE (23505), serta pemisahan *functional core / imperative shell* pada filter. Tidak ditemukan celah **SQL injection** — semua nilai pengguna di-*bind* sebagai parameter `$n`, diverifikasi lewat `PgDialect.sqlToQuery()`.

Namun audit menemukan **4 kelas masalah** yang layak ditindaklanjuti:

1. **Invarian domain kritis hanya ada di aplikasi, tidak di DB** — menghasilkan **data korup di produksi**. Ada **57 soal dengan label opsi duplikat** (mis. `A,B,C,D,D`) dan **16 soal `single_choice` dengan >1 jawaban benar** 🟢.
2. **Drift skema ↔ DB ↔ migrasi**: `media_assets.short_id` & beberapa `CHECK`/index hidup di skrip *manual* yang **tidak terdeteksi** oleh alat drift Drizzle. `pnpm db:push` (dipaparkan sebagai skrip) berpotensi **menghapus constraint** itu 🟡.
3. **Pola transaksi/deret balapan** di jalur ingest & pengurutan paket (`MAX()+1`, `SELECT`-lalu-`INSERT` tanpa constraint unik) 🟡.
4. **Utang performa**: seluruh 11.889 soal **tanpa embedding** (mode semantik selalu jatuh ke trigram), trigger `usage_count` melakukan full-count per baris, dan beberapa index tak terpakai 🟢.

### Skor Kepatuhan terhadap `drizzle-orm-expert`

| Prinsip (dari SKILL.md) | Status | Catatan |
|---|---|---|
| `{ schema }` diteruskan ke `drizzle()` | ✅ | `src/lib/db/index.ts:16` |
| `relations()` didefinisikan untuk `db.query.*` | ✅ | Lengkap; **tidak ada** pemakaian `db.query.*` (lihat R-08) |
| Gunakan `drizzle-kit generate` + `migrate`, **bukan** `push` | ⚠️ | `db:push` diekspos di `package.json`; banyak objek diluar jalur migrasi |
| Prepared statements untuk kueri panas | ❌ | 0 pemakaian `.prepare()` |
| Pool koneksi (bukan per-request) | ✅ | Satu pool `max: 10` di modul singleton |
| Hindari raw SQL bila builder mampu | ⚠️ | Raw SQL intensif tapi **ter-parameterisasi** |
| Index di skema tipe (`index()`/`uniqueIndex()`) | ✅ | Konsisten di semua tabel |
| `InferSelectModel`/`InferInsertModel` untuk tipe | ✅ | Memakai `$inferSelect`/`$inferInsert` (ekuivalen) |
| Relational query API untuk menghindari N+1 | ⚠️ | Memakai *batch query* manual (cukup baik), tetapi `attachOptions` tetap 3 kueri |
| Transaksi untuk operasi jamak | ✅ | 6 jalur mutasi utama; 1 celah (R-04) |

**Kepatuhan keseluruhan: ±78%** — arsitektur solid, dengan celah pada invarian DB dan efisiensi kueri.

---

## 2. Ringkasan Temuan

| ID | Tingkat | Judul | Bukti |
|---|---|---|---|
| **R-01** | 🔴 Kritis | Data korup: label opsi duplikat & `single_choice` multi-kunci; tidak ada constraint DB | 🟢 |
| **R-02** | 🔴 Kritis | `pnpm db:push` akan mendriftkan/menimpa objek manual (CHECK short_id, UNIQUE constraint↔index) | 🟢 |
| **R-03** | 🟠 Tinggi | `onConflictDoNothing` menelan kegagalan `bundle_items` → soal kreatif tapi tak tertaut | 🟡 |
| **R-04** | 🟠 Tinggi | `linkQuestionToBundle`/`addItem`: `MAX(order_index)+1` di luar transaksi & tanpa UNIQUE → `order_index` bentrok | 🟡 |
| **R-05** | 🟠 Tinggi | `uniqueSlug` TOCTOU (SELECT-lalu-INSERT) tanpa retry 23505 di create/update | 🟡 |
| **R-06** | 🟠 Tinggi | `duplicateBundle` tidak atomik (create + insert item di luar transaksi) | 🟡 |
| **R-07** | 🟠 Tinggi | `bundle.status` diubah langsung tanpa FSM/validasi (`ready` dengan soal tanpa kunci) | 🟡 |
| **R-08** | 🟡 Sedang | `updateQuestion` tidak memvalidasi `parentId` (kebalikan dari `createQuestion`) | 🟡 |
| **R-09** | 🟡 Sedang | `updateQuestion` me-reset `solutions`/opsi (`DELETE`+`INSERT`) → ID & metadata terverifikasi hilang | 🟡 |
| **R-10** | 🟡 Sedang | `usage_count` dihitung ulang penuh **per baris** via trigger — O(n²) saat re-ingest | 🟡 |
| **R-11** | 🟡 Sedang | `recount_topic_usage` mengabaikan `NEW`+`OLD` (UPDATE tidak memicu recount; multi-row boros) | 🟡 |
| **R-12** | 🟡 Sedang | Mode semantik: 0 soal ber-embedding → pencarian diam-diam kosong/ambil jalur salah | 🟢 |
| **R-13** | 🟡 Sedang | `count(*)` + `SELECT` tanpa tiebreak deterministik → paginasi tak stabil | 🟡 |
| **R-14** | 🟡 Sedang | Arsip paket tanpa *restore*; audit salah aksi; soal di dalamnya tak ikut ditandai | 🟡 |
| **R-15** | 🟡 Sedang | `hardDeleteQuestion`: RESTRICT `<default>` + audit ditulis **setelah** hapus; FK anak bisa persisten | 🟡 |
| **R-16** | 🟡 Sedang | Pool `max: 10` tanpa timeout & tanpa penanganan idle/error → kelaparan koneksi di bawah beban | ⚪ |
| **R-17** | 🟢 Rendah | Vektor diformat sebagai literal string (`[..]`) — benar-parameterisasi tapi boros & rapuh | 🟢 |
| **R-18** | 🟢 Rendah | Ada index tak terpakai (`idx_questions_has_embedding`, index audit dan topics) | 🟢 |
| **R-19** | 🟢 Rendah | `invariants.ts`: hitungan `checks` rapuh; nama CHECK index media tak diaudit | 🟡 |
| **R-20** | 🟢 Rendah | Tidak ada prepared statement dan `db.batch()` — banyak round-trip | 🟡 |
| **R-21** | 🟢 Rendah | Tabel auth tanpa index `user_id`/`expires_at` untuk session/account/verification | 🟡 |
| **R-22** | 🟢 Rendah | `schema/index.ts` menjadi barrel yang menarik `db` saat impor tipe (cold start) | 🟡 |

---

## 3. Temuan Rinci

### 🔴 R-01 — Data korup: label opsi duplikat & `single_choice` multi-kunci

**Klasifikasi:** Bug data (sudah terjadi) + celah desain skema.

**Bukti 🟢** (kueri terhadap DB hidup):

```sql
-- 57 soal punya label opsi duplikat dalam satu soal
select count(*) from (select question_id,label,count(*) c
                      from question_options group by 1,2 having count(*)>1) x;  -- 57

-- 16 soal single_choice punya >1 opsi benar
select q.id, string_agg(qo.label, ',')
from questions q join question_options qo on qo.question_id=q.id
where q.question_type='single_choice' and qo.is_correct
group by 1 having count(*)>1;   -- 16 baris, mis. label "D,D" dan "B,C,B,C"
```

Contoh konkret: soal `01a1155c-c2bb-7a67-a625-1da54fffaf72` memiliki opsi berurutan `A,B,C,D,D`, dan dua baris berlabel `D` sama-sama `is_correct = true`.

**Akar masalah skema** (`src/lib/db/schema/question.ts:128-148`):

```ts
(id: uuidPk(), questionId: ..., label: ..., isCorrect: ..., orderIndex: ...),
(t) => [index("idx_question_options_question").on(t.questionId)],   // ← hanya index biasa
```

| Invarian | Ditegakkan di? |
|---|---|
| `label` unik per soal | ❌ tidak ada (app/DB) |
| `orderIndex` unik per soal | ❌ tidak ada |
| `single_choice` tepat 1 benar | ❌ tidak ada |
| `multiple_choice_checkbox` ≥2 benar | ❌ tidak ada |
| `childOrder`/`orderIndex` ≥ 0 | ❌ tidak ada `CHECK` |

Validator kontrak (`src/lib/contracts/question.ts:110-116`) juga **tidak** memeriksa duplikasi label: `label: z.string().min(1).max(10)` menerima `"D"` dua kali, dan `orderIndex` hanya dibatasi `min(0)` tanpa keunikan.

**Rekonstruksi asal data:** analisis backup (`backups/mathbank_pre_cleanup*`) menunjukkan set `A–D` normal; baris `D` ganda berdekatan (`order_index` 3 & 4) menunjukkan **penggabungan daftar opsi yang sudah berisi `D`** lalu ditambahkan `D` lagi (pola ingest ulang/merge, bukan `updateQuestion` yang menghapus semua opsi lebih dulu). Karena `hardDeleteQuestion`/`updateQuestion`/`createQuestion` selalu menghapus-lalu-insert, satu-satunya jalan baris tambahan muncul identik-sama adalah **insert tanpa dedup** — konsisten dengan `onConflictDoNothing` (R-03) dan alur *merge/extend* opsi.

**Dampak:** soal tidak dapat dinilai objektif; ekspor Moodle menerbitkan kunci ganda; `answerKey.correct` bisa menyebut label yang ambigu. Ini pelanggaran integritas data yang paling serius.

**Rekomendasi:**

```ts
// src/lib/db/schema/question.ts
export const questionOptions = pgTable(
  "question_options",
  {
    // ...
  },
  (t) => [
    index("idx_question_options_question").on(t.questionId),
    uniqueIndex("uq_question_options_label").on(t.questionId, t.label),      // cegah A,B,C,D,D
    uniqueIndex("uq_question_options_order").on(t.questionId, t.orderIndex), // cegah urutan ganda
    check("chk_question_options_order", sql`${t.orderIndex} >= 0`),
  ],
);
```

Tambahkan pulakontrak Zod:

```ts
options: z.array(optionInputSchema).default([]).superRefine((opts, ctx) => {
  const labels = opts.map(o => o.label.toUpperCase());
  if (new Set(labels).size !== labels.length)
    ctx.addIssue({ code: "custom", message: "Label opsi duplikat (mis. D dua kali)." });
}),
```

Lalu migrasi data perbaikan (review manual dulu, jangan auto-hapus):

```sql
-- Karantina dulu agar bisa ditinjau guru, JANGAN langsung hapus.
UPDATE questions SET is_flagged = true,
  flag_notes = coalesce(flag_notes || ' | ', '') || 'Opsi duplikat terdeteksi audit 2026-10-17'
WHERE id IN (SELECT question_id FROM question_options GROUP BY question_id, label HAVING count(*) > 1);
```

---

### 🔴 R-02 — Drift skema: `db:push` dapat menghapus objek manual

**Klasifikasi:** Kepatuhan proses migrasi (pelanggaran langsung prinsip SKILL.md: *"Never use `drizzle-kit push` in production"*).

**Fakta 🟢:**

1. `package.json` mengekspos `"db:push": "drizzle-kit push"`.
2. Objek DB penting **tidak** berasal dari migrasi Drizzle:
   - `chk_media_assets_short_id` + `uq_media_short_id` → `drizzle/manual/media-short-id.sql`
   - 24 trigger, 1 index HNSW, fungsi `set_updated_at`, `reject_audit_mutation` → `drizzle/manual/db_safety.sql`
   - Seed data & view → `drizzle/manual/provision-prod.sql`
3. **Drift nyata antara kode dan DB** untuk `media_assets.short_id`:

| Objek | Skema Drizzle / snapshot | DB hidup |
|---|---|---|
| `uq_media_short_id` | **`uniqueIndex`** (snapshot `method: btree`, bukan constraint) | **`UNIQUE CONSTRAINT`** (`pg_constraint`) |
| `chk_media_assets_short_id` | **tidak ada** di skema | **ada** (`CHECK`) |

Snapshot Drizzle (`drizzle/meta/0015_snapshot.json`) tidak memuat `chk_media_assets_short_id`, dan `invariants.ts` hanya mewajibkan 2 CHECK (`chk_questions_difficulty`, `chk_topics_level`) — **tidak** mengaudit CHECK media. Akibatnya laporan `pnpm db:verify` menyebut "3 checks" 🟢 tanpa menjamin CHECK media ada.

4. `drizzle-kit push` membandingkan *snapshot/skema* dengan DB dan akan mencoba menyelaraskan keduanya: menghapus index `uq_media_short_id` dan membuat ulang sebagai index (melepas constraint), serta **menyarankan menghapus** `chk_media_assets_short_id` karena tidak ada di skema.

**Dampak:** menjalankan `pnpm db:push` (dokumentasi pengembangan mengizinkannya) dapat **melepas** jaminan format `short_id` dan mengubah semantik UNIQUE, memicu `ON CONFLICT` yang berbeda, serta membuat `db_safety` tidak terpasang. Audit ini **tidak menjalankan** `push` (destruktif), jadi ini celah yang *dapat dipicu*, bukan yang sudah terjadi.

**Rekomendasi:**

1. **Hapus** `db:push` dari `package.json` atau ubah menjadi wrapper yang menolak bila `NODE_ENV=production` dan selalu diikuti `pnpm db:safety`.
2. Pindahkan `chk_media_assets_short_id` **ke skema Drizzle** agar terdeteksi:
   ```ts
   check("chk_media_assets_short_id", sql`${t.shortId} ~ '^[0-9A-Za-z]{8}$'`),
   ```
   dan ubah `uq_media_short_id`/`uq_media_content_hash` menjadi bentuk yang identik dengan DB (constraint vs index) agar generate tidak berosilasi.
3. Tambahkan **uji drift otomatis** di CI: jalankan `drizzle-kit generate` ke direktori sementara dan gagalkan bila menghasilkan file baru (artinya skema berubah tanpa migrasi).
4. Tambahkan `chk_media_assets_short_id` ke `REQUIRED_CHECKS` di `src/lib/db/invariants.ts` (lihat R-19).

---

### 🟠 R-03 — `onConflictDoNothing` menyembunyikan kegagalan tautan bundle

**Klasifikasi:** Bug logika (laporan hasil tidak akurat).

**Bukti 🟡** — `src/lib/ingest/commit.ts:164-183`:

```ts
const [last] = await db.select({ max: sql`COALESCE(MAX(...),0)` })...;
await db.insert(bundleItems).values({ ..., orderIndex: Number(last?.max ?? 0) + 1, ... })
        .onConflictDoNothing();   // ← tak ada .returning(); hasil tak diperiksa
```

Lalu pada pembuatan soal baru (`commit.ts:~250`), `createQuestion` **commit ke DB** lebih dulu, baru `linkQuestionToBundle` dipanggil **di luar** transaksi itu. Karena `bundle_items.order_index` tidak UNIQUE dan UNIQUE diabaikan diam-diam, setiap konflik (mis. soal yang sama di artikel yang sama, atau `orderIndex` bentrok karen R-04) menghasilkan **soal yang dibuat tetapi tidak tertaut**, sementara `result.created++` tetap mengklaim berhasil.

**Dampak:** soal "yatim" (tak masuk naskah mana pun) — melanggar ADR-0014 #7 ("ingest WAJIB membuat bundle — tak ada soal nyasar").

**Rekomendasi:**

```ts
const linked = await db.insert(bundleItems)
  .values({ bundleId, questionId, orderIndex, itemNumber })
  .onConflictDoNothing()
  .returning({ id: bundleItems.id });
if (linked.length === 0) {
  // Sudah tertaut sebelumnya → idempoten (linked++), BUKAN created++.
  result.linked++;
} else {
  result.created++;
}
```

Serta bungkus `createQuestion` + `linkQuestionToBundle` dalam **satu** `db.transaction` (lihat R-06 untuk pola umum).

---

### 🟠 R-04 — Deret balapan `MAX(order_index)+1` tanpa UNIQUE

**Klasifikasi:** Race condition / invariant DB.

**Bukti 🟡** — dua lokasi:

- `src/lib/ingest/commit.ts:164-181`
- `src/lib/services/bundle-items.ts` (`addItem`, ~`SELECT COALESCE(MAX(order_index), 0)` lalu INSERT)

Skema hanya punya `index("idx_bundle_items_order").on(t.bundleId, t.orderIndex)` — **bukan** UNIQUE (`bundle.ts:75`). Dua request bersamaan (dua guru menambah soal, atau dua worker ingest untuk bundle yang sama) mendapat `max` yang sama → `order_index` kembar. Urutan tampil jadi non-deterministik.

**Rekomendasi:**

```ts
uniqueIndex("uq_bundle_items_order").on(t.bundleId, t.orderIndex),
```

atau ambil nilai dalam transaksi dengan `SELECT ... FOR UPDATE` pada baris bundle, atau pindah ke `order_index` berbasis `bigserial` per-bundle (mis. `nextval` dengan sequence per bundle) guna menghindari konflik saat penyisipan di tengah.

---

### 🟠 R-05 — `uniqueSlug` TOCTOU tanpa retry

**Klasifikasi:** Race condition ringan + penanganan error.

**Bukti 🟡** — `src/lib/services/bundle-shared.ts:153-174` melakukan loop `SELECT` sampai menemukan slug bebas, lalu **di tempat lain** `createBundle`/`updateBundle` menjalankan `INSERT`/`UPDATE`. Dua request dengan judul sama dapat lolos loop bersamaan → `uq_bundles_slug_active` gagal → 500 (bukan `ConflictError`), karena `createBundle` (`bundle-write.ts`) **tidak** membungkus dengan `withUniqueGuard`.

`updateBundle` juga mengubah slug **setiap** kali judul berubah → link/URL paket lama rusak (slug yang stabil biasanya diinginkan untuk referensi).

**Rekomendasi:**

```ts
const [row] = await withUniqueGuard(
  () => db.insert(bundles).values({ ... }).returning({ id: bundles.id }),
  "Judul paket bentrok, coba lagi.",
);
```

atau tangani 23505 dengan retry 3x (increment suffix). Pertimbangkan mempertahankan slug lama saat update bila tidak ada permintaan eksplisit.

---

### 🟠 R-06 — `duplicateBundle` tidak atomik

**Bukti 🟡** — `bundle-write.ts:141-198`: `createBundle(...)` (transaksi sendiri + audit) lalu `db.select` item, lalu `db.insert(bundleItems)` — semuanya **di luar satu transaksi**. Kegagalan di tengah menghasilkan paket duplikat kosong/setengah isi.

**Rekomendasi:** bungkus dalam `db.transaction` dan tulis audit di dalam atau setelahnya dalam pola *outbox* ringan (lihat juga R-15).

---

### 🟠 R-07 — Status paket tidak dijaga FSM

**Bukti 🟡** — `UpdateBundleInput.status: z.enum([...]).optional()` (`contracts/bundle.ts:35`) dan `updateBundle` menulis `set.status = patch.status` tanpa `assertReady`/`transition`. Sebaliknya, soal punya FSM ketat (`question-status.ts`) + `assertReady` + penjagaan optimistik.

DB saat ini semua `bundles.status = 'draft'` 🟢 — belum ada data rusak, tetapi jalur `ready` tersedia lewat PATCH tanpa validasi (paket `ready` yang berisi soal tanpa kunci).

**Rekomendasi:** gunakan FSM yang sama untuk bundle (`transition("draft","ready")`), panggil `validateBundle()` dan tolak bila `withoutAnswerKey.length > 0`, dan terapkan optimistik `WHERE status = from` seperti `question-status.ts:59`.

---

### 🟡 R-08 — `updateQuestion` melewatkan validasi `parentId`

**Bukti 🟡** — `createQuestion` (`question-write.ts:31-42`) memeriksa: stimulus tidak boleh ber-parent, dan parent harus bertipe `stimulus`. `updateQuestion` hanya menyalin `patch.parentId = parentId` (baris 154) tanpa pemeriksaan apa pun. Perlindungan terakhir adalah trigger `trg_questions_stimulus_depth`, tetapi trigger **tidak** memeriksa bahwa parent bertipe stimulus (hanya kedalaman). Data saat ini bersih 🟢 (`0` anak non-stimulus), tetapi jalur membuka celah.

**Rekomendasi:** ekstrak fungsi `assertValidParent(tx, type, parentId)` dan panggil dari kedua jalur. Tambahkan `CHECK`/trigger `SET NULL`–bukan — lebih tepat trigger seperti yang sudah ada, ditambah `SELECT question_type` parent.

---

### 🟡 R-09 — `updateQuestion` menghapus-lalu-menyisipkan `solutions`

**Bukti 🟡** — `question-write.ts:157-171`. `DELETE FROM solutions WHERE question_id = ?` lalu insert ulang. Dampak:

- `verifiedById`, `aiModelName`, `createdAt` hilang;
- `solutionInputSchema` punya `id` opsional (`contracts/question.ts:128`) tetapi **diabaikan**;
- tiap PATCH memicu audit `update` tanpa `diffPayload`.

**Rekomendasi:** lakukan **upsert** berbasis `id` bila diberikan, hapus hanya yang tidak ada di payload, dan pertahankan `verifiedById`/`authorType` pada baris yang tetap.

---

### 🟡 R-10 — `usage_count` O(n²) per baris (trigger row-level)

**Bukti 🟡** — `drizzle/manual/db_safety.sql:132-172`: trigger `AFTER INSERT OR DELETE ... FOR EACH ROW` menjalankan `SELECT count(*) FROM question_topics WHERE topic_id = ...` untuk **setiap** baris. Pada re-ingest soal dengan 3 topik + 2 tag, ini = 5 full-count. Saat PATCH soal yang memuat `topicIds` (hapus-semua + insert-semua), satu PATCH bisa memicu puluhan count pada tabel 11k+ baris.

**Rekomendasi:** ubah ke `AFTER INSERT OR DELETE ... FOR EACH STATEMENT` dengan `transition tables` (PG 10+):

```sql
CREATE OR REPLACE FUNCTION recount_topic_usage_stmt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE topics t SET usage_count = sub.n
  FROM (SELECT topic_id, count(*) n FROM question_topics
        WHERE topic_id IN (SELECT topic_id FROM changed) GROUP BY 1) sub
  WHERE t.id = sub.topic_id;
  RETURN NULL;
END $$;
```

Atau hitung `usage_count` on-the-fly dengan index `(topic_id)` (sudah ada) di lapisan baca.

---

### 🟡 R-11 — `recount_*` mengabaikan `NEW`+`OLD`

**Bukti 🟡** — `tid := COALESCE(NEW.topic_id, OLD.topic_id)`. Pada `UPDATE` yang mengubah `topic_id` (mis. `ALTER TABLE` atau merge), hanya **satu** sisi dihitung, dan trigger hanya menyala `INSERT OR DELETE` sehingga UPDATE tidak memicu recount sama sekali. Merge tag (`taxonomy/tag.ts`) menangani ini manual, tetapi jalur lain tidak.

**Rekomendasi:** tambahkan `UPDATE OF topic_id`/`tag_id` ke trigger dan tangani `NEW` **dan** `OLD` secara terpisah.

---

### 🟡 R-12 — Pencarian semantik tanpa embedding

**Bukti 🟢** — `select count(*) filter (where embedding is not null) from questions` → **0 / 11.889**.

Pada `question-read.ts:225-258`, mode `semantic` memanggil `embedText()`. Bila `emb.ok` false, `orderBy`/`semanticWhere` tetap `undefined` dan pencarian jatuh ke filter builder — namun karena `byRelevance` bernilai `false` untuk mode semantic (`filters-builder.ts:152`: `!!query.q && query.mode !== "semantic"`), **filter teks juga tidak diterapkan** → pengguna meminta "cari secara semantik" mendapat daftar terbaru tanpa filter apa pun. Bila `emb.ok` tetapi tak ada baris yang cocok, hasil kosong tanpa fallback.

**Rekomendasi:**

```ts
if (query.mode === "semantic" && query.q) {
  const emb = await embedText(...);
  if (!emb.ok || !emb.vector) {
    // fallback eksplisit: perlakukan sebagai teks
    return listQuestions({ ...query, mode: "text" }, viewer);
  }
  // saring juga dengan ambang jarak, dan bila 0 baris → fallback trigram
}
```

Sekaligus: jadwalkan backfill embedding (lihat `scripts/run-*-deepseek`, `src/lib/services/enrichment/embed.ts`) — juga mendukung dedup *near* (R-03 tidak relevan, lihat `dedup.ts` yang hanya bekerja bila embedding ada).

---

### 🟡 R-13 — Paginasi tidak deterministik

**Bukti 🟡** — `question-read.ts:265-284`:

```ts
.orderBy(...finalOrder)   // default: [desc(questions.createdAt)]
.limit(query.limit).offset(query.offset);
```

`created_at` tidak unik (ingest batch me-share `now()`). Tanpa kolom tiebreak (`id`), halaman bisa tumpang-tindih/melewatkan baris. Sama di `bundle-query.ts:106` (`desc(bundles.updatedAt)`).

Selain itu `count(*)` dan `SELECT` dijalankan **berurutan** (2 round-trip) dan tanpa snapshot transaksi → total dan halaman bisa dari dua titik waktu berbeda.

**Rekomendasi:**

```ts
.orderBy(desc(questions.createdAt), desc(questions.id))   // tiebreak stabil
// dan bila perlu konsistensi: db.transaction(async (tx) => { count; select })
```

---

### 🟡 R-14 — Arsip paket tanpa menangani anak

**Bukti 🟡** — `archiveBundle` (`bundle-write.ts:97-113`) hanya mengisi `deletedAt` bundle; `bundle_items` dibiarkan. Soal dianggap "dipakai" hanya oleh paket **aktif** (`isQuestionUsedInBundles` menyaring `deleted_at IS NULL`) — **desain yang disengaja** (T-M7-3) dan aman karena `getBundle` sudah menyaring `deletedAt` (`bundle-query.ts:119`), sehingga `duplicateBundle`/`updateBundle` menolak paket terarsip 🟢.

Yang **belum** terjaga: (a) tidak ada cara *unarchive* (tidak ada `restoreBundle`), sehingga paket terarsip menjadi data mati yang tetap menahan `bundle_items` → `questions` (FK RESTRICT) secara fisik; (b) `archiveBundle` tidak dicatat sebagai `status_change`, hanya `delete`; (c) arsip paket tidak menyentuh `status` soal di dalamnya, sehingga soal `ready` tetap tampil "siap" di daftar meski naskah pemuatnya hilang.

**Rekomendasi:** tambahkan `restoreBundle` (set `deletedAt = null` dengan pemeriksaan slug unik aktif), audit dengan `status_change`, dan dokumentasikan efek arsip terhadap soal di dalamnya.

---

### 🟡 R-15 — `hardDeleteQuestion`: urutan & penanganan error

**Bukti 🟡** — `question-write.ts:297-327`: cek `isQuestionUsedInBundles` (hanya bundle **aktif**) lalu `db.delete(questions)`. FK `bundle_items.question_id → questions.id ON DELETE restrict` **tanpa aksi khusus** = NO ACTION, sehingga bundle **terarsip** akan tetap memblokir DELETE dan menghasilkan **500**, bukan `ConflictError`. Audit `delete` ditulis **setelah** DELETE — bila penulisan audit gagal, penghapusan permanen sudah terjadi tanpa jejak.

**Rekomendasi:** bungkus dengan `withUniqueGuard`-style handler yang memetakan `23503` (FK violation) → `ConflictError`, dan tulis audit dalam transaksi yang sama dengan DELETE (atau outbox).

---

### 🟡 R-16 — Konfigurasi pool

**Bukti ⚪** — `src/lib/db/index.ts:15`: `postgres(connectionString, { max: 10 })`. Tidak ada `idle_timeout`, `connect_timeout`, `max_lifetime`, maupun handler `onnotice`/`onerror`. Di Next.js serverless/multi-instance, `max: 10` per proses × N instance dapat melampaui `max_connections` Postgres, dan kueri tanpa timeout dapat menahan koneksi saat DB lambat.

**Rekomendasi:**

```ts
postgres(connectionString, {
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idle_timeout: 30,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
  onnotice: () => {},
});
```

---

### 🟢 R-17 — Format literal vektor

**Bukti 🟢** — `dedup.ts:60,68,79` dan `question-read.ts:250,252` membangun `const literal = \`[${vec.join(",")}]\`` lalu menaruhnya di template `sql\`... ${literal}::vector\``. Verifikasi `PgDialect.sqlToQuery()` → `embedding <=> $1::vector` dengan params `['[0.1,0.2,0.3]']` → **aman dari injeksi** (nilai ber-*bind*). Namun memangkas tipe: `customType.driverData` sudah `string`, sebaiknya gunakan helper terpusat:

```ts
// src/lib/db/vector.ts
export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;
export const cosineDistance = (col: PgColumn, v: number[]) =>
  sql<number>`${col} <=> ${toVectorLiteral(v)}::vector`;
```

Root of truth di satu tempat = mengurangi kemungkinan format salah (mis. `NaN`/`Infinity`) dan menghemat duplikasi.

---

### 🟢 R-18 — Index tak terpakai

**Bukti 🟢** — `pg_stat_user_indexes` menunjukkan `idx_questions_has_embedding` (16 kB) **0 scan**, `idx_audit_logs_created_at` **0 scan**, beberapa index `topics` 0–2 scan. Index parsial `has_embedding` (`id WHERE embedding IS NOT NULL`) **tidak** bisa dipakai oleh kueri yang menyaring `deleted_at`/`grade`/`ORDER BY <=>`. Hapus atau ubah menjadi index parsial yang benar-benar dipakai, mis. `(grade, id) WHERE embedding IS NOT NULL AND deleted_at IS NULL` untuk mendukung `dedup.ts`.

---

### 🟢 R-19 — Cakupan audit invarian kurang

**Bukti 🟡** — `invariants.ts`:

- `checkConstraints: 2` (`EXPECTED_INVARIANTS`) padahal DB punya 3 → pengecekan berbasis `>=` jadi **hanya membuktikan ≥2**; penambahan CHECK baru tidak akan terdeteksi.
- `REQUIRED_CHECKS` tidak memuat `chk_media_assets_short_id`.
- `triggers: 24` menghitung **semua** trigger `NOT tgisinternal` termasuk trigger dari migrasi auth, bukan hanya daftar `REQUIRED_TRIGGERS`.
- Kueri (4 round-trip terpisah) bisa digabung menjadi 1 (CTE) untuk respons `/api/ready` lebih cepat.

**Rekomendasi:** ganti perbandingan `>=` menjadi himpunan eksak (`count === expected`), pindahkan daftar ke satu sumber bersama `scripts/db-verify.ts`, dan tambahkan pemeriksaan `uq_media_content_hash` sebagai *constraint* vs *index*.

---

### 🟢 R-20 — Tanpa prepared statement / batch

**Bukti 🟡** — Tidak ada `.prepare()`. `listQuestions` mengirim 4 kueri (count, rows, options, parents) secara berurutan. Sesuai SKILL.md *Performance Optimization*, kueri panas (daftar soal, detail paket) idealnya prepared + `db.batch([...])` (postgres-js mendukung) untuk memangkas round-trip.

**Rekomendasi:** prepared untuk parameter umum:

```ts
const listPage = db.select(questionColumns()).from(questions)
  .where(sql`${questions.deletedAt} IS NULL`)
  .limit(sql.placeholder("limit")).offset(sql.placeholder("offset"))
  .prepare("list_questions_page");
```

(Ketahui batasan: `postgres.js` prepared statements tidak boleh mengandung DDL; aman untuk kueri baca.)

---

### 🟢 R-21 — Index auth kurang

**Bukti 🟡** — `session.user_id`, `account.user_id`, `verification.identifier` tidak ber-index (hanya PK/unique token). `session.expires_at` juga tanpa index; pembersihan sesi kadaluarsa akan full-scan. Better Auth mengandalkan pencarian `session.token` (unique, OK) tetapi `listSessions`/revoke-by-user akan scan.

**Rekomendasi:**

```ts
index("idx_session_user").on(t.userId),
index("idx_session_expires").on(t.expiresAt),
index("idx_account_user").on(t.userId),
index("idx_verification_identifier").on(t.identifier),
```

---

### 🟢 R-22 — Barrel `schema/index.ts` & jalur impor tipe

**Bukti 🟡** — `src/lib/db/schema/index.ts` mengekspor **semua** modul (14 tabel). Modul murni seperti `filters-builder.ts` sudah sadar tidak mengimpor `@/lib/db`, tetapi `question.ts`/`taxonomy.ts` dkk. masih terlalu besar untuk cold start; jika diimpor dari RSC klien dapat menarik lebih banyak modul daripada yang dibutuhkan (meskipun saat ini tidak ada impor langsung ke client).

**Rekomendasi:** dorong impor spesifik (`@/lib/db/schema/question`) di jalur klien, dan gunakan `import type` untuk tipe.

---

## 4. Analisis Kepatuhan terhadap Skill

### 4.1 Yang sudah baik ✅

1. **Pool singleton** di `index.ts`, tidak ada koneksi per-request di kode aplikasi (peringatan: beberapa `.db.test.ts` membuat pool sendiri — benar untuk tes).
2. **`{ schema }`** diteruskan → `db.query.*` tersedia (walau tak dipakai).
3. **Proyeksi kolom eksplisit** (`projections/question.ts`) dengan uji unit yang memastikan `answerKey`, `embedding*` tidak pernah ikut — implementasi langsung dari saran keamanan skill.
4. **Relasi `relations()`** lengkap, termasuk *self-relation* ber-`relationName` (`questionChildren`, `topicHierarchy`, `assetLineage`) — pola yang benar.
5. **Transaksi** pada `createQuestion`, `updateQuestion`, `reorderItems`, `mergeTag`, `updateTopic`, enrichment — tidak ada rantai INSERT yang dapat gagal parsial di jalur utama.
6. **Penjaga balapan optimistik** (`question-status.ts`) dengan `WHERE status = from` + `returning` dan 409 informatif.
7. **Pemetaan 23505 → 409** via `withUniqueGuard` (dipakai topik/paket). Perlu diperluas ke bundle create/update (R-05) dan FK (R-15).
8. **Anti-duplikat `contentHash`** sebagai *partial unique index* (`WHERE deleted_at IS NULL AND content_hash IS NOT NULL`) di skema — benar, karena `deleted_at` soft-delete butuh partial index.
9. **Raw SQL ter-parameterisasi** (`sql.join`, `${...}`), tidak ada `sql.raw` (0 kemunculan) → tidak ada jalur injeksi yang ditemukan.

### 4.2 Yang perlu diperbaiki ❌

| Prinsip skill | Ditemukan | Tindakan |
|---|---|---|
| Hindari `push` di produksi | `db:push` diekspos + banyak objek di luar migrasi | Hapus/diperketat → R-02 |
| Invarian di skema | Tidak ada UNIQUE label opsi, `order_index` bundle | R-01, R-04 |
| Relational API/anti-N+1 | Manual batch (cukup), tetapi 4 round-trip di `listQuestions` | R-20 |
| Prepared statements | Tidak ada | R-20 |
| Index sesuai kueri | Index parsial salah sasaran, index auth kurang | R-18, R-21 |

---

## 5. Rekomendasi Berprioritas

### Segera (Sprint ini — risiko data/keamanan)

1. **R-01**: Flag 57 + 16 soal yang korup ke daftar telaah guru, lalu tambahkan `uq_question_options_label` + validasi Zod. *(Dampak tinggi, biaya rendah.)*
2. **R-02**: Hapus `db:push`; pindahkan `chk_media_assets_short_id` ke skema; tambahkan uji drift CI.
3. **R-03/R-04**: Periksa `returning()` pada `onConflictDoNothing`; tambahkan `uq_bundle_items_order`; bungkus create+link dalam satu transaksi.

### Sprint berikutnya (Integritas & konsistensi)

4. **R-05/R-06/R-07/R-08/R-09**: `withUniqueGuard` untuk bundle, transaksi duplikasi, FSM bundle, validasi `parentId` di update, upsert solusi.
5. **R-15**: Peta FK 23503 → `ConflictError`; audit di dalam transaksi.
6. **R-12**: Fallback pencarian semantik yang eksplisit + rencana backfill embedding.

### Kuartal berikutnya (Performa & observabilitas)

7. **R-10/R-11**: Trigger `usage_count` → pernyataan (transition tables), tangani UPDATE.
8. **R-13/R-20**: Tiebreak paginasi, prepared + `db.batch` untuk `/api/questions`.
9. **R-16**: Parameter pool via env; **R-18/R-21**: bersihkan/bangun index.

---

## 6. Lampiran — Bukti Empiris

### 6.1 Perintah verifikasi utama

```bash
# Invarian DB
psql -Atc "select count(*) from pg_constraint where contype='c' and connamespace='public'::regnamespace"   # 3
psql -Atc "select count(*) from pg_trigger where not tgisinternal"                                        # 24
psql -Atc "select indexname from pg_indexes where indexdef ilike '%hnsw%'"                                # idx_questions_embedding_hnsw

# R-01
psql -Atc "select count(*) from (select question_id,label from question_options group by 1,2 having count(*)>1) x"        # 57
psql -Atc "select count(*) from (select qo.question_id from question_options qo join questions q on q.id=qo.question_id
          where q.question_type='single_choice' and qo.is_correct group by 1 having count(*)>1) w"                         # 16

# R-12
psql -Atc "select count(*) filter (where embedding is not null)||'/'||count(*) from questions"                             # 0/11889

# R-02 (drift constraint vs index)
psql -Atc "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='media_assets'::regclass and contype in ('c','u')"
# → uq_media_short_id | UNIQUE (short_id)   &   chk_media_assets_short_id | CHECK (short_id ~ ...)
# sedangkan snapshot Drizzle hanya punya uq_media_short_id sebagai *index*.
```

### 6.2 Verifikasi parameterisasi (Node + Drizzle dialect)

```js
const d = new PgDialect({ casing: "snake_case" });
d.sqlToQuery(sql`SELECT embedding <=> ${"[0.1,0.2,0.3]"}::vector FROM questions`);
// => { sql: 'SELECT embedding <=> $1::vector FROM questions', params: ['[0.1,0.2,0.3]'] }
```

### 6.3 Typecheck

```
npx tsc --noEmit   → exit 0 (0 galat)
```

### 6.4 File yang diperiksa (rincian)

| Area | Berkas |
|---|---|
| Client & skema | `src/lib/db/index.ts`, `src/lib/db/schema/*.ts` (13), `_columns.ts`, `_enums.ts` |
| Helper DB | `src/lib/db/errors.ts`, `src/lib/db/invariants.ts`, `src/lib/db/projections/question.ts` |
| Migrasi | `drizzle/0000–0015_*.sql`, `drizzle/meta/0015_snapshot.json`, `drizzle/manual/*.sql` |
| Service | `question-write.ts`, `question-status.ts`, `question-read.ts`, `bundle-*.ts` (4), `taxonomy/*.ts`, `enrich/enrich.ts`, `enrich/taxonomy-tx.ts`, `media/hygiene.ts`, `media/register.ts`, `settings-service.ts`, `agent-key-service.ts`, `audit.ts` |
| Query builder | `question/filters.ts`, `question/filters-builder.ts`, `ingest/commit.ts`, `ingest/dedup.ts`, `ingest/event-resolve.ts`, `ingest/queue.ts` |
| Route & auth | `app/api/questions/route.ts`, `app/api/questions/[id]/route.ts`, `app/api/health/route.ts`, `app/api/ready/route.ts`, `auth/server.ts`, `instrumentation.ts` |

---

## 7. Kesimpulan

Lapisan data MathBank dibangun dengan **pola Drizzle yang baik dan disiplin keamanan** (proyeksi, transaksi, optimistik, parameterisasi) — tidak ada kerentanan injeksi dan tidak ada kebocoran `answer_key` pada jalur baca yang diperiksa. Masalah yang paling mendesak bukan pada *kode kueri*, melainkan pada **kontrak data**: invarian kunci (`label`/`kunci tunggal`) dijaga hanya di aplikasi, sehingga data yang sudah masuk lewat jalur ingest yang tidak memvalidasi telah **merusak 73 soal** (57 label ganda + 16 kunci ganda). Memindahkan invarian itu ke skema (`uniqueIndex` + `CHECK`) dan menutup jalur `db:push` akan memberi jaring pengaman berlapis sesuai prinsip utama `drizzle-orm-expert`: *schema is the contract, migrations are the only path, production never uses `push`*.
