# AUDIT KONSISTENSI DOKUMEN PERENCANAAN — MathBank

> **Rantai yang diaudit:** VISI → MILESTONE → PRD (beserta dokumen pendukung yang dirujuk).
> **Tanggal audit:** 2026-09-29 (revisi dokumen terkini: RENCANA-UI.md 22:24).
> **Metode:** pembacaan penuh 24 dokumen `.md` (semua di `docs/` + akar repo) + verifikasi silang ke kode (`src/lib/db/schema/`, `package.json`, `git log`).
> **Kesimpulan umum:** **rantai inti (VISION → MILESTONE → PRD) TIDAK KONSISTEN.** VISION.md dan ROADMAP.md masih berorientasi **QBank lama** dan bertentangan langsung dengan PRD.md/MILESTONE.md yang berorientasi **MathBank kanvas-bersih**. Selain itu ditemukan sejumlah konflik angka, penamaan file, dan definisi enum antar dokumen.

---

## 0. Ringkasan Tingkat Keparahan

| Tingkat | Jumlah | Inti |
|---------|--------|------|
| 🔴 **Kritis** | 4 | Visi masih "QBank enhancement" vs PRD "MathBank rebuild"; ROADMAP QBank aktif; nama file rujukan hantu; definisi enum paket/media bentrok dengan kode |
| 🟠 **Tinggi** | 5 | Jumlah tabel 18 vs 27; versi proyek 0.1.0 vs 0.4.0; ambang coverage; milestone M1–M3 "belum" vs CHANGELOG "selesai"; rujukan file tak ada |
| 🟡 **Sedang** | 6 | Scope fitur (fork, cuplikan) bertentangan; struktur UI L2 vs RENCANA-UI; urutan pasang teknologi vs MILESTONE; Non-Goals |
| 🟢 **Rendah** | 4 | Penomoran CONSTRAINT; istilah; tanggal; duplikasi dokumen |

**Kabupaten pesan utama:** Dokumen **VISION.md** dan **ROADMAP.md** adalah **sisa era QBank** yang belum digantikan. Keduanya adalah dua dokumen pertama dalam rantai "visi" yang diminta diaudit — jadi **sumber inkonsistensi terbesar berada tepat di hulu rantai**.

---

# A. TEMUAN KRITIS 🔴

## A1 — VISI mendeskripsikan QBank (enhancement), PRD mendeskripsikan MathBank (rebuild)

**Ini temuan terpenting.** Rantai visi→PRD **tidak menyambung sama sekali**.

| Aspek | VISION.md | PRD.md | Bertentangan? |
|-------|-----------|--------|:---:|
| **Nama produk** | "VISI **QBank**" (judul + seluruh isi) | "PRD — **MathBank**" | ✅ YA |
| **Hubungan ke QBank** | QBank **ditingkatkan** ("perbaikan kita nanti di QBank") | QBank **pensiun**, digantikan total | ✅ YA |
| **Hubungan ke MBank** | MBank = acuan arsitektur ("MBank parity + 20 enhancement"), MBank masih hidup | MBank **tak disebut sama sekali**; stack baru (9 lapisan L1–L9) | ✅ YA |
| **Target rilis** | `QBank v1.0.0` = MBank parity + 20 enhancement, ~80–100 jam + 13–15 jam UI | `MathBank v1.0.0` = "kanvas putih bersih", MVP M1–M8 (~23–32 hari) | ✅ YA |
| **Strategi** | Modernisasi/penyelarasan arsitektur MBank | Bangun dari nol, migrasi QBank **dibatalkan** | ✅ YA |

