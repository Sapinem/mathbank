# Rencana Distribusi Difficulty — MAT-120 Sprint 0

**Tanggal:** 2026-10-20
**Penulis:** Faruq (Agent MAT-120)
**Tujuan:** Merancang heuristik penetapan difficulty 1–5 yang akan diimplementasikan Sprint 2

---

## Ringkasan Eksekutif

**Kondisi saat ini:** Seluruh 11.867 soal memiliki `difficulty = 3` (rata-rata hardcoded).
Ini tidak mencerminkan realitas — corpus mencakup soal dari SD (penjumlahan) hingga universitas (analisis nyata, struktur aljabar).

---

## Hasil Query

```sql
SELECT difficulty, count(*)
FROM questions
WHERE deleted_at IS NULL
GROUP BY difficulty
ORDER BY difficulty;
```

| Difficulty | Jumlah |
|-----------|-------:|
| 3 | 11.867 |
| **Total** | **11.867** |

Seluruh 11.867 soal berada di difficulty 3. Distribusi ini harus dirombak.

---

## Konteks Kurikulum

Difficulty dalam MathBank harus selaras dengan:
- **Kurikulum Merdeka** (Fase A–F: SD kelas 1–6, SMP kelas 7–9, SMA kelas 10–12)
- **UTBK-SNBT** (Penalaran Matematika, Kemampuan Literasi)
- **Level kognitif Bloom** (C1 Ingatan → C6 Mencipta)
- **Webb's DOK** (Level 1–4)

---

## Definisi Heuristik Difficulty 1–5

### Difficulty 1 — Sangat Mudah (SD / Fase A–C)

**Target peserta didik:** Kelas 1–6 SD, usia 7–12 tahun
**Ciri soal:**
- Operasi aritmetika dasar: penjumlahan, pengurangan, perkalian, pembagian bilangan kecil
- Membaca data dari tabel/grafik sederhana
- Pengenalan bentuk geometri dasar
- Konversi satuan dasar

**Bloom:** C1 (Ingatan), C2 (Pemahaman dasar)
**DOK:** Level 1 (Recall)

**Heuristik deteksi:**
- Soal mengandung kata kunci: "banyaknya", "jumlahkan", "kurangkan", "berapa kali", "nama bangun"
- Bilangan yang muncul dalam soal < 1.000
- Tidak ada variabel aljabar (tidak ada x, y, n)
- event_subtest mengandung: SD, Kelas 4–6

---

### Difficulty 2 — Mudah (SMP Kelas 7–8 / Fase D awal)

**Target peserta didik:** Kelas 7–8 SMP, usia 12–14 tahun
**Ciri soal:**
- Persamaan linear satu variabel
- FPB, KPK, bilangan prima
- Bangun datar: luas, keliling
- Statistik dasar: mean, median, modus
- Peluang dasar
- Aritmetika sosial sederhana

**Bloom:** C2 (Pemahaman), C3 (Aplikasi prosedural)
**DOK:** Level 1–2

**Heuristik deteksi:**
- Soal berisi satu langkah prosedural jelas
- Tidak memerlukan multi-step reasoning kompleks
- event_subtest: SMP, UN SMP, OSK SD
- Tipe soal: single_choice dengan 1 prosedur

---

### Difficulty 3 — Sedang (SMP Kelas 9 / SMA Kelas 10 / Fase D–E)

**Target peserta didik:** Kelas 9 SMP – Kelas 10 SMA, usia 14–16 tahun
**Ciri soal:**
- Sistem persamaan linear dua variabel
- Fungsi kuadrat, grafik parabola
- Trigonometri dasar (sin/cos/tan)
- Barisan dan deret aritmetika/geometri
- Statistik: distribusi frekuensi, simpangan baku
- Kombinatorika: permutasi, kombinasi

**Bloom:** C3 (Aplikasi), C4 (Analisis awal)
**DOK:** Level 2

**Heuristik deteksi:**
- Soal memerlukan 2–3 langkah penyelesaian
- Ada pilihan strategi (lebih dari satu cara)
- event_subtest: UN SMP, USM SMA, TO SMA
- Panjang content_markdown: 80–250 chars

---

### Difficulty 4 — Sulit (SMA Kelas 11–12 / Fase F / UTBK)

