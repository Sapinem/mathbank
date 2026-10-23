# 🎯 Ringkasan Eksekutif Cross-Audit — MathBank V2
## Konsolidasi Status Kesehatan, Blocker Utama, & Rencana Menuju V2-Ready

**Untuk:** Dewan Direksi & Tim Inti Math My Id  
**Dari:** Zaid (Chief of Staff / CEO Math My Id)  
**Tanggal:** 19 Oktober 2026  
**Basis Konsolidasi:** 9 Berkas Audit Teknis di `/home/hari/projects/mathbank/docs/audit/`  
**Produksi:** `https://b.iyo.my.id` · PostgreSQL 18 (Port 5433)

---

## 1. Status Akhir: **BELUM SIAP V2 — Skor Kesehatan Terkonsolidasi: 6,0 / 10**

MathBank memiliki fondasi kodebase yang **sangat kuat secara arsitektural dan mekanis** (TypeScript 0 error, unit tests 980 lulus, skema 26 tabel konsisten tanpa drift, keamanan Better Auth matang). 

Namun, aplikasi saat ini **terjebak pada data yang belum siap pakai (dormant data layer)**:
- Korpus masif **11.889 soal** telah tersimpan, tetapi **100% masih berstatus `draft`**.
- Fitur pembeda utama (pencarian semantik dan navigasi kurikulum) lumpuh karena **vektor embedding 0%**, **relasi topik 0%**, dan **tautan aset media 0%**.
- Ada regresi performa kritis pada antarmuka paket soal (`useAllBundles` HTTP waterfall) dan kueri massal yang dapat menjatuhkan server pada beban riil.

Secara analogis: *Rangka mobil balap, transmisi 6-percepatan, dan sistem kemudi telah teruji sempurna di bengkel, tetapi tangki bahan bakar masih kosong dan kabel speedometer belum dicolokkan ke dasbor.*

---

## 2. Skor Kesehatan Terkonsolidasi per Pilar (Weighted)

Pembobotan diberikan berdasarkan dampak langsung terhadap kesiapan operasional pengguna di V2:

| # | Pilar Evaluasi | Skor (1–10) | Bobot | Nilai Tertimbang | Status & Catatan Kunci |
|---|----------------|:-----------:|:-----:|:----------------:|------------------------|
| **1** | **Kualitas & Integritas Data** | **3,2** | 30% | 0,96 | 🔴 **KRITIS** — 11.889 draft, 0% embedding, 0% topik, 0% relasi media. |
| **2** | **Kesehatan Kodebase** | **7,8** | 15% | 1,17 | 🟢 **BAIK** — Gate CI hijau (980 test pass, 0 eslint error); 33 file >300 baris. |
| **3** | **Kesiapan Arsitektur V2** | **7,2** | 15% | 1,08 | 🟢 **BAIK** — 6-layer kokoh, 26 tabel tanpa drift; service BGE-M3 hidup di :3005. |
| **4** | **Postur Keamanan** | **7,8** | 15% | 1,17 | 🟢 **BAIK** — RBAC 4 peran aktif; minor: redaksi logger (O-01) & leak health (O-10). |
| **5** | **Performa & Observabilitas** | **5,5** | 10% | 0,55 | 🟡 **CUKUP** — PERF-01 waterfall di `/bundles`, N×9 query massal, kardinalitas metrik. |
| **6** | **Dokumentasi & Tata Kelola** | **4,8** | 5% | 0,24 | 🟡 **CUKUP** — Drift klaim `AGENTS.md` (28 tabel/0 soal) & ~120 dokumen tak terdaftar. |
| **7** | **Kesiapan Operasional** | **6,8** | 10% | 0,68 | 🟡 **CUKUP** — Dump DB baru ada (19 Okt, 15,8 MB); cron harian perlu diaktifkan. |
| **TOTAL** | **SKOR TERBOBOT** | — | **100%** | **6,0 / 10** | **Kondisi: Belum Layak Rilis V2 (Perlu 3–4 Minggu Remediasi)** |