**Bukti:**
- `VISION.md:1` → `# VISI QBank`
- `VISION.md:12` → *"QBank v1.0.0 — bank soal matematika yang menjadi sistem kanonik … dengan kualitas arsitektur setara MBank (playground modern) plus kapabilitas baru."*
- `VISION.md:14` (kutipan) → *"MBank itu semacam playground untuk pengembangan saja. Jadi perbaikan kita nanti di QBank."*
- `VISION.md:16` → *"Target akhir: v1.0.0 = MBank architecture parity + 20 enhancement, diraih dalam ~80–100 jam (backend) + ~13–15 jam (UI)."*
- `PRD.md:13` → *"MathBank adalah bank soal matematika … Ia menggantikan QBank (QBank pensiun)."*
- `PRD.md:15` → *"Dibangun dari nol ("kanvas putih bersih") … menerapkan 9 lapisan desain yang sudah dikunci (L1–L9)."*
- `PRD.md:39` → *"Bangun MathBank dari nol … Migrasi data QBank dibatalkan."*

**Dampak:** Semua dokumen di bawah VISION (ROADMAP) mewarisi orientasi QBank yang salah. Visi produk saat ini **tidak punya dokumen visi yang benar** — MathBank berjalan tanpa visi yang selaras.

**Catatan:** `CATATAN-PLANNING.md:12,107` sudah **menyadari** hal ini (*"VISION.md … (dari QBank, perlu ditinjau ulang untuk MathBank)"*, *"VISION.md & ROADMAP.md masih berorientasi QBank — perlu disesuaikan"*). Namun sampai audit ini, **belum ada VISION MathBank** — kesadaran belum dieksekusi.

**Rekomendasi:** Tulis **VISION.md MathBank baru** (atau ganti isinya) sebelum MILESTONE diratifikasi; arsipkan versi QBank.

---

## A2 — ROADMAP aktif mendeskripsikan QBank, bukan MathBank

**Nama file rujukan langsung:** `MILESTONE.md` adalah rencana eksekusi MathBank, sementara `ROADMAP.md` — dokumen "peta jalan" yang biasa berdampingan — masih 100% QBank.

**Bukti:** `ROADMAP.md:1` → `# ROADMAP QBank v1.0.0`
- `ROADMAP.md:5` → *"Basis verifikasi: commit bc135ac … dikonfirmasi terhadap kode & DB nyata."* (commit QBank.)
- Seluruh isi = "Track A Backend Modernization" + "Track B UI Remake" (T0–T9, Phase 0–6) — tak satu pun menyebut M0–M12 MathBank.
- `ROADMAP.md:152` → *"Versi saat ini: 0.9.0 (package.json)"* — **padahal `package.json` sekarang `0.1.0`** (proyek MathBank).
- `ROADMAP.md:160-169` gate memakai `pnpm exec tsc`, `pnpm test`, `grep -rn '@ts-ignore' src/` — gaya QBank, sedangkan `CONSTRAINTS.md` MathBank memakai `pnpm check`.

**Dampak:** Ada **dua "peta jalan"** (ROADMAP.md = QBank lama; MILESTONE.md = MathBank baru). Pembaca tak tahu mana yang berlaku. ROADMAP tidak diakui MILESTONE (MILESTONE merujuk PRD + DESAIN-PER-LAPISAN, bukan ROADMAP).

**Rekomendasi:** Arsipkan `ROADMAP.md` (beri header `[ARSIP — QBank]`) atau ganti menjadi ROADMAP MathBank yang menyambung ke MILESTONE.

---

## A3 — Rujukan file "hantu": `PRD-SYSTEM-ARCHITECTURE.md` dan `_reconcile/` tidak ada

VISION.md dan ROADMAP.md merujuk file yang **tidak eksis** di repositori MathBank.

| Rujukan | Muncul di | Status file |
|---------|-----------|:---:|
| `PRD-SYSTEM-ARCHITECTURE.md` | `VISION.md:4,71,91` · `ROADMAP.md:5,176` · `CATATAN-PLANNING.md:108` | ❌ **TIDAK ADA** |
| `docs/_reconcile/brain-artifacts/` (15 file) | `VISION.md:92` · `ROADMAP.md:177` | ❌ **TIDAK ADA** |
| `PLAN.md`, `qbank-v1-modernization-plan.md` | `ROADMAP.md:44,177` | ❌ tidak ada di repo MathBank |
| `docs/development.md` | `ROADMAP.md:33` | ❌ tidak ada |
| `DESIGN.md` | dirujuk MILESTONE M3, RENCANA-UI | ❌ **belum dibuat** (memang direncanakan) |