**Target peserta didik:** Kelas 11–12 SMA, usia 16–18 tahun, persiapan SNBT
**Ciri soal:**
- Limit, turunan, integral
- Matriks dan determinan
- Transformasi geometri
- Peluang: distribusi normal, binomial
- Program linear
- Vektor dan ruang 3D

**Bloom:** C4 (Analisis), C5 (Evaluasi)
**DOK:** Level 2–3

**Heuristik deteksi:**
- Soal memerlukan >3 langkah atau penggunaan teorema non-trivial
- Konteks aplikasi (cerita, interpretasi)
- event_subtest: TKA, UTBK, OSK SMA, UN SMA
- Konten mengandung: \int, \lim, \sum, \frac{d}{dx}

---

### Difficulty 5 — Sangat Sulit (Olimpiade / Universitas)

**Target peserta didik:** Peserta OSP/OSN, mahasiswa tingkat awal
**Ciri soal:**
- Teori bilangan (kongruensi, prima, modular)
- Analisis nyata (limit epsilon-delta, deret konvergen)
- Struktur aljabar (grup, ring, lapangan)
- Geometri transformasional lanjut
- Kombinatorika non-trivial
- Pembuktian formal

**Bloom:** C5 (Evaluasi), C6 (Mencipta/Konstruksi)
**DOK:** Level 3–4

**Heuristik deteksi:**
- Konten mengandung: kongruensi, grup, ring, terbukti, deret, \mathbb{Z}, \mathbb{R}
- Soal tipe essay dengan pembahasan > 500 chars
- event_subtest: OSN, olimpiade, kompetisi
- Soal matematika universitas (kalkulus lanjut, struktur aljabar)

---

## Algoritma Implementasi (Rekomendasi untuk Salman)

### Tahap 1: Rule-Based (Sprint 2 — otomatis)

```typescript
function estimateDifficulty(q: Question): 1 | 2 | 3 | 4 | 5 {
  const content = q.content_markdown.toLowerCase();
  const explanation = q.answer_key?.explanation ?? '';

  // D5: Olimpiade / Universitas
  if (
    /\b(grup|ring|lapangan|kongruensi|deret konvergen|buktikan|terbukti)\b/.test(content) ||
    /\\mathbb\{[ZRQ]\}/.test(content) ||
    explanation.length > 800
  ) return 5;

  // D4: SMA lanjut / UTBK
  if (
    /\\int|\\lim|\\sum|\\frac\{d\}/.test(content) ||
    /\b(integral|turunan|limit|matriks|determinan|vektor)\b/.test(content)
  ) return 4;

  // D2: SMP dasar
  if (
    /\b(fpb|kpk|bilangan prima|perimeter|keliling|luas|mean|median|modus)\b/.test(content) &&
    !/\\int|\\lim/.test(content)
  ) return 2;

  // D1: SD
  if (
    !/[a-z]/.test(content.replace(/\\/g, '')) && // Tidak ada variabel
    /^\d{1,3}/.test(content) // Dimulai dengan bilangan kecil
  ) return 1;

  // Default: D3 (sedang)
  return 3;
}
```

### Tahap 2: AI-Assisted (Sprint 3 — refinement)

Setelah tagging rule-based, gunakan LLM scoring untuk soal yang:
- Rule menghasilkan D3 (default)
- explanation.length > 300 (soal kompleks)
- Confidence score rule < 0.7

---

## Target Distribusi Ideal

Mengacu pada distribusi soal nasional (PISA, UN, UTBK):

| Difficulty | Nama | Target % | Estimasi Soal |
|-----------|------|-------:|-------:|
| 1 | Sangat Mudah | 10% | ~1.187 |
| 2 | Mudah | 25% | ~2.967 |
| 3 | Sedang | 35% | ~4.153 |
| 4 | Sulit | 20% | ~2.373 |
| 5 | Sangat Sulit | 10% | ~1.187 |
| **Total** | | **100%** | **11.867** |

**Catatan:** Distribusi aktual setelah tagging kemungkinan berat di D3–D4 karena corpus didominasi soal SMP/SMA dan UTBK.

---

## Prioritas Sprint 2

1. Implementasikan function `estimateDifficulty()` di pipeline ingesti (rule-based)
2. Run batch update untuk seluruh 11.867 soal
3. Generate laporan distribusi post-update
4. Sample 50 soal per difficulty untuk validasi kurator

**Estimasi waktu:** 2–3 hari development + 1 hari QA sampling
