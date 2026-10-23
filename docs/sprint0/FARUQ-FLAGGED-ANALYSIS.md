# Analisis Data Soal Terflag — MAT-120 Sprint 0

**Tanggal:** 2026-10-20
**Penulis:** Faruq (Agent MAT-120)
**Tujuan:** Memahami distribusi soal terflag sebagai persiapan kurasi Sprint 2

---

## Ringkasan Eksekutif

Total soal terflag: **3.013 dari 11.867** (25,4% dari keseluruhan corpus).
Hampir semua flag berakar pada satu akar masalah: **kunci jawaban tidak tersedia saat ingesti**.

---

## Hasil Query

```sql
SELECT count(*), flag_notes
FROM questions
WHERE is_flagged=true AND deleted_at IS NULL
GROUP BY flag_notes
ORDER BY count DESC;
```

| Jumlah | Flag Notes |
|-------:|------------|
| 2.729 | Kunci jawaban tidak ditemukan — perlu telaah |
| 223 | Sumber TKA tanpa kunci di HTML (kunci di server) — perlu telaah; Kunci jawaban tidak ditemukan — perlu telaah |
| 22 | Tipe matrix_grid (pernyataan ↔ label) — kunci kosong di sumber; Kunci jawaban tidak ditemukan — perlu telaah |
| 11 | Opsi hanya 2 — mungkin parsing kurang; Kunci jawaban tidak ditemukan — perlu telaah |
| 9 | Sumber TKA tanpa kunci di HTML (kunci di server) — perlu telaah; Opsi hanya 3 — mungkin parsing kurang; Kunci jawaban tidak ditemukan — perlu telaah |
| 7 | Hanya 1 opsi terdeteksi — diperlakukan sebagai essay; Kunci jawaban tidak ditemukan — perlu telaah |
| 6 | Opsi hanya 3 — mungkin parsing kurang; Kunci jawaban tidak ditemukan — perlu telaah |
| 3 | Sebagian pernyataan tanpa kunci di sumber — perlu telaah; Kunci jawaban tidak ditemukan — perlu telaah |
| 2 | Opsi hanya 3 — mungkin parsing kurang |
| 1 | Opsi hanya 2 — mungkin parsing kurang |

**Total: 3.013 soal**

---

## Kategorisasi Temuan

### Kategori A: Kunci Jawaban Hilang (2.952 soal — 97,97%)

Soal-soal ini memiliki `is_flagged=true` dengan catatan inti "Kunci jawaban tidak ditemukan". Namun temuan penting dari inspeksi sampel:

- **Essay dengan explanation:** Banyak soal `essay` yang memiliki `answer_key` berisi `explanation` lengkap dan terstruktur. Flag dipasang oleh skrip ingesti karena tidak ada field `correct` (kunci pilihan ganda), bukan karena benar-benar tidak ada kunci.
- **Single choice dengan kunci kosong:** Soal pilihan ganda dari sumber TKA/Pusmendik memang benar-benar tidak memiliki kunci — field `answer_key = {}`.
- **Matrix grid:** Seluruh 330 soal `matrix_grid` tampaknya terflag karena format kunci berbeda dari yang diharapkan parser.

**Implikasi Sprint 2:** Perlu dua jalur kurasi:
1. Essay dengan explanation lengkap → Verifikasi explanation, hapus flag (otomatis).
2. Single choice kunci kosong → Perlu pengisian manual atau lookup sumber.

### Kategori B: Sumber TKA Tanpa Kunci HTML (232 soal — 7,70%)

Soal dari `corpus://pusmendik_tka/*` — kunci jawaban disimpan di server Pusmendik terpisah, tidak di HTML halaman. Diperlukan:
- Re-crawl dengan akses authenticated ke endpoint kunci server Pusmendik, atau
- Kurasi manual satu per satu.

### Kategori C: Format Opsi Tidak Standar (36 soal — 1,19%)

| Sub-kategori | Jumlah |
|----|----:|
| Opsi hanya 2 (bisa Benar/Salah) | 12 |
| Opsi hanya 3 | 17 |
| Hanya 1 opsi (diperlakukan essay) | 7 |

Sebagian besar ini adalah soal Benar/Salah yang di-parse sebagai pilihan ganda. Sprint 2 perlu menentukan apakah soal ini dihapus, dikonversi, atau dilestarikan sebagai tipe baru.

### Kategori D: Matrix Grid Kunci Kosong (22 soal — 0,73%)

Soal tipe `matrix_grid` (pernyataan ↔ label) yang kuncinya memang tidak tersedia di sumber asli. Seluruh kunci `answer_key = {}`.

---

## Temuan Kritis dari Inspeksi Sampel

Dari 20 sampel random soal terflag:

1. **Essay "Kunci hilang" sering menyesatkan** — contoh: soal `01a115ed-3df8` tentang parkir mobil-motor memiliki pembahasan langkah-demi-langkah lengkap di `answer_key.explanation`. Flag dipasang karena tidak ada `answer_key.correct`.

2. **Beberapa soal kunci benar-benar kosong** — contoh: soal `01a1156f-5e13` (matrix_grid, Bilqis beli buku) dan soal TKA (`01a1186e-1652`) memiliki `answer_key = {}`.

3. **Ada soal tidak relevan dengan matematika** — soal `01a11641-e2b7` tentang rantai mRNA (biologi) muncul di corpus. Ini indikasi kontaminasi corpus dari sumber non-matematika.

4. **Soal kompleks multi-bagian terflag** — soal essay dengan sub-pertanyaan a/b/c/d (contoh pertidaksamaan irasional) punya pembahasan sangat lengkap tapi tetap terflag.

---

## Rekomendasi untuk Sprint 2

| Prioritas | Aksi | Estimasi Soal |
|-----------|------|--------------|
| P1 | Auto-unflag essay dengan explanation.length > 100 | ~1.800 |
| P2 | Manual review: single_choice dengan answer_key = {} | ~900 |
| P3 | Re-crawl kunci TKA dari server Pusmendik | 232 |
| P4 | Tentukan tipe soal baru atau hapus: soal 2/3 opsi | 36 |
| P5 | Review dan kurasi matrix_grid kunci kosong | 352 |
| P6 | Tandai dan isolasi soal non-matematika | ~5 est. |

**Catatan untuk Salman (implementasi):** Script auto-unflag P1 perlu kondisi:
```sql
UPDATE questions SET is_flagged = false
WHERE is_flagged = true
  AND question_type = 'essay'
  AND answer_key->>'explanation' IS NOT NULL
  AND char_length(answer_key->>'explanation') > 100;
```
Estimasi soal yang bisa di-unflag otomatis: ±1.800 (perlu diverifikasi dengan COUNT sebelum eksekusi).

---

## Addendum — Analisis Lanjutan (Faruq Run-2, 20 Okt 2026)

Query terbaru (total flagged: 3.034) mengkonfirmasi distribusi di atas dengan rincian tambahan per `question_type`:

| Tipe Soal | Jumlah Flagged |
|-----------|----------------|
| essay | 2.202 (72,6%) |
| single_choice | 480 (15,8%) |
| matrix_grid | 330 (10,9%) |
| multiple_choice_checkbox | 22 (0,7%) |

Penting: seluruh 3.034 soal flagged berstatus `draft` — tidak ada yang lolos ke `published`. 

**Prioritas tambahan untuk Sprint 2:** 330 soal `matrix_grid` seluruhnya flagged; ini mewakili 100% dari tipe tersebut dan membutuhkan strategi kurasi khusus untuk format pernyataan ↔ label.
