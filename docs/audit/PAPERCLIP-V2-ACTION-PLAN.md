# 🗺️ RENCANA AKSI PRIORITAS — MATHBANK V2

**Tanggal:** 2026-10-19 · **Issue:** MAT-114 · **Pemilik Program:** Zaid  
**Basis:** `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` (38 temuan, 8 blocker P0)  
**Format:** Sprint-ready, tiap item punya bukti, dampak, langkah, dan Definition of Done (DoD).

**Legenda:** 🔴 P0 (blocking V2) · 🟡 P1 (tinggi) · 🟢 QuickWin

---

## SPRINT 0 — Stabilisasi Darurat (Minggu 1)

> Tujuan: hilangkan risiko kehilangan data dan hijaukan gate CI. **Tidak ada V2 tanpa ini.**

| ID | Aksi | Sev | Bukti Masalah | Langkah | DoD | Effort |
|----|------|-----|---------------|---------|-----|--------|
| **A-01** | Backup DB segera + cron harian | 🔴 | Backup terbaru 11 Okt (8 hari) | `pg_dump` penuh; tambah cron `scripts/backup-db.mjs`; retensi 7/30 | Dump baru < 24 jam; cron aktif; uji restore | 2 jam |
| **A-02** | Hijaukan `check-names` test | 🔴 | `1 failed \| 966 passed`; 328 file `scripts/dev/` | Rename ke Inggris **atau** pindah ke `scripts/_legacy/` + exclude eslint/test | `npx vitest run` 967/967 hijau | 1 hari |
| **A-03** | Perbaiki 8 lint error | 🔴 | `✖ 8 errors` (7 `scripts/dev/`, 1 `.tmp-audit/`) | 6× `prefer-const`; 2× ganti `require()` → `import`; hapus `.tmp-audit/` dari repo | `npx eslint` 0 error | 2 jam |
| **A-04** | Bersihkan working tree | 🟡 | 440 file kotor | `.gitignore` artefak (`tsconfig.tsbuildinfo`, `.tmp-audit/`, `*.png` cek); commit perubahan sah | `git status` bersih | 2 jam |
| **A-05** | Pulihkan layanan embedding | 🔴 | `:11434` mati | Jalankan Ollama `bge-m3` **atau** containerize service `:3005` + healthcheck | `POST /api/embed` → vektor 1024d | 1 jam |
| **A-06** | Sinkronkan dokumentasi | 🟡 | `AGENTS.md:111` "28 tabel", `:113` "0 soal"; `README.md:48` "27 tabel" | Update ke 26 tabel & ±11.900 soal; perbarui daftar ADR | Angka cocok dengan DB | 30 mnt |

**Gate Sprint 0:** `pnpm check` HIJAU + dump backup baru + endpoint embedding merespons.

---

## SPRINT 1 — Enrichment Data Inti (Minggu 2–3)

> Tujuan: hubungkan korpus ke fitur inti. Ini yang mengubah "11.889 draft mentah" menjadi "bank soal hidup".

| ID | Aksi | Sev | Bukti | Langkah | DoD | Effort |
|----|------|-----|-------|---------|-----|--------|
| **B-01** | Backfill embedding 11.889 soal | 🔴 | `with_embed = 0` | Job batch idempoten, skip via `embedding_content_hash`; simpan `embedding_model_name`; throttle | `embedding` = 100%; HNSW terisi | 3 hari |
| **B-02** | Backfill `question_topics` | 🔴 | `question_topics = 0`, 174 topik kosong | Classifier (embedding nearest-topic / LLM); validasi sampel 100 soal | ≥ 95% soal punya ≥1 topik; 0 topik kosong | 5 hari |
| **B-03** | Backfill `question_media` | 🔴 | `question_media = 0`, 1.520 rujukan `{{img:}}` | Parser `{{img:<shortId>}}` → resolusi `short_id` → insert `question_media` | ≥ 1.500 tautan; laporkan shortId hilang | 4 jam |
| **B-04** | Inferensi difficulty | 🔴 | semua = 3 | Heuristik (tipe, langkah solusi, panjang) + LLM; distribusi 1–5 | Difficulty bervariasi & terdistribusi | 3 hari |
| **B-05** | Inferensi grade | 🔴 | seragam | Map dari bundle/event/sumber | `grade` terisi & konsisten | 2 hari |
| **B-06** | Isi `ai_tagged` + `ai_tagged_at` | 🔴 | `ai_tagged = 0` | Set saat enrichment sukses | 100% ter-enrich tertandai | 1 hari |
| **B-07** | Isi tabel `tags` | 🟡 | `tags = 0` | Ekstraksi konsep → tag; mulai dari tag kurikulum | ≥ 50 tag; soal ter-tag | 3 hari |
| **B-08** | Wariskan `event_id` | 🟡 | 80,8% tanpa event | Backfill dari bundle → soal | event coverage > 90% | 2 hari |

**Gate Sprint 1:** dashboard menunjukkan embedding/topik/media ≥ 95% terisi.

---

