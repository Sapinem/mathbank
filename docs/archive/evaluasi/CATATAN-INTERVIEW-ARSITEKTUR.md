# Catatan Interview Arsitektur Data — MathBank

> **Asal:** sesi interview arsitektur (awalnya untuk QBank) → menjadi dasar desain
> MathBank. Keputusan final ada di `RIWAYAT-KEPUTUSAN.md`.

> **Tujuan:** Jejak keputusan lengkap dari sesi interview arsitektur dengan pemilik produk.
> **Tanggal:** 2026-09-29
> **Metode:** Tanya-jawab iteratif (12 putaran). Setiap keputusan disetujui pemilik produk.
> **Status:** Selesai — diratifikasi.

---

## Konteks Awal

Review arsitektur dimulai karena pemilik produk menemukan **"event" sudah ada tapi bercampur**
di halaman Sumber. Investigasi mengungkap **dua sistem sumber yang tidak tersinkron**:

| Sistem | Tabel | Baris | Status |
|---|---|---|---|
| Lama (dipakai) | `question_sources` | 16.913 | ✅ data nyata |
| Baru (dirancang) | `sources` | 7 | ⚠️ terisolasi |
| — | `exam_events`, `schools`, `categories`, `tags` | 0 | ⚠️ kosong (migrasi belum kelar) |

Pemilik produk menjelaskan: **data kosong itu karena migrasi belum kelar**, bukan belum dipakai.
Keputusan: **desain dari nol**, data lama dianggap tidak ada.

---

## Putaran 1 — Fondasi

| Pertanyaan | Jawaban Pemilik Produk |
|---|---|
| Sumber/wadah: tabel master atau teks+enum? | **Tabel**, tapi strukturnya beda per jenis (web=link, buku=banyak info, sekolah=banyak info) |
| Event sekolah (UTS/PAS)? | **Masuk Bundle** (bukan event) |
| Artikel/soal stimulus? | **Entitas sendiri** untuk banyak soal |

## Putaran 2 — Model Sumber

| Pertanyaan | Jawaban |
|---|---|
| Sekolah: sumber saja atau penyelenggara event? | **Hanya sumber**, tidak punya event institution |
| Pola B (tabel anak) vs JSONB? | **Pola B** (setuju setelah lihat tradeoff) |
| Jenis sumber lain? | Belum ada; mudah ditambah nanti |

## Putaran 3 — Detail Sumber

| Pertanyaan | Jawaban |
|---|---|
| Sekolah: JSON atau tabel anak? | Setuju **tabel anak** (`institutions`) |
| Buku? | **Ditabelkan** juga (`books`) |
| Tag masih perlu? | **Dipertahankan** sebagai label sekunder |

## Putaran 4 — Event & Asal

| Pertanyaan | Jawaban |
|---|---|
| Buku & sekolah sama-sama tabel anak? | **Ya** (opsi A) |
| UTS/PAS = Bundle tanpa event? | **Setuju** |

## Putaran 5 — Provenance & Statistik

| Pertanyaan | Jawaban |
|---|---|
| Soal dipakai >1 naskah — relasinya? | **Many-to-many**, seperti category/tag WordPress; butuh statistik |
| `passages` vs stimulus? | Lebih suka **konsep stimulus** |
| Bundle punya `source_id`/`event_id`? | **`source_id` milik bundle, `event_id` milik soal** |
| Verifikasi/pemakaian soal? | Kaitan dengan **relasi M:N** |
| Ingest hasilnya? | **Bundle dan soal** (soal dalam bundle) |
| Fork naskah? | **Pending** (konsep belum jelas) |

## Putaran 6 — Stimulus & Edit

| Pertanyaan | Jawaban |
|---|---|
| Aturan stimulus (5 pertanyaan teknis) | **Sesuai saran** |
| Satu soal = satu baris per bundle? | Sesuai saran |
| **Edit soal yang sudah dipakai naskah?** | **Edit langsung** (live) |
| Topics pindah induk? | **Boleh** |
| Cache count topics/tags? | **Ya** |
| `is_flagged` cukup? | Cek dulu → ternyata **dipakai luas** (fitur kurasi "Perlu Revisi") → **pertahankan** |
| Aset RESTRICT saat dipakai? | **Ya** |

## Putaran 7 — Status, Kepemilikan, Dedup

