# Changelog — MathBank

## [Sprint 0 / Backend] ACT-01, ACT-02, ACT-03, ACT-05 — backup, keamanan log, label metrik, bulk status

**ACT-01 — backup harian + retensi dua tingkat.** `scripts/backup-db.mjs` kini
menyimpan **7 dump harian** (`BACKUP_KEEP`) **plus arsip mingguan per ISO-week
selama 30 hari** (`backups/archive/`, dedupe per minggu → idempoten), menulis log
yang **berotasi sendiri** (5 MB → `.1`), memasang **timeout** `pg_dump`
(`BACKUP_TIMEOUT_MS`, default 10 menit), dan **membuang dump 0 byte/parsial**
sebelum exit 1. Cron dipindah ke **02:00 WIB** dengan env retensi eksplisit.
Bukti: dump `mathbank_2026-10-20-03-41-15.dump` (15,07 MB, exit 0),
`backups/archive/mathbank_2026-W43.dump`, run kedua `— lewati` (dedupe) dan
`backup.log.1` (rotasi).

**ACT-02 — log tak lagi membocorkan kredensial.** `logger.ts` menambahkan
*scrubber pola* pada nilai bebas (`Error.message`, `stack`): URL koneksi
berpassword, `?token=`/`password=`/`api_key=`, header `Bearer`/`Basic`, JWT, dan
kunci `sk-live-…`; `ZodError` dicatat hanya `path`+`code`+`message` (`input`
mentah dibuang). `GET /api/health` mengembalikan **503 + pesan generik** tanpa
`err.message` PostgreSQL ke publik; detail tetap ke log server yang sudah
di-scrub.

**ACT-03 — label metrik stabil, store tak bocor.** `normalizeRoutePath()` mengubah
segmen dinamis menjadi `:id` sebelum `recordRequest` (100 UUID berbeda → **1**
label `GET /api/questions/:id`), `MAX_ROUTES = 200` dengan **eviksi LRU** (rute
sibuk bertahan, `evictedLabels` terekspos), dan `startTelemetryMaintenance()`
menjadwalkan `rateLimit.prune()` + `idempotency.prune()` tiap 60 s (idempoten,
`unref()`, tak pernah melempar).

**ACT-05 — aksi massal 200 soal: 1.800 query → 3 query.** `bulkQuestionAction`
memakai **1 `SELECT`** (`= ANY($1)`), validasi FSM/izin di memori, **1 `UPDATE`
set-based** `FROM (VALUES (id, from_status) …)` dengan `q.status = v.from_status`
(**compare-and-swap per baris**, bukan update buta) `RETURNING q.id`, lalu **1
`INSERT`** audit batch. `changeQuestionStatus` menerima `{ returnUpdated: false }`.

**Bukti uji.** `vitest` 5 berkas telemetri+health → 40 test lulus (termasuk
`logger-scrub.test.ts`, `metrics-labels.test.ts`, `health/route.test.ts`);
`vitest --config vitest.db.config.mts question-bulk.db.test.ts` vs `mathbank_test`
→ 6 test lulus, termasuk DoD **200 soal `review→ready`: ≤3 query & <300 ms**.
Detail: `docs/sprint0/SALMAN-PROGRESS.md`.

## [Perf] ACT-04 — Waterfall `/bundles` dihapus (1 request per halaman)

**Masalah.** `BundleListView` memakai `useAllBundles()` yang menelusuri semua halaman
`GET /api/bundles` secara **sekuensial** (`PAGE=100`, sampai 50 iterasi) lalu memotong
20 baris di klien; filter `status` & pencarian `q` juga dikerjakan di memori.

**Perbaikan.**
- `GET /api/bundles` menerima `status` & `q` (server-side); `listBundles()` menerapkan
  `eq(status)` + `ILIKE` judul/tahun dan mengembalikan amplop
  `{ items, total, limit, offset, stats }`. `stats` (per jenis + total butir) dihitung
  dari 4 kueri paralel dalam request yang sama, sehingga kartu statistik tetap akurat
  walau klien hanya menerima 20 baris.
- `useBundlesPage(params)` mengirim `status/q/limit/offset` sekali + `keepPreviousData`.
- `useAllBundles()` **dihapus**; `BundleListView` memakai `limit=20&offset=page*20`,
  pencarian di-debounce 300 ms, paginasi Previous/Next dari `total` server.

**Bukti.** `tsc --noEmit` & `eslint` bersih; runtime dev: `?status=active&limit=20&offset=0`
→ `items=20, total=577, stats={byType:{exam:0,source:577}, totalItems:12336}`;
`?q=2024` → `total=15`; `?status=ready` → `total=0`; `grep useAllBundles src` → 0.
Detail: `docs/sprint0/ICHSAN-PROGRESS.md`.

## [Ingest] — Event otomatis + kunci defantri (label opsi `$(A)$`)

### Temuan 1: label opsi `$(A)$` tak dikonversi → KUNCI HILANG
Sumber defantri menulis opsi `$(B)\ 55,\!8 $`. `normalizeMath` menuntut karakter
non-spasi sebelum `$` penutup, sehingga bentuk tsb **tidak dikonversi**. Akibat
berantai: label `\((B)\)` tak dikenali → kode hanya menyimpan kunci bila label
ada → **40 `value="correct"` → 0 kunci**.

Perbaikan (`clean.ts`), 3 aturan label dijalankan **sebelum** display:
1. `$(A)\ 63 $` → `\((A)\ 63\)`
2. label di depan display `$(A)\ $$…$$` → `\((A)\)\[…\]`
3. typo sumber `$(D)\ 2,\ 3,\ 9$$` → `\((D)\ 2,\ 3,\ 9\)`

**Hasil audit 9.548 soal defantri: `item kotor 0`, `kunci kurang 0`.**
Kunci batch 5 artikel: 173/195 → **2/162** (keduanya memang kosong di sumber).

### Temuan 2: event tidak pernah terisi otomatis (0/162 soal)
- Ingest tak menyentuh `event_id`; `backfill-event.ts` membaca **file cetak**
  `/tmp/event-inventory.json` yang mudah usang.
- Katalog `events` **tak punya "Ujian Nasional"** padahal 16 artikel UNBK di defantri.

Perbaikan:
- `src/lib/ingest/event-detect.ts` — detektor event/subtest/tahun (modul bersama).
- `src/lib/ingest/event-resolve.ts` — isi event dari JUDUL paket; `findUnknownEvents()`
  **melaporkan** event baru (tidak pernah dibuat otomatis).
- Commit API + runner ingest kini **mengisi event otomatis** (`eventsTagged`, `unknownEvents`).
- `backfill-event.ts` dibaca ulang dari DB (bukan file cetak).
- Katalog +`Ujian Nasional` (UN; alias UNBK/UNAS/UNKP) → 11 event.

Bukti: ingest UNBK → `event_id` terisi otomatis (2 bundle / 80 soal).

### Pelajaran operasional
- **Service mode `production` (`pnpm start`) memakai kode HASIL BUILD** — ubah
  parser harus `pnpm build` + restart. Terbukti: server 0/40 kunci vs tes lokal 40/40.
- **Dev (`pnpm dev`, port 3010) memakai kode sumber** → tak perlu build. TETAPI
  menambah **file baru** butuh restart service (hot-reload tak menemukan modul baru).
- Skrip yang membaca file cetak `/tmp/*.json` rapuh; query DB langsung lebih andal.

### Infrastruktur
- `mathbank.service` (prod, :1234) + `mathbank-dev.service` (dev, :3010) — berjalan
  berdampingan. Dev untuk iterasi cepat tanpa build.

## [Ingest] — Sumber mathcyber (7.623 soal)

### Hasil
- **405 berkas** di-ingest → **342 bundle · 7.623 soal**.
- Verifikasi parse-vs-DB: **336/342 cocok**; 6 "tak cocok" **semuanya dedup
  `content_hash`** (soal kembar dalam satu artikel) — **0 data hilang**, terbukti
  jumlah stem unik = jumlah di DB.
- Stem kosong **0** · pembahasan **92%**.

### Temuan: kunci ADA, tapi TIDAK diisi otomatis
- 413 soal PG tanpa kunci. Diselidiki seluruh 405 berkas: penanda kunci nyata
  **`(Jawaban X)`** (273×), **tapi presisi hanya 90,2%** (369 salah dari 3.782).
- **Keputusan: tidak diisi otomatis** — prinsip "kunci kosong > kunci salah".
  Soal masuk + ditandai "perlu telaah". Detail: `docs/plans/2026-10-06-temuan-kunci-mathcyber.md`.

### Pelajaran operasional (penting)
- **`401` bukan cookie rusak** — Better Auth membatasi **sign-in**; sesi bertahan
  hanya ~12–16 artikel. **Solusi terbukti: login + jeda 5 dtk SEBELUM tiap batch**
  (20/20 bersih). Login berulang saat 401 memicu rate limit sign-in.
- **`409` = commit idempoten** (sudah berhasil sebelumnya) → perlakukan selesai.

### Gate
- Unit **838/838** · DB **248/248** · gerbang PG **210/210 selisih 0**.

### Korpus MathBank
| Sumber | Soal | Paket |
|---|---:|---:|
| mathcyber | 7.623 | 342 |
| defantri | 3.319 | 116 |
| m4thlab | 2.938 | 221 |
| **TOTAL** | **13.599** | 679 |

## [Ingest] — Sumber m4thlab (2.938 soal)

### Hasil
- **221 artikel m4thlab** di-ingest lewat API resmi → **221 bundle · 2.938 soal**.
- Verifikasi parse-vs-DB: **221/221 cocok, 0 tak cocok**.
- Kualitas: stem kosong **0** · LaTeX tak seimbang **0** · URL gambar mentah **0** ·
  pembahasan **2.908/2.938 (99%)**.
- `essay` 719 = soal uraian asli (bukan bug).

### Rate limit dinaikkan
- `POST /api/v1/ingest/commit`: `capacity 10, refillPerSec 0.2` → **`30, 1`**
  (1 commit / 5 dtk → 1 commit / dtk). Alasan: ingest massal kena 429.

### Pelajaran operasional
- **`401` pada ingest BUKAN cookie kedaluwarsa biasa** — Better Auth punya
  rate limit **sign-in** (`Too many requests`). Jangan login berulang; login
  hanya saat 401, maks 1× per batch, + jeda.
- `scripts/dev/demo-login.ts` melaporkan "✓ ok" walau sign-in gagal (menyesatkan).
- Runner: yang gagal **tidak** ditandai selesai → otomatis diulang, tak ada data hilang.

### Gate
- Unit **838/838** · DB **248/248** · gerbang PG **210/210 selisih 0**.

## [Ingest] — Pembahasan soal benar-salah + audit tanpa-pembahasan

### Diperbaiki (bug nyata)
- **Pembahasan soal `matrix_grid` tidak terambil.** `extractQuestionGroup`
  memotong blok soal di **radio berikutnya**; untuk benar-salah beberapa grup
  radio ada dalam **satu `<ul>`** dan `<details>` pembahasan berada SETELAH
  `</ul>` → tak masuk potongan.
  → `defantri-tf.ts`: `explanationAfterBlock()` (berhenti di blok soal
  berikutnya, tak menyerobot milik soal lain); `defantri.ts`: `explanationBlockFor()`.
- `<details>` berisi **kisi-kisi materi** sengaja TIDAK diambil sebagai pembahasan.

### Hasil
| Metrik | Sebelum | Sesudah |
|---|---:|---:|
| `matrix_grid` berpembahasan | **0** | **95** |
| Soal berpembahasan | 2.442 | **2.539** |
| Tanpa pembahasan | 760 (23,7%) | **663 (20,7%)** |

21 artikel di-re-ingest. Audit baru: `scripts/dev/audit-tanpa-pembahasan.ts`.

### Diperbaiki (skrip)
- `reingest.ts` menghormati FK: hapus soal hanya bila tak dipakai bundle lain
  (`bundle_items` RESTRICT) + hapus anak stimulus dulu (FK self).
  Dedup lintas-paket tetap bekerja (`linked` > 0).

### Gate
- Unit **838/838** · gerbang PG **210/210 selisih 0**.

### Catatan operasional
- **Ubah KODE → wajib `pnpm build` + restart service.** **Ingest data saja →
  tidak perlu build.** Rebuild bukan akibat ingest, tapi akibat kode berubah.

## [Ingest/UI] — Nomor sub-soal wacana + spasi drop-cap

### Diperbaiki
- **Nomor `(1)`,`(2)`,… di depan sub-soal wacana dihapus.** Stem anak disimpan
  sebagai `\(\left( 1 \right).\) Jika pada saat…` — nomornya berulang di UI
  karena urutan sudah diwakili `child_order`. Kini dibuang di parser
  (`stripSubNumber`, `defantri-wacana.ts`): hanya di **awal** stem, bentuk
  `\left( n \right)` maupun `\((n)\)`; nomor di tengah stem tidak disentuh.
- **Spasi bocor di drop-cap** (`<span class="awal">C</span>alon` → `"C alon"`).
  `stripTags` mengganti SEMUA tag dengan spasi, termasuk tag **inline**. Kini
  tag inline (`span/b/i/em/sub/sup/a/…`) dibuang **tanpa** spasi; tag blok tetap
  jadi pemisah. → stimulus jadi `"Calon Guru belajar…"`.

### Diverifikasi
- Unit **837/837** (5 tes `stripSubNumber` + 2 tes inline-tag) · gerbang PG
  **210/210 selisih 0** · audit clean 1.066 berkas (3 berkas lama tak berubah).
- Re-ingest artikel wacana: 1 stimulus + 5 anak, bebas nomor & spasi bocor.

## [UI] — Tampilan soal `matrix_grid` (benar-salah) di halaman detail

### Diperbaiki
- **Soal benar-salah (`matrix_grid`) tidak muncul di UI.** Halaman detail
  (`question-detail-view.tsx`) hanya merender `q.options` — sedangkan
  `matrix_grid` menyimpan pernyataannya di **`dataPayload.rows`** (`options`
  kosong). Akibatnya 262 soal benar-salah tampil kosong.
  → Komponen baru **`matrix-grid-view.tsx`** merender tiap pernyataan + kunci
  per baris (badge ✓/✗ + label), plus label kolom (Benar/Salah).
- **Bentuk `data_payload` editor ≠ data ingest.** Editor memakai
  `{ columns, rows:[{label}] }` (tanpa tempat kunci), sedangkan pipeline ingest
  menulis `{ labels, rows:[{text, answer}] }` — **262/262 soal** pakai bentuk
  yang kedua. Editor disamakan; kini bisa **mengisi kunci** per pernyataan
  (sebelumnya kunci akan hilang saat disunting).
- `readMatrixGridPayload` / `readMatrixPayload` toleran bentuk lama (`label`,
  `columns`) agar data lama tetap terbaca.

### Diverifikasi
- Unit **830/830** (6 tes baru `matrix-grid-view.test.tsx`) · gerbang PG
  **210/210 selisih 0** · typecheck/eslint/lint:names bersih.
- Render dengan **data API nyata** dari server (`verify-matrix-ui.ts`):
  pernyataan + label + kunci tampil benar.

## [Ingest] — Wacana (stimulus) + perbaikan gerbang PG

### Ditambah
- **Dukungan WACANA/STIMULUS** untuk defantri: artikel berwacana (1 teks
  panjang + beberapa sub-soal bernomor) kini disimpan sebagai **1 soal
  `stimulus` + anak** (`questions.parent_id`, `child_order`) — sebelumnya
  sub-soal tersimpan terpisah tanpa wacana.
  - Modul baru `defantri-wacana.ts` (fungsi murni, terpisah dari jalur PG).
  - `ParsedItem` + `parentRefIndex` & `childOrder`; `commit.ts` memetakannya
    ke `parentId`/`childOrder`.
- 11 tes baru: `defantri-wacana.test.ts` (8) + `defantri-bs-label.test.ts` (3).

### Kriteria deteksi wacana (kunci)
- Penanda `$\left( n \right).$` berurutan mulai 1, dan **tiap nomor menunjuk
  grup radio BERBEDA**. Penomoran persamaan `\cdots \left( 1 \right)` (radio
  sama) ditolak → mencegah false positive.

### Diperbaiki
- **Gerbang jalur PG salah menghitung BS berlabel** (`$(B)\ \text{Benar}$`,
  bentuk PAS/SAS) sebagai soal PG → 4 artikel PAS/SAS memunculkan selisih.
  `isBs` kini mengenali bentuk berlabel.

### Diverifikasi
- Pindai **414 artikel** → **tepat 1** terdeteksi wacana (presisi 100%).
- Ingest via API → `created: 6`; DB: 1 stimulus + 5 anak, 0 anak ber-induk salah.
- **Gerbang PG 210/210, selisih 0** · `pnpm test` **824/824** · typecheck &
  eslint bersih.

## [Ingest] — Event backfill + temuan wacana (stimulus)