**Bukti:** `CATATAN-PLANNING.md:107` mencatat *"Dokumen QBank `PRD-SYSTEM-ARCHITECTURE.md` belum disalin"* — mengonfirmasi ketiadaan.

**Dampak:** Rantai "visi → arsitektur" menyebut dokumen arsitektur yang tak ada. Pembaca yang mengikuti tautan menemui jalan buntu.

---

## A4 — Definisi enum paket & media: dokumen desain vs KODE berbeda (kode ikut SKEMA, bukan L7)

Desain L7 **mengunci** nilai enum, tetapi kode yang sudah jadi (M1) memakai definisi **berbeda**, dan `SKEMA-DB-DETAIL.md` mengikuti kode (bukan L7).

| Enum | L7 (`L7-TINJAUAN-KRITIS-DATA.md`, `DESAIN-PER-LAPISAN`) | SKEMA-DB-DETAIL.md | **KODE nyata** (`_enums.ts`) | Konsisten? |
|------|--------------------------------------------------------|--------------------|-----------------------------|:---:|
| `bundle_item_role` | `member` · `origin` · `forked` | `question` · `stimulus` | `question` · `stimulus` | ❌ L7 vs kode |
| `media_role` | `illustration` · `hint` · `context` | `content` · `option` · `solution` · `thumbnail` | `content` · `option` · `solution` · `thumbnail` | ❌ L7 vs kode |

**Bukti kode:** `src/lib/db/schema/_enums.ts:85` → `bundle_item_role = ["question","stimulus"]`; `_enums.ts:91` → `media_role = ["content","option","solution","thumbnail"]`.

**Bukti dokumen:** `L7-TINJAUAN-KRITIS-DATA.md:183-184` menetapkan `bundle_item_role: member, origin, forked` dan `media_role: illustration, hint, context`. `SKEMA-DB-DETAIL.md:86-87` menetapkan `question/stimulus` dan `content/option/solution/thumbnail`.

**Dampak:** L7 (dokumen desain data "terkunci") **tidak sinkron dengan kode & SKEMA-DB-DETAIL**. SALAH SATU harus dikoreksi. Ini juga memengaruhi makna `bundle_items.role='origin'` yang dipakai di `ARSITEKTUR-DATA-FINAL.md:420` dan `:522` (Story "role='origin'").

**Rekomendasi:** Tetapkan **sumber kebenaran tunggal** untuk enum; perbarui L7 agar cocok dengan keputusan aktual (kode), atau sebaliknya.

---

# B. TEMUAN TINGGI 🟠

## B1 — Jumlah tabel: "18" (VISION-era/MILESTONE) vs "27" (kenyataan)

| Dokumen | Klaim |
|---------|-------|
| `MILESTONE.md:68` | *"skema v2 (L7) … **18 tabel**, enum, relasi, migrasi"* |
| `MILESTONE.md:108` | *"Skrip verifikasi skema (pastikan **18 tabel** & relasi ada)"* |
| `MILESTONE.md:385` | *"SKEMA-DB-DETAIL.md (bentuk final **18 tabel**)"* |
| `ARSITEKTUR-DATA-FINAL.md:101` | *"Tabel inti: **18** (3 taksonomi baru)"* |
| `ARSITEKTUR-SISTEM-FULL.md:155` | *"**18 tabel** inti"* |
| `PRD.md` (implisit via L7) | 18 |
| **`SKEMA-DB-DETAIL.md:28`** | *"⚠️ Koreksi: dokumen awal menulis '18' — itu **salah hitung**. Tabel domain sebenarnya **21**, plus **6 tabel auth** = **27**."* |
| `AUDIT-KODE.md:40` | *"DB cocok dengan dokumen (**27 tabel**/21 trigger/79 indeks/23 FK)"* |
| `CHANGELOG.md:98` | *"**27 tabel** (21 domain + 6 auth)"* |

