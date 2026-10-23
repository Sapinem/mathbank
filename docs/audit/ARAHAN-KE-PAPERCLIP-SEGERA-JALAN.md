# ⚡ ARAHAN KE PAPERCLIP — JALANKAN SEGERA MATHBANK V2

## *Task Directive No. 01/2026 — Immediate & Compressed Execution*

> **Dari:** CodeBuddy (Code Review / Program Steering)  
> **Kepada:** Paperclip — Program Coordinator & AI Evaluation Agent  
> **Tanggal:** 19 Oktober 2026  
> **Materi:** Instruksi langsung mulai eksekusi MathBank V2 **HARI INI**, kompresi 4 minggu → 7 hari  
> **Repositori:** `/home/hari/projects/mathbank` · Branch: `paperclip/dev`  
> **Dokumen Acuan:** `docs/RENCANA-MATHBANK-V2.md`, `docs/audit/CROSS-AUDIT-ACTION-PLAN-V2.md`, `docs/audit/CROSS-AUDIT-MASTER-FINDINGS.md`  
> **Status:** 🔥 **EXECUTE NOW — DEADLINE HARI INI, TARGET V2-READY 26 OKT 2026**

---

## 0. RINGKASAN PERINTAH (TL;DR)

**Paperclip, mulai SEKARANG. Bukan besok. Bukan minggu depan. HARI INI, 19 Oktober 2026.**

Timeline asli action plan V2 = 4 minggu. **Saya kompresi jadi 7 hari** (19–26 Okt 2026) dengan strategi:

1. **Tidak ada sprint mingguan** — ganti jadi **sprint harian** (Day 1–7)
2. **Tim 4 orang paralel** — Salman/Ichsan/Bilal/Faruq kerja bersamaan, bukan sekuensial
3. **15 dari 22 ACT tidak butuh persetujuan CEO** — langsung jalan hari ini
4. **3 keputusan CEO berjalan paralel** — saat turun, unblock ACT-07/12/16
5. **Daily standup 3× sehari** (09.00, 13.00, 17.00) bukan 1× sehari
6. **Working tree dirapikan malam ini paralel dengan eksekusi ACT-01/02/03**

**Hari ini (19 Okt) sebelum tidur:** 6 task checklist (§3) + mulai ACT-01/02/03 malam ini juga.

**Target V2-READY: 26 Oktober 2026** (bukan 16 November).

Mulai. 🚀

---

## 1. KONTEKS & MANDAT

### 1.1 Mengapa 7 Hari Cukup

Konsolidasi 9 audit menunjukkan mayoritas ACT adalah **perbaikan teknis murni** dengan effort kecil (jam, bukan hari):

- 6 ACT Sprint 0 = total **~3 hari-orang** jika paralel (Salman 1.5 hari, Ichsan 1 hari, Bilal 0.25 hari)
- 5 ACT non-blocking lain (ACT-08/10/11/17/18) = **~3 hari-orang** paralel
- Backfill embedding 11.889 soal = **batch malam 1 malam** (BGE-M3 di port 3005, 16/batch)
- Refactor `question-editor.tsx` & `enrich.ts` = **1.5 hari** paralel Ichsan+Salman

Total: ~10 hari-orang ÷ 4 orang paralel + 1 malam batch = **7 hari kalender**.

### 1.2 Mandat Paperclip

Anda, Paperclip, ditunjuk sebagai **Program Coordinator** dengan kewenangan:

1. **Tracking sprint harian** — 7 sprint, 1 sprint = 1 hari
2. **Koordinasi 4 spesialis paralel** — Salman, Ichsan, Bilal, Faruq
3. **Daily standup 3× sehari** — 09.00, 13.00, 17.00 WIB via `#mathbank-v2`
4. **Eskalasi** — blocker >4 jam → naikkan ke CEO via Telegram
5. **Laporan progres** — ke CEO tiap akhir hari 18.00 WIB

**Anda tidak menunggu persetujuan CEO untuk mulai. Mulai hari ini.**

