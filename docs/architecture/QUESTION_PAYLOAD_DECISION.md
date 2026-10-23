# Arahan Penyesuaian Arsitektur Soal Dinamis MathBank

Dokumen ini merangkum keputusan arsitektur penyimpanan soal dan opsi untuk repositori **MathBank**, terpisah dari Axiom.

## 1. Keputusan Arsitektur Utama
- **Single Table + Hybrid JSONB (`data_payload` & `answer_key`)**: 
  Seluruh komponen soal (batang soal, opsi pilihan ganda, matriks, menjodohkan, isian, hingga rasionalisasi distraktor AI) disimpan langsung di kolom `data_payload` dan `answer_key` pada tabel tunggal `questions`.
- **Tanpa Tabel Anak Relasional (`question_options`)**: 
  Kita meninggalkan pendekatan relasional murni 1-to-N untuk opsi agar terhindar dari kaku-nya skema tabel saat tipe soal dinamis bertambah.

## 2. Keunggulan
1. **Zero Join**: Pengambilan data soal beserta opsi & kunci jawaban cukup dengan 1 kali query `SELECT` pada tabel `questions`.
2. **Fleksibilitas Model Soal Dinamis**: Mendukung multiple choice, complex multiple choice, matching, matrix, dan short answer/essay tanpa perlu melakukan migrasi skema tabel berulang.
3. **Atomic Ingestion**: Proses import massal korpus soal (dari PDF, Pusmendik, Defantri) menjadi jauh lebih cepat dan sederhana.

## 3. Implementasi Skema & Validasi
- **Zod Schema**: Skema validasi ketat untuk payload soal dinamis telah diimplementasikan di:
  `src/lib/validations/question-payload.ts`
- Setiap mutasi atau penyimpanan data soal baru wajib melalui validasi skema ini di layer aplikasi (Server Actions / Service layer) untuk menjaga konsistensi struktur JSON di PostgreSQL.