| Pertanyaan | Jawaban |
|---|---|
| Soal hasil ingest → status? | **Draft** |
| AI tagging selesai → status? | **Review** (nanti ganti nama jadi **AI Enrichment**) |
| `is_flagged=true` boleh `ready`? | **Tidak** — flagged wajib `review` (sesuai saran) |
| Kepemilikan data? | **`owner_id` saja** (tanpa multi-tenant penuh) |
| Dedup & varian? | **Setuju** 3 tingkat (hash → embedding → varian) |
| Idempotensi ingest? | **Setuju** (hash dokumen) |

## Putaran 8 — Taksonomi, Ekspor, MCP

| Pertanyaan | Jawaban |
|---|---|
| Grade/Bloom/kesulitan di yml atau DB? | **Simpan di DB** |
| Kurikulum (Merdeka/K13)? | **Tidak perlu** |
| **Mapel?** | **Hanya Matematika** — tak perlu `subjects` |
| Cloze/tipe khusus? | **Nice to have** |
| Riwayat taksonomi? | `config_audit_logs` **cukup** |
| Interval re-audit soal? | **Boleh** (`last_reviewed_at`) |
| Statistik jawaban siswa? | **Belum perlu** |
| Integrasi API eksternal? | **Belum perlu** |

## Putaran 9 — Admin & Pencarian

| Pertanyaan | Jawaban |
|---|---|
| UI admin taksonomi? | **Ya, ada UI admin** |
| Siapa kelola topics? | **User bisa nambah** |
| Seeder taksonomi? | **Siapkan di migrasi** |
| Index vector? | (belum paham → dijelaskan → **HNSW**, sudah ada di sistem lama) |
| Notifikasi/kolaborasi? | **Tidak perlu** |
| Cegah siklus topik? | **Tidak boleh** (cegah) |
| Slug collision? | **Sepakat** (tangani) |
| Hard-delete? | **Hanya admin** yang boleh |
| Full-text search? | **Pakai juga** — ternyata **sudah ada** (trigram+vector+hybrid RRF) → **pertahankan** |

## Putaran 10 — Keamanan & Integritas

| Pertanyaan | Jawaban |
|---|---|
| Stimulus bersarang/kedalaman? | **Tidak bisa — hanya 1 level** |
| Bundle dihapus → soal? | **Sesuai saran** (soal tetap, RESTRICT) |
| `embedding_hash` overkill? | **Hash untuk dokumen** saja; per-soal → **timestamp** |
| Definisi hash? | **Dokumen sumber saja**; soal pakai **timestamp** |
| Concurrency edit? | **Nice to have** |
| Ingest schema (retry/stuck)? | **Nanti dulu** |
| Retensi soft-delete? | **Sesuai saran** |
| `ready` wajib `answer_key`? | **Tidak diblokir, tapi tetap bisa dipilih** |
| Strategi migrasi 16.913? | **Nanti dulu** |
| `payload_version`? | **OK** |
| Kelengkapan audit? | **Sesuai saran** |
| Konsistensi nama? | **Sesuai saran** |

## Putaran 11 — Alur & Ekspor

| Pertanyaan | Jawaban |
|---|---|
| Soal wajib lintas naskah? | **Tidak dulu** |
| Event sekali vs berulang? | **Sesuai saran** (tahun di soal, bukan entitas) |
| Alur ingest → bank soal? | **Langsung** (masuk bank soal) |
| Judul soal? | **Cuplikan konten saja** |
| Statistik soal unik? | Sesuai saran |
| PDF & edit-live? | **Sesuai saran** → **peringatan** (bukan snapshot) |
| Ingest parsial? | **Pending** |
| Ukuran vektor? | **Sudah pakai & cocok** (1024) |

## Putaran 12 — Finalisasi

| Pertanyaan | Jawaban |
|---|---|
| `bundles.origin` (ingest/manual) | ✅ Ditambahkan |
| Validasi `grade` terhadap daftar | ✅ Ditambahkan |
| Rapikan dokumen + catat interview | **Ya** |

---

## Keputusan Rangkuman (semua yang mengikat)

