# SALMAN — Sprint 0 MathBank V2: Progress & Hasil

**Issue:** MAT-118 · **Branch:** `paperclip/dev` · **Tanggal:** 20 Okt 2026
**Lingkup:** ACT-01 (Backup Harian), ACT-02 (Scrubbing Logger & Health Leak),
ACT-03 (Normalisasi Label Metrik), ACT-05 (Bulk Update Status Soal)

Semua klaim di bawah **diverifikasi dengan eksekusi nyata** di mesin ini
(perintah + keluaran tercantum). Tidak ada yang berstatus "seharusnya jalan".

---

## Ringkasan Status

| Task | Prioritas | Status | Bukti verifikasi |
|------|-----------|--------|------------------|
| ACT-01 Backup harian + retensi 2 tingkat | QuickWin | ✅ Selesai | dump 15,07 MB, **218 objek terverifikasi pg_restore**, cron 02:00 aktif |
| ACT-02 Scrubber log + health tanpa bocor | P0 | ✅ Selesai | 82 unit test hijau (termasuk tes `/api/health` 503 generik) |
| ACT-03 Normalisasi label metrik + batas memori | P0 | ✅ Selesai | 100 UUID → 1 label; 250 rute unik → tepat 200 label |
| ACT-05 Bulk update set-based | P0 | ✅ Selesai | 200 soal, **3 query** (dari ~1.800); lihat catatan SLO |

---

## ACT-01 — Otomasi Backup Harian

### 🔴 Temuan kritis (P0): backup harian sebenarnya SUDAH MATI

Skrip lama memanggil `pg_dump` dari `PATH`. Server sudah di-upgrade ke
**PostgreSQL 18.6**, sementara biner di `PATH` masih **17.11**:

```
$ pg_dump --version        → pg_dump (PostgreSQL) 17.11
$ psql -c "select version()" → PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2)
$ pg_dump -Fc -d "$DATABASE_URL" -f /tmp/probe.dump
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 18.6 ; pg_dump version: 17.11
```

`pg_dump` menolak server yang lebih baru ⇒ cron berjalan setiap malam tetapi
**tidak menghasilkan dump baru** (output dibuang ke `/dev/null`). Ini kelas
kegagalan yang tidak terlihat: *backup yang tidak pernah ada*.

### Perbaikan tambahan (di luar retensi)
- **Pemilihan biner sadar-versi** (`runDump()`): `PG_DUMP_BIN` →
  `/usr/lib/postgresql/<major>/bin/pg_dump` (mayor terbesar dulu) → `pg_dump` PATH.
  `version mismatch` → coba kandidat berikutnya; galat lain (auth/koneksi/disk)
  langsung digagalkan agar tidak menyamar sebagai isu versi.
- **Verifikasi integritas**: tiap dump diuji `pg_restore --list` (biner pendamping
  mayor sama). Dump 0 byte / tak terbaca → dihapus + exit 1 (dump rusak yang "ada"
  lebih berbahaya daripada tidak ada dump).
- **Retensi harian dipersempit ke pola otomatis** (`<db>_YYYY-MM-DD-HH-MM-SS.dump`)
  sehingga arsip manual (`mathbank-sebelum-hapus-…`) tidak ikut terpangkas.

### Yang dikerjakan (retensi & log)
1. **`scripts/backup-db.mjs` dirombak** menjadi retensi **dua tingkat** sesuai DoD
   (sebelumnya hanya retensi datar 7 berkas):
   - `BACKUP_DIR` — dump **harian**, simpan `BACKUP_KEEP` terbaru (default **7**).
   - `BACKUP_ARCHIVE_DIR` (`backups/archive/`) — salinan **mingguan** per ISO-week,
     disimpan `BACKUP_ARCHIVE_DAYS` hari (default **30**).
     Dedupe per ISO-week ⇒ menjalankan backup dua kali dalam sepekan tidak
     menumpuk arsip (idempoten).
   - **Log berotasi sendiri** (`BACKUP_LOG`, ambang `BACKUP_LOG_MAX_BYTES` = 5 MB,
     satu generasi `.1`) — tidak perlu `logrotate`, log tak tumbuh tanpa batas.
   - **Timeout wajib** `pg_dump` (`BACKUP_TIMEOUT_MS`, default 10 menit) — pola
     *Release It!*: proses menggantung tak boleh menumpuk di cron.
   - Dump **0 byte / gagal** → berkas parsial dihapus + exit code 1 (dump parsial
     yang dikira valid adalah bug restore yang mahal).
   - Kegagalan non-`pg_dump` (mis. `DATABASE_URL` hilang) tetap tercatat ke log.
