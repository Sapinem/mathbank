# Verifikasi Ingest Defantri — Laporan Percobaan (6 Oktober 2026)

> **Status:** Catatan Verifikasi (audit uji coba) · **Milestone terkait:** M9
> **Tanggal:** 2026-10-06 · **Repo:** `/home/hari/projects/mathbank`

**Jalur:** API resmi `POST /api/v1/ingest/upload` → `POST /api/v1/ingest/commit`
**Aktor:** dev-user (AUTH_DEV_BYPASS di dev) · **Server:** `pnpm dev --port 3010`
**DB:** mathbank (localhost:5433) · **Backup pra-uji:** `backups/mathbank_pre_ingest_test_20261006_175848.sql`
**Backup pra-re-ingest:** `backups/mathbank_pre_reingest_20261006_183921.sql`

## Ringkasan percobaan

### Fase A — uji awal (sebelum perbaikan)
| # | Artikel | Soal | Created | Opsi beda | Kunci beda | Bahas hilang | LaTeX rusak | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | Aturan Dasar Integral Tak Tentu (1-18) | 18 | 18 | 0 | 0 | 0 | 0 | ✅ |
| 2 | (ulang artikel #1) | — | deduped=true, 409 | — | — | — | — | ✅ idempoten |
| 3 | Persamaan Garis Singgung Lingkaran | 12 | 12 (+12 media) | 0 | 0 | 0 | 0 | ✅ |
| 4a | UN 2015 "Soal Sulit" (edge case) | 1 | 1 | 0 | 0 | 0 | 0 | ⚠️ flagged (tanpa kunci + **10 opsi**) |
| 4b | Eksplorasi Matematika SIMAK UI | 1 | 1 | 0 | 0 | 0 | 0 | ✅ flagged (tanpa kunci) |
| 5 | (ulang artikel #1 ke-3) | — | deduped=true | — | — | — | — | ✅ idempoten |

### Fase B — setelah perbaikan `clean.ts` + adapter (re-ingest bersih)
Data lama dihapus (backup di atas), lalu 4 artikel di-ingest ulang via API
dengan kode yang sudah diperbaiki:

| Artikel | Soal | Opsi > 6 | LaTeX rusak | Flagged | Cocok sumber |
|---|---|---|---|---|---|
| Integral Tak Tentu | 18 | 0 | 0 | 0 | 18/18 |
| Garis Singgung Lingkaran | 12 (+12 media) | 0 | 0 | 0 | 12/12 |
| Eksplorasi (SIMAK UI) | 1 | 0 | 0 | 1 (tanpa kunci) | 1/1 |
| UN 2015 "Soal Sulit" | **2** (dulu 1 ber-10 opsi) | 0 | 0 | 2 (tanpa kunci) | 2/2 |
| **Total** | **33** | **0** | **0** | **3** | **33/33** |

## Hasil verifikasi data tersimpan vs sumber

Verifikasi: parse ulang HTML sumber (`defantri` adapter, tanpa DB) lalu bandingkan
dengan data di DB via API (stem, opsi, kunci, pembahasan, keseimbangan LaTeX).

- **Integral:** cocok stem **18/18**, opsi/kunci/bahas **0 beda**, LaTeX **0 cacat**
- **Garis-singgung:** cocok stem **12/12**, opsi/kunci/bahas **0 beda**, LaTeX **0 cacat**
- **Eksplorasi & UN-sulit:** cocok stem **1/1** dan **2/2**, **0 beda**

## Audit integritas seluruh 33 soal (skrip `audit-ingest-integrity.ts`)

- Status: **33/33 draft** (ingest tak pernah auto-`ready`) ✓
- Flagged: **3/33** = tepat 3 soal tanpa kunci ✓
- **Tanpa kunci & TAK flagged: 0** — gerbang mutu (§3.2) bekerja ✓
- **LaTeX tak seimbang: 0** ✓ (sebelum perbaikan `clean.ts`: 69/70 rusak)
- **Opsi aneh (>6): 0** ✓ (sebelum perbaikan adapter: ada 10 opsi)
- Opsi duplikat: **2** — **verbatim dari sumber** (bukan bug parser) ✓
- Pembahasan tersimpan: **33/33** di `answerKey.explanation` **dan** `solutions[]`

## Temuan (dan penilaiannya)

### T1 — Cacat NYATA (jarang, **SUDAH DIPERBAIKI**): dua soal menyatu karena `name="radio"` bersama
Artikel `2015-10-soal-un-matematika-kategori-soal-sulit` memakai tata letak
`<form class='jawaban'>` dengan **10 radio `name="radio"`** (bukan `qN`), yang
sebenarnya berisi **dua soal** (masing-masing A–E). Adapter menghasilkan
**1 soal dengan 10 opsi** dan **stem soal ke-2 hilang**.

- **Cakupan: 1 dari 274 artikel defantri** beradio (outlier, bukan sistemik).
- **Perbaikan (2026-10-06):** adapter kini memecah blok `<blockquote>` ber-radio
  non-`qN` menjadi soal terpisah, **dan** memecah grup `qN` bila label opsi
  **kembali ke A** (nama `qN` terduplikasi di sumber, mis. `q15` dipakai 2×).
- **Hasil:** `t4a` → **2 soal × 5 opsi** (stem & pembahasan utuh);
  **lintas korpus 274 artikel: soal ber-opsi > 6 turun 12 → 0**.
- **Uji:** 2 tes adapter baru + `audit-defantri-corpus.ts`; jalur `qN` tetap
  (artikel integral 18/18 & garis-singgung 12/12 tak berubah).

### T2 — Bukan cacat: 3 soal beropsi duplikat
Opsi A/E atau C/E identik **memang begitu di sumber** (mis. `$(C)$` dan `$(E)$`
sama-sama `4x – 3y = 38`). Ingest **setia** pada sumber. Bukan bug.

### T3 — Bukan cacat: 1 soal lama (dari ingest 38) bermasalah LaTeX
Soal dari artikel "Persamaan Kuadrat" (ingest lama, bukan sesi ini) memuat
`\[p\( ... \)q$` (delimiter tak sepasang). 30 soal yang diingest sesi ini **bersih**.

## Gerbang mutu yang dijalankan

| Gerbang | Hasil |
|---|---|
| `pnpm db:verify` (DB utama) | ✓ Skema OK, tak ada drift |
| `pnpm db:verify` (DB uji) | ✓ Skema OK |
| `pnpm typecheck` | ✓ (exit 0) |
| `pnpm lint:names` | ✓ |
| `pnpm test:db` | ✓ **248/248 tes lulus** |
| `pnpm test` | ⚠ 789/790 — 1 gagal **pra-ada** (`clean.test.ts`, `<blockquote>`) |
| Idempotensi API | ✓ upload deduped + commit 409 saat sudah diproses |

## Kesimpulan

Pipeline ingest defantri via API **bekerja dan datanya sesuai sumber** untuk
tata letak standar (`qN`) — 31 soal dari 3 artikel terverifikasi **100% cocok**,
idempoten, dan gerbang mutu (flag tanpa kunci) aktif. Dua kelas cacat struktural
ditemukan (**layout radio generik** + **nama `qN` terduplikasi**) dan
**sudah diperbaiki** di adapter; lintas korpus 274 artikel kini **0 soal ber-opsi > 6**.

## Berkas baru (usulan, belum di-commit)
- `scripts/dev/verify-ingest-defantri.ts` — verifikasi data tersimpan vs sumber
- `scripts/dev/audit-ingest-integrity.ts` — audit integritas seluruh soal
- `scripts/dev/audit-defantri-corpus.ts` — regresi adapter atas seluruh korpus

---

## §Catatan Verifikasi

- **Metode:** jalur ingest produksi nyata (`enqueue` → `markProcessing` →
  `processQueueItem` → `commitItems`) melalui API resmi, **bukan simulasi**.
  Pembanding independen: parse ulang HTML sumber via adapter murni, lalu
  diff struktural (stem/opsi/kunci/pembahasan) terhadap data DB.
- **Yang DIVERIFIKASI (angka nyata, dijalankan):**
  - **Fase B (re-ingest bersih, 33 soal): cocok sumber 33/33**; opsi/kunci/
    pembahasan **0 beda**; **LaTeX rusak 0** (sebelum perbaikan `clean.ts`: 69/70).
  - Adapter pasca-perbaikan: **21/21 tes adapter lulus**; regresi korpus
    **274 artikel → 0 soal ber-opsi > 6** (dari 12); jalur `qN` tak berubah.
  - `clean.ts` pasca-perbaikan: audit korpus defantri **413/413 artikel → 0
    delimiter rusak**; `clean.test.ts` **33/33 lulus** (tadinya 32/33).
  - Audit integritas DB: **33/33 draft**, flag tepat (3 tanpa kunci),
    **opsi aneh 0**, **LaTeX tak seimbang 0**.
  - Idempotensi: upload ulang → `deduped=true`, id sama, total tak bertambah.
  - `pnpm test`: **793/793 lulus** · `pnpm test:db`: **248/248 lulus** ·
    `db:verify` (2 DB) hijau · `typecheck`/`eslint`/`lint:names` bersih.
- **Yang BELUM/tidak diklaim:**
  - Pembahasan **tersimpan** di `answerKey.explanation` (33/33) & `solutions[]`
    (33 baris), tetapi **`/api/questions` (list) tidak memproyeksikan
    `solutions`** — hanya endpoint detail per-soal yang menampilkan. Bukan bug,
    tapi perlu diketahui konsumen API.
  - 1 kasus m4thlab (`artikel-soal-asli-tka-matematika-sma-2025`) masih punya
    delimiter tak seimbang dari sumber — **di luar lingkup defantri**.
- **Data uji DIBERSIHKAN (2026-10-06):** 33 soal, 4 paket, antrean, dan 13
  `media_assets` (via `GET /api/media/orphans` → `DELETE /api/media/{shortId}`)
  dihapus. DB kembali **0 soal / 0 paket**; 1 baris `sources` ("defantri")
  dipertahankan. Backup: `backups/mathbank_pre_cleanup_20261006_191021.sql`.

## Temuan di luar ingest (UI — SUDAH DIPERBAIKI)

**Pratinjau Naskah `/bundles/[id]` dulu hanya menampilkan stem soal**, tanpa opsi
A–E. Akibatnya paket berisi 18 soal terlihat "sebutir-sebutir" (18 baris stem
terpotong), seolah bundling gagal.

- **Dibuktikan BUKAN masalah ingest:** DB menunjukkan 1 artikel = 1 paket
  dengan jumlah & urutan benar (integral 18 butir nomor 1..18, garis-singgung
  12, UN 2, eksplorasi 1). API `/api/bundles/[id]` **sudah mengirim `options`
  + `isCorrect`**; halaman `/print` juga sudah menampilkan opsi lengkap.
- **Perbaikan:** `bundle-detail-view.tsx` kini merender `it.question.options`
  (label + `contentMarkdown`, badge "Kunci" bila `isCorrect`), selaras
  `bundle-print-view.tsx`. `typecheck` & `eslint` bersih.
- **Batas:** kesimpulan berlaku untuk adapter defantri & korpus lokal
  `~/projects/qbank/data/corpora/defantri` pada tanggal uji.