### Ditambah
- **5 event baru** (`scripts/seed-events.ts`, via service resmi `createEvent`):
  TKA (subtest Matematika Wajib/Lanjut), PAS-SAS, SBMPTN, Try Out, ANBK-AKM
  → tabel `events` 5 → **10 baris**.
- **Backfill event** (`scripts/dev/backfill-event.ts`): `bundles.event_id`
  0 → **49/116**, `questions.event_id` 0 → **1.325**, `event_year` → **455**,
  `event_subtest` → **464** (ADR-0010).

### Diukur & diverifikasi
- **Sumber event = JUDUL**, bukan stem: hanya **6/3.318** soal memuat penanda
  event di stem (dan itu bukan penanda asal). defantri menaruh nama+tahun di judul.
- **0 paket campuran** — dari 116 bundle hanya 3 yang soalnya menyebut ujian;
  2 kebetulan (1 kata di 1 soal), 1 memang satu ujian → penularan aman.
- Tahun `2013` (SIMAK UI) diperiksa → **benar**.

### Temuan (belum dikerjakan)
- **Wacana/stimulus**: 1 artikel (`2024-09-soal-penalaran-matematika`) berisi
  wacana + 5 sub-soal `$(1).$`–`$(5).$` (radio q1–q5) yang sekarang tersimpan
  sebagai 5 `single_choice` terpisah. Tersimpan di
  `docs/plans/2026-10-06-temuan-event-dan-wacana-defantri.md`.
- **Kriteria deteksi wacana**: tiap `(n)` harus menunjuk radio **berbeda**.
  Penomoran persamaan `\cdots \left( 1 \right)` (radio sama) = false positive.
  Terbukti menyaring kandidat 5 → 1.
- 67 bundle tanpa event = artikel materi/latihan yang memang tak terikat ujian.

### Gate
- `pnpm test` **813/813** · typecheck bersih · DB backup sebelum backfill.

### ⏳ UTANG TEKNIS (belum diperbaiki)
- **`bundles.event_id` harus DIHAPUS** — `event_id` hanya milik **soal**
  (`questions`), sesuai ADR-0010. Alasan: 1 soal bisa dipakai lintas paket
  (terbukti **112 soal** dipakai di >1 bundle) & 1 paket bisa memuat soal dari
  asal berbeda → event di paket ambigu.
- 49 baris `bundles.event_id` terlanjur terisi (keputusan pemilik: dibiarkan).
  **Data soal sudah benar**; `questions.event_id` = sumber kebenaran.
- Catatan lengkap + rencana migrasi:
  `docs/plans/2026-10-06-utang-teknis-bundles-event-id.md`.

## [Ingest] — Media di pernyataan benar-salah + aturan embed `{{img:…}}`

### Diperbaiki
- **Gambar di `matrix_grid.rows[]` tidak diproses pipeline media.** Fungsi
  `applyMediaToItems` & `mediaTexts` (service.ts) hanya menangani `stem`,
  `options`, dan `explanation` — sehingga gambar pada **pernyataan benar-salah**
  tidak diunduh dan URL-nya tidak diganti shortcode. Kini `dataPayload.rows[].text`
  ikut diproses.
- **Pernyataan benar-salah berupa GAMBAR** (temuan TKA SD 2026) kini tetap masuk:
  bila teks pernyataan kosong, dipakai markdown `![alt](src)` dari `<img>` di
  `<li>` yang sama (placeholder `data:image/...` lazy-load dilewati).

### Aturan yang dipatuhi (dikonfirmasi)
- Media **wajib** lewat pipeline: `![alt](url)` di markdown → diunduh &
  didaftarkan → **diganti shortcode `{{img:<shortId>}}`** oleh `applyMedia`.
  Jangan menulis URL gambar langsung ke markdown soal.

### Diverifikasi
- Artikel TKA SD 2026 (pernyataan bergambar): **42/42 pernyataan** ✓
  (sebelumnya 36 — 2 soal hilang karena pernyataannya gambar).
- Batch BS-1 (5 artikel): **63 `matrix_grid` / 208 pernyataan** + 78 PG tersimpan.
- Gerbang PG **214/214 (selisih 0)** · korpus 9.121 PG + 396 matrix_grid ·
  `pnpm test` **813/813**.


## [Ingest] — Dukungan BENAR-SALAH (`matrix_grid`) untuk defantri

### Ditambahkan
- **Soal benar-salah kini jadi `matrix_grid`**, bukan pilihan ganda rusak.
  Modul baru `src/lib/ingest/parsers/adapters/defantri-tf.ts` (fungsi murni):
  pernyataan (2 opsi Benar/Salah) dikelompokkan menjadi satu soal; kunci
  `value="correct"` → `answer: "Benar" | "Salah"`.
- **Dua bentuk sumber didukung** (terverifikasi):
  1. **Per-`<ul>`** (TKA): satu `<ul>` pernyataan = satu soal.
  2. **Per-`<h4>`** (PAS/SAS): satu soal = satu `<h4>` + `<blockquote>`.
  Pilihan pengelompokan otomatis: pakai `<ul>` hanya bila pernyataan
  **benar-benar berada di dalamnya** (cek `</ul>` sebelum posisi).

### Diperbaiki (temuan saat pengembangan)
- **`<ul>` jauh di awal artikel dianggap menaungi semua radio.** Pada PAS/SAS,
  `<ul>` berjarak >21.000 karakter dari grup BS tetap dianggap induknya →
  semua BS tergabung jadi satu soal. Kini diverifikasi lewat penutup `</ul>`.
- **Teks opsi terpotong salah.** Pengambilan teks memakai potongan tetap
  (160 char) sehingga menyerap tag `<label>`/`<button>` berikutnya → opsi BS
  tak dikenali. Kini dibatasi sampai `</label>`.

### Dampak pada metrik korpus (bukan regresi)
- Total korpus **10.592 → 9.545** karena **1.435 grup benar-salah** yang dulu
  dihitung sebagai soal PG palsu kini menjadi **394 `matrix_grid`** yang benar.
- Rincian: **9.121 PG** + **394 matrix_grid (1.435 pernyataan)** + 30 lain.
- **Gerbang PG tetap 214/214 (selisih 0)** — jalur pilihan ganda tidak terganggu.

### Diverifikasi (server :1234)
- 5 artikel BS di-ingest: **63 `matrix_grid` (220 pernyataan) + 101 PG**.
- DB: 78 paket · 2.027 soal (63 matrix_grid + 1.964 PG) · 1.883 solusi.
- Hanya **3 pernyataan tanpa kunci** (memang tak ada di sumber).
- `pnpm test` **813/813** (termasuk 5 tes BS baru).


## [Ingest] — Ingest 5 artikel matematika ke produksi + dukungan PEMBAHASAN

### Ditambahkan
- **Pembahasan (`<details>` "Alternatif Pembahasan") kini diambil adapter defantri.**
  Sebelumnya `finalizeItem(..., undefined, ...)` → **pembahasan tidak pernah
  tersimpan**. Kini dibaca dari `<details>`, `<summary>` dibuang, media di dalam
  pembahasan ikut diunduh. Potongan: `extractExplanation()` di `defantri.ts`.

### Diverifikasi (server demo publik :1234, via API resmi)
- 5 artikel MATEMATIKA di-ingest; hasil **261 soal · 261 solutions ·
  261 bundle_items · 1296 opsi**.
- **`answerKey.explanation` ada di 261/261** · kunci 260/261 (1 soal memang
  tanpa kunci di sumber) · `tanpa-opsi` 0.
- Rincian: Persamaan Garis 46, Integral Tentu 46 (+1 `linked`), Statistika 52,
  Limit 58, TPS Kuantitatif 59.

### Diperbaiki (temuan penting)
- **Ingest ke produksi memakai build LAMA.** Service `mathbank.service`
  menjalankan `pnpm start` dari `.next`; perubahan sumber **tidak berlaku** sampai
  `pnpm build` + restart. Sempat mengejutkan: `results` tak punya field `linked`
  (kode lama) dan pembahasan 0. **Wajib `pnpm build` lalu restart** setelah ubah
  parsers.
- **`linked` wajib dibaca di summary.** Soal identik dalam satu artikel (mis.
  Integral nomor 6 = 17) → dibuat 1, sisanya `linked`. Tanpa field ini,
  `created` terlihat "kurang 1" tanpa penjelasan.

### Catatan operasional
- Uji ingest ke :1234 (demo publik, `DEMO_LOGIN=enabled`) memakai **API key agen**
  (`/api/system/agent-keys`, izin `user:manage`). **API key TIDAK melihat
  `answerKey`** (S3 — hanya admin/teacher/reviewer); verifikasi kunci/pembahasan
  harus lewat **session admin** (`/api/dev/quick-login`).

## [Ingest] — Gerbang mapel matematika + perbaikan opsi LaTeX (defantri)

### Ditambahkan
- **Gerbang mapel**: artikel defantri yang judul/slug-nya **bukan matematika**
  kini **ditandai `skipped`** (dengan alasan), bukan diproses. Whitelist dua
  lapis (nama mapel + topik) diperiksa dari **judul + URL** — sebab 3 artikel
  berjudul "Olimpiade MIPA" ternyata matematika (terlihat dari slug).
  Hasil: **200 masuk / 74 skip**; 74 judul skip diperiksa manual, semuanya
  benar non-matematika (OSN IPS/IPA, Kebumian, Astronomi, TKA PKK/Pancasila/
  B.Indo/B.Inggris/Fisika, TPS PBM/PPU/PU, LBI). "Pengetahuan Kuantitatif (PK)"
  ikut MASUK (soalnya hitungan).
  Gerbang **hanya berlaku untuk `source === "defantri"`** — sumber lain (mathcyber,
  m4thlab, pusmendik) tidak diganggu.

