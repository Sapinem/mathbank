# PRD — MathBank (Product Requirements Document)

> **Dokumen ini menjawab:** *Apa yang dibangun, untuk siapa, dan mengapa?*
> **Bukan** dokumen teknis (itu di `DESAIN-PER-LAPISAN-MATHBANK.md` & `ARSITEKTUR-SISTEM-FULL.md`)
> atau rencana eksekusi (itu di `MILESTONE.md`).
> **Status:** 📝 **Draft v1** — menunggu ratifikasi pemilik produk.
> **Versi:** 1.0 · **Tanggal:** 2026-09-29

---

## 1. Ringkasan

**MathBank** adalah **bank soal matematika** — sistem kanonik untuk mengurasi, menyusun, dan menerbitkan naskah soal. Ia **menggantikan QBank** (QBank pensiun).

Dibangun **dari nol** ("kanvas putih bersih") dengan stack modern (Next.js 16 + React 19 + PostgreSQL 18 + Drizzle), menerapkan **9 lapisan desain** yang sudah dikunci (L1–L9).

> **Motto kerja:** *Zero kompromi kualitas* — 0 `@ts-ignore`, 0 `eslint-disable`, 0 kode mati. Gate: `pnpm check` hijau.

---

## 2. Latar Belakang

### Mengapa MathBank, bukan lanjut QBank?

QBank punya masalah arsitektur mendasar (dari review mendalam):

| Masalah | Bukti |
|---------|-------|
| **Dua sistem sumber tak sinkron** | `question_sources` (16.913) vs `sources`/`schools`/`exam_events` (kosong) |
| **Kode mati** | `question-fsm.ts` (263 baris) tak dipakai sama sekali |
| **Aturan izin tersebar** | di 42 file; tak ada satu "siapa boleh apa" |
| **Boilerplate API** | tertulis ulang di 39 dari 52 route |
| **God Object** | `question-service.ts` 1010 baris, 14 method |
| **Melanggar CONSTRAINT sendiri** | larangan `useMemo`/`useCallback` dilanggar (17×) |
| **Duplikasi embedding** | inline + tabel terpisah |

**Keputusan pemilik produk:** *"Kalau bikin baru kan bener2 bebas gak ada beban. Kalau ada yang sudah bagus dari sana tinggal kita copy saja."*

➡️ **Bangun MathBank dari nol**, salin hanya yang bagus. Migrasi data QBank **dibatalkan**.

---

## 3. Pengguna & Peran

**Pengguna utama:** guru matematika & kurator di **satu institusi** (skala **<100 user**).

Peran (dari **L1** — terkunci):

| Peran | Boleh |
|-------|-------|
| **admin** | Akses penuh; hard-delete; semua operasi |
| **teacher** | Buat/edit soal sendiri; hard-delete soal sendiri; kelola taksonomi sendiri |
| **reviewer** | Guru senior; boleh set status `ready`; kelola taksonomi sendiri |
| **agent** | Agen AI via MCP; izin terbatas (buat soal/aset, cari, enrichment) |
| **machine** | Pipeline batch (ingest) via endpoint khusus |

**Multi-role** — satu akun bisa punya beberapa peran (izin = gabungan). *worker* (enrichment/embedding) = proses internal, bukan aktor.

---

## 4. Masalah yang Diselesaikan

1. **Soal berserakan & sulit dicari** → bank soal terpusat dengan pencarian kuat (fuzzy + semantik + filter).
2. **Provenance tak jelas** (soal dari mana, event apa) → model `source_id` + `event_id` eksplisit.
3. **Taksonomi tak rapi** (kategori/subtopik campur) → topik 3-level terkelola.
4. **Menyusun naskah lambat** → susun paket dari bank soal, ekspor cepat.
5. **Kerja manual berulang** (ingest soal dari PDF) → ingest otomatis (fase lanjut).
6. **Kualitas soal tak terkontrol** → status FSM + flag kurasi + dedup.

---

## 5. Tujuan (Goals)

- **G1** — Bank soal matematika yang bersih, terstruktur, mudah dikurasi.
- **G2** — Guru dapat: **cari soal → susun paket → ekspor** tanpa gesekan.
- **G3** — Pencarian kuat: filter (topik/sumber/event/status) + fuzzy + semantik.
- **G4** — Alur ingest PDF → soal berjalan (fase setelah MVP).
- **G5** — AI enrichment (tagging, embedding) terintegrasi, dengan izin terkendali.
- **G6** — Agen AI dapat beroperasi via MCP.
- **G7** — Zero technical debt (gate kualitas hijau).

### Non-Goals (sengaja TIDAK dikerjakan, minimal di v1)

- ❌ Multi-mata-pelajaran (hanya **Matematika**).
- ❌ Multi-sekolah / SaaS / multi-tenant (satu institusi).
- ❌ Manajemen siswa, nilai, atau analitik jawaban siswa.
- ❌ Kurikulum Merdeka/K13 sebagai dimensi (tak perlu).
- ❌ Fork naskah (`forked_from_bundle_id`) — pending, konsep belum final.
- ❌ Migrasi data QBank (dibatalkan; impor selektif mungkin nanti).

---

## 6. Ruang Lingkup MVP

**Prinsip:** MVP = **alur kerja tuntas** — *cari soal → susun paket → ekspor* — meski sederhana.

### ✅ Termasuk MVP

