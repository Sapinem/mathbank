# PEDAGOGY.md — Standar Mutu Pedagogis & Kontrak Asesmen Matematika

> **Status:** Kanonikal Hidup (*Living Document*)  
> **Terakhir Diperbarui:** 5 Oktober 2026 (Mandat Dewan Direksi MAT-38)  
> **Pemilik:** Faruq (Math & Assessment Pedagogy Curator)  

---

## 1. Visi & Standar Mutu Math My Id

Math My Id berprinsip bahwa asesmen bukan sekadar alat penskoran pasif, melainkan instrumen diagnostik pembelajaran (*learning by doing*). Soal berkualitas tinggi harus mampu mengidentifikasi secara presisi letak miskonsepsi pemikiran siswa saat memilih jawaban keliru.

---

## 2. Mandat Analisis Pengecoh (*Distractor Rationale Mandate*)

⚠️ **Aturan Mutlak:**
Pada setiap butir soal pilihan ganda (opsi A–E), seluruh opsi pengecoh (opsi yang salah) **WAJIB** memiliki kolom `distractor_rationale` yang terisi secara substantif.

### Kriteria Distractor Rationale yang Sah:
1. **Analisis Miskonsepsi Nyata**: Harus menjelaskan kekeliruan konsep matematis yang mendasari munculnya angka/jawaban tersebut. Contoh:
   - *Salah*: "Jawaban salah karena nilainya tidak sesuai." (Ditolak — placeholder generik).
   - *Benar*: "Siswa keliru menerapkan sifat distributif perkalian terhadap penjumlahan, yaitu menghitung $2(x + 3)$ menjadi $2x + 3$ alih-alih $2x + 6$." (Diterima).
2. **Panjang Minimal**: Minimal 40 karakter deskripsi analitik.
3. **Penyelarasan Pembahasan**: Diturunkan secara koheren dari langkah-langkah dalam `answer_key.explanation`.

---

## 3. 31 Kaidah Haladyna (Item-Writing Rules)

Seluruh authoring dan kurasi soal pilihan ganda wajib mematuhi kaidah Thomas M. Haladyna:
1. **Fokus Konten**: Setiap soal menguji satu konsep/kompetensi tunggal yang terdefinisi jelas.
2. **Stem Jelas & Mandiri**: Pokok soal (*stem*) harus dapat dipahami maksudnya tanpa harus membaca opsi jawaban terlebih dahulu.
3. **Hindari Frasa Negatif Berlebih**: Hindari kata "KECUALI", "BUKAN", jika terpaksa gunakan huruf kapital tebal (**KECUALI**).
4. **Homogenitas Opsi**: Seluruh opsi jawaban (A–E) harus homogen dalam kategori gramatikal, struktur, dan panjang kalimat.
5. **Urutan Logis/Numerik**: Opsi numerik wajib disusun berurutan dari terkecil ke terbesar, atau sebaliknya.
6. **Larangan Opsi Klise**:
   - Dilarang menggunakan "Semua jawaban benar" (*All of the above*).
   - Dilarang menggunakan "Tidak ada jawaban yang benar" (*None of the above*).
7. **Bebas Petunjuk Gramatikal (Clueing)**: Opsi benar tidak boleh menjadi satu-satunya opsi yang lebih panjang, lebih detail, atau memiliki kata kunci yang identik dengan stem.

---

## 4. Standar Rubrik Penilaian Esai Analitik (*Analytic Rubrics*)

Untuk butir soal bentuk esai / isian terstruktur:
1. **Rambu Jawaban (*Scoring Criteria*)**: Wajib merinci langkah penyelesaian bertahap (*step-by-step mathematical reasoning*).
2. **Bobot Skor Terdistribusi**:
   - Skor pemahaman konsep / formula awal (misal: 1 poin).
   - Skor substitusi dan manipulasi aljabar benar (misal: 2 poin).
   - Skor ketelitian komputasi dan kesimpulan akhir disertai satuan (misal: 1 poin).

---

## 5. Validasi Sintaksis Formula KaTeX

Sebelum soal disetujui (`ready`):
1. **Keseimbangan Tanda Kurung**: Kurung kurawal `{}`, kurung siku `[]`, dan kurung biasa `()` harus seimbang.
2. **Larangan Perintah Rusak**: Mencegah macro kosong seperti `\frac{}{}`, `\sqrt{}`, atau spasi ganda tak tertutup.
3. **Pemisahan Modus**: Formula inline menggunakan `$ ... $`, formula blok sentral menggunakan `$$ ... $$`.