**Dampak:** MILESTONE.md — dokumen eksekusi — masih memakai angka **18** (salah) di tiga tempat. Kriteria selesai M1 ("skrip verifikasi 18 tabel") akan menyesatkan.

**Rekomendasi:** Perbarui MILESTONE.md (18 → 27, atau 21 domain), dan ARSITEKTUR-DATA-FINAL / ARSITEKTUR-SISTEM-FULL.

---

## B2 — Versi proyek: `package.json` 0.1.0 vs CHANGELOG 0.4.0 vs README status

| Sumber | Versi / status |
|--------|----------------|
| `package.json` | **`0.1.0`** |
| `CHANGELOG.md` | Terbaru = **`[0.4.0] — M3`**; ada 0.1.0, 0.2.0, 0.3.0, 0.4.0 |
| `README.md:130-136` | M0 ✅ · M1 ✅ · M2 ✅ · M3 ✅ · M4 ⬜ |
| `MILESTONE.md:26-30` | **M0 ✅** · **M1 🔴 (belum)** · **M2 🔴 (belum)** · **M3 🔴 (belum)** · M4 🔴 |
| `ROADMAP.md:152` | *"Versi saat ini: **0.9.0** (package.json)"* |

**Dampak:** Tiga angka versi berbeda (0.1.0 / 0.4.0 / 0.9.0). Status milestone M1–M3 **berlawanan** antara MILESTONE.md (belum) dan README/CHANGELOG (selesai).

**Rekomendasi:** Satu sumber versi. Perbarui `package.json` → 0.4.0 (atau lebih), dan **pindahkan status milestone ke MILESTONE.md sebagai kanonik**, lalu README menunjuk ke sana.

---

## B3 — MILESTONE M1–M3 "belum" vs CHANGELOG/README/AUDIT "sudah selesai"

Bertentangan langsung di dalam rantai yang diaudit:

| Milestone | MILESTONE.md | CHANGELOG / README / AUDIT |
|-----------|:---:|:---:|
| M1 Skema Database | 🔴 (checkbox `[ ]`, "2–3 hari") | ✅ 0.2.0 — 27 tabel terpasang |
| M2 Auth & Peran | 🔴 | ✅ 0.3.0 — peran, matriks izin, wrapper |
| M3 Tema & Shell | 🔴 | ✅ 0.4.0 — mesin tema, shell, ⌘K |
| M0 Fondasi | ✅ | ✅ (sepakat) |

**Bukti tambahan:** Kode nyata sudah ada (`src/lib/db/schema/` 11 file, `src/lib/auth/`, `src/components/layout/`, `src/styles/tokens/`), CHANGELOG mencatat "Gerbang Mutu: tsc 0 · lint 0 · tes 68/68 · coverage 98,7%" untuk M3.

**Dampak:** MILESTONE.md (dokumen perencanaan "kedua" dalam rantai) **ketinggalan 3 milestone**. Siapa pun yang memakai MILESTONE sebagai acuan akan mengulang M1–M3.

**Rekomendasi:** Perbarui tanda status di MILESTONE.md (M1/M2/M3 → ✅), catat tanggal & rujukan CHANGELOG.

---

## B4 — Coverage: ≥85% (target dokumen) vs 98,7% (nyata) — dan "coverage palsu" yang belum terekam di PRD/VISION

| Dokumen | Klaim |
|---------|-------|
| `CONSTRAINTS.md:9` | Coverage **≥ 85%** statements |
| `PRD.md:167` · `VISION.md:24,63` · `ROADMAP.md:163` | Coverage **≥85%** |
| `AUDIT-KODE.md:31,13` | Dulu **9,12%** (palsu) → kini **98,7%** |
| `CHANGELOG.md:27,43` | **98,7%** stmt · 97,6% cabang · 100% fungsi |