---

## 2. MATRIKS DEPENDENSI: ACT VS PERSETUJUAN CEO

| ACT | Aksi | Butuh CEO? | Effort |
|:---:|---|:---:|:---:|
| ACT-01 | Backup cron harian | ❌ | 2 jam |
| ACT-02 | Scrub logger + `/api/health` | ❌ | 4 jam |
| ACT-03 | Normalisasi label metrik + `prune()` | ❌ | 4 jam |
| ACT-04 | Eliminasi waterfall `/bundles` | ❌ | 1 hari |
| ACT-05 | Optimasi bulk update status | ❌ | 1 hari |
| ACT-06 | Sinkron `AGENTS.md` + `README.md` | ❌ | 2 jam |
| ACT-07 | Backfill embedding 11.889 soal | ✅ | 1 malam |
| ACT-08 | Parser `question_media` | ❌ | 4 jam |
| ACT-09 | Klasifikasi topik | ⚠️ transitif | 1.5 hari |
| ACT-10 | Master tags dari curriculum | ❌ | 4 jam |
| ACT-11 | Pewarisan `event_id` | ❌ | 4 jam |
| ACT-12 | Promosi `draft → ready` | ✅ | 4 jam |
| ACT-13 | Triase 3.034 flagged | ⚠️ transitif | 1 hari |
| ACT-14 | Triase 699 short | ⚠️ transitif | 4 jam |
| ACT-15 | Inferensi difficulty/grade | ⚠️ transitif | 1 hari |
| ACT-16 | Refactor `question-editor.tsx` | ✅ | 1.5 hari |
| ACT-17 | MediaImage CLS + ETag 304 | ❌ | 4 jam |
| ACT-18 | Zod schema 34 route | ❌ | 1 hari |
| ACT-19 | Cache KaTeX + font preload | ❌ | 4 jam |
| ACT-20 | Satukan fetcher klien | ❌ | 4 jam |
| ACT-21 | Alerting error-budget | ❌ | 4 jam |
| ACT-22 | CEO sign-off | ✅ | 2 jam |

**Ringkasan:** ✅ 15 ACT tanpa CEO (mulai sekarang) · ⚠️ 4 transitif · ✅ 4 butuh CEO paralel

---

## 3. CHECKLIST HARI INI (19 OKT, mulai sekarang)

**Wajib selesai malam ini. Estimasi total: 3-4 jam.**

### Task 1: Commit Dokumen Konsolidasi Audit (15 menit)

```bash
cd /home/hari/projects/mathbank
git add docs/audit/CROSS-AUDIT-MASTER-FINDINGS.md \
        docs/audit/CROSS-AUDIT-EXECUTIVE-SUMMARY.md \
        docs/audit/CROSS-AUDIT-ACTION-PLAN-V2.md \
        docs/audit/ARAHAN-CROSS-AUDIT-KONSOLIDASI-V2.md \
        docs/audit/EVALUASI-MATHBANK-V2-PILLAR1-FULL.md \
        docs/audit/AUDIT-DATA-SNAPSHOT-2026-10-19.csv \
        docs/audit/ARAHAN-KE-PAPERCLIP-SEGERA-JALAN.md \
        docs/PETA-DOKUMEN.md
git commit -m "docs(audit): konsolidasi 9 audit V2 + arahan eksekusi 7 hari terkompresi"
```

### Task 2: Rapikan Working Tree (45 menit)

Working tree: 30 file modified + 4 untracked. Kerapikan per-area:

```bash
# 1. Pindahkan MatBankReview.md ke docs/audit/
mv MatBankReview.md docs/audit/MatBankReview.md

# 2. Hapus folder MathBankAuditor/ duplikat di dalam mathbank
rm -rf MathBankAuditor/

# 3. Commit per-area
git add src/lib/ingest/ && git commit -m "fix(ingest): normalisasi parser adapters & KaTeX cleaner"
git add src/lib/math/ && git commit -m "fix(math): perbaikan katex-lint untuk delimiter unclosed"
git add src/components/ && git commit -m "fix(ui): perbaikan question-editor & bundle print view"
git add src/styles/ src/app/globals.css src/app/layout.tsx && git commit -m "fix(ui): gutter 24px print + preload font KaTeX"
git add src/app/api/ && git commit -m "fix(api): pemisahan metrik failedQuestions/failedArticles di ingest commit"
git add src/lib/services/ && git commit -m "fix(services): question-status state machine adjustment"
git add scripts/ && git commit -m "fix(scripts): sterilisasi seed-events (cabut PAS-SAS & Try Out)"
git add docs/RENCANA-MATHBANK-V2.md docs/KEAMANAN.md docs/AXIOM-VS-MATHBANK-COMPARISON.md CHANGELOG.md && git commit -m "docs: sinkron rencana V2 & keamanan pasca-audit konsolidasi"
git add tsconfig.json && git commit -m "chore: tsconfig path adjustment"
git add docs/audit/MatBankReview.md docs/PETA-DOKUMEN.md && git commit -m "docs: pindahkan MatBankReview & daftarkan dokumen audit konsolidasi"
```

### Task 3: Bersihkan 42 Warning ESLint (30 menit)

Mayoritas di `scripts/dev/` (scratch files). Tambahkan ke `globalIgnores`:

```js
// eslint.config.mjs — di globalIgnores array
"scripts/dev/**"  // scratch investigator files, tidak lint
```

Untuk 3 file `src/` aktif:
- `src/lib/ingest/event-resolve.test.ts:1` — hapus `vi` dari import
- `src/lib/ingest/parsers/adapters/mathcyber-khusus.ts:43` — hapus `tutupBoxedBracket`
- `src/lib/ingest/parsers/katex-repair.ts:459` — prefix `_` untuk `off`/`full` yang sengaja skip

Verifikasi: `pnpm lint` → 0 error, 0 warning.

### Task 4: Siapkan Kanal Komunikasi (15 menit)

1. Buat/tentukan kanal `#mathbank-v2` (Telegram group paling cepat)
2. Tambahkan anggota: Salman, Ichsan, Bilal, Faruq, Zaid (observer)
3. Set recurring standup 3× sehari: 09.00, 13.00, 17.00 WIB

### Task 5: Kirim Arahan ke CEO (10 menit)

```
@zaid

📋 MATHBANK V2 — PERMINTAAN PERSETUJUAN CEPAT

Konsolidasi 9 audit selesai. Skor: 6.0/10. 42 temuan (8 P0, 20 P1, 8 QW, 6 outdated).
Detail: docs/audit/CROSS-AUDIT-MASTER-FINDINGS.md

Saya mulai eksekusi HARI INI 19 Okt — 15 dari 22 ACT tidak butuh keputusan Anda.
Timeline kompresi: 7 hari (target V2-ready 26 Okt, bukan 16 Nov).

Mohon jawab 3 keputusan strategis (CEPAT, tidak blocking):
1. Kriteria promosi draft→ready (5 syarat ketat) — butuh utk ACT-12
2. Backfill embedding malam ini 22-06 WIB port 3005 — butuh utk ACT-07 malam ini
3. Refactor file >300 baris (question-editor + enrich) — butuh utk ACT-16

Jawab: SETUJU SEMUA / TOLAK / REVISI. Saya tunggu 2 jam.

Sprint review tiap hari 18.00 WIB. Sign-off target 26 Okt 2026.

— Paperclip
```

### Task 6: Mulai ACT-01, ACT-02, ACT-03 MALAM INI juga (jangan tunggu besok)

Setelah Task 1-5 selesai (~2 jam), **langsung mulai ACT-01/02/03 malam ini**. Salman handle 3 ACT ini sekaligus:

- **ACT-01** backup cron — 2 jam, bisa setup sambil kerja ACT-02
- **ACT-02** scrub logger — 4 jam
- **ACT-03** normalisasi label + prune — 4 jam

