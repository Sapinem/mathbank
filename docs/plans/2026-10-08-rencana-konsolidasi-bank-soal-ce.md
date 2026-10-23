# Rencana: Konsolidasi & Sistematisasi Proyek Bank Soal dengan Compound-Engineering Loop

> **Dibuat:** 2026-10-08
> **Sumber metodologi:** EveryInc/compound-engineering-plugin — `docs/guides/README.md`
> **Basis bukti:** audit file/commit nyata 15 proyek di `~/projects/` (bukan asumsi dari nama folder)

---

## 0. Diagnosa — kenapa proyek ini kacau

Kamu punya **15 folder** di `~/projects/`. Setelah diaudit, masalah sebenarnya **bukan** "kurang dokumen". Masalahnya ada **tiga lapis**, dan masing-masing butuh obat berbeda:

### Lapis A — Dokumentasi ada tapi BOHONG (drift doc→kode)

Ini yang kamu curigai, dan benar. Bukti keras:

| Proyek | Dokumen bilang | Kode sebenarnya | Bukti |
|---|---|---|---|
| **banksoal** | `docs/CAPABILITY-MAP.md` bilang `explorer-filter`: *"Realita: hanya Masonry yang terimplementasi; Grid & Table outstanding"* | Grid & Table **sudah selesai & ter-commit** (`6e469c4`) | `git log` banksoal |
| **banksoal** | CAPABILITY-MAP bilang `media-modal`, `question-editor`, `dashboard`, `mcp-server` — spec *"belum ditulis"* | `question-editor` **punya** `/questions/[id]/edit` (Task 16, commit `4a389ca`) | route ada di `src/app` |
| **soal** | `README.md` + `LANJUTKAN.md` bilang *"Berikutnya: Story 1.3 — MCP. 21 cerita: 2 selesai, 19 tersisa"* | MCP **sudah jalan**: `src/lib/mcp/server.ts` (48 KB), `entrypoint.test.ts`, script `"mcp"` di package.json. Epik 2–5 punya `retrospective` → artinya **jauh lebih dari 2 cerita selesai** | `ls src/lib/mcp/`, `_bmad-output/` |
| **mathbank** | 171 file `.md` di `docs/` | Beberapa plan masih `untracked` di git (`docs/plans/2026-10-06-*.md`) → belum masuk sejarah | `git status` mathbank |

### Lapis B — Kode jalan tapi TIDAK terdokumentasi sama sekali

| Proyek | Kondisi |
|---|---|
| **question-bank** | 450 MB konten `.tex`/PDF, 29 commit, **nol** README, **nol** docs, **nol** katalog. Ini bank soal riil terbesar & paling tak terdokumentasi |
| **soal** | `src/lib/worksheet/`, `scripts/check-arch.mjs`, `check:tokens`, `check:design` — semua jalan, tak ada di dokumen mana pun |
| **soal** | `_bmad-output/implementation-artifacts/` punya `retrospective` Epik 2,3,4,5 → progres riil tak dilaporkan di LANJUTKAN.md |
| **banksoal_pdf**, **templates**, **buddy**, **hermes** | Folder tanpa git/README — isinya tak jelas milik siapa |

### Lapis C — Duplikasi: 6 proyek bank soal yang saling tumpang tindih

`banksoal`, `qbank`, `mbank`, `question-bank`, `soal`, `mathbank`, `mathcore` — semuanya Next.js + Drizzle + PostgreSQL + KaTeX + ekspor Moodle. **Tidak ada dokumen yang menyatakan mana yang kanonik dan mana yang eksperimen mati.** Ini akar dari kebingungan: tiap minggu lahir repo baru, yang lama tak pernah ditutup.

### Yang sudah BENAR (jangan dirusak)

- **mathbank** — punya `docs/plans/`, `docs/superpowers/`, ADR, CHANGELOG 103 KB. Ini **paling matang**.
- **qbank** — 374 commit, 62 doc, ada `_archive/` yang rapi (specs-legacy, adr-legacy, pre-consolidation). **Pola arsip ini layak ditiru proyek lain.**
- **soal** — disiplin BMAD luar biasa: `deferred-work.md`, decision-ledger, spec per cerita. Cuma **statusnya tak pernah di-update**.
- **bankcore/mathcore, mbank** — ada PRD, ADR, DESIGN.md.