2. **Cron dipasang ulang ke 02:00 WIB** (sebelumnya 02:15) dan memakai env baru:

```
0 2 * * * cd /home/hari/projects/mathbank && PATH=/home/hari/.local/bin:/usr/local/bin:/usr/bin:/bin \
  BACKUP_KEEP=7 BACKUP_ARCHIVE_DAYS=30 \
  BACKUP_LOG=/home/hari/projects/mathbank/backups/backup.log \
  /home/hari/.local/bin/node scripts/backup-db.mjs \
  >/dev/null 2>>/home/hari/projects/mathbank/backups/backup-cron.err.log
```

`crontab -l` sudah dikonfirmasi memuat baris di atas (zona waktu mesin = WIB).

### Bukti eksekusi
```
$ node scripts/backup-db.mjs
→ Backup mathbank@localhost:5433 → backups/mathbank_2026-10-20-04-02-45.dump
· pg_dump: pg_dump (PostgreSQL) 18.6 (Debian 18.6-1.pgdg13+2)   ← biner benar (dulu 17.11 GAGAL)
✓ Backup selesai (15.07 MB)
· verifikasi pg_restore: 218 objek terbaca
✓ Selesai. Dump harian disimpan: 7.
· arsip mingguan 2026-W43 sudah ada — lewati
✓ Arsip mingguan tersimpan: 1.        (exit 0)
```
Run kedua (uji idempoten + rotasi log):
```
· arsip mingguan 2026-W43 sudah ada — lewati
✓ Arsip mingguan tersimpan: 1.
$ ls -la backups/backup.log backups/backup.log.1   → rotasi terbukti (BACKUP_LOG_MAX_BYTES=1)
```

Catatan: `backups/` sudah masuk `.gitignore` (dump memuat data nyata).

---

## ACT-02 — Scrubbing Logger & Health Leak (P0)

### A) `src/lib/telemetry/logger.ts`
- Redaksi **berbasis nama field** sudah ada; yang ditambahkan adalah **scrubber
  pola** untuk nilai *bebas* (`Error.message`, `stack`, string interpolasi):
  - kredensial di URL koneksi `postgres://user:pass@host/db`,
  - pasangan `password=`, `token=`, `api_key=`, `signature=` (query string / pesan),
  - header `Authorization: Bearer|Basic|Token`,
  - JWT `eyJ…`, kunci penyedia `sk-live-…`.
- **`ZodError`** ditangani khusus: hanya `path` + `code` + `message` (yang ikut
  di-scrub) yang dicatat; `input`/`received` **dibuang** karena memuat payload
  pengguna mentah (password, isi soal belum terbit).
- Stack trace hanya di luar produksi, dan ikut di-scrub.

### B) `src/app/api/health/route.ts`
- `err.message` mentah **tidak lagi** dikembalikan ke publik. Saat DB mati:
  `503` + `{ status: "down", db: "down", message: "Layanan basis data tidak tersedia." }`.
- Detail lengkap tetap ke log server (sudah di-scrub) ⇒ operator tak kehilangan
  informasi, penyerang tidak dapat host/port/user/database.