**Dampak:** Bukan sekadar angka — audit menemukan gerbang mutu **pernah palsu sejak M0** (`AUDIT-KODE.md:31`: *"ambang tak pernah ditegakkan … gerbang mutu palsu sejak M0"*). Fakta ini penting untuk definisi sukses tetapi **tidak muncul** di PRD/VISION/MILESTONE. PRD §8 masih menulis "Coverage ≥85%" tanpa catatan penyempurnaan cakupan (fokus ke "logika murni").

**Rekomendasi:** Selaraskan angka; tambahkan catatan cakupan diskop (logika murni vs e2e) ke PRD §8 dan CONSTRAINTS.

---

## B5 — Rujukan silang ke dokumen yang belum ada (direncanakan tapi dirujuk seolah ada)

`MILESTONE.md` §Konsolidasi (baris 362–373) & badan milestone merujuk dokumen pendukung yang **belum ditulis**: `KONTRAK-API.md`, `DESIGN.md`, `RENCANA-SOAL.md`, `RENCANA-PENCARIAN.md`, `STRATEGI-INGEST.md`, `RENCANA-ENRICHMENT.md`, `RENCANA-MCP.md`, `RENCANA-EKSPOR.md`. Sebagian ada di `CATATAN-PLANNING.md` sebagai "belum ada", sebagian **tidak tercantum** di sana (mis. `RENCANA-SOAL.md`, `RENCANA-EKSPOR.md`).