**Kesimpulan:** kamu tidak butuh "tulis dokumen dari nol". Kamu butuh **mekanisme yang memaksa dokumen dan kode tidak bisa berpisah lagi**. Itulah yang diberikan Compound-Engineering: `/ce-compound` sebagai langkah penutup loop.

---

## 1. Metodologi yang diadopsi (dari guide)

Core loop CE:

```
   [/ce-ideate]  (opsional) "Apa yang layak dieksplorasi?"
        │
        ▼
┌─→ /ce-brainstorm   "Ini harus jadi apa?"
│       │
│       ▼
│   /ce-plan         "Apa yang dibutuhkan untuk mencapainya?"
│       │
│       ▼
│   /ce-work         "Bangun."
│       │
│       ▼
└── /ce-compound     "Tangkap apa yang kita pelajari."
```

**Inti yang membuat loop ini *compound*:** `/ce-compound` menulis pelajaran ke `docs/solutions/`, lalu iterasi berikutnya membaca folder itu sebagai landasan. **Panah balik itulah intinya** — bukan langkah-langkahnya satu per satu.

### Aturan pemetaan ke situasimu

| Konsep CE | Padanan di ekosistemmu | Catatan |
|---|---|---|
| `STRATEGY.md` | `~/projects/BANK-SOAL-STRATEGY.md` (BARU, lintas-repo) | Anchor hulu: repo mana kanonik, mana mati |
| `docs/plans/` | sudah ada di mathbank, soal, qbank, mbank | standarkan nama |
| `docs/solutions/` | **BELUM ADA di proyek mana pun** | ini yang harus dibuat — rumah pelajaran |
| `docs/ideation/` | `_bmad-output/brainstorming/` (soal), `docs/ideas/` (banksoal) | sudah ada, tinggal diakui |
| `CODING_STANDARDS.md` | `CONSTRAINTS.md` + `AGENTS.md` | sudah ada, bagus |
| `docs_root` config | tiap repo punya akar berbeda | wajib diset agar artefak CE tak berhamburan |

---

## 2. Keputusan yang HARUS kamu ambil dulu (jangan lompat)

Rencana apa pun akan gagal kalau ini belum dijawab. Ini keputusan **hulu**, bukan tugas coding:

1. **Repo kanonik** — dari 6 bank soal, mana yang jadi **satu-satunya** produk hidup? Kandidat terkuat: `mathbank` (docs paling matang) atau `qbank` (374 commit, arsip rapi).
2. **Nasib sisanya** — tiap repo lain diputuskan: **(a) diarsipkan** (tag + README "SUPERSEDED BY X"), **(b) dijadikan library** (mis. `engine` = LaTeX class → jadi paket), atau **(c) dihapus**.
3. **`question-bank`** — 450 MB konten LaTeX. Ini **korpus**, bukan aplikasi. Perlu dipisah tegas: apakah jadi repo data tersendiri atau masuk `storage/corpus/` repo kanonik?
4. **Peran `soal`** — ia punya disiplin BMAD terbaik + MCP jalan, tapi dokumennya basi. Dilanjutkan sebagai produk, atau dilebur jadi lapisan MCP milik repo kanonik?

> **Rekomendasi saya:** jawab #1 dan #2 dalam **satu sesi** dengan `/ce-brainstorm` (bukan dengan menulis dokumen manual). Output-nya jadi `STRATEGY.md` lintas-repo. Tanpa ini, langkah 3–6 hanya menambah dokumen basi baru.

---

## 3. Rencana eksekusi bertahap

### Fase 0 — Fondasi lintas-repo (½ hari)

Tujuan: ada satu tempat yang menyatakan kebenaran, sebelum menyentuh 15 repo.

- [ ] **0.1** Buat `~/projects/BANK-SOAL-STRATEGY.md` — berisi: repo kanonik, peran tiap repo, status (hidup/arsip/library), dan *why*. Ini anchor hulu loop.
- [ ] **0.2** Buat `~/projects/REGISTRY.md` — tabel 15 repo × {peran, status, punya docs?, docs terakhir update, commit terakhir, drift terdeteksi}.
- [ ] **0.3** Install compound-engineering-plugin (atau salin 4 skill inti: `ce-brainstorm`, `ce-plan`, `ce-work`, `ce-compound`).
- [ ] **0.4** Tetapkan konvensi artefak seragam untuk semua repo:
  ```
  docs/plans/YYYY-MM-DD-<slug>.md
  docs/solutions/YYYY-MM-DD-<slug>.md      ← BARU, wajib
  docs/ideation/                            ← atau _bmad-output/brainstorming/
  STRATEGY.md → symlink/pointer ke ~/projects/BANK-SOAL-STRATEGY.md
  ```