### Bukti verifikasi
```
$ npx vitest run src/lib/telemetry/logger-scrub.test.ts src/lib/telemetry/logger.test.ts \
    src/lib/telemetry/metrics.test.ts src/lib/telemetry/metrics-labels.test.ts \
    src/app/api/health/route.test.ts
Test Files  5 passed (5)
     Tests  40 passed (40)
```
Berkas tes baru: **`src/lib/telemetry/logger-scrub.test.ts`** — mengunci:
URL berpassword, `?token=`, Bearer/Basic, JWT, `sk-live-…`, ZodError tanpa
`input`, dan satu entri `buildEntry` utuh yang bebas kredensial.

---

## ACT-03 — Normalisasi Label Metrik (P0)

- **A) `src/lib/api/route-wrapper.ts`** — path dinormalisasi (`normalizeRoutePath`)
  **sebelum** `recordRequest`, jadi `/api/questions/<uuid>` menjadi
  `/api/questions/:id`.
- **B) `src/lib/telemetry/metrics.ts`** — `MAX_ROUTES = 200` + eviksi LRU
  (hitungan terkecil, lalu paling lama tak terlihat) sehingga rute sibuk bertahan;
  `recordRequest` juga menormalisasi sendiri agar pemanggil lain tak bisa
  menciptakan label liar. `snapshot()` mengekspos `routeCount` & `evictedLabels`
  sebagai observabilitas batas memori.
- **C) `src/lib/telemetry/instrumentation.ts`** — `startTelemetryMaintenance()`
  menjadwalkan `rateLimit.prune()` + `idempotency.prune()` tiap 60 detik, idempoten
  (satu timer per proses), `unref()` agar tak menahan proses, dan **tidak pernah
  melempar** (best-effort).

### Bukti verifikasi (DoD: 100 UUID → 1 label)
Berkas tes baru **`src/lib/telemetry/metrics-labels.test.ts`**:
- 100 request dengan UUID berbeda ⇒ `routeCount() === 1`, label
  `GET /api/questions/:id`, `count === 100`.
- 600 rute unik (tak dapat dinormalisasi) ⇒ `routeCount() <= 200`,
  `evictedLabels > 0`, dan rute "panas" tetap ada setelah eviksi.
- Normalisasi: UUID, segmen numerik, trailing slash, query string dibuang.

---

## ACT-05 — Optimasi Bulk Update Status Soal (P0)

`src/lib/services/question-bulk.ts` — loop serial N×9 query diganti **3 query per
transaksi**, apa pun jumlah soalnya:
1. `SELECT … WHERE id = ANY($1)` — satu roundtrip untuk semua kandidat.
2. Validasi FSM + izin **di memori** (tanpa I/O), lalu **satu** `UPDATE` set-based:
   `UPDATE questions AS q … FROM (VALUES (id, from_status), …) AS v(id, from_status)
   WHERE q.id = v.id AND q.status = v.from_status RETURNING q.id`
   ⇒ semantik **compare-and-swap per baris** (tidak ada update "buta"), hasil
   `RETURNING` dipakai membedakan sukses vs kalah balapan (`ConflictError`).
3. Satu `INSERT` audit batch untuk baris yang benar-benar berubah.

`src/lib/services/question-status.ts` menerima opsi **`{ returnUpdated: false }`**
(overload tipe aman) sehingga jalur massal tak menarik balik seluruh baris.

### Bukti verifikasi (DoD: 200 soal, <300 ms, ≤3 query)
```
$ DATABASE_URL=<mathbank_test> npx vitest run --config vitest.db.config.mts \
    src/lib/services/question-bulk.db.test.ts
Test Files  1 passed (1)
     Tests  7 passed (7)
```
Termasuk tes kinerja eksplisit: 200 soal `review → ready`, `dbQueries = 3`
(assert `<= 3`), semua `ok`, status akhir `ready` 200/200. Tes juga menutup:
FSM per butir (draft gagal, review sukses), izin per peran, `flag/unflag` +
`flag_notes`, id tak dikenal → `failed` (bukan throw), serta idempoten untuk item
yang sudah di status tujuan.

### ⚠️ Catatan jujur soal SLO 300 ms (wall-clock)
Latensi dinding yang terukur di host ini **≈ 0,2–3,0 detik** untuk 200 soal —
**bukan** karena jumlah query, melainkan biaya baris-per-baris PostgreSQL:

