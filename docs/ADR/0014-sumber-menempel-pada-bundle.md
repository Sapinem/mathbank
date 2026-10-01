# ADR-0014 — Sumber menempel pada **BUNDLE** (bukan soal); `question_sources` dihapus

- **Status:** ✅ **DITERIMA** (2026-10-01)
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `docs/ADR/0009-*.md` (bundle satu tabel — ✅ berlaku),
  `docs/ADR/0010-*.md` (**event** = jenis ujian; **tetap berlaku**),
  `docs/ADR/0012-*.md` (**digantikan** oleh ADR ini untuk bagian `question_sources`),
  `docs/ADR/0013-*.md` (dibatalkan — pelajaran: audit dulu),
  `docs/ARSITEKTUR-DAN-ALUR-MATHBANK.md`

## Konteks — menyamakan persepsi

Kebingungan berulang soal "di mana sumber disimpan" diselesaikan dengan
**satu contoh nyata** dari pemilik produk:

> *"Defantri punya artikel misal persamaan kuadrat, di soal persamaan kuadrat itu
> ternyata ada soal UTBK 2026. Cara kelolanya gimana?"*

Jawaban yang disepakati (persepsi final):

```
SOURCES  ──►  BUNDLES  ──►  bundle_items  ──►  QUESTIONS  ──►  EVENTS
defantri      Persamaan      (M:N)             Q1, Q2 …        UTBK SNBT
              Kuadrat                                          + event_year
```

**Empat prinsip:**

1. **Sumber menempel pada BUNDLE**, bukan pada soal.
   Soal cukup tahu bundle-nya; tak perlu mencatat asal-usulnya sendiri.
2. **Satu bundle = satu naskah dari satu sumber.**
   "Persamaan Kuadrat" = naskah utuh dari defantri.
3. **Ujian resmi = EVENT**, menempel pada **soal** (ADR-0010 tetap berlaku).
   Satu soal UTBK bisa berada di bundle mana pun.
4. **Pertanyaan yang sama bisa masuk beberapa bundle** — sudah didukung
   `bundle_items` (M:N). Jadi soal yang muncul di defantri **dan** mathcyber
   tetap terlacak **tanpa** tabel provenance per-butir.

**Konsekuensi logis:** `question_sources` (tabel M:N per-butir, ADR-0012)
**menjadi redundan** — informasi yang dibawanya sudah tercakup oleh
`bundles.source_id` (+`url`, `grade`) dan `bundle_items` (termasuk
`item_number` yang **sudah ada** di sana).

## Keputusan

| # | Aksi |
|---|---|
| 1 | **Hapus tabel `question_sources`** (beserta relasi, index, service, kode terkait) |
| 2 | **Hapus `questions.source_id`** — sumber menempel pada bundle |
| 3 | **Tambah `bundles.url`** — URL artikel spesifik (mis. `mathcyber1997.com/…persamaan-kuadrat`) |
| 4 | **Tambah `bundles.grade`** — kelas **naskah** (soal bisa beda kelas dari naskahnya) |
| 5 | **PERTAHANKAN `questions.event_*`** (`event_id`, `event_year`, `event_subtest`, `event_item_number`, `event_notes`) — sesuai ADR-0010 |
| 6 | **PERTAHANKAN tabel `events`** — akan diisi (UTBK SNBT, OSN, SIMAK UI, …) |
| 7 | **Ingest WAJIB membuat bundle** — artikel → bundle (`type='source'`, `source_id`, `url`) → soal. Tak ada soal "nyasar" tanpa bundle |

### Detail keputusan yang dijelaskan pemilik produk

- **URL artikel → disimpan di `bundles.url`** (bukan `sources.url`), karena
  `sources` = situs, `bundles` = artikel/naskah. Satu situs punya banyak artikel.
- **`grade` → di level BUNDLE.** Alasan: soal bisa beda kelas dari naskahnya
  (soal kelas 10 muncul di naskah kelas 11). `questions.grade` **tetap ada**
  sebagai kelas soal.
- **Ingest otomatis membuat bundle** — sehingga tak ada soal tanpa wadah naskah.

