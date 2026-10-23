# Temuan: Kunci Jawaban mathcyber — ADA di sumber, tapi presisi belum cukup

Tanggal: 2026-10-06 · Status: **temuan tercatat, kunci TIDAK diisi otomatis**

## Pertanyaan yang diselidiki
"413 soal PG tanpa kunci — benar-benar tak ada jawabannya, atau adaptor
melewatkan penanda?"

## Jawaban: ADA penandanya, tapi TIDAK aman dipakai otomatis

### Penyelidikan (2 putaran, seluruh 405 berkas)

**Putaran 1** — cari kalimat kunci di teks pembahasan:
| Pola | Kecocokan |
|---|---:|
| `jawabannya X` | 8 |
| `pilihan X benar` | 4 |
| `kunci X` | 2 |

**Putaran 2** — pola lebih luas:
| Pola | Kecocokan |
|---|---:|
| `jawaban(nya) ... X` | **879** ← terlalu longgar (banyak teks biasa) |
| opsi di-`<strong>` | 220 |
| `pilihan X` | 61 |
| `opsi X` | 18 |

### Pola yang menemukan penanda NYATA
```
(Jawaban E)     ← tepat sebelum [collapse]
(Jawaban C)
(Jawaban A)
```
Konsisten **273×**. Ini penanda kunci yang jelas.

### TAPI presisinya hanya 90,2% — TIDAK LAYAK

Diuji pada berkas yang soalnya **sudah** punya kunci (`verify-jawaban-pattern.ts`):

| | |
|---|---:|
| Cocok dengan kunci yang sudah ada | 3.413 |
| **Tidak cocok** | **369 (9,8%)** |

Ketidakcocokan karena **urutan tidak selaras**: penanda di HTML tidak selalu
bersesuaian 1:1 dengan urutan soal hasil parse (ada penanda di teks lain).

### Keputusan
**Kunci TIDAK diisi otomatis.** Mengikuti prinsip proyek (STRATEGI-INGEST):
> **"Jangan menebak kunci — kunci kosong > kunci salah."**

10% salah itu fatal untuk bank soal (siswa belajar jawaban yang salah).
Solusi: soal tetap masuk dengan status **"perlu telaah"** (`isFlagged`), untuk
diperiksa manusia — sesuai keputusan pemilik.

### Kesimpulan angka
| | Jumlah |
|---|---:|
| Soal PG tanpa kunci (mathcyber) | **413** |
| Tersebar di artikel | **54** |
| Artikel yang punya penanda `(Jawaban X)` | 230 |
| Soal yang **mungkin** dipulihkan | ~217 |
| Presisi saat ini | **90,2%** ⚠️ |

### Rencana lanjutan (belum dikerjakan)
Pemetaan **per-blok soal** (bukan per-urutan global): ambil penanda `(Jawaban X)`
yang berada **di dalam** blok soal yang sama, bukan mencocokkan berdasarkan
urutan. Bila terbukti >99%, baru diisi otomatis.

## Berkas
- `scripts/dev/probe-mathcyber-keys.ts` — putaran 1
- `scripts/dev/probe-mathcyber-keys2.ts` — putaran 2 (luas)
- `scripts/dev/precision-mathcyber-keys.ts` — uji presisi tiap pola
- `scripts/dev/verify-jawaban-pattern.ts` — uji pola `(Jawaban X)` vs kunci yang ada
- `scripts/dev/inspect-mathcyber-keys.ts` — lihat konteks penanda