| Area | Fitur |
|------|-------|
| **Bank Soal** | Buat · edit · hapus (soft + hard) · lihat detail |
| **Pencarian** | Cari teks (fuzzy trigram) · filter (topik, sumber, event, status, grade) |
| **Struktur soal** | Tipe soal, stimulus (parent), opsi, kunci jawaban, solusi |
| **Taksonomi** | Topik 3-level · grade/kesulitan/Bloom · sumber · event · label |
| **Editor** | Editor soal manual (tanpa AI) · render KaTeX |
| **Paket soal** | Susun paket dari bank soal · section · nomor · ekspor |
| **Ekspor** | Ekspor paket (minimal: cetak/PDF atau format teks) |
| **Auth & peran** | Login · multi-role · matriks izin (L1) |
| **Tema** | Gelap+Terang (default OS) · 3 warna sumber · Linear/Vercel |

### ⏭️ Setelah MVP (fase lanjut)

| Fase | Fitur |
|------|-------|
| **1.1** | **Ingest PDF → soal** (parse, queue, retry) |
| **1.2** | **AI enrichment** (tagging, embedding, dedup) |
| **1.3** | **MCP** (agen AI: buat soal, cari, enrichment) |
| **1.4** | **Ekspor Moodle** (XML per-item) |
| **1.5** | Ekspor PDF lanjutan · TikZ studio · galeri aset lanjutan |
| **2.x** | Impor selektif dari QBank (opsional) |

---

## 7. Alur Kerja Utama (User Journey)

**Alur khas (target MVP):**

```
1. Guru login
2. Cari soal (filter: topik, sumber, event, status) ATAU buat soal baru
3. Lihat detail soal (soal, opsi, kunci, solusi, stimulus)
4. Pilih soal → masukkan ke PAKET SOAL (susun naskah)
5. Atur urutan/section/pengantar
6. EKSPOR paket (cetak/PDF)
```

**Alur lanjutan (1.1+):**
```
Upload PDF → ingest otomatis jadi soal (draft) → AI enrichment (tagging) → kurasi → siap
```

---

## 8. Definisi Sukses (v1.0.0)

MathBank dinyatakan **v1.0.0** bila:

- ✅ **Bank Soal berjalan penuh** — soal + cari + filter + topik/sumber terkelola
- ✅ **Alur tuntas** — cari → susun paket → ekspor berjalan
- ✅ **Auth multi-role** berjalan dengan matriks izin
- ✅ **Tema** (gelap/terang, default OS, 3 warna sumber) konsisten
- ✅ **Gate kualitas hijau**: `pnpm check` (typecheck 0, lint 0, test, build) exit 0
- ✅ **Coverage ≥85%** untuk logika inti
- ✅ **Dokumentasi selaras** (PRD → MILESTONE → kode)

---

## 9. Prinsip & Batasan

Dari `CONSTRAINTS.md` + hasil desain L1–L9:

1. **Zero kompromi** — 0 `@ts-ignore`, 0 `eslint-disable`, 0 kode mati.
2. **KaTeX murni** — `\(...\)` / `\[...\]`, dilarang `$`.
3. **Arsitektur 9 lapisan** — L1–L9 terkunci (lihat dokumen desain).
4. **Font:** Roboto Flex + Roboto Mono.
5. **Tema:** 3 warna sumber → seluruh UI; status warna **universal**.
6. **AI = konfigurasi** (di Pengaturan), bukan hard-code.
7. **L6 engine = fungsi murni** (tanpa DB/network).
8. **Bahasa dokumen: Indonesia.**

---

## 10. Arsitektur (ringkas — detail di dokumen terkait)

**9 lapisan** (`DESAIN-PER-LAPISAN-MATHBANK.md`):

| L | Lapisan | Inti |
|---|---------|------|
| L1 | Pengguna & Peran | Multi-role, 5 peran, matriks izin |
| L2 | Antarmuka | 4 grup sidebar, Referensi submenu lipat |
| L3 | State/Klien | Hook kecil, staleTime per-jenis |
| L4 | API | Pembungkus route, respons tunggal |
| L5 | Layanan | Fungsi, pecah ≤300 baris, tanpa repo |
| L6 | Modul/Engine | FSM dipakai, fungsi murni |
| L7 | Akses Data | Schema per-domain, audit generik |
| L8 | Database | PG 18, uuidv7, pg_trgm+vector |
| L9 | Luar + MCP | AI=konfigurasi, MCP policy |

**Data:** `ARSITEKTUR-DATA-FINAL.md` + `L7-TINJAUAN-KRITIS-DATA.md`.

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Scope creep (mau semua fitur) | MVP dibatasi: alur tuntas saja; sisanya difase-kan |
| Desain vs kenyataan berbeda | Dokumen planning ditulis bertahap (tulang → daging) |
| PG 18 belum dipasang | Bangun sementara di PG 17; pindah nanti (arsitektur siap) |
| UI belum final | Fase C/D UI menyusul; keputusan menggantung dicatat |
| Terlalu banyak dokumen | Tulis hanya yang wajib; daging menyusul per-milestone |

---

## 12. Rujukan

- **Desain per-lapisan:** `DESAIN-PER-LAPISAN-MATHBANK.md`
- **Peta sistem:** `ARSITEKTUR-SISTEM-FULL.md`
- **Arsitektur data:** `ARSITEKTUR-DATA-FINAL.md`, `L7-TINJAUAN-KRITIS-DATA.md`
- **Cetak biru pembangunan:** `CETAK-BIRU-MATHBANK.md`
- **Riwayat keputusan:** `RIWAYAT-KEPUTUSAN.md`
- **Status UI:** `STATUS-UI-MENGGANTUNG.md`
- **Batas mutu:** `CONSTRAINTS.md`
- **Rencana eksekusi:** `MILESTONE.md` (menyusul)

---

*PRD ini adalah hasil interview dengan pemilik produk — bukan asumsi. Bila ada yang tidak sesuai, koreksi di sini dulu, lalu mengalir ke MILESTONE & desain.*