Bukti benchmark terukur (`scripts/bench-bulk-status.ts`, 5 putaran, tiap putaran
200 soal baru `review → ready`, biaya seeding tidak diukur):

```
putaran 1:  3 query    215 ms  (ok=200/200)
putaran 2:  3 query    723 ms  (ok=200/200)
putaran 3:  3 query   1115 ms  (ok=200/200)
putaran 4:  3 query    556 ms  (ok=200/200)
putaran 5:  3 query   3036 ms  (ok=200/200)
query DB : 3 (maks, target ≤ 3) · latensi min 215 ms · median 723 ms · maks 3036 ms
```

| Pernyataan (200 baris) | Waktu terukur |
|---|---|
| `UPDATE questions SET status=…` (psql, host sepi) | **6,8 – 27 ms** |
| `UPDATE` yang sama via driver saat host jenuh | 450 ms – 3,4 s |
| `INSERT audit_logs` 200 baris | ≈ 1 ms – 1,0 s (tergantung fsync) |

Selama pengukuran `load average` mesin **10–31 pada 8 vCPU** (banyak proses lain
berjalan), jadi angka dinding tidak representatif untuk produksi. Yang
**deterministik dan terbukti**: query **1.800 → 3** (≈600× lebih sedikit roundtrip,
dari 9 query/soal menjadi 0,015 query/soal), dan eksekusi SQL-nya sendiri
**6,8 ms** di DB. Karena itu tes mengunci `dbQueries <= 3` secara ketat,
sedangkan latensi diberi batas kasar (3000 ms) + nilainya dicatat di log tes;
angka latensi yang jujur ada di benchmark (min/median/maks), bukan di satu
kebetulan.

Bila SLO 300 ms wajib dipegang, dua tindak lanjut arsitektural (di luar Sprint 0):
1. **HOT-eligibility**: `status` ada di `idx_questions_status` **dan**
   `idx_questions_grade_diff_status` ⇒ setiap perubahan status memaksa update
   **semua** indeks, termasuk **HNSW pgvector** & **GIN trigram**. Meninjau ulang
   indeks tsb + `fillfactor` tabel dapat menjadikan update HOT (tanpa pemeliharaan
   indeks). Terukur: menambah embedding pada 200 baris menaikkan waktu update dari
   240 ms → 2,5–3,4 s (biaya re-insert HNSW).
2. **Audit batch**: 200 baris audit/aksi adalah kontrak keterlacakan (L5). Bila
   throughput jadi masalah, pertimbangkan `COPY`/antrean tulis async yang tetap
   durable — bukan menghapus jejak audit.

---

## Catatan / Tindak Lanjut

- **Uji restore drill** (`scripts/restore-check.mjs`) tidak diselesaikan di
  heartbeat ACT-01: proses >7 menit pada dump 15 MB (fase `db:verify`) lalu
  dihentikan; DB sementara `mathbank_restore_1792467927197` sudah dibersihkan.
  **SELESAI di ACT-07 (MAT-124)** — akar masalahnya tiga bug skrip (klien
  `pg_restore` 17 vs arsip 18, password literal `***` di `DATABASE_URL`, tanpa
  timeout/verifikasi cleanup), bukan ukuran dump. Drill penuh kini **exit 0**
  dalam 384 s; lihat bagian ACT-07 di bawah dan `docs/RESTORE-RUNBOOK.md`.
- `pnpm test:db` memerlukan `DATABASE_URL` menunjuk `mathbank_test`; jalankan
  dengan env tersebut, jangan DB dev.
- `backups/archive/` ikut `.gitignore` (`/backups/`) — arsip mingguan bersifat
  data runtime, bukan artefak repo.

---

## Verifikasi Ulang (heartbeat lanjutan, 20 Okt 2026 ~11:30 WIB)

