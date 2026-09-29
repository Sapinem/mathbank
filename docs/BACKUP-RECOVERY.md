# BACKUP-RECOVERY.md — Strategi Backup & Pemulihan

> **Status:** 📝 rencana (belum ada backup otomatis per 2026-09-29).
> **Sifat:** dokumen hidup — perbarui saat mekanisme nyata dibuat.
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

**Database** (pilihan, `pg_dump` paling aman & portabel):
```bash
# Backup logis (custom format, terkompresi)
pg_dump -Fc -p 5433 mathbank > backup/mathbank_$(date +%F_%H%M).dump

# Pulihkan
pg_restore -p 5433 -d mathbank_restore backup/mathbank_2026-09-29_1200.dump
```

**Media:** sinkronisasi direktori (`rsync`/`restic`) ke lokasi terpisah.

**Jadwal usulan:**
- **Harian** penuh (retensi 7–30 hari).
- **Mingguan** arsip lebih lama (retensi 3 bulan).
- **Sebelum migrasi** skema → snapshot manual wajib.

---

## 4. Uji Restore (WAJIB berkala)

**Prosedur:**
1. Buat DB kosong: `mathbank_restore`.
2. `pg_restore` dari backup terbaru.
3. Jalankan `pnpm db:verify` (env `DATABASE_URL` → DB restore) → **harus hijau** (27 tabel, 2 CHECK, 1 HNSW, 25 trigger, PK `uuidv7()`).
4. Spot-check data (hitung baris `questions`, `topics`).
5. Catat waktu (uji RTO) & dokumentasikan.

> `db:verify` menjadikan uji restore **objektif** — bukan sekadar "restore jalan tanpa error".

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
