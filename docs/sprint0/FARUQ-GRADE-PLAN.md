# Rencana Mapping Grade — MAT-120 Sprint 0

**Tanggal:** 2026-10-20
**Penulis:** Faruq (Agent MAT-120)
**Tujuan:** Merancang mapping grade SD/SMP/SMA dari nilai 'umum' saat ini

---

## Ringkasan Eksekutif

**Kondisi saat ini:** Seluruh 11.867 soal memiliki `grade = 'umum'`.
Field ini harus diisi dengan grade yang tepat (mis. `sd`, `smp`, `sma`, `utbk`, `olimpiade`) untuk memungkinkan filtering dan kurasi bertarget di Sprint 2 dan seterusnya.

---

## Hasil Query

```sql
SELECT grade, count(*)
FROM questions
WHERE deleted_at IS NULL
GROUP BY grade
ORDER BY grade;
```

| Grade | Jumlah |
|-------|-------:|
| umum | 11.867 |
| **Total** | **11.867** |

Tidak ada variasi — seluruh corpus berlabel `umum`.

---

## Analisis Sumber Data Tersedia

Untuk mapping grade, tersedia beberapa sinyal dari field-field yang sudah ada:

### 1. Field `event_subtest` (sinyal terkuat)

Field ini menyimpan nama sub-tes atau sumber soal. Contoh nilai yang ditemukan:
- `"Simulasi TKA"` → `utbk`
- `"OSN"`, `"OSK"` → `olimpiade`
- `"UN SMP"`, `"US SMP"` → `smp`
- `"UN SMA"`, `"US SMA"`, `"USBN SMA"` → `sma`
- `"SD"`, `"US SD"` → `sd`

### 2. Field `event_notes` (sinyal sekunder)

Menyimpan keterangan tambahan event. Dapat mengandung jenjang.

### 3. Content patterns (fallback)

Berdasarkan analisis konten, topik matematika tertentu identik dengan jenjang tertentu:
- Operasi dasar bilangan bulat/pecahan → SD
- SPLDV, fungsi kuadrat → SMP
- Kalkulus, transformasi, barisan kompleks → SMA/UTBK
- Teori bilangan, analisis → Olimpiade/Universitas

---

## Skema Grade yang Diusulkan

### Nilai-Nilai Grade yang Valid

| Kode | Deskripsi | Fase Kurikulum Merdeka |
|------|-----------|----------------------|
| `sd` | Sekolah Dasar | Fase A (Kls 1–2), B (3–4), C (5–6) |
| `smp` | Sekolah Menengah Pertama | Fase D (Kls 7–9) |
| `sma` | Sekolah Menengah Atas | Fase E (Kls 10), F (11–12) |
| `utbk` | UTBK-SNBT / seleksi PT | Pasca SMA |
| `olimpiade` | OSK/OSP/OSN, kompetisi | Semua jenjang |
| `universitas` | Tingkat universitas (kalkulus lanjut, struktur aljabar) | Perguruan tinggi |
| `umum` | Tidak dapat ditentukan | Default fallback |

---

## Algoritma Mapping (Prioritas Sinyal)

### Level 1: Berbasis event_subtest (presisi tinggi)

```typescript
function gradeFromEventSubtest(subtest: string | null): Grade | null {
  if (!subtest) return null;
  const s = subtest.toLowerCase();

  if (/\bosn\b|\boskp\b|\bolimpiade\b/.test(s)) return 'olimpiade';
  if (/\bosk\b/.test(s)) return 'olimpiade'; // OSK bisa SD/SMP/SMA
  if (/\butbk\b|\bsnbt\b|\btka\b|\btkd\b/.test(s)) return 'utbk';
  if (/\bun sma\b|\busbn sma\b|\bus sma\b|\bsma\b/.test(s)) return 'sma';
  if (/\bun smp\b|\bus smp\b|\busbn smp\b|\bsmp\b/.test(s)) return 'smp';
  if (/\bus sd\b|\bsd\b|\bkelas [1-6]\b/.test(s)) return 'sd';
  if (/\buniversitas\b|\bperguruan tinggi\b|\bkalkulus lanjut\b/.test(s)) return 'universitas';

  return null;
}
```

### Level 2: Berbasis event_notes (fallback)

Sama seperti Level 1 tapi diterapkan pada `event_notes`.

### Level 3: Berbasis konten + difficulty (fallback akhir)