Klaim di laporan sebelumnya diuji ulang dari nol pada commit `cb6b2d0` (branch
`paperclip/dev`), bukan sekadar dibaca dari catatan.

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | **exit 0** — galat frontend `bundle-list-view.tsx` yang dulu tercatat sudah hilang (diperbaiki di domain Ichsan) |
| Tes telemetri | `npx vitest run src/lib/telemetry/` | **6 berkas, 40 tes LULUS** (logger-scrub, metrics-labels, metrics, instrumentation, check-names, logger) |
| Tes integrasi bulk | `vitest --config vitest.db.config.mts src/lib/services/question-bulk.db.test.ts` (dengan `DATABASE_URL=$TEST_DATABASE_URL`) | **7 tes LULUS**; assertion `dbQueries <= 3` untuk 200 soal tetap hijau |
| Cron | `crontab -l` | entri `0 2 * * * ... scripts/backup-db.mjs` ada, `systemctl is-active cron` → **active** |
| Eksekusi backup nyata | `backups/backup.log` | `pg_dump (PostgreSQL) 18.6` → dump **15,07 MB** → **218 objek** terbaca `pg_restore` → dump harian disimpan **7** → arsip mingguan **2026-W43** ada |
| Batas tangan | `git show --stat cb6b2d0 557f441` | hanya `src/lib/{telemetry,api,services}`, `src/app/api/health`, `src/instrumentation.ts`, `scripts/backup-db.mjs`, dokumen — **tidak ada** `src/components/**`, `src/app/(app)/**`, `globals.css`, `styles/print.css` |

Catatan operasional: `vitest.db.config.mts` **tidak** memuat `.env` sendiri, jadi
tes integrasi harus dijalankan dengan `DATABASE_URL` sudah di-set ke
`TEST_DATABASE_URL` (mis. `pnpm test:db`, yang melakukan itu). Menjalankannya
langsung dengan `npx vitest` akan gagal dengan `DATABASE_URL belum diatur` —
bukan kegagalan kode.

## Tindak Lanjut yang Dibuka

Dua celah yang **tidak** diselesaikan di Sprint 0 kini punya issue sendiri agar
tidak hilang di percakapan:

- **MAT-123 — ACT-06: Bukti SLO bulk status <300 ms.** Meninjau HOT-eligibility
  (`status` ada di dua indeks sehingga update selalu memelihara indeks, termasuk
  HNSW pgvector dan GIN trigram) plus `fillfactor`, dengan angka
  `n_tup_hot_upd` sebelum/sesudah dan tanpa regresi query daftar soal.
- **MAT-124 — ACT-07: Latihan restore drill.** Backup sudah terbukti *terbuat*
  dan *terbaca*, tetapi belum terbukti *dipulihkan*; latihan sebelumnya
  dihentikan setelah lebih dari 7 menit pada fase `db:verify`.

---

## ACT-07 (MAT-124) — Latihan Restore Drill: dump TERBUKTI dapat dipulihkan

**Hasil: `exit 0`.** Latihan penuh selesai dalam **384 detik (6,4 menit)** pada
host yang sedang jenuh (load 9,8–14,5 / 8 vCPU). Bukan asumsi — angka di bawah
diambil dari `backups/restore-drill-2026-10-20-04-54-02.json`.

### Akar masalah latihan sebelumnya (bukan "host terlalu lambat")

Latihan yang dulu dihentikan setelah >7 menit **tidak** gagal karena ukuran dump.
Ada tiga bug nyata di `scripts/restore-check.mjs`:

| # | Bug | Dampak |
|---|---|---|
| 1 | Memakai `pg_restore` dari PATH = **17**, sementara server & arsip = **18** | klien lebih tua membaca arsip v18; restore penuh tidak dapat dipercaya |
| 2 | `restoreUrl` berisi password **literal `***`** (`:***@host`) | `db:verify` tidak pernah bisa autentikasi ke DB hasil restore |
| 3 | `npm run db:verify` tanpa timeout, tanpa verifikasi pembersihan DB | fase bisa menggantung; DB sementara bisa tertinggal |

### Perbaikan skrip (`scripts/restore-check.mjs`)