Total: Salman selesai 3 ACT ini sebelum jam 23.00 WIB malam ini.

### Task 7: Verifikasi Pre-Flight (10 menit)

Sebelum tidur, jalankan:

```bash
pnpm typecheck     # 0 error
pnpm lint          # 0 error, 0 warning (setelah Task 3)
pnpm test          # 980+ passed
node scripts/check-names.mjs   # PASS
pnpm db:verify     # 26 tabel, 24 trigger, 0 drift
git status         # clean
```

---

## 4. JADWAL EKSEKUSI 7 HARI (19–26 OKT 2026)

### 🔥 HARI 1 — Senin 19 Okt 2026 (HARI INI)

**Mulai SEKARANG. Bukan besok.**

| Jam | Task | Assignee | DoD |
|:---:|---|:---:|---|
| SEKARANG | Task 1-5 checklist (§3) | Paperclip | 6 task selesai |
| 20.00 | ACT-01 backup cron | Salman | Cron 02.00 WIB aktif |
| 20.30 | ACT-02 scrub logger | Salman | PR terbuka + unit test redaksi |
| 21.00 | ACT-03 normalisasi metrik + prune | Salman | PR terbuka + MAX_ROUTES=200 |
| 20.00 | ACT-06 sinkron AGENTS.md | Bilal | PR terbuka, angka cocok db:verify |
| 20.00 | Cleanup 42 warning ESLint | Ichsan | pnpm lint 0 warning |
| 22.00 | Standup 1 (status hari ini + blocker) | Paperclip | — |

**Gate Day 1:** Working tree bersih + cron backup aktif + 42 warning hilang + AGENTS.md sinkron + 3 PR terbuka (ACT-01/02/03).

---

### 🔥 HARI 2 — Selasa 20 Okt 2026

| Jam | Task | Assignee | DoD |
|:---:|---|:---:|---|
| 09.00 | Standup 2 | Paperclip | — |
| 09.00 | ACT-04 eliminasi waterfall `/bundles` | Ichsan | PR terbuka, useAllBundles dihapus |
| 09.00 | ACT-05 optimasi bulk update | Salman | PR terbuka, bulk 200 <300ms |
| 09.00 | ACT-08 parser `question_media` | Salman (paralel) | question_media ≥1.500 baris |
| 13.00 | Standup 3 | Paperclip | — |
| 14.00 | ACT-10 master tags curriculum | Salman | ≥50 tag di tabel tags |
| 14.00 | ACT-11 pewarisan event_id | Salman | event_id coverage ≥85% |
| 17.00 | Standup 4 + laporan ke CEO 18.00 | Paperclip | — |

**Gate Day 2:** Sprint 0 SELESAI (ACT-01..06) + 3 ACT non-blocking (08/10/11) selesai. `pnpm check` HIJAU 100%.

**Jika CEO sudah SETUJU Keputusan 2 (backfill embedding):**
- 22.00 WIB malam ini → mulai ACT-07 backfill embedding 11.889 soal (batch malam, 16/batch, idempoten)
- Berjalan semalaman, selesai sebelum 06.00 WIB Day 3

---

### 🔥 HARI 3 — Rabu 21 Okt 2026

| Jam | Task | Assignee | DoD |
|:---:|---|:---:|---|
| 09.00 | Standup 5 + cek hasil backfill embedding (ACT-07) | Paperclip | embedding ≥99% |
| 09.00 | ACT-09 klasifikasi topik (mulai) | Salman+Faruq | paralel |
| 09.00 | ACT-17 MediaImage CLS + ETag 304 | Ichsan+Salman | CLS=0, 304 berfungsi |
| 13.00 | Standup 6 | Paperclip | — |
| 14.00 | ACT-19 cache KaTeX + preload font | Ichsan | token tidak re-parse, no FOIT |
| 14.00 | ACT-20 satukan fetcher klien | Ichsan | 7 hook pakai api() tunggal |
| 17.00 | Standup 7 + laporan ke CEO 18.00 | Paperclip | — |

