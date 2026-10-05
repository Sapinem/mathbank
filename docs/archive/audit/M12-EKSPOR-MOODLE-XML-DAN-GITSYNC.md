# AUDIT MILESTONE 12 — EKSPOR MOODLE (SKEMA GITSYNC) (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED** (Selesai — skema GitSync tulis-folder)  
**Target:** Ekspor LMS Moodle — Builder Moodle XML (`moodle-xml.ts`), Normalisasi LaTeX (`latex-to-moodle.ts`), Pemetaan Tipe Soal (`moodle-map.ts`), Pohon Berkas GitSync (`gitsync.ts`), Penulis Disk + Git (`gitsync-writer.ts`), Service (`moodle-export-service.ts`), & Endpoint API (`POST /api/bundles/[id]/export/moodle`).

---

## 1. Ringkasan & Ruang Lingkup Milestone 12

Milestone 12 mengekspor paket soal MathBank ke **repositori GitSync Moodle**
(plugin `maths/moodle-qbank_gitsync`) — bukan satu berkas, melainkan **pohon berkas**.

1. **Pemetaan Tipe Soal MathBank ➔ Moodle (`src/lib/export/moodle-map.ts`):**
   * Pilihan ganda (single/`single_choice`, `assertion_reason`, dll.) ➔ `<question type="multichoice">` (`<single>true</single>`).
   * Pilihan ganda checkbox ➔ `multichoice` (`<single>false</single>`).
   * Isian singkat ➔ `<question type="shortanswer">`.
   * Esai ➔ `<question type="essay">`.
   * Tipe kompleks (`matrix_grid`, `matching`) ➔ **dilewati + dilaporkan** (belum ada padanan langsung).
2. **Normalisasi LaTeX (`src/lib/export/latex-to-moodle.ts`):**
   * `$…$` → **`\(…\)`** dan `$$…$$` → **`\[…\]`** — delimiter yang dikenali **filter TeX Moodle**
     (bukan `$`, yang bisa bentrok). **Raw LaTeX**, bukan MathML/KaTeX-HTML.
3. **Pohon Berkas GitSync (`src/lib/export/gitsync.ts`):**
   * Mengikuti spesifikasi resmi CLI GitSync (`createrepo.php`/`exportrepofrommoodle.php`):
     `top/<Kategori>/<Subkategori>/<NamaSoal>.xml` + `gitsync_category.xml` per level.
   * **Sanitasi meniru GitSync** (`BAD_CHARACTERS` → `-`, `maxcatlength=200`, `maxqlength=230`).
   * **Nama berkas = nama soal tersanitasi** (tanpa prefiks nomor); bentrok → `_2`, `_3`.
   * `gitsync_category.xml` = `<question><category><text>top/Jalur/Penuh</text></category></question>`.
   * **Independensi stimulus:** teks wacana induk disisipkan ke `<questiontext>` tiap soal anak (inline).
4. **Penulis Disk + Git & Service (`gitsync-writer.ts`, `moodle-export-service.ts`):**
   * Menulis berkas ke `<MATHBANK_EXPORT_DIR>/<slug-paket>/` (default `~/mathbank-export`).
   * **Auto-commit Git** (`git init` bila perlu → `add` → `commit`).
   * Otorisasi: `assertCan(actor, "bundle:manage")`.
5. **UI:** tombol **"Ekspor ke GitSync"** pada halaman rincian paket (`MoodleExportButton`).

---

## 2. Matriks Target vs Realisasi M12

| Fitur / Komponen | Target Sesuai GitSync | Realisasi Kode | Verdict |
| :--- | :--- | :--- | :---: |
| **Moodle XML Builder** | 1 `<quiz>`/soal (`multichoice`/`shortanswer`/`essay`) | `src/lib/export/moodle-xml.ts` | ✅ Lulus |
| **Normalisasi LaTeX** | `$…$` → `\(…\)`, `$$…$$` → `\[…\]` | `src/lib/export/latex-to-moodle.ts` | ✅ Lulus |
| **Pohon Folder GitSync** | `top/…` + `gitsync_category.xml` | `src/lib/export/gitsync.ts` | ✅ Lulus |
| **Sanitasi ala GitSync** | `BAD_CHARACTERS`, 200/230 | `sanitizeName()` | ✅ Lulus |
| **Tulis Disk + Git** | Tulis folder + `git init/add/commit` | `src/lib/export/gitsync-writer.ts` | ✅ Lulus |
| **Stimulus Inline** | Soal anak bawa wacana induk | `questionText()` di `moodle-xml.ts` | ✅ Lulus |
| **UI + Endpoint** | Tombol + `POST` API | `moodle-export-button.tsx`, `…/export/moodle/route.ts` | ✅ Lulus |

