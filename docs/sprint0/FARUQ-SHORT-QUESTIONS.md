# Analisis Soal Pendek — MAT-120 Sprint 0

**Tanggal:** 2026-10-20
**Penulis:** Faruq (Agent MAT-120)
**Tujuan:** Mengidentifikasi soal dengan konten sangat pendek (< 50 karakter) untuk menentukan validitas vs. kerusakan

---

## Ringkasan Eksekutif

Total soal dengan `char_length(content_markdown) < 50`: **699 dari 11.867** (5,89%)

Temuan utama: **Mayoritas soal pendek ini VALID**, bukan rusak atau terpotong. Ini adalah soal matematika yang memang singkat secara natural.

---

## Hasil Query

```sql
SELECT count(*) FROM questions
WHERE char_length(content_markdown) < 50 AND deleted_at IS NULL;
-- Hasil: 699
```

### Distribusi Berdasarkan Panjang

```sql
SELECT
  CASE
    WHEN char_length(content_markdown) < 10 THEN '< 10 chars'
    WHEN char_length(content_markdown) < 20 THEN '10-19 chars'
    WHEN char_length(content_markdown) < 30 THEN '20-29 chars'
    WHEN char_length(content_markdown) < 40 THEN '30-39 chars'
    ELSE '40-49 chars'
  END as rentang, count(*) as jumlah
FROM questions
WHERE char_length(content_markdown) < 50 AND deleted_at IS NULL
GROUP BY 1 ORDER BY 1;
```

| Rentang | Jumlah |
|---------|-------:|
| < 10 chars | 4 |
| 10–19 chars | 5 |
| 20–29 chars | 60 |
| 30–39 chars | 183 |
| 40–49 chars | 447 |
| **Total** | **699** |

---

## Analisis Validitas

### Kelompok 1: Soal KaTeX Singkat (sangat banyak — ~85% dari 699)

Soal-soal seperti:
- `\(75 \times 75 =\cdots\)` (24 chars) — **VALID**: soal hitung cepat aritmetika
- `\(22 \times 28 =\cdots\)` (24 chars) — **VALID**: soal perkalian bilangan spesial
- `\(102 \times 108 =\cdots\)` (26 chars) — **VALID**: soal perkalian mendekati 100

Ini adalah seri soal hitung cepat. Pendek karena memang satu ekspresi matematika saja. Konten lengkap ada di opsi jawaban (`question_options` table) dan kunci.

### Kelompok 2: Soal dengan Stem + Display Math (valid, perlu konteks)

Soal seperti:
```
"Hitung nilai berikut.
\[27^{\frac23}\]"
```
(38 chars) — **VALID**: stem + ekspresi display math. Pendek bukan karena terpotong, melainkan karena soal langsung-ke-poin.

Contoh lain:
```
"Tentukan nilai dari:
\[{}^2\log 64\]"
```
(36 chars) — **VALID**: soal logaritma singkat.

### Kelompok 3: Soal dengan Referensi Gambar/Konteks Hilang (perlu perhatian)

Soal seperti:
- `"Banyak bunga anggrek di taman yaitu...."` (39 chars, `answer_key = {"correct": ["D"]}`) — **MERAGUKAN**: soal ini mengacu konteks yang seharusnya ada di stimulus/gambar. Stem sendirian tidak memiliki data yang cukup untuk dijawab.
- `"Gradien garis m adalah$\dots.$"` (34 chars) — **MERAGUKAN**: ada referensi gambar (`{{img:amVe2hNd}}`) di `answer_key.explanation`, tapi gambar ini ada di opsi, bukan di stem. Soal masih bisa dijawab jika opsi tersedia.

### Kelompok 4: Benar-Benar Sangat Pendek (<10 chars)

4 soal di bawah 10 karakter — ini paling berisiko. Kemungkinan terpotong atau hanya berisi placeholder. Perlu cek manual satu per satu.