**Gate Day 3:** Embedding ≥99% + topik mulai jalan + ACT-17/19/20 selesai.

**Jika CEO sudah SETUJU Keputusan 3 (refactor):**
- Day 4 → mulai ACT-16 refactor `question-editor.tsx` (Ichsan) + `enrich.ts` (Salman) paralel

---

### 🔥 HARI 4 — Kamis 22 Okt 2026

| Jam | Task | Assignee | DoD |
|:---:|---|:---:|---|
| 09.00 | Standup 8 | Paperclip | — |
| 09.00 | ACT-09 klasifikasi topik (lanjut) | Salman+Faruq | ≥95% soal punya topik |
| 09.00 | ACT-16 refactor question-editor.tsx (mulai) | Ichsan | — |
| 13.00 | Standup 9 | Paperclip | — |
| 14.00 | ACT-18 Zod schema 34 route (mulai) | Salman | — |
| 17.00 | Standup 10 + laporan ke CEO 18.00 | Paperclip | — |

**Gate Day 4:** Topik ≥95% + ACT-16 separuh jalan + ACT-18 separuh jalan.

---

### 🔥 HARI 5 — Jumat 23 Okt 2026

| Jam | Task | Assignee | DoD |
|:---:|---|:---:|---|
| 09.00 | Standup 11 | Paperclip | — |
| 09.00 | ACT-16 refactor selesai | Ichsan | 4 sub-komponen <300 baris |
| 09.00 | ACT-18 Zod schema selesai | Salman | 51/51 route Zod |
| 13.00 | Standup 12 | Paperclip | — |
| 14.00 | ACT-21 alerting error-budget | Salman | cron alert aktif |

**Jika CEO sudah SETUJU Keputusan 1 (kriteria promosi):**
- 15.00 → mulai ACT-12 promosi `draft→ready` (kriteria 5-syarat) — Salman+Faruq
- 16.00 → ACT-13 triase 3.034 flagged — Faruq
- 17.00 → ACT-14 triase 699 short — Faruq

**Gate Day 5:** 51/51 Zod + refactor selesai + alerting aktif.

---

### 🔥 HARI 6 — Sabtu 24 Okt 2026

| Jam | Task | Assignee | DoD |
|:---:|---|:---:|---|
| 09.00 | Standup 13 | Paperclip | — |
| 09.00 | ACT-12 promosi draft→ready (lanjut) | Salman+Faruq | ≥8.000 soal ready |
| 09.00 | ACT-13 triase flagged | Faruq | backlog tersegmentasi |
| 09.00 | ACT-14 triase short | Faruq | 699 terklasifikasi |
| 13.00 | Standup 14 | Paperclip | — |
| 14.00 | ACT-15 inferensi difficulty/grade | Faruq+Salman | distribusi 1-5, ai_tagged=true |
| 17.00 | Standup 15 + laporan ke CEO 18.00 | Paperclip | — |

**Gate Day 6:** ≥8.000 soal `ready` + difficulty terdistribusi + 0 file >300 baris.

---

### 🔥 HARI 7 — Minggu 25 Okt 2026

| Jam | Task | Assignee | DoD |
|:---:|---|:---:|---|
| 09.00 | Standup 16 — final review | Paperclip | — |
| 09.00 | Verifikasi seluruh 9 DoD V2 | Zaid+Paperclip | lihat §6 |
| 13.00 | Fix sisa temuan minor | semua | — |
| 17.00 | Final standup + laporan akhir | Paperclip | — |

---

### 🎯 HARI 8 — Senin 26 Okt 2026

**ACT-22: CEO Sign-Off** — Zaid verifikasi final.

```
✅ MathBank V2 SIAP RILIS PRODUKSI
📅 26 Oktober 2026
🎯 Dari skor 6.0/10 → ≥9.0/10 dalam 7 hari
```

---

## 5. ATURAN MUTLAK EKSEKUSI TERKOMPRESI

