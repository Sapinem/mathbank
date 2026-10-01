# PETA-DOKUMEN.md — Indeks & Tata Kelola Dokumen MathBank

> **Tujuan:** satu peta hidup — apa yang **sudah ada**, apa yang **direncanakan**, kapan wajib dibuat, dan siapa pemiliknya. Mencegah "dokumen lupa".
> **Status:** 📝 dibuat 2026-09-29 (menjawab "dokumen apa yang belum ada untuk aplikasi enterprise").
> **Aturan:** dokumen ditulis **saat relevan** (prinsip "install saat perlu"), tetapi **wajib tercatat di sini** sejak direncanakan.

---

## 0. Legenda

| Simbol | Arti |
|--------|------|
| ✅ | Sudah ada & dipelihara |
| 🟡 | Ada tetapi perlu diperbarui (drift) |
| 🔴 | Belum ada — **kritis** (enterprise) |
| 🟠 | Belum ada — penting (sebelum produksi) |
| 🟢 | Belum ada — menyusul (per-milestone) |
| 📦 | Arsip (era QBank / tak lagi aktif) |

---

## 1. Peta Dokumen Lengkap

### Kategori A — Produk & Visi

| # | Dokumen | Status | Catatan |
|---|---------|:------:|---------|
| A1 | `VISION.md` | ✅ | **diselaraskan untuk MathBank** 2026-09-29 |
| A2 | `PRD.md` | ✅ | kanonik |
| A3 | `MILESTONE.md` | ✅ | **v2.0** — 3 fase (MVP M1–M8 · lanjut M9–M12 · hardening M13–M17); M4 dipecah a–d |
| A4 | `arsip/ROADMAP-QBANK.md` | 📦 | **diarsipkan** 2026-09-29 |
| A5 | `CETAK-BIRU-MATHBANK.md` | ✅ | inventaris fitur |

### Kategori B — Arsitektur & Data

| # | Dokumen | Status | Catatan |
|---|---------|:------:|---------|
| B1 | `ARSITEKTUR-SISTEM-FULL.md` | 📦 | **referensi era QBank** (banner), angka 27 diperbaiki |
| B2 | `ARSITEKTUR-DATA-FINAL.md` | ✅ | |
| B3 | `DESAIN-PER-LAPISAN-MATHBANK.md` | ✅ | L1–L9 |
| B4 | `SKEMA-DB-DETAIL.md` | ✅ | sumber kebenaran skema |
| B5 | `L7-TINJAUAN-KRITIS-DATA.md` | ✅ | |
| B6 | `KAMUS-DATA.md` (glossary) | ✅ | **dibuat** 2026-09-29 — glosarium domain |
| B7 | `docs/ADR/` | ✅ | **15 ADR** (0001–0008 dibuat 2026-09-29; **0008 = basis UI Base UI**; **0009 = bundle satu tabel / Opsi 2** (✅ berlaku); **0010 = event jenis berulang (tahun di soal)** (✅ berlaku); **0011 = stimulus tetap di `questions`**; **0012 = `question_sources`** (⚪ digantikan sebagian ADR-0014); **0013 = pisah `collections`** — 🔴 **DIBATALKAN**; **0014 = sumber menempel pada BUNDLE**, `question_sources` dihapus; **0015 = gabung `books`/`institutions` ke `sources`** — ✅) |
| B8 | `DESAIN-SKEMA-BUNDLE-TERPISAH.md` | 📝 | proposal pembanding (DDL `collections` vs `bundles`) — **belum dieksekusi** |
| B9 | `RENCANA-QUESTION-SOURCES.md` | 📝 | rencana eksekusi ADR-0012 (`question_sources`) — T1–T8 |
| B10 | `REVIEW-MASUKAN-AUDIT-QBANK.md` | ✅ | **dibuat** 2026-10-01 — verifikasi 24 masukan audit QBank + 5 perbaikan; usulan 7 gelombang eksekusi |
| B11b | `AUDIT-DB-2026-10-01.md` | ✅ | **dibuat** 2026-10-01 — audit 29 tabel: asal (per migrasi), peruntukan, pemakaian kode & isi; temuan tabel gendut; dasar pembatalan ADR-0013 |
| B11c | `ARSITEKTUR-DAN-ALUR-MATHBANK.md` | ✅ | **dibuat** 2026-10-01 — rujukan arsitektur AKTUAL (9 lapisan, alur data, penggunaan DB, relasi, invarian) dari sumber primer; menggantikan `DESAIN-PER-LAPISAN-*` yang usang |
| B11 | `RENCANA-G1-PRESENTASI-SOAL.md` | ✅ | **selesai** 2026-10-01 — G1.1 badge C1–C6 + meter kesulitan, G1.2 popover rubrik, G1.3 wacana stimulus, G1.4 filter multi-select |
| B12 | `RENCANA-GRADE-QBANK.md` | ✅ | **selesai** 2026-10-01 — selaraskan grade dgn QBank (id "1".."12"); endpoint `/api/grades`, UI dari tabel, backfill prod |
| B13 | `RENCANA-G2-EDITOR-SOAL.md` | ✅ | **selesai** 2026-10-01 — editor: form dinamis (matrix/matching), pemilih stimulus, autosave, KaTeX linter, petunjuk rubrik |
| B14 | `RENCANA-G3-KURASI-MASSAL.md` | ✅ | **selesai** 2026-10-01 — bulk action (5 aksi), Rapid Review (mode Kilat ←/→), merge label atomik |
| B15 | `RENCANA-G4-STUDIO-MEDIA.md` | ✅ | **selesai 2026-10-01** — G4 Studio Media: G4.1 registrasi ingest, G4.2 penyaji `/img/{shortId}`, G4.3 `short_id`, G4.4 parser `{{img:}}`, G4.5 AssetPicker, G4.6 galeri `/assets` + hygiene orphan. **Ditunda:** fork, AI Generator, **#9 TikZ Studio** |

