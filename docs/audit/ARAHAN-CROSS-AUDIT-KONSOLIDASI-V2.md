# 📋 ARAHAN: KONSOLIDASI & EVALUASI CROSS-AUDIT MATHBANK V2

**Tanggal:** 2026-10-19
**Penerima:** Tariq (Engineer)
**Dibuat oleh:** CodeBuddy (via Paperclip AI)
**Issue:** MAT-114 (revisi — fokus konsolidasi audit existing)

---

## 🎯 TUJAN UTAMA

**JANGAN lakukan evaluasi dari awal.**

Tugas Anda adalah membaca **SEMUA file audit yang sudah ada**, mengkonsolidasikannya, mengevaluasi **kualitas & konsistensi antar-audit**, lalu menghasilkan **satu sumber kebenaran (single source of truth)** sebagai basis persiapan V2.

---

## 📁 AUDIT YANG SUDAH ADA (WAJIB BACA SEMUA)

Lokasi: `/home/hari/projects/mathbank/docs/audit/`

| # | File | Ukuran | Sumber | Deskripsi |
|---|------|--------|--------|-----------|
| 1 | `ARAHAN-EVALUASI-MATHBANK-V2.md` | 17K | CodeBuddy | Arahan evaluasi 7-pillar (referensi kerangka) |
| 2 | `EVALUASI-MATHBANK-V2-PILLAR1-FULL.md` | 32K | Hermes subagent (deleg_b40bb3f3) | Pillar 1: Data Quality — detail lengkap |
| 3 | `EVALUASI-PAPERCLIP-V2-FULL.md` | 22K | Paperclip Tariq (run pertama) | Evaluasi umum 7-pillar |
| 4 | `EVALUASI-PAPERCLIP-V2-EXECUTIVE.md` | 4.2K | Paperclip Tariq (run pertama) | Ringkasan eksekutif |
| 5 | `PAPERCLIP-V2-ACTION-PLAN.md` | 7.5K | Paperclip Tariq (run pertama) | Action plan |
| 6 | `AUDIT-DATA-SNAPSHOT-2026-10-19.csv` | 2.5K | Hermes subagent | Snapshot data DB |
| 7 | `2026-10-18-audit-observability-instrumentation.md` | 30K | Audit terdahulu | Observability & instrumentation |
| 8 | `2026-10-18-konsistensi-dokumen-adr-vs-kode.md` | 24K | Audit terdahulu | Konsistensi ADR vs kode |
| 9 | `audit-performance-optimization.md` | 34K | Audit terdahulu | Performance optimization |

### File Referensi Tambahan (bukan audit, tapi konteks penting)

| File | Lokasi |
|------|--------|
| AGENTS.md | `/home/hari/projects/mathbank/AGENTS.md` |
| CONSTRAINTS.md | `/home/hari/projects/mathbank/CONSTRAINTS.md` (46 aturan) |
| ARCHITECTURE.md | `/home/hari/projects/mathbank/docs/ARCHITECTURE.md` |
| DESAIN-PER-LAPISAN-MATHBANK.md | `/home/hari/projects/mathbank/docs/DESAIN-PER-LAPISAN-MATHBANK.md` |
| Prior audit (lama) | `.gemini/antigravity-cli/brain/c61cf94a-.../scratch/audit-mathbank.md` |
| Spesifikasi konsolidasi | `.gemini/antigravity-cli/brain/2b31096c-.../spesifikasi-konsolidasi-mathbank.md` |

---

## 🔍 LINGKUP KERJA (5 TAHAP)

### TAHAP 1: INGESTION — Baca Semua Audit
- Baca ke-9 file audit di atas secara menyeluruh
- Ekstrak **semua temuan** (finding) dari masing-masing audit
- Catat **metadata**: sumber file, tanggal, penulis, pillar/kategori, severity

### TAHAP 2: CROSS-REFERENCE — Mapping Antar-Audit
Untuk setiap temuan, tentukan:
- **Apakah muncul di >1 audit?** → tandai sebagai **konfirmasi** atau **kontradiksi**
- **Apakah unik (hanya di 1 audit)?** → tandai sebagai **temuan tersendiri**
- **Apakah ada gap?** → area yang tidak dicakup sama sekali oleh audit manapun

### TAHAP 3: VALIDASI — Cek Keabsahan Temuan
Untuk setiap temuan yang diklaim:
- **Verifikasi dengan evidence**: Apakah file:path:line masih valid? Apakah kode sudah berubah?
- **Cek status saat ini**: Jalankan query DB / cek kode untuk konfirmasi ulang
- **Tandai yang sudah obsolete** (kode sudah diperbaiki, data sudah berubah)