1. **Desain dari nol** — data lama diabaikan; kosong = migrasi belum kelar.
2. **Asal soal = 2 kolom**: `source_id` (wadah) + `event_id` (even asli).
3. **Sumber = Pola B**: `sources` + anak `books` & `institutions` (bukan JSONB).
4. **Web** cukup kolom `url` di `sources`.
5. **Event** = berskala saja (UTBK/OSN/SBMPTN), **tanpa tahun** (tahun di soal).
6. **UTS/PAS = Bundle** (type='exam'), **bukan** event.
7. **Event sekolah tak ada** — sekolah hanya sumber.
8. **Materi = `topics`** 3-level (Kategori›Topik›SubTopik), M:N, 1 utama.
9. **Bacaan = stimulus** (`questions.parent_id`) — **bukan** tabel `passages`. **Hanya 1 level.**
10. **Tag** dipertahankan sebagai label sekunder.
11. **Embedding** 1 tempat (inline), index **HNSW**.
12. **`question_sources` dihapus** — inti pembersihan.
13. **Soal ↔ Naskah M:N** (`bundle_items` + `role`), pola WordPress.
14. **Edit soal = live** (naskah ikut berubah) + **peringatan** bila sudah dicetak.
15. **Bundle**: hanya `source_id`, **plus `origin`** (ingest/manual).
16. **Ingest → bundle berisi soal**, **langsung masuk bank soal**.
17. **Fork naskah** = PENDING.
18. **`is_flagged` + `flag_notes` dipertahankan** (fitur kurasi).
19. **Taksonomi (grade/Bloom/kesulitan) → DB** (seed dari `curriculum.yaml`), **dengan UI admin**.
20. **User bisa menambah topics.**
21. **Hanya Matematika** — tak perlu `subjects`.
22. **Kurikulum (Merdeka/K13)** tak perlu.
23. **STATUS soal**: ingest→`draft`; **AI Enrichment** selesai→`review`; flagged tak boleh `ready`.
24. **Kepemilikan: `owner_id`** saja (tanpa multi-tenant penuh).
25. **Dedup 3 tingkat** (hash dokumen → embedding similarity → varian) + **idempotensi ingest**.
26. **`embedding_hash` → ganti dengan timestamp** (`embedded_at` + konten berubah).
27. **Cegah siklus** di `topics.parent_id` **dan** `questions.parent_id`.
28. **Hard-delete hanya admin**; soft-delete dengan retensi.
29. **Search**: trigram + vector + hybrid (RRF) — **sudah ada, pertahankan**.
30. **PDF**: peringatan bila naskah berubah setelah cetak (bukan snapshot).
31. **`last_reviewed_at`** untuk re-audit soal (nice-to-have).
32. **`payload_version`** untuk jsonb (nice-to-have).
33. **`ready` boleh tanpa `answer_key`** (tidak diblokir).
34. **Concurrency edit** — nice to have.
35. **Ingest retry/stuck & parsial** — pending.
36. **Statistik jawaban siswa & integrasi API** — belum perlu.

---

## Temuan Penting (yang SUDAH ADA — jangan dibuang)

| Temuan | Lokasi | Status |
|---|---|---|
| **Taksonomi kurikulum** | `config/curriculum.yaml` (16 grade, 5 kesulitan, 6 Bloom C1-C6 + kata kerja operasional) | → pindah ke DB + seed |
| **Ekspor Moodle** | `src/lib/services/moodle/` (GitSync, XML, quiz-package) | ✅ sudah lengkap |
| **Deteksi duplikat** | `src/lib/search/dedup.ts` (0.98 master / 0.85 near) | ✅ sudah ada |
| **Hybrid search** | `src/lib/search/rrf.ts` (Reciprocal Rank Fusion) | ✅ sudah ada |
| **Metrics pencarian** | `src/lib/search/metrics.ts` (p95/p99) | ✅ sudah ada |
| **Index HNSW vektor** | `question_embeddings` (sistem lama) | → pindah ke `questions` |
| **MCP tulis** | `create_question`, `bulk_create_questions`, `register_diagram_asset` | ✅ sudah ada |
| **Validator ingest** | `validator-service.ts` (distribusi kesulitan & Bloom) | ✅ sudah ada |
| **`is_flagged` kurasi** | 7 skenario otomatis (~30 file) | ✅ sudah ada, dipertahankan |

---

*Catatan ini adalah jejak keputusan resmi. Bila ada keputusan baru, tambahkan putaran baru
di atas rangkuman, dan perbarui dokumen `ARSITEKTUR-DATA-FINAL.md`.*
