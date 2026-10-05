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

### 2.1 Lanskap lengkap mesin PDF (riset 2026-09-30)

Ekosistem terbagi **dua kelas** — penting agar tidak salah pilih:

1. **Konversi HTML→PDF** (butuh *render engine*): Chromium (Playwright/Puppeteer), WebKit (wkhtmltopdf—**mati**), **WeasyPrint** (Python, pagination-first), **Paged.js** (polyfill CSS paged media), engine native baru (**Fulgur**, Pliego/Servo, Go-wkhtmltopdf).
2. **Pembuatan PDF native** (menggambar langsung, **tanpa HTML**): PDFKit, pdfmake, `@react-pdf/renderer` (JSX).

| Kandidat | Kelas | Ukuran/Dep | Kontrol ukuran kertas | KaTeX | Cocok MathBank? |
|---|---|---|---|---|---|
| **Playwright/Puppeteer** (Chromium) | HTML→PDF | ±300 MB (sudah ada) | **Penuh** (`@page size` + API `format`) | **Ya** (render DOM) | ✅ realistis |
| **Browser print** (`@media print`+`window.print`) | HTML (di klien) | **0** | `@page size` (Chromium hormati; Firefox abaikan) | **Ya** (DOM sudah ter-render) | ✅ realistis, ringan |
| **Paged.js** (polyfill di browser) | HTML (klien) | ± kecil (JS) | **Ya** (`@page`) di browser Chromium | Ya | 🟡 menambah lib klien |
| **WeasyPrint** | HTML→PDF | Python + GTK/Pango (bukan Node) | **Penuh** (paged media terlengkap) | ⚠️ **tidak jalankan JS** → KaTeX harus pra-render jadi SVG/MathML | ❌ ganjalan stack |
| **wkhtmltopdf** | HTML→PDF | ±50 MB binary | CLI flags (`-s A4`) | ❌ engine 2014 | ❌ **mati/arsip 2023** |
| **PDFKit** | Native (gambar) | ±3 MB | Penuh (`size:[w,h]`) | ❌ **tak ada HTML/CSS** — rumus harus digambar manual | ❌ |
| **pdfmake** | Native (DSL JSON) | ±1 MB | Penuh | ❌ tak ada HTML; rumus/rumus kompleks sulit | ❌ |
| **@react-pdf/renderer** | Native (JSX) | ±2 MB | Penuh (`<Page size="A4">`) | ❌ custom CSS **terbatas**; KaTeX HTML/SVG **tak** didukung | ❌ |
| **Fulgur/Pliego/gowkhtmltopdf** | Native engine baru | biner | terbatas | ❌ | ❌ belum matang |

**Kesimpulan riset:** untuk **HTML+CSS+KaTeX** (naskah matematika) yang **sudah punya
halaman web**, mesin **berbasis render-engine (Chromium)** atau **print-css browser**
adalah yang **secara teknis benar**. Alat "lebih ringan" (PDFKit/pdfmake/react-pdf)
memang kecil tapi **menggambar PDF dari nol** — mereka **tidak bisa** memakai halaman
HTML+KaTeX kita; menulis ulang seluruh tata letak naskah = **kerja besar & rawan**.
WeasyPrint (ringan, pagination terbaik) **tak jalankan JS** → KaTeX perlu jalur
pra-render khusus.

### 2.2 Opsi & tradeoff (dengan konteks di atas)

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

> **✅ KEPUTUSAN USER (2026-09-30): OPSI A — Browser Print (`@media print`).**
> Alasan: paling ringan, **nol dependency baru**, sesuai insting "Playwright overkill".
> Server-side (B/C) **ditunda** — bukan ditolak; bisa ditambah kelak memakai markup cetak
> yang **sama** (jalur kedua, bukan ganti). Lihat §4 "Status".

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

### Status (2026-09-30) — Opsi A

- [x] **Halaman pratinjau cetak** `bundles/[id]/print` (ganti stub ComingSoon):
  render naskah (soal bernomor, opsi rapi, stimulus 1×, KaTeX), panel opsi cetak.