### Fase 1 — Perbaiki drift di repo kanonik (1 hari)

Setelah kanonik dipilih, **jangan sentuh yang lain dulu**. Untuk repo kanonik:

- [ ] **1.1** Jalankan `/ce-plan` dengan input: *"Rekonsiliasi dokumen vs kode"* — hasilkan daftar U-ID tiap klaim dokumen yang perlu diverifikasi ke kode.
- [ ] **1.2** Untuk **setiap** klaim di README/ARCHITECTURE/CAPABILITY-MAP, buat tabel: `Klaim → Cara verifikasi → Hasil (benar/basi/salah) → Aksi`.
- [ ] **1.3** Perbaiki / hapus klaim basi. Utamakan yang menyesatkan agen (mis. banksoal CAPABILITY-MAP, soal LANJUTKAN.md).
- [ ] **1.4** Commit dengan pesan `docs: rekonsiliasi status vs kode (<tanggal>)`.

### Fase 2 — Terapkan loop CE ke repo kanonik (2–3 hari, bertahap)

Ini inti metodologi. Satu iterasi kerja **harus** menutup loop:

- [ ] **2.1** Pilih **satu** potongan kerja riil (bukan dokumentasi) — mis. fitur yang memang sedang dikerjakan.
- [ ] **2.2** `/ce-brainstorm` → tulis requirement, bukan requirement-only speculation.
- [ ] **2.3** `/ce-plan` → guardrail + U-ID + skenario tes.
- [ ] **2.4** `/ce-work` → implementasi, lewat quality gate.
- [ ] **2.5** **`/ce-compound`** → tulis pelajaran ke `docs/solutions/`. **Ini langkah yang WAJIB dan belum pernah kamu lakukan.**
- [ ] **2.6** Ulangi 2–3 kali. Setelah 3 iterasi, ukur: apakah `docs/solutions/` benar-benar dibaca di brainstorm berikutnya? Kalau tidak, loop-nya gagal dan perlu dibedah.

### Fase 3 — Dokumentasikan yang tak terdokumentasi (1–2 hari)

Khusus Lapis B:

- [ ] **3.1** `question-bank`: tulis `README.md` + `CATALOG.md` (indeks 450 MB konten: mapel, kelas, sekolah, sumber, tahun). **Verifikasi tiap entri ke file nyata**, jangan mengarang.
- [ ] **3.2** `soal`: update `LANJUTKAN.md` — status sebenarnya (Epik berapa benar-benar selesai? cek `retrospective` tiap epik), MCP yang sudah jalan, `worksheet/`, `check-arch.mjs`.
- [ ] **3.3** Tulis `docs/solutions/` pertama untuk repo kanonik — isinya pelajaran dari audit drift hari ini (mis. *"status di README mudah basi karena tidak ada gate; pasang check"*).

### Fase 4 — Tambahkan gate anti-drift (1 hari) ← KUNCI

Dokumen tanpa gate **pasti** basi lagi. Ini yang mengubah kebiasaan:

- [ ] **4.1** Buat script `check:doc-status` — gagal bila `docs/` lebih tua dari `src/` melebihi N hari, atau bila ada `docs/plans/*.md` yang belum ada pasangan `docs/solutions/*.md` setelah plan tercapai.
- [ ] **4.2** Masukkan ke `pnpm test` (soal sudah punya pola ini: `check:arch`, `check:tokens`, `check:design` — **tiru!**).
- [ ] **4.3** Tambahkan ke CI (`.github/workflows`) — gate harus otomatis, bukan niat baik.
- [ ] **4.4** Gate kedua: tolak PR yang mengubah `src/` tanpa mengubah `docs/` bila menyentuh area ber-ADR.

### Fase 5 — Arsenalisi & bersihkan sisanya (1 hari)

- [ ] **5.1** Untuk tiap repo yang diputuskan "arsip": tag `archived-YYYY-MM-DD`, tulis `README.md` satu baris *"SUPERSEDED BY <kanonik> — lihat BANK-SOAL-STRATEGY.md"* (tiru pola `docs/_archive/` milik qbank).
- [ ] **5.2** Untuk `engine` (LaTeX class `mathmyid.cls`): promosikan jadi paket/library dengan versi.
- [ ] **5.3** Hapus/tangani folder yatim: `banksoal_pdf`, `templates`, `buddy`, `hermes` — putuskan isinya.
- [ ] **5.4** Update `REGISTRY.md` final + `STRATEGY.md` dengan hasil.

