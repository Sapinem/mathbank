# AUDIT — ARSITEKTUR & DATA MathBank

> **Lingkup:** seluruh dokumen arsitektur & data di `docs/` + root, disilang-cek ke **kode Drizzle**, **migrasi SQL**, dan **DB hidup** (PG 18 :5433).
> **Metode:** pembacaan penuh 21 dokumen `docs/*.md` + `README.md` + `CHANGELOG.md` + `CONSTRAINTS.md` + `AGENTS.md`/`CLAUDE.md`, lalu verifikasi langsung ke `src/lib/db/schema/*`, `drizzle/*.sql`, dan katalog `information_schema`/`pg_constraint` di DB.
> **Tanggal audit:** 2026-09-29.
> **Kesimpulan umum:** Dokumentasi **kaya & ambisius**, tetapi sudah **menyimpang dari kenyataan kode** di beberapa titik penting. Ada **1 temuan kritis** (invarian/constraint & index HNSW yang didokumentasikan **tidak ada** di DB), **beberapa temuan tinggi** (migrasi ≠ DB, UUIDv7 vs UUIDv4, angka tabel 18 vs 27), dan sejumlah inkonsistensi antar-dokumen yang perlu dirapikan agar "satu sumber kebenaran" benar-benar tercapai.

---

## 0. Cara Membaca Laporan

| Tingkat | Arti |
|---------|------|
| 🔴 **Kritis** | Bertentangan dengan kenyataan sistem; berpotensi bug/data-integrity |
| 🟠 **Tinggi** | Dokumen saling bertentangan atau menyatakan "selesai" padahal belum |
| 🟡 **Sedang** | Inkonsistensi yang membingungkan (angka, nama, status) |
| 🟢 **Rendah** | Kebersihan/kerapian dokumen |

Setiap temuan punya: **Klaim dokumen → Bukti → Dampak → Rekomendasi**.

---

## 1. Ringkasan Temuan