### Kategori C — Desain & UI

| # | Dokumen | Status | Catatan |
|---|---------|:------:|---------|
| C1 | `RENCANA-UI.md` | ✅ | + §4b responsif |
| C2 | `RENCANA-UI-MOBILE.md` | ✅ | mengikat |
| C3 | `DESIGN-THEME-FRAMEWORK.md` | ✅ | mesin tema |
| C4 | `THEME-FRAMEWORK-GUIDE.md` | ✅ | panduan teknis |
| C5 | `A11Y.md` | ✅ | **dibuat** 2026-09-29 — target WCAG 2.2 AA |
| C6 | `DESIGN-QUESTION-VIEW-MODES.md` | ✅ | **dibuat** 2026-10-01 — rancangan Linear-style view modes (List, Grid, Masonry) & penanganan soal panjang |
| C7 | `docs/redesign-ui/APP-SHELL-EVALUATION.md` | ✅ | **dibuat** 2026-10-01 — evaluasi responsivitas AppShell, perbaikan drawer auto-close, touch target ≥44px, dan konsistensi breakpoint lg |
| C8 | `docs/redesign-ui/QUESTION-BANK-REDESIGN.md` | ✅ | **dibuat** 2026-10-01 — arsitektur & implementasi perombakan bank soal (/questions): compound horizontal filter bar, on-demand slide-over filter drawer, dan adaptif 3 view modes (list/grid/masonry) |

### Kategori D — Mutu & Proses