### TAHAP 4: KONSOLIDASI — Buat Master Findings
Hasilkan **satu daftar master temuan** yang:
- **Deduplikasi**: tidak ada temuan ganda
- **Terurut prioritas**: P0 (blocking V2) > P1 (high) > QuickWin
- **Cross-referenced**: setiap temuan mencantumkan sumber audit asli
- **Diverifikasi**: status = confirmed / outdated / needs-recheck

### TAHAP 5: REKOMENDASI — Action Plan Terkonsolidasi
Berdasarkan master findings, buat action plan yang:
- Menggabungkan rekomendasi dari semua audit
- Menghilangkan duplikat aksi
- Menambahkan estimasi effort & dependencies
- Memberikan **rekomendasi eksekusi urutan** untuk V2

---

## 📊 FORMAT OUTPUT

### Output 1: Master Findings (WAJIB)
**File:** `/home/hari/projects/mathbank/docs/audit/CROSS-AUDIT-MASTER-FINDINGS.md`

```markdown
# Cross-Audit Master Findings — MathBank V2

## Ringkasan
- Total audit dikonsolidasi: N
- Total temuan unik: N (setelah dedup)
- P0: N | P1: N | QuickWin: N
- Outdated/discard: N

## Temuan Per Kategori

### P0 — Blocking V2
| # | Temuan | Sumber Audit | Evidence | Status | Rekomendasi |
|---|--------|-------------|----------|--------|-------------|
| P0-1 | ... | Pillar1:3.2, Perf:5.1 | file:line | confirmed | ... |

### P1 — High Priority
... (format sama)

### QuickWin
... (format sama)

### Outdated / Discarded
| # | Temuan | Sumber | Alasan Discard |
|---|--------|--------|----------------|
| ... | ... | ... | Sudah diperbaiki di commit xxx |

## Matriks Coverage (Audit × Area)
| Area Audit | Hermes P1 | Paperclip | Observability | ADR-Kode | Performance |
|------------|-----------|-----------|---------------|----------|-------------|
| Data Quality | ✅ | ✅ | ❌ | ❌ | ❌ |
| Code Health | ✅ | ✅ | ❌ | ✅ | ❌ |
| ... | ... | ... | ... | ... | ... |

## Gap Analysis
Area yang **tidak tercakup** oleh audit manapun.
```

### Output 2: Ringkasan Eksekutif (WAJIB)
**File:** `/home/hari/projects/mathbank/docs/audit/CROSS-AUDIT-EXECUTIVE-SUMMARY.md`

Maksimal 2 halaman, berisi:
- Skor kesehatan terkonsolidasi (bukan rata-rata, tapi weighted)
- Top 5 P0 yang HARUS diselesaikan sebelum V2
- Estimasi waktu total ke V2-ready
- Keputusan yang perlu disetujui CEO

### Output 3: Action Plan Terkonsolidasi (WAJIB)
**File:** `/home/hari/projects/mathbank/docs/audit/CROSS-AUDIT-ACTION-PLAN-V2.md`

Format tabel:
| # | Aksi | Priority | Estimasi | Dependency | Assignee Saran |
|---|------|----------|----------|------------|----------------|
| 1 | ... | P0 | 2 hari | None | ... |

---

## ⚠️ ATURAN PENTING

1. **Bahasa Indonesia** untuk semua output (CONSTRAINT #28)
2. **Selalu sertakan evidence** — jangan klaim tanpa bukti
3. **Jangan tebak** — jika tidak yakin, tandai sebagai "needs-recheck"
4. **Cross-reference wajib** — setiap temuan harus merujuk sumber audit asli
5. **Jangan ulangi evaluasi dari awal** — gunakan audit existing sebagai basis
6. **Verifikasi spot-check** — pilih 5-10 temuan acak dan validasi ulang dengan query/cek kode
7. **Conflicting findings** — jika 2 audit bertentangan, catat keduanya dan berikan rekomendasi mana yang lebih kredibel

---

## 📈 SUCCESS CRITERIA

Task ini **SELESAI** ketika:
- [ ] Semua 9 file audit terbaca dan di-ingest
- [ ] Master findings terdeduplikasi (tidak ada ganda)
- [ ] Matriks coverage terisi (audit × area)
- [ ] Gap analysis ditulis (area tanpa coverage)
- [ ] Minimum 5 temuan diverifikasi ulang (spot-check)
- [ ] 3 file output dihasilkan (master findings, executive summary, action plan)
- [ ] Tidak ada temuan tanpa sumber audit asli
