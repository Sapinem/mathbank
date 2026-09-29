# VISI MathBank

> **Dokumen ini menjawab:** *Apa yang ingin kita capai, dan mengapa?*
> **Bukan** dokumen teknis (itu di `DESAIN-PER-LAPISAN-MATHBANK.md` & `ARSITEKTUR-DATA-FINAL.md`) atau rencana eksekusi (itu di `MILESTONE.md`).
> **Status:** ✅ diselaraskan untuk MathBank — 2026-09-29 (sebelumnya era QBank).
> **Rujukan:** `PRD.md` (detail produk), `PETA-DOKUMEN.md` (peta dokumen).

---

## 1. Tujuan Utama

**MathBank** adalah **bank soal matematika** yang menjadi **sistem kanonik** untuk kurasi, penyusunan, dan penerbitan naskah soal — dipakai guru & kurator di **satu institusi** (skala <100 pengguna).

Dibangun **dari nol** ("kanvas putih bersih"), menggantikan **QBank** (pensiun). Bukan peningkatan QBank — **proyek baru** dengan arsitektur berlapis yang bersih (L1–L9) dan tata kelola mutu sejak awal.

> **Motto kerja:** *Zero kompromi kualitas* — 0 `@ts-ignore`, 0 `eslint-disable`, 0 kode mati. Gate: `pnpm check` hijau.

**Target MVP:** alur tuntas end-to-end — **buat soal → kurasi → susun paket → ekspor (cetak/PDF)**.

---

## 2. Prinsip yang Dipegang

Dari `CONSTRAINTS.md` + keputusan produk:

1. **Zero kompromi kualitas** — 0 `@ts-ignore`, 0 `eslint-disable`, 0 kode mati; coverage terukur (bukan klaim).
2. **Satu sumber kebenaran** — setiap fakta punya satu dokumen induk; tak ada "rencana hantu" (`PETA-DOKUMEN.md`).
3. **Struktur sebelum estetika** — proses development rapi & terstruktur; arsitektur berlapis dijaga.
4. **KaTeX murni** — konten baru 100% `\(...\)`/`\[...\]`; renderer toleran `$...$` untuk data lama.
5. **Font sebagai identitas** — **Roboto Flex** (UI) + Roboto Mono (rumus/ID).
6. **Arsitektur sederhana** — `sumber → paket → soal` (satu model paket, tak menduplikasi koleksi & paket ujian).
7. **Mode gelap & terang**, default mengikuti sistem OS.
8. **Mode pemakaian** — *Kelola di desktop, lihat di mobile*.

---

## 3. Pilar Visi

### 3.1 Arsitektur Data: sumber → paket → soal
Satu model `bundles` (dengan `bundle_type`) menyatukan yang dulu terpisah (koleksi & paket ujian). Soal bisa hidup mandiri atau masuk banyak paket (M:N via `bundle_items`). Asal-usul soal dilacak via **wadah fisik** (`sources`) + **peristiwa nyata** (`events`).

### 3.2 Pengalaman Kurasi
Kurator menyusun naskah dengan cepat: **fork 1-klik** dari naskah asli resmi → edit → ekspor (cetak/PDF; Moodle di fase lanjut).

### 3.3 Bank Soal yang Dapat Dieksplorasi
Daftar soal yang padat dengan **filter, cari, dan paginasi** — cepat dipindai untuk kerja bulk. (Mode tampilan kaya menyusul bertahap.)

### 3.4 UI/UX "Precision Math Tool"
Arah visual **Linear/Vercel**: gelap, padat, presisi, garis hairline, satu aksen dominan. Mesin tema **brand-agnostic**: ganti merek cukup ubah 2–3 warna sumber → `pnpm theme:build`. Kontras WCAG dijaga.

### 3.5 Platform untuk Agen
MCP server + API terdokumentasi agar agen AI dapat mengakses kapabilitas MathBank secara terbatas & terkendali (kebijakan tulis eksplisit). **AI = konfigurasi** (di `app_settings`), bukan hard-code.

---

## 4. Yang Ingin Dicapai (Definition of Success)

**MVP (M1–M8)** dinyatakan berhasil bila:

- ✅ Bank soal yang bersih, terstruktur, mudah dikurasi
- ✅ Alur tuntas: **buat soal → kurasi → susun paket → ekspor cetak/PDF** — tanpa gesekan
- ✅ FSM status soal dipakai betulan (`draft → review → ready → archived`)
- ✅ RBAC 5 peran teruji; audit jejak lengkap
- ✅ UI konsisten (Roboto Flex + mesin tema), benar di desktop **dan** mobile
- ✅ DB **reproduktif dari file** (`pnpm db:migrate` di DB kosong = skema lengkap)
- ✅ Gerbang mutu **nyata**: tsc 0 · lint 0 · coverage terukur · build 0 · e2e hijau
- ✅ Dokumentasi selaras (VISION → PRD → MILESTONE → kode)

**Fase lanjut (M9–M12):** ingest PDF, AI enrichment, MCP, ekspor Moodle.

---

## 5. Hal yang Sengaja TIDAK Dilakukan (Non-Goals)

```
✗ Refactor QBank              → bangun baru dari nol (ADR-0001)
✗ Migrasi data QBank          → dibatalkan; tak ada data perlu diselamatkan
✗ Multi-institusi / SaaS      → satu institusi (<100 user)
✗ Aplikasi mobile native      → web responsif cukup
✗ Editor penuh di mobile      → mobile untuk MELIHAT
✗ Mode tampilan masonry/grid  → list padat dulu (menyusul bila perlu)
✗ AI dulu                     → konfigurasi menyusul (M10), bukan inti MVP
```

---

## 6. Rujukan

- **Produk:** `PRD.md`
- **Rencana eksekusi:** `MILESTONE.md`
- **Arsitektur:** `DESAIN-PER-LAPISAN-MATHBANK.md`, `ARSITEKTUR-DATA-FINAL.md`
- **Keputusan:** `RIWAYAT-KEPUTUSAN.md`, `docs/ADR/`
- **Peta dokumen:** `PETA-DOKUMEN.md`

---

*Visi ini hasil kristalisasi banyak diskusi — bukan keputusan sepihak. Koreksi ditulis di sini lebih dulu, lalu mengalir ke PRD & MILESTONE.*