**Dampak:** Rantai dokumen tidak lengkap; pembaca menganggap file ada. Tidak fatal tetapi melemahkan "satu sumber kebenaran" (VISION prinsip #2).

---

# C. TEMUAN SEDANG 🟡

## C1 — "Fork naskah": VISION menjanjikan, PRD mengecualikan

- `VISION.md:39` → *"Kurator menyusun naskah … **fork 1-klik** dari naskah asal resmi → edit → ekspor"* (pilar visi 3.2).
- `PRD.md:88` → Non-Goals: *"❌ Fork naskah (`forked_from_bundle_id`) — pending, konsep belum final."*
- `ARSITEKTUR-DATA-FINAL.md:48,546` & `RIWAYAT-KEPUTUSAN.md:165` → Fork = **PENDING**.

**Dampak:** Fitur yang dijanjikan di visi ternyata **di luar lingkup** di PRD. (Sebagian karena VISION masih QBank-era, tetapi tetap kontradiksi dalam rantai.)

## C2 — "Cuplikan konten" sebagai judul soal vs kolom `title`/`content_markdown`

- `ARSITEKTUR-DATA-FINAL.md:38` → *"Judul soal = cuplikan konten … tak perlu kolom `title`"*.
- `SKEMA-DB-DETAIL.md:104-113` → `questions` **tak punya `title`** (konsisten) ✅.
- Tetapi `SKEMA-DB-DETAIL.md` untuk `bundles` tetap pakai `title` (benar) — **OK**. Temuan kecil: pastikan tidak ada dokumen yang menyebut `questions.title`.

**Hasil verifikasi:** tidak ditemukan `questions.title` — **konsisten**. (Ditandai ✅, bukan temuan.)

## C3 — Struktur menu: L2 "Referensi submenu lipat" vs RENCANA-UI "link terpisah"

- `DESAIN-PER-LAPISAN-MATHBANK.md:121,141` (L2) → *"REFERENSI ▼ … **GRUP BERJUDUL + BISA DILIPAT (cara C)**; status lipat diingat (localStorage)"*.
- `RIWAYAT-KEPUTUSAN.md:74` → *"Referensi = **submenu lipat** … bukan tab terpisah, bukan 3 menu terpisah."*
- `RENCANA-UI.md:64,157` → *"Referensi = **link terpisah** di bawah judul grup (**bukan accordion**)"*.
- `STATUS-UI-MENGGANTUNG.md:14` → *"Referensi = Link terpisah (bukan accordion)"*.

**Dampak:** L2 "terkunci" menetapkan *accordion/lipat*; RENCANA-UI memutuskan sebaliknya (*link terpisah*). Perubahan telah terjadi tetapi **L2 belum dikoreksi** (melanggar prinsip "koreksi dokumen dulu").

## C4 — Urutan pasang teknologi (TUMPUKAN) vs urutan milestone (MILESTONE)

- `TUMPUKAN-TEKNOLOGI.md:54` menaruh **shadcn/ui · react-query · katex · cmdk · sonner · next-themes** di **M3**.
- `MILESTONE.md` M3 = Tema & Shell (masuk akal), tetapi **KaTeX** secara logika milik **M4 (Bank Soal/editor)**; MILESTONE M3 tak menyebut KaTeX.
- `TUMPUKAN-TEKNOLOGI.md:68-77` menaruh shadcn & komponen di M3, sementara `RENCANA-UI.md:283-286` memetakan Fase A (mesin tema) & B (komponen) ke **M3**, Fase C/D ke M3/M4–M8.

**Dampak:** Pemetaan paket→milestone berbeda tipis antara TUMPUKAN dan MILESTONE/RENCANA-UI (mis. `nuqs` di M5–M6 vs penggunaan filter URL di L3/M6). Tidak fatal, tapi membingungkan saat "install saat milestonenya tiba" (aturan keras TUMPUKAN).

## C5 — Definisi "siap" & warna: konsisten di dokumen, tapi cek kode

- Dokumen serempak: *"Siap = biru brand (bukan hijau); status warna universal"* (`RENCANA-UI.md:253`, `RIWAYAT-KEPUTUSAN.md:148`, `THEME-FRAMEWORK-GUIDE.md:139`, `DESIGN-THEME-FRAMEWORK.md:26,122`). **Konsisten ✅.**

## C6 — Non-Goals PRD vs tujuan fase lanjut (ambigu)

- `PRD.md:88` → *"❌ Migrasi data QBank (dibatalkan; **impor selektif mungkin nanti**)."*
- `PRD.md:120` → *"2.x — Impor selektif dari QBank (opsional)"*.
- `CETAK-BIRU-MATHBANK.md:16,177` → *"Data lama dibawa nanti (ada rencana impor) … LANGKAH 10 Impor data dari QBank"*.

**Dampak:** "Dibatalkan" vs "mungkin nanti" vs "LANGKAH 10" — tidak tegas apakah satu arah. `RENCANA-MIGRASI-DATA.md` (7 fase) masih ada & terperinci, padahal `CATATAN-PLANNING.md:106` menandai *"migrasi dibatalkan; dokumen ini mungkin tak relevan."*

---

# D. TEMUAN RENDAH 🟢

## D1 — Penomoran CONSTRAINT
`CONSTRAINTS.md` kini punya 26 aturan (#1–26). `CHANGELOG.md:26` mencatat *"perbaiki duplikasi nomor"* — perbaikan sudah dilakukan. Namun `RIWAYAT-KEPUTUSAN.md:196` merujuk *"CONSTRAINT baru #10–14"* — perlu dipastikan nomor final cocok. Verifikasi: CONSTRAINTS #10–14 = aturan responsif ✅ (**cocok**).

## D2 — Inkonsistensi KaTeX `$` vs `\(...\)` (sudah diketahui & ditandai)
`CONSTRAINTS.md:49` (#25) melarang `$`; `RIWAYAT-KEPUTUSAN.md:198-201` mencatat kode aktual (`MathContent`, seeder) memakai `$...$`, dan `CHANGELOG.md:25` menyebut MathContent kini dukung keduanya. **Sudah ditandai + ada keputusan sementara** (konten baru `\(...\)`). ✅ Tertangani.

## D3 — Tanggal mendatang
VISION.md:5 menyebut *"sesi perencanaan di agy (28–29 Sep 2026)"*; MILESTONE/PRD `Tanggal: 2026-09-29`. Semua konsisten (2026). ✅

## D4 — Duplikasi dokumen (overlap)
`ARSITEKTUR-SISTEM-FULL.md` (QBank, "DRAFT") dan `DESAIN-PER-LAPISAN-MATHBANK.md` (MathBank) memetakan 9 lapisan yang sama — potensi tumpang-tindih. `ARSITEKTUR-DATA-FINAL.md` vs `SKEMA-DB-DETAIL.md` juga besar overlapnya. `ARSITEKTUR-SISTEM-FULL.md:253` sendiri mengakui *"Dokumen banyak & saling tumpang-tindih (20 file)"*.

---

# E. PETA KONSISTENSI RANTAI (VISI → MILESTONE → PRD)

```
VISION.md (QBank, MBank-parity)  ──✗──►  MILESTONE.md (MathBank, M0–M12)
        │                                        │
        └────────✗ tidak menyambung ✗───────────┘
                                                 │
ROADMAP.md (QBank, Phase 0–6) ──✗──► PRD.md (MathBank, L1–L9, MVP)
        │
        └─ rujuk PRD-SYSTEM-ARCHITECTURE.md (❌ tak ada)

Yang BENAR & SELARAS di hilir:
PRD.md ──✓──► MILESTONE.md ──✓──► DESAIN-PER-LAPISAN / SKEMA-DB-DETAIL / RENCANA-UI
                       (kecuali angka tabel 18, status M1–M3, & enum A4)
```

| Relasi | Status |
|--------|:---:|
| VISION → MILESTONE | ❌ **TERPUTUS** (QBank vs MathBank) |
| VISION → PRD | ❌ **TERPUTUS** (QBank enhancement vs MathBank rebuild) |
| ROADMAP → MILESTONE | ❌ **PARALEL/BERTENTANGAN** (dua peta jalan) |
| PRD → MILESTONE | 🟡 **SELARAS** (kecuali jumlah tabel, status milestone) |
| MILESTONE → DESAIN/UI/SKEMA | 🟡 **SELARAS** (kecuali enum A4, jumlah tabel) |

---

# F. REKOMENDASI PERBAIKAN (berurut prioritas)

1. 🔴 **Tulis VISION.md MathBank** baru (atau ganti total isi). Samakan nama produk, strategi (rebuild, bukan enhancement MBank), target waktu, dan daftar prinsip dengan PRD. → Menyelesaikan A1.
2. 🔴 **Arsipkan ROADMAP.md** QBank (header arsip + pindah ke `docs/arsip/`) atau ganti jadi ROADMAP MathBank yang menunjuk MILESTONE. → A2.
3. 🔴 **Perbaiki rujukan hantu**: hapus/ganti rujukan `PRD-SYSTEM-ARCHITECTURE.md` dan `docs/_reconcile/` di VISION & ROADMAP (arahkan ke `DESAIN-PER-LAPISAN-MATHBANK.md` / `ARSITEKTUR-DATA-FINAL.md`). → A3.
4. 🔴 **Satukan sumber kebenaran enum** (`bundle_item_role`, `media_role`): koreksi L7 agar = kode (`question/stimulus`, `content/option/solution/thumbnail`) atau putuskan ulang. → A4.
5. 🟠 **Ganti angka "18 tabel"** → 21 domain / 27 total di MILESTONE.md (3 tempat), ARSITEKTUR-DATA-FINAL.md, ARSITEKTUR-SISTEM-FULL.md. → B1.
6. 🟠 **Selaraskan versi**: `package.json` → 0.4.0+; hapus klaim "0.9.0" di ROADMAP (akan beres saat arsip). → B2.
7. 🟠 **Perbarui status milestone M1/M2/M3 → ✅** di MILESTONE.md; tunjuk CHANGELOG sebagai bukti. → B3.
8. 🟠 **Selaraskan ambang coverage** & tambahkan catatan cakupan diskop (logika murni) ke PRD §8, CONSTRAINTS, VISION. → B4.
9. 🟡 **Koreksi L2** di DESAIN-PER-LAPISAN agar cocok dengan keputusan RENCANA-UI (Referensi = link terpisah, bukan accordion). → C3.
10. 🟡 **Tegaskan status migrasi QBank** di PRD/CETAK-BIRU/RENCANA-MIGRASI (satu arah: dibatalkan → arsipkan RENCANA-MIGRASI-DATA). → C6.
11. 🟡 **Selarasakan pemetaan paket→milestone** antara TUMPUKAN dan MILESTONE. → C4.
12. 🟢 **Tandai dokumen pendukung yang belum ada** (KONTRAK-API, DESIGN, RENCANA-SOAL, dll) dengan status eksplisit di MILESTONE. → B5.

---

# G. LAMPIRAN — Daftar Dokumen yang Diaudit

| # | Dokumen | Peran dalam rantai | Kondisi |
|---|---------|--------------------|---------|
| 1 | `docs/VISION.md` | **VISI** | 🔴 QBank-era, tak selaras |
| 2 | `docs/ROADMAP.md` | Rencana (QBank) | 🔴 QBank-era, paralel |
| 3 | `docs/MILESTONE.md` | **Rencana eksekusi** | 🟡 selaras PRD, angka usang |
| 4 | `docs/PRD.md` | **PRD** | 🟢 referensi kanonik (beberapa celah) |
| 5 | `docs/CATATAN-PLANNING.md` | Meta-planning | 🟢 menyadari A1/A2, belum eksekusi |
| 6 | `docs/CETAK-BIRU-MATHBANK.md` | Cetak biru bangun | 🟢 |
| 7 | `docs/RIWAYAT-KEPUTUSAN.md` | Jejak keputusan | 🟢 |
| 8 | `docs/DESAIN-PER-LAPISAN-MATHBANK.md` | Desain L1–L9 | 🟡 enum (A4), L2 (C3) |
| 9 | `docs/ARSITEKTUR-DATA-FINAL.md` | Data v2 | 🟡 "18 tabel" |
| 10 | `docs/ARSITEKTUR-SISTEM-FULL.md` | Peta sistem QBank | 🟡 QBank-era + "18 tabel" |
| 11 | `docs/L7-TINJAUAN-KRITIS-DATA.md` | Tinjauan data | 🔴 enum bentrok kode |
| 12 | `docs/SKEMA-DB-DETAIL.md` | Skema final | 🟢 koreksi "18→27" sudah ada |
| 13 | `docs/RENCANA-UI.md` | Rencana UI | 🟢 |
| 14 | `docs/RENCANA-UI-MOBILE.md` | Responsif (mengikat) | 🟢 |
| 15 | `docs/STATUS-UI-MENGGANTUNG.md` | Status UI | 🟢 |
| 16 | `docs/TUMPUKAN-TEKNOLOGI.md` | Stack | 🟡 pemetaan milestone |
| 17 | `docs/DESIGN-THEME-FRAMEWORK.md` | Tema (QBank) | 🟢 isi konsisten |
| 18 | `docs/THEME-FRAMEWORK-GUIDE.md` | Panduan tema (QBank, branch lama) | 🟢 |
| 19 | `docs/CATATAN-INTERVIEW-ARSITEKTUR.md` | Interview | 🟢 |
| 20 | `docs/RENCANA-MIGRASI-DATA.md` | Migrasi | 🟡 status ambigu (dibatalkan) |
| 21 | `docs/AUDIT-KODE.md` | Audit kode | 🟢 sumber kebenaran "27 tabel/98,7%" |
| 22 | `README.md` | Pintu masuk | 🟡 status milestone (B2/B3) |
| 23 | `CHANGELOG.md` | Riwayat versi | 🟢 sumber kebenaran versi |
| 24 | `CONSTRAINTS.md` | Batas mutu | 🟢 |
| — | `AGENTS.md` / `CLAUDE.md` | Aturan agen | 🟢 (non-perencanaan) |

---

*Audit ini menyelesaikan tugas: menyorot inkonsistensi sepanjang rantai perencanaan visi → milestone → PRD. **Akar masalah: dokumen visi (VISION.md) dan peta jalan (ROADMAP.md) belum dimigrasikan dari era QBank ke MathBank.** Selama kedua file di hulu rantai belum diperbaiki, "satu sumber kebenaran" (prinsip visi & CONSTRAINTS) belum tercapai.*
