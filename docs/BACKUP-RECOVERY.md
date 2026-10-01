# BACKUP-RECOVERY.md — Strategi Backup & Pemulihan

> **Status:** ✅ **TERIMPLEMENTASI (M16, 2026-09-30).**
> Skrip nyata: `scripts/backup-db.mjs` (`pnpm backup:db`) & `scripts/restore-check.mjs`
> (`pnpm restore:check`). Uji-restore terbukti hijau (28 tabel, 26 trigger, HNSW, uuidv7).
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
pnpm restore:check                 # uji arsip TERBARU
pnpm restore:check backups/<file>.dump
```
Skrip (`scripts/restore-check.mjs`): buat DB sementara → `pg_restore` → jalankan
`db:verify` → **bersihkan** DB sementara. Gagal bila invarian tak lengkap.

**Manual (setara):**
1. Buat DB kosong: `mathbank_restore`.
2. `pg_restore -d mathbank_restore <dump>`.
3. `DATABASE_URL=<restore> pnpm db:verify` → **harus hijau** (28 tabel, 2 CHECK, 1 HNSW, 26 trigger, PK `uuidv7()`).
4. Spot-check data (`questions`, `topics`).
5. Catat waktu (uji RTO) & dokumentasikan.

> `db:verify` menjadikan uji restore **objektif** — bukan sekadar "restore jalan tanpa error".
> **Jalankan `restore:check` minimal tiap kali jadwal backup berubah & sebelum migrasi berisiko.**

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

- [ ] Backup otomatis terjadwal
- [ ] Penyimpanan backup **off-site** (beda mesin/region)
- [ ] Enkripsi backup at-rest
- [ ] Uji restore terekam (log + tanggal)
- [ ] Monitoring keberhasilan backup + alert bila gagal

---

## 7. Rujukan

- Verifikasi skema: `scripts/db-verify.ts`, `ADR-0007`
- Deploy: `RENCANA-DEPLOY.md`
- Keamanan: `KEAMANAN.md`
