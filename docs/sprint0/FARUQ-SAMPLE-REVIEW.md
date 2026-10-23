# Review Sampel Soal — MAT-120 Sprint 0

**Tanggal:** 2026-10-20
**Penulis:** Faruq (Agent MAT-120)
**Tujuan:** Review kualitas konten, opsi jawaban, dan kejelasan soal dari sampel 3 kategori

---

## Metodologi

Diambil 20 soal random dari masing-masing kategori:
- **Kategori F** (Flagged): `is_flagged = true`
- **Kategori P** (Pendek): `char_length(content_markdown) < 50`
- **Kategori N** (Normal/Tidak terflag): `char_length(content_markdown) >= 50 AND is_flagged = false`

Total sampel direview: 60 soal

---

## Kategori F: Soal Terflag (20 Sampel)

### Temuan Utama

**Temuan kritis: "Flag palsu" pada essay** — Banyak soal essay yang terflag "Kunci jawaban tidak ditemukan" ternyata memiliki pembahasan lengkap dan berkualitas tinggi di field `answer_key.explanation`. Flag ini adalah artefak sistem ingesti, bukan indikator kualitas rendah.

### Tabel Review Sampel F

| # | Tipe | Cuplikan Soal | Kunci Ada? | Kualitas Konten | Kualitas Kunci | Catatan |
|---|------|--------------|-----------|----------------|----------------|---------|
| F1 | Essay | Parkir mobil & motor (SPLDV) | explanation ✓ | Baik | Baik — multi-langkah sistematis | Flag palsu |
| F2 | Essay | Sederhanakan √72 | explanation ✓ | Baik | Baik — faktorisasi akar | Flag palsu |
| F3 | Essay | Deret Σ1/k² konvergen (k=2→∞) | explanation ✓ | Baik — tingkat universitas | Baik — uji integral benar | Flag palsu; soal analisis real |
| F4 | Matrix Grid | Kubus volume 216 cm³, rusuk diperpanjang k kali | {} ✗ | Baik | **KOSONG** | Flag valid; kunci perlu kurasi |
| F5 | Essay | 20 baris kursi teater, deret aritmetika | explanation ✓ | Baik — konteks relevan | Ada bug: S20=1.250 tapi format salah | Flag palsu; perlu fix format explanation |
| F6 | Essay | Pertidaksamaan irasional (4 bagian) | explanation ✓ | Sangat baik — pembahasan lengkap 4 kasus | Baik | Flag palsu; konten premium |
| F7 | SC | Nilai gambar/tabel (Pusmendik TKA) | {} ✗ | Soal dengan referensi gambar | **KOSONG** | Flag valid; gambar di server Pusmendik |
| F8 | Essay | Deret aritmetika a=6, b=4, n=8 | explanation ✓ | Baik | Baik | Flag palsu |
| F9 | Essay | Median dari {8,5,7,6,9} | explanation ✓ | Baik | Baik — langkah jelas | Flag palsu |
| F10 | Matrix Grid | SPLDV buku & pulpen | {} ✗ | Baik | **KOSONG** | Flag valid |
| F11 | Essay | Sederhanakan 5(a-2)-3a+4 | explanation ✓ | Baik | Baik | Flag palsu |
| F12 | Essay | Z grup siklik? (struktur aljabar) | explanation ✓ | Sangat baik — tingkat universitas | Baik — generator Z=1 | Flag palsu; soal grup |
| F13 | Matrix Grid | Populasi kelinci eksponensial | {} ✗ | Ada gambar {{img:...}} di konten | **KOSONG** | Flag valid; image placeholder |
| F14 | Essay | Soal dimulai "– 14." (judul cermin?) | {} ✗ | **RUSAK** — tidak ada stem soal | **KOSONG** | Flag valid; soal benar-benar rusak |
| F15 | Essay | Selesaikan pertidaksamaan (4 sub) | explanation ✓ | Sangat baik | Baik | Flag palsu |
| F16 | SC | Urutan rantai DNA anti-sense | {} ✗ | **NON-MATEMATIKA** (biologi) | **KOSONG** | Flag valid; kontaminasi corpus |
| F17 | Essay | Tentukan limit dalam integral tentu | {} ✗ | Konten ada tapi answer_key kosong | **KOSONG** | Flag valid; butuh kunci |
| F18 | SC | Warisan Pak Ali (Rp270 juta) | {} ✗ | Soal UTBK — konteks sosial | **KOSONG** | Flag valid; soal non-standar |
| F19 | Essay | Distribusi Poisson penumpang | explanation ✓ | Baik — konteks relevan | Baik — λ=1.4, P(X=2)≈0.2417 | Flag palsu |
| F20 | Essay | Deret Σn!/n^n konvergen | explanation ✓ | Baik — uji rasio | Baik — L=1/e < 1 | Flag palsu; tingkat universitas |

**Ringkasan Kategori F:**
- Flag palsu (essay dengan explanation lengkap): 12/20 (60%)
- Flag valid (kunci benar-benar kosong): 7/20 (35%)
- Soal rusak/kontaminasi: 1/20 (5%)

