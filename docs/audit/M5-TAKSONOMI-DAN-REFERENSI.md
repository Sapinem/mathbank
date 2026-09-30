# AUDIT MILESTONE 5 — TAKSONOMI & REFERENSI (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED** (Selesai 100%) — **✅ DIVERIFIKASI ULANG &
DIPERBAIKI 2026-09-30** (lihat `docs/VERIFIKASI-AUDIT-M5.md`: T-M5-1/T-M5-2/T-M5-3)  
**Target:** Manajemen Referensi Taksonomi — Pohon Topik 3-Level (`topic-service.ts`), Sumber & Asal (`sources`), Event & Subtes (`events`), Label/Tags (`tags`), Anti-Siklus, dan RESTRICT Constraints.

---

## 1. Ringkasan Ruang Lingkup Milestone 5

Milestone 5 menangani struktur referensi taksonomi dan meta-data yang mengorganisir bank soal matematika:

1. **Service Pohon Topik 3-Level (`topic-service.ts`):**
   * Struktur 3-Level eksplisit: **Kategori** (Level 1) ➔ **Topik** (Level 2) ➔ **SubTopik** (Level 3).
   * **Anti-Siklus (Cycle Protection):** Mencegah relasi melingkar (misal topik A menjadi induk dari A sendiri atau keturunannya) yang dihitung secara in-memory snapshot (`isSelfOrDescendantFrom`) sebelum disimpan ke DB.
   * Restriksi Kedalaman: Maksimal 3 level (`resolveLevelFrom`); percobaan membuat level 4 ditolak dengan error 409 (`ConflictError`).
2. **Service Referensi & Taksonomi (`taxonomy-service.ts`):**
   * **Sumber & Asal (`sources`):** Mengelola asal-usul fisik soal (Buku, Website, Sekolah, Kompetisi).
   * **Event & Peristiwa (`events`):** Mengelola ajang ujian resmi (UTBK, OSN, SBMPTN) lengkap dengan alias dan subtes.
   * **Label (`tags`):** Mengelola kata kunci sekunder dengan penghitung penggunaan (`usage_count`) otomatis via DB Trigger.
3. **Pemberitahuan RESTRICT yang Ramah Pengguna:**
   * Penghapusan entitas referensi yang sedang terikat pada soal (FK RESTRICT) ditangkap oleh `wrapRoute` dan ditampilkan sebagai pesan error yang jelas pada Dialog UI.

---

## 2. Matriks Target vs Realisasi M5

| Fitur / Komponen | Target Spesifikasi (M5) | Realisasi Kode (`src/`) | Verdict |
| :--- | :--- | :--- | :---: |
| **Service Topik 3-Level** | `topic-service.ts` (Level 1..3, Anti-Siklus, Tree Builder) | `src/lib/services/topic-service.ts` | ✅ Lulus |
| **Service Referensi** | `taxonomy-service.ts` (Sources, Events, Tags) | `src/lib/services/taxonomy-service.ts` | ✅ Lulus |
| **API CRUD Referensi** | `/api/topics`, `/api/sources`, `/api/events`, `/api/tags` | `/src/app/api/topics/*`, `/sources/*`, `/events/*`, `/tags/*` | ✅ Lulus |
| **UI Pohon Topik** | Pohon 3-Level visual + Dialog Tambah/Edit/Hapus | `src/components/reference/topics-view.tsx` | ✅ Lulus |
| **UI Sumber & Asal** | Kelola buku, sekolah, website & filter kind | `src/components/reference/sources-view.tsx` | ✅ Lulus |
| **UI Event Ujian** | Kelola UTBK/OSN + subtes & alias | `src/components/reference/events-view.tsx` | ✅ Lulus |
| **UI Label & Tags** | Kelola tag sekunder + indikator `usage_count` | `src/components/reference/labels-view.tsx` | ✅ Lulus |
| **DB Integration Tests** | Test suite terisolasi untuk Topik & Taksonomi | `topic-service.db.test.ts` & `taxonomy-service.db.test.ts` | ✅ Lulus |

---

## 3. Review Komparasi vs QBank (M5 Referensi & Taksonomi)

| Dimensi | QBank (Sistem Lama) | MathBank (Sistem Baru) | Keunggulan MathBank |
| :--- | :--- | :--- | :--- |
| **Penyebutan Taksonomi** | Menggunakan istilah umum `categories`. | Menggunakan istilah yang presisi **Topik** (`topics`). | Lebih menggambarkan bidang studi Matematika. |
| **Restriksi Siklus Pohon** | Hanya mengandalkan DB FK biasa. | **Validation Layer In-Memory (`isSelfOrDescendantFrom`) + DB Trigger**. | Mencegah corrupt data sebelum kueri `UPDATE` dikirim ke DB. |
| **Manajemen Tagging** | Tag sering tidak terhitung pengunaannya. | Trigger DB otomatis memperbarui `usage_count` pada `tags`. | Memudahkan pembersihan tag tak terpakai (`/api/tags/clean-unused`). |

---

## 4. Rekomendasi Enterprise (M5)

1. **Audit Merge Tag Sekunder:** Ketika dua tag digabungkan (misal: "geometri" dan "geometri-bidang"), sediakan API konsolidasi otomatis untuk memperbarui relasi `question_tags` tanpa merusak riwayat audit.
2. **Visual Re-ordering (Drag-and-Drop Order):** Untuk urutan Topik pada Level 1 & Level 2, pertimbangkan penambahan fitur pengurutan visual (`sort_order`) berbasis DND pada rilis mendatang.

---

## 📄 KESIMPULAN MILESTONE 5

**MILESTONE 5 (TAKSONOMI & REFERENSI) TELAH DIREVIEW SECARA LENGKAP 100%. METODE PENCEGAHAN SIKLUS (ANTI-CYCLE), BATAS KEDALAMAN 3-LEVEL, SERTA ANTARMUKA MANAJEMEN REFERENSI TELAH BERJALAN SESUAI STANDAR MUTU MATHBANK.**

---

## 📝 CATATAN VERIFIKASI (2026-09-30)

**Verifikator:** agen pembangun (MathBank) · **Metode:** cek kode + uji HTTP lewat-route.

**Status: ✅ TERVERIFIKASI + DIPERBAIKI.** Struktur 3-level, anti-siklus, batas
kedalaman, 14 endpoint CRUD, UI 4 view, trigger `usage_count` — **akurat**. Temuan:
- **T-M5-1:** audit `updateTopic` salah label (`action:"create"`/"Topik dibuat") →
  diperbaiki ke `"update"`/"Topik diperbarui".
- **T-M5-2 (integritas data):** re-parent topik **tidak** mempropagasi `level` ke subtree
  (`level` = kolom tersimpan) → diperbaiki: seluruh subtree `level += delta` dalam transaksi.
- **T-M5-3:** klaim `/api/tags/clean-unused` **palsu** (405) → ditambah service + route.

Pelajaran → `CONSTRAINTS.md` #38–39. Detail: `docs/VERIFIKASI-AUDIT-M5.md`.
