# DESAIN-SKEMA-BUNDLE-TERPISAH.md — Proposal Skema Pisah (Koleksi vs Latihan)

> **Status:** 📝 **PROPOSAL — belum dieksekusi.** Dokumen pembanding untuk keputusan ADR-0009.
> **Tanggal:** 2026-10-01 · **Rujukan:** `docs/ADR/0009-*.md`, QBank `master:src/lib/db/schema/bundles.ts`,
> QBank `docs/superpowers/specs/2026-09-27-exam-origin-events-design.md`
> **Catatan penting:** Keputusan **final QBank (`master`)** = **SATU tabel** `question_bundles`
> (`collections`/`exams` sudah DIHAPUS di commit `5d01dfe`). Dokumen ini **sengaja** menyusun
> versi terpisah agar bisa dibandingkan sebelum memutuskan.

---

## 1. Ringkasan Perbandingan

| | **Versi A — SEKARANG (satu tabel)** | **Versi B — TERPISAH (proposal ini)** |
|---|---|---|
| Tabel | `bundles` + `bundle_items` | `collections` + `collection_items` **dan** `bundles` + `bundle_items` |
| Tipe | `bundle_type`: `source`\|`exam`\|`exercise` | tak ada enum tipe (dipisah tabel) |
| Koleksi (arsip) | baris `bundle_type='source'` | tabel `collections` |
| Latihan (naskah) | baris `bundle_type IN ('exam','exercise')` | tabel `bundles` |
| Kolom `NULL` tipe-spesifik | banyak (`durationMinutes` NULL utk source, `year` NULL utk exam) | nol (tiap tabel hanya kolom relevan) |
| Dampak | — | **+2 tabel**, 18 berkas disentuh, migrasi expand→contract |
| Cermin QBank final | ✅ **sama** | ❌ QBank **membuang** ini di `D2` |

---

## 2. Versi A — SEKARANG (satu tabel, untuk referensi)

```
bundles (induk)
├─ id, title, slug
├─ bundle_type        ← 'source' | 'exam' | 'exercise'
├─ source_id  → sources      (relevan: source)
├─ event_id   → events       (relevan: source)
├─ year                      (relevan: source)
├─ grade                     (relevan: semua)
├─ duration_minutes   def 90 (relevan: exam)
├─ instructions              (relevan: exam)
├─ status     def 'draft'    (relevan: exam)
├─ created_by_id             (relevan: exam)
└─ deleted_at, created_at, updated_at

bundle_items (isi)
├─ id, bundle_id → bundles (CASCADE)
├─ question_id → questions (RESTRICT)
├─ role           'question' | 'stimulus'
├─ order_index    def 1
├─ section_name, item_number, notes
└─ UNIQUE(bundle_id, question_id)
```

**Cermin QBank `master`** (`question_bundles`): komentar eksplisit
`// source-type columns (bundle_type='source')` vs `// exam-type columns (bundle_type='exam')`.
→ MathBank sekarang **≈ identik** dengan keputusan final QBank.

---

## 3. Versi B — TERPISAH (proposal)

### 3.1 Tabel `collections` (Koleksi / Arsip Naskah)

```sql
-- Tabel induk arsip. SIFAT: statis, institusional/publik.
-- Karakteristik: menampung N soal + RINGKASAN materi/kognitif otomatis.
-- TIDAK punya: durasi, instruksi, points, urutan kaku, status kurasi, pemilik personal, cetak, Moodle.
CREATE TABLE collections (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  title          varchar(255) NOT NULL,
  slug           varchar(255) NOT NULL,
  -- dimensi alami pengelompokan (PRD QBank §5.3)
  source_id      uuid REFERENCES sources(id) ON DELETE SET NULL,  -- penyelenggara/penerbit
  event_id       uuid REFERENCES events(id)  ON DELETE SET NULL,  -- konteks ujian asli (UTBK/SIMAK/OSN)
  year           smallint,                                        -- tahun ajaran/naskah
  grade          varchar(20),                                     -- jenjang/kelas
  acquisition    text,                                            -- catatan asal file (Defantri/MathCyber…)
  description    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_collections_slug ON collections (slug);
CREATE INDEX idx_collections_source_id ON collections (source_id);
CREATE INDEX idx_collections_event_id  ON collections (event_id);

-- Isi koleksi = daftar soal (tanpa urutan kaku; pakai order ringan utk tampilan).
CREATE TABLE collection_items (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES questions(id)   ON DELETE RESTRICT,
  order_index   integer NOT NULL DEFAULT 1,   -- hanya utk tampilan, bukan nomor ujian
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, question_id)
);
```