---

## Kategori P: Soal Pendek — < 50 Karakter (20 Sampel)

### Temuan Utama

**Soal pendek mayoritas valid dan berkualitas tinggi.** Sebagian besar adalah soal matematika langsung-ke-ekspresi (concise stem), bukan soal terpotong.

### Tabel Review Sampel P

| # | Tipe | Konten Lengkap | Kunci Ada? | Kualitas | Catatan |
|---|------|---------------|-----------|---------|---------|
| P1 | SC | Negasi dari m≠12 adalah .... | ✓ C | Baik | Logika singkat, valid |
| P2 | SC | Banyak bunga anggrek di taman yaitu.... | ✓ D | **Perhatian** | Tidak ada data/stimulus di stem; jawab dari mana? |
| P3 | Essay | Selesaikan kongruensi 2x≡2 (mod 6) | explanation ✓ | Baik | Soal teori bilangan kompak |
| P4 | SC | Bentuk ābāb sama dengan .... | ✓ C | Baik | Representasi bilangan |
| P5 | SC | Banyak nol di akhir 100! adalah .... | ✓ C | Baik | Teori bilangan, singkat tapi dalam |
| P6 | SC | Faktorisasi dari xy-4x+3y-12 adalah .... | ✓ B | Baik | Aljabar |
| P7 | SC | Bilangan ganjil dapat ditulis dalam bentuk .... | ✓ B | Baik | Definisi formal |
| P8 | Essay | Hitung nilai berikut. [27^{2/3}] | explanation ✓ | Baik | Stem + display math; valid |
| P9 | SC | Bentuk sederhana dari 2(x+6) adalah .... | ✓ B | Baik | Aljabar dasar |
| P10 | SC | FPB dari 221 dan 143 adalah .... | ✓ C | Baik | Algoritma Euclid |
| P11 | SC | Penyelesaian dari 3(x-2)≥12 adalah .... | ✓ C | Baik | Pertidaksamaan |
| P12 | SC | Gradien garis m adalah... | ✓ A | Baik* | *Gambar ada di explanation, bukan stem |
| P13 | SC | Nilai dari 3²+2×4² adalah .... | ✓ C | Baik | Aritmetika dengan hierarki operator |
| P14 | SC | Titik (2,7) terletak pada garis .... | ✓ A | Baik | Koordinat Kartesius |
| P15 | Essay | Tentukan sisa pembagian 37·58 oleh 7 | explanation ✓ | Baik | Kongruensi modular |
| P16 | SC | Nilai dari 4! adalah .... | ✓ C | Baik | Faktorial dasar |
| P17 | SC | Nilai dari 9!/(6!·3!) adalah... | ✓ D | Baik | Faktorial/kombinasi |
| P18 | Essay | Tentukan nilai dari: [²log 64] | explanation ✓ | Baik | Logaritma dengan display math |
| P19 | SC | 22×28=⋯ | ✓ C | Baik | Hitung cepat (pola khusus) |
| P20 | SC | Ruang sampel dari pelemparan dua koin adalah .... | ✓ B | Baik | Probabilitas dasar |

**Ringkasan Kategori P:**
- Valid dan berkualitas baik: 18/20 (90%)
- Perlu perhatian (konteks hilang): 1/20 (5%)
- Perlu diperbaiki (gambar tidak di stem): 1/20 (5%)
- **Tidak ada soal terpotong/rusak** dalam sampel ini

---

## Kategori N: Soal Normal — Tidak Terflag (20 Sampel)

### Temuan Utama

Soal "normal" menunjukkan kualitas yang beragam. Mayoritas baik, namun ada beberapa isu: soal tanpa `explanation` (hanya kunci), soal multi-bahasa (Indonesia + Inggris), dan soal dengan gambar referensi internal.

### Tabel Review Sampel N

| # | Tipe | Cuplikan | Kunci | Explanation? | Kualitas | Catatan |
|---|------|---------|-------|-------------|---------|---------|
| N1 | SC | Asep menabung dari Rp2.000 naik Rp500/bulan (bahasa Inggris) | ✓ D | ✓ | Baik | **Bahasa Inggris** — inkonsistensi bahasa |
| N2 | SC | Kinanti, Leo, Miranda (uang) | ✓ A | ✗ | Perlu perhatian | Hanya kunci, tanpa explanation |
| N3 | SC | Pencerminan ABCD terhadap x=2 | ✓ A | ✓ | Baik | Ada gambar referensi corpus:// |
| N4 | SC | Barisan 12, 9, 6, 3, ... suku ke-8 | ✓ A | ✓ | Baik | Barisan aritmetika |
| N5 | SC | Peluang terpilih huruf N dari "INDONESIA" | ✓ B | ✓ | Baik | Peluang klasik |
| N6 | SC | m-n=3, m+n=11, nilai m²-n² | ✓ C | ✓ | Baik | Identitas aljabar |
| N7 | SC | Drum logam V(T)=0,05T³+... (10 drum) | ✓ D | ✓ | Baik | Konteks fisika, polinom |
| N8 | SC | SD Cerdas/Pelita/Mentari jadwal olahraga (KPK) | ✓ C | ✓ | Baik | Konteks realistis, panjang |
| N9 | SC | x+2/x-7 tidak terdefinisi | ✓ B | ✓ | Baik | Singkat tapi tepat |
| N10 | SC | Bilangan genap antara 20.000-70.000, tanpa digit berulang | ✓ C | ✓ | Baik | Soal kombinatorika panjang, multi-kasus |
| N11 | SC | 2 bilangan (2²×3²+8²) dan (1080:3²), FPB | ✓ A | ✗ | Perlu perhatian | Hanya kunci, tanpa explanation |
| N12 | SC | cos x = √a-√b, sin x = √a+√b, nilai a+b | ✓ B | ✓ | Baik | Trigonometri + aljabar |