---

## 3. Top 5 Blocker P0 (Wajib Selesai Sebelum V2)

Berikut adalah 5 masalah paling kritis yang wajib diselesaikan agar MathBank V2 dapat beroperasi:

1. **Aktivasi Vektor Embedding 11.889 Soal (0% Coverage → 100%)**
   - *Masalah:* Fitur pencarian semantik (AI search) tidak berfungsi sama sekali karena kolom `embedding` kosong. Layanan BGE-M3 sebenarnya telah hidup di `http://localhost:3005`, namun proses pengisian data belum pernah dijalankan.
   - *Target:* Seluruh 11.889 soal terisi vektor 1024d secara idempoten; indeks HNSW aktif.

2. **Pemetaan Taksonomi & Topik (0% → ≥95% Coverage)**
   - *Masalah:* 174 topik hierarkis dalam sistem kosong melompong (`question_topics = 0`). Pengguna tidak bisa mencari atau memfilter soal berdasarkan topik pelajaran.
   - *Target:* Pipeline auto-tagging berbasis embedding + kata kunci memetakan soal ke topik kurikulum.

3. **Penyambungan Tautan Media (`question_media` = 0)**
   - *Masalah:* Terdapat 2.617 aset gambar di storage dan 1.520 soal merujuk gambar `{{img:<shortId>}}`, namun relasi database terputus total. Fitur ekspor, cetak, dan audit media buta.
   - *Target:* Regex parser memulihkan seluruh relasi `question_media` dengan role stimulus.

4. **Kebijakan & Promosi Massal Status Soal (100% Draft → ≥8.000 Ready)**
   - *Masalah:* Tidak ada satupun soal yang berstatus `ready`. Jika dirilis, aplikasi kosong dari sudut pandang pengguna publik.
   - *Target:* Terapkan aturan seleksi otomatis (`answer_key` valid + `!is_flagged` + konten normal) untuk mempromosikan soal terverifikasi ke `ready`.

5. **Eliminasi Bottleneck Performa Kritis (PERF-01 Waterfall & PERF-02 N×9 Query)**
   - *Masalah:* Halaman `/bundles` mengambil seluruh paket secara sekuensial (hingga 50 HTTP roundtrip) hanya untuk menampilkan 20 baris. Aksi massal 200 soal memicu ~1.800 query serial.
   - *Target:* Pindahkan filter ke query backend; gunakan paginasi server-side; optimalkan bulk update status menjadi kueri set tunggal.

---

## 4. Estimasi Waktu Menuju V2-Ready

Berdasarkan pembagian kerja spesialis dan penghapusan duplikasi tugas antar-audit, jadwal menuju kesiapan V2 dipadatkan dari perkiraan awal 6 minggu menjadi **4 minggu kerja terstruktur**:

```
[Minggu 1: Fondasi & QuickWins]
  ├─ Otomasi Backup Cron (QW-1)
  ├─ Normalisasi Label Metrik & Redaksi Logger (QW-3, QW-4, P0-8)
  ├─ Perbaikan PERF-01 Waterfall & PERF-02 Bulk Action (P0-6, P0-7)
  └─ Sinkronisasi Dokumentasi AGENTS.md (QW-2)
  Gate Minggu 1: Stabilitas API terjamin & zero security leak.

[Minggu 2: Data Enrichment & Linking]
  ├─ Backfill Embedding BGE-M3 11.889 Soal via Port 3005 (P0-1)
  ├─ Penyambungan Relasi question_media dari {{img:}} (P0-3)
  └─ Backfill question_topics & Master Tags Kurikulum (P0-2, P1-3)
  Gate Minggu 2: Dashboard data mencatat ≥95% terisi embedding, topik, dan media.

[Minggu 3: Kurasi Kualitas Soal & UI Refactor]
  ├─ Eksekusi Promosi Massal draft → ready (P0-4)
  ├─ Triase 3.034 Flagged & 699 Soal Pendek (P1-1, P1-2)
  ├─ Inferensi Difficulty 1–5 & Grade (P0-5)
  └─ Pemecahan question-editor.tsx & File >300 Baris (P1-12)
  Gate Minggu 3: Minimal 8.000 soal ready; 0 file >300 baris melanggar aturan.

[Minggu 4: Validasi Zod, Caching, & Uji Integrasi V2]
  ├─ Lengkapi Zod Schema pada 34 Route Tersisa (P1-8)
  ├─ Implementasi ETag / 304 & Stream Media (P1-10, P1-11)
  └─ End-to-End Simulation & CEO Sign-Off
  Gate Minggu 4: MathBank V2 Resmi Siap Rilis Produksi.
```

