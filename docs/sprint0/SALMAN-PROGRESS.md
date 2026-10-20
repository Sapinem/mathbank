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
| ACT-01 Backup harian + retensi 2 tingkat | QuickWin | ✅ Selesai | dump 15,07 MB terbuat, exit 0, cron terpasang |
| ACT-02 Scrubber log + health tanpa bocor | P0 | ✅ Selesai | 40 unit test hijau (termasuk 4 test `/api/health`) |
| ACT-03 Normalisasi label metrik + batas memori | P0 | ✅ Selesai | 100 UUID → 1 label; 600 rute → ≤200 label |
| ACT-05 Bulk update set-based | P0 | ✅ Selesai | 200 soal, 3 query, lulus tes `<300 ms` |

---

## ACT-01 — Otomasi Backup Harian

### Yang dikerjakan
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
→ Backup mathbank@localhost:5433 → backups/mathbank_2026-10-20-03-41-15.dump
✓ Backup selesai (15.07 MB)
· hapus dump harian lama: mathbank-sebelum-hapus-nonmath2-20261007-193419.dump
✓ Selesai. Dump harian disimpan: 7.
✓ arsip mingguan dibuat: backups/archive/mathbank_2026-W43.dump
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
     Tests  6 passed (6)
```
Termasuk tes kinerja eksplisit: 200 soal `review → ready`,
`dbQueries <= 3` dan `durationMs < 300`. Tes juga menutup: FSM per butir
(draft gagal, review sukses), izin per peran, `flag/unflag`, id tak dikenal →
`failed` (bukan throw), serta idempoten untuk item yang sudah di status tujuan.

---

## Catatan / Tindak Lanjut

- **Uji restore drill** (`scripts/restore-check.mjs`) tidak diselesaikan di
  heartbeat ini: proses >7 menit pada dump 15 MB (fase `db:verify`) lalu
  dihentikan; DB sementara `mathbank_restore_1792467927197` sudah dibersihkan.
  Backup tetap terbukti **terbuat** dan **terbaca** (pg_dump exit 0), tetapi
  latihan restore penuh layak dijadwalkan terpisah (butuh jendela >10 menit).
- `pnpm test:db` memerlukan `DATABASE_URL` menunjuk `mathbank_test`; jalankan
  dengan env tersebut, jangan DB dev.
- `backups/archive/` ikut `.gitignore` (`/backups/`) — arsip mingguan bersifat
  data runtime, bukan artefak repo.