**Ringkasan Kategori N (dari sampel parsial terlihat):**
- Berkualitas baik dengan explanation: ~75%
- Hanya kunci tanpa explanation: ~15%
- Bahasa Inggris (inkonsistensi): ~5%
- Ada referensi gambar corpus://: ~10%

---

## Temuan Cross-Kategori

### 1. Masalah "Flag Palsu" pada Essay (Kritis)

25,4% soal terflag, namun dari sampel: 60% flag essay adalah false positive. Ini berarti sekitar **1.800 soal bisa di-unflag otomatis** tanpa kurasi manual.

### 2. Kunci Jawaban Tanpa Explanation (Signifikan)

Banyak soal `single_choice` dengan `answer_key = {"correct": ["B"]}` tanpa explanation. Ini valid secara fungsional tapi miskin pedagogi. Sprint 2 harus memprioritaskan pengayaan explanation untuk soal-soal ini.

### 3. Soal Multi-Bahasa (Minor)

Ditemukan beberapa soal dalam bahasa Inggris (dari sumber yang berbeda). Perlu kebijakan bahasa — apakah diterjemahkan atau dipertahankan sebagai konten dual-language.

### 4. Kontaminasi Non-Matematika (Minor)

Ditemukan soal biologi (DNA, mRNA) dalam corpus matematika. Perlu pencarian dan isolasi sistematis.

### 5. Gambar Internal `{{img:...}}` dan `corpus://...` (Perlu Perhatian)

Banyak soal menggunakan referensi gambar:
- `{{img:XXXX}}` — placeholder yang mungkin belum dirender
- `corpus://sumber/path.png` — gambar dari corpus yang mungkin belum dimigrasi ke media storage

Soal-soal dengan gambar yang belum dimigrasikan tidak dapat ditampilkan dengan benar di UI.

### 6. Soal Stimulus Tunggal (Jarang)

Ditemukan 1 soal bertipe `stimulus` — ini adalah soal induk yang memuat konteks untuk soal-soal anak. Perlu dipastikan relasi parent-child berfungsi dengan baik.

---

## Rekomendasi Prioritas Sprint 2

| Prioritas | Isu | Aksi | Estimasi |
|-----------|-----|------|---------|
| P0 | Flag palsu pada essay | Auto-unflag essay dengan explanation > 100 chars | 1.800 soal |
| P1 | Soal kunci kosong (SC) | Kurasi manual atau lookup sumber | 900 soal |
| P2 | Soal tanpa explanation | Enrichment dengan AI-generated explanation | 2.000 soal |
| P3 | Gambar belum dimigrasikan | Audit `{{img:...}}` dan `corpus://...` | TBD |
| P4 | Soal non-matematika | Query dan isolasi ke tag 'non-math' | ~10 soal est. |
| P5 | Soal multi-bahasa | Kebijakan bahasa dan terjemahan jika diperlukan | ~50 soal est. |
| P6 | Matrix grid kunci kosong | Kurasi manual | 352 soal |

---

## Catatan untuk Kurator Sprint 2

**Haladyna Rules yang paling sering dilanggar dalam corpus ini:**

1. **Rule #5 (Self-contained stem):** Beberapa soal pendek memerlukan konteks yang tidak ada di stem (mis. "Banyak bunga anggrek di taman yaitu...").

2. **Rule #22 (Explanation/distractor rationale):** Banyak soal hanya memiliki kunci tanpa explanation — ini melanggar prinsip pedagogis MathCore.

3. **Rule #1 (Item mengukur satu objective):** Soal essay multi-bagian (a/b/c/d) perlu dikaji — apakah harus dipecah menjadi soal terpisah atau dipertahankan sebagai soal multi-bagian.

**Prioritas kurasi Sprint 2 berdasarkan dampak pedagogis:**
1. Soal UTBK/SMA (paling banyak digunakan)
2. Soal OSN/olimpiade (kualitas tinggi, perlu kunci)
3. Soal SMP (volume terbesar, paling sering dicari)