- [x] **Layout `@media print`** (`src/styles/print.css`: `@page` A4, sembunyikan shell,
  page-break, lembar kunci/lembar jawaban mulai halaman baru).
- [x] **Opsi**: kolom (1/2) · kunci (sembunyi / tandai tebal / lembar terpisah) ·
  lembar jawaban (sertakan/sembunyikan).
- [x] **Izin**: kunci hanya muncul bila `canSeeAnswerKey` (proyeksi API).
- [x] **Perbaikan rute usang** (temuan saat M8): tombol detail paket `/sunting`,`/cetak`
  → 404; diperbaiki ke `/edit`,`/print`. `/references/event` → `/references/events`.
- [ ] **Tes** untuk halaman cetak (unit: pemetaan opsi→struktur; lihat §7).
- [ ] **Pembahasan** (opsi tampil/lembar terpisah) — belum dibangun (data `explanation` ada).
- [ ] **Endpoint ekspor server-side** `GET /api/bundles/[id]/export?format=pdf…` — **DITUNDA**
  (Opsi B/C, belum diputuskan). Markup cetak disiapkan agar kelak **dipakai ulang**.
- [x] Dokumen: `RENCANA-EKSPOR.md` (ini) + update PETA-DOKUMEN, CHANGELOG.

**Non-tujuan (M8):** job queue/background, simpan PDF ke disk, kop/kaki/watermark lembaga
(→ **M8b**, lihat §8).

---

## 5. Risiko & Mitigasi (Opsi A)

| Risiko | Mitigasi |
|---|---|
| Ukuran kertas tak dipatuhi (Firefox abaikan `@page size`) | `@page size: A4` + panduan pengguna; Chromium/Edge/Brave menghormati |
| Shell/aksi ikut tercetak | `@media print` sembunyikan `[data-app-shell]` & `.no-print` |
| KaTeX terpotong antar halaman | `.print-question { break-inside: avoid }` |
| Margin tak seragam antar browser | `@page { margin }` + petunjuk pilih "Margins: Default" |
| Operator salah lihat kunci | kunci hanya dikirim API bila peran berhak (`canSeeAnswerKey`) |

---

## 6. Prinsip yang dipatuhi
- CONSTRAINTS #5 (**install saat perlu**) — Opsi A: **nol dependency baru** (tanpa Playwright runtime, tanpa lib PDF).
- CONSTRAINTS #2 (**Zero Silent Assumptions**) — keputusan mesin PDF **disetujui user** (Opsi A).
- CONSTRAINTS #33 (`rateLimit`) & #34 (proyeksi kolom eksplisit) — berlaku untuk API terkait;
  `listBundleItems` memakai `questionColumns`/`optionColumns` eksplisit.

---

## 8. M8b — Kop/Kaki + Watermark Lembaga (DITUNDA, keputusan user 2026-09-30)

User menunjukkan contoh naskah (Bimbel) dengan **kop lembaga + watermark latar + kaki +
nomor halaman**. Keputusan: **selesaikan M8 dasar dulu**, kop/kaki/watermark jadi **M8b**.

Rencana M8b:
- **Profil Lembaga** di Settings: nama, tagline, **logo diunggah (upload)**, warna aksen.
- **Kop** (halaman pertama) + **kaki** + **watermark** (PNG transparan, `background-image`).
- **Nomor halaman**: di Opsi A terbatas (hanya via dialog print browser); kustom penuh butuh
  jalur server-side (B/C) — akan diputuskan di M8b.
- Opsi cetak tambahan: toggle kop / watermark / nomor halaman.

| Aspek | Opsi A (sekarang) | butuh server-side |
|---|---|---|
| Kop halaman pertama (kustom) | ✅ | — |
| Kaki kustom | ✅ | — |
| Watermark latar | ✅ | — |
| Nomor halaman otomatis kustom | ❌ | ✅ (B/C) |

---

*Lihat juga: `docs/MILESTONE.md` §M8, `docs/RENCANA-UI.md`, `docs/KONTRAK-API.md`, `CONSTRAINTS.md`.*