---

## Temuan dari Sampel 20 Soal Pendek

Dari inspeksi 20 sampel random:

| # | Preview | Tipe | Validitas | Catatan |
|---|---------|------|-----------|---------|
| 1 | Negasi dari \(m\neq12\) adalah .... | SC | Valid | Logika matematika singkat |
| 2 | Banyak bunga anggrek di taman yaitu.... | SC | Meragukan | Tidak ada konteks/data |
| 3 | Selesaikan kongruensi \(2x\equiv2\pmod{6}\) | Essay | Valid | Soal teori bilangan |
| 4 | Bentuk \(\overline{abab}\) sama dengan .... | SC | Valid | Soal representasi bilangan |
| 5 | Banyak nol di akhir \(100!\) adalah .... | SC | Valid | Soal teori bilangan |
| 6 | Faktorisasi dari \(xy-4x+3y-12\) adalah .... | SC | Valid | Aljabar |
| 7 | Bilangan ganjil dapat ditulis dalam bentuk .... | SC | Valid | Soal definisi |
| 8 | Hitung nilai berikut. \[27^{\frac23}\]  | Essay | Valid | Display math |
| 9 | Bentuk sederhana dari \(2(x + 6)\) adalah .... | SC | Valid | Aljabar dasar |
| 10 | FPB dari \(221\) dan \(143\) adalah .... | SC | Valid | Teori bilangan |
| 11 | Penyelesaian dari \(3(x-2)\geq 12\) adalah .... | SC | Valid | Pertidaksamaan |
| 12 | Gradien garis m adalah... | SC | Valid* | *Butuh gambar di opsi |
| 13 | Nilai dari \(3^2+2\times4^2\) adalah .... | SC | Valid | Aritmetika |
| 14 | Titik \((2,7)\) terletak pada garis .... | SC | Valid | Koordinat |
| 15 | Tentukan sisa pembagian \(37\cdot58\) oleh \(7\) | Essay | Valid | Kongruensi |
| 16 | Nilai dari \(4!\) adalah .... | SC | Valid | Faktorial |
| 17 | Nilai dari \(\dfrac{9!}{6! \cdot 3! }\) adalah... | SC | Valid | Faktorial/kombinatorika |
| 18 | Tentukan nilai dari: \[{}^2\log 64\] | Essay | Valid | Logaritma |
| 19 | \(22 \times 28 =\cdots\) | SC | Valid | Hitung cepat |
| 20 | Ruang sampel dari pelemparan dua koin adalah .... | SC | Valid | Probabilitas |

**Hasil: 18/20 valid, 1 meragukan (tanpa konteks), 1 memerlukan gambar**

---

## Estimasi Distribusi Validitas

| Kategori | Estimasi | % |
|----------|------:|--:|
| Valid — soal singkat natural (KaTeX, aritmetika, definisi) | ~610 | ~87% |
| Perlu verifikasi — stem tanpa konteks/gambar | ~75 | ~11% |
| Bermasalah — terpotong atau tidak dapat dijawab | ~14 | ~2% |

---

## Rekomendasi untuk Sprint 2

1. **Jangan hapus massal soal pendek** — mayoritas valid.

2. **Auto-flag soal < 10 chars** untuk review manual wajib (hanya 4 soal).

3. **Soal dengan answer_key = {}** DAN pendek — ini yang paling bermasalah, prioritas review:
   ```sql
   SELECT count(*) FROM questions
   WHERE char_length(content_markdown) < 50
     AND answer_key = '{}'
     AND deleted_at IS NULL;
   ```

4. **Soal referensi stimulus** (mengandung "di atas", "berikut", "taman", dll. tanpa parent_id) perlu dicek apakah memiliki soal induk terkait.

5. **Catatan untuk Salman:** Kolom yang benar adalah `content_markdown` (bukan `content`). Query awal di brief menggunakan nama kolom lama.
