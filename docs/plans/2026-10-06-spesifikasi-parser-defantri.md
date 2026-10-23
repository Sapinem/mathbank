# Spesifikasi Parser defantri (dari pemilik) — acuan wajib

Tanggal: 2026-10-06 · Sumber: arahan pemilik + contoh nyata artikel UNBK IPS 2019

## Aturan yang diminta

### 1. Penanda soal baru = `<h4>N. ...`
```html
<h4>3. Soal UNBK Matematika SMA IPS 2019 <a href="..." style="color: black"
    target="_blank" title="Soal dan Pembahasan UNBK Matematika SMA IPS Tahun 2019 ">&#128279;</a></h4>
```
- `<h4>` = **penanda soal baru** (pembuka blok soal). ✅ sudah dipakai parser.
- **Kata "Soal" dihilangkan** dari judul/heading.
- **Buang link & ikon** setipe `<a …>&#128279;</a>` (🔗) — termasuk `title=`, `style=`,
  `target=`, dan seluruh isinya. Yang tersisa: `UNBK Matematika SMA IPS 2019`.
- **Catat sebagai EVENT**: "UNBK Matematika SMA IPS 2019" → event `Ujian Nasional`
  (UNBK) + tahun `2019`.

### 2. Isi soal = `<blockquote>`
```html
<blockquote>Tabel berikut menyajikan data nilai ulangan Bahasa Indonesia siswa kelas XII.
  <div class="center">$…\begin{array}…$</div>
  Rata-rata nilai ulangan Bahasa Indonesia siswa kelas tersebut adalah...<br>
  <div class="question"> <label>…<input type="radio" name="q3" value="corect">$(A)\ 53,\!2 $</label> … </div>
</blockquote>
```
- **STEM** = teks sebelum `<div class="question">` (termasuk tabel LaTeX di `<div class="center">`).
- **OPSI**: label `$(A)$`…`$(E)$` **dibuang**, sisanya jadi isi opsi.
  → contoh BENAR: `\( 53,\!2 \)`, `\( 55,\!8 \)`, …
  (bukan `$(A)\ 53,\!2 $` dan bukan `\((A)\) 53,\!2`)
- **KUNCI**: `value="correct"` (⚠️ `corect` = pengecoh, BUKAN kunci).

### 3. Pembahasan = `<summary>…</summary>` di dalam `<details>`
```html
<summary>Alternatif Pembahasan:</summary><p>…</p> <p>$\therefore$ Pilihan yang sesuai adalah $(B)\ 55,\!8$</p></details>
```

### 4. KUNCI juga bisa dibaca dari kalimat penutup pembahasan
```html
<p>$\therefore$  Pilihan yang sesuai adalah  $(B)\ 55,\!8$</p></details>
```
→ pola penanda kunci: **"Pilihan yang sesuai adalah $(B)$ …"** — ambil hurufnya saja.
(Pola lain yang sudah terbukti: `(Jawaban X)`, `\boxed{…}`, `value="correct"`.)

## Yang perlu diverifikasi pada parser saat ini
1. Apakah `<h4>` + link ikon sudah **dibersihkan** (kata "Soal" & `<a>` dibuang)?
2. Apakah opsi jadi `\( 53,\!2 \)` (label `$(A)$` terbuang, math utuh)?
3. Apakah kunci terbaca dari `value="correct"` **dan** kalimat
   "Pilihan yang sesuai adalah $(B)$"?
4. Apakah event terisi (UNBK/Ujian Nasional 2019)?
5. Apakah heading dipakai sebagai `event_item_number` / metadata soal?

## Catatan tipe soal lain (aware-ness, belum dikerjakan)
- **MCMA/PG kompleks** (`multiple_choice_checkbox`): ADA di `pusmendik_tka`
  (190 checkbox) — parser belum dukung. Lihat
  `docs/plans/2026-10-06-temuan-mcma-belum-didukung.md`.
- **Benar-salah** (`matrix_grid`): sudah didukung (`defantri-tf.ts`).
- **Wacana/stimulus**: sudah didukung (`defantri-wacana.ts`).
- **Essay/uraian**: sudah (opsi <2 → essay).