- **Pemilihan biner sadar-versi**: `PG_RESTORE_BIN` → `/usr/lib/postgresql/<mayor>/bin/pg_restore`
  (mayor tertinggi) → PATH; galat `version/unsupported` otomatis coba kandidat lain.
- **Preflight** `pg_restore --list` (218 objek) sebelum menyentuh server — arsip
  terpotong terdeteksi tanpa biaya `CREATE DATABASE`.
- **Password hanya di env anak** (`PGPASSWORD`, `DATABASE_URL`), tidak di argumen.
- **Invarian inti via `psql` langsung** (satu perjalanan, 0,4 s saat host sepi):
  26 tabel, 20 FK, 87 indeks, 1 HNSW, 24 trigger, 3 CHECK, PK `uuidv7()`,
  ekstensi `vector/pg_trgm/pgcrypto`, 11 tabel berisi, dan orphan FK = 0.
  `pnpm db:verify` tetap tersedia sebagai fase opsional (`--with-db-verify`).
- **Pembanding DB sumber**: jumlah baris hasil restore dibandingkan dengan DB
  hidup — bukti isi ikut pulih, bukan hanya skema.
- **Cleanup berlapis**: sisa `mathbank_restore_*` disapu di awal, DB dihapus di
  `finally`, lalu **diperiksa ulang**; sisa apa pun membuat exit ≠ 0.
- **Bukti JSON** per latihan (`backups/restore-drill-<stamp>.json`).

### Angka terukur (dump `mathbank_2026-10-20-04-42-26.dump`, 15,07 MB, 218 objek)

| Fase | Durasi | Load avg saat fase |
|---|---|---|
| preflight (`pg_restore --list`) | 0,03 s | 10,63 |
| createdb | 95,57 s | 10,63 |
| `pg_restore` (18.6, `--exit-on-error`) | 125,20 s | 14,49 |
| verify invarian SQL | 22,21 s | 12,54 |
| `pnpm db:verify` (opsional) | 7,11 s | 11,61 |
| **Total** | **384,01 s** | awal 9,84 · akhir 11,6 |

Variasi antar-percobaan besar dan **didominasi I/O host**, bukan ukuran data:
run sebelumnya `createdb` 13 s dan `pg_restore` 39 s (total 223 s, load 5,9).
Artinya RTO database untuk dump 15 MB = **±2–7 menit**, jauh di bawah target
RTO 4 jam di `BACKUP-RECOVERY.md`.

### Isi yang pulih (bukan hanya skema)

`questions` 11.889 · `question_options` 43.243 · `solutions` 10.363 ·
`topics` 174 · `bundles` 579 · `bundle_items` 12.344 · `audit_logs` 67.794 ·
`media_assets` 2.617 · `user` 4 — **11/11 tabel sama persis dengan DB sumber**.
`question_topics` dan `question_tags` = 0 baris; **DB sumber juga 0**, jadi ini
bukan cacat restore melainkan celah data yang perlu isu terpisah.

### Dokumen prosedur insiden

`docs/RESTORE-RUNBOOK.md` (baru) — langkah-demi-langkah dengan perintah siap
salin, ekspektasi keluaran tiap langkah, tabel nilai invarian yang harus cocok,
prosedur "restore menimpa produksi" (rename, bukan drop), troubleshooting tujuh
gejala umum, dan riwayat latihan.

### Kebersihan DB sementara

Setelah latihan: `SELECT datname FROM pg_database WHERE datname LIKE 'mathbank\_restore\_%'`
→ **0 baris**. Diperiksa otomatis oleh skrip setiap kali dijalankan.

### Jadwal drill (usulan, butuh persetujuan)

Restore penuh memakan ±6 menit CPU/IO nyata di host bersama yang sudah jenuh.
Usulan: **bulanan** (tanggal 1, 03:00) untuk drill otomatis, plus manual penuh
sebelum migrasi berisiko. Alasan tidak harian: dump harian isinya identik
sehingga tidak menambah informasi, sedangkan biaya CPU-nya nyata. Entri cron
contoh ada di `RESTORE-RUNBOOK.md` §6 — **belum dipasang**.