## Alternatif yang Ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| **Pertahankan `question_sources`** (status quo) | Redundan: `bundles.source_id` + `bundle_items` sudah mewakili. Memelihara dua jalur = risiko divergensi (dua-duanya bisa berbeda) |
| **`questions.source_id` dipertahankan** | Bertentangan dengan prinsip 1 — sumber bukan milik soal |
| **Provenance per-butir wajib** (usulan sesi ini) | Tak berlaku dalam alur ini — soal tak punya sumber; ia punya bundle |
| **UTBK sebagai `sources` (kind=competition)** | Bertentangan dengan prinsip 3 — UTBK adalah **event** (jenis ujian berulang, punya subtes/alias/warna), bukan tempat menyalin. ADR-0010 tetap berlaku |

## Rencana Migrasi Data (7 langkah — WAJIB, jangan DDL mentah)

> ⚠️ Ada **56 baris data nyata** di `question_sources` (URL, judul artikel, grade).
> Menghapus tabel tanpa memindahkan data = **data hilang**. Urutan ini wajib.

| # | Langkah | Detail |
|---|---|---|
| 1 | **Buat bundle** untuk mathcyber | Dari data `question_sources`: `type='source'`, `source_id`=mathcyber, `title`="Soal dan Pembahasan — Persamaan Kuadrat", `url`=URL artikel, `grade`='11' |
| 2 | **Isi `bundles.url` + `bundles.grade`** | Nilai dari `question_sources.title/url/grade` (unik per artikel) |
| 3 | **Pindahkan 56 soal** ke `bundle_items` | `INSERT bundle_items (bundle_id, question_id, item_number)` — `item_number` dari `question_sources` |
| 4 | **Verifikasi** | `count(bundle_items)` = 56; tak ada soal tanpa bundle (bila keputusan #7 berlaku retroaktif) |
| 5 | **Drop `question_sources`** | Setelah langkah 1–4 terbukti benar |
| 6 | **Drop `questions.source_id`** (+ index + relasi) | Setelah semua kode tak memakainya |
| 7 | **Verifikasi akhir** | `pnpm db:verify` hijau; `pnpm db:migrate` di DB kosong = skema penuh (#24) |

**Dibalik dengan aman:** selama langkah 1–4, `question_sources` **masih ada** —
jadi bila ada kesalahan, data asli belum hilang.

## Konsekuensi

### Skema
- **29 → 28 tabel** (hapus `question_sources`).
- `bundles`: **+2 kolom** (`url`, `grade`); `questions`: **−1 kolom** (`source_id`).
- `invariants.ts` + `scripts/db-verify.ts`: `tables: 29 → 28` (+ trigger count).

### Kode (dampak terpetakan, belum dihitung final)
- **Hapus modul:** `db/schema/question-source.ts`, `services/question-source-service.ts`
  (bila ada), relasi `questions.sources`, tipe `QuestionSourceView`.
- **Ubah:** `projections/question.ts` (buang `sourceId`), `filters.ts` (filter sumber
  → lewat bundle), `ingest/commit.ts` (**resolve source → buat bundle**),
  `question-write.ts` (buang `sourceId`), `bundle-service.ts` (+`url`, +`grade`).
- **UI:** kartu soal yang menampilkan sumber → ambil dari bundle.

### Risiko dicatat
- **Ingest adalah perubahan paling berisiko:** ia harus membuat bundle, dan
  dedup (`contentHash`) kini berarti "tambah soal ke bundle", bukan "tambah
  baris provenance". Perlu tes regresi ingest end-to-end.
- **Filter "sumber X"** kini berarti "soal yang ada di bundle bersumber X" —
  subquery lewat `bundle_items ⋈ bundles`. Perlu tes per-jalur nyata (#37).
- **Migrasi data 56 baris** wajib diverifikasi sebelum drop (langkah 4).

## Catatan

- **ADR-0012 ditandai "digantikan sebagian"**: tabel `question_sources` dihapus,
  tetapi prinsip **dedup via `contentHash`** dan **provenance lintas-sumber**
  tetap berlaku — kini diwujudkan lewat `bundle_items` (M:N).
- **ADR-0010 TIDAK dibatalkan** — `event_*` justru **dipertahankan**, karena
  alur ini menegaskan UTBK = event, defantri = sumber.
- **Pelajaran ADR-0013 diterapkan:** persepsi disamakan lewat **contoh nyata**
  (soal UTBK di artikel defantri) sebelum menulis kode; data diverifikasi
  sebelum keputusan.
