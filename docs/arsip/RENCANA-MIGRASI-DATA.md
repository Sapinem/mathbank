# Rencana Migrasi Arsitektur Data QBank v2

> 📦 **ARSIP — DIBATALKAN.**
> Migrasi data QBank **dibatalkan** (PRD §Non-Goals; ADR-0001: bangun dari nol, tanpa data lama).
> Disimpan sebagai referensi historis / pelajaran saja.

> **Status:** DRAFT — menunggu ratifikasi sebelum eksekusi.
> **Prasyarat:** `docs/ARSITEKTUR-DATA-FINAL.md` sudah disetujui.
> **Prinsip:** Aman, bertahap, dapat dibalik (rollback) di tiap langkah.

---

## 0. Prinsip Migrasi

1. **Backup dulu, tanya kemudian** — snapshot DB penuh sebelum menyentuh apa pun.
2. **Bertahap** — tiap fase bisa di-pause & diverifikasi.
3. **Dapat dibalik** — tiap fase punya rencana rollback.
4. **Tak hapus sebelum yakin** — tabel lama di-`RENAME`, bukan `DROP`, sampai fase akhir.
5. **Data hilang = data hilang** — 16.913 baris `question_sources` adalah harta; jangan sentuh sebelum punya pemetaan.

---

## 1. Ringkasan Perubahan

| Dari | Ke | Baris data |
|------|----|-----------|
| `question_sources` (teks bebas) | `questions.source_id` + `questions.event_id` | 16.913 |
| `sources` (7, terisolasi) | `sources` + `books`/`institutions` | 7 |
| `schools` (kosong) | `institutions` | 0 |
| `exam_events` (kosong) | `events` | 0 |
| `categories` (kosong) + `category_id` | `topics` + `question_topics` | 0 (+2.493 referensi) |
| `question_embeddings` (kosong) | `questions.embedding` (inline) | 0 |
| `config/curriculum.yaml` | tabel `grades`/`difficulty_levels`/`cognitive_levels` | seed |
| `bundles` (kolom bercabang) | `bundles` + `origin` + `bundle_items.role` | 752 |
| `tags`/`question_tags` (kosong) | tetap | 0 |

---

## 2. Fase Migrasi

### FASE 0 — Persiapan & Keamanan 🔒

**Tujuan:** titik pulih yang pasti.

- [ ] **Backup penuh** DB: `pg_dump --format=custom` → simpan ke lokasi aman + luar mesin
- [ ] Verifikasi backup **bisa di-restore** ke DB sementara (jangan langsung percaya)
- [ ] Catat **checksum** backup
- [ ] Bekukan penulisan (mode maintenance) selama migrasi inti
- [ ] Siapkan **DB staging** (clone) untuk uji coba semuanya lebih dulu

**Rollback:** tak ada (belum ada perubahan).

---

### FASE 1 — Seed Taksonomi (aman, independen) 🌱

**Tujuan:** pindahkan `config/curriculum.yaml` → tabel referensi. **Tak menyentuh data lama.**

- [ ] Buat tabel `grades`, `difficulty_levels`, `cognitive_levels` (§2.2 final)
- [ ] Tulis seeder: baca `curriculum.yaml` → insert (idempotent: `ON CONFLICT DO UPDATE`)
- [ ] Verifikasi: 16 grade, 5 difficulty, 6 cognitive — cocok dengan yaml
- [ ] Tabel kosong → tanpa risiko

**Rollback:** `DROP TABLE` 3 tabel baru. Tak ada data hilang.

---

### FASE 2 — Skema Baru (paralel, tanpa sentuh lama) 🏗️

**Tujuan:** buat **semua** tabel baru di samping yang lama. Aplikasi **masih pakai yang lama.**

- [ ] Buat tabel baru: `topics`, `tags` (baru), `sources` (baru), `books`, `institutions`, `events`, `questions` (baru), `question_topics`, `question_tags`, `solutions`, `bundles` (baru), `bundle_items`, `media_assets`, `question_media`
- [ ] Pasang semua index (termasuk HNSW vektor, trgm)
- [ ] Pasang constraint (CHECK difficulty, flag×status, cegah siklus)
- [ ] **Nama sementara** untuk hindari bentrok: mis. `v2_questions`, `v2_bundles` (atau schema terpisah `qbank_v2`)
- [ ] Verifikasi: `\dt` menunjukkan semua tabel baru ada, kosong

**Rollback:** drop semua tabel v2. Aplikasi tak terdampak.

> **Catatan:** gunakan **schema terpisah** (`qbank_v2`) untuk kebersihan — lebih mudah
> dibanding menamai ulang puluhan tabel.

---

### FASE 3 — Migrasi Entitas Asal-usul (paling berisiko) ⚠️

**Tujuan:** ubah 16.913 teks bebas `question_sources` → `sources`/`events` terstruktur.

**Ini bagian tersulit & paling berisiko.** Strategi:

- [ ] **Analisis dulu:** kumpulkan **nilai unik** dari `question_sources` (`event_name`, `institution_or_school`, `publisher/book`) → berapa banyak? seberapa kotor?
- [ ] **Bangun kamus pemetaan** (mapping table):
  - Nama kotor → entitas bersih (mis. "osn 2019", "OSN 2019", "Olimpiade Sains 2019" → event "OSN")
  - Gunakan **`aliases`** di events + **normalisasi teks** (lowercase, strip)