## SPRINT 2 — Kualitas Soal & Alur Publikasi (Minggu 4–5)

| ID | Aksi | Sev | Bukti | Langkah | DoD | Effort |
|----|------|-----|-------|---------|-----|--------|
| **C-01** | State machine status | 🔴 | 100% draft | `draft→reviewed→ready→archived`; guard transisi; audit log | Skema transisi + test | 3 hari |
| **C-02** | Promosi massal `draft→ready` | 🔴 | 0 ready | Aturan: kunci non-kosong + `!flagged` + konten ≥ 50 char | ≥ 8.000 soal `ready` | 2 hari |
| **C-03** | Triase 3.034 flagged | 🟡 | `flagged = 3034` | Klasifikasi alasan ke `flag_notes`; antrean review per-alasan | Antrean tersegmentasi; backlog turun | 3 hari |
| **C-04** | Triase 699 soal pendek | 🟡 | `SHORT = 699` | Auto-tag `quick_calc` vs antre review | Semua terkategori | 1 hari |
| **C-05** | Rekonsiliasi orphan/bundle kosong | 🟡 | 22 orphan, 1 bundle kosong | Bundle "Unfiled" / hapus; arsipkan bundle kosong | 0 orphan, 0 bundle kosong | 4 jam |
| **C-06** | Zod untuk 34 route tersisa | 🟡 | 17/51 route | Skema di `wrapRoute` sebagai kontrak wajib | 51/51 route tervalidasi | 3 hari |
| **C-07** | Error tracking | 🟡 | tidak ada | Sentry/GlitchTip + alert error-rate | Dashboard error aktif | 2 hari |

**Gate Sprint 2:** mayoritas soal `ready`; tidak ada route tanpa validasi; error terpantau.

---

## SPRINT 3 — Utang Teknis & Performa (Minggu 6)

| ID | Aksi | Sev | Bukti | Langkah | DoD | Effort |
|----|------|-----|-------|---------|-----|--------|
| **D-01** | Pecah `question-editor.tsx` (1.023) | 🟡 | CONSTRAINT #16 | Form / preview / toolbar terpisah | Semua file < 300 baris | 2 hari |
| **D-02** | Refactor `enrich.ts` (900), `clean.ts` (841) | 🟡 | idem | Pipeline per-tahap / per-aturan | File < 300 baris | 3 hari |
| **D-03** | Sapu code smell | 🟢 | 8 useMemo, 1 space-y, 18 z-index | Ganti `gap-*`, token z-index | 0 pelanggaran #6–#8 | 1 hari |
| **D-04** | Benchmark performa | 🟡 | vector mati | Ukur search/PDF/export p50/p95 | Baseline terdokumentasi | 2 hari |
| **D-05** | Containerize embedding service | 🟡 | tak terkelola | Docker Compose + healthcheck | Service reproducible | 3 hari |
| **D-06** | Tuning connection pool | 🟡 | default | Set pool size + uji beban | p95 stabil di beban target | 1 hari |

---

## Backlog Berkelanjutan (P2)

| ID | Aksi | Effort |
|----|------|--------|
| E-01 | Migrasi qbank ETL (8,1 GB, akun, koleksi) | 2 sprint |
| E-02 | Retensi & uji restore backup bulanan | berkelanjutan |
| E-03 | Update dokumen pasca tiap perubahan (PR checklist) | berkelanjutan |
| E-04 | ADR baru untuk keputusan V2 | per keputusan |

---

## Matriks Ketergantungan

```
A-01 Backup ─────────────────────────────► (semua sprint aman)
A-02/A-03 Gate hijau ──► semua PR
A-05 Embedding hidup ──► B-01 ──► B-02 (classifier) ──► B-04/B-05
B-03 Media (independen)
B-01/B-02 ──► C-01/C-02 (kriteria ready) ──► C-03/C-04
```

---

## Ringkasan Prioritas

| Prioritas | Jumlah Item | Fokus |
|-----------|-------------|-------|
| 🔴 P0 (blocking) | 8 | Gate, backup, embedding, topik, media, status, metadata |
| 🟡 P1 (tinggi) | 17 | Kualitas soal, validasi, docs, refactor, observability |
| 🟢 QuickWin | 6 | Backup, rename, lint, docs, `.gitignore`, code smell |

**Estimasi total: ±6 minggu (1 sprint stabilisasi + 2 sprint enrichment + 2 sprint kualitas + 1 sprint utang).**

---

## Definition of Done V2-Ready

- [ ] `pnpm check` hijau & CI merge bersih
- [ ] Backup harian otomatis + restore teruji
- [ ] Embedding, topik, media ≥ 95% terisi
- [ ] ≥ 80% soal berstatus `ready`
- [ ] 51/51 route tervalidasi Zod
- [ ] 0 file > 300 baris di `src/`
- [ ] Dokumentasi sinkron dengan DB
- [ ] Error tracking & metrik aktif

---
*Disusun oleh Tariq (Paperclip Agent) — siap dieksekusi sprint-per-sprint.*
