# RENCANA EKSPOR & CETAK (M8) — Paket Soal

> **Status:** 📋 rencana (belum dieksekusi) · **Milestone:** M8 (penutup MVP) · **Tanggal:** 2026-09-30
> **Sifat:** dokumen keputusan arsitektural — butuh persetujuan user (CONSTRAINTS #2).

---

## 1. Tujuan

Menutup alur MVP: **cari → susun paket → ekspor cetak/PDF**, dengan kualitas tercetak
yang terkendali (KaTeX benar, stimulus 1×, penomoran rapi).

---

## 2. Analisis Mesin PDF — Kenapa konteks MathBank MENGUBAH tradeoff

Saran umum "hindari Chromium server-side" berlaku untuk **Lambda/Docker/ VPS kecil**
(cold-start 5–15 dtk, RAM terbatas, biaya per-render). **Konteks MathBank berbeda:**

| Faktor | Umum (Lambda/Docker) | **MathBank (terukur)** |
|---|---|---|
| Proses | Serverless / container dingin | **systemd `Restart=always`, proses hidup** (tanpa cold start) |
| RAM | 512 MB–2 GB | **7,7 GB (4,3 GB bebas)** |
| CPU | 1–2 vCPU | **8 core** |
| Chromium | harus unduh tiap deploy | **SUDAH terunduh** (`~/.cache/ms-playwright/chromium-1243`) |
| Playwright | tambah dependency | **SUDAH ada** (`@playwright/test@1.63`, devDep) |
| Volume | ribuan/menit | **rendah** (alat ajar pribadi) |
| Biaya server | per-detik | **tetap** (host sudah jalan) |

**Uji nyata:** `page.pdf()` di host ini **BERHASIL** (7,5 KB, hangat ~200–500 ms).
→ **Argumen utama menolak Chromium server-side (resource/biaya/cold-start) TIDAK BERLAKU di sini.**

### Opsi & tradeoff (dengan konteks di atas)

| Aspek | **A. Browser print (`@media print`)** | **B. Server-side (Playwright→PDF)** | **C. Hybrid (B + tombol print)** |
|---|---|---|---|
| Dependency baru | **0** | `playwright` runtime (Chromium sudah ada) | 0 ekstra (B sudah) |
| Kualitas PDF | Tergantung dialog print browser user | **Terkendali** (margin/format/kolom dari server) | **Terkendali** |
| Unduh langsung | Tidak (user "Save as PDF") | **Ya** (`GET .../export.pdf`) | Ya |
| KaTeX | **Sudah ter-render** di DOM | Perlu tunggu render sebelum `page.pdf()` | Sama |
| Kompleksitas | **Paling rendah** | Sedang (lifecycle browser, timeout, concurrency 1) | Sedang |
| Beban server | 0 | ~200–500 MB saat render, **serialisasi 1 job** (semaphore) | Sama |
| Risiko | Kualitas tak seragam antar user | Perlu kelola lifecycle Chromium (browser pool sederhana) | Sama |
| Cocok untuk | Cepat, "cukup" | **Kualitas cetak standar sekolah/ujian** | Guru mau pilih |

**Rekomendasi: C (Hybrid)** — server-side PDF sebagai **default berkualitas**, dgn tombol
"Cetak (dialog browser)" sebagai jalur alternatif cepat. Di konteks ini biaya Chromium
**kecil**, dan kualitas cetak adalah **inti nilai** bank soal (naskah ujian harus rapi).
**Alternatif paling ringan = A** (bila prioritas "MVP cepat" & menerima kualitas tergantung browser).

---

## 3. Keputusan Opsi Cetak (dari user)

Urutan penomoran di berkas cetak: **soal → (opsional) kunci/pembahasan → (opsional) lembar jawaban di akhir**.
Pilihan **ditampilkan dengan penanda** (mis. tebal). Semua **bisa dipilih user** saat ekspor.

| Opsi | Default | Pilihan |
|---|---|---|
| **Kolom** | 1 kolom | **1 / 2 kolom** |
| **Kunci jawaban** | **Sembunyi** | Sembunyi · Tampilkan (per soal) · **Lembar KJ terpisah di akhir** |
| **Pembahasan** | **Sembunyi** | Sembunyi · Tampilkan · **Lembar pembahasan terpisah di akhir** |
| **Lembar jawaban** | Tampil (kosong) | Tampil di akhir · Sembunyikan |
| **Stimulus** | selalu 1× | (invarian) |

**Penanda pilihan aktif:** radio/checkbox dgn label tebal + tanda centang (mis.
**Bold** = dipilih); opsi terpilih ditulis eksplisit di ringkasan sebelum ekspor.

---

## 4. Ruang Lingkup Teknis M8

- [ ] **Halaman pratinjau cetak** `bundles/[id]/print` (ganti stub ComingSoon):
  render naskah (soal bernomor, opsi rapi, stimulus 1×, KaTeX), panel opsi cetak.
- [ ] **Layout `@media print`** (`print:` Tailwind, sembunyikan shell/aksi, A4, margin).
- [ ] **Endpoint ekspor** `GET /api/bundles/[id]/export?format=pdf&cols=&key=&explain=&sheet=`
  → Playwright render halaman print (mode "bersih") → `application/pdf` (stream).
- [ ] **Opsi**: kolom (1/2) · kunci (sembunyi/tampil/lembar-terpisah) · pembahasan ·
  lembar jawaban · header paket (judul/petunjuk/identitas) · nomor halaman.
- [ ] **Job serialisasi**: 1 render sekaligus (semaphore), browser reuse, `finally` close.
- [ ] **Izin**: `bundle:view`/`question:view` (kunci muncul hanya bila `canSeeAnswerKey`).
- [ ] **Tes**: unit (opsi→struktur), DB (route ekspor), smoke (PDF non-kosong, `%PDF`).
- [ ] Dokumen: `RENCANA-EKSPOR.md` (ini) + update KONTRAK-API, PETA-DOKUMEN, CHANGELOG.

**Non-tujuan:** job queue/background (volume rendah — render sinkron cukup), simpan PDF ke disk.

---

## 5. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Chromium lolos/memory leak | browser **singleton** di-reuse; `page.close()`+`context.close()` di `finally`; semaphore=1 |
| Render tak lengkap (KaTeX belum jadi) | tunggu `document.fonts.ready` + selector penanda "siap-cetak" sebelum `page.pdf()` |
| Endpoint berat disalahgunakan | `rateLimit` ketat (CONSTRAINTS #33) + izin + timeout 30–60 dtk |
| Chromium butuh lib sistem | sudah terbukti jalan di host ini (uji 2026-09-30) |
| CSP menghalangi render internal | halaman print di-load dari origin sendiri (redirect + cookie), bukan `setContent` mentah |

---

## 6. Prinsip yang dipatuhi
- CONSTRAINTS #5 (**install saat perlu**) — Chromium **sudah ada**; hanya menambah **import** `playwright` runtime (Playwright sudah terpasang). Tidak ada dependency baru yang menganggur.
- CONSTRAINTS #2 (**Zero Silent Assumptions**) — keputusan mesin PDF **disetujui user** dulu.
- CONSTRAINTS #33 (`rateLimit`) & #34 (proyeksi kolom eksplisit).

*Lihat juga: `docs/MILESTONE.md` §M8, `docs/RENCANA-UI.md`, `docs/KONTRAK-API.md`, `CONSTRAINTS.md`.*