| # | Dokumen | Status | Catatan |
|---|---------|:------:|---------|
| D1 | `CONSTRAINTS.md` | ✅ | 34 aturan |
| D2 | `STRATEGI-TES.md` | ✅ | baru |
| D3 | `AUDIT-KODE.md` | ✅ | |
| D4 | `AUDIT-ARSITEKTUR-DAN-DATA.md` | ✅ | |
| D5 | `AUDIT-KONSISTENSI-PERENCANAAN.md` | ✅ | |
| D6 | `REVIEW-TUMPUKAN-TEKNOLOGI.md` | ✅ | diverifikasi ulang 2026-09-30 — §5/§6 disinkronkan (migrasi Base UI selesai, ADR-0008); sisa aksi upgrade menunggu keputusan |
| D7 | `RIWAYAT-KEPUTUSAN.md` | ✅ | |
| D10 | `RISET-BETTER-AUTH.md` | ✅ | **dibuat** 2026-09-29 — evaluasi RBAC Better Auth |
| D8 | `CONTRIBUTING.md` | ✅ | **dibuat** 2026-09-29 — alur kontribusi |
| D9 | `GOVERNANCE.md` | ✅ | **dibuat** 2026-09-29 — kepemilikan & wewenang |
| D11 | `AUDIT-MUTU-M0-M4B.md` | ✅ | **dibuat** 2026-09-29 — audit mutu menyeluruh M0–M4b |
| D12 | `REVIEW-PER-MILESTONE.md` | ✅ | **dibuat** 2026-09-30 — review berurutan M1→…; temuan + perbaikan per milestone |
| D13 | `EVALUASI-STRATEGI-E2E.md` | ✅ | **dibuat** 2026-09-30 — keputusan pensiunkan e2e browser → tes alur API + smoke |
| D14 | `EVALUASI-DESKTOPONLY.md` | ✅ | **dibuat** 2026-09-30 — tinjauan `DesktopOnly` vs best practice shadcn |
| D15 | `EVALUASI-MENYELURUH.md` | ✅ | **dibuat** 2026-09-30 — audit menyeluruh (arsitektur, keamanan, a11y, mutu) |
| D16 | `PROGRES-OTONOM.md` | ✅ | **dibuat** 2026-09-30 — log pembangunan otonom M1→M12 |
| D17 | `RENCANA-SOAL.md` | ✅ | **dibuat** 2026-09-30 — 11 tipe soal (M4c) |
| D18 | `RENCANA-PAKET.md` | ✅ | **dibuat** 2026-09-30 — paket soal & penyusun (M7) |
| D21 | `RENCANA-RATE-LIMIT.md` | ✅ | **dibuat** 2026-09-30 — rate-limit auth: koreksi NEW1 + R1/R2/R3 (selesai) |
| D22 | `RENCANA-ENTERPRISE.md` | ✅ | **dibuat** 2026-09-30 — pengerasan enterprise P1–P5 (selesai) |
| D23 | `VERIFIKASI-AUDIT-M2.md` | ✅ | **dibuat** 2026-09-30 — verifikasi audit M2 (T1–T3 selesai) |
| D24 | `VERIFIKASI-AUDIT-M2B.md` | ✅ | **dibuat** 2026-09-30 — verifikasi lanjutan M2 (#2 trustedOrigins, #3 mustChangePassword; sinkronisasi dokumen audit) |
| D25 | `VERIFIKASI-AUDIT-M3.md` | ✅ | **dibuat** 2026-09-30 — verifikasi audit M3 + T-M3-3 (celah cakupan theme:check, warna status, bug badge gelap) |
| D26 | `RENCANA-PERBAIKAN-TEMUAN.md` | ✅ | **dibuat** 2026-09-30 — rencana & bukti perbaikan SELURUH temuan terkumpul (M2+M3+evaluasi) |
| D27 | `VERIFIKASI-AUDIT-M4.md` | ✅ | **dibuat** 2026-09-30 — verifikasi audit M4 + T-M4-3 (gerbang route blokir penelaah), T-M4-4, T-M4-5 |
| D28 | `VERIFIKASI-AUDIT-M5.md` | ✅ | **dibuat** 2026-09-30 — verifikasi audit M5 + T-M5-1 (audit salah label), T-M5-2 (propagasi level), T-M5-3 (clean-unused) |
| D29 | `VERIFIKASI-CATATAN-ENTERPRISE.md` | ✅ | **dibuat** 2026-09-30 — verifikasi catatan enterprise (6 rekomendasi): #2 fix, #4/#6 diterapkan, #3 dibatalkan (alasan) |
| D30 | `VERIFIKASI-AUDIT-PUSTAKA.md` | ✅ | **dibuat** 2026-09-30 — verifikasi audit pustaka: kedua temuan "redundan" (cn, tw-animate-css) SALAH |
| D31 | `VERIFIKASI-AUDIT-M6.md` | ✅ | **dibuat** 2026-09-30 — verifikasi audit M6 + T-M6-1 (logika ambang dedup), T-M6-2 (fusion belum terintegrasi) |
| D32 | `VERIFIKASI-AUDIT-M7.md` | ✅ | **dibuat** 2026-09-30 — verifikasi audit M7 + T-M7-2 (reorder parsial), T-M7-3 (RESTRICT abadi setelah arsip), T-M7-1 (klaim stimulus) |
| D33 | `EVALUASI-UPGRADE-TUMPUKAN.md` | ✅ | evaluasi tradeoff P1–P3; **P1 dikerjakan** 2026-09-30 (next 16.3.7/react 19.3.0) |
| D34 | `RENCANA-EKSPOR.md` | ✅ | **dibuat** 2026-09-30 — rencana M8 (mesin PDF, opsi cetak, risiko); keputusan = Opsi A; M8b kop/kaki/watermark |
| D35 | `docs/audit/M8-EKSPOR-CETAK.md` | ✅ | **dibuat** 2026-09-30 — audit naskah cetak & pratinjau (M8) |
| D36 | `docs/audit/AUDIT-KOMPREHENSIF-FASE-1-DAN-CATATAN-FASE-2.md` | ✅ | **dibuat** 2026-09-30 — audit penutup MVP & panduan arsitektur Fase 2/3 |
| D37 | `docs/audit/M9-INGEST-KORPUS.md` | ✅ | **dibuat** 2026-09-30 — audit mesin ingest korpus (M9); §Catatan Verifikasi 2026-09-30 (koreksi: 5 sumber, 22 tes DB) |
| D38 | `docs/audit/M10-AI-ENRICHMENT-DAN-EMBEDDING.md` | ✅ | **dibuat** 2026-09-30 — audit AI enrichment & embedding (M10); §Catatan Verifikasi 2026-09-30 (koreksi: proteksi kunci struktural, action `update`) |
| D43 | `docs/audit/M15-UI-UX-DAN-AKSESIBILITAS.md` | ✅ | **dibuat** 2026-09-30 — audit UI/UX M15; §Catatan Verifikasi (galat/404/403, reduced-motion, axe) |
| D44 | `docs/audit/M16-OBSERVABILITAS-DAN-OPERASIONAL.md` | ✅ | **dibuat** 2026-09-30 — audit M16; §Catatan Verifikasi (uji restore, Docker end-to-end, gate) |
| D45 | `docs/audit/ADR-0012-PROVENANCE-DAN-DEDUP.md` | ✅ | **dibuat** 2026-10-01 — audit ADR-0012 (`question_sources` + dedup dua-tingkat); §Catatan Verifikasi |
| D42 | `docs/audit/M14-KUALITAS-KODE-DAN-TES.md` | ✅ | **dibuat** 2026-09-30 — audit kualitas M14; §Catatan Verifikasi (refactor, tes, ambang coverage) |
| D41 | `docs/audit/M13-KEAMANAN-LANJUTAN-DAN-HARDENING.md` | ✅ | **dibuat** 2026-09-30 — audit keamanan M13; §Catatan Verifikasi (koreksi: status sebagian, bukan 100%) |
| D40 | `docs/audit/M12-EKSPOR-MOODLE-XML-DAN-GITSYNC.md` | ✅ | **dibuat** 2026-09-30 — audit ekspor Moodle/GitSync (M12); §Catatan Verifikasi (koreksi: base64 media TIDAK ada) |
| D39 | `docs/audit/M11-MODEL-CONTEXT-PROTOCOL-MCP.md` | ✅ | **dibuat** 2026-09-30 — audit MCP (M11); §Catatan Verifikasi 2026-09-30 (koreksi: "Streamable HTTP" bukan SSE; gerbang `assertMcp`/`MCP_CAPABILITIES`) |
| D19 | `STATUS-UI-MENGGANTUNG.md` | 🟡 | perlu ditinjau ulang |
| D20 | `CATATAN-INTERVIEW-ARSITEKTUR.md` | 🟡 | catatan mentah — perlu dirapikan/diarsipkan |

### Kategori E — Keamanan, Operasi & Kepatuhan

| # | Dokumen | Status | Catatan |
|---|---------|:------:|---------|
| E1 | `KEAMANAN.md` | ✅ | **dibuat** 2026-09-29 — threat model, OWASP, RBAC, rahasia, API key |
| E2 | `RENCANA-DEPLOY.md` | ✅ | **dibuat** 2026-09-29 — dev/staging/prod, CI/CD, rilis |
| E3 | `OBSERVABILITAS.md` | ✅ | **dibuat** 2026-09-29 — logging, metrik, health check, alerting |
| E4 | `BACKUP-RECOVERY.md` | ✅ | **dibuat** 2026-09-29 — RPO/RTO, uji restore |
| E5 | `RUNBOOK.md` | ✅ | **dibuat** 2026-09-30 (M16) — operasi harian, deploy, insiden, backup, migrasi, Docker (opsi) |
| E9 | `MIGRASI-ZERO-DOWNTIME.md` | ✅ | **dibuat** 2026-09-30 (M16) — expand→migrate→contract, rollback, uji migrasi |
| E6 | `KEPATUHAN-PRIVASI.md` | ✅ | **dibuat** 2026-09-29 — UU PDP, retensi, hak subjek data |
| E7 | `SLA-SLO.md` | ✅ | **dibuat** 2026-09-29 — target ketersediaan/performa |
| E8 | `PERFORMA.md` | ✅ | **dibuat** 2026-09-29 — budget performa, Core Web Vitals |

### Kategori F — API & Integrasi

| # | Dokumen | Status | Catatan |
|---|---------|:------:|---------|
| F1 | `KONTRAK-API.md` | ✅ | **dibuat** 2026-09-29 — 13 endpoint + envelope + versioning |
| F2 | `RENCANA-MCP.md` | ✅ | **terimplementasi** 2026-09-30 — M11: 7 tool MCP, policy 1 tempat, stdio+HTTP, API key agen + UI |
| F3 | `RENCANA-EKSPOR.md` | 🟢 | **belum** — paket/Moodle/PDF (M8, M12) |
| F4 | `RENCANA-MOODLE.md` | ✅ | **selesai** 2026-09-30 — M12: ekspor Moodle skema GitSync |
| F5 | `RENCANA-KEAMANAN.md` | ✅ | **sebagian selesai** 2026-09-30 — M13: S5/S6/S7/S8 ✅; S9 nonce diblokir bug Turbopack |
| F6 | `RENCANA-KUALITAS-M14.md` | ✅ | **sebagian selesai** 2026-09-30 — M14: lint #34, uji shell, refactor service, ambang coverage; TS7 ditunda |
| F7 | `RENCANA-TS7.md` | 🔴 | **ditunda** 2026-09-30 — rencana migrasi TypeScript 7 (keputusan: tunda, risiko mayor) |
| F8 | `RENCANA-UI-M15.md` | ✅ | **selesai** 2026-09-30 — M15: galat/404/403, reduced-motion, a11y lint+axe, pintasan keyboard |
| F9 | `RENCANA-OBSERVABILITAS-M16.md` | ✅ | **selesai** 2026-09-30 — M16: logger, metrik, health split, backup, CI, Docker, runbook |

### Kategori G — Fitur & Data Pipeline

| # | Dokumen | Status | Catatan |
|---|---------|:------:|---------|
| G1 | `STRATEGI-INGEST.md` | ✅ | **dirombak** 2026-09-30 — M9 = parsing **korpus HTML** (mathcyber/m4thlab/defantri), bukan PDF; aturan global + adapter per-sumber |
| G2 | `RENCANA-ENRICHMENT.md` | 🟢 | **belum** — AI embedding/tagging (M10) |
| G1b | `ATURAN-CLEANING-KORPUS.md` | ✅ | **dibuat** 2026-09-30 — aturan general cleaning korpus (berbasis 390 file nyata); menunggu persetujuan |
| G1c | `EVALUASI-KORPUS-KOMPREHENSIF.md` | ✅ | **dibuat** 2026-09-30 — pindai **1.081 file**; inventaris kotoran + aturan final |
| G1d | `RENCANA-SEGMENTASI-ADAPTER.md` | ✅ | **dibuat** 2026-09-30 — M9-2: penanda soal per-sumber + aturan mutu (menunggu persetujuan) |
| G1e | `RENCANA-MEDIA.md` | ✅ | **dibuat** 2026-09-30 — M9-2b: unduh gambar korpus (srcset>src, storage lokal, dedup hash); keputusan = unduh lokal |
| G1f | `RENCANA-INGEST.md` | ✅ | **dibuat** 2026-09-30 — M9-3: antrean + commit + endpoint `/api/v1/ingest/*`; semua hasil draft |
| G2a | `RENCANA-ENRICHMENT.md` | ✅ | **terimplementasi** 2026-09-30 — M10: AI client (9router), embedding BGE-M3 (Ollama), enkripsi key, enrichment, pencarian semantik, UI Pengaturan |
| G3 | `RENCANA-TAKSONOMI.md` | 🟢 | **belum** — seed & kelola taksonomi (M5) |
| G4 | `arsip/RENCANA-MIGRASI-DATA.md` | 📦 | **diarsipkan** (dibatalkan) 2026-09-29 |

### Kategori H — Panduan Pengguna

| # | Dokumen | Status | Catatan |
|---|---------|:------:|---------|
| H1 | `PANDUAN-OPERASIONAL.md` | 🟢 | **belum** — cara pakai guru/admin |
| H2 | `README.md` | ✅ | pintu masuk developer |
| H3 | `AGENTS.md`/`CLAUDE.md` | ✅ | aturan agen |
| H4 | `CHANGELOG.md` | ✅ | riwayat versi |

---

## 2. Ringkasan: Yang Belum Ada

| Prioritas | Dokumen | Kapan wajib |
|-----------|---------|-------------|
| 🔴 **Kritis** | ~~`KEAMANAN.md`~~ ✅, ~~`docs/ADR/`~~ ✅ | ✅ **selesai** 2026-09-29 |
| 🟠 **Penting** | ~~RENCANA-DEPLOY~~ ✅, ~~KONTRAK-API~~ ✅, ~~BACKUP-RECOVERY~~ ✅, ~~KAMUS-DATA~~ ✅, ~~A11Y~~ ✅, ~~CONTRIBUTING~~ ✅, ~~OBSERVABILITAS~~ ✅ | ✅ **SEMUA SELESAI** 2026-09-29 |
| 🟢 **Menyusul** | ~~SLA-SLO~~ ✅, ~~PERFORMA~~ ✅, ~~GOVERNANCE~~ ✅, ~~KEPATUHAN-PRIVASI~~ ✅, ~~RUNBOOK~~ ✅ (M16), ~~RENCANA-MCP/EKSPOR/MOODLE~~ ✅, ~~STRATEGI-INGEST~~ ✅, ~~RENCANA-ENRICHMENT~~ ✅ · sisa: `RENCANA-TAKSONOMI` | sisa bergantung fitur (M5) |
| 📦 **Arsip** | `arsip/ROADMAP-QBANK`, `arsip/RENCANA-MIGRASI-DATA` (era QBank) | ✅ **selesai** 2026-09-29 |

---

## 3. Aturan Tata Kelola

1. **Dokumen baru wajib terdaftar di sini** (peta = indeks hidup).
2. **Setiap dokumen punya status** (✅/🟡/🔴/🟠/🟢/📦) — tak ada status implisit.
3. **Milestone Definition of Done** menyertakan dokumen yang relevan (lihat `MILESTONE.md` + `STRATEGI-TES.md`).
4. **Dokumen era QBank** ditandai 📦 & dipindah ke `docs/arsip/` saat dirapikan.
5. **Satu sumber kebenaran:** hindari dua dokumen mengklaim hal sama tanpa rujukan silang.

---

## 4. Pemilik (Owner) — usulan

| Kategori | Pemilik |
|----------|---------|
| A (Produk) | Pemilik produk |
| B (Arsitektur/Data) | Arsitek |
| C (Desain/UI) | Desainer |
| D (Mutu/Proses) | Lead engineer |
| E (Keamanan/Ops) | Lead engineer + Ops |
| F/G (API/Fitur) | Engineer fitur terkait |
| H (Panduan) | Tech writer / pemilik produk |

---

*Peta ini hidup — perbarui setiap kali dokumen ditambah/diubah/diarsipkan.
Rujukan: `CATATAN-PLANNING.md` (§2 daftar rencana awal), `AUDIT-KONSISTENSI-PERENCANAAN.md`.*
