# Spesifikasi Payload Soal Dinamis — MathBank

> **Status:** aktif · diperbarui MAT-145 (2026-10-22)
> **Pemilik:** Faruq (Math & Assessment Pedagogy Curator)
> **Acuan teknis:** `src/lib/validations/question-payload.ts`
> **Acuan arsitektur:** `docs/architecture/QUESTION_PAYLOAD_DECISION.md`

Dokumen ini menetapkan format standar, contoh payload valid, dan contoh payload
invalid untuk ke-5 tipe soal dinamis yang didukung MathBank. Skema ini adalah
kontrak tunggal antara layer penyimpanan (kolom `data_payload` dan `answer_key`
pada tabel `questions`) dan semua konsumer: ingest pipeline, service layer, UI
editor, dan gate mutu Salman.

---

## Daftar Isi

1. [Prinsip Umum Pedagogis](#1-prinsip-umum-pedagogis)
2. [Tipe 1 — `multiple_choice`](#2-tipe-1--multiple_choice)
3. [Tipe 2 — `complex_multiple_choice`](#3-tipe-2--complex_multiple_choice)
4. [Tipe 3 — `matching`](#4-tipe-3--matching)
5. [Tipe 4 — `matrix`](#5-tipe-4--matrix)
6. [Tipe 5 — `short_answer` dan `essay`](#6-tipe-5--short_answer-dan-essay)
7. [Guard Siap Rilis (`releasedQuestionGuardSchema`)](#7-guard-siap-rilis)
8. [Contoh Invalid Lintas-Tipe](#8-contoh-invalid-lintas-tipe)
9. [Penyelarasan Roadmap MAT-35](#9-penyelarasan-roadmap-mat-35)

---

## 1. Prinsip Umum Pedagogis

### 1.1 Haladyna 31 Item-Writing Rules (subset kritis)

| # | Aturan | Diterapkan di |
|:-:|--------|---------------|
| 2 | Minimal 2 opsi per soal PG | `options.min(2)` |
| 5 | Larang "semua di atas" / "tidak ada di atas" | `containsForbiddenPhrase()` |
| 6 | Stem soal harus mandiri dan tunggal | konvensi isi, tidak divalidasi Zod |
| 11 | Opsi homogen (panjang, struktur, grammatikal) | konvensi isi |
| 19 | Kunci harus acak terdistribusi A–E | diaudit oleh `audit-pedagogy.ts` |

### 1.2 Distractor Rationale Mandate

Setiap opsi **salah** (distractor/pengecoh) pada soal siap rilis wajib memiliki
`distractorRationale` yang memenuhi kontrak tiga-elemen:

```
(a) Nama kesalahan        → mis. "Salah menerapkan aturan rantai"
(b) Langkah matematis salah → mis. "Menghitung f(g(x))' = f'(x)·g(x) bukan f'(g(x))·g'(x)"
(c) Nilai hasil keliru    → mis. "Menghasilkan 6x² bukan 6x²·2x = 12x³"
```

Minimal 40 karakter. Rubrik ini memungkinkan diagnostik miskonsepsi per siswa.

### 1.3 KaTeX Typography

Semua field `contentMarkdown`, `explanationMarkdown`, dan `scoringRubric`
menggunakan KaTeX murni:

- Inline: `\( x^2 + y^2 = r^2 \)`
- Display: `\[ \int_0^\infty e^{-x}\,dx = 1 \]`
- Makro lokal: `\( \lim_{x \to 0} \frac{\sin x}{x} = 1 \)`

**Tidak** menggunakan `$...$` atau `$$...$$` (tidak didukung render MathBank).

---

## 2. Tipe 1 — `multiple_choice`

Pilihan Ganda Biasa. Tepat satu kunci benar dari A–E.

### 2.1 Payload Valid (Draft — distractorRationale opsional)

```json
{
  "data_payload": {
    "type": "multiple_choice",
    "options": [
      {
        "id": "A",
        "contentMarkdown": "\\( 6x^2 \\)"
      },
      {
        "id": "B",
        "contentMarkdown": "\\( 12x^3 \\)"
      },
      {
        "id": "C",
        "contentMarkdown": "\\( 12x^2 \\)"
      },
      {
        "id": "D",
        "contentMarkdown": "\\( 6x^3 \\)"
      },
      {
        "id": "E",
        "contentMarkdown": "\\( 3x^4 \\)"
      }
    ],
    "shuffleOptions": true
  },
  "answer_key": {
    "correctOptionIds": "B",
    "explanationMarkdown": "Gunakan aturan rantai: jika \\( f(x) = (2x^2+1)^3 \\), maka\n\\[ f'(x) = 3(2x^2+1)^2 \\cdot 4x = 12x(2x^2+1)^2. \\]\nSubstitusi \\( x=1 \\): \\( f'(1) = 12 \\cdot 9 = 108 \\)."
  }
}
```

### 2.2 Payload Valid (Released — distractorRationale wajib untuk pengecoh)

```json
{
  "data_payload": {
    "type": "multiple_choice",
    "options": [
      {
        "id": "A",
        "contentMarkdown": "\\( 6x^2 \\)",
        "distractorRationale": "Siswa mengabaikan aturan rantai dan hanya menurunkan eksponen luar: \\( (2x^2)^3 \\to 3(2x^2)^2 \\to 6x^2 \\). Langkah benar membutuhkan perkalian dengan turunan fungsi dalam \\( 4x \\)."
      },
      {
        "id": "B",
        "contentMarkdown": "\\( 12x^3 \\)"
      },
      {
        "id": "C",
        "contentMarkdown": "\\( 12x^2 \\)",
        "distractorRationale": "Siswa menerapkan aturan rantai tetapi lupa kuadratkan ekspresi dalam: menulis \\( 3 \\cdot 4x = 12x^2 \\) alih-alih \\( 3(2x^2+1)^2 \\cdot 4x \\)."
      },
      {
        "id": "D",
        "contentMarkdown": "\\( 6x^3 \\)",
        "distractorRationale": "Siswa menurunkan fungsi dalam secara terpisah tanpa menyertakan turunan fungsi luar: menghitung \\( (4x)^3/2 = 6x^3 \\), mencampurkan pangkat dengan perkalian."
      },
      {
        "id": "E",
        "contentMarkdown": "\\( 3x^4 \\)",
        "distractorRationale": "Siswa mengintegrasikan alih-alih menurunkan: menghasilkan \\( \\frac{(2x^2+1)^4}{4 \\cdot 2} \\approx 3x^4 \\) untuk suku dominan."
      }
    ],
    "shuffleOptions": true
  },
  "answer_key": {
    "correctOptionIds": "B",
    "explanationMarkdown": "Gunakan aturan rantai: jika \\( f(x) = (2x^2+1)^3 \\), maka\n\\[ f'(x) = 3(2x^2+1)^2 \\cdot 4x = 12x(2x^2+1)^2. \\]\nSubstitusi \\( x=1 \\): \\( f'(1) = 12 \\cdot 9 = 108 \\)."
  }
}
```

### 2.3 Payload Invalid

```json
{
  "data_payload": {
    "type": "multiple_choice",
    "options": [
      { "id": "A", "contentMarkdown": "12" }
    ]
  }
}
```

**Alasan gagal:**
- `options` hanya berisi 1 item (minimum 2, Haladyna Rule 2).
- `answer_key` tidak hadir → `explanationMarkdown` wajib.

---

## 3. Tipe 2 — `complex_multiple_choice`

Pilihan Ganda Kompleks. Satu atau lebih kunci benar. Kunci disimpan sebagai array.

### 3.1 Payload Valid

```json
{
  "data_payload": {
    "type": "complex_multiple_choice",
    "options": [
      {
        "id": "A",
        "contentMarkdown": "\\( \\sin^2 x + \\cos^2 x = 1 \\)",
        "distractorRationale": null
      },
      {
        "id": "B",
        "contentMarkdown": "\\( \\tan x = \\frac{\\cos x}{\\sin x} \\)",
        "distractorRationale": "Siswa membalik pembilang dan penyebut: \\( \\tan x = \\frac{\\sin x}{\\cos x} \\), bukan \\( \\frac{\\cos x}{\\sin x} \\). Opsi ini salah."
      },
      {
        "id": "C",
        "contentMarkdown": "\\( 1 + \\tan^2 x = \\sec^2 x \\)",
        "distractorRationale": null
      },
      {
        "id": "D",
        "contentMarkdown": "\\( \\sin 2x = \\sin x \\cdot \\cos x \\)",
        "distractorRationale": "Siswa lupa faktor 2 pada rumus sudut ganda: \\( \\sin 2x = 2\\sin x\\cos x \\). Menghasilkan nilai setengah dari benar."
      },
      {
        "id": "E",
        "contentMarkdown": "\\( \\cos 2x = 1 - 2\\sin^2 x \\)",
        "distractorRationale": null
      }
    ],
    "shuffleOptions": true
  },
  "answer_key": {
    "correctOptionIds": ["A", "C", "E"],
    "explanationMarkdown": "Identitas trigonometri yang benar:\n- A: Identitas Pythagoras dasar ✓\n- C: Diturunkan dari A dengan membagi \\( \\cos^2 x \\) ✓\n- E: Salah satu bentuk rumus sudut ganda ✓\n\nOpsi B salah karena membalik \\( \\tan x \\). Opsi D salah karena hilang faktor 2."
  }
}
```

### 3.2 Payload Invalid

```json
{
  "data_payload": {
    "type": "complex_multiple_choice",
    "options": [
      { "id": "A", "contentMarkdown": "Semua jawaban di atas benar" },
      { "id": "B", "contentMarkdown": "\\( x = 5 \\)" }
    ]
  }
}
```

**Alasan gagal:**
- Opsi A mengandung frasa terlarang "Semua jawaban di atas benar" (Haladyna Rule 5).

---

## 4. Tipe 3 — `matching`

Menjodohkan / Tarik Garis. Premis dipasangkan ke respons.

### 4.1 Payload Valid

```json
{
  "data_payload": {
    "type": "matching",
    "premises": [
      { "id": "p1", "contentMarkdown": "Turunan \\( \\sin x \\)" },
      { "id": "p2", "contentMarkdown": "Turunan \\( \\cos x \\)" },
      { "id": "p3", "contentMarkdown": "Turunan \\( \\tan x \\)" },
      { "id": "p4", "contentMarkdown": "Turunan \\( e^x \\)" }
    ],
    "responses": [
      { "id": "r1", "contentMarkdown": "\\( -\\sin x \\)" },
      { "id": "r2", "contentMarkdown": "\\( \\cos x \\)" },
      { "id": "r3", "contentMarkdown": "\\( \\sec^2 x \\)" },
      { "id": "r4", "contentMarkdown": "\\( e^x \\)" },
      { "id": "r5", "contentMarkdown": "\\( -\\cos x \\)" }
    ]
  },
  "answer_key": {
    "matchingPairs": {
      "p1": "r2",
      "p2": "r1",
      "p3": "r3",
      "p4": "r4"
    },
    "explanationMarkdown": "Pasangan yang benar:\n- \\( (\\sin x)' = \\cos x \\)\n- \\( (\\cos x)' = -\\sin x \\)\n- \\( (\\tan x)' = \\sec^2 x \\)\n- \\( (e^x)' = e^x \\)\n\nOpsi \\( -\\cos x \\) adalah distraktor (antiturunan \\( \\sin x \\))."
  }
}
```

### 4.2 Payload Invalid

```json
{
  "data_payload": {
    "type": "matching",
    "premises": [],
    "responses": [
      { "id": "r1", "contentMarkdown": "\\( \\cos x \\)" }
    ]
  },
  "answer_key": {
    "matchingPairs": {},
    "explanationMarkdown": "Tidak ada."
  }
}
```

**Alasan gagal:**
- `premises` kosong (minimum 1).
- `matchingPairs` kosong, tidak ada premis yang dipasangkan.

---

## 5. Tipe 4 — `matrix`

Matriks Pilihan. Setiap pernyataan dijawab dengan salah satu kolom (misal Benar/Salah).

### 5.1 Payload Valid

```json
{
  "data_payload": {
    "type": "matrix",
    "columns": ["Benar", "Salah"],
    "statements": [
      { "id": "s1", "contentMarkdown": "\\( \\sqrt{(-3)^2} = -3 \\)" },
      { "id": "s2", "contentMarkdown": "\\( |x| \\geq 0 \\) untuk semua \\( x \\in \\mathbb{R} \\)" },
      { "id": "s3", "contentMarkdown": "\\( \\sqrt{a^2 + b^2} = a + b \\) untuk \\( a,b > 0 \\)" },
      { "id": "s4", "contentMarkdown": "\\( \\sqrt{4 \\cdot 9} = \\sqrt{4} \\cdot \\sqrt{9} = 6 \\)" }
    ]
  },
  "answer_key": {
    "matrixAnswers": {
      "s1": "Salah",
      "s2": "Benar",
      "s3": "Salah",
      "s4": "Benar"
    },
    "explanationMarkdown": "- s1 Salah: \\( \\sqrt{(-3)^2} = \\sqrt{9} = 3 \\), bukan \\(-3\\).\n- s2 Benar: nilai mutlak selalu non-negatif.\n- s3 Salah: \\( \\sqrt{a^2+b^2} \\neq a+b \\) — contoh: \\( \\sqrt{9+16}=5 \\neq 7 \\).\n- s4 Benar: \\( \\sqrt{ab} = \\sqrt{a}\\cdot\\sqrt{b} \\) untuk \\( a,b \\geq 0 \\)."
  }
}
```

### 5.2 Payload Invalid

```json
{
  "data_payload": {
    "type": "matrix",
    "columns": ["Benar"],
    "statements": []
  }
}
```

**Alasan gagal:**
- `columns` hanya 1 item (minimum 2).
- `statements` kosong (minimum 1).

---

## 6. Tipe 5 — `short_answer` dan `essay`

### 6.1 `short_answer` — Payload Valid

```json
{
  "data_payload": {
    "type": "short_answer",
    "expectedLength": "1–3 kata atau satu ekspresi aljabar",
    "rubricGuidelines": "Terima jawaban dalam bentuk angka bulat atau pecahan sederhana. Tidak sensitif spasi. Variasi: 12, dua belas, 12,0."
  },
  "answer_key": {
    "acceptedAnswers": ["12", "dua belas", "12,0"],
    "explanationMarkdown": "Substitusi \\( n=5 \\) ke \\( U_n = 2n+2 \\):\n\\[ U_5 = 2(5)+2 = 12. \\]"
  }
}
```

### 6.2 `essay` — Payload Valid

```json
{
  "data_payload": {
    "type": "essay",
    "expectedLength": "4–6 langkah kerja",
    "rubricGuidelines": "Nilai penuh diberikan jika: (1) mengidentifikasi rumus turunan yang tepat, (2) menerapkan aturan rantai dengan benar, (3) substitusi nilai batas, (4) menyertakan satuan/konteks. Penilaian parsial diizinkan per langkah."
  },
  "answer_key": {
    "explanationMarkdown": "Langkah penyelesaian lengkap:\n1. Identifikasi \\( f(x) = (3x^2-1)^4 \\)\n2. \\( f'(x) = 4(3x^2-1)^3 \\cdot 6x = 24x(3x^2-1)^3 \\)\n3. Substitusi \\( x=1 \\): \\( f'(1) = 24(1)(2)^3 = 192 \\)",
    "scoringRubric": "Langkah 1 — Identifikasi bentuk komposisi (1 poin): menyebutkan fungsi luar dan dalam.\nLangkah 2 — Menerapkan aturan rantai (3 poin): turunan luar × turunan dalam, tanda benar.\nLangkah 3 — Substitusi \\( x=1 \\) (1 poin): nilai numerik tepat.\nLangkah 4 — Jawaban akhir dengan satuan/konteks (1 poin): menyertakan pernyataan jawaban.\nTotal: 6 poin. Penilaian parsial: -1 untuk setiap langkah yang hilang atau salah formulasi."
  }
}
```

### 6.3 Payload Invalid — `essay` tanpa rubrik

```json
{
  "data_payload": {
    "type": "essay",
    "rubricGuidelines": "OK"
  },
  "answer_key": {
    "explanationMarkdown": "Pembahasan ada."
  }
}
```

**Alasan gagal:**
- `rubricGuidelines` terlalu pendek (< 20 karakter).
- Untuk soal siap rilis: `scoringRubric` di `answer_key` wajib (min 20 karakter).

---

## 7. Guard Siap Rilis

`releasedQuestionGuardSchema` adalah validasi tambahan yang harus dijalankan
oleh service layer **sebelum mengubah status soal ke `"released"`**.

```typescript
import { releasedQuestionGuardSchema } from "@/lib/validations/question-payload";

const result = releasedQuestionGuardSchema.safeParse({
  dataPayload: question.data_payload,
  answerKey: question.answer_key,
});

if (!result.success) {
  // Blokir perubahan status ke "released"
  throw new Error(result.error.issues.map(i => i.message).join("; "));
}
```

### Matriks Aturan Guard

| Tipe Soal | Aturan Tambahan |
|-----------|----------------|
| `multiple_choice` | Semua pengecoh wajib punya `distractorRationale` ≥ 40 karakter |
| `complex_multiple_choice` | Sama dengan di atas |
| `matching` | Semua `premiseId` tercakup di `matchingPairs` |
| `matrix` | Semua `statementId` tercakup di `matrixAnswers` |
| `short_answer` | `acceptedAnswers` tidak boleh kosong |
| `essay` | `scoringRubric` wajib ≥ 20 karakter |

---

## 8. Contoh Invalid Lintas-Tipe

### Invalid — Opsi dengan frasa terlarang

```json
{
  "data_payload": {
    "type": "multiple_choice",
    "options": [
      { "id": "A", "contentMarkdown": "12" },
      { "id": "B", "contentMarkdown": "Tidak ada jawaban yang benar" }
    ]
  }
}
```

**Error:** Opsi B mengandung frasa "Tidak ada jawaban yang benar" (Haladyna Rule 5).

### Invalid — Matching tanpa semua premis terpasangkan (guard rilis)

```json
{
  "data_payload": {
    "type": "matching",
    "premises": [
      { "id": "p1", "contentMarkdown": "..." },
      { "id": "p2", "contentMarkdown": "..." }
    ],
    "responses": [
      { "id": "r1", "contentMarkdown": "..." }
    ]
  },
  "answer_key": {
    "matchingPairs": { "p1": "r1" },
    "explanationMarkdown": "..."
  }
}
```

**Error (guard rilis):** Premis `"p2"` belum memiliki pasangan di `matchingPairs`.

### Invalid — Matrix kolom tunggal

```json
{
  "data_payload": {
    "type": "matrix",
    "columns": ["Benar"],
    "statements": [
      { "id": "s1", "contentMarkdown": "Pernyataan 1" }
    ]
  }
}
```

**Error:** `columns` hanya 1 item; minimal 2 diperlukan.

---

## 9. Penyelarasan Roadmap MAT-35

Skrip enrichment distractor rationale pada [MAT-35](/MAT/issues/MAT-35)
harus menargetkan field `data_payload.options[].distractorRationale` (bukan
`question_options.distractor_rationale` dari model lama).

### Format target skrip kurasi

```typescript
// Struktur yang BENAR untuk Single Table + Hybrid JSONB
const updatedOptions = currentOptions.map(opt => ({
  ...opt,
  distractorRationale: opt.id !== correctOptionId
    ? buildRationale(opt)   // string, min 40 karakter
    : opt.distractorRationale ?? null,
}));

await db.update(questions)
  .set({
    data_payload: {
      ...currentPayload,
      options: updatedOptions,
    }
  })
  .where(eq(questions.id, questionId));
```

### Format yang tidak lagi digunakan (model lama — JANGAN dipakai)

```typescript
// ❌ SALAH — model question_options sudah ditinggalkan
await db.update(questionOptions)
  .set({ distractor_rationale: rationale })
  .where(eq(questionOptions.questionId, questionId));
```

---

*Dokumen ini hidup — perbarui setiap kali skema berubah atau aturan pedagogis baru ditetapkan.
Rujukan silang: `docs/architecture/QUESTION_PAYLOAD_DECISION.md`, `docs/pedagogy/AUDIT-DISTRACTOR-RATIONALE.md`.*