> **Kepemilikan:** `collections` **publik/institusional** — tak ada `created_by_id` pembatas
> (siapa pun ber-role `collection:view` boleh melihat). Bila perlu audit, catat di `audit_logs`.

### 3.2 Tabel `bundles` (Latihan / Naskah Ujian)

```sql
-- SIFAT: dinamis (living document), personal guru (own), siap cetak/ekspor.
-- Kolom lama TAK berubah, HANYA membuang kolom source-type (pindah ke collections).
CREATE TABLE bundles (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  title            varchar(255) NOT NULL,
  slug             varchar(255) NOT NULL,
  -- varian latihan (bukan lagi 'source')
  bundle_kind      varchar(20)  NOT NULL,   -- 'exam' | 'exercise'   ← enum bundle_type dikurangi
  grade            varchar(20),
  duration_minutes integer DEFAULT 90,
  instructions     text,
  status           bundle_status NOT NULL DEFAULT 'draft',  -- draft|review|ready|archived
  created_by_id    text,                    -- PEMILIK (ditegakkan utk izin ber-`own`)
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_bundles_slug_active ON bundles (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_bundles_kind ON bundles (bundle_kind);
CREATE INDEX idx_bundles_owner ON bundles (created_by_id);

CREATE TABLE bundle_items (         -- TAK berubah dari sekarang
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  bundle_id     uuid NOT NULL REFERENCES bundles(id)   ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  role          bundle_item_role NOT NULL DEFAULT 'question',  -- question|stimulus
  order_index   integer NOT NULL DEFAULT 1,     -- NOMOR KAKU 1..N
  section_name  varchar(100),
  item_number   varchar(50),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, question_id)
);
-- (opsional, fase depan) points: integer NOT NULL DEFAULT 1
```

> **Perubahan dari sekarang:** `bundles` kehilangan `source_id`, `event_id`, `year`
> (pindah ke `collections`), dan `bundle_type` menyusut → `bundle_kind` (`exam`|`exercise`).

### 3.3 Enum

```sql
-- bundle_type LAMA: 'source' | 'exam' | 'exercise'  → dihapus/diganti
CREATE TYPE bundle_kind   AS ENUM ('exam', 'exercise');
CREATE TYPE bundle_status AS ENUM ('draft', 'review', 'ready', 'archived');  -- dari question_status
-- collection: tak perlu enum tipe (dipisah tabel); pakai dimensi source/event.
```

---

## 4. Konsekuensi Versi B

**Positif:**
- Nol kolom `NULL` tipe-spesifik; tiap tabel hanya kolom relevan.
- Perilaku jelas: `collections` publik/statis; `bundles` personal/dinamis.
- Izin & service terpisah (`collection:*` vs `bundle:*`).
- `bundle_kind` menyusut → enum lebih jujur.

**Negatif / biaya:**
- **+2 tabel** (28 → 30); **18 berkas** disentuh; migrasi **expand→contract** berisiko (wajib backup + `db:verify` + uji restore).
- UI baru `/collections`; dua menu.
- **Bertentangan dengan keputusan final QBank** (`D2` menyatukan `collections`+`exams` → `question_bundles`).
- Selama fitur Koleksi belum dipakai, `collections` awalnya kosong.

## 5. Keputusan Bersama (yang masih terbuka)

| Pertanyaan | Pilihan |
|---|---|
| Ikuti QBank final (satu tabel) atau pisah? | A (satu) / B (pisah) |
| Bila **pisah**: `collections` menampung soal (arsip) atau hanya metadata sumber? | perlu ditetapkan |
| Bila **satu**: apakah `bundle_type` diberi *perilaku* (own/publik, read-only)? | ya (disarankan) |

> **MathBank saat ini = Versi A.** Dokumen ini hanya rancangan pembanding; **belum ada perubahan kode/skema.**