### Diperbaiki
- **Opsi `\)` nyasar → LaTeX tak seimbang.** Pembersihan label opsi membuang `\)`
  di akhir teks secara membabi-buta, padahal itu bisa penutup math opsi (mis.
  `$(A)$ $P \gt Q$` → `\(P \gt Q` tanpa `\)`; opsi OSNP → `)\) Epidermis`).
  Kini label dibuang presisi (`\` `(` `(` `A` `)` `\` `)`), dan `\)` akhir hanya
  dibuang pada varian label tanpa penutup.

### Diverifikasi
- 5 artikel matematika (262 soal): **262/262 cocok**, `latex-rusak` **0**,
  `tanpa-stem` 0, `tanpa-opsi` 0, kunci 261/261 ✓
- Gerbang PG `audit-defantri-pg-verify.ts`: **214/214, selisih 0**
- Korpus tetap **10.592 soal**, `Tak ada soal` = 0
- `pnpm test` **806/806** · `test:db` **248/248** · `typecheck`/`eslint`/`lint:names` bersih
- Rincian: `docs/plans/2026-10-06-gerbang-mapel-matematika-defantri.md`

## [Ingest] — 2 bug jalur PG defantri diperbaiki: korpus 10.365 → 10.592 (+227)

### Diperbaiki
- **`<!--more-->` mengalahkan pembuka soal.** Blogger menyisipkan `<!--more-->`
  DI ANTARA stem dan `<div class="question">`; karena pembuka dipilih via
  `Math.max(...starts)`, penanda itu menang atas `<h4>`/`<blockquote>` → stem
  terpotong → **soal dibuang**. Kini `<!--more-->` dikeluarkan dari kandidat
  pembuka. (9 → 4 artikel bermasalah; +10 soal.)
- **Stem "pembuka bersama" di luar blok radio.** Sebagian artikel (4 OSNP)
  menaruh deskripsi soal di `<p>` **SEBELUM `<h4>`**, sedangkan radio di dalam
  `<blockquote>` terpisah → stem kosong → soal dibuang (75→3, 60→0, 50→0, 34→0).
  Kini ada fallback `sharedStemBefore()`. (4 → 0 artikel bermasalah; +217 soal.)

### Diverifikasi
- **Gerbang PG**: `audit-defantri-pg-verify.ts` → **214/214 artikel murni PG
  cocok, selisih 0** (7.493 grup = 7.493 item).
- Korpus: **10.592 soal**, `Tak ada soal` = **0** (sebelumnya 4).
- Unit test adapter 21/21; `pnpm test`, `test:db`, `typecheck` hijau.

### Alat ukur baru (dev)
- `scripts/dev/audit-defantri-pg-baseline.ts` — baseline per-kelompok artikel
  (120 murni PG / 154 campuran; 7.493 grup PG, 1.890 benar-salah, 6 generik).
- `scripts/dev/audit-defantri-pg-verify.ts` — **gerbang jalur PG**.
- `scripts/dev/db-clear-ingest.ts` — bersihkan data ingest (dry-run default).
- Rincian: `docs/plans/2026-10-06-perbaikan-jalur-pg-defantri.md`

### Pelajaran
- "Harapan" harus diukur dari **nama grup unik**, bukan nomor urut — sumber
  menomori ganda/lompat (`q41,q42,q21,q44…`).
- Deteksi benar-salah harus dari **teks opsi sendiri** (tepat Benar/Salah),
  bukan kata kunci di sekitar radio — soal "…pernyataan yang salah…" jadi
  false positive dan membuat alat ukur sendiri salah.

## [Ingest] — Benar–salah `qN` defantri: percobaan DIBATALKAN (regresi korpus −1.174)

### Dicoba
- Implementasi **benar-salah `qN` → `matrix_grid`** (prioritas 1: 56 artikel
  campuran). Klasifikasi per-grup radio: grup 2-opsi Benar/Salah → satu
  `matrix_grid`; sisanya tetap `single_choice`.

### Hasil: ❌ DIBATALKAN
- **Regresi korpus**: `10.365 → 9.191` soal (−1.174). Gerbang korpus
  (`audit-defantri-corpus.ts`) mendeteksi; perubahan **dikembalikan ke HEAD**.
- Akar masalah (2, terverifikasi atas korpus):
  1. **Stem di luar `<blockquote>`** — sebagian artikel (OSNP IPA SD, dst.)
     menaruh stem SEBELUM blok radio, sehingga ekstraksi stem kosong → grup
     ter-skip. Cacat ini **juga ada di HEAD** (bukan regresi baru), tapi
     memperparah saat dikombinasikan.
  2. **`<ul>` antar-soal bercampur** — grouping per-`<ul>` salah, sehingga
     hingga **64 pernyataan** dari soal berbeda menempel jadi 1 `matrix_grid`
     ber-stem keliru (mis. TKA Bahasa Inggris 82 → 19).
- Korpus kembali baseline: **10.365 soal / 13 ber-opsi>6 / 227 skip** ✓
- Gate: `pnpm typecheck` bersih, `pnpm test` **793/793** ✓

### Temuan terukur (274 artikel beradio)
- 210 artikel murni pilihan-ganda; **56** campuran benar-salah+pilihan-ganda;
  5 generik; 2 campuran 3-jenis; 1 dengan `qX`. → penanganan harus **per-grup**, bukan per-artikel.
- Rincian lengkap + utang teknis: `docs/plans/2026-10-06-benar-salah-qn-defantri-belum-selesai.md`

### Pelajaran
- Benar-salah `qN` **bukan** tambalan kecil — sumber tidak seragam (stem di luar
  blok, `<ul>` bercampur, `True`/`False`). Perlu stem-resolver + batas soal
  andal + uji **per-kelompok artikel**, bukan 1–5 artikel contoh.

## [Ingest] — `stripTags`: placeholder NUL bersarang bikin soal HILANG + `failed` tak terlapor

### Diperbaiki
- **Soal hilang senyap karena `\u0000` (NUL).** Sumber defantri memuat `$$` di
  TENGAH math (mis. `$\int…dx+$$\int…dx+$$…$`). `stripTags` menyembunyikan math
  sebagai placeholder `\u0000N\u0000`; pola itu membuat placeholder **bersarang**
  → satu pass pemulihan menyisakan NUL → PostgreSQL menolak NUL → **`createQuestion`
  gagal**, soal tidak tersimpan. Terbukti: 1 artikel (10 soal) hanya masuk 7.
  Kini pemulihan **iteratif** + jaring pengaman buang sisa NUL.
- **`failed` tak terlapor di API commit.** `summary.failed` hanya menghitung
  artikel yang gagal total, bukan soal yang gagal dibuat (`commitItems.failed`).
  Akibatnya soal hilang **tanpa jejak**. Kini `ProcessResult` mengekspos
  `linked` & `failed`, dan summary menjumlahkan keduanya.

### Diverifikasi
- Re-ingest 5 artikel defantri (93 soal) via API: **93/93 cocok sumber**
  (integral-mutlak 6/6, integral-tentu 10/10, UM-UNDIP 10/10, TKA-SD 30/30,
  limit 38/38); LaTeX rusak 0; `failed` 0.

### Temuan BELUM diperbaiki (dicatat)
- 1 soal latihan limit berbentuk **3 pernyataan Benar/Salah** (tipe benar-salah)
  dipaksa jadi `single_choice` ber-6 opsi "Benar/Salah" — tipe soal khusus ini
  belum didukung adapter defantri.

## [Ingest] — `clean.ts`: delimiter LaTeX selalu sepasang (bug pembahasan rusak)

### Diperbaiki
- **Regex display-multiline melompati `$…$` inline.** Sumber defantri sering
  punya `$…$` inline tepat sebelum `$\begin{align}…\end{align}$`. Regex lama
  (`[\s\S]*?` tanpa batas) menelan inline-inline itu jadi satu blok display →
  hasil `\[x^{2}-px+q=0\( … \)m\( …` — **delimiter tak sepasang**. Kini body
  dibatasi `[^$]` sehingga environment tak melintasi `$` lain. Terbukti:
  **413/413 artikel defantri → 0 delimiter rusak** (sebelumnya mayoritas rusak).
- **`<blockquote>` tidak dilepas tag** — padahal dokumen fungsinya menyatakan
  "tag dilepas, isi tetap" (temuan 9.740 blockquote = pembungkus SOAL). Kini
  dilepas (jadi newline), isi tetap. Menutup 1 tes `clean.test.ts` yang gagal.

### Ditambahkan
- Tes regresi `normalizeMath`: `$inline$` sebelum `$\begin{align}$` tak bocor.
- `scripts/dev/audit-clean-math.ts` — audit keseimbangan delimiter `cleanHtml`.

### Diverifikasi
- Re-ingest 4 artikel defantri (33 soal) via API: **33/33 cocok sumber**,
  **LaTeX rusak tersimpan 0** (sebelumnya 69/70), opsi > 6 = 0, flag tanpa
  kunci tepat (3/3).

## [Ingest] — Adapter defantri: perbaikan layout radio DIBATALKAN (regresi)

### Dibatalkan (jujur)
- Percobaan memecah soal yang berbagi satu nama radio (`2015-10-...`) & nama `qN`
  terduplikasi (label ulang A) **sempat dibuat lalu DIBATALKAN**. Perbaikan
  pertama berhasil di 1–4 artikel uji, tetapi pendekatan lanjutan (segmentasi
  per-urutan kemunculan radio, untuk menangkap soal ke-39 di artikel Limit)
  **menimbulkan regresi besar**: total soal korpus **10.365 → 9.251**
  (**1.383 soal ter-skip**, stem kosong). Adapter dikembalikan ke versi stabil.
- **Temuan & langkah berikutnya** dicatat di
  `docs/plans/2026-10-06-temuan-variasi-layout-defantri.md` (70 artikel
  benar-salah `qN`, 19 nama duplikat, 6 radio generik, 1 `qX`).
- **Pelajaran:** perbaikan parser **wajib** lolos gerbang korpus
  (`audit-defantri-corpus.ts`: total soal tak turun, `skipped` tak naik),
  bukan hanya 1–5 artikel uji.

### Dipertahankan
- `scripts/dev/audit-defantri-corpus.ts` — regresi adapter atas seluruh korpus
  (dipakai sebagai gerbang untuk pekerjaan lanjutan).

## [Skema] — ADR-0017: buang enum `exercise` + `curriculum.yaml` masuk repo

### Diubah
- **Enum `bundle_type`: 3 → 2 nilai** (`source` | `exam`) — persis keputusan resmi
  `ARSITEKTUR-DATA-FINAL.md`. `exercise` **tidak ada di keputusan mana pun** dan
  **0 baris** memakainya; ini pasangan **F7** yang tertinggal setelah
  `competition` dibuang ADR-0015.
- Kode: `_enums.ts`, `BundleType`, dua Zod enum (`api/bundles*`),
  `TYPE_LABELS` UI; tes yang memakai `exercise` sebagai sampel → `exam`.

### Ditambahkan
- **`config/curriculum.yaml` masuk repo** (dulu dibaca dari `../qbank/config/`) —
  **ketergantungan taksonomi ke QBank terputus**. Diverifikasi: `pnpm seed:taxonomy`
  jalan & **idempoten** (19 grades · 5 difficulties · 6 cognitive), termasuk di
  DB yang dibangun **dari nol**. Menutup temuan audit **F8**.

### Diperbaiki (bug lama yang terbongkar)
- **10 skrip di `scripts/` semuanya mendeklarasikan `main()`** — `tsc` menyatukan
  seluruh file, jadi begitu satu skrip diberi nama unik, skrip lain **rusak**
  (`main is not defined`) dan **`pnpm db:migrate` ikut gagal**. Setiap skrip kini
  memakai nama fungsi unik, dan **semuanya diverifikasi jalan** — bukan sekadar
  lolos typecheck. (Ini juga contoh kenapa "typecheck hijau" ≠ "benar".)

### Catatan
- **Migrasi `0012` butuh 0 baris `exercise`**; konversi enum gagal bila ada.
  Terbukti saat penerapan: **DB uji punya 2 baris sisa tes** → diubah ke `exam`
  lebih dulu. Pelajaran ADR-0015/0016 (periksa DB uji **sebelum** migrasi) bekerja.
- **`bundles` sengaja TIDAK dirombak** — kolom bergantian NULL tetap ada, sesuai
  keputusan pemilik produk (jangan memutuskan bentuk sebelum jelas).
- Data uji ingest (40 soal) **sudah dibuang**; kanvas kembali bersih.

## [Perbaikan] — parser kunci: selaraskan pola dua bahasa (4% → 73%)

### Diperbaiki
- **`extractKey` hanya mengenali `(Jawaban X)`** — satu pola, satu bahasa.
  Akibatnya **seluruh artikel berbahasa Inggris masuk tanpa kunci**, padahal
  kuncinya **ADA** di teks, cuma ditulis lain. Ini penyebab sesungguhnya dari
  temuan "172 soal tanpa kunci" kemarin — **bukan** artikelnya yang tak punya
  kunci, melainkan **parser kita yang buta**.

- **Empat pola kini dikenali** (semua diverifikasi ke korpus nyata):

  | Pola | Sumber | Bahasa |
  |---|---|---|
  | `(Jawaban E)` | mathcyber | ID |
  | `(Answer B)` | trigonometri, arithmetic | EN |
  | `Answer: C` | (tanpa kurung) | EN |
  | `\boxed{A}` | LaTeX | — |
  | `The true answer is option B` · `You should choose option D` | beaver | EN |

- **Hasil terukur pada korpus nyata** (5 artikel, 136 soal):

  | Artikel | Sebelum | Sesudah |
  |---|---:|---:|
  | trigonometric-identities | 0/52 | **38/52** |
  | arithmetic-series | 0/33 | **32/33** |
  | arithmetic-word-problems | 0/23 | **15/23** |
  | beaver-computing | 0/15 | **9/15** |
  | aproksimasi (ID) | 5/13 | 5/13 |
  | **TOTAL** | **5/136 (4%)** | **99/136 (73%)** |

- **Divalidasi, bukan sekadar dihitung:** 0 kunci yang salah-tangkap (kunci
  selalu cocok dengan label opsi yang ada), dan **1 contoh diperiksa manual**
  ke sumber: parser bilang `B`, artikel bilang *"Cato borrowed Curious George.
  The true answer is option B"* — cocok.

### Dua jebakan yang ditemukan saat mengerjakan
1. **Tag HTML di tengah kalimat.** Korpus menulis
   `The true answer is <strong>option B` — regex yang melarang `<`/`>` **tak
   akan pernah cocok**. Sebab itu beaver sempat tetap 0/15 walau polanya benar;
   tag dibuang lebih dulu.
2. **`option` punya dua makna.** Di artikel beaver:
   - ✅ `You should choose option D` (menetapkan kunci)
   - ❌ `the one shown in Option A` (menjelaskan opsi, **bukan** kunci)

   Karena itu daftar kata pemicu **sengaja dibatasi**
   (`answer|correct|choose|pilih|kunci|jawaban`) — `shown in` TIDAK termasuk.
   Tanpa pembatasan ini, kunci bisa salah.

### Catatan
- **7 tes baru** mengunci tiap pola **+ satu tes negatif** untuk
  `shown in Option A` — supaya pembatasan pemicu tak dilonggarkan tanpa sengaja.
- Perbaikan ini **melengkapi** perbaikan sebelumnya (`warnings` → `isFlagged`):
  sekarang soal yang **berhasil** dapat kunci tak lagi ditandai, dan yang
  benar-benar tanpa kunci **tetap** ditandai untuk ditelaah.

## [Perbaikan] — peringatan parser kini jadi tanda "perlu telaah" (`isFlagged`)

### Diperbaiki
- **`ParsedItem.warnings` dibuang di jalur ingest.** Parser sudah lama mendeteksi
  masalah mutu (`"Kunci jawaban tidak ditemukan — perlu telaah"`, `"Opsi hanya 3"`),
  lalu `commit.ts` **tak pernah membacanya** — jadi soal bermasalah masuk sebagai
  draft biasa **tanpa tanda apa pun**, dan guru tak tahu mana yang perlu diperiksa.
  Ini **melanggar** `docs/STRATEGI-INGEST.md` §3.2 yang sudah menetapkan
  perilaku benar: *"Kunci tak terdeteksi → `isFlagged` + catatan"*.
- **Bukti nyata (dijalankan, bukan diklaim):** ingest artikel Inggris
  (Beaver Computing Challenge, tanpa kunci):
  - sebelum: **15 soal → 0 ditandai**
  - sesudah: **15 soal → 15 ditandai** + catatan `"Kunci jawaban tidak ditemukan — perlu telaah"`

### Diubah
- `contracts/question.ts`: `createQuestionSchema` menerima `isFlagged` & `flagNotes`.
- `question-write.ts`: `createQuestion` menyimpannya.
- `ingest/commit.ts`: `it.warnings` → `isFlagged: warnings.length > 0`,
  `flagNotes: warnings.join("; ")`.

### Catatan
- **3 tes DB baru** mengunci perilakunya: ditandai bila ada peringatan ·
  **tidak** ditandai bila bersih (agar tak semua soal dicap bermasalah) ·
  beberapa peringatan digabung.
- `isFlagged` dibuat **opsional** (bukan `.default(false)`) — `z.default()`
  membuatnya *required* di tipe output dan memecah 5 pemanggil lama.
- Data uji sudah dibuang lagi; kanvas kembali **0 soal**.

## [UI] — Halaman Koleksi (`/collections`) + menu

### Ditambahkan
- **Halaman `/collections`** — daftar arsip soal publik: tabel judul/sumber/
  event/jumlah soal/kelas, dialog buat koleksi (judul, sumber, event, tahun,
  kelas, keterangan), dan konfirmasi hapus dengan pesan tegas *"soalnya
  **TIDAK** terhapus"*.
- **Halaman `/collections/[id]`** — detail arsip: kartu metadata, isi arsip,
  pencarian soal untuk ditambahkan (menandai yang **sudah ada** agar tak
  dobel), dan tombol keluarkan.
- **Menu "Koleksi"** di grup **Kerja**, tepat setelah **Paket Soal** —
  menegaskan bedanya di UI: *Paket Soal* = naskah kerja guru (**`own`**),
  *Koleksi* = arsip publik.
- **`use-collections.ts`** — hook React Query (list, detail, create, update,
  delete, add/remove item) mengikuti pola `use-bundles`.

### Catatan
- **Menandai "sudah ada"** pada pemilih soal — mencegah guru menambahkan soal
  yang sama berulang, meski API-nya idempoten.
- **Semua touch target ≥ 44px** (CONSTRAINTS #11) & **tanpa `space-y-*`** (#7).
- **`nav-config.test.ts` diperbarui** — tes itu sengaja mengunci struktur menu,
  jadi penambahan menu **memaksa tinjauan sadar** (gagal dulu, baru disesuaikan).
- Dialog hapus memakai `<select>` native untuk sumber/event (bukan komponen
  `Select` shadcn) agar state-nya sederhana & tanpa nilai kosong palsu.
- Diverifikasi: typecheck ✅, lint ✅ (0 warning), lint:names ✅, test **657** ✅,
  test:db **234** ✅, build ✅ (5 rute terdaftar), `/collections` → 307 (hidup).

## [Docs] — `AGENTS.md`: aturan kerja agent (8 bagian)

### Ditambahkan
- **`AGENTS.md` diisi aturan proyek** — sebelumnya **hanya** berisi blok bawaan
  Next.js, sehingga agent (dan sesi baru) **tak diberi tahu apa pun** tentang
  MathBank. Akibat nyatanya: pekerjaan salah arah berulang (menganggap QBank =
  MathBank; tidak membaca dokumen yang sudah ada; melaporkan "berhasil ingest"
  tanpa menyebut kualitas).

  Isinya:

  | § | Topik |
  |---|---|
  | 0 | **Wajib baca** — `CONSTRAINTS.md` (46 aturan) dulu, lalu peta dokumen/ADR |
  | 1 | ⚠️ **MathBank ≠ QBank** — dua repo, dua port (1906 = QBank); apa yang boleh & dilarang diambil |
  | 2 | **Data** — backup dulu, urutan hapus FK, ingest = draft **mentah** (bukan data siap pakai) |
  | 3 | **Prosedur skema/migrasi** — 6 langkah, termasuk **DB uji** (jebakan yang kena 2×) |
  | 4 | **Gerbang mutu** sebelum bilang "selesai" |
  | 5 | **Dokumen wajib** terdaftar / ADR / §Catatan Verifikasi |
  | 6 | **Gaya** — #28b, #6, #7, #22, #35 |
  | 7 | **Kejujuran laporan** — bedakan "jalan" dari "benar" |
  | 8 | **Kondisi proyek saat ini** + utang terbuka |

### Catatan
- **Setiap klaim di aturan itu diverifikasi ke keadaan nyata** sebelum ditulis:
  28 tabel · 174 topik · 5 events · 6 sumber · 0 soal · QBank di port 1906 ·
  nomor-nomor `CONSTRAINTS` — semuanya dicek, bukan dikarang.
- `AGENTS.md` didaftarkan di `docs/PETA-DOKUMEN.md` (CONSTRAINTS #31).
- Aturan ditulis **ringkas & dapat dikerjakan** — rinciannya tetap di
  `CONSTRAINTS.md`; `AGENTS.md` menunjuk ke sana agar tak jadi salinan yang basi.

## [Fitur] — ADR-0016: tambah `collections` (arsip soal publik)

### Ditambahkan
- **Tabel `collections` + `collection_items`** — arsip soal **publik** (statis,
  institusional), **berdampingan** dengan `bundles` (naskah kerja guru: dinamis,
  personal). **DB 26 → 28 tabel.**
- **Permission `collection:view` & `collection:manage`** — keduanya `yes` untuk
  guru/reviewer/admin. Beda dari `bundle:manage` (`own`): karena `collections`
  **tak punya `ownerId`**, izinnya **bisa** dipasang di gerbang route
  (CONSTRAINTS #35 hanya mengikat izin `own`).
- **`collection-service.ts`** — `listCollections`, `getCollection`,
  `createCollection`, `updateCollection`, `deleteCollection`, `addCollectionItem`
  (idempoten), `removeCollectionItem`, `reorderCollectionItems`,
  `listCollectionsOfQuestion`, `listQuestionIdsInCollection`, `addCollectionItems`.
- **API:** `GET/POST /api/collections`, `GET/PATCH/DELETE /api/collections/[id]`,
  `GET/POST/PUT/DELETE /api/collections/[id]/items`.

### Diubah
- **Enum `audit_entity` + nilai `collection`** — `recordAudit` menolak
  `entityType` di luar enum, jadi `audit_logs` gagal mencatat tanpa ini.
- `db_safety.sql`: `collections` ikut dipasangi trigger `updated_at`.

### Catatan
- **`bundles` TIDAK DISENTUH** — `bundle_type` tetap `source`|`exam`|`exercise`;
  ADR-0009 tetap berlaku. ADR ini **menambah**, bukan merombak.
- **Melanjutkan ADR-0013 yang dulu dibatalkan** — alasannya sudah tak berlaku:
  pembatalan itu bersandar pada *"`question_sources` sudah jadi Koleksi"*,
  padahal tabel itu **sudah dihapus ADR-0014**. Setelah itu, Koleksi **tak punya
  wadah sama sekali**.
- **13 tes DB** mengunci invarian pembeda dari `bundles`: publik (guru lain
  boleh kelola), idempoten, RESTRICT (soal terarsip tak bisa dihapus), CASCADE
  (hapus koleksi tak menghapus soal), M:N (satu soal di banyak koleksi).
- **Pelajaran diterapkan:** `db_safety.sql` **dan DB uji** dimigrasikan bersamaan
  (jebakan ADR-0015 yang dulu kena dua kali); kode mati langsung dibuang
  (CONSTRAINT #19); `permissions.test.ts` mengunci matriks izin secara exhaustive.
- Migrasi `0011` idempoten dari nol: diverifikasi via DB baru → 28 tabel,
  25 trigger, 0 drift.
- **UI menyusul** (belum dikerjakan sesuai keputusan: skema + service + izin dulu).

## [Skema] — ADR-0014: sumber menempel pada BUNDLE, `question_sources` dihapus

### Diubah
- **`question_sources` DIHAPUS** — informasi yang dibawanya sudah tercakup
  `bundles.source_id` + `bundle_items` (termasuk `item_number`). Memelihara dua
  jalur = risiko divergensi.
- **`questions.source_id` DIHAPUS** — sumber bukan milik soal; soal cukup tahu
  bundle-nya. **DB 27 → 26 tabel.**
- **`bundles.url` DITAMBAH** — URL artikel spesifik. Pembagiannya jelas:
  `sources.url` = situsnya (`defantri.com`), `bundles.url` = artikelnya
  (`defantri.com/…/persamaan-kuadrat`).
- **`getQuestion()` kini mengembalikan `bundles`** (bukan `sources`) — asal
  butir dibaca dari naskah yang memuatnya, lengkap dengan `sourceLabel`,
  `sourceKind`, `itemNumber`.
- **Filter `sourceId` TETAP ADA, maknanya berubah** — kini "soal yang ada di
  bundle bersumber X", diterapkan sebagai `EXISTS (bundle_items ⋈ bundles)`
  di `filters.ts`. Yang dihapus kolomnya, bukan filternya.
- **`questions.event_*` DIPERTAHANKAN** (ADR-0010 tetap berlaku) — UTBK = event,
  defantri = sumber. Konflik dengan `events` yang dulu kelihatan ternyata
  **bukan konflik**: keduanya beda peran.

### Ingest: sekarang WAJIB membuat bundle
- **`resolveBundleId()`** — cari/buat naskah; kunci idempotensi `(sourceId, url)`,
  jatuh ke `(sourceId, title)` bila tanpa URL. Slug menyertakan hash URL supaya
  dua artikel berjudul sama tak bentrok (`uq_bundles_slug_active`).
- **`linkQuestionToBundle()`** — pengganti `addQuestionSource()`; idempoten via
  `UNIQUE (bundle_id, question_id)`.
- **Dedup lintas-sumber tetap berlaku**: soal yang sama muncul di dua naskah →
  satu soal, dua keanggotaan bundle. Inilah yang mewujudkan sifat M:N tanpa
  tabel provenance terpisah.
- **Tak ada lagi soal "nyasar" tanpa naskah.**

### Kode yang dihapus/dipindah
- Dihapus: `schema/question-source.ts`, `services/question-source-service.ts`.
- `findQuestionByContentHash()` pindah ke `ingest/commit.ts` (berkas tuannya
  dihapus, fungsinya masih dibutuhkan untuk dedup).

### Catatan
- **Migrasi data (langkah 1–4 di ADR) GUGUR** — saat penerapan DB **0 soal**,
  jadi tak ada 56 baris yang perlu dipindahkan. Risiko terbesar ADR ini hilang
  justru karena pengerjaan urutannya benar (bersih-bersih data dulu).
- **3 bug nyata tertangkap tes**, semuanya didokumentasikan di ADR-0014: urutan
  hapus `bundle_items` (RESTRICT), slug bundle bentrok, dan `usageCount`/
  `deleteSource` yang masih memakai `q.source_id` (termasuk `"id"` ambigu di
  subquery). Gerbang `test:db` menangkap semuanya — bukan lolos ke produksi.
- Migrasi `0010` idempoten dari nol: diverifikasi via DB baru → 26 tabel,
  24 trigger, 0 drift.

## [Data] — Isi katalog `events` (5 ujian nyata)

### Ditambahkan
- **`events` 0 → 5** — rumah untuk jenis ujian, yang setelah ADR-0015 jadi
  satu-satunya tempat menampung UTBK/OSN (enum `competition` sudah dibuang):

  | Event | Singkatan | Kategori | Subtes | Alias |
  |---|---|---|---:|---:|
  | UTBK-SNBT | UTBK | `utbk` | 2 | 4 |
  | OSN Matematika | OSN | `osn` | 0 | 5 |
  | SIMAK UI | SIMAK UI | `sbmptn` | 2 | 2 |
  | Ujian Mandiri PTN | UM PTN | `sbmptn` | 0 | 3 |
  | Ujian Sekolah | US | `ujian_sekolah` | 0 | 4 |

- **`scripts/seed-events.ts`** — seeder idempoten (event yang sudah ada
  dilewati), melewati **service resmi** bukan SQL langsung, supaya otorisasi
  `assertCan` & pembentukan `code`/`fullname` ikut teruji.

### Catatan
- Alias diisi supaya pencarian pengguna cocok: "SNBT", "SBMPTN", "OSK", "OSP",
  "PAS", "PAT" mengarah ke event yang sama.
- **Belum diputuskan:** `questions.event_*` (5 kolom, 0/56 terisi) — berpotensi
  duplikat `events`. Lihat ADR-0010/0014/0015. Ini mempengaruhi ADR-0014.

## [Skema] — ADR-0015: `books` & `institutions` digabung ke `sources`

### Diubah
- **`books` & `institutions` DIHAPUS** — keduanya anak 1-ke-1 dari `sources`
  (`UNIQUE source_id`) dan **0 baris**, jadi tabel terpisah tak memberi manfaat.
  Kolomnya pindah ke `sources` sebagai **kolom per-`kind`** (NULL untuk jenis
  lain), mengikuti pola `sources.url` yang sudah ada:
  - `kind='book'` → `publisher`, `author`, `book_year`
  - `kind='school'` → `city`
- **DB 29 → 27 tabel**; trigger `updated_at` 26 → 24.
- **Enum `source_kind`: 4 → 3 nilai** — `competition` dibuang (UTBK/OSN/SIMAK UI
  adalah **event**, rumahnya `events`). 1 baris "OSN Matematika SMA" dihapus
  lebih dulu (0 soal memakainya) agar konversi enum tak gagal.
- **Form sumber jadi dinamis per jenis** (`sources-view.tsx`): pilih Buku →
  muncul penerbit/penulis/tahun; Sekolah → kota; Situs → URL. Field jenis lain
  dikirim `null`, jadi tak ada kolom yang terisi asal.
- `usageCount` sumber kini **murni dari jumlah soal** — sebelumnya
  `Math.max(institutionUsage, questionCount)`, padahal `institutions.usage_count`
  tak pernah diisi trigger apa pun (selalu 0, jadi selalu jatuh ke `questionCount`).

### Diperbaiki
- **`db_safety.sql`** tak lagi memasang trigger ke `books`/`institutions`.
- **Invarian DB dikoreksi dengan fakta** (aturan #25): `tables` 27, `triggers` 24
  — diverifikasi lewat `db:verify` *dan* uji bangun-ulang dari nol (aturan #24).

### Catatan
- **Migrasi `0009` idempoten dari nol** — diverifikasi dengan membangun DB baru
  (`mb_repro2`): 27 tabel, 24 trigger, 0 drift.
- **⚠️ DB uji (`TEST_DATABASE_URL`) juga wajib dimigrasi.** Awalnya tertinggal di
  skema lama → 10 tes `ingest` gagal, dan gejalanya menyesatkan karena
  `resolveSourceId` menelan error asli (`ConflictError`). Detail di ADR-0015.

## [Redesign-UI] — Bank Soal: Filter Bar, 3 View Modes, App Shell Responsif

### Ditambahkan
- **Filter bar horizontal** (`question-filter-bar.tsx`, C8): semua filter di satu
  baris ringkas — sebelumnya filter tersebar & memakan ruang vertikal.
- **Slide-over filter drawer** (`question-filter-drawer.tsx`, C8): panel filter
  dibuka sesuai permintaan (on-demand), bukan selalu terlihat. Di mobile
  **auto-close** saat navigasi.
- **3 view modes** (C6): `list`, `grid` (simetris), & `masonry` (kolom dinamis),
  diatur `view-mode-toggle` — tahan terhadap variasi panjang soal matematika.
- **Halaman sunting soal** `/questions/[id]/edit` + `question-edit-view.tsx`
  (rute terpisah, pola `bundles/[id]/edit`) — URL bisa di-bookmark, Back menutup
  editor, F5 tetap di editor.
- **Pembahasan multi-solution di editor** (`question-editor.tsx`): top action bar,
  editor beberapa pembahasan, & tab. Tipe `conceptual`/`quick_tip`/`video`/
  `alternative` (`solutionInputSchema`).

### Diperbaiki
- **Touch target ≥ 44×44px** (#11) pada `SidebarTrigger` & tombol cari mobile.
- **Auto-close drawer mobile** saat item nav diklik (`app-sidebar.tsx`).
- **Horizontal scrollbar** pada opsi pilihan ganda, kartu, & detail soal dibersihkan.
- **Pemotongan rumus LaTeX** memakai elipsis, bukan memecah layout.
- **Breakpoint `lg` diselaraskan** (#14) + sisa `space-y-*` dibersihkan (#7).
- **CommandDialog** — perbaikan context provider `cmdk` & deteksi `Ctrl+K`.

### Catatan
- `MathContent` dapat `noScroll` — pemanggil bisa mematikan `overflow-x-auto`
  (#12) untuk konteks yang memang perlu memotong, bukan menggeser.

### Diperbaiki (jalur data)
- **`solutions` ikut tersimpan** (`question-write.ts`) & **dibaca** di proyeksi
  soal (`question-read.ts`) — sebelumnya pembahasan tambahan tak pernah ditulis.
- `contracts/question.ts`: `solutionInputSchema` + `solutions` di skema soal.

---

## [Chore] — Pindah Skrip Dev & Keluarkan Media dari Git

### Diubah
- **7 skrip ad-hoc → `scripts/dev/`**: `audit-katex`, `audit-render`,
  `diagnose-media`, `diagnose-render`, `dry-run-parse`, `fix-ingest-artifacts`,
  `ingest-article`. `scripts/` kini bersih dari perkakas ad-hoc (sisa isinya
  tooling resmi: seed, db, tema, backup, `deploy.sh`). **Tak ada perintah pnpm
  yang putus** (ketujuhnya tak terdaftar di `package.json`).
  Impor relatif disesuaikan `../src` → `../../src` (20 impor) + petunjuk pemakaian.
  Diverifikasi dengan menjalankan `dry-run-parse.ts` pada korpus nyata
  (56 soal, exit 0) — perubahan impor dinamis tak terjangkau typecheck.

### Diubah (repo hygiene)
- **`storage/` keluar dari git** (+ `.gitignore`). Media adalah *data runtime*
  yang diunggah pengguna (nama berkas = SHA-256, dicatat di `media_assets`),
  bukan kode. 8 berkas lama keluar dari index; **berkas fisik tidak dihapus**.
  Jalur pemulihan tetap ada: named volume `media_data` (docker-compose) +
  rsync/restic (`docs/BACKUP-RECOVERY.md` §3, §5).

---

## [G3] — Kurasi Massal: Bulk Action, Rapid Review, Merge Label

### Ditambahkan
- **Aksi massal** (G3.1): endpoint `POST /api/questions/batch` + service
  `bulkQuestionAction` yang **memakai ulang** `changeQuestionStatus`/`setQuestionFlag`
  per-butir — izin per-tujuan (L1), FSM (L6), & penjagaan balapan (#36) tetap
  ditegakkan; hasil **per-butir** (`ok`/`failed`). UI: checkbox pada kartu +
  **bar seleksi mengambang** (Setujui · Tolak→draf · Arsipkan · Tandai · Lepas tanda).
- **Mode Kilat / Rapid Review** (G3.2): di halaman Telaah — satu soal sekaligus
  (flashcard) dengan navigasi **`←`/`→`** + tombol, aksi kurasi sama.
- **Merge label sinonim** (G3.3): `mergeTags(sourceId, targetId)` **atomik** dalam
  transaksi (pindah `question_tags` ke target, hapus sumber) + endpoint
  `POST /api/tags/merge` + aksi "Gabungkan…" di halaman Label.

### Catatan
- Bulk **menghormati FSM**: `draft→ready` & `ready→draft` tak sah — jalur resmi
  `draft→review→ready` (setujui) & `review→draft` (tolak). Item yang tak lolos
  dicatat sebagai `failed`, bukan menggagalkan seluruh batch.

## [G2] — Editor Soal: Form Dinamis, Stimulus, Autosave, KaTeX Linter

### Ditambahkan
- **Form dinamis per tipe** (G2.1): tipe `matrix_grid` (editor baris pernyataan B/S)
  & `matching` (dua kolom kiri↔kanan) kini punya field khusus yang menulis
  `data_payload` terstruktur (sebelumnya selalu `{}`). Tipe lain tetap cukup
  `content_markdown` (sesuai keputusan skema — hindari YAGNI).
- **Pemilih wacana stimulus induk** di editor (G2.2) — dropdown memilih soal
  bertipe `stimulus` untuk mengaitkan butir anak (`parentId`). Hook baru
  `useStimulusParents()`.
- **Autosave draf** ke `localStorage` (G2.3) — hook `useEditorAutosave` (debounce
  2,5 dtk) + banner pemulihan ("Pulihkan/Buang") bila tab tertutup/crash.
- **KaTeX linter pre-save** (G2.4) — `src/lib/math/katex-lint.ts` mengekstrak
  rumus & menguji ke KaTeX (`throwOnError`); editor menampilkan **peringatan**
  (tidak memblokir simpan — keputusan G2).
- **Petunjuk rubrik inline** di editor (G2.5) — deskripsi operasional di bawah
  dropdown kesulitan & level kognitif (`RubricHint`).
- **Modul bersama `FieldGroup`/`Field`** (`components/ui/field-group.tsx`) —
  sebelumnya `Field` hanya lokal di editor (menutup temuan audit "FieldGroup hantu").

### Diperbaiki
- `question-editor` mengirim `data_payload` + `parentId` (sebelumnya `dataPayload: {}`
  dan tanpa `parentId`).

## [ADR-0012] — Provenance per-butir (`question_sources`) + dedup dua-tingkat

### Ditambahkan
- **Tabel `question_sources`** (ADR-0012) — provenance **per-butir**, **many-to-many**:
  satu soal boleh >1 sumber. Kolom: `question_id`, `source_id`, `source_type`,
  `title` (judul artikel web), `url`, `accessed_at` (waktu akses), `publisher`,
  `author`, `year`, `grade`, `item_number`, `notes`. **`UNIQUE (question_id, source_id)`**.
- **`questions.content_hash`** — hash **stem+opsi tanpa sumber**; **unik partial**
  (`deleted_at IS NULL`) → anti-duplikat lintas-sumber.
- **Dedup dua-tingkat**: **exact** (`contentHash`) auto-gabung saat **ingest**;
  **near** (embedding `<=>`, `classifyDuplicate`) hanya **menandai** (`is_flagged`)
  saat **enrichment** — tutup **CONSTRAINTS #42 & #43** (`fusion.ts` kini punya konsumen produksi).
- `GET /api/questions/[id]` menyertakan `sources` (asal-usul butir).

### Diperbaiki
- **Bug ingest**: `commitItems` membuang `title`/`source_url` artikel — kini tersimpan
  ke `question_sources` (jejak provenance tidak lagi hilang).
- **Dedup salah arah**: `itemHash(source, stem)` memasukkan `source` → memicu duplikat
  lintas-sumber. Diganti `contentHash(stem, opsi)` (deprecated `itemHash`).
- **Db-test**: pembersihan `audit_logs` (trigger immutable) via DISABLE/ENABLE trigger.

### Migrasi
- Invarian tabel **28 → 29** (`invariants.ts` + `db-verify.ts`); migrasi drizzle `0008`.


## [M16] — Observabilitas & Operasional

### Ditambahkan — Observabilitas (M16)
- **Logger terstruktur** `src/lib/telemetry/logger.ts` — JSON satu baris, level
  (`debug|info|warn|error`), **redaksi rahasia** otomatis, korelasi `requestId`.
  warn/error → stderr; dibungkam saat tes.
- **Telemetri in-memory** `src/lib/telemetry/metrics.ts` — ring buffer per
  `METHOD route` (count, error, p50/p95/max), **nol dependency**.
- **Endpoint**: `/api/metrics` (JSON, dilindungi `METRICS_TOKEN`),
  `/api/ready` (readiness eksplisit). `/api/health` dipertahankan sebagai
  kontrak lama + tambahan `?probe=liveness` (tanpa DB).
- **Instrumentasi** `src/lib/api/route-wrapper.ts` — timing, `finish()`,
  `errorResponse(err, requestId, ctx)` + `extractCode`, hapus `console.error`.

### Ditambahkan — Operasional (M16)
- **Backup + uji restore**: `scripts/backup-db.mjs` (`pnpm backup:db`, retensi)
  & `scripts/restore-check.mjs` (`pnpm restore:check`, restore → `db:verify`).
  Uji-restore **terbukti hijau** (28 tabel, 26 trigger, HNSW, uuidv7).
- **CI** `.github/workflows/ci.yml` — service PostgreSQL 18 + pgvector,
  `pnpm check` + `pnpm test:db`.
- **Docker (opsi alternatif)**: `Dockerfile` (multi-stage Next standalone,
  non-root, healthcheck), `docker-compose.yml` (app + PG pgvector + Caddy TLS),
  `Caddyfile`, `.env.docker.example`, `.dockerignore`. **Produksi tetap systemd**
  (port 1234) — Docker hanya opsi untuk host/VPS lain.
- **Dokumen**: `RUNBOOK.md` (operasi harian/insiden), `MIGRASI-ZERO-DOWNTIME.md`
  (expand→migrate→contract, rollback).

### Diubah — Kualitas (M16)
- **Penamaan wajib INGGRIS** (CONSTRAINTS #28b diperketat, tanpa pengecualian):
  rename `pengaturan-view`→`settings-view`, `telaah-view`→`review-view`,
  `bank-soal-view`→`question-bank-view`; identifier `*Page`/komponen ke Inggris.
  Penjaga otomatis `scripts/check-names.mjs` (`pnpm lint:names`, masuk `pnpm check`).
- **`next.config.ts`**: `output: "standalone"` hanya bila `NEXT_OUTPUT_STANDALONE=true`
  (produksi systemd tak berubah).
- **Pemindai rahasia** dikalibrasi (placeholder CI/dummy/template) + tes regresi.
- **`BACKUP-RECOVERY.md` & `OBSERVABILITAS.md`**: status rencana → **TERIMPLEMENTASI**.

### Hasil (M16)
- **531 unit pass** (cov 92.74/83.95/91.58/94.84), tsc 0, lint 0, build OK,
  `lint:names` hijau, secret-scan bersih (493 berkas), smoke produksi 7/7.


## [M15] — UI/UX Polish & Aksesibilitas

### Ditambahkan — UI/UX (M15)
- **Halaman galat bertema**: `src/app/not-found.tsx` (404), `global-error.tsx`
  (inline CSS tahan gagal-stylesheet), `(app)/error.tsx` (boundary + reset),
  `(app)/loading.tsx` (skeleton) — **tak membocorkan** stack trace.
- **Halaman 403 Forbidden** (`src/app/forbidden/page.tsx`) + komponen bersama
  `src/components/layout/page-state.tsx` (server-safe).
- **Pintasan keyboard** (`use-keyboard-shortcuts.ts`): `/` cari, `?` bantuan,
  `g`+huruf navigasi (pola Linear/GitHub) + dialog `shortcuts-help.tsx`.
- **Lint a11y** `eslint-plugin-jsx-a11y` (dev-dep) + **uji a11y `axe-core`**
  (jsdom) pada komponen kunci.

### Diubah — UI/UX (M15)
- **`prefers-reduced-motion`** dihormati (`globals.css`) — WCAG 2.2 · 2.3.3;
  animasi/transisi ≈0, spinner tetap (umpan balik status).
- **Perbaikan a11y nyata** (temuan jsx-a11y): label↔kontrol (`htmlFor`/`id`) di
  `topics-view`, `ai-settings-card`, `pengaturan-view`; `error.tsx` pakai
  `useRouter` (bukan `window.location`).
- **`app-shell.tsx`**: pasang hook pintasan + dialog bantuan.

### Utang (M15)
- Uji perangkat HP nyata + audit Lighthouse ≥ 90 (butuh device/CI).

### Hasil (M15)
- **515 unit pass** (cov 92.99/84.99/90.67/94.87), **148 DB**, tsc 0, lint 0,
  `theme:check` 34/34, smoke 7/7.

## [M14] — Kualitas Kode & Tes

### Ditambahkan — Kualitas (M14)
- **Aturan lint CONSTRAINT #34** (`eslint.config.mjs`): `no-restricted-syntax`
  khusus `src/app/api/**` — larang `.select()` tanpa kolom di jalur baca API.
- **Tes baru**: `segment.test.ts` (8), `items.test.ts` (13), `app-shell.test.tsx` (7),
  `origins.test.ts` (11) — menutup celah coverage (segment 67%→100%).
- **`src/lib/auth/origins.ts`**: logika gerbang origin/lingkungan auth (murni):
  `isProductionRuntime`, `buildTrustedOrigins`, `resolveAuthSecret`.

### Diubah — Kualitas (M14)
- **Refactor `question-service.ts`** (502 baris → 3 modul + barrel izin-impor):
  `question-read.ts` (180), `question-write.ts` (279), `question-status.ts` (76).
  Nol perubahan call-site; perilaku identik (148 DB test tetap hijau).
- **Ambang coverage dinaikkan** 85/75/85/85 → **90/80/88/92** (`vitest.config.mts`).
- **`scripts/secret-scan.mjs`**: kalibrasi positif-palsu (skip kode/konstanta/sentinel).
- **`src/lib/auth/server.ts`**: memakai `origins.ts` (perilaku identik).

### Ditunda — Kualitas (M14)
- **TypeScript 7** (7.0.2, port Go) — ditunda; rencana di `docs/RENCANA-TS7.md`.

### Hasil (M14)
- **505 unit pass** (cov 93.25/84.95/91.91/95.28), **148 DB**, tsc 0, lint 0.

## [M13] — Keamanan Lanjutan (S5–S9)

### Ditambahkan — Keamanan (M13)
- **S5 Kebijakan sandi** (`src/lib/auth/password-policy.ts`): min 12, huruf+angka,
  blocklist sandi umum, tolak berulang; terpasang di Better Auth + UI `/change-password`.
- **S6 Pemindai rahasia** (`scripts/secret-scan.mjs`): regex murni Node (PEM, sk-,
  gh*, AIza, xox*, AKIA, JWT, URI DB, rahasia `v1:`), sadar placeholder. Dipasang
  sebagai **pre-commit hook** (`scripts/install-hooks.mjs`, `pnpm prepare`).
- **S7 Audit akses baca** (`recordViewAudit`): catat `view` (lihat kunci jawaban) &
  `export` (ekspor paket) — enum `audit_action` + `view`/`export` (migrasi 0007).
- **S8 Pantau advisory** (`pnpm security:advisories`): `pnpm audit` + versi paket kritis.

### Keamanan / Perbaikan
- **Override esbuild** (`pnpm-workspace.yaml`): buang `@esbuild-kit/esm-loader`
  (deprecated) → ganti `tsx`; menghilangkan `esbuild@0.18.20` rentan
  (GHSA-67mh-4wv8-2f99). `pnpm audit` kini **0 kerentanan**.
- **`src/proxy.ts`** (Next 16): membuang header `Content-Security-Policy` dari
  request masuk → pertahanan **CVE-2026-44581** (GHSA-ffhc-5mcf-pf4q).

### Catatan / Utang
- **S9 CSP nonce DIBLOKIR bug Turbopack** (vercel/next.js#93094): nonce tak
  ditempelkan ke `<script>` chunk di produksi → `strict-dynamic` memblokir semua
  JS. Direvert ke CSP statis; aktifkan kembali saat bug ditutup.

## [Unreleased] — M12 Ekspor Moodle (GitSync)

### Ditambahkan — Ekspor Moodle skema GitSync (M12)

- **Ekspor GitSync** (`src/lib/export/*`): **tulis folder** `top/<Topik>/<Subtopik>/`
  **langsung ke disk** (`~/mathbank-export/<paket>/`) — 1 berkas XML per soal +
  `gitsync_category.xml` (format `<question><category><text>top/Path</text>`).
- **Normalisasi LaTeX**: `$…$` → `\(…\)`, `$$…$$` → `\[…\]` (filter TeX Moodle).
- **Auto-commit Git** (D8): `git init` bila perlu → `add` → `commit` per ekspor.
- **Nama berkas & sanitasi meniru GitSync** (`BAD_CHARACTERS`, `maxcatlength=200`, `maxqlength=230`).
- **Service** `moodle-export-service`: rakit dari paket + topik soal; memakai
  **`answerKey.correct`** sebagai sumber kebenaran (bukan `options.isCorrect`).
- **Endpoint** `POST /api/bundles/[id]/export/moodle` (JSON: folder tujuan + hash commit).
- **UI** tombol "Ekspor Moodle" di detail paket + dialog blokir/catatan.

### Keputusan (terkunci 2026-09-30)

- D1 stimulus **inline** per-item · D2 tipe kompleks **dilewati + dilaporkan**
- D3 LaTeX `\( \)`/`\[ \]` · D4 **tolak** bila ada soal tanpa kunci
- D5 kategori = **topik** soal · ~~D6 ZIP~~ → **D7 tulis folder langsung** · **D8 auto-commit Git**


### Ditambahkan — MCP: agen AI on-demand (M11)

- **Server MCP** (`@modelcontextprotocol/sdk` 1.30.1, spec 2025-11-25): `McpServer` per-actor.
- **Transport**: **stdio** (`pnpm mcp:stdio`, klien desktop) + **Streamable HTTP** (`/api/mcp`, stateless, API key).
- **7 tool**: `search_questions` · `get_question` · `create_question` · `list_topics` · `list_sources` · `enrich_question` · `embed_questions`.
- **Kebijakan tulis 1 tempat** (`mcp/policy.ts`): kapabilitas → izin L1. Agen **tak pernah** melihat `answer_key`; tak ada tool status/hapus/bundle.
- **API key agen** (`/api/system/agent-keys` + kartu "Akses Agen" di Pengaturan): buat (tampil sekali) · daftar · cabut. Tersimpan **hash**.
- **Perbaikan**: `enrichment-service` cek izin **sebelum** kerja AI (fail-closed).
- **Tes**: +10 unit (policy) + 11 DB (MCP 6 · agent-key 5) → unit **419** · DB **139** · coverage **92,01%**.

## [Unreleased] — M10 AI Enrichment & Embedding (berjalan)

### Ditambahkan — Klien AI, embedding & enrichment (M10)

- **Gerbang LLM** (`src/lib/ai/client.ts`): satu tempat panggil LLM (OpenAI-compatible) — `chat` · `chatJson` · `listModels` · `health`. Provider = **setting**, bukan kode.
- **Konfigurasi AI** (`src/lib/ai/config.ts`): baca `app_settings` `ai.*`; `ai.api_key` didekripsi.
- **Enkripsi rahasia** (`src/lib/crypto/secrets.ts`): AES-256-GCM; kunci dari ENV `SETTINGS_ENC_KEY`. `ai.api_key` disimpan **terenkripsi at-rest**; UI hanya melihat `***`.
- **Embedding** (`src/lib/embedding/bge-m3.ts`): BGE-M3 via **Ollama** (`/api/embed`); validasi ketat **dim 1024**.
- **Enrichment** (`src/lib/services/enrichment-service.ts`): AI mengusulkan **topik · kesulitan(1–5) · kognitif(Bloom) · tags** → diterapkan + status `draft`→`review`. `answer_key` **tak pernah** disentuh. Manual + batch.
- **Pencarian semantik** (M6): param `mode=semantic` → embed query & urut jarak vektor (HNSW); fallback trigram otomatis.
- **Endpoint**: `/api/ai/{settings,models,health,enrich,embed}`.
- **UI**: kartu **AI / Enrichment** di halaman Pengaturan (model picker dari provider + cek layanan).
- **UI enrichment di halaman soal** (M10-f): tombol **"Enrich dengan AI"** + dialog pratinjau usulan (topik/kesulitan/kognitif/tags + catatan).
- **Keputusan status**: enrichment hanya menaikkan `draft`→`review`; status lain tetap (tak menurunkan soal yang sudah diverifikasi).
- **ENV**: `SETTINGS_ENC_KEY`, `BGE_M3_MODEL`; `BGE_M3_SERVICE_URL` default Ollama.
- **Tes**: +47 unit (crypto/client/enrich/embedding) + 14 DB = unit **405** · DB **128** · coverage **91,99%**.

## [Unreleased] — M9 Ingest Korpus (berjalan)

### Ditambahkan — Antrean, commit & endpoint ingest (M9-3)

- **Antrean** (`src/lib/ingest/queue.ts`): `enqueue` (dedup artikel via hash isi), guard balapan status (`pending → processing → completed/failed/skipped`), `listPending`.
- **Commit** (`src/lib/ingest/commit.ts`): `ParsedItem` → **soal `draft`** (semua hasil draft; jangan menebak kunci), sumber `website` otomatis per `source_origin`, idempoten (hash per-butir).
- **Orkestrasi** (`src/lib/ingest/service.ts`): segmentasi → unduh media → commit.
- **Endpoint wajah mesin** `/api/v1/ingest/{upload,queue,commit}` + kontrak Zod (`src/lib/contracts/ingest.ts`). Izin: `question:create` (upload/commit), `question:view` (queue).
- **Skema**: enum `ingest_status` += **`skipped`** (artikel tanpa soal); `ingest_queue` += `imported_questions_count`, `ai_notes`. Migrasi `drizzle/0006`.
- **Tes**: 13 integrasi DB + 9 alur API (114 DB total). E2E korpus nyata: m4thlab 13 soal; defantri 33 soal + 8 gambar.

### Ditambahkan — Adapter pusmendik (M9-2c)
- `pusmendik_dayaserap` (JSON terstruktur) → `JsonAdapter` + `segmentJson`; tipe
  PG/MCMA/Kategori → `single_choice`/`multiple_choice_checkbox`/`matrix_grid`.
- `pusmendik_tka` (HTML) → adapter HTML; soal = `<img>` di `div.isi-soal`.
- `media/fetch.ts`: TLS dilonggarkan **ter-pin** (`TLS_RELAXED_HOSTS`) untuk domain
  ber-sertifikat rusak; host lain tetap ketat.
- Kunci pusmendik **0/299** di sumber → kosong + flag (tidak menebak).

### Ditambahkan — Unduh gambar korpus (M9-2b)
- `src/lib/ingest/media/` (`resolve-url`, `fetch`, `store`, `ingest-media`). Prioritas
  `srcset` > `src` (mathcyber `src` = path crawler rusak/404, URL asli di `srcset`);
  simpan ke `MEDIA_STORAGE_PATH` dengan nama `contentHash` (dedup) + sharding 2 huruf;
  batas ukuran & whitelist mime; gagal → flag.
- `clean.ts`: `bestImageSrc` (pilih URL gambar terbaik dari `<img>`).
- `docs/RENCANA-MEDIA.md` — rencana penanganan gambar korpus.

### Ditambahkan — Segmentasi + adapter per-sumber (M9-2)
- `src/lib/ingest/parsers/{segment,items,types}.ts` + `adapters/{m4thlab,mathcyber,defantri,index}.ts`.
- Temuan: `value="corect"` (defantri) = **PENGECOH**, bukan kunci; mathcyber punya opsi
  **INLINE 2-kolom**; defantri dipisah `name="qN"`. Validasi 1.069 file → **20.946 soal**.

### Ditambahkan — Aturan general cleaning korpus (M9-1)
- `docs/ATURAN-CLEANING-KORPUS.md` — aturan general cleaning (final, keputusan user).
- `docs/EVALUASI-KORPUS-KOMPREHENSIF.md` — evaluasi **1.081 file** korpus; inventaris kotoran + temuan kritis.
- `src/lib/ingest/parsers/clean.ts` — fungsi murni cleaning (10 langkah) + `clean.test.ts` (22 tes).
- Temuan kritis: `[n]`,`[m]`,`[type]` adalah **LaTeX**, bukan shortcode → shortcode pakai **daftar-hitam** (`[collapse]`,`[spoiler]`), bukan buang-semua.


Semua perubahan penting proyek ini dicatat di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

---

## [Belum Dirilis]

### Diperbaiki
- **📦 Audit M7 (Paket Soal) — 2 bug nyata diperbaiki + 1 klaim dikoreksi** (`docs/VERIFIKASI-AUDIT-M7.md`):
  - **T-M7-2 (bug):** `reorderItems` menerima daftar **parsial** → terbukti live
    `orderIndex` jadi **`[1,1,2,2]`** (bentrok, urutan ambigu). Kini **wajib daftar
    lengkap** (tolak subset & id duplikat, `ConflictError`) + penulisan urutan dalam
    **transaksi**.
  - **T-M7-3 (bug):** RESTRICT hapus soal **tak sadar arsip** → setelah paket diarsip,
    hapus soal **tetap 409** (dead-end). Kini `isQuestionUsedInBundles`/
    `bundlesUsingQuestions` + enforcement di `question-service` (delete & hard-delete)
    **hanya paket AKTIF** (`innerJoin bundles + isNull(deletedAt)`).
  - **T-M7-1 (dokumen):** klaim "Deduplikasi Stimulus 1× otomatis" **berlebihan** —
    faktanya efek `UNIQUE` + konvensi `role`, bukan otomasi. Dikoreksi.
  - **Tes DB: 14 → 18** (+4). **Pelajaran → `CONSTRAINTS.md` #45–46.**

### Diubah
- **⬆️ P1 — bump patch/minor tumpukan** (`docs/EVALUASI-UPGRADE-TUMPUKAN.md`):
  `next` **16.3.6 → 16.3.7**, `react`/`react-dom` **19.2.8 → 19.3.0**,
  `eslint-config-next` **16.3.6 → 16.3.7**. **Gate penuh HIJAU:** tsc 0, lint 0,
  274 unit, 90 DB, build 0 (30/30), health 200, smoke ✅. TS 7 & ESLint 10 tetap
  **ditunda** (alasan di dokumen evaluasi).

### Ditambah
- **M8 — Ekspor Cetak Paket Soal** (Opsi A: cetak browser, **tanpa dependency baru**):
  halaman `bundles/[id]/print` + `src/styles/print.css` (`@page` A4, sembunyikan shell,
  page-break). Kontrol: 1/2 kolom · kunci (sembunyi/tandai tebal/lembar terpisah) ·
  lembar jawaban. Kunci hanya muncul bila `canSeeAnswerKey`.
- `listBundleItems` melampirkan **opsi** soal (batch, tanpa N+1) + tipe eksplisit
  `BundleItemWithQuestion` untuk pratinjau/cetak.

### Diperbaiki
- **T-M8-0**: tombol "Sunting"/"Cetak" di detail paket menuju `/sunting` & `/cetak`
  (**404**) → diperbaiki ke `/edit` & `/print`.
- **Rute tak konsisten**: `/references/event` (tunggal) → **`/references/events`**
  (jamak, sesuai PKN/Inggris); folder di-rename + nav/e2e/dokumen disinkronkan.

### Dokumentasi
- **🔧 `REVIEW-TUMPUKAN-TEKNOLOGI.md` disinkronkan** (verifikasi ulang 2026-09-30): §5/§6
  masih menyatakan "`radix-ui` terpasang, Base UI belum" — padahal **migrasi SUDAH selesai**
  (ADR-0008: `@base-ui/react`, `radix-ui` dihapus) → judul §5, tabel §6, & §0 temuan #2
  diperbarui + **§8 Catatan Verifikasi** ditambahkan. Klaim versi (next 16.3.7, react 19.3.0,
  TS 7.0.2, eslint 10.11.0) **masih benar**; paket rencana M4+ **belum dipasang** (#5 dipatuhi).
  Koreksi: §5 premis keliru (`AGENTS.md` = boilerplate Next, bukan sumber mismatch).
  **`docs/TUMPUKAN-TEKNOLOGI.md:58`** diperbaiki (`clsx`+`tailwind-merge` → **`cn`** + catatan
  Base UI). Sisa aksi upgrade (TS 7, ESLint 10, react-table v9, bump patch) **menunggu
  keputusan user** — bukan kelalaian.
- **📝 Catatan Verifikasi seragam di SELURUH dokumen `docs/audit/`** (CONSTRAINTS #44):
  tiap dokumen audit (M1–M7, Pustaka, Enterprise) kini punya blok **§Catatan Verifikasi**
  di akhir + status baris ditandai (✅/⚠️) — merujuk temuan nyata & perbaikannya. M6
  diperdalam: §1.2/§1.3 dikoreksi + kesimpulan lama "LULUS 100%" diberi peringatan.
  `README` audit diperbarui: tabel status verifikasi per-milestone + metrik terkini
  (274 unit / 86 DB / 30 halaman — ganti angka basi 229/80/28). M7 ditandai **belum
  diverifikasi** (jujur).

### Diperbaiki
- **🔎 Audit M6 — logika ambang dedup diperbaiki + status jujur** (`docs/VERIFIKASI-AUDIT-M6.md`):
  - **T-M6-1 (fix):** `dedup()` (`src/lib/search/fusion.ts`) menyatakan "exact (0.98)
    **ATAU** near (0.85) + penalaran sama", tapi kode faktual `s >= exact || (s >= near
    && …)` → karena `exact > near`, syarat `near` **menelan** `exact` → ambang exact
    **logika mati** & pasangan "near" dibuang **tanpa** cek penalaran. Diperbaiki:
    `≥exact` → duplikat (apa pun); zona near → duplikat **hanya bila penalaran sama**
    (`Candidate.reasoning` + `lookupReasoning` + `normReasoning`). **Terbukti:** pasangan
    s=0.857 penalaran-beda → dulu dibuang, kini **bertahan**. Tes 11 → **16** (+5).
  - **T-M6-2 (dokumen):** status `rrfFuse`/`dedup` di `docs/audit/M6-*.md` dari "✅ Lulus"
    → "⚠️ belum terintegrasi (dipakai M10)" — nol konsumen produksi.
  - **Koreksi:** klaim operator `word_similarity` keliru — kode memakai `%` (=`similarity()`).
  - **Jalur live SEHAT ✅** (trigram/typo/multi-kata/urut relevansi/filter subtree) —
    diverifikasi live; "multi-kata gagal" ternyata artefak shell (encoding), bukan bug.
  - **Pelajaran → `CONSTRAINTS.md` #42–43.**
- **🏢 Catatan Enterprise — penerapan selektif (verifikasi dulu, bukan asal ikut)**
  (`docs/VERIFIKASI-CATATAN-ENTERPRISE.md`):
  - **#2 (fix nyata):** `slugify(name, maxLength=255)` — NFKD bisa **memperpanjang**
    nama (ligatur `ﬃ`→`ffi`) sehingga `slice(0,255)` menulis ke kolom `varchar(100)`
    → **500**. Batas per-kolom (`tags`=100, `events.code`=50) + buang `-` ekor sesudah potong.
    **Terbukti live: 500 → 409/201.**
  - **#6:** `X-Request-ID` di semua respons `wrapRoute` (sukses/error) + log 500.
  - **#4:** `Idempotency-Key` (modul `src/lib/api/idempotency.ts`, siap-swap Redis) +
    opsi `idempotent: true` di `wrapRoute`; aktif di `POST /api/questions` & `/api/bundles`.
    **Terbukti live:** 2× POST key sama → id sama + `Idempotent-Replay`.
  - **#3 `"use cache"` DIBATALKAN** (keputusan sadar): `revalidateTag(t,'max')` = SWR →
    **data basi ~2–5 dtk** (terbukti live); `updateTag` hanya di Server Action;
    guard di `<Suspense>` menghilangkan **307 server**. **Revert** — dicatat kandidat M8+.
  - **Pelajaran → `CONSTRAINTS.md` #40–41.**
- **📚 Audit Pustaka — kedua temuan "redundan" SALAH** (`docs/VERIFIKASI-AUDIT-PUSTAKA.md`):
  paket `cn` = `shadcn-ui/cn` (drop-in clsx+tailwind-merge, ~22 file) → jangan ditukar;
  `tw-animate-css` dipakai (`globals.css`) → jangan di-prune. Versi & kesimpulan "bersih"
  akurat. **Tak ada perubahan kode.**
- **🌳 Audit M5 — integritas data pohon taksonomi (T-M5-2)** — verifikasi audit M5
  menemukan **re-parent topik TIDAK mempropagasi `level` ke keturunan**: memindah
  Kategori (L1) berisi Topik (L2) → induk jadi L2 tapi **anak tetap L2** (harus 3) →
  `listTopicsByLevel` & pemilih topik salah. **Perbaikan:** `updateTopic` kini
  menghitung `delta` dan meng-update **seluruh subtree** `level = level + delta`
  dalam **satu transaksi**. Terbukti live: A→L2, A1→L3.
  - **T-M5-1:** audit `updateTopic` salah label `create` → kini `update`
    ("Topik diperbarui"). Live: entri audit benar.
  - **T-M5-3:** endpoint `POST /api/tags/clean-unused` (diklaim dokumen audit tapi
    405) → **diimplementasikan** (`cleanUnusedTags`), hapus label `usage_count=0`.
    Live: `200 {removed:1}`.
  - **Pelajaran → `CONSTRAINTS.md` #38–39** (propagasi turunan hierarki + transaksi;
    audit `update` ≠ `create`).
  - **+2 tes DB** (86 total).
- **🚨 Audit M4 — bug KRITIS alur telaah (T-M4-3)** — verifikasi audit M4 menemukan
  **penelaah TIDAK BISA menyetujui/mengarsipkan soal** (`review→ready` → **403
  `Tidak punya izin: question:edit`**). Akar: gerbang route `[id]/status` memakai
  `permission: "question:edit"` → `assertCan` **tanpa `ownerId`** → semua peran
  ber-`own` ditolak. **Perbaikan:** hapus gerbang route; izin per-tujuan
  (`setReady`/`archive`/`edit`+owner) ditegakkan di service. **Terbukti live:**
  penelaah approve → **HTTP 200, status `ready`**.
  - **T-M4-4:** izin `question:hardDelete` (dulu MATI) kini dipakai —
    `DELETE /api/questions/[id]/permanent` + `hardDeleteQuestion()`; hanya soal
    soft-deleted; RESTRICT paket. Live: 409 tanpa soft-delete, 200 setelahnya.
  - **T-M4-5:** `changeQuestionStatus` kini penjagaan balapan
    (`WHERE id AND status=from` + `.returning()` → `ConflictError` 409).
  - **T-M4-1/T-M4-2:** dead links `/bank-soal/*` → **selesai** (M4c/M4d dibangun;
    rute `/questions/new`, `/questions/[id]`).
  - **Pelajaran → `CONSTRAINTS.md` #35–#37** (jangan izin `own` di gerbang route;
    penjagaan balapan; tes wajib lewat-route per peran).
  - **+4 tes DB** (84 total) untuk T-M4-3/4/5.

### Ditambahkan
- **M5 — Taksonomi (Referensi) selesai**:
  - **Topik** — pohon 3-level (`/referensi/topik`): CRUD, anti-siklus,
    hapus RESTRICT (tolak bila ada anak/dipakai soal).
  - **Sumber & Asal** (`/referensi/sumber`) — Buku/Situs/Sekolah/Kompetisi,
    slug otomatis, kolom "Dipakai" (usageCount nyata), hapus RESTRICT.
  - **Event** (`/referensi/event`) — UTBK/OSN dll + subtes & alias.
  - **Label** (`/referensi/label`) — tag lintas-topik + usageCount.
  - Service `taxonomy-service.ts` + API CRUD (`/api/{sources,events,tags}[/id]`).
  - Guard RESTRICT mencegah hapus entitas yang masih dipakai soal (409).
- **M4d — Telaah & Pengaturan** — **Telaah**: tab *Perlu Telaah* (`status=review`) & *Ditandai* (`flagged=1`); aksi penelaah setujui→`ready`, tolak→`draft` (+catatan), lepas tanda. **Pengaturan**: bagian *Umum* (nama org, jenjang & kesulitan bawaan) tersimpan ke `app_settings` via `GET/PATCH /api/settings`. Bagian AI ditandai "menyusul M10". **Keamanan:** service settings **memask nilai `is_secret`** (tak pernah dikembalikan) & endpoint umum **ber-allowlist** (kunci AI tak bisa ditulis dari sini — diuji). e2e 10/10. **Menutup M4 penuh.**

- **`MILESTONE.md` v2.0 — rombak menyeluruh** agar meng-cover semua sisa pekerjaan:
  - **3 fase eksplisit:** MVP (M1–M8) · Lanjut (M9–M12) · **Operasional/Hardening (M13–M17, baru)** — utang keamanan belum tertutup (S4–S9), kualitas tes, UI/UX polish, observabilitas, dokumentasi rilis 1.0.
  - **M4 dipecah 4 sub** (a/b ✅ · c/d ⬜) dengan task konkret per bagian.
  - **M5–M8 diperluas** (task nyata + dokumen pendukung yang belum ditulis).
  - **P1–P13** diperbarui (audit Base UI, fix akses LAN).
  - Tabel dokumen per-milestone + status; risiko jadwal; Langkah Berikutnya berurutan prioritas.
  - Disinkronkan: `KAMUS-DATA.md` (M0–M17), `PETA-DOKUMEN.md` (v2.0).
- **Skrip `pnpm start:lan`** (`next start -H 0.0.0.0`) — untuk menguji aplikasi dari HP/perangkat lain lewat LAN. Mode **dev** (Turbopack) mengirim ~8,8 MB JS + kompilasi on-demand → HP tampak "freeze" saat memuat; produksi hanya ~1,4 MB (6,3× lebih kecil). Didokumentasikan di `RENCANA-UI-MOBILE.md` §11.4.

### Ditambahkan
- **M4c — Editor soal & halaman detail** — rute `/bank-soal/baru` (buat) & `/bank-soal/[id]` (detail + sunting). Editor satu-komponen untuk **11 tipe** (kunci opsi vs teks), pratinjau KaTeX langsung, penandaan kunci (tunggal/multi), `distractor_rationale`, metadata (tipe/jenjang/kesulitan/kognitif), simpan draf atau kirim telaah. Detail: FSM (Kirim Telaah), hapus lunak + konfirmasi. **(Dahulu desktop-saja; kini responsif penuh — lihat M7.)** Menutup dead-link T-M4-1 (`/bank-soal/baru` & `/[id]` kini 200).
- **`docs/RENCANA-SOAL.md`** — 11 tipe final + pemetaan `answer_key`/`data_payload`.
- **Perbaikan tipe**: `PublicQuestion.answerKey` kini `AnswerKey` (dulu `Record<string, unknown>` longgar) — menutup ~15 error tipe tersembunyi.
- **🛡 Pengerasan Enterprise (P1–P5)** — atas analisis pemilik; **semua klaim
  diverifikasi ke codebase nyata** (semuanya valid):
  - **P1 — `/api/health`**: lapor koneksi DB + invarian (trigger/CHECK/HNSW/uuidv7);
    `200` sehat / `503` rusak. Modul `src/lib/db/invariants.ts` (sumber tunggal).
  - **P2 — Guard startup** (`src/instrumentation.ts`): saat server menyala, invarian
    diverifikasi → log ERROR bila hilang; `STRICT_INVARIANTS=true` menggagalkan startup.
  - **P3 — `audit_logs` append-only** (trigger DB `reject_audit_mutation`): UPDATE/DELETE
    ditolak di level DB (uji: INSERT ok, UPDATE/DELETE → error). Tahan manipulasi via
    DBeaver/pgAdmin, bukan hanya lewat app.
  - **P4 — `drizzle/manual/provision-prod.sql`**: provisioning 2-tahap (admin:
    ekstensi; app: role NOSUPERUSER + GRANT CRUD + audit append-only) — menutup S10.
  - **P5 — `docs/RENCANA-DEPLOY.md`**: langkah rilis dua-tahap + §5b guard/health.
  - **P6 (audit trigger DB di `questions`) DITUNDA** — butuh mekanisme aktor
    (`SET LOCAL app.actor`); lihat `RENCANA-ENTERPRISE.md` §E2.
  - Bukti: log `[invarian] OK — 26 trigger, 2 CHECK, 1 HNSW, uuidv7 ✓`; `/api/health` 200;
    immutability diuji; `db:verify` hijau. Tes: +3 (`health/route.test.ts`).
- **M7 — Paket Soal selesai** 🎉:
  - **Service** `bundle-service.ts` — CRUD paket + item (tambah/hapus/urut),
    validasi (soal tanpa kunci = peringatan), duplikasi, arsip (soft-delete),
    **RESTRICT** (soal dipakai paket → 409 saat dihapus). **Stimulus 1×**.
  - **API** `/api/bundles/**` (7 route) — semua ber-`rateLimit` + izin.
  - **UI responsif** (`/paket`, `/paket/[id]`, `/paket/[id]/sunting`) — daftar,
    detail + pratinjau KaTeX, **penyusun drag-and-drop** (`@dnd-kit/react`,
    keyboard-accessible). Panel bank soal: 2 kolom (desktop) / **Sheet** (mobile).
  - Tes: `bundle-service.db.test.ts` (14) + `bundle-api.db.test.ts` (8).
  - Dokumen: **`docs/RENCANA-PAKET.md`**.
- **Perubahan kebijakan responsif**: **`DesktopOnly` DIBUANG** (keputusan pemilik)
  — pola "desktop-saja" diganti **"Pola D′ — panel responsif (Sheet)"**.
  Editor soal & penyusun paket kini **berfungsi penuh di mobile**.
- **Evaluasi menyeluruh** — `docs/EVALUASI-MENYELURUH.md` (audit arsitektur,
  keamanan, a11y, mutu). `docs/EVALUASI-STRATEGI-E2E.md` + `EVALUASI-DESKTOPONLY.md`.

### Diubah
- **🌐 Semua URL/route kini **Bahasa Inggris** (konsistensi teknis). Label UI tetap
  Indonesia. Peta: `/bank-soal`→`/questions`, `/telaah`→`/review`, `/paket`→`/bundles`,
  `/referensi/*`→`/references/*` (`topik`→`topics`, `sumber`→`sources`, `label`→`labels`),
  `/studio/aset`→`/studio/assets`, `/sistem/*`→`/system/*` (`pengaturan`→`settings`),
  sub-route `baru`→`new`, `sunting`→`edit`, `cetak`→`print`. Aturan: `CONSTRAINTS.md #28b`.
  Halaman `/ganti-password`→`/change-password`. URL lama → 404 (belum ada redirect agar
  tak ada kebingungan; proyek pra-rilis).

### Diperbaiki
- **🧹 Perbaikan SELURUH temuan terkumpul (M2+M3+evaluasi)** — atas permintaan pemilik
  ("perbaiki seluruh temuan yang terkumpul"). Rencana: `RENCANA-PERBAIKAN-TEMUAN.md`.
  - **Keamanan:** NEW2 (`quick-login` tak bocorkan `detail`); NEW3 (`apikey.key` →
    `uq_apikey_key` UNIQUE; **koreksi: nilai = HASH**, bukan plaintext); NEW4
    (`listBundleItems` teruskan `actor`); D7 (`reference:manage` kini dipakai
    sources/events); D8 (`withUniqueGuard` → 409, bukan 500); D9 (JSON rusak →
    400 `INVALID_JSON`).
  - **A11y:** A2 (`aria-label` 2 input pencarian + 1 Select filter); A3
    (`TableCaption` 4 tabel + `scope="col"` default di `TableHead`).
  - **Mutu:** C1 (audit log untuk sumber/event/label/topik); C3 (helper `api<T>`
    diekstrak ke `src/lib/api/fetcher.ts`).
  - **S4 FK `author_id` sengaja TIDAK dikerjakan** — `author_id` sah menyimpan
    identitas non-user (`dev-user`, agen); FK akan memecah dev-bypass. Bukan batas
    kepercayaan (izin dari roles). Dicatat sebagai keputusan.
- **🎨 Warna status tema (T-M3-3) — perbaikan arsitektural** (verifikasi audit M3):
  - Warna status dipindah dari **hardcode di `build.ts`** → `tokens.ts` (`STATUS_TOKENS`,
    sumber kebenaran tunggal) → tak bisa lagi luput dari `theme:check`.
  - `theme:check` diperluas **16 → 34 pasangan** (kini mencakup `success/warning/error/info`
    & aksen di latar+kartu, 2 mode).
  - Nilai digelapkan agar **≥4.5:1 (AA)** di mode terang: success 3.70→**4.91**,
    warning 2.25→**4.92**, gold 2.47→**4.88**, info 3.94→**4.90**.
  - **Bug mode gelap**: `text-gold-fg` di atas `bg-gold/15` = **1.27:1** (badge "perlu
    perhatian" tak terbaca) → `accent-fg` gelap dibalik jadi terang (**lolos**).
  - Tes regresi `src/lib/theme/tokens-contrast.test.ts` (**+11 tes**).
  - Pasangan teoretis `accent-fg`-di-`accent` (tak dipakai UI) dihapus — verifikasi
    nyata, bukan teoretis.
- **🔐 Verifikasi audit M2 (Auth & Peran) — T1–T3** — atas laporan pemilik; semua
  klaim arsitektur **diverifikasi** (75 sel matriks ✅, 5 peran ✅, guard ✅).
  - **T1**: komentar `resolve.ts:10` basi ("session → API key", 2 jalur) → dikoreksi
    jadi 3 jalur (session → dev bypass → API key).
  - **T2**: dev bypass kini **3 pagar** — tambah gerbang **`APP_ENV`** (tolak
    `production`/`staging`). Menutup kebocoran hak admin di UAT/staging (NODE_ENV
    sering dibiarkan non-production).
  - **T3 (paling penting)**: `apiKeyPermissions` **dulu disimpan tapi TAK ditegakkan**
    → `can()` kini **menyempitkan** izin API key (tak pernah memperluas). Sebelumnya
    API key "berizin terbatas" tetap dapat seluruh izin peran = pembatasan kosmetik.
  - **+9 tes** (auth total **72**, dari 63).
  - **Koreksi penting:** temuan "login tanpa rate-limit" **sebagian besar salah** —
    rate-limit login **aktif otomatis** di produksi (rule bawaan Better Auth
    `/sign-in` 3 req/10 s), IPv6 sudah dinormalisasi, header default jalan. Dugaan
    "perlu `customRules`/`ipv6Subnet`" **dibatalkan** setelah verifikasi ke docs
    resmi 1.7.6 + kode library (pelajaran: verifikasi ke sumber primer).
  - **Yang nyata diperbaiki:**
    - **R1** — IP asli di balik **Cloudflare** ada di `cf-connecting-ip`; set
      `ipAddressHeaders: ["cf-connecting-ip"]` → tahan spoof (uji: `x-forwarded-for`
      palsu → bucket `no-trusted-ip`, header CF → IP betul).
    - **R2** — `storage: "database"` + tabel `rate_limit` (migrasi `0004`) →
      counter **persisten** & dibagi antar-proses (default `memory` hilang saat restart).
    - **R3** — `BETTER_AUTH_URL`/`APP_URL` = domain (systemd produksi); `.env`
      diperbaiki dari `http://localhost:3000`.
  - **Verifikasi:** 4 login → 3×400 lalu **429**; counter di DB; smoke 7/7; login
    demo via domain tetap jalan. Dokumen: `docs/RENCANA-RATE-LIMIT.md`.
- **Keamanan #33**: 3 route GET tanpa rateLimit (`auth/me`, `questions/[id]`,
  `settings`) → ditambah `rateLimit`.
- **Duplikasi**: ekstrak `bundleColumns()` di `bundle-service.ts`.
- **Dokumen**: 7 dokumen didaftarkan di `PETA-DOKUMEN.md` (langgar #31); perjelas
  pagar `DEMO_LOGIN` di `demo-users.ts`.
- **🔴 Review M3 — klaim "Verifikasi WCAG otomatis" palsu (tak ada kode)** — `A11Y.md` mencentang "kontras terverifikasi mesin" padahal `scripts/theme/` hanya konversi OKLCH. **Dibangun:** `src/lib/theme/color.ts` (konversi OKLCH↔sRGB + `contrastRatio` WCAG), `scripts/theme/tokens.ts`, `scripts/theme/check.ts` (`pnpm theme:check`, 16 pasangan × 2 mode, exit 1 bila gagal), tes `color.test.ts` (9), masuk gate `pnpm check`. **Hasil 16/16 lulus.**
- **🟢 Review M3 — optimasi shadcn** — audit aturan resmi: `SelectGroup` (bank-soal-view), `space-y-*`→`gap-*`, `dark:text-gold`→token, `<button>` kustom→`Button` resmi, buang `size-*` manual ikon, `role="img"` ikon Flag. e2e tema 10/10 + responsif 6/6.
- **🟡 Review M3 — nama variabel font** `--font-geist-mono` → `--font-roboto-mono`.
- **🟠 Review M2 — matriks izin dokumen vs kode menyimpang (3 sel)** — tabel "Matriks Izin Final" di `DESAIN-PER-LAPISAN-MATHBANK.md` berbeda dengan `permissions.ts` (sumber kebenaran). Diselaraskan: taksonomi (`own`/machine `yes`), enrichment (teacher/reviewer `no`, machine `yes`), buat soal (machine `yes` untuk ingest). Ditambah peringatan "kode menang bila berbeda". Ditemukan juga: **halaman login & forbidden belum ada** (MILESTONE salah centang) → dicatat sebagai utang **M15**; jumlah permission dikoreksi 16→**15** (75 sel).
- **🔴 Review M1 — migrasi dari nol RUSAK (ekstensi tak dimuat)** — `drizzle/0000_*.sql` memakai `vector(1024)` & `gin_trgm_ops` **tanpa** `CREATE EXTENSION` → di DB bersih `CREATE TABLE questions` gagal → **0 tabel**. Klaim "`db:migrate` mereproduksi skema penuh" tak terpenuhi. **Perbaikan:** `drizzle/manual/00-extensions.sql` (BARU) + `scripts/db-ensure-extensions.ts` (pra-migrasi, pesan jelas bila butuh superuser); `db:migrate` = ensure-extensions → migrate → safety. **Terverifikasi end-to-end:** migrasi DB kosong → skema **identik** DB asli (27 tabel, 14 enum, 81 index, 23 FK, 2 CHECK, 29 trigger, 1 HNSW, `uuidv7()`) + invarian menegakkan. Laporan: **`REVIEW-PER-MILESTONE.md`** (BARU). **+S10** (`KEAMANAN.md`): role DB produksi harus non-superuser.
- **🐛 Halaman tampil tanpa CSS saat diakses via HTTP (LAN)** — CSP `upgrade-insecure-requests` memaksa browser menaikkan semua request `http://` → `https://`. Di `localhost` browser mengecualikannya (secure context), tapi via **LAN** (`http://192.168.x.x:3001`, tanpa TLS) seluruh CSS/JS/font gagal dimuat → halaman tampil HTML polos. **Perbaikan:** directive itu **dan** HSTS kini hanya dikirim bila env **`APP_HTTPS=true`** (app di balik reverse-proxy TLS). Ini juga menutup kasus mode produksi yang diakses via HTTP. Terverifikasi via LAN (dev & produksi-HTTP): CSS/JS/font termuat, halaman bergaya penuh. Regresi dijaga e2e (`security-headers.spec.ts`). Didokumentasikan di `docs/KEAMANAN.md` §8 + `.env.example`.
- ~~Akses via LAN tampil tanpa CSS (perbaikan pertama: pindah ke CSP produksi saja)~~ — **kurang tepat** (produksi-HTTP masih kena); digantikan oleh kendali env `APP_HTTPS` di atas.

### Diubah
- **🎨 Basis primitif UI bermigrasi penuh: Radix UI → Base UI** (`@base-ui/react` 1.8.0) — menutup ambiguitas dokumen-vs-kode (ADR-0005 → **ADR-0008**). shadcn style kini **`base-nova`**:
  - **14 komponen `ui/**` di-regenerate** dari registry `base-nova` (button, badge, dialog, dropdown-menu, select, sheet, sidebar, tooltip, avatar, checkbox, label, separator, switch, tabs) — **nol impor `radix-ui`** di seluruh kode.
  - **9 penggunaan `asChild` → prop `render`** (cara Base UI) di 5 file: `app-sidebar` (2), `sidebar-user` (3), `header` (1), `desktop-only` (1), `bank-soal-view` (2).
  - **`nativeButton={false}`** pada `<Button render={<Link/>}>` — Base UI memerlukan ini saat elemen render bukan `<button>` (perbaikan peringatan a11y "expected a native `<button>`").
  - **`DropdownMenuLabel` dibungkus `DropdownMenuGroup`** — Base UI mewajibkan `Menu.GroupLabel` berada dalam `Menu.Group` (sebelumnya crash `MenuGroupContext is missing`).
  - **`tooltip` `delayDuration` → `delay`**; `command.tsx` `children` di-tipe ulang (`Omit<…,"children">`) karena `Dialog` Base UI menerima render-function.
  - **`radix-ui` + 44 paket `@radix-ui/*` di-uninstall** (bekas Radix bersih: `src/`, `components.json`, `package.json`).
  - Regresi yang dipulihkan saat regenerate: `src/hooks/use-mobile.ts` (kembali ke `useSyncExternalStore`, sesuai CONSTRAINT #6) & teks a11y Indonesia `sidebar.tsx` ("Buka/tutup sidebar").
  - Tes disesuaikan: `desktop-only.test.tsx` — `<Link>` kini `role="button"` + `href` (semantik Base UI).
  - Verifikasi: tsc 0 · lint 0 · unit **206** · e2e **41** · build 0 · browser bersih (nol error konsol; KaTeX + tema terang/gelap OK). Keputusan tercatat di **`docs/ADR/0008-basis-ui-base-ui.md`**.
- **`MILESTONE.md` disinkronkan dengan kenyataan (v1.1, 2026-09-29)** — setelah 12 commit terakhir:
  - Header status: "Draft v1, menunggu ratifikasi" → **"aktif — M0–M3 ✅, M4 berjalan"**.
  - Task M1/M2/M3 dicentang `[x]` sesuai kenyataan (⌘K, submenu Referensi, halaman kosong → selesai).
  - **M4 dipecah M4a–M4d**: M4a (service+API) & M4b (halaman daftar) ✅ dengan daftar task nyata; M4c (editor+detail, rute 404) & M4d (telaah+pengaturan) ⬜.
  - Tambah tabel **Pekerjaan Lintas-Milestone** (P1–P9): audit, shell shadcn, integritas DB, strategi tes, pembersihan QBank, uuidv7, dokumen enterprise, pagar keamanan S1/S2, riset Better Auth.
  - **Langkah Berikutnya** diperbarui (rencana lama "M1 dimulai" sudah terlampaui) + tabel riwayat perubahan.
  - `THEME-FRAMEWORK-GUIDE.md` **ditulis ulang** — sebelumnya mendokumentasikan var `--qbank-*` (salah; kode pakai `--mb-*`) dan file yang tak ada (`ThemeContext.tsx`, `ThemeSelector.tsx`, `sources.ts`); kini sesuai `scripts/theme/build.ts` + `--mb-*` + `next-themes`.
  - Judul dibersihkan: `ARSITEKTUR-DATA-FINAL` (QBank v2→MathBank), `CATATAN-INTERVIEW-ARSITEKTUR`, `DESIGN-THEME-FRAMEWORK` (QBank v1.0.0→MathBank, "PALET QBank"→"PALET MathBank"), `ARSITEKTUR-SISTEM-FULL` (→"Referensi (sebelumnya QBank)"), `CETAK-BIRU` (→"Cetak Biru MathBank").
  - ENV salah diperbaiki di `CETAK-BIRU`: `QBANK_*` → `AUTH_DEV_BYPASS`.
  - `MILESTONE.md` M3: task ditandai selesai; frasa "salinan Fase A/B QBank" dihapus.
  - `--qbank-*`, `data-mode=`, `--color-surface/text-*` (arsitektur tema lama): **nol** di seluruh dokumen.
  - Sebutan QBank yang **tersisa = sah** (pembanding "perbaikan dari QBank", arsip, laporan audit historis).
- **`uuidv7()` diterapkan** (Fase 2 audit, ADR-0003): PK semua tabel domain kini `uuidv7()` (PK berurutan waktu) — sebelumnya `gen_random_uuid()` (UUIDv4). Helper `uuidPk()` di `schema/_columns.ts`; migrasi `0003_cloudy_thunderbolt.sql`; `pnpm db:verify` memeriksa agar tak regresi. Terverifikasi di DB bersih.
- **Fase 2 audit — rapikan dokumen** (2026-09-29):
  - `VISION.md` **ditulis ulang untuk MathBank** (sebelumnya QBank-era: MBank-parity, enhancement, multi-tema; kini selaras PRD: bangun-dari-nol, sumber→paket→soal, non-goals).
  - `ROADMAP.md` → **`docs/arsip/ROADMAP-QBANK.md`** (banner arsip); `RENCANA-MIGRASI-DATA.md` → **`docs/arsip/`** (dibatalkan).
  - angka **"18 tabel" → 27** di `MILESTONE.md` (3 tempat), `ARSITEKTUR-DATA-FINAL.md`, `ARSITEKTUR-SISTEM-FULL.md`.
  - `MILESTONE.md`: tabel status milestone + header M1–M3 ditandai ✅ selesai; catatan status 2026-09-29.
  - `ARSITEKTUR-SISTEM-FULL.md`: banner "sebagian QBank-era" (arsitektur aktif = DESAIN-PER-LAPISAN).
  - `CETAK-BIRU-MATHBANK.md`: rujukan migrasi & ROADMAP diperbarui (arsip/dibatalkan).

### Ditambahkan
- **Tes komponen kustom** (2026-09-29): 7 berkas tes baru (**45 tes**) menutup celah cakupan UI yang ditemukan audit —
  - `src/components/questions/bank-soal-view.test.tsx` (**21**) — keadaan render (muat/galat/kosong/data), pencarian & filter (URL = sumber kebenaran), reset, paginasi (prev/next/nonaktif), panel filter mobile. Radix `Select` diganti `<select>` agar handler filter tercakup.
  - `src/components/questions/question-card.test.tsx` (9) — status/tipe/grade, seleksi, **gating `isCorrect`** (terkait S3), pemangkasan konten.
  - `src/components/layout/desktop-only.test.tsx` (3), `sidebar-user.test.tsx` (4), `page-header.test.tsx` (3), `skip-link.test.tsx` (2).
  - `src/lib/hooks/use-media-query.test.ts` (4) — subscribe/notify/cleanup via `matchMedia` tiruan.
  - `vitest.setup.ts`: stub `window.matchMedia` (jsdom tak punya).
  - Coverage: **17 file** terukur (dari 10) — **96,01%** statements, **90,12%** functions; unit **206** (dari 161).
- **Security headers (S2)** (2026-09-29): `next.config.ts` `headers()` untuk **semua rute** — CSP (ketat, `frame-ancestors 'none'`, `object-src 'none'`), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`; **HSTS hanya produksi**. `'unsafe-eval'` hanya di dev (React debug). Terverifikasi: halaman + KaTeX render benar (nol error CSP) + **8 tes e2e** baru (`e2e/security-headers.spec.ts`). Menutup utang **S2**; utang lanjutan **S9** (nonce).
- **Rate limiting (S1) — token bucket** (2026-09-29): `src/lib/api/rate-limit.ts` — in-memory, nol dependensi, **interface siap-swap ke Redis**. Diterapkan di `wrapRoute` (opsi `rateLimit`), di-key per aktor (fallback IP). Kelebihan → **429** + `Retry-After`. Kebijakan: default 60/menit; mutasi lebih ketat (POST 20, DELETE 10). **Terverifikasi live** (20×201 → 429) + **13 tes baru** (`rate-limit.test.ts` 10, `route-wrapper.test.ts` +3). Menutup utang keamanan **S1**.
- **Audit RBAC + riset Better Auth** (2026-09-29):
  - `src/lib/auth/resolve.test.ts` (**16 tes**) — pintu masuk identitas: pagar keras dev-bypass (mati di produksi), prioritas session→API key, pemetaan header, ketahanan error. **`resolve.ts` coverage 0% → 94%**.
  - `src/lib/auth/permissions.test.ts` (**20 tes**) — **kunci exhaustive** seluruh matriks izin (setiap sel 16 aksi × 5 peran) + invarian (machine tak boleh destruktif, agent tak boleh bundle, dll). Perubahan matriks tak sengaja kini **tertangkap tes**.
  - **`docs/RISET-BETTER-AUTH.md`** — evaluasi "Better Auth penuh vs otorisasi sendiri"; **rekomendasi: tetap otorisasi sendiri** (plugin Better Auth tak menjawab kebutuhan `own` + multi-role). Mengukuhkan ADR-0004. §7 memuat **verifikasi postur keamanan**: versi 1.7.6 di atas semua ambang perbaikan CVE 2025–2026; kelas CVE bypass middleware/Server-Action **tak berlaku** (kita pakai route handler, tanpa Server Action). `KEAMANAN.md` +S8.
  - Modul `auth` kini **43 tes** (dari 27).
- **7 dokumen enterprise 🟠 (penting)** (2026-09-29) — melengkapi fondasi enterprise:
  - `KONTRAK-API.md` — 13 endpoint nyata, envelope respons tunggal, peta kode error (400–500), guard kesiapan, rencana versioning.
  - `RENCANA-DEPLOY.md` — lingkungan, prasyarat PG 18, ENV produksi, langkah rilis, checklist pra-produksi.
  - `BACKUP-RECOVERY.md` — RPO/RTO, metode `pg_dump`, uji restore via `db:verify`, skenario pemulihan.
  - `KAMUS-DATA.md` — glosarium 27 entitas + taksonomi + proses + peran + jargon.
  - `A11Y.md` — target WCAG 2.2 AA, status terpenuhi vs utang, aturan pengembangan.
  - `CONTRIBUTING.md` (root) — setup, alur kerja, gate mutu, konvensi commit/kode.
  - `OBSERVABILITAS.md` — logging terstruktur, health check, metrik, alerting (rencana).
- **3 dokumen enterprise 🟢** (2026-09-29) — tak bergantung fitur baru:
  - `PERFORMA.md` — anggaran Core Web Vitals, kondisi nyata (halaman static, 50 index), titik rawan.
  - `SLA-SLO.md` — SLI/SLO usulan (uptime, latensi, RPO/RTO), error budget.
  - `GOVERNANCE.md` — peran, jenis keputusan, alur, kepemilikan dokumen.
  - `KEPATUHAN-PRIVASI.md` — UU PDP 27/2022 + GDPR: data pribadi nyata (user, session ip/user-agent, account token, audit_logs), hak subjek data, retensi, notifikasi pelanggaran 72 jam.
- **`docs/PETA-DOKUMEN.md`** — indeks hidup seluruh dokumen (ada + direncanakan) dengan status & tata kelola; mencegah "dokumen lupa".
- **`docs/KEAMANAN.md`** — model keamanan: aset, threat model (STRIDE), autentikasi, RBAC, permukaan berisiko, utang keamanan (S1–S7), daftar periksa pra-produksi.
- **`docs/ADR/`** — Architecture Decision Records: `README` (indeks), `template`, dan 7 ADR awal (bangun-ulang, lapisan L1–L9, PG18+uuidv7, Better Auth multi-role, shadcn resmi, invarian lunak, DB reproduktif).
- **CONSTRAINTS #31–32** — tata kelola dokumen (wajib terdaftar di PETA) + ADR untuk keputusan besar.
- **`docs/STRATEGI-TES.md`** — kontrak pengujian per-lapisan (L1–L9): jenis tes wajib, Definition of Done per milestone, infrastruktur DB uji, ambang coverage, daftar utang tes.
- **Tes API (`src/lib/api/route-wrapper.test.ts`)** — 22 tes: alur sukses, pemetaan error 401/403/404/409/422/400/500, auth & izin (mock `resolveActor`).
- **Tes integrasi service (`src/lib/services/question-service.db.test.ts`)** — 21 tes terhadap DB uji: transaksi (soal+opsi+topik/label), invarian DB (stimulus depth, difficulty), guard FSM + kesiapan (`ready` wajib `answer_key`), audit.
- **Infrastruktur tes DB** — `vitest.db.config.mts`, `scripts/test-db.ts`, `pnpm test:db` (menyasar `TEST_DATABASE_URL`, memblokir salah sasaran ke DB dev).
- **Integritas & Reproduktibilitas DB** (perbaikan Fase 1 audit):
  - `drizzle/manual/db_safety.sql` — fungsi `set_updated_at`, 21 trigger `updated_at`, trigger `trg_questions_stimulus_depth` (stimulus maks 1 level), `trg_topics_cycle` (cegah siklus taksonomi), `trg_question_{topics,tags}_usage` (`usage_count` akurat), + index **HNSW** `idx_questions_embedding_hnsw`.
  - `scripts/db-apply-safety.ts` + `pnpm db:safety` (di-chain otomatis dari `pnpm db:migrate`).
  - `scripts/db-verify.ts` + `pnpm db:verify` — memeriksa tabel/CHECK/trigger/HNSW, **gagal bila drift**.
  - Migrasi drizzle-kit `0002_naive_nightshade.sql` — CHECK `chk_questions_difficulty` (1–5) & `chk_topics_level` (1–3).
  - **`assertReady`** di `question-fsm.ts` — soal boleh dibuat tanpa `answer_key`, tapi **tak bisa `ready`** (422 `NOT_READY`) & tak bisa diekspor Moodle sampai jawaban diisi (kecuali `stimulus`).
  - **CONSTRAINTS #24–27** — aturan DB (reproduktif, `db:verify` hijau, snapshot drizzle, invarian lunak di service).
- **Fase R — Responsif** (sisipan sebelum M4c):
  - **R1** Navigasi mobile: `MobileNav` (Sheet kiri) + tombol ☰ di header; sidebar desktop `hidden lg:flex`.
  - **R2** Header responsif: mobile (☰ + judul halaman + ikon cari), desktop (breadcrumb penuh + kotak cari).
  - **R3** Bank Soal: filter → Sheet di mobile (badge jumlah aktif); panel tetap di desktop; toolbar & paginasi ringkas.
  - **R5** Dasbor: grid `2 → sm:3 → lg:6` (diverifikasi).
  - **R6** `useMediaQuery` + komponen `DesktopOnly` (pengalih halaman desktop-saja).
- **Rancangan responsif enterprise** — `docs/RENCANA-UI-MOBILE.md` v2 (17 bagian + 2 lampiran, matriks adaptasi 22 elemen).
- **CONSTRAINTS #10–14** — aturan responsif (wajib desktop+tablet+mobile, touch 44px, `MathContent` overflow-x-auto, input ≥16px, batas kunci `lg`).
- **E2E Playwright** (`e2e/`) — tema (5), responsif (3), Bank Soal (5), API (5); proyek `desktop` (1280) & `mobile` (Pixel 5). Skrip `pnpm e2e`.
- **`/api/stats`** + hook `use-stats` — Dasbor kini **nyata** (statistik, aktivitas, distribusi), bukan angka statis.
- **`docs/AUDIT-KODE.md`** — audit menyeluruh (9 temuan: 1 kritis, 1 tinggi, sisanya kecil).

### Diubah
- `MathContent` — dukung `\(...\)` & `\[...\]` (selain `$...$`); pembungkus `overflow-x-auto` (rumus lebar tak memecah layout).
- `CONSTRAINTS.md` — perbaiki duplikasi nomor; aturan responsif ditambahkan; perjelas gerbang coverage.
- **Gerbang mutu diperbaiki** — coverage **kini nyata & terukur** (`@vitest/coverage-v8`); `pnpm check` menjalankan `test:coverage`. Cakupan **98,7% stmt / 97,6% cabang / 100% fungsi**.

### Diperbaiki (audit)
- 🔴 **Coverage palsu** — dulu 9,12% (dependensi absen → ambang tak pernah dievaluasi). Kini diukur nyata.
- 🟠 **`AUTH_DEV_BYPASS`** — kini dijaga `NODE_ENV !== "production"`: bypass **mati total** di produksi.
- 🟡 **Dasbor hardcoded 0** → data nyata dari `/api/stats`.
- 🟡 **`changeQuestionStatus`** — tak lagi tulis DB + audit saat status tak berubah.
- 🟢 **`labels.ts`**, `actor.ts`, `roles.ts`, kelas error guard — sebelumnya 0% tes, kini tertutup.
- 🟢 Hapus `src/lib/search/smoke.test.ts` (placeholder).

### Ditunda
- **R4** (detail soal: app bar + aksi sticky) → digabung ke **M4c** (halaman detail dibangun pertama kali di sana).
- **R7** audit aksesibilitas menyeluruh → menyusul setelah halaman-halaman ada.
- Rute `/bank-soal/baru` & `/bank-soal/[id]` → **M4c** (kini 404; tombol "Buat Soal" & kartu belum aktif).

### Gerbang Mutu
- `tsc` 0 · `lint` 0 · **tes 68/68 · coverage 98,7%** · `build` 0 · **e2e 33 hijau** (desktop 17 / mobile 16).

---

## [0.4.0] — M3: Tema & Shell

### Ditambahkan
- **Mesin tema** — 3 warna sumber (`#0158CA`, `#D5AC1E`, netral) → token OKLCH; skrip `pnpm theme:build` (`scripts/theme/build.ts` → `src/styles/tokens/generated.css`).
- **Komponen UI** — shadcn/ui (13 komponen: button, badge, card, dialog, input, textarea, select, tabs, table, dropdown-menu, separator, tooltip, command, sonner).
- **Komponen keadaan** — `EmptyState`, `LoadingState`, `ErrorState`, `ComingSoon` (`src/components/ui/states.tsx`).
- **Shell aplikasi** — sidebar kiri 4 grup (Kerja/Referensi/Studio/Sistem) yang *collapsible*, header (breadcrumb + ⌘K + toggle tema), command palette.
- **Dasbor informatif** — 6 kartu statistik, aktivitas terbaru, antrean kurasi, 3 kartu sebaran.
- **11 halaman placeholder** — `ComingSoon` jujur per milestone (`/bank-soal` … `/sistem/pengaturan`).
- **Penyedia** — `ThemeProvider` (next-themes, default ikut OS) & `QueryProvider` (React Query).
- **Font** — Roboto Flex (UI) + Roboto Mono (kode).
- Paket M3: `@tanstack/react-query`, `katex`, `lucide-react`, `cmdk`, `sonner`, `next-themes`.
- Tes `nav-config` (5 kasus) — struktur sidebar teruji.

### Diubah
- `layout.tsx` — font Geist → Roboto, `lang="id"`, dibungkus penyedia tema & query.
- `globals.css` — impor token tema; `--primary` dipetakan ke `--mb-brand`; utilitas `bg-brand`/`text-gold`/`text-error` dst.

### Catatan Teknis
- **Tanpa pelanggaran React Compiler** — status sidebar lewat `useSyncExternalStore` (bukan setState-in-effect).
- Menu **Ingest disembunyikan** sampai M9 (`hidden: true` di nav-config).
- Warna status **universal** (tak ikut brand); "Siap" = biru brand.

### Gerbang Mutu
- `tsc` 0 error · `lint` 0 · tes 18/18 · `build` 0.

---

## [0.3.0] — M2: Auth & Peran

### Ditambahkan
- **Peran formal** (5) — `admin`, `teacher`, `reviewer`, `agent`, `machine` (`src/lib/auth/roles.ts`).
- **Matriks izin** — 14 izin × 5 peran, akses `yes`/`own`/`no` (`src/lib/auth/permissions.ts`).
- **Guard** — `can`, `effectiveAccess`, `assertCan`, `hasRole` (`src/lib/auth/guards.ts`).
- **Better Auth** — instance + drizzle adapter + api-key (`src/lib/auth/server.ts`).
- **Actor resolver** — session/apikey → `Actor` (multi-role dari `user_roles`) (`src/lib/auth/resolve.ts`).
- **Pembungkus route (L4)** — `wrapRoute` menghapus boilerplate (aktor, 401, izin, Zod, error) (`src/lib/api/route-wrapper.ts`).
- **Endpoint** — `GET /api/auth/me` (identitas) + catch-all Better Auth.
- Tes matriks izin (12 kasus).

### Diubah
- `vitest.config.mts` — `fileURLToPath` untuk `__dirname` (menghapus peringatan).

### Gerbang Mutu
- `tsc` 0 error · `lint` 0 · tes 13/13 · `build` 0.

---

## [0.2.0] — M1: Skema Database

### Ditambahkan
- **27 tabel** (21 domain + 6 auth) di PostgreSQL 18:
  - **Soal & Asal** (7): `sources`, `books`, `institutions`, `events`, `questions`, `question_options`, `solutions`
  - **Taksonomi & Paket** (7): `topics`, `grades`, `difficulty_levels`, `cognitive_levels`, `tags`, `question_topics`, `question_tags`
  - **Paket & Sistem** (7): `bundles`, `bundle_items`, `media_assets`, `question_media`, `app_settings`, `audit_logs`, `ingest_queue`
  - **Auth** (6): `user`, `session`, `account`, `verification`, `apikey`, `user_roles`
- **15 enum** — `question_type` (11 nilai), `question_status`, `cognitive_level`, `solution_type`, `role`, dll.
- **Trigger `updated_at`** — 21 trigger via fungsi `set_updated_at`.
- **Seeder taksonomi** — `scripts/seed-taxonomy.ts` (19 jenjang, 5 kesulitan, 6 level kognitif) dari `curriculum.yaml`.
- **Invarian** — termasuk RESTRICT (stimulus dengan anak tak bisa dihapus), via Drizzle + trigger.

### Catatan Teknis
- `uuidv7()` (fitur PG 18) sebagai default PK; ekstensi `vector 0.8.6` + `pg_trgm 1.6`.
- Stimulus via `parent_id` (tanpa tabel `passages`); `institutions` anak `sources` (pola B).

---

## [0.1.0] — M0: Fondasi & Perencanaan

### Ditambahkan
- **Scaffold** — Next.js 16.3.6 + React 19.2.8 + Tailwind 4.3.3 + TypeScript 5.9.3.
- **Gerbang mutu** — `CONSTRAINTS.md` (typecheck 0, lint 0, coverage ≥85%, build 0).
- **Perkakas** — Drizzle ORM + postgres, Better Auth, Zod, Vitest, Testing Library, ESLint.
- **Konfigurasi** — `drizzle.config.ts`, `vitest.config.mts`, `.env.example`, skrip npm (dev/build/lint/typecheck/test/db:*/theme:build).
- **Dokumentasi perencanaan** (20 dokumen di `docs/`):
  - Arsitektur 9 lapisan: `DESAIN-PER-LAPISAN-MATHBANK.md`, `ARSITEKTUR-SISTEM-FULL.md`, `ARSITEKTUR-DATA-FINAL.md`, `L7-TINJAUAN-KRITIS-DATA.md`
  - Produk: `PRD.md`, `MILESTONE.md`, `VISION.md`, `ROADMAP.md`, `CETAK-BIRU-MATHBANK.md`
  - Data & UI: `SKEMA-DB-DETAIL.md`, `RENCANA-UI.md`, `STATUS-UI-MENGGANTUNG.md`
  - Teknis: `TUMPUKAN-TEKNOLOGI.md`, `DESIGN-THEME-FRAMEWORK.md`, `THEME-FRAMEWORK-GUIDE.md`
  - Proses: `RIWAYAT-KEPUTUSAN.md`, `CATATAN-PLANNING.md`, `CATATAN-INTERVIEW-ARSITEKTUR.md`

### Keputusan Kunci
- **MathBank dibangun dari kanvas bersih** — menggantikan QBank sepenuhnya; tanpa migrasi data.
- **9 lapisan arsitektur terkunci** (L1–L9).
- **MVP = alur tuntas** — bank soal + paket + ekspor (cetak/PDF).
- **AI = konfigurasi** (`app_settings`), bukan hardcode — untuk 9router dkk.

---

## Konvensi Penomoran Versi

- **MAJOR** — perubahan besar/perombakan tak kompatibel.
- **MINOR** — milestone baru (M1, M2, M3 → 0.1.0, 0.2.0, 0.3.0).
- **PATCH** — perbaikan kecil dalam milestone.

Setiap **milestone selesai** = satu entri versi MINOR. Rujuk `MILESTONE.md`.