**Total Waktu: 4 Minggu (1 Bulan Kalender)**

---

## 5. Keputusan Strategis yang Memerlukan Persetujuan CEO / Board

Untuk memulai eksekusi Sprint V2, dibutuhkan 3 keputusan kepemimpinan berikut:

1. **Persetujuan Kriteria Promosi Otomatis `draft → ready`**:
   - *Usulan:* Soal otomatis dipromosikan ke `ready` jika: (a) memiliki kunci jawaban non-kosong, (b) tidak berstatus `is_flagged`, (c) panjang karakter ≥ 50, dan (d) KaTeX lolos linter. Soal yang tidak memenuhi kriteria tetap berada di `draft` untuk antrean telaah manual.
   - *Status:* **Menunggu Persetujuan**.

2. **Prioritas Alokasi Komputasi untuk Batch Embedding BGE-M3**:
   - *Usulan:* Proses backfill 11.889 soal dijalankan pada jam kerja rendah (malam hari) di VPS lokal memanfaatkan service port 3005 dengan konkurensi 16 teks/batch agar tidak mengganggu operasional server web.
   - *Status:* **Menunggu Persetujuan**.

3. **Kebijakan Pembatasan File >300 Baris (CONSTRAINTS #16)**:
   - *Usulan:* Menjadwalkan refaktor pemecahan `question-editor.tsx` (1.023 baris) dan `enrich.ts` (900 baris) pada Minggu ke-3 sebagai prasyarat penggabungan fitur baru V2.
   - *Status:* **Menunggu Persetujuan**.

---

## § Catatan Verifikasi

- **Verifikator:** CodeBuddy (agen), 2026-10-23.
- **Metode:** hitung ulang tabel skor §2; silang angka dengan `docs/audit/CROSS-AUDIT-MASTER-FINDINGS.md`; hitung `ACT-01..ACT-22` di `docs/audit/CROSS-AUDIT-ACTION-PLAN-V2.md`; bandingkan metrik data dengan `docs/SNAPSHOT-METRIK-2026-10-21.md`.
- **Terverifikasi benar:** bobot 30/15/15/15/10/5/10 = 100%; 42 temuan unik (8 P0 + 20 P1 + 8 QuickWin + 6 outdated) sama dengan master findings; 22 ACT ada di action plan; 5 blocker P0 cocok dengan daftar master.
- **Koreksi:** (a) jumlah kolom "Nilai Tertimbang" = **5,85**, bukan 6,0 — selisih 0,15 berasal dari pembulatan skor per pilar, jadi 6,0 adalah perkiraan, bukan hasil penjumlahan tabel. (b) Kondisi data §1 sudah usang: embedding 0% → **99,8%** (11.867/11.889), topik 0% → **71,2%** (8.468 soal), media 0% → **12,7%** (1.506 soal); soal `ready` tetap **0** (100% `draft`). (c) `980 unit test` → **1.104** per 2026-10-23.
- **Status:** ⚠️ angka 19 Okt dipertahankan sebagai rekaman historis; acuan metrik terkini = `docs/SNAPSHOT-METRIK-2026-10-21.md`.

