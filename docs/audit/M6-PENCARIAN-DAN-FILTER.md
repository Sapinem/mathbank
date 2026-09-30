# AUDIT MILESTONE 6 — PENCARIAN & FILTER (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED** (Selesai 100%)  
**Target:** Mesin Filter & Pencarian Soal — Pembangun Query Filter (`question/filters.ts`), Pencarian Trigram (`pg_trgm`), Hibrida RRF (Reciprocal Rank Fusion) & Deduplikasi (`fusion.ts`).

---

## 1. Ringkasan Ruang Lingkup Milestone 6

Milestone 6 berfokus pada mesin pencarian dan penyaringan butir soal matematika yang presisi, cepat, serta toleran terhadap kesalahan ketik (*typo-tolerant*):

1. **Modular Query Filter Builder (`src/lib/question/filters.ts`):**
   * Meng-encapsulate seluruh logika penyaringan SQL (`status`, `questionType`, `grade`, `difficulty`, `cognitiveLevel`, `sourceId`, `eventId`, `flagged`).
   * **Penyaringan Topik Rekursif (`collectTopicDescendants`):** Memilih satu topik induk (Level 1 atau Level 2) secara otomatis mencakup seluruh soal yang terikat pada anak-anak sub-topiknya via kueri BFS/rekursif.
2. **Pencarian Trigram & Typo-Tolerant (`pg_trgm`):**
   * Menggunakan kombinasi kueri `word_similarity` (% operator) dan `ILIKE` pada `contentMarkdown` untuk memastikan pencarian substring maupun kesalahan eja tetap menghasilkan kandidat soal yang relevan.
3. **Penggabungan Hibrida RRF & Deduplikasi (`src/lib/search/fusion.ts`):**
   * **Reciprocal Rank Fusion (RRF):** Algoritma murni teruji (`rrfFuse`) dengan konstanta $k=60$ untuk menggabungkan peringkat dari beberapa mesin pencari (teks/trigram + vektor semantik di M10) tanpa terpengaruh perbedaan skala skor.
   * **Deduplikasi Otomatis (`dedup`):** Menggunakan token kemiripan Jaccard (`similarity`) dengan ambang batas *Exact* ($0.98$) dan *Near Duplicate* ($0.85$) untuk membuang kandidat soal yang identik/hampir mirip dari hasil pencarian.

---

## 2. Matriks Target vs Realisasi M6

| Fitur / Komponen | Target Spesifikasi (M6) | Realisasi Kode (`src/`) | Verdict |
| :--- | :--- | :--- | :---: |
| **Filter Builder Modular** | `buildQuestionFilter` di `filters.ts` | `src/lib/question/filters.ts` | ✅ Lulus |
| **Topik Filter Rekursif** | Mengikutsertakan anak sub-topik otomatis | `collectTopicDescendants()` di `filters.ts` | ✅ Lulus |
| **Pencarian Trigram** | `pg_trgm` typo-tolerant search | `sql` % operator pada `contentMarkdown` | ✅ Lulus |
| **Algoritma RRF Fusion** | Reciprocal Rank Fusion ($k=60$) | `rrfFuse()` di `src/lib/search/fusion.ts` | ✅ Lulus |
| **Deduplikasi Hasil** | Jaccard Similarity ($0.98$ exact / $0.85$ near) | `dedup()` di `src/lib/search/fusion.ts` | ✅ Lulus |
| **Pengujian Unit Fusion** | Test suite terisolasi tanpa dependensi DB | `src/lib/search/fusion.test.ts` (Passed) | ✅ Lulus |
| **URL State Synchronization** | Filter tersimpan di URL params | `useQuestions` Hook & Next.js searchParams | ✅ Lulus |

---

## 3. Review Komparasi vs QBank (M6 Pencarian & Filter)

| Dimensi | QBank (Sistem Lama) | MathBank (Sistem Baru) | Keunggulan MathBank |
| :--- | :--- | :--- | :--- |
| **Filter Topik Anak** | Hanya mencocokkan ID topik yang dipilih secara persis. | **BFS Recursive Collector (`collectTopicDescendants`)**. | Pengguna yang memilih Kategori "Aljabar" otomatis mendapatkan soal dari Sub-Topik "Persamaan Kuadrat". |
| **Penggabungan Hasil** | Penggabungan skor manual yang rentan bias skala. | **Standardized RRF Fusion ($k=60$)**. | Memberikan bobot peringkat yang seimbang antar-mesin pencari. |
| **Deteksi Duplikat** | Tidak ada deduplikasi hasil kueri. | **Jaccard Token Similarity Dedup ($0.85$)**. | Mencegah tampilan hasil pencarian yang dipenuhi oleh soal yang nyaris sama. |

---

## 4. Rekomendasi Enterprise (M6)

1. **Evaluasi Performa `EXPLAIN ANALYZE`:** Saat jumlah soal berkembang di atas 100.000+ butir, verifikasi bahwa index `idx_questions_content_trgm` GIN digunakan secara optimal oleh optimizer PostgreSQL.
2. **Search Term Highlighting:** Di antarmuka UI daftar soal, tambahkan fitur penyorot kata kunci (*text highlight*) pada cuplikan soal yang cocok dengan kueri pencarian pengguna.

---

## 📄 KESIMPULAN MILESTONE 6

**MILESTONE 6 (PENCARIAN & FILTER) TELAH DIVERIFIKASI LULUS 100%. ALGORITMA RRF FUSION, DEDUPLIKASI JACCARD, SERTA FILTER TOPIK REKURSIF MATHBANK BERJALAN SESUAI STANDAR MUTU.**
