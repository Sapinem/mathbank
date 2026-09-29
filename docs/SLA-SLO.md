# SLA-SLO.md — Tingkat Layanan (SLA) & Tujuan (SLO)

> **Status:** 📝 usulan (belum ada komitmen formal; belum ada pengguna produksi).
> **Sifat:** dokumen hidup — ratifikasi saat rilis produksi.
> **Catatan:** angka di sini **usulan awal** berbasis skala MVP, bukan janji kontraktual.

---

## 1. Definisi

| Istilah | Arti |
|---------|------|
| **SLI** (Indicator) | Metrik terukur (mis. % request sukses, latensi p95) |
| **SLO** (Objective) | Target internal untuk SLI (mis. 99,5% sukses) |
| **SLA** (Agreement) | Janji ke pengguna (biasanya lebih longgar dari SLO) |

---

## 2. Skala Konteks

MathBank = aplikasi internal (guru/admin, <100 pengguna). Bukan SaaS publik 24/7 → SLO **moderat**, bukan lima-sembilan (99,999%).

---

## 3. SLI & SLO Usulan

| SLI | SLO usulan | Cara ukur |
|-----|-----------|-----------|
| **Ketersediaan** (uptime) | ≥ 99,0% / bulan (jam kerja), ≥ 99,5% target | health check (`OBSERVABILITAS.md`) |
| **Latensi API** p95 | ≤ 300 ms | log terstruktur |
| **Tingkat error** (5xx) | ≤ 1% request | log |
| **Tingkat error** (4xx) | pantau (bukan SLO) | log |
| **RPO** (data hilang maks) | ≤ 24 jam | `BACKUP-RECOVERY.md` |
| **RTO** (pulih) | ≤ 4 jam | `BACKUP-RECOVERY.md` |

---

## 4. Jendela & Pengecualian

- **Jam kerja** = Sen–Jum, 07:00–17:00 WIB (asumsi). Di luar itu = best-effort.
- **Pengecualian** SLO: pemeliharaan terjadwal (diinformasikan ≥ 24 jam), gangguan pihak ketiga (DB host, jaringan), force majeure.

---

## 5. Konsekuensi Pelanggaran (rencana)

- **Error budget**: bila SLO bulanan terlampaui, **fokus perbaikan stabilitas** dulu (tahan fitur baru).
- **Insiden**: catat di `RUNBOOK.md` (belum ada) + analisis akar masalah.

---

## 6. Yang Belum Ada

- [ ] Pengukuran uptime nyata (belum ada monitoring)
- [ ] Dashboard error budget
- [ ] Ratifikasi angka (pemilik produk)
- [ ] Saluran komunikasi insiden

---

## 7. Rujukan

- Observabilitas: `OBSERVABILITAS.md`
- Backup/DR: `BACKUP-RECOVERY.md`
- Performa: `PERFORMA.md`
- Deploy: `RENCANA-DEPLOY.md`