1. 🚦 **`pnpm check` wajib HIJAU sebelum merge apapun** — PR merah = reject otomatis
2. 🛡️ **Tidak ada backfill tanpa backup** — ACT-01 selesai sebelum ACT-07/08/11
3. 📝 **Setiap ACT wajib evidence** — query output, test result, screenshot (CONSTRAINTS #44)
4. 🌐 **Bahasa Indonesia** untuk laporan, commit, dokumentasi (CONSTRAINTS #28)
5. 🌿 **Branch konvensi:** `v2/day-N/act-XX-<slug>` dari `paperclip/dev`
6. 🚫 **Tidak ada PR tanpa review** — minimum 1 reviewer
7. 🚨 **Eskalasi 4 jam, bukan 24 jam** — blocker >4 jam → Telegram CEO langsung
8. ⚡ **Standup 3× sehari** — 09.00, 13.00, 17.00 WIB via `#mathbank-v2` (3 poin: progress, hari ini, blocker)
9. 🌙 **Eksekusi malam diperbolehkan** — khusus ACT-07 backfill embedding (22.00–06.00 WIB)

---

## 6. DEFINITION OF DONE MATHBANK V2 (9 INDIKATOR)

V2 dinyatakan **SIAP RILIS PRODUKSI** apabila **seluruh 9 indikator** terpenuhi:

| # | Indikator | Target | Verifikasi |
|:---:|---|---|---|
| 1 | Quality Gate | `pnpm check` HIJAU 100% (tsc + eslint + vitest, coverage ≥90%) | `pnpm check` exit 0 |
| 2 | Total soal | ≥11.850 | `SELECT count(*) FROM questions WHERE deleted_at IS NULL` |
| 3 | Status `ready` | ≥8.000 soal (≥67% korpus) | `SELECT count(*) FROM questions WHERE status='ready'` |
| 4 | Embedding coverage | ≥99% terisi vektor 1024d | `SELECT count(*) FROM questions WHERE embedding IS NOT NULL` |
| 5 | Taksonomi mapping | ≥95% soal terpetakan ke topik | `SELECT count(*) FROM question_topics` |
| 6 | Relasi media | ≥1.500 aset tersambung | `SELECT count(*) FROM question_media` |
| 7 | Performa Web | Latensi p95 ≤300ms + paginasi server `/bundles` + CLS ≤0,05 | Playwright + Lighthouse |
| 8 | Keamanan | 0 kebocoran kredensial/stack + 51/51 route Zod | `grep -r "err.message" src/app/api/` |
| 9 | Operasional | Backup database terjadwal harian otomatis | `ls backups/` ada file hari ini |

**Target sign-off CEO final:** **26 Oktober 2026** (7 hari dari sekarang, bukan 4 minggu).

---

## 7. RISIKO & MITIGASI TERKOMPRESI

| Skenario | Mitigasi |
|---|---|
| CEO tidak jawab 2 jam | Paperclip mulai ACT-01..06 tanpa menunggu; CEO jawab kapan saja |
| CEO tolak Keputusan 1 (kriteria promosi) | Susun 3 opsi (longgar/sedang/ketat) + re-ajukan dalam 1 jam |
| CEO tolak Keputusan 2 (backfill malam) | Ajukan backfill pagi 06.00–10.00 dengan throttle 8/batch |
| CEO tolak Keputusan 3 (refactor) | Tunda ke P2; V2 lanjut dengan file besar (catat utang teknis) |
| Backfill embedding tidak selesai 1 malam | Lanjut malam kedua (Day 3→4 malam) |
| Klasifikasi topik akurasi <90% | Faruq audit 100 sampel sebelum full backfill |
| Refactor question-editor pecah interaksi | Tes e2e Playwright sebagai gate + branch terpisah |
| Tim kelelahan 7 hari non-stop | Istirahat wajib Day 7 (Minggu) setelah sign-off |
| Working tree belum bersih saat mulai | Task 2 (§3) wajib selesai sebelum ACT apapun |

---

## 8. LAPORAN PROGRES

### Standup 3× Sehari (09.00, 13.00, 17.00 WIB via `#mathbank-v2`)

Format 3 poin per anggota:
1. **Sejak standup terakhir:** apa yang selesai
2. **Sampai standup berikutnya:** apa yang akan dikerjakan
3. **Blocker:** ada/tidak (jika ada, Paperclip koordinasi dalam 4 jam)

### Laporan Harian ke CEO (18.00 WIB)

Format:
```
@zaid
📊 MATHBANK V2 — LAPORAN HARI [N/7]

Skor: [X]/10 (naik [delta] dari 6.0).
ACT selesai hari ini: [list]. ACT berjalan: [list].
Blocker: [list/tidak ada].

Gate Day [N] tercapai: [ya/tidak — detail].
Estimasi V2-ready: 26 Okt 2026.

— Paperclip
```

---

## 9. PENUTUP

Paperclip, **mulai SEKARANG.**

- Anda punya mandat penuh sebagai Program Coordinator
- 15 ACT siap eksekusi tanpa persetujuan CEO
- Timeline kompresi: **7 hari** (target V2-ready 26 Okt 2026)
- Tim 4 orang paralel, bukan sekuensial
- Standup 3× sehari (09.00, 13.00, 17.00) — bukan 1× sehari
- Checklist malam ini (§3) wajib selesai + **mulai ACT-01/02/03 malam ini juga**

> *Tidak ada alasan menunggu. Tidak ada alasan 4 minggu. Tim sudah ditunjuk. Cetak biru sudah final. Action plan sudah siap. Yang tersisa hanya eksekusi disiplin 7 hari ke depan.*

> *Hari 1 dimulai saat Anda baca dokumen ini. Bukan besok pagi.*

**Mulai. 🚀**

---

**Hormat saya,**

**CodeBuddy**  
Code Review & Program Steering  
MathBank v2.0 Preparation  
19 Oktober 2026

---

## 📎 LAMPIRAN: DOKUMEN ACUAN

| Dokumen | Lokasi | Peran |
|---|---|---|
| Cetak Biru V2 | `docs/RENCANA-MATHBANK-V2.md` | Arsitektur target 10 bab |
| Master Findings | `docs/audit/CROSS-AUDIT-MASTER-FINDINGS.md` | Sumber kebenaran 42 temuan |
| Action Plan V2 | `docs/audit/CROSS-AUDIT-ACTION-PLAN-V2.md` | Rencana 22 ACT detail |
| Executive Summary | `docs/audit/CROSS-AUDIT-EXECUTIVE-SUMMARY.md` | Ringkasan skor & blocker |
| CONSTRAINTS | `CONSTRAINTS.md` | 46 batasan mutu mekanis |
| AGENTS.md | `AGENTS.md` | Konvensi tim & status proyek |


---

## § Catatan Verifikasi

- **Verifikator:** CodeBuddy (agen), 2026-10-23.
- **Metode:** cek keberadaan seluruh dokumen rujukan pada tabel akhir; silang 42 temuan & 22 ACT; bandingkan klaim kondisi repo (ESLint, test, working tree) dengan hasil `pnpm lint`, `pnpm test`, dan `git log` 2026-10-23.
- **Terverifikasi benar:** semua dokumen rujukan ada; 42 temuan (8 P0/20 P1/8 QuickWin/6 outdated) dan 22 ACT konsisten dengan master findings & action plan; CONSTRAINTS berisi 46 batasan.
- **Koreksi:** "42 warning ESLint" → **0 error, 0 warning** (commit `fcf990d`); "rapikan working tree 30 file" → sudah di-commit (`fcf990d`, `460a1ac`, `5d55f3c`); "980 test" → **1.104**. Timeline 7 hari (target 26 Okt 2026) tetap tercatat; pencapaiannya tidak dinilai dalam catatan ini.
- **Status:** ⚠️ arahan historis 19 Okt — jangan dipakai sebagai status terkini tanpa cek `docs/SNAPSHOT-METRIK-2026-10-21.md`.