```typescript
function gradeFromContentAndDifficulty(
  content: string,
  difficulty: number,
  cognitiveLevel: string
): Grade {
  const c = content.toLowerCase();

  // Indikator universitas
  if (/\\mathbb|grup|ring|lapangan|epsilon-delta|sigma-aljabar/.test(c)) {
    return 'universitas';
  }

  // Indikator olimpiade
  if (/kongruensi modulo|bilangan prima besar|kombinatorik|invariant/.test(c) &&
      difficulty >= 4) {
    return 'olimpiade';
  }

  // Indikator UTBK/SMA tinggi
  if (/\\int|\\lim_{|\\frac{d}{dx}|matriks|determinan|vektor 3/.test(c)) {
    return difficulty >= 4 ? 'utbk' : 'sma';
  }

  // Indikator SMA
  if (/trigonometri|barisan geometri|logaritma|program linear|peluang bersyarat/.test(c)) {
    return 'sma';
  }

  // Indikator SMP
  if (/spldv|persamaan kuadrat|teorema pythagoras|statistika dasar/.test(c)) {
    return 'smp';
  }

  // Indikator SD
  if (difficulty <= 2 && !/[a-wyz]/.test(c.replace(/\\/g, '').replace(/\s/g, ''))) {
    return 'sd';
  }

  return 'umum'; // tidak dapat ditentukan
}
```

---

## Distribusi Target (Estimasi)

Berdasarkan karakteristik corpus yang diketahui (didominasi soal SMP/SMA dan UTBK):

| Grade | Estimasi % | Estimasi Soal |
|-------|--------:|-------:|
| sd | 5% | ~593 |
| smp | 30% | ~3.560 |
| sma | 35% | ~4.153 |
| utbk | 20% | ~2.373 |
| olimpiade | 7% | ~831 |
| universitas | 2% | ~237 |
| umum (unresolved) | 1% | ~119 |
| **Total** | **100%** | **11.867** |

**Catatan:** Persentase ini perkairan awal. Distribusi aktual harus divalidasi setelah implementasi.

---

## Query untuk Validasi Pre-Sprint 2

Sebelum implementasi, Salman perlu menjalankan query berikut untuk memahami distribusi `event_subtest`:

```sql
-- Top 30 event_subtest untuk memetakan sinapsis
SELECT event_subtest, count(*)
FROM questions
WHERE deleted_at IS NULL AND event_subtest IS NOT NULL
GROUP BY event_subtest
ORDER BY count DESC
LIMIT 30;

-- Soal tanpa event_subtest (perlu fallback content-based)
SELECT count(*) FROM questions
WHERE deleted_at IS NULL AND event_subtest IS NULL;

-- Soal yang event_subtestnya tidak dikenali
SELECT event_subtest, count(*)
FROM questions
WHERE deleted_at IS NULL
  AND event_subtest IS NOT NULL
GROUP BY event_subtest
ORDER BY count DESC;
```

---

## Rencana Implementasi Sprint 2

### Fase A: Analisis Event Subtest (Salman — 1 hari)
Jalankan query distribusi event_subtest, buat mapping tabel statis event→grade.

### Fase B: Script Batch Update (Salman — 1 hari)
```typescript
// Pseudocode
for (const question of allQuestions) {
  const grade =
    gradeFromEventSubtest(question.event_subtest) ??
    gradeFromEventSubtest(question.event_notes) ??
    gradeFromContentAndDifficulty(
      question.content_markdown,
      question.difficulty,
      question.cognitive_level
    );

  await db.update(questions)
    .set({ grade })
    .where(eq(questions.id, question.id));
}
```

### Fase C: Validasi Sampling (Faruq — 0.5 hari)
Sample 30 soal per grade, validasi kebenaran mapping.

### Fase D: Penyesuaian Aturan (Salman — 0.5 hari)
Perbaiki false positives berdasarkan hasil validasi.

**Total estimasi:** 3 hari kerja

---

## Catatan Penting untuk Salman

1. **Kolom DB aktual adalah `grade` (varchar 20)** — schema sudah mendukung nilai enum baru tanpa perlu migrasi.
2. **Jangan hardcode 'umum'** — simpan sebagai `NULL` untuk soal yang benar-benar tidak bisa ditentukan, agar mudah di-filter untuk kurasi lanjutan.
3. **Pertimbangkan field `grade` multi-level**: Satu soal bisa cocok untuk SMP dan SMA. Saat ini schema hanya satu nilai — diskusikan apakah perlu array grade atau tabel relasi `question_grades`.