### Fase 6 — Loop maintenance jangka panjang

- [ ] **6.1** `/ce-sweep` mingguan: sapu item tertunda → rolling plan.
- [ ] **6.2** `/ce-compound-refresh` bulanan: rawat `docs/solutions/` (Keep/Update/Consolidate/Replace/Delete).
- [ ] **6.3** `/ce-product-pulse` bulanan: laporan jendela waktu → `docs/pulse-reports/`.
- [ ] **6.4** **Larang** membuat repo baru tanpa entri di `STRATEGY.md` + `REGISTRY.md`. Ini obat akar Lapis C.

---

## 4. Urutan & ketergantungan

```
Fase 0 ──► Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 5
(fondasi)  (drift)    (loop CE)  (dokumentasi)  (bersih-bersih)
                  │
                  └──► Fase 4 (gate) ──► Fase 6 (maintenance)
```

- **Fase 0 memblokir segalanya** — tanpa pilihan repo kanonik, sisanya sia-sia.
- **Fase 2 harus jalan sebelum Fase 4** — gate hanya masuk akal kalau loop-nya sudah terbukti.
- **Fase 3 & 5 bisa paralel** setelah kanonik ditetapkan.

---

## 5. Ukuran keberhasilan (terukur)

| Metrik | Sekarang | Target 30 hari |
|---|---|---|
| Klaim dokumen yang terbukti basi vs kode | ≥ 4 kasus ditemukan | **0** di repo kanonik |
| `docs/solutions/` | 0 file | ≥ 5 file, tiap iterasi |
| Iterasi kerja yang menutup loop CE | 0 | 100% potongan kerja |
| Repo tanpa README | 4 (`question-bank`, `banksoal_pdf`, `templates`, `hermes`) | 0 |
| Repo status tak jelas (kanonik/mati) | 6 bank soal kabur | 1 kanonik + sisanya berlabel |
| Gate anti-drift di CI | 0 | ≥ 1 (`check:doc-status`) |

---

## 6. Jebakan yang sudah terlihat (hindari)

1. **Menulis dokumen baru di atas dokumen basi** — itu hanya menambah entropi. **Rekonsiliasi dulu, tulis kemudian.** (Fase 1 sebelum 3.)
2. **Memilih kanonik berdasarkan ukuran/commit terbanyak.** qbank punya 374 commit & 8,1 GB, tapi mathbank yang docs-nya paling matang. Ukur dengan *kualitas hidup repo*, bukan volume.
3. **Menyalin folder `docs/` antar repo mentah-mentah.** mathbank punya 171 file — sebagian besar plan harian, bukan arsitektur. Salin **polanya**, bukan isinya.
4. **Menambah gate sebelum ada `docs/solutions/`.** Gate tanpa isi = dinding kosong; orang akan mematikan gate-nya.
5. **Menyentuh 15 repo sekaligus.** Fase 1 & 2 hanya untuk repo kanonik. Sisanya di Fase 5, setelah terbukti.
6. **Menganggap `_bmad-output/` dan `docs/` sebagai dua sistem.** soal pakai BMAD, mathbank pakai `docs/superpowers/`. Tetapkan **satu** konvensi di Fase 0.4, lalu petakan yang lama ke sana jangan biarkan dua tradisi hidup.

---

## 7. Langkah paling pertama, hari ini

Jangan mulai dari Fase 1. Mulai dari **Fase 0.1 + 0.2**, karena:

> Selama belum ada dokumen yang menjawab *"repo mana yang kanonik dan kenapa"*, setiap perbaikan dokumen lain hanya menambah kebingungan — bukan mengurangi.

**Aksi minimal 1 jam pertama:**
1. Tulis draf `~/projects/BANK-SOAL-STRATEGY.md` (jawab §2 #1 & #2, walau sementara).
2. Tulis `~/projects/REGISTRY.md` dari tabel audit di §0.
3. Commit keduanya sebagai akar semua dokumen.

Setelah itu, pilih repo kanonik dan jalankan `/ce-brainstorm` dengan prompt:
> *"Repo kanonik bank soal adalah <X>. Rancang bagaimana proyek lain diarsipkan/dilebur, dan bagaimana loop CE dipasang agar dokumen tidak pernah basi lagi."*
