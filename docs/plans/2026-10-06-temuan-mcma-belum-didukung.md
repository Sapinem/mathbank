# Temuan: Soal MCMA (`multiple_choice_checkbox`) belum didukung

Tanggal: 2026-10-06 · Status: **temuan tercatat, BELUM diperbaiki**

## Pertanyaan yang dijawab
"Apakah memang gak ada soal MCMA?" → **ADA**, tapi belum ditangani.

## Bukti

### 1. `pusmendik_tka` pakai `<checkbox>` — 8 berkas, 190 checkbox
Sumber menulis soal MCMA secara eksplisit:

```html
<p>Pilihlah pernyataan yang benar sesuai dengan informasi tersebut!
   Jawaban benar lebih dari satu.</p>
<!-- PG kompleks checkbox -->
<input name="pilihan5" type="checkbox" value="A" />
<input name="pilihan5" type="checkbox" value="B" />
```

| Berkas | checkbox | hasil parse |
|---|---:|---|
| sd-matematika-p1 | 10 | 21 `single_choice` |
| sd-matematika-p2 | 19 | 22 `single_choice` |
| sma-matematika-lanjut-p1 | 26 | 18 `single_choice` |
| sma-matematika-lanjut-p2 | 41 | 22 `single_choice` |
| sma-matematika-wajib-p1 | 27 | 39 `single_choice` |
| sma-matematika-wajib-p2 | 21 | 21 `single_choice` |
| smp-matematika-p1 | 29 | 23 `single_choice` |
| smp-matematika-p2 | 17 | 23 `single_choice` |
| **total** | **190** | **189 `single_choice`** |

**Masalah:** soal ber-jawaban >1 disimpan sebagai `single_choice` → **salah tipe**,
dan **kuncinya hilang** (0 soal ber-kunci >1).

### 2. defantri: 8 soal MCMA terbaca (kunci >1)
`A,E` · `C,D` · `C,E` · `B,C` — ini sudah benar (kunci multi terbaca).

### 3. m4thlab & mathcyber: 0 checkbox
Tidak ada MCMA berbasis checkbox; kunci selalu 1 label.

## Akar masalah
`src/lib/ingest/parsers/adapters/pusmendik-tka.ts` **hanya membaca `type="radio"`**.
Tidak ada penanganan `type="checkbox"` → grup checkbox tidak dikenali sebagai soal
MCMA, sehingga:
- (a) tipe jatuh ke `single_choice` (default), dan
- (b) kunci >1 tidak terkumpul.

Padahal kontrak **sudah mendukung**: `questionTypeSchema` punya
`multiple_choice_checkbox`, dan `answerKey.correct` menerima >1 label
(`["A"]` atau `["A","C"]`).

## Rencana perbaikan (belum dikerjakan)
1. Di `pusmendik-tka.ts`: deteksi grup `type="checkbox"` → tipe
   `multiple_choice_checkbox`, kumpulkan semua opsi ber-kunci.
2. Pastikan `finalizeItem` menerima `type` paksa (sudah ada opsi `opts.type`).
3. Uji: 190 checkbox → harus jadi item MCMA ber-kunci >1.
4. Pertimbangkan juga sumber lain bila ada checkbox serupa.

## Berkas terkait
- `src/lib/ingest/parsers/adapters/pusmendik-tka.ts` (hanya radio)
- `src/lib/contracts/question.ts` (`multiple_choice_checkbox` sudah ada)
- `scripts/dev/probe-mcma.ts` (pendeteksi MCMA)
