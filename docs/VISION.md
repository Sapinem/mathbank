# VISI QBank

> **Dokumen ini menjawab:** *Apa yang ingin kita capai, dan mengapa?*
> **Bukan** dokumen teknis (itu di `PRD-SYSTEM-ARCHITECTURE.md`) atau rencana eksekusi (itu di `ROADMAP.md`).
> **Sumber:** Dikristalisasi dari sesi perencanaan di agy (28–29 Sep 2026), artefak brainstorm, dan transkrip diskusi.
> **Status:** Hasil rekonsiliasi — menunggu ratifikasi pemilik produk.

---

## 1. Tujuan Utama

**QBank v1.0.0** — bank soal matematika yang menjadi **sistem kanonik** untuk kurasi, penyusunan, dan penerbitan naskah soal, dengan kualitas arsitektur setara **MBank** (playground modern) plus kapabilitas baru.

> Kutipan visi (transkrip agy #160): *"MBank itu semacam playground untuk pengembangan saja. Jadi perbaikan kita nanti di QBank. Kita juga sesuaikan arsitektur sesuai MBank."*

**Target akhir:** `v1.0.0` = **MBank architecture parity + 20 enhancement**, diraih dalam ~80–100 jam (backend) + ~13–15 jam (UI).

---

## 2. Prinsip yang Dipegang

Dari `CONSTRAINTS.md` + diskusi agy:

1. **Zero kompromi kualitas** — 0 `@ts-ignore`, 0 `eslint-disable`, 0 `test.skip`, 0 TODO stub. Coverage ≥85%.
2. **Satu sumber kebenaran** — arsitektur didokumentasikan & diselaraskan; tidak ada "rencana hantu".
3. **Struktur sebelum estetika** — proses development yang *rapi & terstruktur* (kutipan #301: *"Aku pengen benar-benar terstruktur proses developmentnya biar hasilnya rapi"*).
4. **KaTeX murni** — 100% `\(...\)`/`\[...\]`, nol `$`.
5. **Font sebagai identitas** — Roboto Flex (bukan Geist; kutipan #1123: *"aku gak suka, gak modern"*).
6. **Arsitektur sederhana** — `Source → Bundle → Item`; menyatukan koleksi & paket ujian yang duplikatif.

---

## 3. Pilar Visi

### 3.1 Arsitektur Data: `Source ──► Bundle ──► Item`
Menyatukan dua konsep yang tumpang-tindih (`collections` & `exam_packages`) menjadi satu `question_bundles` dengan `bundle_type` (`'source'` | `'exam'`). Soal bisa hidup mandiri (orphan, `bundle_id` nullable) atau masuk banyak paket (M:N via `bundle_items`).

### 3.2 Pengalaman Kurasi
Kurator menyusun naskah ujian dengan cepat: **fork 1-klik** dari naskah asal resmi → edit → ekspor (Moodle XML / print).

### 3.3 Eksplorasi Soal
3 mode tampilan yang menyesuaikan kebutuhan:
- **List Padat** — 40px/baris, untuk kerja bulk.
- **Grid Rapi** — tinggi tetap, fade jika overflow.
- **Masonry Utuh** — tinggi menyesuaikan teks soal.

### 3.4 UI/UX "Precision Math Tool"
Desain bergaya *Industrial Neo-Grotesque × Precision Math Tool* (density ala Linear/Vercel), dengan **OKLCH multi-tema** (mathmyid/ocean/purple) — tambah tema cukup 3 variabel CSS.

### 3.5 Platform untuk Agen
MCP server + API terdokumentasi (OpenAPI) agar agen AI dapat mengakses penuh kapabilitas QBank.

---

## 4. Yang Ingin Dicapai (Definition of Success)

QBank dinyatakan **v1.0.0** bila:

- ✅ Bank soal matematika yang bersih, terstruktur, dan mudah dikurasi
- ✅ Guru bisa: buka naskah UTBK → fork → edit paket → ekspor Moodle & cetak — tanpa gesekan
- ✅ 3 mode eksplorasi soal berfungsi (list/grid/masonry)
- ✅ UI konsisten dengan identitas Roboto Flex + multi-tema OKLCH
- ✅ Zero technical debt (gate kualitas hijau: tsc 0, lint 0, test ≥85%, `<85KB` gzip)
- ✅ Agen AI bisa beroperasi via MCP
- ✅ Dokumentasi selaras (VISION → ROADMAP → PRD → kode)

---

## 5. Hal yang Sengaja TIDAK Diubah

Invarian yang dijaga selama transformasi (dari `PRD-SYSTEM-ARCHITECTURE.md` §5):

```
✗ KaTeX rendering pipeline
✗ Better-Auth session management
✗ question-fsm.ts (draft → review → ready → archived)
✗ Embedding service (pgvector + RRF hybrid)
✗ Backup streaming service
✗ AI enrichment scripts
✗ question_items flat single-table (no question_versions)
✗ bundle_items.question_id ON DELETE RESTRICT
✗ Media tri-facet /m/{id} + {{asset:id}}
✗ MCP API key system
```

---

## 6. Rujukan

- **Rencana eksekusi:** `ROADMAP.md`
- **Arsitektur teknis:** `PRD-SYSTEM-ARCHITECTURE.md`
- **Artefak perencanaan asli:** `docs/_reconcile/brain-artifacts/` (15 file, termasuk `qbank-v1-modernization-plan.md`, `qbank-ui-remake-plan.md`, `draft-ui-remake-plan.md`)

---

*Visi ini adalah hasil kristalisasi dari banyak diskusi — bukan keputusan sepihak. Bila ada yang tidak sesuai, ia dapat dikoreksi di sini terlebih dahulu, lalu mengalir ke ROADMAP & PRD.*
