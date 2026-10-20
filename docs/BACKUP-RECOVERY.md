# BACKUP-RECOVERY.md — Strategi Backup & Pemulihan

> **Status:** ✅ **TERIMPLEMENTASI & TERUJI-RESTORE (M16 + ACT-01/ACT-07).**
> Skrip nyata: `scripts/backup-db.mjs` (`pnpm backup:db`) & `scripts/restore-check.mjs`
> (`pnpm restore:check`). Drill terakhir **exit 0** (20 Okt 2026): dump 15,07 MB,
> 218 objek, **26 tabel, 20 FK, 87 indeks, 1 HNSW, 24 trigger, 3 CHECK, PK
> `uuidv7()`**, 11.889 soal — prosedur manual: `docs/RESTORE-RUNBOOK.md`.
> **Sifat:** dokumen hidup — perbarui saat mekanisme berubah.
> **Prinsip:** **backup yang belum diuji-restore = bukan backup.**

---

## 1. Apa yang Harus Di-backup

| Aset | Lokasi | Prioritas | Catatan |
|------|--------|:---------:|---------|
| **Database** | PostgreSQL `mathbank` | 🔴 tinggi | Sumber kebenaran data |
| **Media/aset** | `MEDIA_STORAGE_PATH` (`./storage/media`) | 🟠 sedang | Gambar/media soal |
| **Rahasia/ENV** | secret manager | 🔴 tinggi | Terpisah, terenkripsi |
| **Kode** | git remote | 🔴 tinggi | Sudah ter-versi |

> **Tidak** perlu di-backup: `node_modules`, `.next`, `drizzle` (ada di git).

---

## 2. Tujuan (RPO / RTO)

| Metrik | Target usulan | Arti |
|--------|--------------|------|
| **RPO** (kehilangan data maks) | ≤ 24 jam (harian) → ≤ 1 jam (saat produksi aktif) | seberapa lama data boleh hilang |
| **RTO** (waktu pulih) | ≤ 4 jam | seberapa cepat layanan kembali |

*(Angka final menunggu keputusan pemilik produk.)*

---

## 3. Metode

**Database** — pakai skrip proyek (menghormati `DATABASE_URL`, retensi, tanpa log rahasia):
```bash
pnpm backup:db                 # → ./backups/mathbank_<stamp>.dump (retensi 7)
BACKUP_DIR=/var/backups/mathbank BACKUP_KEEP=14 pnpm backup:db
```
Setara manual (custom format, terkompresi):
```bash
pg_dump -Fc --no-owner -f backup/mathbank_$(date +%F_%H%M).dump "$DATABASE_URL"
```

**Media:** sinkronisasi direktori (`rsync`/`restic`) ke lokasi terpisah.

**Jadwal (usulan):**
- **Harian** penuh, retensi 7–30 hari (`BACKUP_KEEP`).
- **Mingguan** arsip lebih lama (retensi 3 bulan).
- **Sebelum migrasi** skema → snapshot manual wajib (`MIGRASI-ZERO-DOWNTIME.md` §4).

---

## 4. Uji Restore (WAJIB berkala)

**Otomatis — satu perintah:**
```bash
pnpm restore:check                              # uji arsip TERBARU
pnpm restore:check backups/<file>.dump           # arsip tertentu
node scripts/restore-check.mjs --with-db-verify  # + cek drift skema (pnpm db:verify)
```
Skrip (`scripts/restore-check.mjs`): sapu sisa DB lama → `pg_restore --list`
(preflight) → `CREATE DATABASE mathbank_restore_<epoch>` → `pg_restore
--no-owner --no-acl --exit-on-error` → verifikasi invarian inti via `psql` →
**selalu** `DROP DATABASE … WITH (FORCE)` → tulis bukti
`backups/restore-drill-<stamp>.json` (durasi per fase + load average).
Exit `0` = dump terbukti dapat dipulihkan.

Prosedur manual langkah-demi-langkah (untuk insiden, lengkap dengan ekspektasi
keluaran dan troubleshooting): **`docs/RESTORE-RUNBOOK.md`**.

**Manual (ringkas, setara):**
1. `psql -d postgres -c 'CREATE DATABASE mathbank_restore'`.
2. `/usr/lib/postgresql/18/bin/pg_restore -d mathbank_restore --no-owner --no-acl --exit-on-error <dump>`
   (pakai klien **mayor 18**; `/usr/bin/pg_restore` = 17).
3. Verifikasi: `26` tabel, `20` FK, `87` indeks, `1` HNSW, `24` trigger,
   `3` CHECK, PK `uuidv7()`, orphan FK `0`, `questions ≥ 11.000`.
   Cek drift penuh: `DATABASE_URL=<restore> pnpm db:verify`.
4. Spot-check data (`questions`, `bundles`).
5. `DROP DATABASE mathbank_restore WITH (FORCE)` lalu pastikan tak ada
   `mathbank_restore_*` tersisa.

> `db:verify` + invarian SQL menjadikan uji restore **objektif** — bukan sekadar
> "restore jalan tanpa error". Latihan terakhir: **exit 0**, 384 s (6,4 menit),
> load 9,8–14,5, 11/11 tabel sama dengan DB sumber (20 Okt 2026).
> **Jalankan `restore:check` minimal tiap kali skema/migrasi berubah, sebelum
> migrasi berisiko, dan minimal sebulan sekali.**

---

## 5. Skenario Pemulihan

| Skenario | Tindakan |
|----------|----------|
| Salah migrasi | Pulihkan dari snapshot pra-migrasi; perbaiki migrasi; ulangi |
| DB korup/hilang | Restore backup terbaru (≤ RPO); jalankan `db:verify` |
| Media hilang | Restore dari sinkronisasi media |
| Rahasia bocor | Rotasi (`KEAMANAN.md` §Respons Insiden) |

---

## 6. Yang Belum Ada (utang)

- [x] Backup otomatis terjadwal (cron `0 2 * * *`, ACT-01)
- [ ] Penyimpanan backup **off-site** (beda mesin/region) — **risiko tertinggi yang tersisa**
- [ ] Enkripsi backup at-rest
- [x] Uji restore terekam (log + tanggal) — `backups/restore-drill-*.json`, `docs/RESTORE-RUNBOOK.md` §8
- [ ] Drill restore terjadwal otomatis (usulan bulanan, cron contoh di `RESTORE-RUNBOOK.md` §6 — menunggu persetujuan)
- [ ] Monitoring keberhasilan backup + alert bila gagal

---

## 7. Rujukan

- Verifikasi skema: `scripts/db-verify.ts`, `ADR-0007`
- Deploy: `RENCANA-DEPLOY.md`
- Keamanan: `KEAMANAN.md`