- [ ] **Auto-match** yang jelas → entitas yang sudah ada/baru
- [ ] **Sisanya (tak jelas) → `sources` kind='website'** dengan label asli (jangan buang!)
- [ ] Isi `questions.source_id` / `event_id` dari pemetaan
- [ ] **Lapor:** berapa berhasil di-map, berapa jadi "teks mentah", berapa gagal
- [ ] **Review manual** oleh pemilik produk untuk yang tak jelas

**Rollback:** `questions.source_id`/`event_id` di-null-kan; `question_sources` **utuh** (belum dihapus).

> **🔴 Risiko:** pemetaan otomatis bisa salah. **Wajib** ada tahap review.
> Jangan pernah `DROP question_sources` sampai pemilik produk menyetujui hasilnya.

---

### FASE 4 — Migrasi Naskah & Soal 📚

- [ ] Pindahkan `bundles` lama (752) → `bundles` baru
  - Deteksi `bundle_type` (source/exam) dari kolom lama
  - Set `origin` = 'manual' (asumsi; impor lama → 'ingest' bila bisa dideteksi)
  - `source_id` dari bundle lama
- [ ] Pindahkan relasi bundle ↔ soal → `bundle_items`
  - Set `role`: 'origin' (soal asli) atau 'member'
  - Pertahankan `order_index` & `section_name`
- [ ] Pindahkan soal (`question_items`, 15.986) → `questions` baru
  - Map `category_id` → `question_topics` (isi dari `categories` lama)
  - Map `tags` → `question_tags`
  - Pindahkan `embedding` inline (dari kolom lama, bila ada)
  - Set `owner_id`/`author_id` dari kolom lama
- [ ] Verifikasi: jumlah baris cocok (15.986 soal, 752 bundle)

**Rollback:** tabel v2 di-truncate; tabel lama utuh.

---

### FASE 5 — Hitung Ulang Derivatif 🔄

- [ ] Hitung `usage_count` + `last_used_at` untuk tiap soal (dari `bundle_items`)
- [ ] Hitung `topics.usage_count` + `tags.usage_count`
- [ ] Re-embed **hanya yang perlu** (`embedded_at` null atau `updated_at` > `embedded_at`)
- [ ] Verifikasi spot-check: beberapa soal punya embedding & statistik benar

**Rollback:** null-kan kolom derivatif; hitung ulang tak merusak data inti.

---

### FASE 6 — Alihkan Aplikasi (cutover) 🔀

- [ ] Ubah kode aplikasi membaca tabel **v2** (atau pindahkan v2 → nama lama)
- [ ] Jalankan **suite tes penuh** (`npm test`)
- [ ] Uji manual alur kritis: eksplorer, review, paket soal, ingests, ekspor Moodle
- [ ] **Fase observasi** (mis. 1 minggu): pakai v2, tabel lama tetap ada sebagai jaring pengaman

**Rollback:** kembalikan kode ke tabel lama (cepat, karena lama masih utuh).

---

### FASE 7 — Bersihkan (setelah yakin) 🧹

**Hanya setelah observasi sukses dari pemilik produk.**

- [ ] Rename tabel lama → `_deprecated_*` (jangan langsung drop)
- [ ] Tunggu 1 periode lagi
- [ ] `DROP` tabel `_deprecated_*`
- [ ] Bersihkan kode mati (service/API yang menunjuk tabel lama)

**Rollback:** pada tahap rename masih bisa dibalik; setelah drop, hanya dari backup.

---

## 3. Urutan Aman (ringkas)

```
FASE 0  Backup ────────────────────────────── 🔒 (gerbang: wajib)
FASE 1  Seed taksonomi ────────────────────── 🌱 aman
FASE 2  Skema baru (paralel) ──────────────── 🏗️ aman
FASE 3  Migrasi asal-usul ─────────────────── ⚠️ BERISIKO (review wajib)
FASE 4  Migrasi naskah & soal ─────────────── 📚 sedang
FASE 5  Hitung derivatif ──────────────────── 🔄 sedang
FASE 6  Cutover aplikasi ──────────────────── 🔀 gerbang: uji penuh
FASE 7  Bersihkan ─────────────────────────── 🧹 gerbang: observasi
```

---

## 4. Yang Perlu Diputuskan Sebelum Eksekusi

1. **Strategi pemetaan asal-usul (Fase 3):** otomatis (by nama+alias) lalu review manual? Atau sepenuhnya manual?
2. **Schema terpisah vs nama tabel baru?** (saran saya: **schema `qbank_v2`**)
3. **Mode maintenance:** boleh matikan aplikasi sementara selama migrasi inti?
4. **Waktu observasi:** berapa lama tabel lama dipertahankan sebelum dibersihkan?
5. **Siapa yang review** pemetaan asal-usul? (pemilik produk, atau bisa diwakilkan?)

---

## 5. Perkiraan Dampak

| Aspek | Dampak |
|-------|--------|
| **Tabel baru** | ~15 + 3 taksonomi = 18 |
| **Tabel lama dibuang** | `question_sources`, `schools`, `exam_events`, `categories`, `question_embeddings`, `sources`(lama) |
| **Baris dipindah** | ~16.913 (asal) + 15.986 (soal) + 752 (bundle) |
| **File kode terdampak** | banyak (schema, service, API, hooks, MCP) — perlu inventaris |
| **Risiko utama** | pemetaan teks→entitas (Fase 3) |
| **Titik tak bisa dibalik** | Fase 7 (drop) |

---

*Dokumen ini rencana, bukan instruksi. Setiap fase menunggu persetujuan pemilik
produk sebelum dijalankan.*