---

## 3. Hasil Pengujian Otomatis M12

* `xml-escape.test.ts` ➔ **4 Tests** · `moodle-xml.test.ts` ➔ **10 Tests** ·
  `latex-to-moodle.test.ts` ➔ **8 Tests** · `gitsync.test.ts` ➔ **14 Tests**.
* **Unit:** **36/36 Lulus** (`npx vitest run src/lib/export/`).
* `moodle-export.db.test.ts` ➔ **5 DB Tests Lulus** (verifikasi berkas NYATA di disk + Git commit).

---

## 4. Keputusan Terkunci (M12)

| # | Keputusan |
|---|---|
| D1 | Stimulus **inline** ke tiap soal anak |
| D2 | Tipe kompleks **dilewati + dilaporkan** |
| D3 | LaTeX mentah `\(…\)` / `\[…\]` (`$` diganti) |
| D4 | **Tolak** ekspor bila ada soal tanpa kunci |
| D5 | Kategori = **topik** soal (tanpa topik → `Tanpa Topik`) |
| D7 | **Tulis folder langsung ke disk** (bukan ZIP) |
| D8 | **Auto-commit Git** per ekspor |

---

## 5. Review Komparasi vs QBank (M12)

| Dimensi | QBank (Lama) | MathBank | Keunggulan |
| :--- | :--- | :--- | :--- |
| **Integrasi Moodle** | XML dasar tanpa GitSync. | **Repositori GitSync native** (folder + Git). | Sinkron dua-arah dengan bank soal Moodle. |
| **Format Rumus** | `$…$` (kadang rusak di Moodle). | **`\(…\)`/`\[…\]`** (filter TeX Moodle). | Rumus tampil andal. |
| **Stimulus** | Terpisah → konteks hilang. | **Inline per-soal**. | Soal Moodle berdiri mandiri. |
| **Kunci Jawaban** | Berisiko terbaca/berubah. | Sumber kebenaran `answerKey.correct` + gerbang izin. | Ekspor jujur & aman. |

---

## 📄 KESIMPULAN MILESTONE 12

**MILESTONE 12 TELAH VERIFIED LULUS. SISTEM EKSPOR MATHBANK MENGHASILKAN POHON BERKAS
`qbank_gitsync` YANG SAH (tanpa arsip), MENULISNYA KE DISK + GIT COMMIT, DENGAN RUMUS
LaTeX BERSELERA MOODLE DAN STIMULUS INLINE.**

---

## § Catatan Verifikasi

> Wajib menurut `CONSTRAINTS.md` #44 untuk setiap dokumen di `docs/audit/`.

**Diverifikasi ulang: 2026-09-30** terhadap kode & tes nyata:

| Klaim | Hasil verifikasi |
|---|---|
| `moodle-xml.ts`, `latex-to-moodle.ts`, `moodle-map.ts`, `gitsync.ts`, `gitsync-writer.ts` | ✅ **Ada** |
| 36 unit test export | ✅ **36 Lulus** (4+10+8+14) |
| 5 DB test | ✅ **5 Lulus** (`pnpm test:db`) |
| `gitsync_category.xml` = `<question><category><text>top/…` | ✅ Sesuai pembaca GitSync (`$xml->question->category->text`) |
| Ekspor tulis folder + git commit | ✅ Terverifikasi live (`~/mathbank-export/test`, commit `5f7045d`) |
| **"Embedded Base64 Media"** (`<file encoding="base64">`) | ❌ **TIDAK ADA** — klaim versi lama dokumen ini keliru; **tak ada** gambar base64 di `src/lib/export/` |
| **"Moodle XML Standard v4/v5"** | ⚠️ Bukan penamaan yang kami pakai — keluaran = XML format Moodle biasa |

**Koreksi penting:** versi awal dokumen ini mengklaim gambar di-embed base64
(`<file encoding="base64">`) — **tidak benar**; fitur itu **tidak dibangun**. Media/gambar
belum ditangani di ekspor M12.

**Sumber bukti:** `grep -rn base64 src/lib/export/` (kosong), `npx vitest run src/lib/export/`
(36 lulus), `pnpm test:db` (5 M12 lulus), verifikasi live folder + `git log`.