| # | Tingkat | Temuan | Bukti inti |
|---|---------|--------|-----------|
| **F1** | 🔴 Kritis | **0 CHECK constraint & 0 index HNSW** di DB, padahal dokumen & CHANGELOG mengklaimnya ada | `pg_constraint contype='c'` → **0 baris**; `pg_indexes ILIKE '%hnsw%'` → **0** |
| **F2** | 🔴 Kritis | **Migrasi ≠ DB:** 21 trigger `updated_at` ada di DB tapi **tidak ada di file migrasi** mana pun | `drizzle/*.sql` tak ada `CREATE TRIGGER`; DB punya 21 trigger |
| **F3** | 🟠 Tinggi | **UUIDv4 ≠ UUIDv7:** kode & DDL pakai `gen_random_uuid()`, dokumen mewajibkan `uuidv7()` | `questions.id` default = `gen_random_uuid()`; SKEMA-DB-DETAIL T17, L8 |
| **F4** | 🟠 Tinggi | **AUDIT-KODE.md mengklaim "DB cocok dengan dokumen (27 tabel/21 trigger/79 indeks/23 FK)"** — separuh klaim tak terverifikasi | Trigger ✓, tabel ✓, FK ✓, **tetapi CHECK & HNSW ✗** |
| **F5** | 🟠 Tinggi | **"18 tabel" vs "27 tabel":** dokumen inti (ARSITEKTUR-DATA-FINAL, MILESTONE) bilang 18; kenyataan 27 | Kode & DB = **27**; `SKEMA-DB-DETAIL` sudah mengoreksi, dokumen lain belum |
| **F6** | 🟠 Tinggi | **`answer_key` wajib saat `ready`** — dokumen saling bertentangan (wajib vs tidak diblokir) | SKEMA-DB invarian#2 "wajib"; v2 K28 & interview#33 "tidak diblokir" |
| **F7** | 🟠 Tinggi | **`source_kind` termasuk `competition`, `bundle_type` termasuk `exercise`** — melampaui keputusan interview | Enum kode punya `competition` & `exercise`; v2 hanya `book|website|school` & `source|exam` |
| **F8** | 🟡 Sedang | **Seeder taksonomi: sumber `curriculum.yaml` TIDAK ADA di repo** (dibaca dari `../qbank/config/`) | `find -iname '*curriculum*'` → kosong; seeder default `../qbank/config/curriculum.yaml` |
| **F9** | 🟡 Sedang | **Jumlah grade: 16 vs 19** (interview/migrasi bilang 16; CHANGELOG & DB = 19) | DB `grades` = **19**; CHANGELOG "19 jenjang"; interview "16 grade" |
| **F10** | 🟡 Sedang | **`usage_count` "via trigger"** (T12, invarian#8) — tidak ada trigger usage_count di DB | Hanya trigger `updated_at`; tak ada fungsi/trigger `usage_count` |
| **F11** | 🟡 Sedang | **`VISION.md` & `ROADMAP.md` masih berjudul QBank**, bukan MathBank | Judul "VISI QBank", "ROADMAP QBank v1.0.0"; dibiarkan sebagai "perlu ditinjau" |
| **F12** | 🟡 Sedang | **`RENCANA-MIGRASI-DATA.md` masih "hidup"** padahal migrasi QBank **dibatalkan** | PRD §Non-Goals: "Migrasi data QBank (dibatalkan)"; RIWAYAT: "DIBATALKAN" |
| **F13** | 🟡 Sedang | **`ARSITEKTUR-SISTEM-FULL.md` memetakan QBank, bukan MathBank** (23 file schema, 5 tool MCP, dst.) | Dokumen menulis "QBank", 24 layanan, sedangkan MathBank baru M3 |
| **F14** | 🟡 Sedang | **Jumlah dokumen: README bilang "20", AS-FULL bilang "20 file", kenyataan 21** | `ls docs/*.md | wc -l` = 21 |
| **F15** | 🟢 Rendah | **Nama file enum: `_enums.ts`** ≠ rencana L7 (`enums.ts`); jumlah file schema 10 vs rencana ~14 | L7 §6.1 merencanakan 14 file; kode = 10 (+ `_enums` `index`) |
| **F16** | 🟢 Rendah | **Klaim `pnpm db:push` / `db:migrate` menghasilkan trigger** — pengguna tak akan mendapatkannya dari repo bersih | Trigger hanya ada di DB lokal, bukan di migrasi |
| **F17** | 🟢 Rendah | **CONSTRAINTS #25 (KaTeX `\(...\)`) vs kode `$...$`** — sudah diakui di RIWAYAT tapi belum diputuskan | RIWAYAT §Rancangan Responsif menandai inkonsistensi ini |
| **F18** | 🟢 Rendah | **`DESIGN-THEME-FRAMEWORK.md` pakai `#2563EB`** di contoh, padahal palet FINAL `#0158CA` | §2 contoh `--src-primary: #2563EB`; §11 `#0158CA` |

---

## 2. Temuan Kritis

### 🔴 F1 — Invarian (CHECK) & Index HNSW Tidak Ada di DB

**Klaim dokumen:**
- `SKEMA-DB-DETAIL.md` §Invarian: 9 invarian, "Cara: CHECK + trigger" (stimulus depth ≤1, `ready` wajib `answer_key`, dst.).
- `ARSITEKTUR-DATA-FINAL.md` §2.4: `CONSTRAINT chk_difficulty CHECK (difficulty BETWEEN 1 AND 5)`, `chk_stimulus_not_flagged_ready`, `idx_questions_embedding_hnsw USING hnsw (...)`.
- `L7-TINJAUAN-KRITIS-DATA.md` §5: daftar CHECK + unique partial index.
- `CHANGELOG.md` v0.2.0: "**Invarian** — termasuk RESTRICT (stimulus dengan anak tak bisa dihapus), via Drizzle + **trigger**".
- `MILESTONE.md` M1: "[ ] Invarian CHECK (stimulus 1 level; `ready` wajib `answer_key`; dst.)".

**Bukti (DB hidup, PG 18 :5433):**
```
SELECT count(*) FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace;
=> 0                       -- TIDAK ADA satu pun CHECK constraint

SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexdef ILIKE '%hnsw%';
=> (0 rows)                -- TIDAK ADA index HNSW

-- Kode schema question.ts juga TIDAK mendefinisikan CHECK sama sekali.
-- Migrasi drizzle/0000 & 0001 juga TIDAK memuat CHECK maupun HNSW.
```

**Dampak:** Invarian inti (stimulus 1-level, `difficulty` 1–5, `flagged`≠`ready`, satu primary topic) **tidak ditegakkan di DB**. Ini persis jenis "drift" yang L7 §6.4 ingin dicegah lewat skrip verifikasi — tetapi skrip itu tak ada. Risiko integritas data nyata begitu M4 (CRUD soal) berjalan. Index HNSW yang dijanjikan untuk pencarian semantik juga belum ada, padahal `embedding vector(1024)` sudah dibuat → query vektor akan full-scan.

**Rekomendasi:**
1. Tambahkan CHECK constraint via migrasi SQL tulisan tangan (sesuai rencana L7 §6.3 "SQL tangan untuk yang krusial"): `chk_difficulty`, `chk_stimulus_parent`, `chk_flagged_not_ready`.
2. Buat index HNSW: `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`.
3. **Tulis skrip verifikasi skema** (L7 §6.4, MILESTONE M1) yang memeriksa jumlah tabel/trigger/CHECK/index HNSW dan gagal bila drift — jadikan bagian `pnpm check`.

---

### 🔴 F2 — Migrasi Tidak Mereflesikan DB (Trigger `updated_at` "Tak Terlihat")

**Klaim dokumen:**
- `CHANGELOG.md` v0.2.0: "**Trigger `updated_at`** — 21 trigger via fungsi `set_updated_at`".
- `ROADMAP.md` Phase 1: "Trigger `set_updated_at()` ✅ **13 trigger** terpasang (migrasi `0001_db_safety.sql`)".
- `AUDIT-KODE.md`: "DB cocok dengan dokumen (27 tabel/**21 trigger**/79 indeks/23 FK)".

**Bukti:**
```
DB:  SELECT count(DISTINCT trigger_name||event_object_table) FROM information_schema.triggers;
     => 21   (trg_<tabel>_updated_at, fungsi set_updated_at)
FILE: grep -in 'trigger' drizzle/*.sql
     => (kosong)  -- TIDAK ADA CREATE TRIGGER di file migrasi mana pun
```
Trigger ada di DB lokal, tetapi **tidak ada di `drizzle/0000_*.sql` maupun `0001_*.sql`**. Meski dokumentasi ROADMAP menyebut `0001_db_safety.sql`, **file itu tidak ada di repo** (yang ada hanya `0000_cheerful_jane_foster.sql` & `0001_perpetual_zeigeist.sql`).

**Dampak:** Repro dulu klaim "DB = hasil migrasi" runtuh. Siapa pun yang menjalankan `pnpm db:migrate` di DB bersih (atau CI/staging/prod) **tidak akan mendapat 21 trigger** tersebut. Sulit dipahami dari mana `ROADMAP` mendapat angka "13 trigger" sementara DB punya 21 — indikasi dokumen ROADMAP berasal dari QBank, bukan MathBank (lihat F13).

**Rekomendasi:**
1. Ekspor trigger + fungsi `set_updated_at` ke migrasi SQL resmi (mis. `drizzle/0002_db_safety.sql`), atau buat sebagai bagian seeder/idempotent script yang tercatat.
2. Tambahkan trigger `usage_count` (topics/tags) — saat ini belum ada sama sekali (F10).
3. Perbarui AUDIT-KODE.md: 21 trigger ✓ tetapi **0 CHECK & 0 HNSW** ✗.

---

## 3. Temuan Tinggi

### 🟠 F3 — UUIDv4 vs UUIDv7 (Kode Bertentangan dengan Dokumen Terkunci)

**Klaim dokumen:**
- `SKEMA-DB-DETAIL.md` §Konvensi: "PK `id uuid PRIMARY KEY DEFAULT uuidv7()` (PG 18)"; T17: "QBank UUIDv4 → **uuidv7()**".
- `DESAIN-PER-LAPISAN-MATHBANK.md` L8: "UUID PK: **`uuidv7()`**".
- `RIWAYAT-KEPUTUSAN.md` L8: "**UUID PK `uuidv7()`**".
- `PRD.md` L8: "PG 18, **uuidv7**".

**Bukti:**
```sql
-- DB:
SELECT column_default FROM information_schema.columns
 WHERE table_name='questions' AND column_name='id';
=> gen_random_uuid()          -- UUIDv4!

-- Kode: src/lib/db/schema/*.ts SEMUA memakai:
id: uuid("id").defaultRandom().primaryKey(),   // = gen_random_uuid()
-- Migrasi 0000/0001: "id" uuid PRIMARY KEY DEFAULT gen_random_uuid()
```
**Dampak:** Alasan utama memilih PG 18 (uuidv7 = berurutan waktu → index B-tree rapi) **tidak terwujud**. Kode dan DB tetap UUIDv4. Ini keputusan terkunci (L8) yang belum dieksekusi.

**Rekomendasi:** Ganti default PK menjadi `uuidv7()` di seluruh schema Drizzle + migrasi, atau — bila sengaja ditunda — catat sebagai utang dengan alasan di RIWAYAT-KEPUTUSAN.

---

### 🟠 F4 — AUDIT-KODE.md Menyatakan Verifikasi yang Tidak Akurat

**Klaim:** *"DB cocok dengan dokumen (27 tabel/21 trigger/79 indeks/23 FK)"* sebagai bukti "Baik (tak perlu tindakan)".

**Kenyataan terverifikasi:** tabel=27 ✓ · trigger=21 ✓ · indeks=79 ✓ · FK=23 ✓ — **tetapi**: CHECK=0 (dokumen minta banyak), HNSW=0 (dokumen minta 1), dan migrasi tak memuat trigger. Jadi frasa "DB cocok dengan dokumen" **over-claim**.

**Dampak:** Audit memberi rasa aman palsu — persis jenis kesalahan ("gerbang mutu palsu") yang AUDIT-KODE.md sendiri temukan untuk coverage (A1). Ibarat menduplikasi cacat A1 di area skema.

**Rekomendasi:** Perbarui AUDIT-KODE.md dengan angka CHECK=0 & HNSW=0, tandai sebagai temuan baru (mis. A10), dan tambahkan ke daftar perbaikan.

---

### 🟠 F5 — Angka "18 Tabel" vs "27 Tabel" Masih Beredar

**Klaim:**
- `ARSITEKTUR-DATA-FINAL.md` §1: "**Tabel inti: 18**".
- `MILESTONE.md` M1: "mewujudkan skema v2 (L7) dalam Drizzle — **18 tabel**"; "pastikan 18 tabel & relasi ada"; "bentuk final **18 tabel**".
- `ARSITEKTUR-SISTEM-FULL.md` L7: "18 tabel inti".
- `RENCANA-MIGRASI-DATA.md` §5: "~15 + 3 taksonomi = **18**".

**Kenyataan:** `SKEMA-DB-DETAIL.md` §Daftar Tabel menulis eksplisit: *"⚠️ Koreksi: dokumen awal menulis '18' — itu **salah hitung**. Tabel domain sebenarnya **21**, plus 6 auth = **27**."* → `README.md` = "27 tabel", `CHANGELOG.md` = "27 tabel", kode = 27 file/objek, DB = 27.

**Dampak:** Dokumen inti (ARSITEKTUR-DATA-FINAL) yang menjadi "basis" bagi dokumen lain **masih memuat angka salah**, sehingga pembaca L7 bisa bingung mana yang benar.

**Rekomendasi:** Tambahkan catatan koreksi di `ARSITEKTUR-DATA-FINAL.md` §1 (18→27) dan di `MILESTONE.md` M1, agar tak ada lagi yang merujuk "18".

---

### 🟠 F6 — Aturan `answer_key` saat `ready` Saling Bertentangan

**Klaim:**
- `SKEMA-DB-DETAIL.md` Invarian #2: "Soal `ready` **wajib** `answer_key`" (dan di §1 "Invarian": "`ready` wajib `answer_key` non-kosong").
- `ARSITEKTUR-DATA-FINAL.md` K28: "**`ready` boleh tanpa `answer_key`** (tidak diblokir)".
- `CATATAN-INTERVIEW-ARSITEKTUR.md` #33: "`ready` boleh tanpa `answer_key` (tidak diblokir)".
- `L7-TINJAUAN-KRITIS-DATA.md` tidak menyebut ulang, hanya mewarisi v2.

**Bukti:** Keputusan interview eksplisit (K28 & #33 & Putaran 10) = **tidak diblokir**. Namun SKEMA-DB-DETAIL (dokumen "jembatan ke kode") justru menuliskannya sebagai invarian wajib. Tidak ada CHECK di DB (F1), jadi perilaku aktual = tidak diblokir.

**Dampak:** Ambiguitas langsung memengaruhi M4 (CRUD & FSM): apakah service harus menolak/memperingatkan `ready` tanpa kunci? Dua dokumen kunci memberi jawaban berbeda.

**Rekomendasi:** Putuskan & samakan. Sesuai jejak keputusan interview, **`ready` boleh tanpa `answer_key`** (mungkin dengan *peringatan* UI, bukan blokir). Perbaiki invarian #2 di SKEMA-DB-DETAIL agar konsisten.

---

### 🟠 F7 — Enum Melampaui Keputusan (competition, exercise)

**Klaim keputusan:**
- `ARSITEKTUR-DATA-FINAL.md` §2.1: `source_kind AS ENUM ('book','website','school')`; `bundle_type AS ENUM ('source','exam')`.
- Interview: "Event = berskala (UTBK/OSN/SBMPTN)"; "Sumber: buku/web/sekolah"; "UTS/PAS = bundle type='exam'".

**Kenyataan kode:**
```ts
sourceKindEnum = ["book","website","school","competition"]   // + competition
bundleTypeEnum = ["source","exam","exercise"]                // + exercise
```
**Dampak:** Dua nilai enum ekstra yang **tidak melalui interview keputusan** muncul di kode (dan masuk migrasi). Bisa jadi ekspansi wajar, tetapi menyimpang dari "jejak keputusan resmi" dan tak terdokumentasi.

**Rekomendasi:** Entah (a) catat sebagai keputusan tambahan di CATATAN-INTERVIEW/RIWAYAT + perbarui SKEMA-DB-DETAIL, atau (b) buang nilai ekstra bila tak dipakai (memenuhi CONSTRAINT #19 "tak ada kode mati").

---

## 4. Temuan Sedang

### 🟡 F8 — Sumber Seeder (`curriculum.yaml`) Tidak Ada di Repo
- Seeder `scripts/seed-taxonomy.ts` membaca `process.env.CURRICULUM_YAML ?? "../qbank/config/curriculum.yaml"`.
- `find . -iname "*curriculum*" -not -path "./node_modules/*"` → **kosong**. Repo MathBank tak punya `curriculum.yaml`, dan `../qbank` adalah repo lain.
- `CETAK-BIRU-MATHBANK.md` §5 & `CATATAN-INTERVIEW` menyebut "Salin `config/curriculum.yaml` → seed taksonomi" sebagai tugas — **belum dilakukan**.
- **Dampak:** `pnpm seed:taxonomy` **gagal** di mesin yang tak punya QBank di sebelahnya. DB terisi (19 grades) hanya karena dijalankan manual di mesin dev. Repro rusak.
- **Rekomendasi:** Salin `curriculum.yaml` ke `config/` MathBank dan ubah default path; catat sebagai bagian M1 lintas (skrip seeder).

### 🟡 F9 — Jumlah Grade 16 vs 19
- Interview §Temuan: "`curriculum.yaml` (**16 grade**, 5 kesulitan, 6 Bloom)".
- `RENCANA-MIGRASI-DATA.md` FASE 1: "Verifikasi: **16 grade**, 5 difficulty, 6 cognitive".
- `CHANGELOG.md` v0.2.0: "Seeder taksonomi (**19 jenjang**, 5 kesulitan, 6 level kognitif)".
- DB: `grades` = **19**.
- **Dampak:** Angka "16" yang dipakai sebagai kriteria verifikasi migrasi tidak akan cocok. Ketidaksesuaian ini bisa menimbulkan keraguan apakah yaml benar ter-seed.
- **Rekomendasi:** Perbarui angka pada dokumen interview/migrasi menjadi 19 (atau jelaskan selisihnya).

### 🟡 F10 — `usage_count` "via Trigger" Tidak Ada Implementasinya
- `L7-TINJAUAN-KRITIS-DATA.md` T12: "hitung via **trigger** pada `question_topics`".
- `SKEMA-DB-DETAIL.md` invarian #8: "`usage_count` akurat — trigger"; T12.
- DB: hanya 21 trigger `updated_at`; **tidak ada** trigger/fungsi `usage_count`.
- **Dampak:** `usage_count` di `topics`/`tags`/`institutions` (dan `questions.usage_count` di v2) akan **selamanya 0** sampai ada mekanisme. Fitur "topik terpopuler" di dasbor akan kosong.
- **Rekomendasi:** Buat trigger `usage_count` (atau service yang meng-update) sesuai T12, atau turunkan klaim di dokumen bila memilih hitung on-demand.

### 🟡 F11 — VISION.md & ROADMAP.md Masih QBank
- `VISION.md` berjudul "# VISI QBank"; `ROADMAP.md` berjudul "# ROADMAP QBank v1.0.0", menyebut commit `bc135ac`, `PRD-SYSTEM-ARCHITECTURE.md`, `question_items`, `exam_events`, "13 trigger".
- `CATATAN-PLANNING.md` §6 sudah menandai: "VISION.md & ROADMAP.md masih berorientasi QBank — perlu disesuaikan".
- **Dampak:** ROADMAP tampaknya jadi sumber angka "13 trigger" di ROADMAP yang membingungkan (F2), dan mencampur progres QBank dengan MathBank.
- **Rekomendasi:** Perbarui atau arsipkan. Minimal beri banner "DOKUMEN QBank — arsip; acuan MathBank = PRD + MILESTONE".

### 🟡 F12 — RENCANA-MIGRASI-DATA.md Bertentangan dengan Keputusan "Migrasi Dibatalkan"
- `PRD.md` Non-Goals: "❌ Migrasi data QBank (dibatalkan)".
- `RIWAYAT-KEPUTUSAN.md`: "**Migrasi data QBank DIBATALKAN**".
- `CATATAN-PLANNING.md` §6: "`RENCANA-MIGRASI-DATA.md` — migrasi QBank dibatalkan; dokumen ini mungkin tak relevan. **Perlu ditinjau**".
- Namun dokumen itu masih berstatus "DRAFT — menunggu ratifikasi" dan menjadi rujukan di CETAK-BIRU §7.
- **Dampak:** Dua kebenaran berlawanan tentang masa depan data QBank. Bisa memicu kerja sia-sia.
- **Rekomendasi:** Beri status **ARSIP** atau hapus dari `docs/`, pindahkan ke folder arsip. Perbarui rujukan di CETAK-BIRU.

### 🟡 F13 — ARSITEKTUR-SISTEM-FULL.md Memetakan QBank, Bukan MathBank
- Dokumen memuat: 23 file schema, 24 modul layanan, 5 tool MCP (`create_question`, dst.), endpoint `exam-events`, `categories`, `schools`, `question_embeddings` — semuanya **QBank**.
- Padahal MathBank baru pada M3 (belum ada layer layanan); CETAK-BIRU menyebut file-file itu sebagai "yang akan disalin **nanti**".
- **Dampak:** Judul "Arsitektur Sistem QBank — Menyeluruh" ada di dalamnya; pembaca bisa menyangka ini kondisi MathBank.
- **Rekomendasi:** Beri label jelas di bagian atas: "**Inventaris QBank** (referensi untuk penyalinan selektif)", atau pisahkan menjadi `LAMPIRAN-INVENTARIS-QBANK.md`.

### 🟡 F14 — Jumlah Dokumen Tidak Konsisten
- `README.md`: "docs/ **20 dokumen** perencanaan & desain".
- `ARSITEKTUR-SISTEM-FULL.md`: "(**20 file** di docs/)".
- Kenyataan: `ls docs/*.md | wc -l` = **21** (sebelum laporan ini; jadi 22 setelah).
- **Dampak:** Kecil, tetapi ini jenis drift yang melahirkan inkonsistensi angka lain.
- **Rekomendasi:** Hindari menuliskan hitungan manual di prosa; ganti dengan "lihat `docs/README`" atau indeks dokumen.

---

## 5. Temuan Rendah

### 🟢 F15 — Struktur File Schema ≠ Rencana L7
- `L7-TINJAUAN-KRITIS-DATA.md` §6.1 merencanakan **~14 file per-domain** (`enums.ts`, `question.ts`, `source.ts`, `ingest.ts`, dst.).
- Kode aktual: **10 file** (`_enums.ts` + `source/event/question/solution/taxonomy/bundle/media/system/auth` + `index`), digabung per-domain serupa tetapi lebih sedikit, dan enum pakai prefix `_enums.ts` bukan `enums.ts`.
- **Dampak:** Bukan masalah fungsional; hanya rencana vs realisasi.
- **Rekomendasi:** Perbarui L7 §6.1 agar cocok dengan struktur nyata (atau sebaliknya).

### 🟢 F16 — Klaim `db:push`/`db:migrate` vs Trigger
- Terkait F2: siapa pun yang mengikuti `README.md` (M0–M1 → `pnpm db:migrate`) **tak mendapat trigger**. README juga menyebut "terapkan skema (**27 tabel**)" tanpa menyinggung trigger/fungsi.
- **Rekomendasi:** Setelah trigger masuk migrasi (F2), perbarui README agar menyebut trigger & index.

### 🟢 F17 — KaTeX `\(...\)` vs `$...$`
- `CONSTRAINTS.md` #25: "KaTeX: `\( ... \)` inline, `\[ ... \]` display — dilarang `$`/`$$`".
- `RIWAYAT-KEPUTUSAN.md` §Rancangan Responsif mencatat: kode aktual (`MathContent`, seeder) memakai `$...$`; "harus sepakat"; sementara "konten BARU pakai `\(...\)`".
- **Dampak:** Aturan tertulis tegas, tetapi renderer toleran — risiko konten campur gaya.
- **Rekomendasi:** Putuskan: renderer tetap toleran (untuk data lama) + linter konten baru (sudah ada `katex-linter-service` di QBank). Catat keputusan final.

### 🟢 F18 — Contoh Warna di Theme Framework ≠ Palet Final
- `DESIGN-THEME-FRAMEWORK.md` §2 contoh: `--src-primary: #2563EB (dari logo MathMyID)`.
- §11 (FINAL): `primary = #0158CA`. `RIWAYAT`/`RENCANA-UI` juga `#0158CA`.
- **Dampak:** `#2563EB` (biru Tailwind-ish) bisa membingungkan implementasi mesin tema.
- **Rekomendasi:** Ganti contoh §2 ke `#0158CA`, atau beri tanda "contoh ilustratif, bukan palet final".

---

## 6. Verifikasi Silang: Dokumen ↔ Kode ↔ DB

| Aspek | Dokumen klaim | Kode/Drizzle | DB hidup | Selaras? |
|-------|---------------|--------------|----------|:--------:|
| Jumlah tabel | 18 (v2/MILESTONE) / 27 (SKEMA-DB) | 27 objek | **27** | ⚠️ F5 |
| PK default | `uuidv7()` | `defaultRandom()` | `gen_random_uuid()` | ❌ F3 |
| Trigger `updated_at` | 21 (CHANGELOG) / 13 (ROADMAP) | — | **21** | ❌ F2 (migrasi) |
| Trigger `usage_count` | via trigger (T12) | — | **0** | ❌ F10 |
| CHECK constraint | banyak (SKEMA-DB §Invarian) | **0** | **0** | ❌ F1 |
| Index HNSW | 1 (v2 §2.4) | **0** | **0** | ❌ F1 |
| Index trigram | ada | ✓ | ✓ | ✅ |
| FK | 23 | ✓ | **23** | ✅ |
| `source_kind` | book/website/school | +competition | enum sama | ⚠️ F7 |
| `bundle_type` | source/exam | +exercise | enum sama | ⚠️ F7 |
| Stimulus RESTRICT | RESTRICT (T1) | `onDelete:"restrict"` | ✓ | ✅ |
| `bundles.slug` partial-unique | partial (T9) | ✓ | ✓ | ✅ |
| Enum `author_type` | teacher/agent/machine/system | ✓ | ✓ | ✅ |
| `audit_logs` tunggal | ✓ (T15) | ✓ | ✓ | ✅ |
| Grade seed | 16 / 19 | — | **19** | ⚠️ F9 |
| Extension | pg_trgm + vector | — | ✓ 1.6 / 0.8.6 | ✅ |

---

## 7. Rekomendasi Prioritas

### 🔴 Segera (sebelum M4 — Bank Soal)
1. **Tambah CHECK constraint + index HNSW** ke migrasi SQL (F1). Ini prasyarat integritas saat CRUD soal berjalan.
2. **Pindahkan trigger `set_updated_at` ke migrasi resmi** (F2) + tambah trigger `usage_count` (F10).
3. **Tulis skrip verifikasi skema** yang gagal bila ada drift (F1/F2) dan masukkan ke `pnpm check`.

### 🟠 Milestone M1/M2 (rapikan)
4. **Samakan `uuidv7()`** di kode & migrasi (F3) — atau catat penundaan resmi.
5. **Perbaiki angka "18→27"** di ARSITEKTUR-DATA-FINAL & MILESTONE (F5).
6. **Satukan aturan `ready` + `answer_key`** (F6) dan keputusan enum `competition`/`exercise` (F7).
7. **Perbarui AUDIT-KODE.md** (F4) dengan angka CHECK=0 & HNSW=0.

### 🟡 Rapikan dokumentasi
8. **Salin `curriculum.yaml`** ke repo + perbaiki path seeder (F8); sinkronkan angka grade 19 (F9).
9. **Arsipkan / tandai** `VISION.md`, `ROADMAP.md`, `ARSITEKTUR-SISTEM-FULL.md`, `RENCANA-MIGRASI-DATA.md` sebagai **QBank/arsip** (F11–F13) agar satu sumber kebenaran = PRD + MILESTONE + SKEMA-DB-DETAIL.
10. Perbaiki hitungan dokumen & contoh warna (F14, F18), dan putuskan KaTeX (F17).

---

## 8. Catatan Positif (yang sudah baik & selaras)

- **Konvensi & enum:** `snake_case`, semua `role` = enum, `author_type` sinkron L1, enum terpusat — sesuai L7 (kecuali catatan F7).
- **Relasi & FK:** Pola B sumber (`books`/`institutions` anak `sources`), `bundle_items` RESTRICT, `topics.parent_id` RESTRICT, `question_media.media_id` RESTRICT — sesuai temuan T1/T2/T7.
- **Slug partial-unique** pada `bundles` (T9) — **benar** di kode & DB.
- **Audit tunggal** `audit_logs` (T15) — benar.
- **Ekstensi** pg_trgm 1.6 & pgvector 0.8.6 — sesuai L8.
- **Index trigram** GIN pada `questions.content_markdown`, `topics.name`, `tags.name` — ada.
- **Disiplin mutu:** nol `any`/`ts-ignore`/`eslint-disable` (dari AUDIT-KODE), coverage terukur — pondasi kode sehat.
- **Dokumentasi kebijakan** (CONSTRAINTS, AGENTS/CLAUDE, CETAK-BIRU) rinci dan eksplisit — nilai tinggi untuk onboarding.

---

*Laporan ini dihasilkan dari pembacaan penuh dokumen + verifikasi langsung ke kode, migrasi, dan katalog DB MathBank (PG 18 :5433). Bila keputusan berubah, perbarui dokumen sumber terlebih dahulu (prinsip "satu sumber kebenaran"), lalu sinkronkan ke kode.*
